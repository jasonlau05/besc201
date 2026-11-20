import test from 'node:test'
import assert from 'node:assert/strict'
import { vehicleJourneyPose, vehicleJourneyProgress } from './vehicle-journey-motion.mjs'
import { Group } from 'three'
import { poseTeslaModel } from './tesla-model.mjs'

test('the whole model rotates exactly 180 degrees across the entire scroll sequence', () => {
  const model = Object.fromEntries(['body', 'pack', 'cover', 'cooling', 'electronics', 'group'].map(name => [name, new Group()]))
  Object.assign(model, { modules: [], cells: [], bodyMaterials: [] })
  for (const progress of [0, .01, .25, .5, .75, .99, 1, .5, 0]) {
    const pose = vehicleJourneyPose(progress)
    assert.equal(pose.turn, -180 * progress)
    poseTeslaModel(model, pose)
    assert.ok(Math.abs(model.group.rotation.y - (-.10 - Math.PI * progress)) < 1e-10)
  }
})

test('the pinned journey uses its own scroll distance across viewport sizes', () => {
  for (const viewport of [600, 844, 900, 1024]) {
    const height = 3.2 * viewport
    assert.equal(vehicleJourneyProgress(0, height, viewport), 0)
    assert.equal(vehicleJourneyProgress(-(height - viewport) / 2, height, viewport), .5)
    assert.equal(vehicleJourneyProgress(-(height - viewport), height, viewport), 1)
  }
  assert.equal(vehicleJourneyProgress(500, 2880, 900), 0)
  assert.equal(vehicleJourneyProgress(-5000, 2880, 900), 1)
})

test('the EV starts assembled and reaches a complete battery cutaway', () => {
  const start = vehicleJourneyPose(0)
  assert.equal(start.bodyLift, 0)
  assert.equal(start.bodyFade, 1)
  for (const field of ['batteryDrop', 'coverLift', 'moduleSpread', 'cellSpread']) assert.equal(start[field], 0)
  const end = vehicleJourneyPose(1)
  assert.equal(end.step, 3)
  assert.ok(end.bodyLift > end.coverLift && end.coverLift > end.batteryDrop)
  assert.ok(end.moduleSpread > end.cellSpread && end.cellSpread > 0)
  assert.ok(end.bodyFade > 0 && end.bodyFade < .25)
})

test('disassembly happens in order rather than exploding every part at once', () => {
  const body = vehicleJourneyPose(.2)
  assert.ok(body.bodyLift > 0)
  assert.equal(body.coverLift, 0)
  assert.equal(body.moduleSpread, 0)
  const pack = vehicleJourneyPose(.45)
  assert.ok(pack.coverLift > 0)
  assert.equal(pack.moduleSpread, 0)
  assert.equal(pack.cellSpread, 0)
  const modules = vehicleJourneyPose(.65)
  assert.ok(modules.moduleSpread > 0)
  assert.equal(modules.cellSpread, 0)
})

test('motion stays bounded and reassembly does not depend on scroll direction', () => {
  const forward = Array.from({ length: 101 }, (_, index) => vehicleJourneyPose(index / 100))
  let previous = forward[0]
  for (const pose of forward.slice(1)) {
    for (const field of ['bodyLift', 'batteryDrop', 'coverLift', 'moduleSpread', 'cellSpread']) assert.ok(pose[field] >= previous[field])
    assert.ok(pose.bodyFade <= previous.bodyFade)
    previous = pose
  }
  const backward = Array.from({ length: 101 }, (_, index) => vehicleJourneyPose((100 - index) / 100)).reverse()
  assert.deepEqual(backward, forward)
  assert.deepEqual(vehicleJourneyPose(-1), vehicleJourneyPose(0))
  assert.deepEqual(vehicleJourneyPose(2), vehicleJourneyPose(1))
  assert.deepEqual(vehicleJourneyPose(NaN), vehicleJourneyPose(0))
})
