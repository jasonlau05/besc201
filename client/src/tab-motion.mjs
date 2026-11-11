// A critically damped indicator. Retargeting preserves both position and velocity.
export function createTabMotion(initial = 0) {
  let position = initial
  let velocity = 0
  let target = initial
  const frequency = 28

  return {
    get position() { return position },
    get velocity() { return velocity },
    get target() { return target },
    get moving() { return Math.abs(position - target) > .0005 || Math.abs(velocity) > .005 },
    retarget(value) { target = value },
    reset(value) { position = target = value; velocity = 0 },
    advance(seconds) {
      if (!Number.isFinite(seconds) || seconds <= 0) return
      const offset = position - target
      const coefficient = velocity + frequency * offset
      const decay = Math.exp(-frequency * seconds)
      position = target + (offset + coefficient * seconds) * decay
      velocity = (velocity - frequency * coefficient * seconds) * decay
      if (!this.moving) this.reset(target)
    },
  }
}

export function tabProgress(clientX, left, width, count, padding = 4) {
  const step = (width - padding * 2) / count
  return Math.max(0, Math.min(count - 1, (clientX - left - padding) / step - .5))
}
