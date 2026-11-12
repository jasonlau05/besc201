const COLLAPSE_DISTANCE = 80
const EXPAND_DISTANCE = 64
const INTENT_GAP = 240
const EDGE_TOLERANCE = 1

// Scroll intent is measured from an extreme, so small reversals cannot toggle the bar.
export function createTabScroll(initialPosition = 0, initialLimit = 0) {
  let anchor, previous, limit, lastTime, bottomLocked

  function reset(position = 0, maximum = 0) {
    limit = Math.max(0, maximum)
    anchor = previous = Math.max(0, Math.min(position, limit))
    lastTime = 0
    bottomLocked = limit > 0 && previous >= limit - EDGE_TOLERANCE
  }

  reset(initialPosition, initialLimit)

  return {
    reset,
    upwardIntent() { bottomLocked = false },
    update(rawPosition, maximum, time, compact) {
      const nextLimit = Math.max(0, maximum)
      const position = Math.max(0, Math.min(rawPosition, nextLimit))
      const lastPosition = previous
      const resized = Math.abs(nextLimit - limit) > EDGE_TOLERANCE
      if (lastTime && time - lastTime > INTENT_GAP) anchor = lastPosition
      previous = position
      limit = nextLimit
      lastTime = time

      if (position <= 8) {
        anchor = position
        bottomLocked = false
        return false
      }

      // Mobile browser chrome and keyboard resizing are not scroll gestures.
      if (resized) {
        anchor = position
        bottomLocked ||= position >= limit - EDGE_TOLERANCE
        return compact
      }

      if (position >= limit - EDGE_TOLERANCE) {
        const next = compact || position - anchor >= COLLAPSE_DISTANCE
        anchor = position
        bottomLocked = true
        return next
      }

      // A rubber-band return must not count as an upward gesture, even in range.
      // Unlock only when touch, wheel, or keyboard input actually points upward.
      if (bottomLocked) {
        anchor = position
        return compact
      }

      anchor = compact ? Math.max(anchor, position) : Math.min(anchor, position)
      if (compact ? anchor - position >= EXPAND_DISTANCE : position - anchor >= COLLAPSE_DISTANCE) {
        anchor = position
        return !compact
      }
      return compact
    },
  }
}
