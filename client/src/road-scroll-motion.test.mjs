import test from 'node:test'
import assert from 'node:assert/strict'
import { createRoadBounce, getRoadCarPose, MAX_ROAD_BOUNCE } from './road-scroll-motion.mjs'

test('wheel input adds momentum without jumping or restarting the car', () => {
  const motion = createRoadBounce()
  motion.push(-100)
  assert.equal(motion.offset, 0)
  motion.advance(1 / 60)
  assert.ok(motion.offset < 0)
  const before = motion.offset
  motion.push(-20)
  assert.equal(motion.offset, before)
  motion.advance(1 / 60)
  assert.ok(motion.offset < before)
})

test('a wheel burst stays within the end stop and settles after input stops', () => {
  for (const direction of [-1, 1]) {
    const motion = createRoadBounce()
    for (let frame = 0; frame < 120; frame++) {
      motion.push(direction * 120)
      motion.advance(1 / 60)
      assert.ok(Math.abs(motion.offset) <= MAX_ROAD_BOUNCE)
    }
    for (let frame = 0; frame < 120; frame++) motion.advance(1 / 60)
    assert.equal(motion.offset, 0)
    assert.equal(motion.moving, false)
  }
})

test('the free spring follows the same path at 60 Hz and 144 Hz', () => {
  function sample(refreshRate) {
    const motion = createRoadBounce()
    motion.push(30)
    for (let frame = 0; frame < refreshRate / 6; frame++) motion.advance(1 / refreshRate)
    return motion.offset
  }
  assert.ok(Math.abs(sample(60) - sample(144)) < 0.001)
})

test('dragging eases into a resistant stop and releases without a jump', () => {
  const motion = createRoadBounce()
  motion.pull(-5000)
  assert.equal(motion.offset, 0)
  for (let frame = 0; frame < 60; frame++) motion.advance(1 / 60)
  assert.equal(motion.offset, -MAX_ROAD_BOUNCE)
  const before = motion.offset
  motion.release()
  assert.equal(motion.offset, before)
  for (let frame = 0; frame < 120; frame++) motion.advance(1 / 60)
  assert.equal(motion.offset, 0)
})

test('reset cancels residual motion when leaving an end or reducing motion', () => {
  const motion = createRoadBounce()
  motion.push(120)
  motion.advance(0.05)
  assert.ok(motion.offset > 0)
  motion.reset()
  motion.advance(1 / 60)
  assert.equal(motion.offset, 0)
  assert.equal(motion.moving, false)
})

const dimensions = { roadHeight: 600, carHeight: 36, carTop: 36 }

test('full bounce reaches the actual endpoint and tangent of both SVG bends', () => {
  for (const edge of [-1, 1]) {
    const progress = edge < 0 ? 0 : 1
    const pose = getRoadCarPose({ ...dimensions, progress, edge, offset: edge * MAX_ROAD_BOUNCE })
    // SVG tip: x = track center + 36, y = -4 (top) or height + 4 (bottom).
    assert.ok(Math.abs(pose.x - 36) < 0.001)
    const centerY = dimensions.carTop + dimensions.carHeight / 2 + pose.y
    assert.ok(Math.abs(centerY - (edge < 0 ? -4 : 604)) < 0.001)
    assert.equal(pose.rotation, -edge * 90)
  }
})

test('a normal wheel tick reaches the end of the curve before returning', () => {
  for (const edge of [-1, 1]) {
    const motion = createRoadBounce()
    motion.push(edge * 100)
    let reachedEnd = false
    for (let frame = 0; frame < 120; frame++) {
      motion.advance(1 / 60)
      const pose = getRoadCarPose({ ...dimensions, progress: edge < 0 ? 0 : 1, edge, offset: motion.offset })
      if (Math.abs(pose.rotation) === 90) reachedEnd = true
    }
    assert.ok(reachedEnd)
    assert.equal(motion.offset, 0)
  }
})

test('the car stays on the circular centerline and faces its tangent', () => {
  const approach = 26
  const total = approach + Math.PI * 32 / 2 + 4
  for (const edge of [-1, 1]) {
    for (const angle of [0.1, 0.5, 1, 1.5]) {
      const offset = edge * (approach + angle * 32) / total * MAX_ROAD_BOUNCE
      const pose = getRoadCarPose({ ...dimensions, progress: edge < 0 ? 0 : 1, edge, offset })
      const outwardY = edge * (pose.y - (edge < 0 ? 0 : 492))
      assert.ok(Math.abs((pose.x - 32) ** 2 + (outwardY - approach) ** 2 - 32 ** 2) < 0.001)
      assert.ok(Math.abs(pose.rotation + edge * angle * 180 / Math.PI) < 0.001)
    }
  }
})
