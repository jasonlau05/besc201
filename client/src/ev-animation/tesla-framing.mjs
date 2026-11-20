import { Box3, Matrix4, Vector3 } from 'three'
import { poseTeslaModel } from './tesla-model.mjs'
import { vehicleJourneyPose } from './vehicle-journey-motion.mjs'

// A closer view with four percent of the frame clear on every edge. The compact
// exploded spacing keeps every ghost part visible without a large pullback.
const FRAME_LIMIT = .92
const models = new WeakMap()

function framingState(model) {
  let state = models.get(model)
  if (state) return state
  const meshes = []
  model.group.traverse(object => {
    if (!object.isMesh || object === model.shadow) return
    let bounds
    if (object.isInstancedMesh) {
      object.computeBoundingBox()
      bounds = object.boundingBox
    } else {
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox()
      bounds = object.geometry.boundingBox
    }
    if (bounds && !bounds.isEmpty()) meshes.push({ object, bounds: new Box3().copy(bounds) })
  })
  state = { meshes, matrix: new Matrix4(), point: new Vector3() }
  models.set(model, state)
  return state
}

function measure(state, camera, model) {
  const { meshes, matrix, point } = state
  model.group.updateWorldMatrix(true, true)
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity
  for (const { object, bounds } of meshes) {
    matrix.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld)
    for (let corner = 0; corner < 8; corner++) {
      point.set(corner & 1 ? bounds.max.x : bounds.min.x, corner & 2 ? bounds.max.y : bounds.min.y, corner & 4 ? bounds.max.z : bounds.min.z).applyMatrix4(matrix)
      left = Math.min(left, point.x); right = Math.max(right, point.x)
      bottom = Math.min(bottom, point.y); top = Math.max(top, point.y)
    }
  }
  let moduleX = 0, moduleY = 0
  for (const module of model.modules) {
    point.setFromMatrixPosition(module.matrixWorld).applyMatrix4(camera.matrixWorldInverse)
    moduleX += point.x; moduleY += point.y
  }
  const count = Math.max(1, model.modules.length)
  moduleX /= count; moduleY /= count
  return { left, right, bottom, top, moduleX, moduleY }
}

function envelope(state, camera, model) {
  if (state.envelope) return state.envelope
  const original = model.currentPose || vehicleJourneyPose(0)
  let halfWidth = 0, halfHeight = 0
  // Measure the entire sequence once, never refitting zoom to the current pose.
  // Both vertical focus extremes cover every intermediate pan as well.
  for (let frame = 0; frame <= 200; frame++) {
    poseTeslaModel(model, vehicleJourneyPose(frame / 200))
    const bounds = measure(state, camera, model)
    halfWidth = Math.max(halfWidth, Math.abs(bounds.left - bounds.moduleX), Math.abs(bounds.right - bounds.moduleX))
    for (const centerY of [(bounds.bottom + bounds.top) / 2, bounds.moduleY]) {
      halfHeight = Math.max(halfHeight, Math.abs(bounds.top - centerY), Math.abs(bounds.bottom - centerY))
    }
  }
  poseTeslaModel(model, original)
  // Reserve a little extra space between the sampled rotation angles.
  state.envelope = { halfWidth: halfWidth * 1.01, halfHeight: halfHeight * 1.01 }
  return state.envelope
}

/** Use one orthographic scale for the entire sequence at a given viewport size.
 * Panning may follow the battery; rotation and disassembly never change zoom.
 */
export function fitTeslaCamera(camera, model, aspect, batteryFocus = 0) {
  const state = framingState(model)
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  camera.position.set(6.1, 3.35, 6.8)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)
  const fullSequence = envelope(state, camera, model)
  const { left, right, bottom, top, moduleX, moduleY } = measure(state, camera, model)
  const focus = Number.isFinite(batteryFocus) ? Math.min(1, Math.max(0, batteryFocus)) : 0
  const assemblyY = (bottom + top) / 2
  const centerY = assemblyY + (moduleY - assemblyY) * focus
  const halfHeight = Math.max(fullSequence.halfHeight, fullSequence.halfWidth / safeAspect, .01) / FRAME_LIMIT
  const halfWidth = halfHeight * safeAspect
  camera.left = moduleX - halfWidth; camera.right = moduleX + halfWidth
  camera.top = centerY + halfHeight; camera.bottom = centerY - halfHeight
  camera.updateProjectionMatrix()

  return {
    bounds: { left: (left - moduleX) / halfWidth, right: (right - moduleX) / halfWidth, top: (top - centerY) / halfHeight, bottom: (bottom - centerY) / halfHeight },
    moduleCenter: { x: 0, y: (moduleY - centerY) / halfHeight },
    viewHeight: halfHeight * 2,
    projectionScale: { x: camera.projectionMatrix.elements[0], y: camera.projectionMatrix.elements[5] },
  }
}
