const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createChargerHandlers, normalizeStations, powerKw } = require('./chargers');

function station(id, overrides = {}) {
  return { type: 'node', id, lat: 41.88, lon: -87.63, tags: { amenity: 'charging_station', name: 'Test charging station' }, ...overrides };
}

async function withApi(options, run) {
  const handlers = createChargerHandlers(options);
  const fetch = async path => {
    const url = new URL(path);
    const res = {
      statusCode: 200, headers: {},
      set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await handlers[url.pathname === '/locations' ? 'locations' : 'nearby']({ query: Object.fromEntries(url.searchParams) }, res);
    return { status: res.statusCode, headers: { get: name => res.headers[name] }, json: async () => res.body, text: async () => JSON.stringify(res.body) };
  };
  await run('https://test.local', fetch);
}

test('normalizes node and way stations, sorts distance, filters access and obsolete data', () => {
  const origin = { latitude: 41.88, longitude: -87.63 };
  const stations = normalizeStations([
    station(1, { lat: 41.89 }),
    station(2, { type: 'way', lat: undefined, lon: undefined, center: { lat: 41.88, lon: -87.63 }, tags: {
      amenity: 'charging_station', brand: 'Network', 'socket:type1_combo': '2', 'socket:type1_combo:output': '150 kW',
      'socket:chademo': '0', 'addr:housenumber': '100', 'addr:street': 'Test Street', access: 'customers',
    } }),
    station(3, { tags: { amenity: 'charging_station', access: 'private' } }),
    station(4, { tags: { amenity: 'charging_station', motorcar: 'no' } }),
    station(5, { tags: { amenity: 'charging_station', disused: 'yes' } }),
    station(6, { lat: 42.9 }), station(7, { lat: null, lon: null }),
    station(1, { lat: 41.89 }), station(8, { tags: { amenity: 'device_charging_station' } }),
  ], origin, 5);
  assert.deepEqual(stations.map(item => item.id), ['way/2', 'node/1']);
  assert.equal(stations[0].name, 'Network');
  assert.equal(stations[0].maxPowerKw, 150);
  assert.deepEqual(stations[0].connectors, ['CCS1']);
  assert.equal(stations[0].address, '100 Test Street');
  assert.equal(stations[0].access, 'customers');
  assert.equal(stations[1].maxPowerKw, null);
  assert.equal(stations[1].address, null);
  assert.ok(stations[1].distanceMiles > 0.6 && stations[1].distanceMiles < 0.8);
});

test('power units remain accurate and ambiguous output is omitted', () => {
  assert.equal(powerKw('150 kW'), 150);
  assert.equal(powerKw('22000'), 22);
  assert.equal(powerKw('7200 W'), 7.2);
  assert.equal(powerKw('0.35 MW'), 350);
  for (const input of ['unknown', '50;150', '-50 kW', '0', '9000 kW']) assert.equal(powerKw(input), null);
});

test('validates address and coordinate inputs before contacting a provider', async () => {
  await withApi({ fetchImpl: () => { throw new Error('must not fetch'); } }, async (base, fetch) => {
    for (const query of ['', '?lat=&lng=', '?lat=91&lng=0', '?lat=0&lng=-181', '?lat=0&lng=0&radius=100', '?lat=0&lng=0&radius=5;out;']) {
      const response = await fetch(`${base}/chargers${query}`);
      assert.equal(response.status, 400, query);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    for (const query of ['', '?q=ab', '?q[]=Chicago']) assert.equal((await fetch(`${base}/locations${query}`)).status, 400);
  });
});

test('geocoding is submitted explicitly, identified, cached, and throttled', async () => {
  let requests = 0;
  await withApi({ now: () => 1000, fetchImpl: async (url, options) => {
    requests++;
    assert.equal(url.hostname, 'nominatim.openstreetmap.org');
    assert.equal(url.searchParams.get('q'), 'Chicago');
    assert.match(options.headers['User-Agent'], /Group9/);
    return { ok: true, json: async () => [{ place_id: 12, lat: '41.88', lon: '-87.63', display_name: 'Chicago, Illinois' }] };
  } }, async (base, fetch) => {
    const response = await fetch(`${base}/locations?q=Chicago`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).locations[0].latitude, 41.88);
    assert.equal((await fetch(`${base}/locations?q=%20CHICAGO%20`)).status, 200);
    assert.equal(requests, 1);
    const busy = await fetch(`${base}/locations?q=Houston`);
    assert.equal(busy.status, 429);
    assert.equal(busy.headers.get('retry-after'), '2');
    assert.equal(requests, 1);
  });
});

test('nearby search builds a bounded Overpass query and shares cached responses', async () => {
  let requests = 0;
  await withApi({ fetchImpl: async (url, options) => {
    requests++;
    assert.equal(url, 'https://overpass.private.coffee/api/interpreter');
    assert.equal(options.method, 'POST');
    const query = new URLSearchParams(options.body).get('data');
    assert.match(query, /around:8047,41\.88,-87\.63/);
    assert.match(query, /out center tags/);
    return { ok: true, json: async () => ({ elements: [station(1)] }) };
  } }, async (base, fetch) => {
    for (let i = 0; i < 2; i++) {
      const response = await fetch(`${base}/chargers?lat=41.88&lng=-87.63&radius=5`);
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.chargers.length, 1);
      assert.equal(data.source, 'OpenStreetMap');
    }
    assert.equal(requests, 1);
  });
});

test('does not mistake a partial Overpass response for no chargers and does not cache it', async () => {
  let requests = 0;
  await withApi({ fetchImpl: async () => {
    requests++;
    return { ok: true, json: async () => ({ elements: [], remark: 'runtime error: Query timed out' }) };
  } }, async (base, fetch) => {
    for (let i = 0; i < 2; i++) assert.equal((await fetch(`${base}/chargers?lat=41.88&lng=-87.63`)).status, 502);
    assert.equal(requests, 2);
  });
});

test('provider errors and timeouts are safe and distinguishable', async () => {
  for (const [provider, status] of [
    [async () => ({ ok: false, status: 429 }), 429],
    [async () => { throw Object.assign(new Error('internal secret'), { name: 'TimeoutError' }); }, 504],
    [async () => { throw new Error('internal secret'); }, 502],
  ]) {
    await withApi({ fetchImpl: provider }, async (base, fetch) => {
      const response = await fetch(`${base}/chargers?lat=0&lng=0`);
      assert.equal(response.status, status);
      assert.doesNotMatch(await response.text(), /secret/);
    });
  }
});
