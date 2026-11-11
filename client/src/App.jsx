import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import './App.css'
import './PageMotion.css'
import { startPageEntrance } from './page-motion.mjs'
import Info from './Info'
import Learn from './Learn'
import EvChat from './EvChat'
import Problem from './Problem'
import RoadScrollbar from './RoadScrollbar'
import Chargers from './Chargers'
import { SiteHeader } from './SiteLayout'

const pages = {
  '/': { name: 'problem', heading: 'problem-title', title: 'Group9 — Electric vehicle comparison guide' },
  '/learn': { name: 'learn', heading: 'learn-title', title: 'Learn about electric vehicles — Group9' },
  '/info': { name: 'info', heading: 'guide-title', title: 'Compare electric vehicles — Group9' },
  '/chargers': { name: 'chargers', heading: 'charger-title', title: 'Chargers near me — Group9' },
}
const readPath = () => window.location.pathname.replace(/\/$/, '') || '/'

export default function App() {
  const [chatOpen, setChatOpen] = useState(false)
  const [path, setPath] = useState(readPath)
  const routeRef = useRef(path)
  const scrollPositions = useRef(new Map())
  const pendingScroll = useRef(null)
  const focusContent = useRef(false)
  const current = pages[path] || pages['/']
  useLayoutEffect(() => startPageEntrance(), [])

  const navigate = useCallback((href, options = {}) => {
    const url = new URL(href, window.location.href)
    const next = url.pathname.replace(/\/$/, '') || '/'
    if (url.origin !== window.location.origin || !pages[next]) { window.location.assign(url.href); return }
    if (next === readPath()) return
    scrollPositions.current.set(readPath(), window.scrollY)
    pendingScroll.current = 0
    focusContent.current = Boolean(options.focusContent)
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
  useEffect(() => { document.title = current.title }, [current.title])

  useEffect(() => {
    const motion = document.createElement('script')
    motion.type = 'module'
    motion.src = '/taste/motion/motion.js'
    document.head.append(motion)
    return () => motion.remove()
  }, [])

  let page
  if (path === '/info') page = <Info />
  else if (path === '/learn') page = <Learn onAsk={() => setChatOpen(true)} />
  else if (path === '/chargers') page = <Chargers />
  else page = <Problem />
  return <>
    <a className="site-skip" href={`#${current.heading}`}>Skip to content</a>
    <SiteHeader page={current.name} onNavigate={navigate} />
    {page}
    <span className="site-route-status" role="status">{current.title}</span>
    <EvChat open={chatOpen} onOpenChange={setChatOpen} />
    <RoadScrollbar />
  </>
}
