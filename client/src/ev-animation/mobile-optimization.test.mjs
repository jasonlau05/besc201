import test from 'node:test'
import assert from 'node:assert/strict'
import { createVehicleMotion } from './vehicle-scroll.mjs'

test('devicePixelRatio is strictly capped at 2 for WebGL drawing buffers', () => {
  const computeBufferRatio = (dpr, width, height) => {
    const maxDpr = Math.min(dpr || 1, 2)
    return Math.min(maxDpr, width < 600 ? 1.25 : 1.5, Math.sqrt(1800000 / (width * height)))
  }

  // Mobile retina screens with DPR 3 or 4 must never exceed 2 (and are capped at 1.25 on narrow screens)
  assert.equal(computeBufferRatio(3, 390, 844), 1.25)
  assert.equal(computeBufferRatio(4, 390, 844), 1.25)
  assert.equal(computeBufferRatio(3, 844, 390), 1.5)
  assert.equal(computeBufferRatio(2, 390, 844), 1.25)
  assert.equal(computeBufferRatio(1, 390, 844), 1)
  assert.ok(computeBufferRatio(3, 1920, 1080) <= 2)
  assert.ok(computeBufferRatio(4, 1920, 1080) <= 2)
})

test('createVehicleMotion pauses animation frame scheduling when document is hidden', t => {
  const previousDocument = globalThis.document
  const previousWindow = globalThis.window

  let rafScheduled = 0
  let cancelledFrames = []
  let listeners = new Map()

  const fakeDocument = {
    hidden: false,
    addEventListener: (event, handler) => {
      listeners.set(event, handler)
    },
    removeEventListener: (event) => {
      listeners.delete(event)
    },
  }

  const fakeWindow = {
    addEventListener: (event, handler) => {
      listeners.set(`window_${event}`, handler)
    },
    removeEventListener: (event) => {
      listeners.delete(`window_${event}`)
    },
  }

  globalThis.document = fakeDocument
  globalThis.window = fakeWindow
  globalThis.requestAnimationFrame = (callback) => {
    rafScheduled++
    return rafScheduled
  }
  globalThis.cancelAnimationFrame = (id) => {
    cancelledFrames.push(id)
  }

  t.after(() => {
    globalThis.document = previousDocument
    globalThis.window = previousWindow
    delete globalThis.requestAnimationFrame
    delete globalThis.cancelAnimationFrame
  })

  const section = {
    querySelector: () => ({
      getBoundingClientRect: () => ({ top: 0, height: 1000 }),
    }),
    getBoundingClientRect: () => ({ top: 0, height: 3000 }),
    style: { setProperty: () => {} },
  }
  globalThis.getComputedStyle = () => ({ top: '0px' })

  const cleanup = createVehicleMotion(section)
  assert.equal(rafScheduled, 1)

  // Document becomes hidden: should cancel the pending animation frame
  fakeDocument.hidden = true
  listeners.get('visibilitychange')()
  assert.ok(cancelledFrames.includes(1))

  // Subsequent scroll events while hidden must NOT schedule new animation frames
  const initialCount = rafScheduled
  listeners.get('window_scroll')()
  assert.equal(rafScheduled, initialCount)

  // Document becomes visible again: should resume scheduling
  fakeDocument.hidden = false
  listeners.get('visibilitychange')()
  assert.equal(rafScheduled, initialCount + 1)

  cleanup()
})
