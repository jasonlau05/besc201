const { test } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('./electricity-rates');

function response() { return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }

test('validates location and handles missing credentials', async () => {
  const original = process.env.EIA_API_KEY;
  delete process.env.EIA_API_KEY;
  try {
    const bad = response(); await handler({ query: { state: 'ZZ' } }, bad); assert.equal(bad.statusCode, 400);
    const missing = response(); await handler({ query: { state: 'TX' } }, missing); assert.equal(missing.statusCode, 503);
  } finally { if (original === undefined) delete process.env.EIA_API_KEY; else process.env.EIA_API_KEY = original; }
});

test('requests residential prices, normalizes data, caches and never returns EIA credential echoes', async () => {
  const original = process.env.EIA_API_KEY; const originalFetch = global.fetch;
  process.env.EIA_API_KEY = 'test-key-not-a-real-credential';
  let calls = 0;
  global.fetch = async url => {
    calls++;
    assert.equal(url.searchParams.get('facets[stateid][0]'), 'TX');
    assert.equal(url.searchParams.get('facets[sectorid][0]'), 'RES');
    assert.equal(url.searchParams.get('data[0]'), 'price');
    return { ok: true, json: async () => ({ request: { api_key: process.env.EIA_API_KEY }, response: { data: [
      { stateid: 'TX', sectorid: 'RES', period: '2026-07', price: '15.62', 'price-units': 'cents per kilowatt-hour' },
      { stateid: 'TX', sectorid: 'RES', period: '2026-06', price: '15.10', 'price-units': 'cents per kilowatt-hour' },
      { stateid: 'TX', sectorid: 'RES', period: '2026-08', price: null },
    ] } }) };
  };
  try {
    const res = response(); await handler({ query: { state: 'tx' } }, res);
    assert.equal(res.statusCode, 200); assert.equal(res.body.price, 15.62); assert.equal(res.body.history.length, 2);
    assert.equal(res.body.period, '2026-07'); assert.ok(!JSON.stringify(res.body).includes('test-key'));
    await handler({ query: { state: 'TX' } }, response()); assert.equal(calls, 1);
    global.fetch = async () => { throw Error('private upstream error'); };
    const failed = response(); await handler({ query: { state: 'CA' } }, failed); assert.equal(failed.statusCode, 502);
    assert.ok(!JSON.stringify(failed.body).includes('private'));
  } finally { global.fetch = originalFetch; if (original === undefined) delete process.env.EIA_API_KEY; else process.env.EIA_API_KEY = original; }
});
