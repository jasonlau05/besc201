import AnimatedDetails from './AnimatedDetails'
import { SiteFooter } from './SiteLayout'
import { ArrowIcon } from './GuideUI'
import './Learn.css'

const sources = {
  types: 'https://afdc.energy.gov/vehicles/electric',
  basics: 'https://www.epa.gov/greenvehicles/electric-plug-hybrid-electric-vehicles',
  charging: 'https://www.epa.gov/greenvehicles/plug-electric-vehicle-charging-basics',
  myths: 'https://www.epa.gov/greenvehicles/electric-vehicle-myths',
  benefits: 'https://afdc.energy.gov/fuels/electricity-benefits',
  grid: 'https://www.eia.gov/energyexplained/electricity/delivery-to-consumers.php',
  modernization: 'https://www.energy.gov/oe/grid-modernization-and-smart-grid',
  managedCharging: 'https://www.energy.gov/cmei/femp/managed-ev-charging-federal-fleets',
}

export default function Learn() {
  return <main className="app-shell learn-page reading-page">
    <header className="learn-hero hero page-intro reading-hero">
      <h1 id="learn-title" tabIndex={-1}>Electric vehicles,<br /><em>explained.</em></h1>
      <p>Get to know the battery, the plug, and the bigger picture.<br className="desktop-break" /> A little understanding goes a long way.</p>
      <div className="learn-hero-actions">
        <a className="problem-link" href="#basics">Start with the basics <ArrowIcon direction="down" /></a>
      </div>
    </header>

    <section className="learn-intro" id="basics" aria-labelledby="learn-basics-title">
      <div>
        <h2 id="learn-basics-title">The fundamentals</h2>
        <p>A battery electric vehicle stores electricity in a rechargeable battery and uses an electric motor to turn the wheels. Plug it in to recharge instead of filling a gas tank.</p>
        <p>When you slow down, regenerative braking can recover some energy and send it back to the battery.</p>
      </div>
      <div className="learn-energy" aria-label="Electricity is stored in the battery, then powers the motor and wheels. Braking recovers some energy.">
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

    <section className="learn-section" id="vehicle-types" aria-labelledby="learn-types-title">
      <div className="learn-section-heading"><h2 id="learn-types-title">Types of electric</h2><p>“Electric” can mean a few things. Here’s how to tell them apart.</p></div>
      <div className="learn-comparison">
        <article className="learn-type"><div><span className="learn-tag">BEV</span><h3>All electric</h3></div><p>Runs entirely on a battery and electric motor. Recharges from a plug and has no gasoline engine.</p><div className="learn-type-note">Plug in<br />No tailpipe emissions</div></article>
        <article className="learn-type"><div><span className="learn-tag">PHEV</span><h3>Plug-in hybrid</h3></div><p>Combines a rechargeable battery with a gasoline engine. Can drive on electricity, with gas available for longer trips.</p><div className="learn-type-note">Plug in<br />Gas backup</div></article>
        <article className="learn-type"><div><span className="learn-tag">HEV</span><h3>Conventional hybrid</h3></div><p>Uses gasoline with help from an electric motor. The engine and braking recharge its battery; you don’t plug it in.</p><div className="learn-type-note">Fill up<br />No charging plug</div></article>
      </div>
    </section>

    <section className="learn-section" id="charging" aria-labelledby="learn-charging-title">
      <div className="learn-section-heading"><h2 id="learn-charging-title">Types of charging</h2><p>At home, at work, or on the road. The right option depends on where you park and how far you drive.</p></div>
      <div className="learn-card-grid learn-charging-grid">
        <article className="learn-card"><h3>Level 1</h3><strong className="learn-charge-label">A standard 120 V outlet</strong><p>The slowest option. Can suit short daily drives when you have plenty of time to recharge.</p></article>
        <article className="learn-card"><h3>Level 2</h3><strong className="learn-charge-label">Dedicated 240 V equipment</strong><p>Faster charging for home, work, or public parking. Often used to recharge overnight.</p></article>
        <article className="learn-card"><h3>DC fast charging</h3><strong className="learn-charge-label">A quicker stop on the road</strong><p>Useful on longer trips. Check your vehicle’s charging capability and connector compatibility.</p></article>
      </div>
    </section>

    <section className="learn-section learn-grid" id="electrical-grid" aria-labelledby="learn-grid-title">
      <div className="learn-section-heading">
        <h2 id="learn-grid-title">Behind the plug</h2>
        <p>The grid connects electricity producers to homes, businesses, and chargers. Operators balance supply and demand continuously to keep the system stable.</p>
      </div>
      <ol className="learn-grid-flow" aria-label="How electricity reaches your car">
        <li><strong>Generation</strong><p>Power plants, wind, and solar produce electricity.</p><ArrowIcon /></li>
        <li><strong>Transmission</strong><p>High-voltage lines carry it over long distances.</p><ArrowIcon /></li>
        <li><strong>Distribution</strong><p>Transformers lower voltage; local lines serve your neighborhood.</p><ArrowIcon /></li>
        <li><strong>Charging</strong><p>Your vehicle draws electricity to recharge its battery.</p></li>
      </ol>
      <div className="learn-card-grid">
        <article className="learn-card"><h3>Demand at the same time</h3><p>EV charging adds demand. Many cars charging together can strain local transformers and lines, especially when buildings also need power. Having enough electricity overall doesn’t guarantee enough capacity on every street.</p></article>
        <article className="learn-card"><h3>Aging equipment and outages</h3><p>Older lines and equipment need replacement. Storms can interrupt service, including charging. Stronger infrastructure, sensors, and controls can help utilities detect problems and restore power faster.</p></article>
        <article className="learn-card"><h3>Connecting cleaner power</h3><p>New wind and solar projects may need transmission lines to reach customers. Approving routes and deciding who pays can slow construction. Storage and a more flexible grid help make better use of available electricity.</p></article>
      </div>
      <div className="learn-grid-response">
        <h3>Better infrastructure. More flexible charging.</h3>
        <p>Utilities can upgrade equipment and coordinate charging with available capacity. Managed charging shifts when cars charge or adjusts their charging power, while allowing time for the next trip. It can reduce peaks and the need for some upgrades.</p>
        <p>At home, check your utility’s off-peak hours or managed-charging program and use your car’s charging schedule when it fits your needs. Off-peak pricing and cleaner electricity don’t always line up; the best time varies by location.</p>
      </div>
    </section>

    <section className="learn-impact" aria-labelledby="learn-impact-title">
      <div><h2 id="learn-impact-title">No tailpipe.<br />Still a footprint.</h2></div>
      <div className="learn-impact-copy"><p>Making an EV, especially its battery, creates emissions. Generating its electricity can create emissions too.</p><p>Over their lifetime, EVs typically produce fewer greenhouse gas emissions than comparable gas cars. The result depends on battery size, vehicle efficiency, electricity sources, and miles driven.</p><a href="/info#fit">Explore the carbon break-even simulator <span aria-hidden="true">→</span></a></div>
    </section>

    <section className="learn-section learn-faq" id="questions" aria-labelledby="learn-faq-title">
      <div className="learn-section-heading"><h2 id="learn-faq-title">A few things you might be wondering.</h2></div>
      <div className="learn-faq-list">
      <AnimatedDetails><summary>What affects an EV’s range?</summary><p>Speed, temperature, cabin heating or cooling, and driving conditions all affect how far you can go. Treat rated range as a comparison point and plan a buffer for your actual trip.</p></AnimatedDetails>
      <AnimatedDetails><summary>Will an EV always cost less to drive?</summary><p>Energy costs depend on electricity and gas prices and vehicle efficiency. Public fast charging can cost more than charging at home. Purchase price, insurance, repairs, and charger installation also affect total ownership cost.</p></AnimatedDetails>
      <AnimatedDetails><summary>Do I need a charger at home?</summary><p>Home charging is convenient, but workplace or public charging may work for your routine. Check nearby locations, availability, compatibility, and pricing before relying on them.</p></AnimatedDetails>
      <AnimatedDetails><summary>What should I know about the battery?</summary><p>Batteries age over time, and climate and charging habits matter. Several manufacturers offer an eight-year or 100,000-mile battery warranty, but coverage varies. Check the specific vehicle’s terms.</p></AnimatedDetails>
      </div>
    </section>

    <div className="learn-next"><a className="problem-link" href="/info">Explore the EV guide <ArrowIcon /></a></div>
    <AnimatedDetails className="guide-sources">
      <summary>Sources</summary>
      <ol>
        <li><a href={sources.types} target="_blank" rel="noreferrer">US DOE · Electric Vehicles <ArrowIcon direction="external" /></a><span>EV basics, regenerative braking, and vehicle types.</span></li>
        <li><a href={sources.basics} target="_blank" rel="noreferrer">US EPA · Electric &amp; Plug-In Hybrid Electric Vehicles <ArrowIcon direction="external" /></a><span>How electric vehicles work and what affects range.</span></li>
        <li><a href={sources.charging} target="_blank" rel="noreferrer">US EPA · Plug-In Electric Vehicle Charging Basics <ArrowIcon direction="external" /></a><span>Charging levels, home equipment, and public charging options.</span></li>
        <li><a href={sources.grid} target="_blank" rel="noreferrer">EIA · Delivery of Electricity to Consumers <ArrowIcon direction="external" /></a><span>Generation, transmission, and distribution.</span></li>
        <li><a href={sources.modernization} target="_blank" rel="noreferrer">US DOE · Grid Modernization and the Smart Grid <ArrowIcon direction="external" /></a><span>Grid infrastructure, reliability, and modernization.</span></li>
        <li><a href={sources.managedCharging} target="_blank" rel="noreferrer">US DOE · Managed EV Charging for Federal Fleets <ArrowIcon direction="external" /></a><span>Coordinating charging with available capacity and reducing peak demand.</span></li>
        <li><a href={sources.myths} target="_blank" rel="noreferrer">US EPA · Electric Vehicle Myths <ArrowIcon direction="external" /></a><span>Battery production, electricity generation, and lifetime emissions.</span></li>
        <li><a href={sources.benefits} target="_blank" rel="noreferrer">US DOE · Electric Vehicle Benefits and Considerations <ArrowIcon direction="external" /></a><span>Ownership costs, charging access, and battery considerations.</span></li>
      </ol>
    </AnimatedDetails>
    <SiteFooter />
  </main>
}
