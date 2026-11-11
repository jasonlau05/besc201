import test from 'node:test'
import assert from 'node:assert/strict'
import { createTabMotion, tabProgress } from './tab-motion.mjs'

test('an interrupted indicator retains its current position and velocity', () => {
  const motion = createTabMotion(0)
  motion.retarget(3)
  motion.advance(.08)
  const position = motion.position
  const velocity = motion.velocity
  assert.ok(position > 0 && position < 3)
  assert.ok(velocity > 0)
  motion.retarget(0)
  assert.equal(motion.position, position)
  assert.equal(motion.velocity, velocity)
  for (let i = 0; i < 120; i++) motion.advance(1 / 60)
  assert.equal(motion.position, 0)
  assert.equal(motion.moving, false)
})

test('rapid retargets settle at the latest destination at different frame rates', () => {
  for (const fps of [30, 60, 120]) {
    const motion = createTabMotion()
    for (const target of [3, 1, 2, 0, 2]) {
      motion.retarget(target)
      motion.advance(1 / fps)
    }
    for (let i = 0; i < fps; i++) motion.advance(1 / fps)
    assert.equal(motion.position, 2)
    assert.equal(motion.velocity, 0)
  }
})

test('the analytical motion does not depend on frame subdivision', () => {
  const a = createTabMotion()
  const b = createTabMotion()
  a.retarget(3)
  b.retarget(3)
  a.advance(.1)
  for (let i = 0; i < 10; i++) b.advance(.01)
  assert.ok(Math.abs(a.position - b.position) < 1e-10)
  assert.ok(Math.abs(a.velocity - b.velocity) < 1e-10)
})

test('drag hit testing accounts for the bar inset and clamps outside its ends', () => {
  for (const width of [296, 366, 420]) {
    const left = 12
    const step = (width - 8) / 4
    for (let i = 0; i < 4; i++) assert.equal(tabProgress(left + 4 + step * (i + .5), left, width, 4), i)
    assert.equal(tabProgress(-100, left, width, 4), 0)
    assert.equal(tabProgress(900, left, width, 4), 3)
    assert.equal(tabProgress(left + 4 + step * 2, left, width, 4), 1.5)
  }
})
