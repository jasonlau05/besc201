import VehicleJourney from './ev-animation/VehicleJourney'
import './Problem.css'

function Arrow() {
  return <svg className="minimal-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
}

export default function Problem() {
  return <>
    <div className="app-shell problem-page minimal-landing">
      <main className="minimal-content" aria-labelledby="problem-title">
        <div className="minimal-copy hero page-intro">
          <h1 id="problem-title" tabIndex={-1}><span className="site-heading-gradient">Our Mission</span></h1>
          <p className="minimal-description">How far do you have to drive an EV before its battery pays off in carbon? And what would those miles cost you in gas?<br /><br />We’re Group 9. We built this guide for BESC 201 so you can try the math with the cars you’d actually drive.</p>
          <div className="minimal-actions">
            <a className="minimal-primary" href="/learn">Learn about EVs <Arrow /></a>
            <a className="minimal-secondary" href="/info">Compare EVs <Arrow /></a>
          </div>
        </div>
      </main>
    </div>
    <VehicleJourney />
  </>
}
