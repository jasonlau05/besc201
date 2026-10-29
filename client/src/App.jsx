import { useState } from 'react'
import './App.css'
import Info from './Info'
import Learn from './Learn'
import EvChat from './EvChat'
import { SiteHeader, SiteFooter } from './SiteLayout'
import RoadScrollbar from './RoadScrollbar'

export default function App() {
  const [chatOpen, setChatOpen] = useState(false)
  const path = window.location.pathname.replace(/\/$/, '')
  let page
  if (path === '/info') page = <Info />
  else if (path === '/learn') page = <Learn onAsk={() => setChatOpen(true)} />
  else page = <main className="app-shell problem-page">
    <SiteHeader page="problem" />
    <section className="problem-content" aria-labelledby="problem-title">
      <h1 id="problem-title">Problem statement</h1>
      <p>Drivers considering electric vehicles must weigh manufacturing emissions, vehicle efficiency, gasoline prices, and electricity costs.</p>
      <p>But these factors can be difficult to compare.</p>
      <a className="problem-link" href="/learn">Learn about EVs <span aria-hidden="true">→</span></a>
    </section>
    <SiteFooter />
  </main>
  return <>{page}<EvChat open={chatOpen} onOpenChange={setChatOpen} /><RoadScrollbar /></>
}
