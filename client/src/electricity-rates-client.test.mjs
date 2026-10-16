import { test } from 'node:test'
import assert from 'node:assert/strict'
import saved from '../../server/data/electricity-rates.json' with { type: 'json' }
import { createRatesClient, lookupRates } from './electricity-rates-client.mjs'

const time = Date.parse(saved.retrievedAt)
const ok = body => ({ ok: true, json: async () => body })

test('one batch request serves every subsequent state lookup', async () => {
  let calls = 0; let release
  const gate = new Promise(resolve => { release = resolve })
  const client = createRatesClient({ now: () => time, storage: () => null, fetchImpl: async (url, options) => {
    assert.equal(url, '/api/electricity-rates')
    assert.equal(options.signal.aborted, false)
    calls++; await gate; return ok(saved)
  } })
  const first = client.loadDataset()
  assert.equal(first, client.loadDataset()); assert.equal(calls, 1)
  release(); const dataset = await first
  for (const state of Object.keys(saved.states)) {
    assert.equal(lookupRates(dataset, state, time).price, saved.states[state].price)
    assert.equal(lookupRates(dataset, state, time).state, state)
  }
  assert.equal(lookupRates(dataset, 'ZZ'), null)
  assert.equal(lookupRates(dataset, 'constructor'), null)
  await client.loadDataset(); assert.equal(calls, 1)
})

test('the entire dataset persists as one entry across reloads; storage failures are optional', async () => {
  const memory = new Map()
  const storage = () => ({ getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) })
  await createRatesClient({ now: () => time, storage, fetchImpl: async () => ok(saved) }).loadDataset()
  assert.equal(memory.size, 1)
  const next = createRatesClient({ now: () => time, storage, fetchImpl: async () => { throw Error('must not fetch') } })
  assert.equal((await next.loadDataset()).states.CA.price, saved.states.CA.price)
  const blocked = createRatesClient({ storage: () => { throw Error('blocked') }, fetchImpl: async () => ok(saved) })
  assert.equal(Object.keys((await blocked.loadDataset()).states).length, 51)
})

test('a failed dataset reload keeps all previous states and labels them stale', async () => {
  let clock = time; let fail = false; let calls = 0
  const client = createRatesClient({ now: () => clock, storage: () => null, fetchImpl: async () => {
    calls++; if (fail) throw new TypeError('offline'); return ok(saved)
  } })
  await client.loadDataset(); fail = true; clock += 3600000
  assert.equal(client.peekDataset(), null)
  const stale = await client.loadDataset()
  assert.equal(stale.stale, true); assert.equal(Object.keys(stale.states).length, 51)
  assert.equal(lookupRates(stale, 'HI', clock).price, saved.states.HI.price); assert.equal(calls, 2)
})

test('partial or invalid data never poisons the all-state cache and can be retried', async () => {
  const partial = structuredClone(saved); delete partial.states.CA
  let calls = 0
  const client = createRatesClient({ storage: () => null, fetchImpl: async () => ok(++calls === 1 ? partial : saved) })
  await assert.rejects(client.loadDataset(), /Unable to load saved/)
  assert.equal(client.peekDataset(true), null)
  assert.equal((await client.loadDataset({ force: true })).states.CA.price, saved.states.CA.price)
})

test('first-visit failures show an actionable error and reference dates stay intact', async () => {
  const client = createRatesClient({ storage: () => null, fetchImpl: async () => { throw new TypeError('network') } })
  await assert.rejects(client.loadDataset(), /Unable to load saved electricity rates/)
  const lookup = lookupRates(saved, 'TX', time)
  assert.equal(lookup.fetchedAt, saved.retrievedAt); assert.equal(lookup.fallback, saved.kind === 'reference')
  assert.equal(lookupRates(saved, 'TX', time + 3 * 86400000).stale, true)
})
