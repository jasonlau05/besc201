import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRatesClient } from './electricity-rates-client.mjs'

const time = Date.UTC(2026, 9, 15)
const data = { state: 'TX', price: 15.88, period: '2026-07', history: [{ period: '2026-07', price: 15.88 }], fetchedAt: new Date(time).toISOString(), stale: false }
const ok = body => ({ ok: true, json: async () => body })

test('reuses concurrent requests and fresh data without aborting shared subscribers', async () => {
  let calls = 0; let signal; let release
  const gate = new Promise(resolve => { release = resolve })
  const client = createRatesClient({ now: () => time, storage: () => null, fetchImpl: async (url, options) => {
    calls++; signal = options.signal; assert.equal(url, '/api/electricity-rates?state=TX'); await gate; return ok(data)
  } })
  const first = client.load('TX'); const second = client.load('TX')
  assert.equal(first, second); assert.equal(calls, 1); assert.equal(signal.aborted, false)
  release(); await first
  assert.equal((await client.load('TX')).price, 15.88); assert.equal(calls, 1)
})

test('persists public rates across page reloads and tolerates unavailable storage', async () => {
  const saved = new Map()
  const storage = () => ({ getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) })
  const client = createRatesClient({ now: () => time, storage, fetchImpl: async () => ok(data) })
  await client.load('TX')
  const reloaded = createRatesClient({ now: () => time + 1000, storage, fetchImpl: async () => { throw Error('must not fetch') } })
  assert.equal((await reloaded.load('TX')).price, data.price)
  const blocked = createRatesClient({ now: () => time, storage: () => { throw Error('blocked') }, fetchImpl: async () => ok(data) })
  assert.equal((await blocked.load('TX')).price, data.price)
})

test('keeps previous rates through a temporary failure without resetting their age', async () => {
  let clock = time; let fail = false; let calls = 0
  const client = createRatesClient({ now: () => clock, storage: () => null, fetchImpl: async () => {
    calls++; if (fail) throw new TypeError('network'); return ok(data)
  } })
  await client.load('TX'); fail = true; clock += 7 * 3600000
  assert.equal(client.peek('TX'), null)
  assert.equal((await client.load('TX')).stale, true)
  assert.equal(calls, 2)
  clock += 8 * 86400000
  await assert.rejects(client.load('TX'), /Unable to load/)
})

test('rejects a response for another state and allows a later retry', async () => {
  let calls = 0
  const client = createRatesClient({ now: () => time, storage: () => null, fetchImpl: async () => ok(++calls === 1 ? { ...data, state: 'CA' } : data) })
  await assert.rejects(client.load('TX'), /unavailable/)
  assert.equal(client.peek('TX'), null)
  assert.equal((await client.load('TX', { force: true })).state, 'TX')
})
