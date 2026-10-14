import { useState } from 'react'
import { CARBON_BASELINE, carbonModel, gasEmissionsPerMile } from './carbon-model.mjs'

function Control({ id, title, value, onChange, min, max, step = 1, unit }) {
  return <div className="guide-control"><label htmlFor={id}>{title}<output htmlFor={id}>{value} {unit}</output></label><input id={id} type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} /></div>
}

export default function CarbonSimulator({ annualMiles, efficiency, setEfficiency, mpg, setMpg }) {
  const [evProduction, setEvProduction] = useState(12)
  const gasIntensity = gasEmissionsPerMile(mpg)
  const model = carbonModel({ ...CARBON_BASELINE, gasIntensity, evProduction, efficiency, annualMiles })
  const horizon = 150000
  const maxY = Math.max(model.evAt(horizon), model.gasAt(horizon), 1) * 1.12
  const x = miles => 50 + miles / horizon * 360
  const y = tonnes => 215 - tonnes / maxY * 185
  const crossing = model.breakEvenMiles !== null && model.breakEvenMiles <= horizon
  const result = model.breakEvenMiles === null ? 'No break-even' : model.breakEvenMiles === 0 ? 'Lower from the start' : `${Math.round(model.breakEvenMiles).toLocaleString()} miles`
  return <section className="guide-section" id="fit"><div className="guide-section-heading"><span className="section-title">01 / YOUR CARBON FOOTPRINT</span><h2>When does electric break even?</h2><p>Compare your EV with a gas car. We use average US electricity emissions and fixed annual driving.</p></div><div className="guide-split"><div className="guide-panel">
    <Control id="ev-production" title="EV manufacturing" value={evProduction} onChange={setEvProduction} min={4} max={25} step={0.5} unit="t CO₂e" />
    <Control id="carbon-efficiency" title="EV energy use" value={efficiency} onChange={setEfficiency} min={20} max={50} unit="kWh/100 mi" />
    <Control id="carbon-mpg" title="Gas car efficiency" value={mpg} onChange={setMpg} min={15} max={60} unit="mpg" />
    <p className="guide-note">Annual driving is fixed at <strong>{annualMiles.toLocaleString()} miles</strong>. EV energy use and gas MPG also update the cost calculator.</p>
    <details className="carbon-assumptions"><summary>Our fixed comparison & sources</summary>
      <p>Gas driving: <strong>{gasIntensity.toFixed(1)} g CO₂/mile</strong> at {mpg} mpg. Calculated as 8,887 g CO₂ per gallon ÷ MPG, using <a href="https://www.epa.gov/greenvehicles/comparison-your-car-vs-electric-vehicle">EPA’s gasoline emissions factor</a>.</p>
      <p>Electricity: <strong>367 g CO₂/kWh</strong> — <a href="https://www.eia.gov/tools/faqs/faq.php?id=74&t=11">EIA’s 2023 US utility-scale average</a> of 0.81 lb/kWh, converted to grams. This is a dated national average, not your local grid.</p>
      <p>Gas manufacturing: <strong>8 t CO₂e</strong> — <a href="https://theicct.org/why-evs-are-already-much-greener-than-combustion-engine-vehicles-jul25/">ICCT’s 2024 gasoline SUV benchmark</a>, used as a representative example rather than an all-car average.</p>
      <p>This simplified estimate combines manufacturing CO₂e with driving CO₂. It excludes upstream fuel emissions, grid delivery losses, battery replacements, and end-of-life impacts. It compares two new cars, not replacing an existing car.</p>
    </details>
  </div><div className="carbon-result"><span className="section-title">ESTIMATED CARBON BREAK-EVEN</span><div className="carbon-big" aria-live="polite">{result}<small>{model.years === null ? 'The EV starts with a larger footprint and does not emit less per mile. It never catches up under these assumptions.' : model.years === 0 ? 'EV production starts at or below the gas car.' : `About ${model.years.toFixed(1)} years at your annual mileage`}</small></div>
    <svg className="carbon-chart" viewBox="0 0 450 255" role="img" aria-label={`Estimated cumulative carbon footprint through 150,000 miles. ${result}. EV driving emissions: ${model.evPerMile.toFixed(0)} grams CO2 per mile.`}>
      {[0, 0.5, 1].map(f => <g key={f}><line x1="50" x2="410" y1={y(maxY * f)} y2={y(maxY * f)} stroke="#cddcc8" /><text x="42" y={y(maxY * f) + 4} textAnchor="end">{Math.round(maxY * f)} t</text></g>)}
      <path d={`M 50 ${y(model.gasAt(0))} L 410 ${y(model.gasAt(horizon))}`} fill="none" stroke="#c9633f" strokeWidth="3" />
      <path d={`M 50 ${y(model.evAt(0))} L 410 ${y(model.evAt(horizon))}`} fill="none" stroke="#276554" strokeWidth="3" />
      {crossing && <g><line x1={x(model.breakEvenMiles)} x2={x(model.breakEvenMiles)} y1={y(model.evAt(model.breakEvenMiles))} y2="215" stroke="#587961" strokeDasharray="4 4" /><circle cx={x(model.breakEvenMiles)} cy={y(model.evAt(model.breakEvenMiles))} r="5" fill="#276554" /></g>}
      {[0, 75000, 150000].map(mi => <text key={mi} x={x(mi)} y="236" textAnchor="middle">{mi / 1000}k mi</text>)}
    </svg><div className="carbon-legend"><span>━ Electric</span><span>━ Gasoline</span></div><p className="guide-note">Estimated footprint in tonnes: manufacturing + driving. {model.breakEvenMiles === null ? 'The lines never meet under these assumptions.' : model.breakEvenMiles > horizon ? 'Break-even occurs beyond the 150,000-mile chart.' : 'The dot marks where the two lines meet.'} {model.breakEvenMiles === 0 && model.evPerMile > gasIntensity ? 'The EV starts lower, but its higher driving emissions eventually reverse that advantage.' : ''} This is a simplified comparison, not a full lifecycle assessment.</p>
  </div></div></section>
}
