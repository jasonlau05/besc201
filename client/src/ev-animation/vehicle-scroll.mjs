import { paintVehicleJourney, vehicleJourneyPose, vehicleJourneyProgress } from './vehicle-journey-motion.mjs'

// Only the cutaway owns scroll motion. The original site's header, backgrounds,
// navigation and other pages keep their existing behavior.
export function createVehicleMotion(section, { reduced = false } = {}) {
  if (reduced) {
    paintVehicleJourney(section, vehicleJourneyPose(1))
    return
  }

  const sticky = section.querySelector('.ev-journey-sticky')
  let frame = 0
  let disposed = false
  function update() {
    frame = 0
    if (disposed) return
    const bounds = section.getBoundingClientRect()
    const inset = Number.parseFloat(getComputedStyle(sticky).top) || 0
    const viewport = sticky.getBoundingClientRect().height
    const progress = vehicleJourneyProgress(bounds.top - inset, bounds.height, viewport)
    paintVehicleJourney(section, vehicleJourneyPose(progress))
  }
  function schedule() {
    if (!frame && !disposed && !(typeof document !== 'undefined' && document.hidden)) {
      frame = requestAnimationFrame(update)
    }
  }
  const onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.hidden) {
      if (frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
    } else {
      schedule()
    }
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule, { passive: true })
  schedule()
  return () => {
    disposed = true
    if (frame) {
      cancelAnimationFrame(frame)
      frame = 0
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    window.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
  }
}
