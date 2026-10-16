const { test } = require('node:test');
const assert = require('node:assert/strict');
const saved = require('../data/electricity-rates.json');
const { createElectricityRatesHandler } = require('./electricity-rates');
const { STATE_CODES } = require('./rates-dataset');

function response() { return { statusCode: 200, headers: {}, set(name, value) { this.headers[name] = value; return this; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
function call(handler, query = {}) { const res = response(); handler({ query }, res); return res; }

test('serves all saved states without an EIA key or any outbound request', t => {
  const original = global.fetch;
  global.fetch = () => { throw new Error('Visitor traffic must never call EIA'); };
  t.after(() => { global.fetch = original; });
  const handler = createElectricityRatesHandler({ now: () => Date.parse(saved.retrievedAt) });
  const res = call(handler);
  assert.equal(res.statusCode, 200);
  assert.equal(Object.keys(res.body.states).length, 51);
  assert.equal(res.body.states.TX.price, saved.states.TX.price);
  assert.equal(res.headers['X-Rate-Cache'], 'SAVED');
  assert.match(res.headers['Cache-Control'], /s-maxage=3600/);
  assert.equal(res.body.stale, false);
  for (const state of STATE_CODES) assert.equal(call(handler, { state }).body.price, res.body.states[state].price);
});

test('supports state lookup compatibility and rejects invalid state input', () => {
  const handler = createElectricityRatesHandler();
  const rate = call(handler, { state: ' tx ' });
  assert.equal(rate.body.state, 'TX'); assert.equal(rate.body.price, saved.states.TX.price);
  for (const state of ['ZZ', '', ['TX', 'CA']]) {
    const res = call(handler, { state });
    assert.equal(res.statusCode, 400); assert.equal(res.headers['Cache-Control'], 'no-store');
  }
});

test('labels an old saved file without discarding its usable prices', () => {
  const handler = createElectricityRatesHandler({ now: () => Date.parse(saved.retrievedAt) + 3 * 86400000 });
  assert.equal(call(handler).body.stale, true);
  assert.equal(call(handler, { state: 'CA' }).body.price, saved.states.CA.price);
});

test('invalid saved dataset fails validation rather than returning partial states', () => {
  const broken = structuredClone(saved); delete broken.states.CA;
  assert.throws(() => createElectricityRatesHandler({ dataset: broken }), /Invalid saved/);
});
