import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import './App.css'
import './PageMotion.css'
import { startPageEntrance } from './page-motion.mjs'
import Info from './Info'
import Learn from './Learn'
import EvChat from './EvChat'
import Problem from './Problem'
import RoadScrollbar from './RoadScrollbar'
import Chargers from './Chargers'
import { mobileNavigationQuery } from './tab-navigation.mjs'
import { SiteHeader } from './SiteLayout'
import './HeadingGradient.css'
import { applyPageMetadata, getPage, normalizePath, pages } from './seo.mjs'

const readPath = () => normalizePath(window.location.pathname)
const mobileQuery = typeof window === 'undefined' ? null : window.matchMedia(mobileNavigationQuery)
const subscribeMobile = listener => {
  mobileQuery.addEventListener('change', listener)
  return () => mobileQuery.removeEventListener('change', listener)
}
const readMobile = () => mobileQuery.matches
const readServerMobile = () => false
const subscribeHydration = () => () => {}
const readHydrated = () => true
const readServerHydrated = () => false

export default function App({ initialPath = '/' }) {
  const [chatOpen, setChatOpen] = useState(false)
  const [path, setPath] = useState(() => normalizePath(initialPath))
  const mobile = useSyncExternalStore(subscribeMobile, readMobile, readServerMobile)
  const hydrated = useSyncExternalStore(subscribeHydration, readHydrated, readServerHydrated)
  const routeRef = useRef(path)
  const scrollPositions = useRef(new Map())
  const pendingScroll = useRef(null)
  const focusContent = useRef(false)
  const current = getPage(path)

  const navigate = useCallback((href) => {
    const url = new URL(href, window.location.href)
    const next = normalizePath(url.pathname)
    if (url.origin !== window.location.origin || !pages[next]) { window.location.assign(url.href); return }
    if (next === readPath()) return
    scrollPositions.current.set(readPath(), window.scrollY)
    pendingScroll.current = 0
    focusContent.current = true
    window.history.pushState(null, '', url.pathname)
    setPath(next)
  }, [])

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    const restore = () => {
      scrollPositions.current.set(routeRef.current, window.scrollY)
      const next = readPath()
      pendingScroll.current = scrollPositions.current.get(next) || 0
      focusContent.current = true
      setPath(next)
    }
    window.addEventListener('popstate', restore)
    return () => {
      window.history.scrollRestoration = previousRestoration
      window.removeEventListener('popstate', restore)
    }
  }, [])

  useLayoutEffect(() => {
    routeRef.current = path
    if (pendingScroll.current !== null) {
      window.scrollTo({ top: pendingScroll.current, left: 0, behavior: 'instant' })
      pendingScroll.current = null
    }
    if (focusContent.current) {
      document.getElementById(current.heading)?.focus({ preventScroll: true })
      focusContent.current = false
    }
  }, [path, current.heading])
  useLayoutEffect(() => startPageEntrance(), [path])
  useEffect(() => { applyPageMetadata(path) }, [path])

  useEffect(() => {
    const motion = document.createElement('script')
    motion.type = 'module'
    motion.src = '/taste/motion/motion.js'
    document.head.append(motion)
    return () => motion.remove()
  }, [])

  let page
  if (path === '/info') page = <Info />
  else if (path === '/learn') page = <Learn />
  else if (path === '/chargers') page = <Chargers />
  else if (path === '/chat') page = null
  else if (path === '/') page = <Problem />
  else page = <main className="app-shell reading-page"><header className="reading-hero">
    <h1 id={current.heading} tabIndex={-1}>Page not found</h1>
    <p>Looks like we took a wrong turn. Want to head back to the EV basics or compare a couple of cars?</p>
    <a className="guide-primary" href="/learn">Learn about EVs</a> <a href="/info">Compare vehicles</a>
  </header></main>
  return <>
    <a className="site-skip" href={`#${current.heading}`}>Skip to content</a>
    <SiteHeader page={current.name} onNavigate={navigate} />
    {page}
    <span className="site-route-status" role="status">{current.title}</span>
    {hydrated && <EvChat open={path === '/chat' || (!mobile && chatOpen)} onOpenChange={setChatOpen} fullPage={path === '/chat'} mobile={mobile} />}
    <RoadScrollbar />
  </>
}
