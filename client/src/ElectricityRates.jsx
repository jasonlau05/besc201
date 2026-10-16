import { useEffect, useState } from 'react'
import { lookupRates, ratesClient } from './electricity-rates-client.mjs'

const states = 'AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming'.split('|').map(s => s.split(':'))
const month = period => new Date(`${period}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

function RatesSkeleton({ showHistory }) {
  return <div className="rate-skeleton" aria-hidden="true">
    <span className="rate-skeleton-block rate-skeleton-heading" />
    <span className="rate-skeleton-block rate-skeleton-date" />
    <div className="rate-skeleton-price-group">
      <span className="rate-skeleton-block rate-skeleton-price" />
      <span className="rate-skeleton-block rate-skeleton-label" />
    </div>
    <span className="rate-skeleton-block rate-skeleton-cost" />
    {showHistory && <div className="rate-skeleton-history">
      {[45, 56, 50, 68, 62, 78, 70, 86, 76, 90, 80, 84].map((height, index) =>
        <span key={index} className="rate-skeleton-block" style={{ height: `${height}%` }} />
      )}
    </div>}
    <span className="rate-skeleton-block rate-skeleton-details" />
    <span className="rate-skeleton-block rate-skeleton-button" />
  </div>
}

export default function ElectricityRates({ efficiency, onUseRate }) {
  const [state, setState] = useState('TX')
  const [resource, setResource] = useState(() => {
    const dataset = ratesClient.peekDataset(true)
    return { dataset, loading: !dataset, error: '' }
  })
  const [retry, setRetry] = useState(0)
  const [applied, setApplied] = useState(null)
  const [revealedKey, setRevealedKey] = useState(null)
  const revealKey = `${state}:${retry}`

  useEffect(() => {
    // This is only a presentation delay; changing states still uses the local dataset.
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const delay = reducedMotion ? 0 : 180 + Math.floor(Math.random() * 241)
    const timer = window.setTimeout(() => setRevealedKey(revealKey), delay)
    return () => window.clearTimeout(timer)
  }, [revealKey])

  useEffect(() => {
    let active = true
    const cached = ratesClient.peekDataset(true)
    setResource({ dataset: cached, loading: !cached, error: '' })
    ratesClient.loadDataset({ force: retry > 0 })
      .then(dataset => { if (active) setResource({ dataset, loading: false, error: '' }) })
      .catch(error => { if (active) setResource({ dataset: null, loading: false, error: error.message }) })
    return () => { active = false }
  }, [retry])
  const { loading, error } = resource
  const data = lookupRates(resource.dataset, state)
  const maxPrice = data ? Math.max(...data.history.map(row => row.price)) : 1
  const showSkeleton = !error && (loading || revealedKey !== revealKey)
  const reload = () => { setRevealedKey(null); setRetry(value => value + 1) }

  return <section className="guide-section" id="location">
    <div className="guide-section-heading">
      <span className="section-title">03 / WHERE YOU LIVE</span>
      <h2>Electricity prices across states.</h2>
      <p>Explore residential electricity prices by state with data from the US Department of Energy.</p>
    </div>
    <div className="guide-split">
      <div className="guide-panel">
        <label className="guide-field" htmlFor="rate-state">Your state
          <select id="rate-state" value={state} onChange={event => {
            setRevealedKey(null)
            setState(event.target.value)
            setApplied(null)
          }}>
            {states.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
        <p className="guide-note">The U.S. Energy Information Administration reports monthly average residential prices. Rates vary between utilities and plans and even within a state. These are not public charger fees or time of use prices for an address.</p>
        <a href="https://www.eia.gov/opendata/">EIA Open Data ↗</a>
        <p className="guide-note">Rates are refreshed daily in a shared dataset. Switching states uses that saved data and makes no EIA request. Check your utility bill for your actual rate.</p>
      </div>
      <div className="location-result" aria-live="polite" aria-busy={showSkeleton}>
        {showSkeleton && <>
          <span className="rate-loading-label">Loading saved state rates…</span>
          <RatesSkeleton showHistory={data?.history.length > 1} />
        </>}
        <div className="rate-content" aria-hidden={showSkeleton || undefined} inert={showSkeleton || undefined}>
          {error ? <>
            <p role="status">{error}</p>
            <button className="guide-primary" type="button" onClick={reload}>Try again</button>
          </> : data && <>
            {data.fallback ? <p className="guide-note">Published reference snapshot. Monthly history will expand after the first successful daily refresh.</p> : data.stale &&
              <p role="status">Showing the last saved dataset; the scheduled refresh may be delayed. <button type="button" onClick={reload}>Reload saved data</button></p>}
            <span className="section-title">{month(data.period)} · RESIDENTIAL AVERAGE</span>
            <p className="guide-note">Last fetched {new Date(data.fetchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</p>
            <div className="carbon-big">{data.price.toFixed(2)}<small>¢ per kWh in {states.find(([code]) => code === data.state)?.[1]}</small></div>
            <p>About <strong>${(data.price / 100 * efficiency).toFixed(2)}</strong> per 100 miles at {efficiency} kWh/100 mi.</p>
            {data.history.length > 1 && <div className="rate-history" aria-label="Available monthly rate history">
              {[...data.history].reverse().map(row => <div key={row.period} title={`${month(row.period)}: ${row.price.toFixed(2)}¢/kWh`}>
                <i style={{ height: `${row.price / maxPrice * 90}%` }} /><span>{row.period.slice(5)}</span>
              </div>)}
            </div>}
            <details>
              <summary>View monthly prices</summary>
              <table className="rate-table">
                <thead><tr><th>Month</th><th>¢/kWh</th></tr></thead>
                <tbody>{data.history.map(row => <tr key={row.period}><td>{month(row.period)}</td><td>{row.price.toFixed(2)}</td></tr>)}</tbody>
              </table>
            </details>
            <button className="guide-primary" type="button" onClick={() => {
              onUseRate(Number(data.price.toFixed(2)))
              setApplied({ state: data.state, price: data.price })
            }}>{applied?.state === data.state && applied?.price === data.price ? '✓ Added to cost calculator' : 'Use this rate in the calculator'}</button>
          </>}
        </div>
      </div>
    </div>
  </section>
}
