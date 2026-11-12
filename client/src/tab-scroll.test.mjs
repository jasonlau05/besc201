import test from 'node:test'
import assert from 'node:assert/strict'
import { createTabScroll } from './tab-scroll.mjs'

function scrolling(position = 0, maximum = 2000) {
  const scroll = createTabScroll(position, maximum)
  let compact = false
  let time = 0
  return {
    scroll,
    move(position, limit = maximum, delay = 16) {
      time += delay
      compact = scroll.update(position, limit, time, compact)
      return compact
    },
  }
}

test('small scrolls and direction jitter do not resize the navigation', () => {
  const page = scrolling()
  for (const y of [12, 28, 50, 48, 65, 79]) assert.equal(page.move(y), false)
  assert.equal(page.move(90), true)
  for (const y of [110, 108, 130, 126, 116, 129, 100, 70]) assert.equal(page.move(y), true)
  assert.equal(page.move(65), false)
})

test('separate small gestures do not accumulate into a resize', () => {
  const page = scrolling(300)
  for (const y of [330, 360, 390, 420]) assert.equal(page.move(y, 2000, 400), false)
  assert.equal(page.move(510), true)
  for (const y of [490, 470, 450]) assert.equal(page.move(y, 2000, 400), true)
  assert.equal(page.move(380), false)
})

test('bottom overscroll and its in-range rebound keep the bar compact', () => {
  const page = scrolling()
  assert.equal(page.move(600), true)
  for (const y of [1980, 2000, 2040, 2100, 2040, 2000, 1970, 1900, 1850, 1940, 2000]) {
    assert.equal(page.move(y), true, `bounce at ${y}`)
  }
  page.scroll.upwardIntent()
  assert.equal(page.move(1980), true)
  assert.equal(page.move(1930), false)
})

test('reaching the bottom in one frame still compacts after a long scroll', () => {
  const page = scrolling()
  assert.equal(page.move(2000), true)
  assert.equal(page.move(1900), true)
})

test('browser toolbar and content resizing do not count as scroll direction', () => {
  const page = scrolling()
  assert.equal(page.move(600), true)
  assert.equal(page.move(500, 1900), true)
  assert.equal(page.move(499, 1900), true)
  assert.equal(page.move(430, 1900), false)
  assert.equal(page.move(700, 2200), false)
})

test('a viewport change during bottom bounce preserves the rebound guard', () => {
  const page = scrolling()
  assert.equal(page.move(2000), true)
  assert.equal(page.move(1900, 1900), true)
  assert.equal(page.move(2000, 2000), true)
  assert.equal(page.move(1880), true)
  page.scroll.upwardIntent()
  assert.equal(page.move(1800), false)
})

test('returning to the top expands; a top bounce cannot immediately compact again', () => {
  const page = scrolling()
  assert.equal(page.move(600), true)
  for (const y of [6, -60, -20, 0, 12, 30, 5]) assert.equal(page.move(y), false)
  assert.equal(page.move(90), true)
})

test('switching scroll containers or routes resets pending intent', () => {
  const page = scrolling()
  assert.equal(page.move(60), false)
  page.scroll.reset(300, 2000)
  assert.equal(page.move(320), false)
  assert.equal(page.move(400), true)
  page.scroll.reset(0, 2000)
  assert.equal(page.move(0), false)
})

test('short content with no scroll range leaves the bar expanded', () => {
  const page = scrolling(0, 0)
  for (const y of [-50, 0, 50]) assert.equal(page.move(y), false)
})
