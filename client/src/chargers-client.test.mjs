import { test } from 'node:test'
import assert from 'node:assert/strict'
import { googleMapsDirections, findChargers, findLocations, formatDistance } from './chargers-client.mjs'

test('directions preserve the destination and request a driving route', () => {
  const url = new URL(googleMapsDirections({ latitude: 41.88, longitude: -87.63 }))
  assert.equal(url.origin, 'https://www.google.com')
  assert.equal(url.pathname, '/maps/dir/')
  assert.equal(url.searchParams.get('api'), '1')
  assert.equal(url.searchParams.get('destination'), '41.88,-87.63')
  assert.equal(url.searchParams.get('travelmode'), 'driving')
  assert.equal(formatDistance(0.02), 'Under 0.1 mi')
  assert.equal(formatDistance(1.26), '1.3 mi')
})

test('encodes addresses and forwards cancellation to the server', async t => {
  const controller = new AbortController()
  let requestSignal
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    const url = new URL(path, 'http://localhost')
    assert.equal(url.searchParams.get('q'), 'Main & 1st, Chicago')
    requestSignal = options.signal
    assert.equal(requestSignal.aborted, false)
    return { ok: true, json: async () => ({ locations: [{ id: '1' }] }) }
  })
  assert.equal((await findLocations('Main & 1st, Chicago', controller.signal))[0].id, '1')
  controller.abort()
  assert.equal(requestSignal.aborted, true)
  assert.equal(requestSignal.reason, controller.signal.reason)
})

test('stalled fetches and response bodies time out with a retryable message', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  for (const stage of ['fetch', 'body']) {
    let requestSignal
    t.mock.method(globalThis, 'fetch', async (path, { signal }) => {
      requestSignal = signal
      const stall = () => new Promise((resolve, reject) => {
        if (signal.aborted) reject(signal.reason)
        else signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
      return stage === 'fetch' ? stall() : { ok: true, json: stall }
    })
    const pending = assert.rejects(findChargers({ latitude: 0, longitude: 0 }, 5), /took too long.*try again/i)
    await Promise.resolve()
    t.mock.timers.tick(20000)
    await pending
    assert.equal(requestSignal.aborted, true)
  }
})

test('address searches also have a deadline and successful requests clear their timer', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let requestSignal
  t.mock.method(globalThis, 'fetch', async (path, { signal }) => {
    requestSignal = signal
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
  })
  const pending = assert.rejects(findLocations('Chicago'), /took too long/)
  t.mock.timers.tick(20000)
  await pending
  globalThis.fetch = async (path, { signal }) => {
    requestSignal = signal
    return { ok: true, json: async () => ({ locations: [] }) }
  }
  assert.deepEqual(await findLocations('Chicago'), [])
  t.mock.timers.tick(20000)
  assert.equal(requestSignal.aborted, false)
})

test('canceling an in-flight request preserves cancellation for fetches and response bodies', async t => {
  for (const stage of ['fetch', 'body']) {
    const controller = new AbortController()
    t.mock.method(globalThis, 'fetch', async (path, { signal }) => {
      const stall = () => new Promise((resolve, reject) => {
        if (signal.aborted) reject(signal.reason)
        else signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
      return stage === 'fetch' ? stall() : { ok: true, json: stall }
    })
    const pending = assert.rejects(findChargers({ latitude: 0, longitude: 0 }, 5, controller.signal), { name: 'AbortError' })
    await Promise.resolve()
    controller.abort()
    await pending
  }
})

test('preserves actionable provider errors, rejects invalid responses, and preserves cancellation', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, json: async () => ({ error: 'Wait a moment and try again.' }) }))
  await assert.rejects(findChargers({ latitude: 0, longitude: 0 }, 5), /Wait a moment/)
  globalThis.fetch = async () => ({ ok: true, json: async () => ({}) })
  await assert.rejects(findChargers({ latitude: 0, longitude: 0 }, 5), /incomplete response/)
  globalThis.fetch = async () => { throw new DOMException('Canceled', 'AbortError') }
  await assert.rejects(findLocations('Chicago'), { name: 'AbortError' })
})
