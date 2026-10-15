const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createElectricityRatesHandler } = require('./electricity-rates');

const time = Date.UTC(2026, 9, 15);
const row = (overrides = {}) => ({ stateid: 'TX', sectorid: 'RES', period: '2026-07', price: '15.88', 'price-units': 'cents per kilowatt-hour', ...overrides });
const upstream = rows => ({ ok: true, status: 200, json: async () => ({ request: { api_key: 'secret-key' }, response: { data: rows } }) });
function response() { return { statusCode: 200, headers: {}, set(name, value) { this.headers[name] = value; return this; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
const setup = options => createElectricityRatesHandler({ getKey: () => 'secret-key', now: () => time, sleep: async () => {}, ...options });
async function call(handler, state = 'TX') { const res = response(); await handler({ query: { state } }, res); return res; }

test('validates state and credentials; errors are not cacheable', async () => {
  const handler = setup({ getKey: () => '' });
  assert.equal((await call(handler, 'ZZ')).statusCode, 400);
  const res = await call(handler); assert.equal(res.statusCode, 503);
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('bounds the EIA query and normalizes observations without leaking credentials', async () => {
  const handler = setup({ fetchImpl: async url => {
    assert.equal(url.searchParams.get('facets[stateid][0]'), 'TX');
    assert.equal(url.searchParams.get('facets[sectorid][0]'), 'RES');
    assert.equal(url.searchParams.get('start'), '2024-10');
    assert.equal(url.searchParams.get('length'), '12');
    return upstream([row(), row({ period: '2026-06', price: '15.10', 'price-units': 'cents per kilowatthour' }), row(), row({ period: '2026-13' }), row({ price: null }), row({ price: true }), row({ stateid: 'CA' }), row({ 'price-units': 'dollars per kilowatt-hour' })]);
  } });
  const res = await call(handler, ' tx ');
  assert.equal(res.statusCode, 200); assert.equal(res.body.price, 15.88); assert.equal(res.body.history.length, 2);
  assert.ok(!JSON.stringify(res.body).includes('secret-key'));
  assert.match(res.headers['Cache-Control'], /s-maxage=21600/);
  assert.equal(res.body.stale, false);
});

test('shares concurrent requests and serves warm cache without hitting EIA', async () => {
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const handler = setup({ fetchImpl: async () => { calls++; await gate; return upstream([row()]); } });
  const requests = Array.from({ length: 10 }, () => call(handler));
  assert.equal(calls, 1); release();
  const results = await Promise.all(requests);
  assert.ok(results.every(res => res.statusCode === 200));
  assert.equal(results[1].headers['X-Rate-Cache'], 'SHARED');
  const hit = await call(handler);
  assert.equal(hit.headers['X-Rate-Cache'], 'HIT'); assert.equal(calls, 1);
});

test('retries transient upstream failure once, but does not retry invalid credentials', async () => {
  let calls = 0;
  const handler = setup({ fetchImpl: async () => ++calls === 1 ? { ok: false, status: 503 } : upstream([row()]) });
  assert.equal((await call(handler)).statusCode, 200); assert.equal(calls, 2);
  let denied = 0;
  const invalid = setup({ fetchImpl: async () => { denied++; return { ok: false, status: 403 }; } });
  assert.equal((await call(invalid)).statusCode, 502); assert.equal(denied, 1);
});

test('uses last successful data during outages, backs off, and rejects overly old fallback', async () => {
  let clock = time; let failing = false; let calls = 0;
  const handler = setup({ now: () => clock, fetchImpl: async () => {
    calls++; if (failing) throw new Error('private EIA URL and secret-key'); return upstream([row()]);
  } });
  await call(handler); failing = true; clock += 6 * 3600000 + 1;
  const stale = await call(handler);
  assert.equal(stale.statusCode, 200); assert.equal(stale.body.stale, true);
  assert.equal(stale.headers['X-Rate-Cache'], 'STALE'); assert.equal(calls, 3);
  const again = await call(handler); assert.equal(again.body.stale, true); assert.equal(calls, 3);
  clock += 8 * 86400000;
  const expired = await call(handler); assert.equal(expired.statusCode, 502);
  assert.equal(expired.headers['Cache-Control'], 'no-store'); assert.equal(expired.headers['Retry-After'], '30');
  assert.ok(!JSON.stringify(expired.body).includes('secret-key'));
  const before = calls; await call(handler); assert.equal(calls, before);
});

test('malformed or empty data is not cached as a success', async () => {
  let calls = 0;
  const handler = setup({ fetchImpl: async () => { calls++; return upstream([row({ price: null })]); } });
  const res = await call(handler); assert.equal(res.statusCode, 502);
  assert.match(res.body.error, /No residential price data/); assert.equal(calls, 1);
  assert.equal(res.headers['Cache-Control'], 'no-store');
});
