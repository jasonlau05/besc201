import AnimatedDetails from './AnimatedDetails'
import { SiteHeader, SiteFooter } from './SiteLayout'
import './Learn.css'

const sources = {
  types: 'https://afdc.energy.gov/vehicles/electric',
  basics: 'https://www.epa.gov/greenvehicles/electric-plug-hybrid-electric-vehicles',
  charging: 'https://www.epa.gov/greenvehicles/plug-electric-vehicle-charging-basics',
  myths: 'https://www.epa.gov/greenvehicles/electric-vehicle-myths',
  benefits: 'https://afdc.energy.gov/fuels/electricity-benefits',
}

export default function Learn({ onAsk }) {
  return <main className="app-shell learn-page">
    <SiteHeader page="learn" />
    <header className="learn-hero">
      <h1>Electric vehicles,<br /><em>explained.</em></h1>
      <p>Get to know the battery, the plug, and the bigger picture.<br className="desktop-break" /> A little understanding goes a long way.</p>
      <div className="learn-hero-actions">
        <a className="problem-link" href="#basics">Start with the basics <span aria-hidden="true">↓</span></a>
      </div>
    </header>

    <section className="learn-intro" id="basics" aria-labelledby="learn-basics-title">
      <div>
        <span className="section-title">01 / THE BASICS</span>
        <h2 id="learn-basics-title">Same destination.<br />A different way to drive.</h2>
        <p>A battery electric vehicle stores electricity in a rechargeable battery and uses an electric motor to turn the wheels. Plug it in to recharge instead of filling a gas tank.</p>
        <p>When you slow down, regenerative braking can recover some energy and send it back to the battery.</p>
        <a className="learn-source" href={sources.types} target="_blank" rel="noreferrer">Explore the basics at the DOE <span aria-hidden="true">↗</span></a>
      </div>
      <div className="learn-energy" aria-label="Electricity is stored in the battery, then powers the motor and wheels. Braking recovers some energy.">
        <span className="section-title">A LITTLE ENERGY, IN MOTION</span>
        <div className="learn-energy-flow" aria-hidden="true">
          <div><svg viewBox="0 0 48 48"><rect x="7" y="14" width="32" height="22" rx="4" /><path d="M39 21h3v8h-3M24 18l-6 9h7l-2 6 8-10h-8l1-5Z" /></svg><strong>Battery</strong><small>Stores energy</small></div>
          <span>→</span>
          <div><svg viewBox="0 0 48 48"><circle cx="24" cy="25" r="13" /><path d="M24 12V7m-5 0h10M11 25H6m31 0h5M24 18l-5 8h7l-2 7 7-10h-7l2-5" /></svg><strong>Motor</strong><small>Creates motion</small></div>
          <span>→</span>
          <div><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="16" /><circle cx="24" cy="24" r="5" /><path d="m24 8 0 11m0 10v11M8 24h11m10 0h11" /></svg><strong>Wheels</strong><small>Take you there</small></div>
        </div>
        <div className="learn-energy-return"><span aria-hidden="true">↶</span> Braking can send some energy back.</div>
      </div>
    </section>

    <section className="learn-section" aria-labelledby="learn-types-title">
      <div className="learn-section-heading"><span className="section-title">02 / KNOW THE DIFFERENCE</span><h2 id="learn-types-title">Three types. Different tradeoffs.</h2><p>“Electric” can mean a few things. Here’s how to tell them apart.</p></div>
      <div className="learn-card-grid">
        <article className="learn-card"><span className="learn-tag">BEV</span><h3>All electric</h3><p>Runs entirely on a battery and electric motor. Recharges from a plug and has no gasoline engine.</p><div className="learn-card-note">Plug in · No tailpipe emissions</div></article>
        <article className="learn-card"><span className="learn-tag">PHEV</span><h3>Plug-in hybrid</h3><p>Combines a rechargeable battery with a gasoline engine. Can drive on electricity, with gas available for longer trips.</p><div className="learn-card-note">Plug in · Gas backup</div></article>
        <article className="learn-card"><span className="learn-tag">HEV</span><h3>Conventional hybrid</h3><p>Uses gasoline with help from an electric motor. The engine and braking recharge its battery; you don’t plug it in.</p><div className="learn-card-note">Fill up · No charging plug</div></article>
      </div>
      <a className="learn-source" href={sources.types} target="_blank" rel="noreferrer">Source: DOE vehicle types <span aria-hidden="true">↗</span></a>
    </section>

    <section className="learn-section" aria-labelledby="learn-charging-title">
      <div className="learn-section-heading"><span className="section-title">03 / PLUGGING IN</span><h2 id="learn-charging-title">Charging fits around your day.</h2><p>At home, at work, or on the road. The right option depends on where you park and how far you drive.</p></div>
      <div className="learn-card-grid learn-charging-grid">
        <article className="learn-card"><span className="learn-charge-number">01</span><h3>Level 1</h3><strong className="learn-charge-label">A standard 120 V outlet</strong><p>The slowest option. Can suit short daily drives when you have plenty of time to recharge.</p></article>
        <article className="learn-card"><span className="learn-charge-number">02</span><h3>Level 2</h3><strong className="learn-charge-label">Dedicated 240 V equipment</strong><p>Faster charging for home, work, or public parking. Often used to recharge overnight.</p></article>
        <article className="learn-card"><span className="learn-charge-number">03</span><h3>DC fast charging</h3><strong className="learn-charge-label">A quicker stop on the road</strong><p>Useful on longer trips. Check your vehicle’s charging capability and connector compatibility.</p></article>
      </div>
      <p className="learn-footnote">Charging time varies with the car, charger, temperature, and battery level. Home equipment should be assessed by a qualified electrician. <a href={sources.charging} target="_blank" rel="noreferrer">EPA charging basics ↗</a></p>
    </section>

    <section className="learn-impact" aria-labelledby="learn-impact-title">
      <div><span className="section-title">04 / THE BIGGER PICTURE</span><h2 id="learn-impact-title">No tailpipe.<br />Still a footprint.</h2><a className="learn-source" href={sources.myths} target="_blank" rel="noreferrer">Read the EPA’s explanation <span aria-hidden="true">↗</span></a></div>
      <div className="learn-impact-copy"><p>Making an EV, especially its battery, creates emissions. Generating its electricity can create emissions too.</p><p>Over their lifetime, EVs typically produce fewer greenhouse gas emissions than comparable gas cars. The result depends on battery size, vehicle efficiency, electricity sources, and miles driven.</p><a href="/info#fit">Explore the carbon break-even simulator <span aria-hidden="true">→</span></a></div>
    </section>

    <section className="learn-section learn-faq" aria-labelledby="learn-faq-title">
      <div className="learn-section-heading"><span className="section-title">05 / GOOD QUESTIONS</span><h2 id="learn-faq-title">A few things you might be wondering.</h2></div>
      <AnimatedDetails><summary>What affects an EV’s range?</summary><p>Speed, temperature, cabin heating or cooling, and driving conditions all affect how far you can go. Treat rated range as a comparison point and plan a buffer for your actual trip. <a href={sources.basics} target="_blank" rel="noreferrer">EPA range guidance ↗</a></p></AnimatedDetails>
      <AnimatedDetails><summary>Will an EV always cost less to drive?</summary><p>Energy costs depend on electricity and gas prices and vehicle efficiency. Public fast charging can cost more than charging at home. Purchase price, insurance, repairs, and charger installation also affect total ownership cost. <a href={sources.benefits} target="_blank" rel="noreferrer">DOE cost considerations ↗</a></p></AnimatedDetails>
      <AnimatedDetails><summary>Do I need a charger at home?</summary><p>Home charging is convenient, but workplace or public charging may work for your routine. Check nearby locations, availability, compatibility, and pricing before relying on them. <a href={sources.charging} target="_blank" rel="noreferrer">EPA charging options ↗</a></p></AnimatedDetails>
      <AnimatedDetails><summary>What should I know about the battery?</summary><p>Batteries age over time, and climate and charging habits matter. Several manufacturers offer an eight-year or 100,000-mile battery warranty, but coverage varies. Check the specific vehicle’s terms. <a href={sources.benefits} target="_blank" rel="noreferrer">DOE battery considerations ↗</a></p></AnimatedDetails>
    </section>

    <section className="learn-next"><div><span className="section-title">FROM LEARNING TO EXPLORING</span><h2>Put the basics into perspective.</h2><p>Try your own numbers in the EV guide, or keep the conversation going.</p></div><div className="learn-next-actions"><a className="problem-link" href="/info">Explore the EV guide <span aria-hidden="true">→</span></a></div></section>
    <SiteFooter />
  </main>
}
