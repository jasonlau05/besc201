import { useEffect, useRef } from 'react'
import { createRoadBounce, getRoadCarPose } from './road-scroll-motion.mjs'
import './RoadScrollbar.css'

export default function RoadScrollbar() {
  const roadRef = useRef(null)
  const carRef = useRef(null)
  const dragOffset = useRef(null)
  const bounce = useRef(null)

  useEffect(() => {
    const root = document.documentElement
    const road = roadRef.current
    const car = carRef.current
    const desktop = window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const motion = createRoadBounce()
    let frame = 0
    let lastTime = 0
    let edge = 0

    function scheduleUpdate() {
      if (!frame) frame = window.requestAnimationFrame(update)
    }

    bounce.current = {
      pull(amount) {
        if (!desktop.matches || reducedMotion.matches) return
        edge = Math.sign(amount)
        if (amount) motion.pull(amount)
        else motion.reset()
        scheduleUpdate()
      },
      release() {
        motion.release()
        scheduleUpdate()
      },
    }

    function update(time) {
      frame = 0
      const page = document.scrollingElement
      const distance = page.scrollHeight - page.clientHeight
      const enabled = desktop.matches && distance > 1
      root.classList.toggle('has-road-scroll', enabled)
      if (!enabled) {
        motion.reset()
        lastTime = 0
        return
      }

      const progress = Math.max(0, Math.min(1, page.scrollTop / distance))
      if (reducedMotion.matches || (edge < 0 && page.scrollTop > 1) || (edge > 0 && page.scrollTop < distance - 1)) motion.reset()
      motion.advance(lastTime ? (time - lastTime) / 1000 : 1 / 60)
      const pose = getRoadCarPose({
        progress,
        offset: motion.offset,
        edge,
        roadHeight: road.clientHeight,
        carHeight: car.offsetHeight,
        carTop: car.offsetTop,
      })
      car.style.transform = `translate3d(${pose.x}px, ${pose.y}px, 0) rotate(${pose.rotation}deg)`
      road.setAttribute('aria-valuenow', String(Math.round(progress * 100)))
      road.setAttribute('aria-valuetext', `${Math.round(progress * 100)}% down the page`)
      lastTime = motion.moving ? time : 0
      if (motion.moving) scheduleUpdate()
    }

    function handleWheel(event) {
      if (event.defaultPrevented || event.ctrlKey || !desktop.matches || reducedMotion.matches || dragOffset.current !== null) return
      const page = document.scrollingElement
      const distance = page.scrollHeight - page.clientHeight
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? page.clientHeight : 1)
      if (distance <= 1 || !delta) return
      // A scrollable panel (such as the chat) owns its own end-of-scroll feedback.
      for (const element of event.composedPath()) {
        if (element === document.body || element === page) break
        if (element instanceof HTMLElement && element.scrollHeight > element.clientHeight + 1 && /auto|scroll/.test(window.getComputedStyle(element).overflowY)) return
      }
      if ((delta < 0 && page.scrollTop <= 1) || (delta > 0 && page.scrollTop >= distance - 1)) {
        const nextEdge = Math.sign(delta)
        if (edge !== nextEdge) motion.reset()
        edge = nextEdge
        motion.push(delta)
        scheduleUpdate()
      }
    }

    const observer = new ResizeObserver(scheduleUpdate)
    observer.observe(document.body)
    observer.observe(road)
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('wheel', handleWheel, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    desktop.addEventListener('change', scheduleUpdate)
    reducedMotion.addEventListener('change', scheduleUpdate)
    update(performance.now())

    return () => {
      window.cancelAnimationFrame(frame)
      bounce.current = null
      observer.disconnect()
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('resize', scheduleUpdate)
      desktop.removeEventListener('change', scheduleUpdate)
      reducedMotion.removeEventListener('change', scheduleUpdate)
      root.classList.remove('has-road-scroll')
    }
  }, [])

  function driveTo(clientY, offset) {
    const road = roadRef.current
    const page = document.scrollingElement
    const car = carRef.current
    const travel = road.clientHeight - car.offsetHeight - car.offsetTop * 2
    if (travel <= 0) return
    const position = clientY - road.getBoundingClientRect().top - car.offsetTop - offset
    const progress = Math.max(0, Math.min(1, position / travel))
    window.scrollTo({ top: progress * (page.scrollHeight - page.clientHeight), behavior: 'instant' })
    bounce.current?.pull(position < 0 ? position : position > travel ? position - travel : 0)
  }

  function startDriving(event) {
    if (!event.isPrimary || event.button !== 0) return
    const car = carRef.current
    dragOffset.current = car.contains(event.target)
      ? event.clientY - car.getBoundingClientRect().top
      : car.offsetHeight / 2
    event.currentTarget.dataset.pointerFocus = 'true'
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.dataset.dragging = 'true'
    driveTo(event.clientY, dragOffset.current)
    event.preventDefault()
  }

  function stopDriving(event) {
    dragOffset.current = null
    bounce.current?.release()
    delete event.currentTarget.dataset.dragging
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function handleKeyDown(event) {
    delete event.currentTarget.dataset.pointerFocus
    const page = document.scrollingElement
    const pageStep = page.clientHeight * 0.85
    const destinations = {
      ArrowDown: page.scrollTop + 60,
      ArrowUp: page.scrollTop - 60,
      PageDown: page.scrollTop + pageStep,
      PageUp: page.scrollTop - pageStep,
      Home: 0,
      End: page.scrollHeight - page.clientHeight,
      ' ': page.scrollTop + (event.shiftKey ? -pageStep : pageStep),
    }
    if (!(event.key in destinations)) return
    event.preventDefault()
    window.scrollTo({ top: destinations[event.key], behavior: 'instant' })
  }

  return <div
    ref={roadRef}
    className="scroll-road"
    role="scrollbar"
    tabIndex={0}
    aria-label="Page scroll position. Drag the car or use arrow keys to scroll."
    aria-controls="root"
    aria-orientation="vertical"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={0}
    onPointerDown={startDriving}
    onPointerMove={event => {
      if (dragOffset.current !== null) driveTo(event.clientY, dragOffset.current)
    }}
    onPointerUp={stopDriving}
    onPointerCancel={stopDriving}
    onLostPointerCapture={stopDriving}
    onBlur={event => { delete event.currentTarget.dataset.pointerFocus }}
    onKeyDown={handleKeyDown}
  >
    <div className="scroll-road-markings" aria-hidden="true">
      <svg className="scroll-road-bend scroll-road-bend-top" viewBox="0 0 40 40" fill="none" focusable="false">
        <path d="M40 4h-4A32 32 0 0 0 4 36v4" />
      </svg>
      <svg className="scroll-road-bend scroll-road-bend-bottom" viewBox="0 0 40 40" fill="none" focusable="false">
        <path d="M40 4h-4A32 32 0 0 0 4 36v4" />
      </svg>
    </div>
    <div ref={carRef} className="scroll-road-car" aria-hidden="true">
      <svg viewBox="0 0 24 48" fill="none" focusable="false">
        <rect x="0" y="30" width="5" height="3" rx="1.5" fill="#c9633f" />
        <rect x="19" y="30" width="5" height="3" rx="1.5" fill="#c9633f" />
        <path d="M8 2h8c4 0 6 4 6 10v23c0 7-4 11-10 11S2 42 2 35V12C2 6 4 2 8 2Z" fill="#c9633f" />
        <path d="M7 26h10l1 8q-6 3-12 0Z" fill="#f8f7f3" />
      </svg>
    </div>
  </div>
}
