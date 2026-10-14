import { useState } from 'react'
import './Info.css'
import CarbonSimulator from './CarbonSimulator'
import ElectricityRates from './ElectricityRates'
import { ANNUAL_MILES } from './carbon-model.mjs'

const sources = {
  epa: 'https://www.epa.gov/greenvehicles/electric-vehicle-myths',
  scheme: 'https://www.electriccarscheme.com/blog/are-electric-cars-really-better-for-the-environment',
  doe: 'https://afdc.energy.gov/fuels/electricity-benefits',
}
const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)

function Slider({ id, label, value, setValue, min, max, step = 1, unit }) {
  return <div className="guide-control"><label htmlFor={id}>{label}<output htmlFor={id}>{value}{unit}</output></label><input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => setValue(Number(e.target.value))} /></div>
}

export default function Info() {
  const annualMiles = ANNUAL_MILES
  const [electricity, setElectricity] = useState(16)
  const [gas, setGas] = useState(3.5)
  const [mpg, setMpg] = useState(30)
  const [efficiency, setEfficiency] = useState(30)
  const evCost = annualMiles * efficiency / 100 * electricity / 100
  const gasCost = annualMiles / mpg * gas
  const savings = gasCost - evCost
  const costMax = Math.max(evCost, gasCost, 1)

  return <main className="app-shell info-page">
    <nav className="topbar" aria-label="Main navigation"><a className="brand" href="/"><span className="brand-mark">ϟ</span>chargewise</a><div className="nav-links"><a href="/">Plan</a><a className="active" href="/info" aria-current="page">EV guide</a></div></nav>
    <header className="guide-hero"><div className="eyebrow"><span className="live-dot" />THE EVERYDAY EV GUIDE</div><h1>A better drive.<br /><em>Is it your kind of drive?</em></h1><p>Less guesswork. More perspective. Explore what going electric<br className="desktop-break" /> could mean for your routine, your wallet, and the planet.</p><a className="guide-primary" href="#fit">Let’s find out <span>↓</span></a></header>
    <div className="guide-facts" aria-label="EV facts"><div><strong>0</strong><p>tailpipe emissions</p><small>Electricity and production still matter. <a href={sources.epa}>[1]</a></small></div><div><strong>87–91<span>%</span></strong><p>energy used for movement</p><small>Battery energy + regenerative braking. <a href={sources.epa}>[1]</a></small></div><div><strong>Your routine</strong><p>is the best starting point</p><small>Range, charging, and price all count. <a href={sources.doe}>[2]</a></small></div></div>

    <CarbonSimulator annualMiles={annualMiles} efficiency={efficiency} setEfficiency={setEfficiency} mpg={mpg} setMpg={setMpg} />

    <section className="guide-section" id="cost"><div className="guide-section-heading"><span className="section-title">02 / YOUR WALLET</span><h2>What does a mile really cost?</h2><p>Try your own prices. Cheap home charging and expensive public charging tell different stories.</p></div><div className="guide-split cost-split"><div className="guide-panel"><p className="guide-note">Annual driving: <strong>{annualMiles.toLocaleString()} miles</strong> (fixed).</p><Slider id="electricity" label="Electricity price" value={electricity} setValue={setElectricity} min={0} max={100} step={0.01} unit=" ¢/kWh" /><Slider id="gas" label="Gas price" value={gas} setValue={setGas} min={2} max={7} step={0.1} unit=" $/gal" /><div className="guide-input-pair"><Slider id="gas-mpg" label="Gas car efficiency" value={mpg} setValue={setMpg} min={15} max={60} unit=" mpg" /><Slider id="ev-efficiency" label="EV energy use" value={efficiency} setValue={setEfficiency} min={20} max={50} unit=" kWh/100 mi" /></div></div><div className="cost-result"><span className="section-title">ILLUSTRATIVE ANNUAL ENERGY COST</span><div className={`cost-big ${savings > 0 ? 'cost-less' : savings < 0 ? 'cost-more' : 'cost-equal'}`} aria-live="polite">{money(Math.abs(savings))}<span>{savings > 0 ? 'less with an EV' : savings < 0 ? 'more with an EV' : 'same energy cost'}</span></div><div className="cost-bar-row"><div><span>Electric</span><strong>{money(evCost)}</strong></div><div className="cost-bar-track"><i style={{ width: `${evCost / costMax * 100}%` }} /></div></div><div className="cost-bar-row gasoline"><div><span>Gasoline</span><strong>{money(gasCost)}</strong></div><div className="cost-bar-track"><i style={{ width: `${gasCost / costMax * 100}%` }} /></div></div><p className="guide-note">Editable example inputs, not local rates. Energy only: excludes purchase price, insurance, maintenance, taxes, incentives, installation, and charger fees. Use electricity consumption including charging losses for your chosen vehicle.</p><details><summary>How we calculate this</summary><p>EV: annual miles × kWh per 100 miles ÷ 100 × price per kWh. Gas car: annual miles ÷ mpg × price per gallon. Compare full ownership costs before buying. <a href={sources.doe}>DOE considerations [2]</a></p></details></div></div></section>

    <ElectricityRates efficiency={efficiency} onUseRate={setElectricity} />

    <section className="guide-section planet-section"><div className="guide-section-heading"><span className="section-title">04 / THE BIGGER PICTURE</span><h2>No exhaust. Still a footprint.</h2><p>The whole lifecycle matters, from making the battery to the electricity you use.</p></div><div className="lifecycle"><article><span>01</span><h3>Build</h3><p>Battery manufacturing can give an EV a larger footprint before its first mile.</p></article><span className="lifecycle-arrow" aria-hidden="true">→</span><article><span>02</span><h3>Drive</h3><p>No tailpipe emissions. Charging emissions depend on how electricity is generated.</p></article><span className="lifecycle-arrow" aria-hidden="true">→</span><article><span>03</span><h3>Look at the lifetime</h3><p>EV lifetime greenhouse gas emissions are typically lower than an average gasoline car, including manufacturing.</p></article></div><p className="guide-note">Source: <a href={sources.epa}>EPA EV myths [1]</a>. These are general findings, not a measured footprint for your vehicle.</p><div className="guide-myths"><details><summary>Does a battery cancel out the climate benefit?</summary><p>EPA’s lifecycle comparison includes battery production and still finds typically lower lifetime emissions for EVs. Vehicle size, lifetime mileage, and electricity generation affect the result. <a href={sources.epa}>Read the evidence [1]</a></p></details><details><summary>What about mining and recycling?</summary><p>Battery materials have environmental and social impacts. Reuse and recycling can recover materials, but they do not erase production impacts. The Electric Car Scheme article offers a UK-focused overview; its numerical estimates should not be treated as a personal US forecast. <a href={sources.scheme}>Read the overview [3]</a></p></details><details><summary>Could a hybrid be a better fit?</summary><p>If reliable charging is hard to arrange, compare a conventional hybrid too. A plug-in hybrid offers electric driving and a gasoline backup, but needs regular charging to realize its electric-driving benefits. <a href={sources.doe}>Compare the tradeoffs [2]</a></p></details></div></section>

    <section className="guide-next"><div><span className="section-title">YOUR NEXT STEP</span><h2>Make it about your life.</h2><p>Compare specific vehicles. Check chargers on your regular routes.<br />Then see what charging at your address could cost.</p></div><a className="guide-primary" href="/">Explore charging times →</a></section>
    <section className="guide-sources"><h2>The reading behind the guide</h2><p>Sources reviewed October 14, 2026. US units and USD are used in the interactive examples.</p><ol><li><a href={sources.epa}>US EPA · Electric Vehicle Myths ↗</a><span>Lifecycle emissions, efficiency, range, and cold weather.</span></li><li><a href={sources.doe}>US DOE · Electric Vehicle Benefits and Considerations ↗</a><span>Charging access, costs, and vehicle tradeoffs.</span></li><li><a href={sources.scheme}>The Electric Car Scheme · Are EVs Better for the Environment? ↗</a><span>Additional reading from a UK EV provider; geographic context differs.</span></li></ol></section><footer>Chargewise</footer>
  </main>
}
