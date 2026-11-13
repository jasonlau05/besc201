import { SiteFooter } from './SiteLayout'
import './Problem.css'

function Arrow() {
  return <svg className="minimal-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
}

export default function Problem() {
  return <div className="app-shell problem-page minimal-landing">
    <main className="minimal-content" aria-labelledby="problem-title">
      <div className="minimal-copy hero page-intro">
        <h1 id="problem-title" tabIndex={-1}>Problem<br />Statement</h1>
        <p className="minimal-description">Choosing an electric car involves many factors, including weighing manufacturing emissions, vehicle efficiency, and energy costs.<br /><br />This guide helps you understand and compare those tradeoffs.</p>
        <div className="minimal-actions">
          <a className="minimal-primary" href="/learn">Learn about EVs <Arrow /></a>
          <a className="minimal-secondary" href="/info">Compare EVs <Arrow /></a>
        </div>
      </div>
    </main>
    <SiteFooter />
  </div>
}
