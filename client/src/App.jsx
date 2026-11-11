import { useEffect, useLayoutEffect, useState } from 'react'
import './App.css'
import './PageMotion.css'
import { startPageEntrance } from './page-motion.mjs'
import Info from './Info'
import Learn from './Learn'
import EvChat from './EvChat'
import Problem from './Problem'
import RoadScrollbar from './RoadScrollbar'
import Chargers from './Chargers'

export default function App() {
  const [chatOpen, setChatOpen] = useState(false)
  useLayoutEffect(() => startPageEntrance(), [])

  useEffect(() => {
    const motion = document.createElement('script')
    motion.type = 'module'
    motion.src = '/taste/motion/motion.js'
    document.head.append(motion)
    return () => motion.remove()
  }, [])

  const path = window.location.pathname.replace(/\/$/, '')
  let page
  if (path === '/info') page = <Info />
  else if (path === '/learn') page = <Learn onAsk={() => setChatOpen(true)} />
  else if (path === '/chargers') page = <Chargers />
  else page = <Problem />
  return <>{page}<EvChat open={chatOpen} onOpenChange={setChatOpen} /><RoadScrollbar /></>
}
