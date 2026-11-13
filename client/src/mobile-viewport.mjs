// Safari can keep a stale fixed-position origin after its toolbar or keyboard
// moves. Anchor both pieces of site chrome to the visual viewport, compensating
// for the browser's measured origin instead of assuming fixed top: 0 is zero.
export function trackMobileViewport(header, nav, view = window) {
  const viewport = view.visualViewport
  if (!viewport) return () => {}

  const document = header.ownerDocument
  let frame = 0
  let settleTimer = 0
  let bouncing = false

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
    if (viewport.scale !== 1) { bouncing = false; reset(); return }

    const page = document.scrollingElement
    const maximum = Math.max(0, page.scrollHeight - page.clientHeight)
    // Safari exposes elastic overscroll in scrollY and sometimes offsetTop.
    // Its fixed-element rects move too; feeding those temporary positions back
    // into CSS displaces both bars as the native bounce reverses.
    if (view.scrollY < -1 || view.scrollY > maximum + 1 || viewport.offsetTop < 0) {
      bouncing = true
      return
    }
    if (bouncing) {
      // scrollY can return to its legal range before WebKit's painted origin
      // settles. Keep the last stable anchors until events have been quiet.
      settleTimer = view.setTimeout(() => {
        settleTimer = 0
        bouncing = false
        update()
      }, 120)
      return
    }

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
    view.clearTimeout(settleTimer)
    settleTimer = 0
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
    view.clearTimeout(settleTimer)
    for (const [target, event] of listeners) target.removeEventListener(event, schedule)
    reset()
  }
}
