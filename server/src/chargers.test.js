const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createChargerHandlers } = require('./chargers');
const { createChargerSearch } = require('./charger-data');
const { RETRIEVED_AT, station, dataset } = require('../test/charger-fixtures');

async function withApi(options, run) {
  const search = createChargerSearch(dataset());
  const handlers = createChargerHandlers({ getSavedSearch: () => search, ...options });
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

test('validates inputs before loading data or contacting a geocoder', async () => {
  await withApi({ getSavedSearch: () => { throw new Error('must not load'); }, fetchImpl: () => { throw new Error('must not fetch'); } }, async (base, fetch) => {
    for (const query of ['', '?lat=&lng=', '?lat=91&lng=0', '?lat=0&lng=-181', '?lat=0&lng=0&radius=100', '?lat=0&lng=0&radius=2', '?lat=0&lng=0&radius=5;out;']) {
      const response = await fetch(`${base}/chargers${query}`);
      assert.equal(response.status, 400, query);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    for (const query of ['', '?q=ab', '?q[]=Chicago']) assert.equal((await fetch(`${base}/locations${query}`)).status, 400);
  });
});

test('nearby searches need no API key and never contact any provider', async () => {
  await withApi({ fetchImpl: () => { throw new Error('No network is allowed for saved station searches.'); } }, async (base, fetch) => {
    for (const radius of [1, 5, 10, 25]) {
      const response = await fetch(`${base}/chargers?lat=41.88&lng=-87.63&radius=${radius}`);
      const data = await response.json();
      assert.equal(response.status, 200);
      assert.equal(data.chargers[0].id, 'afdc/1');
      assert.equal(data.source, 'AFDC');
      assert.equal(data.retrievedAt, RETRIEVED_AT);
      assert.equal(data.radius, radius);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    const empty = await fetch(`${base}/chargers?lat=0&lng=0`);
    assert.equal(empty.status, 200);
    assert.equal((await empty.json()).total, 0);
    assert.equal((await empty.json()).radius, 1);
  });
});

test('station results are bounded and stale saved data remains available', async () => {
  const search = createChargerSearch(dataset(Array.from({ length: 50 }, (_, i) => station(i + 1))));
  await withApi({ getSavedSearch: () => search, now: () => Date.parse(RETRIEVED_AT) + 3 * 86400000 }, async (base, fetch) => {
    const response = await fetch(`${base}/chargers?lat=41.88&lng=-87.63`);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.total, 50);
    assert.equal(data.chargers.length, 30);
    assert.equal(data.stale, true);
  });
});

test('missing or corrupt datasets return a safe error rather than false empty results', async () => {
  await withApi({ getSavedSearch: () => { throw new Error('C:/private/path with secret'); } }, async (base, fetch) => {
    const response = await fetch(`${base}/chargers?lat=41.88&lng=-87.63`);
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /Saved charger data is unavailable/);
    assert.doesNotMatch(await response.text(), /private|secret/);
  });
});

test('geocoding is explicitly submitted, US-scoped, identified, cached, shared, and throttled', async () => {
  let requests = 0;
  await withApi({ now: () => 1000, fetchImpl: async (url, options) => {
    requests++;
    assert.equal(url.hostname, 'nominatim.openstreetmap.org');
    assert.equal(url.searchParams.get('q'), 'Chicago');
    assert.equal(url.searchParams.get('countrycodes'), 'us');
    assert.match(options.headers['User-Agent'], /Group9/);
    return Response.json([{ place_id: 12, lat: '41.88', lon: '-87.63', display_name: 'Chicago, Illinois' }]);
  } }, async (base, fetch) => {
    const responses = await Promise.all([fetch(`${base}/locations?q=Chicago`), fetch(`${base}/locations?q=Chicago`)]);
    assert.equal(responses[0].status, 200);
    assert.equal((await responses[0].json()).locations[0].latitude, 41.88);
    assert.equal((await fetch(`${base}/locations?q=%20CHICAGO%20`)).status, 200);
    assert.equal(requests, 1);
    const busy = await fetch(`${base}/locations?q=Houston`);
    assert.equal(busy.status, 429);
    assert.equal(busy.headers.get('retry-after'), '2');
    assert.equal(requests, 1);
  });
});

test('geocoder errors are safe, distinguishable, and never automatically retried', async () => {
  for (const [provider, status] of [
    [async () => new Response('secret', { status: 429 }), 429],
    [async () => new Response('secret', { status: 503 }), 502],
    [async () => { throw Object.assign(new Error('secret'), { name: 'TimeoutError' }); }, 504],
    [async () => { throw new Error('secret'); }, 502],
    [async () => Response.json({ error: 'secret' }), 502],
  ]) {
    let requests = 0;
    await withApi({ fetchImpl: async (...args) => { requests++; return provider(...args); } }, async (base, fetch) => {
      const response = await fetch(`${base}/locations?q=Chicago`);
      assert.equal(response.status, status);
      assert.equal(requests, 1);
      assert.doesNotMatch(await response.text(), /secret/);
    });
  }
});

test('geocoding deadlines cover both requests and response bodies', async () => {
  for (const stage of ['fetch', 'body']) {
    await withApi({ requestTimeoutMs: 10, fetchImpl: async (url, { signal }) => {
      const stall = () => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
      return stage === 'fetch' ? stall() : { ok: true, json: stall };
    } }, async (base, fetch) => {
      const response = await fetch(`${base}/locations?q=Chicago`);
      assert.equal(response.status, 504);
      assert.match((await response.json()).error, /use your location/);
    });
  }
});
