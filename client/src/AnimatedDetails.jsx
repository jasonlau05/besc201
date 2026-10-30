import { Children, useEffect, useRef } from 'react'
import './AnimatedDetails.css'

export default function AnimatedDetails({ children, className = '' }) {
  const detailsRef = useRef(null)
  const animationRef = useRef(null)
  const expandedRef = useRef(false)
  const [summary, ...content] = Children.toArray(children)

  useEffect(() => () => animationRef.current?.cancel(), [])

  function handleClick(event) {
    const details = detailsRef.current
    const summary = event.target.closest('summary')
    if (!summary || summary.parentElement !== details) return
    event.preventDefault()

    const expanded = animationRef.current ? !expandedRef.current : !details.open
    expandedRef.current = expanded
    // Capture the visible height before cancelling so rapid clicks reverse smoothly.
    const startHeight = details.getBoundingClientRect().height
    animationRef.current?.cancel()
    animationRef.current = null
    details.style.overflow = ''

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !details.animate) {
      details.open = expanded
      return
    }

    details.open = expanded
    const endHeight = details.getBoundingClientRect().height
    // Keep native content visible until the closing animation finishes.
    details.open = true
    details.style.overflow = 'hidden'
    const animation = details.animate(
      [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
      { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' },
    )
    animationRef.current = animation
    animation.onfinish = () => {
      details.open = expanded
      details.style.overflow = ''
      animation.cancel()
      animationRef.current = null
    }
  }

  return <details ref={detailsRef} className={`animated-details ${className}`} onClick={handleClick}>
    {summary}
    <div className="animated-details-content">{content}</div>
  </details>
}
