import test from 'node:test'
import assert from 'node:assert/strict'
import { createTeslaModel, poseTeslaModel } from './tesla-model.mjs'
import { vehicleJourneyPose } from './vehicle-journey-motion.mjs'

test('each explanation focuses its components and ghosts the surrounding assembly', () => {
  for (const [progress, active] of [[0, ['body', 'chassis']], [.35, ['pack']], [.63, ['module']], [1, ['cell', 'cooling']]]) {
    const pose = vehicleJourneyPose(progress)
    for (const field of ['body', 'chassis', 'pack', 'module', 'cell', 'cooling']) {
      if (active.includes(field)) assert.equal(pose[`${field}Fade`], 1)
      else assert.ok(pose[`${field}Fade`] > 0 && pose[`${field}Fade`] <= .12)
    }
    if (progress >= .5) assert.equal(pose.coverFade, .08)
  }
})

test('focus transitions stay continuous and reversible around each stage change', () => {
  const fields = ['bodyFade', 'packFade', 'coverFade', 'moduleFade', 'cellFade', 'coolingFade']
  for (const boundary of [.19, .23, .27, .30, .46, .48, .5, .54, .72, .76, .80]) {
    const before = vehicleJourneyPose(boundary - .0001), after = vehicleJourneyPose(boundary + .0001)
    for (const field of fields) assert.ok(Math.abs(after[field] - before[field]) < .004)
  }
  const forward = Array.from({ length: 101 }, (_, index) => vehicleJourneyPose(index / 100))
  assert.deepEqual([...forward].reverse().map(pose => vehicleJourneyPose(pose.progress)).reverse(), forward)
})

test('shared source materials cannot make active battery cells transparent', t => {
  const previousDocument = globalThis.document
  globalThis.document = { createElement: () => ({ getContext: () => null }) }
  t.after(() => { globalThis.document = previousDocument })
  const model = createTeslaModel()
  const groups = Object.entries(model.layerMaterials)
  for (const [layer, materials] of groups) {
    assert.ok(materials.size > 0, `${layer} has materials`)
    for (const [other, otherMaterials] of groups) if (layer !== other) {
      for (const material of materials) assert.ok(!otherMaterials.has(material), `${layer} and ${other} have separate opacity`)
    }
  }
  const materialCount = groups.reduce((count, [, materials]) => count + materials.size, 0)
  poseTeslaModel(model, vehicleJourneyPose(1))
  for (const material of model.layerMaterials.cells) {
    assert.equal(material.opacity, 1)
    assert.equal(material.depthWrite, true)
  }
  for (const layer of ['body', 'chassis', 'pack', 'cover', 'modules']) for (const material of model.layerMaterials[layer]) {
    assert.ok(material.opacity <= .12)
    assert.equal(material.depthWrite, false)
  }
  poseTeslaModel(model, vehicleJourneyPose(0))
  for (const material of model.layerMaterials.body) assert.equal(material.opacity, 1)
  for (const material of model.layerMaterials.cells) assert.equal(material.opacity, .12)
  assert.equal(groups.reduce((count, [, materials]) => count + materials.size, 0), materialCount)
})
