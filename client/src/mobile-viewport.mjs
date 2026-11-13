// Safari can keep a stale fixed-position origin after its toolbar or keyboard
// moves. Anchor both pieces of site chrome to the visual viewport, compensating
// for the browser's measured origin instead of assuming fixed top: 0 is zero.
export function trackMobileViewport(header, nav, view = window) {
  const viewport = view.visualViewport
  if (!viewport) return () => {}

  const document = header.ownerDocument
  let frame = 0
  let bouncing = false
  let candidate = null
  const calibrated = { header: 0, nav: 0 }

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
    if (viewport.scale !== 1) { bouncing = false; candidate = null; reset(); return }

    const page = document.scrollingElement
    const maximum = Math.max(0, page.scrollHeight - page.clientHeight)
    // Safari exposes elastic overscroll in scrollY and sometimes offsetTop.
    // Its fixed-element rects move too; feeding those temporary positions back
    // into CSS displaces both bars as the native bounce reverses.
    if (view.scrollY < -1 || view.scrollY > maximum + 1 || viewport.offsetTop < 0) {
      bouncing = true
      candidate = null
      return
    }

    const headerOrigin = header.getBoundingClientRect().top - parseFloat(view.getComputedStyle(header).top)
    const navOrigin = nav.getClientRects().length
      ? nav.getBoundingClientRect().top - parseFloat(view.getComputedStyle(nav).top)
      : null
    if (!Number.isFinite(headerOrigin) || (navOrigin !== null && !Number.isFinite(navOrigin))) return

    if (bouncing) {
      // Follow viewport changes immediately using the last calibrated origins.
      // Adopt new painted origins only after two consistent frames. Ordinary
      // scrolling and toolbar animation cannot postpone this probe.
      const consistent = candidate && Math.abs(headerOrigin - candidate.header) <= .5
        && (navOrigin === null || (candidate.nav !== null && Math.abs(navOrigin - candidate.nav) <= .5))
      if (consistent) { bouncing = false; candidate = null }
      else { candidate = { header: headerOrigin, nav: navOrigin }; schedule() }
    }
    if (!bouncing) {
      calibrated.header = headerOrigin
      if (navOrigin !== null) calibrated.nav = navOrigin
    }

    // Read both positions before writing, and remove the existing CSS offset
    // from each measurement so repeated scroll events cannot accumulate drift.
    setOffset(header, '--site-viewport-top', viewport.offsetTop - calibrated.header)
    if (navOrigin !== null) setOffset(nav, '--site-viewport-bottom', viewport.offsetTop + viewport.height - calibrated.nav)
  }

  function schedule() {
    if (!frame) frame = view.requestAnimationFrame(update)
  }

  const listeners = [
    [viewport, 'resize'], [viewport, 'scroll'], [viewport, 'scrollend'],
    [view, 'resize'], [view, 'scroll'], [view, 'scrollend'], [view, 'pageshow'],
    [document, 'visibilitychange'], [document, 'focusin'], [document, 'focusout'],
    [document, 'touchend'], [document, 'touchcancel'],
  ]
  for (const [target, event] of listeners) target.addEventListener(event, schedule, { passive: true })
  update()

  return () => {
    view.cancelAnimationFrame(frame)
    for (const [target, event] of listeners) target.removeEventListener(event, schedule)
    reset()
  }
}
