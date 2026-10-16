import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, unlink, rmdir, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { STATE_CODES, buildDataset } from '../src/rates-dataset.js'
import { buildBatchUrl, refreshRates } from './refresh-electricity-rates.mjs'

// Fixed fixtures deliberately do not depend on the production dataset, which
// changes daily. Mocked refreshes must remain deterministic after each commit.
const saved = { schemaVersion: 1, kind: 'reference', sector: 'Residential', unit: 'cents per kWh',
  retrievedAt: '2026-10-16T00:00:00Z', source: 'https://www.eia.gov/opendata/',
  states: Object.fromEntries(STATE_CODES.map(state => [state, { period: '2026-07', price: 15.88, history: [{ period: '2026-07', price: 15.88 }] }])) }

function batch() {
  const data = []
  for (const state of STATE_CODES) for (let index = 0; index < 12; index++) {
    const period = new Date(Date.UTC(2026, 6 - index, 1)).toISOString().slice(0, 7)
    data.push({ stateid: state, sectorid: 'RES', period, price: String(saved.states[state].price), 'price-units': 'cents per kilowatt-hour' })
  }
  return { request: { api_key: 'secret-key' }, response: { total: String(data.length), data } }
}
async function fixture(t) {
  const folder = await mkdtemp(join(tmpdir(), 'group9-rates-'))
  const outputPath = join(folder, 'rates.json')
  const original = JSON.stringify(saved)
  await writeFile(outputPath, original)
  t.after(async () => { await unlink(outputPath); await rmdir(folder) })
  return { folder, outputPath, original }
}
const fixedNow = () => new Date('2026-10-16T12:00:00Z')

test('one batch URL filters all 51 states, sector, monthly price, and bounded dates', () => {
  const url = buildBatchUrl('secret-key', fixedNow())
  assert.equal(url.searchParams.get('frequency'), 'monthly')
  assert.equal(url.searchParams.get('facets[sectorid][0]'), 'RES')
  assert.equal(url.searchParams.get('data[0]'), 'price')
  assert.equal(url.searchParams.get('length'), '5000')
  assert.equal(url.searchParams.get('start'), '2024-10')
  STATE_CODES.forEach((state, i) => assert.equal(url.searchParams.get(`facets[stateid][${i}]`), state))
})

test('batch normalization requires complete consistent histories and strips credential echoes', () => {
  const input = batch()
  const data = buildDataset(input, fixedNow().toISOString())
  assert.equal(Object.keys(data.states).length, 51)
  assert.equal(data.states.TX.history.length, 12)
  assert.equal(data.states.TX.period, '2026-07')
  assert.ok(!JSON.stringify(data).includes('secret-key'))
  const incomplete = batch(); incomplete.response.data = incomplete.response.data.filter(row => row.stateid !== 'HI')
  incomplete.response.total = incomplete.response.data.length
  assert.throws(() => buildDataset(incomplete, fixedNow().toISOString()), /Incomplete/)
  const truncated = batch(); truncated.response.total = 5001
  assert.throws(() => buildDataset(truncated, fixedNow().toISOString()), /incomplete batch/)
  const badUnits = batch(); badUnits.response.data[0]['price-units'] = 'dollars per kilowatt-hour'
  assert.throws(() => buildDataset(badUnits, fixedNow().toISOString()), /invalid residential/)
})

test('successful refresh atomically saves the whole dataset with one request', async t => {
  const { outputPath, folder } = await fixture(t)
  let calls = 0
  const summary = await refreshRates({ key: 'secret-key', outputPath, now: fixedNow, fetchImpl: async () => {
    calls++; return { ok: true, status: 200, json: async () => batch() }
  } })
  const written = JSON.parse(await readFile(outputPath, 'utf8'))
  assert.equal(calls, 1); assert.equal(summary.states, 51)
  assert.equal(written.states.CA.history.length, 12)
  assert.equal(written.kind, 'scheduled')
  assert.ok(!JSON.stringify(written).includes('secret-key'))
  assert.deepEqual(await readdir(folder), ['rates.json'])
})

test('429 is not retried and does not modify the last good saved file', async t => {
  const { outputPath, original } = await fixture(t)
  let calls = 0
  await assert.rejects(refreshRates({ key: 'secret-key', outputPath, now: fixedNow, fetchImpl: async () => {
    calls++; return { ok: false, status: 429 }
  } }), /rate limit/)
  assert.equal(calls, 1); assert.equal(await readFile(outputPath, 'utf8'), original)
})

test('missing secrets, partial data, and network failures preserve the saved dataset', async t => {
  const { outputPath, original } = await fixture(t)
  await assert.rejects(refreshRates({ key: '', outputPath }), /EIA_API_KEY/)
  const partial = batch(); partial.response.data.pop(); partial.response.total = partial.response.data.length
  await assert.rejects(refreshRates({ key: 'secret-key', outputPath, now: fixedNow, fetchImpl: async () => ({ ok: true, json: async () => partial }) }), /Incomplete/)
  let calls = 0
  await assert.rejects(refreshRates({ key: 'secret-key', outputPath, now: fixedNow, sleep: async () => {},
    fetchImpl: async () => { calls++; throw Error('URL with secret-key') } }), /could not be reached/)
  assert.equal(calls, 2)
  assert.equal(await readFile(outputPath, 'utf8'), original)
})

test('a refresh cannot move the saved reporting month backwards', async t => {
  const { outputPath } = await fixture(t)
  const newer = structuredClone(saved)
  for (const state of STATE_CODES) {
    newer.states[state].period = '2026-08'
    newer.states[state].history[0].period = '2026-08'
  }
  const original = JSON.stringify(newer)
  await writeFile(outputPath, original)
  await assert.rejects(refreshRates({ key: 'secret-key', outputPath, now: fixedNow,
    fetchImpl: async () => ({ ok: true, json: async () => batch() }) }), /older rates/)
  assert.equal(await readFile(outputPath, 'utf8'), original)
})

test('a partial latest-month publication is rejected rather than mixing reporting months', () => {
  const input = batch()
  input.response.data[0].period = '2026-08'
  assert.throws(() => buildDataset(input, fixedNow().toISOString()), /latest month for every state/)
})
