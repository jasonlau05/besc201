import './App.css'
import Info from './Info'
import { SiteHeader, SiteFooter } from './SiteLayout'

export default function App() {
  if (window.location.pathname.replace(/\/$/, '') === '/info') return <Info />
  return <main className="app-shell problem-page">
    <SiteHeader page="problem" />
    <section className="problem-content" aria-labelledby="problem-title">
      <h1 id="problem-title">Problem statement</h1>
      <p>Drivers considering electric vehicles must weigh manufacturing emissions, vehicle efficiency, gasoline prices, and electricity costs.</p>
      <p>But these factors can be difficult to compare.</p>
      <a className="problem-link" href="/info">Explore the EV guide <span aria-hidden="true">→</span></a>
    </section>
    <SiteFooter />
  </main>
}
