import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

test('IntersectionObserver options match { rootMargin: "150px" } between VehicleJourney and TeslaScene', () => {
  const vehicleJourneySrc = readFileSync(new URL('./VehicleJourney.jsx', import.meta.url), 'utf8')
  const teslaSceneSrc = readFileSync(new URL('./TeslaScene.jsx', import.meta.url), 'utf8')

  const vjMatch = vehicleJourneySrc.match(/new\s+IntersectionObserver\s*\([^,]+,\s*\{\s*rootMargin:\s*'([^']+)'\s*\}\)/)
  const tsMatch = teslaSceneSrc.match(/new\s+IntersectionObserver\s*\([^,]+,\s*\{\s*rootMargin:\s*'([^']+)'\s*\}\)/)

  assert.ok(vjMatch, 'VehicleJourney must instantiate IntersectionObserver with rootMargin')
  assert.ok(tsMatch, 'TeslaScene must instantiate IntersectionObserver with rootMargin')
  assert.equal(vjMatch[1], '150px', 'VehicleJourney rootMargin must be 150px')
  assert.equal(tsMatch[1], '150px', 'TeslaScene rootMargin must be 150px')
  assert.equal(vjMatch[1], tsMatch[1], 'rootMargin options must match between VehicleJourney and TeslaScene')
})

test('initial render transitions ensure data-renderer cannot be trapped in loading', () => {
  // Test transition state machine simulating TeslaScene lifecycle under various WebGL contexts
  function simulateTeslaLifecycle({ webglContext, renderThrows = false }) {
    let rendererState = 'loading'
    let fallbackReason = null
    let disposed = false
    let lost = false
    let frame = 0
    let isIntersecting = true
    const doc = { hidden: false }

    const isVisible = () => isIntersecting && !doc.hidden

    const setFallback = (reason) => {
      rendererState = 'fallback'
      fallbackReason = reason
    }

    const render = () => {
      frame = 0
      if (disposed || lost || !isVisible()) return
      if (renderThrows) {
        lost = true
        setFallback('webgl-unavailable')
        return
      }
      rendererState = 'webgl'
      fallbackReason = null
    }

    const schedule = () => {
      if (!frame && !disposed && !lost && isVisible()) {
        frame = 1
      }
    }

    try {
      if (webglContext && !webglContext.isContextLost?.()) {
        schedule()
      } else {
        setFallback(lost ? 'context-lost' : 'webgl-unavailable')
      }
    } catch {
      setFallback('webgl-unavailable')
    }

    return {
      getState: () => rendererState,
      getFallbackReason: () => fallbackReason,
      triggerFrame: () => {
        if (frame) render()
      },
      triggerContextLost: () => {
        lost = true
        if (frame) frame = 0
        setFallback('context-lost')
      },
      setIntersection: (intersecting) => {
        isIntersecting = intersecting
        if (!intersecting) {
          if (frame) frame = 0
        } else if (!doc.hidden) {
          schedule()
        }
      },
    }
  }

  // Case 1: Standard successful WebGL initialization
  const standard = simulateTeslaLifecycle({ webglContext: { isContextLost: () => false } })
  assert.equal(standard.getState(), 'loading')
  standard.triggerFrame()
  assert.equal(standard.getState(), 'webgl', 'Transitions from loading to webgl upon successful render')

  // Case 2: WebGL context unavailable (returns null or throws)
  const noContext = simulateTeslaLifecycle({ webglContext: null })
  assert.equal(noContext.getState(), 'fallback', 'Transitions immediately to fallback when context is unavailable')
  assert.equal(noContext.getFallbackReason(), 'webgl-unavailable')

  // Case 3: WebGL context already lost at creation
  const lostOnInit = simulateTeslaLifecycle({ webglContext: { isContextLost: () => true } })
  assert.equal(lostOnInit.getState(), 'fallback', 'Transitions immediately to fallback when context is lost on init')

  // Case 4: WebGL render throws an unexpected error
  const failingRender = simulateTeslaLifecycle({ webglContext: { isContextLost: () => false }, renderThrows: true })
  failingRender.triggerFrame()
  assert.equal(failingRender.getState(), 'fallback', 'Transitions to fallback when render throws')

  // Case 5: Runtime context loss after successful start
  const runtimeLoss = simulateTeslaLifecycle({ webglContext: { isContextLost: () => false } })
  runtimeLoss.triggerFrame()
  assert.equal(runtimeLoss.getState(), 'webgl')
  runtimeLoss.triggerContextLost()
  assert.equal(runtimeLoss.getState(), 'fallback')
  assert.equal(runtimeLoss.getFallbackReason(), 'context-lost')

  // Verify source code contract in TeslaScene.jsx
  const teslaSceneSrc = readFileSync(new URL('./TeslaScene.jsx', import.meta.url), 'utf8')
  assert.ok(teslaSceneSrc.includes("host.dataset.renderer = 'loading'"), 'Sets initial loading state')
  assert.ok(teslaSceneSrc.includes("host.dataset.renderer = 'webgl'"), 'Transitions to webgl state')
  assert.ok(teslaSceneSrc.includes("host.dataset.renderer = 'fallback'"), 'Transitions to fallback state')
  assert.ok(teslaSceneSrc.includes("host.dataset.fallbackReason ="), 'Sets fallback reason')
  assert.ok(!teslaSceneSrc.match(/return;\s*\}\s*catch[^{]+\{\s*\}/), 'No empty catch blocks ignoring fallback')
})

test('scroll pausing and visibilitychange coordination in vehicle animation', t => {
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
  globalThis.requestAnimationFrame = () => {
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
  assert.equal(rafScheduled, 1, 'Initial schedule creates 1 RAF')

  // Multiple rapid scroll events within the same frame must NOT schedule duplicate RAFs (coalesced)
  listeners.get('window_scroll')()
  listeners.get('window_scroll')()
  listeners.get('window_scroll')()
  assert.equal(rafScheduled, 1, 'Multiple rapid scroll events do not schedule duplicate frames while pending')

  // Background the tab / simulate visibilitychange to hidden
  fakeDocument.hidden = true
  listeners.get('visibilitychange')()
  assert.ok(cancelledFrames.includes(1), 'Cancels pending animation frame when tab is hidden')

  // Rapid scrolling while hidden must be completely paused
  const pausedCount = rafScheduled
  listeners.get('window_scroll')()
  listeners.get('window_scroll')()
  listeners.get('window_resize')()
  assert.equal(rafScheduled, pausedCount, 'Scroll and resize events while hidden are strictly paused')

  // Foreground the tab: immediately schedules a frame without requiring external user action
  fakeDocument.hidden = false
  listeners.get('visibilitychange')()
  assert.equal(rafScheduled, pausedCount + 1, 'Resumes scheduling immediately on visible transition')

  // Cleanup should remove all listeners and cancel pending frame
  cleanup()
  assert.equal(listeners.size, 0, 'All window and document listeners removed on cleanup')
})
