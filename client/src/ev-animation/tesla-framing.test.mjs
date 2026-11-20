import test from 'node:test'
import assert from 'node:assert/strict'
import { Box3, Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry, Vector3 } from 'three'
import { createTeslaModel, poseTeslaModel } from './tesla-model.mjs'
import { vehicleJourneyPose } from './vehicle-journey-motion.mjs'
import { fitTeslaCamera } from './tesla-framing.mjs'

function fixture(t) {
  const previous = globalThis.document
  globalThis.document = { createElement: () => ({ getContext: () => null }) }
  t.after(() => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous })
  const model = createTeslaModel()
  // The studio shadow must not force the physical vehicle to become tiny.
  model.shadow = new Mesh(new PlaneGeometry(100, 100), new MeshBasicMaterial())
  model.group.add(model.shadow)
  const camera = new OrthographicCamera(-3, 3, 2, -2, .1, 70)
  const parts = []
  model.group.traverse(object => {
    if (!object.isMesh || object === model.shadow) return
    if (object.isInstancedMesh) object.computeBoundingBox()
    else object.geometry.computeBoundingBox()
    parts.push({ object, box: new Box3().copy(object.isInstancedMesh ? object.boundingBox : object.geometry.boundingBox) })
  })
  return { model, camera, parts }
}

test('all physical parts stay within a padded frame throughout rotation, disassembly and resize', t => {
  const { model, camera, parts } = fixture(t)
  const point = new Vector3()
  for (const aspect of [.8, 1.03, 1.21, 1.47, 1.95, 3.4]) {
    for (let frame = 0; frame <= 100; frame++) {
      const progress = frame / 100
      const pose = vehicleJourneyPose(progress)
      poseTeslaModel(model, pose)
      const batteryFocus = 1 - Math.min(1, Math.max(0, (pose.bodyFade - .08) / .92))
      const fit = fitTeslaCamera(camera, model, aspect, batteryFocus)
      const label = `aspect ${aspect}, progress ${progress}`
      assert.ok(fit.viewHeight > 0 && Number.isFinite(fit.viewHeight), label)
      assert.ok(Math.max(...Object.values(fit.bounds).map(Math.abs)) <= .92000001, label)
      // Independently project actual local mesh/instance bounds through the final
      // camera rather than trusting the fitting function's diagnostic result.
      for (const { object, box } of parts) {
        for (let corner = 0; corner < 8; corner++) {
          point.set(corner & 1 ? box.max.x : box.min.x, corner & 2 ? box.max.y : box.min.y, corner & 4 ? box.max.z : box.min.z).applyMatrix4(object.matrixWorld).project(camera)
          assert.ok(Math.abs(point.x) <= .92000001 && Math.abs(point.y) <= .92000001 && Math.abs(point.z) < 1, label)
        }
      }
      let center = 0
      for (const module of model.modules) center += point.setFromMatrixPosition(module.matrixWorld).project(camera).x
      assert.ok(Math.abs(center / model.modules.length) < 1e-10, `battery centered: ${label}`)
      if (batteryFocus === 1) {
        let centerY = 0
        for (const module of model.modules) centerY += point.setFromMatrixPosition(module.matrixWorld).project(camera).y
        assert.ok(Math.abs(centerY / model.modules.length) < 1e-10, `battery centered vertically: ${label}`)
      }
    }
  }
})

test('battery focus centers modules on both axes while keeping the ghost body and cooling visible', t => {
  const { model, camera, parts } = fixture(t)
  const point = new Vector3()
  for (const aspect of [.8, 1.47, 3.4]) {
    for (const progress of [0, .2, .37, .38, .5, .7, 1]) {
      poseTeslaModel(model, vehicleJourneyPose(progress))
      for (const focus of [0, .25, .5, .75, 1]) {
        const fit = fitTeslaCamera(camera, model, aspect, focus)
        assert.ok(Math.max(...Object.values(fit.bounds).map(Math.abs)) <= .92000001)
        for (const { object, box } of parts) for (let corner = 0; corner < 8; corner++) {
          point.set(corner & 1 ? box.max.x : box.min.x, corner & 2 ? box.max.y : box.min.y, corner & 4 ? box.max.z : box.min.z).applyMatrix4(object.matrixWorld).project(camera)
          assert.ok(Math.abs(point.x) <= .92000001 && Math.abs(point.y) <= .92000001)
        }
        if (focus === 1) {
          const center = new Vector3()
          for (const module of model.modules) center.add(point.setFromMatrixPosition(module.matrixWorld).project(camera))
          center.divideScalar(model.modules.length)
          assert.ok(Math.abs(center.x) < 1e-10 && Math.abs(center.y) < 1e-10)
          assert.ok(Math.abs(fit.moduleCenter.y) < 1e-10)
        }
      }
    }
  }
})

test('reversing scroll restores the same framing, including the formerly clipped body-lift frames', t => {
  const { model, camera } = fixture(t)
  for (const progress of [.37, .38, .7, 1]) {
    poseTeslaModel(model, vehicleJourneyPose(progress))
    const forward = fitTeslaCamera(camera, model, 1.95)
    poseTeslaModel(model, vehicleJourneyPose(0))
    fitTeslaCamera(camera, model, .8)
    poseTeslaModel(model, vehicleJourneyPose(progress))
    assert.deepEqual(fitTeslaCamera(camera, model, 1.95), forward)
  }
})

test('scrolling and stage focus never change the camera scale at the same viewport size', t => {
  const { model, camera } = fixture(t)
  for (const aspect of [.8, 1.07, 1.5, 3.4]) {
    let reference
    for (const progress of [0, .137, .23, .381, .5, .7, .96, 1, .7, .381, 0]) {
      const pose = vehicleJourneyPose(progress)
      poseTeslaModel(model, pose)
      for (const focus of [0, 1 - (pose.bodyFade - .08) / .92, 1]) {
        const fit = fitTeslaCamera(camera, model, aspect, focus)
        reference ??= fit
        assert.equal(fit.viewHeight, reference.viewHeight)
        assert.ok(Math.abs(camera.projectionMatrix.elements[0] - reference.projectionScale.x) < 1e-12)
        assert.ok(Math.abs(camera.projectionMatrix.elements[5] - reference.projectionScale.y) < 1e-12)
      }
      assert.equal(model.currentPose, pose, 'preparing the fixed framing preserves the requested pose')
    }
  }
})
