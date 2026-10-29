export const MAX_ROAD_BOUNCE = 18

export function getRoadCarPose({ progress, offset, edge, roadHeight, carHeight, carTop }) {
  const travel = Math.max(0, roadHeight - carHeight - carTop * 2)
  const y = progress * travel
  if (offset * edge <= 0) return { x: 0, y: y + offset, rotation: 0 }

  // Follow the centerline of M40 4h-4A32 32 0 0 0 4 36v4.
  const radius = 32
  const tail = 4
  const approach = Math.max(0, carTop + carHeight / 2 - (32 - tail))
  const arcLength = Math.PI * radius / 2
  const distance = Math.min(1, Math.abs(offset) / MAX_ROAD_BOUNCE) * (approach + arcLength + tail)
  if (distance <= approach) return { x: 0, y: y + edge * distance, rotation: 0 }

  const alongCurve = distance - approach
  const angle = Math.min(Math.PI / 2, alongCurve / radius)
  return {
    x: radius * (1 - Math.cos(angle)) + Math.max(0, alongCurve - arcLength),
    y: y + edge * (approach + radius * Math.sin(angle)),
    rotation: -edge * angle * 180 / Math.PI,
  }
}

export function createRoadBounce() {
  const stiffness = 240
  const damping = 22
  const frequency = Math.sqrt(stiffness - damping ** 2 / 4)
  let offset = 0
  let velocity = 0
  let target = 0
  let held = false

  return {
    get offset() { return offset },
    get moving() { return Math.abs(offset - target) > 0.01 || Math.abs(velocity) > 0.1 },

    push(delta) {
      held = false
      target = 0
      // Add momentum without jumping the car or restarting its return.
      velocity = Math.max(-720, Math.min(720, velocity + delta * 8))
    },

    pull(distance) {
      held = true
      target = MAX_ROAD_BOUNCE * Math.tanh(distance / 65)
    },

    release() {
      held = false
      target = 0
    },

    reset() {
      offset = 0
      velocity = 0
      target = 0
      held = false
    },

    advance(seconds) {
      // Solve the spring over elapsed time so it feels the same at any refresh rate.
      const time = Math.max(0, seconds)
      const decay = Math.exp(-damping * time / 2)
      const cosine = Math.cos(frequency * time)
      const sine = Math.sin(frequency * time)
      const distance = offset - target
      const next = target + decay * (distance * cosine + (velocity + damping * distance / 2) * sine / frequency)
      velocity = decay * (velocity * cosine - (damping * velocity / 2 + stiffness * distance) * sine / frequency)
      offset = Math.max(-MAX_ROAD_BOUNCE, Math.min(MAX_ROAD_BOUNCE, next))
      if (next !== offset) velocity = 0
      // Keep a held drag on its side of the end stop.
      if (held && target && offset * target < 0) offset = 0
      if (!this.moving) {
        offset = target
        velocity = 0
      }
    },
  }
}
