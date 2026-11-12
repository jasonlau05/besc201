import { createTabMotion, tabProgress } from './tab-motion.mjs'
import { createTabScroll } from './tab-scroll.mjs'

export function createTabNavigation(nav) {
  const links = [...nav.querySelectorAll('a[href]')]
  const indicator = nav.querySelector('.nav-tab-indicator')
  const mobile = matchMedia('(max-width: 720px)')
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  let selected = Math.max(0, links.findIndex(link => link.hasAttribute('aria-current')))
  let navigate = href => window.location.assign(href)
  const motion = createTabMotion(selected)
  let gesture = null
  let frame = 0
  let lastTime = 0
  let ignoreClickUntil = 0
  let bounds
  let step = 0
  let compact = false
  let scrollTarget = document.scrollingElement
  const scroll = createTabScroll(scrollTarget.scrollTop, scrollTarget.scrollHeight - scrollTarget.clientHeight)
  let touch = null
  let chromeAnimations = []

  function draw() {
    const progress = Math.max(0, Math.min(links.length - 1, motion.position))
    indicator.style.transform = `translate3d(${progress * step}px, 0, 0)`
  }

  function measure() {
    bounds = nav.getBoundingClientRect()
    step = (nav.clientWidth - 8) / links.length
    const width = Math.min(64, step)
    indicator.style.width = `${width}px`
    indicator.style.left = `${4 + (step - width) / 2}px`
    draw()
  }

  function finishChromeAnimation() {
    chromeAnimations.forEach(animation => animation.finish())
    chromeAnimations = []
  }

  function setCompact(value) {
    if (compact === value) return
    const before = nav.getBoundingClientRect().width
    finishChromeAnimation()
    compact = value
    nav.toggleAttribute('data-compact', value)
    measure()
    const after = nav.getBoundingClientRect().width
    if (!reduced.matches && before && after && before !== after) {
      const timing = { duration: 320, easing: 'cubic-bezier(.2, .8, .2, 1)' }
      // Animate only transforms; counter-scale icons so they keep their shape.
      chromeAnimations = [nav.animate([{ transform: `scaleX(${before / after})` }, { transform: 'scaleX(1)' }], timing),
        ...links.map(link => link.querySelector('.nav-tab-icon').animate([{ transform: `scaleX(${after / before})` }, { transform: 'scaleX(1)' }], timing))]
    }
  }

  function onScroll(event) {
    if (!mobile.matches || gesture) return
    const target = event.target === document ? document.scrollingElement : event.target
    if (target !== document.scrollingElement && !target?.matches?.('.ev-chat-log')) return
    const maximum = target.scrollHeight - target.clientHeight
    if (target !== scrollTarget) { scrollTarget = target; scroll.reset(target.scrollTop, maximum); return }
    setCompact(scroll.update(target.scrollTop, maximum, performance.now(), compact))
  }

  function touchStart(event) {
    const point = event.touches.length === 1 ? event.touches[0] : null
    touch = mobile.matches && point ? { id: point.identifier, y: point.clientY, travel: 0 } : null
  }

  function touchMove(event) {
    if (!touch || event.touches.length !== 1) { touch = null; return }
    const point = event.touches[0]
    if (point.identifier !== touch.id) return
    const delta = point.clientY - touch.y
    touch.y = point.clientY
    if (delta && Math.sign(delta) !== Math.sign(touch.travel)) touch.travel = 0
    touch.travel += delta
    if (touch.travel > 6) scroll.upwardIntent()
  }

  function touchEnd() { touch = null }

  function wheel(event) {
    if (mobile.matches && !event.ctrlKey && event.deltaY < 0) scroll.upwardIntent()
  }

  function focusIn() {
    if (!gesture) {
      scroll.reset(scrollTarget.scrollTop, scrollTarget.scrollHeight - scrollTarget.clientHeight)
      setCompact(false)
    }
  }

  function animate(time) {
    frame = 0
    motion.advance(lastTime ? Math.min((time - lastTime) / 1000, .064) : 1 / 60)
    draw()
    lastTime = motion.moving ? time : 0
    if (motion.moving) frame = requestAnimationFrame(animate)
  }

  function moveTo(value) {
    if (reduced.matches) { motion.reset(value); draw() }
    else {
      motion.retarget(value)
      if (!frame) frame = requestAnimationFrame(animate)
    }
  }

  const progressAt = x => tabProgress(x, bounds.left, bounds.width, links.length)
  const modified = event => event.metaKey || event.ctrlKey || event.shiftKey || event.altKey

  function release() {
    const pointerId = gesture?.id
    gesture = null
    delete nav.dataset.dragging
    if (pointerId !== undefined && nav.hasPointerCapture(pointerId)) nav.releasePointerCapture(pointerId)
  }

  function cancel() {
    if (!gesture) return
    ignoreClickUntil = performance.now() + 600
    release()
    moveTo(selected)
  }

  function pointerDown(event) {
    if (!mobile.matches || !event.isPrimary || event.button !== 0 || modified(event) || gesture) return
    finishChromeAnimation()
    measure()
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false }
    nav.setPointerCapture(event.pointerId)
    moveTo(Math.round(progressAt(event.clientX)))
  }

  function pointerMove(event) {
    if (!gesture || gesture.id !== event.pointerId) return
    const dx = Math.abs(event.clientX - gesture.x)
    const dy = Math.abs(event.clientY - gesture.y)
    if (!gesture.dragging && dy > 8 && dy > dx) { cancel(); return }
    if (dx > 6) gesture.dragging = true
    if (gesture.dragging) {
      nav.dataset.dragging = ''
      if (event.cancelable) event.preventDefault()
      moveTo(progressAt(event.clientX))
    }
  }

  function pointerUp(event) {
    if (!gesture || gesture.id !== event.pointerId) return
    if (event.clientY < bounds.top - 20 || event.clientY > bounds.bottom + 20) { cancel(); return }
    const index = Math.round(progressAt(event.clientX))
    ignoreClickUntil = performance.now() + 600
    release()
    moveTo(index)
    navigate(links[index].getAttribute('href'))
  }

  function click(event) {
    if (event.detail > 0 && performance.now() < ignoreClickUntil) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    const link = event.target.closest('a[href]')
    if (!link || !nav.contains(link) || event.defaultPrevented || event.button !== 0 || modified(event)) return
    event.preventDefault()
    moveTo(links.indexOf(link))
    navigate(link.getAttribute('href'), { focusContent: event.detail === 0 })
  }

  function keyDown(event) {
    if (event.key === 'Escape' && gesture) { event.preventDefault(); cancel() }
    if (['ArrowUp', 'PageUp', 'Home'].includes(event.key) || (event.key === ' ' && event.shiftKey)) scroll.upwardIntent()
  }
  function preferencesChanged() {
    cancel()
    finishChromeAnimation()
    if (!mobile.matches) setCompact(false)
    if (reduced.matches || !mobile.matches) { motion.reset(selected); draw() }
  }
  function preventNativeDrag(event) { event.preventDefault() }

  const observer = new ResizeObserver(measure)
  observer.observe(nav)
  measure()
  nav.addEventListener('pointerdown', pointerDown)
  nav.addEventListener('pointermove', pointerMove, { passive: false })
  nav.addEventListener('pointerup', pointerUp)
  nav.addEventListener('pointercancel', cancel)
  nav.addEventListener('lostpointercapture', cancel)
  nav.addEventListener('click', click)
  nav.addEventListener('dragstart', preventNativeDrag)
  nav.addEventListener('focusin', focusIn)
  document.addEventListener('scroll', onScroll, { capture: true, passive: true })
  document.addEventListener('touchstart', touchStart, { passive: true })
  document.addEventListener('touchmove', touchMove, { passive: true })
  document.addEventListener('touchend', touchEnd, { passive: true })
  document.addEventListener('touchcancel', touchEnd, { passive: true })
  document.addEventListener('wheel', wheel, { passive: true })
  window.addEventListener('keydown', keyDown)
  window.addEventListener('blur', cancel)
  mobile.addEventListener('change', preferencesChanged)
  reduced.addEventListener('change', preferencesChanged)

  return {
    update(index, onNavigate) {
      navigate = onNavigate
      if (index !== selected) {
        cancel(); selected = index; moveTo(index)
        scrollTarget = document.scrollingElement
        scroll.reset(scrollTarget.scrollTop, scrollTarget.scrollHeight - scrollTarget.clientHeight)
        setCompact(false)
      }
    },
    destroy() {
      release()
      cancelAnimationFrame(frame)
      finishChromeAnimation()
      observer.disconnect()
      nav.removeEventListener('pointerdown', pointerDown)
      nav.removeEventListener('pointermove', pointerMove)
      nav.removeEventListener('pointerup', pointerUp)
      nav.removeEventListener('pointercancel', cancel)
      nav.removeEventListener('lostpointercapture', cancel)
      nav.removeEventListener('click', click)
      nav.removeEventListener('dragstart', preventNativeDrag)
      nav.removeEventListener('focusin', focusIn)
      document.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('touchstart', touchStart)
      document.removeEventListener('touchmove', touchMove)
      document.removeEventListener('touchend', touchEnd)
      document.removeEventListener('touchcancel', touchEnd)
      document.removeEventListener('wheel', wheel)
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('blur', cancel)
      mobile.removeEventListener('change', preferencesChanged)
      reduced.removeEventListener('change', preferencesChanged)
    },
  }
}
