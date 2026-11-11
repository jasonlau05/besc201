import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, readdir, rm, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { refreshChargers, buildBatchUrl, serializeDataset } from './refresh-chargers.mjs'
import { station, payload, dataset } from '../test/charger-fixtures.js'

async function savedFile(t, previous = dataset()) {
  const directory = await mkdtemp(join(tmpdir(), 'besc-afdc-'))
  const outputPath = join(directory, 'charging-stations.json')
  t.after(async () => {
    for (const name of await readdir(directory)) await rm(join(directory, name))
    await rmdir(directory)
  })
  if (previous) await writeFile(outputPath, serializeDataset(previous))
  return outputPath
}
const defaults = {
  key: 'test-private-key', minimumStations: 1, requiredStates: ['IL'],
  now: () => new Date('2026-11-11T12:00:00.000Z'), sleep: async () => {},
}

test('one complete batch uses a private header and saves only trimmed station data', async t => {
  const outputPath = await savedFile(t)
  let requests = 0
  const result = await refreshChargers({ ...defaults, outputPath, fetchImpl: async (url, options) => {
    requests++
    assert.equal(url.origin, 'https://developer.nlr.gov')
    assert.deepEqual(Object.fromEntries(url.searchParams), { fuel_type: 'ELEC', access: 'public', status: 'E', country: 'US', limit: 'all' })
    assert.equal(url.searchParams.has('api_key'), false)
    assert.equal(options.headers['X-Api-Key'], defaults.key)
    return Response.json(payload([station(2), station(1, { ignored: defaults.key })]))
  } })
  const contents = await readFile(outputPath, 'utf8')
  const saved = JSON.parse(contents)
  assert.equal(requests, 1)
  assert.equal(result.stationCount, 2)
  assert.equal(result.bytes, Buffer.byteLength(contents))
  assert.deepEqual(saved.stations.map(item => item.id), ['afdc/1', 'afdc/2'])
  assert.equal(saved.retrievedAt, defaults.now().toISOString())
  assert.doesNotMatch(contents, /test-private-key|ignored|api_key|ev_charging_units/)
  assert.deepEqual(await readdir(join(outputPath, '..')), ['charging-stations.json'])
})

test('initial bootstrap can create the saved dataset without a previous file', async t => {
  const outputPath = await savedFile(t, null)
  await refreshChargers({ ...defaults, outputPath, fetchImpl: async () => Response.json(payload()) })
  assert.equal(JSON.parse(await readFile(outputPath, 'utf8')).stationCount, 1)
  assert.equal(buildBatchUrl().searchParams.get('limit'), 'all')
})

test('missing credentials, demo keys, authorization failures, and throttling leave saved data intact', async t => {
  const outputPath = await savedFile(t)
  const original = await readFile(outputPath, 'utf8')
  for (const key of ['', 'DEMO_KEY', 'your_key']) {
    await assert.rejects(refreshChargers({ ...defaults, outputPath, key, fetchImpl: () => { throw new Error('must not fetch') } }), /AFDC_API_KEY/)
  }
  for (const status of [401, 403, 429]) {
    let requests = 0
    await assert.rejects(refreshChargers({ ...defaults, outputPath, fetchImpl: async () => {
      requests++
      return new Response(defaults.key, { status })
    } }), error => !error.message.includes(defaults.key))
    assert.equal(requests, 1)
  }
  assert.equal(await readFile(outputPath, 'utf8'), original)
})

test('truncated and low-coverage responses never overwrite the last good file', async t => {
  const outputPath = await savedFile(t)
  const original = await readFile(outputPath, 'utf8')
  for (const [data, overrides] of [
    [{ total_results: 2, fuel_stations: [station()] }, {}],
    [payload([]), {}], [payload([station(1), station(1)]), {}],
    [payload(), { minimumStations: 50000 }],
    [payload(), { requiredStates: ['IL', 'CA'] }],
    [payload([station(1), station(2, { latitude: null })]), {}],
  ]) {
    await assert.rejects(refreshChargers({ ...defaults, outputPath, ...overrides, fetchImpl: async () => Response.json(data) }))
    assert.equal(await readFile(outputPath, 'utf8'), original)
  }
})

test('a sudden drop in station coverage and an older retrieval date are rejected', async t => {
  const previous = dataset(Array.from({ length: 20 }, (_, i) => station(i + 1)))
  const outputPath = await savedFile(t, previous)
  const original = await readFile(outputPath, 'utf8')
  await assert.rejects(refreshChargers({ ...defaults, outputPath, fetchImpl: async () => Response.json(payload([station()])) }), /coverage/)
  await assert.rejects(refreshChargers({ ...defaults, outputPath,
    now: () => new Date('2026-11-01T12:00:00Z'),
    fetchImpl: async () => Response.json(payload(Array.from({ length: 20 }, (_, i) => station(i + 1)))),
  }), /older/)
  assert.equal(await readFile(outputPath, 'utf8'), original)
})

test('transient failures get at most one retry and raw provider errors stay private', async t => {
  const outputPath = await savedFile(t)
  let requests = 0
  await refreshChargers({ ...defaults, outputPath, fetchImpl: async () => {
    requests++
    return requests === 1 ? new Response('failed', { status: 503 }) : Response.json(payload())
  } })
  assert.equal(requests, 2)
  const original = await readFile(outputPath, 'utf8')
  requests = 0
  await assert.rejects(refreshChargers({ ...defaults, outputPath, fetchImpl: async () => {
    requests++
    throw new Error(defaults.key)
  } }), error => !error.message.includes(defaults.key))
  assert.equal(requests, 2)
  assert.equal(await readFile(outputPath, 'utf8'), original)
})

test('deadlines cover stalled requests and response bodies and preserve saved data', async t => {
  const outputPath = await savedFile(t)
  const original = await readFile(outputPath, 'utf8')
  for (const stage of ['fetch', 'body']) {
    let requests = 0
    await assert.rejects(refreshChargers({ ...defaults, outputPath, requestTimeoutMs: 10, fetchImpl: async (url, { signal }) => {
      requests++
      const stall = () => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
      return stage === 'fetch' ? stall() : { ok: true, json: stall }
    } }), /timed out/)
    assert.equal(requests, 2)
    assert.equal(await readFile(outputPath, 'utf8'), original)
  }
})

test('malformed JSON and an invalid previous file fail without exposing secrets or losing data', async t => {
  const outputPath = await savedFile(t)
  const original = await readFile(outputPath, 'utf8')
  let requests = 0
  await assert.rejects(refreshChargers({ ...defaults, outputPath, fetchImpl: async () => {
    requests++
    return { ok: true, json: async () => { throw new SyntaxError(defaults.key) } }
  } }), error => !error.message.includes(defaults.key))
  assert.equal(requests, 1)
  assert.equal(await readFile(outputPath, 'utf8'), original)
  await writeFile(outputPath, 'invalid saved JSON')
  await assert.rejects(refreshChargers({ ...defaults, outputPath, fetchImpl: () => { throw new Error('must not fetch') } }), /saved charger dataset is invalid/)
  assert.equal(await readFile(outputPath, 'utf8'), 'invalid saved JSON')
})
