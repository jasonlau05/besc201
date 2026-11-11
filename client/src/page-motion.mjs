// Own the page entrance, rather than rewriting React's text into word masks.
// Hover, press and state feedback remain in their existing component layers.
export function startPageEntrance() {
  const html = document.documentElement
  const root = document.getElementById('root')
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  if (!root || html.dataset.pagePhase !== 'pending') return

  let cancelled = false
  let frame = 0
  let fontTimeout = 0
  let finishTimeout = 0

  const finish = () => {
    cancelled = true
    cancelAnimationFrame(frame)
    clearTimeout(fontTimeout)
    clearTimeout(finishTimeout)
    delete html.dataset.pagePhase
  }
  const onAnimationEnd = event => {
    if (event.target === root && event.animationName === 'page-phase-in') finish()
  }
  const onMotionChange = () => { if (reducedMotion.matches) finish() }

  root.addEventListener('animationend', onAnimationEnd)
  // Keyboard/pointer users can interact immediately, even while fonts load.
  document.addEventListener('focusin', finish, { once: true })
  document.addEventListener('pointerdown', finish, { once: true })
  window.addEventListener('beforeprint', finish)
  reducedMotion.addEventListener('change', onMotionChange)

  if (reducedMotion.matches) finish()
  else {
    const fontsReady = document.fonts?.ready ?? Promise.resolve()
    const fontBudget = new Promise(resolve => { fontTimeout = setTimeout(resolve, 1000) })
    Promise.race([fontsReady, fontBudget]).then(() => {
      clearTimeout(fontTimeout)
      if (cancelled || html.dataset.pagePhase !== 'pending') return
      frame = requestAnimationFrame(() => {
        html.dataset.pagePhase = 'entering'
        // Safety for interrupted animation events or an unavailable stylesheet.
        finishTimeout = setTimeout(finish, 1000)
      })
    })
  }

  return () => {
    cancelled = true
    cancelAnimationFrame(frame)
    clearTimeout(fontTimeout)
    clearTimeout(finishTimeout)
    root.removeEventListener('animationend', onAnimationEnd)
    document.removeEventListener('focusin', finish)
    document.removeEventListener('pointerdown', finish)
    window.removeEventListener('beforeprint', finish)
    reducedMotion.removeEventListener('change', onMotionChange)
    // Keep the initial hold through React Strict Mode's setup/cleanup cycle.
    if (html.dataset.pagePhase === 'entering') delete html.dataset.pagePhase
  }
}
