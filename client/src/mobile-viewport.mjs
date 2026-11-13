// Safari can keep a stale fixed-position origin after its toolbar or keyboard
// moves. Anchor both pieces of site chrome to the visual viewport, compensating
// for the browser's measured origin instead of assuming fixed top: 0 is zero.
export function trackMobileViewport(header, nav, view = window) {
  const viewport = view.visualViewport
  if (!viewport) return () => {}

  const document = header.ownerDocument
  let frame = 0

  function reset() {
    header.style.removeProperty('--site-viewport-top')
    nav.style.removeProperty('--site-viewport-bottom')
  }

  function setOffset(element, property, value) {
    if (!Number.isFinite(value)) return
    const offset = `${Math.round(value * 100) / 100}px`
    if (element.style.getPropertyValue(property) !== offset) element.style.setProperty(property, offset)
  }

  function update() {
    frame = 0
    // Let pinch zoom retain the browser's normal layout and panning behavior.
    if (viewport.scale !== 1) { reset(); return }

    const headerOrigin = header.getBoundingClientRect().top - parseFloat(view.getComputedStyle(header).top)
    const navOrigin = nav.getClientRects().length
      ? nav.getBoundingClientRect().top - parseFloat(view.getComputedStyle(nav).top)
      : null

    // Read both positions before writing, and remove the existing CSS offset
    // from each measurement so repeated scroll events cannot accumulate drift.
    setOffset(header, '--site-viewport-top', viewport.offsetTop - headerOrigin)
    if (navOrigin !== null) setOffset(nav, '--site-viewport-bottom', viewport.offsetTop + viewport.height - navOrigin)
  }

  function schedule() {
    if (!frame) frame = view.requestAnimationFrame(update)
  }

  const listeners = [
    [viewport, 'resize'], [viewport, 'scroll'],
    [view, 'resize'], [view, 'scroll'], [view, 'pageshow'],
    [document, 'visibilitychange'], [document, 'focusin'], [document, 'focusout'],
  ]
  for (const [target, event] of listeners) target.addEventListener(event, schedule, { passive: true })
  update()

  return () => {
    view.cancelAnimationFrame(frame)
    for (const [target, event] of listeners) target.removeEventListener(event, schedule)
    reset()
  }
}
