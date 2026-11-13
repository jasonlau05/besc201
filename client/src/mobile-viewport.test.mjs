import test from 'node:test'
import assert from 'node:assert/strict'
import { trackMobileViewport } from './mobile-viewport.mjs'

function browser() {
  const document = new EventTarget()
  const viewport = Object.assign(new EventTarget(), { height: 720, offsetTop: 0, scale: 1 })
  const frames = new Map()
  let nextFrame = 0
  const view = Object.assign(new EventTarget(), {
    visualViewport: viewport,
    innerHeight: 844,
    getComputedStyle: element => ({ top: `${element.top()}px` }),
    requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame },
    cancelAnimationFrame: id => frames.delete(id),
  })
  function element(top) {
    const properties = new Map()
    return {
      ownerDocument: document, origin: 0, visible: true, top,
      style: {
        getPropertyValue: key => properties.get(key) || '',
        setProperty: (key, value) => properties.set(key, value),
        removeProperty: key => properties.delete(key),
      },
      getClientRects() { return this.visible ? [this.getBoundingClientRect()] : [] },
      getBoundingClientRect() { return { top: this.top() + this.origin } },
    }
  }
  const header = element(() => parseFloat(header.style.getPropertyValue('--site-viewport-top')) || 0)
  const nav = element(() => {
    const bottom = parseFloat(nav.style.getPropertyValue('--site-viewport-bottom'))
    return (Number.isFinite(bottom) ? bottom : view.innerHeight) - 52 - 10
  })
  function flush() {
    for (const [id, callback] of [...frames]) { frames.delete(id); callback() }
  }
  function aligned() {
    assert.equal(header.getBoundingClientRect().top, viewport.offsetTop)
    assert.equal(nav.getBoundingClientRect().top + 52, viewport.offsetTop + viewport.height - 10)
  }
  return { document, viewport, view, header, nav, frames, flush, aligned }
}

test('both controls compensate for a stale fixed origin and a smaller visual viewport', () => {
  const page = browser()
  page.viewport.offsetTop = 24
  page.header.origin = 45
  page.nav.origin = 45
  const stop = trackMobileViewport(page.header, page.nav, page.view)
  page.aligned()
  for (let i = 0; i < 5; i++) {
    page.view.dispatchEvent(new Event('scroll'))
    page.flush()
    page.aligned()
  }
  stop()
})

test('toolbar changes, keyboard dismissal and restored pages refresh both anchors', () => {
  const page = browser()
  const stop = trackMobileViewport(page.header, page.nav, page.view)
  for (const [target, event, height, offset, origin] of [
    [page.viewport, 'resize', 800, 0, 0],
    [page.viewport, 'scroll', 420, 70, 24],
    [page.document, 'focusout', 720, 24, 45],
    [page.view, 'pageshow', 780, 0, -24],
    [page.document, 'visibilitychange', 720, 0, 0],
  ]) {
    Object.assign(page.viewport, { height, offsetTop: offset })
    page.header.origin = origin
    page.nav.origin = origin / 2
    target.dispatchEvent(new Event(event))
    page.flush()
    page.aligned()
  }
  stop()
})

test('hidden navigation is measured again when the keyboard closes', () => {
  const page = browser()
  page.nav.visible = false
  const stop = trackMobileViewport(page.header, page.nav, page.view)
  assert.equal(page.nav.style.getPropertyValue('--site-viewport-bottom'), '')
  page.nav.visible = true
  page.document.dispatchEvent(new Event('focusout'))
  page.flush()
  page.aligned()
  stop()
})

test('pinch zoom uses native positioning and resuming normal scale restores alignment', () => {
  const page = browser()
  const stop = trackMobileViewport(page.header, page.nav, page.view)
  page.viewport.scale = 2
  page.viewport.dispatchEvent(new Event('resize'))
  page.flush()
  assert.equal(page.header.style.getPropertyValue('--site-viewport-top'), '')
  assert.equal(page.nav.style.getPropertyValue('--site-viewport-bottom'), '')
  page.viewport.scale = 1
  page.viewport.dispatchEvent(new Event('resize'))
  page.flush()
  page.aligned()
  stop()
})

test('events share a frame, and cleanup removes pending work and offsets', () => {
  const page = browser()
  const stop = trackMobileViewport(page.header, page.nav, page.view)
  for (const target of [page.view, page.viewport]) target.dispatchEvent(new Event('scroll'))
  page.viewport.dispatchEvent(new Event('resize'))
  assert.equal(page.frames.size, 1)
  stop()
  assert.equal(page.frames.size, 0)
  assert.equal(page.header.style.getPropertyValue('--site-viewport-top'), '')
  assert.equal(page.nav.style.getPropertyValue('--site-viewport-bottom'), '')
  page.view.dispatchEvent(new Event('pageshow'))
  page.viewport.dispatchEvent(new Event('resize'))
  page.document.dispatchEvent(new Event('focusout'))
  assert.equal(page.frames.size, 0)
})

test('browsers without VisualViewport keep the CSS fallback', () => {
  const page = browser()
  page.view.visualViewport = null
  const stop = trackMobileViewport(page.header, page.nav, page.view)
  assert.equal(page.header.style.getPropertyValue('--site-viewport-top'), '')
  assert.equal(page.nav.style.getPropertyValue('--site-viewport-bottom'), '')
  stop()
})

test('a breakpoint changing top to auto cannot write invalid offsets', () => {
  const page = browser()
  page.view.getComputedStyle = () => ({ top: 'auto' })
  const stop = trackMobileViewport(page.header, page.nav, page.view)
  assert.equal(page.header.style.getPropertyValue('--site-viewport-top'), '')
  assert.equal(page.nav.style.getPropertyValue('--site-viewport-bottom'), '')
  stop()
})
