import { useEffect, useState } from 'react'
import { ratesClient } from './electricity-rates-client.mjs'

const states = 'AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming'.split('|').map(s => s.split(':'))
const month = period => new Date(`${period}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

export default function ElectricityRates({ efficiency, onUseRate }) {
  const [state, setState] = useState('TX')
  const [resource, setResource] = useState(() => {
    const cached = ratesClient.peek('TX')
    return { state: 'TX', data: cached, loading: !cached, error: '' }
  })
  const [retry, setRetry] = useState(0)
  const [applied, setApplied] = useState(false)
  useEffect(() => {
    let active = true
    const cached = ratesClient.peek(state, true)
    setResource({ state, data: cached, loading: !cached, error: '' })
    // The shared client owns cancellation. Effect cleanup must not cancel a request
    // reused by another subscriber (including React StrictMode's remount).
    ratesClient.load(state, { force: retry > 0 })
      .then(data => { if (active) setResource({ state, data, loading: false, error: '' }) })
      .catch(error => { if (active) setResource({ state, data: null, loading: false, error: error.message }) })
    return () => { active = false }
  }, [state, retry])
  const { data, loading, error } = resource.state === state ? resource : {
    data: ratesClient.peek(state), loading: !ratesClient.peek(state), error: '',
  }
  const maxPrice = data ? Math.max(...data.history.map(row => row.price)) : 1
  return <section className="guide-section" id="location"><div className="guide-section-heading"><span className="section-title">03 / WHERE YOU LIVE</span><h2>Electricity bills across states.</h2><p>Explore residential electricity prices by state with the US Department of Energy.</p></div><div className="guide-split"><div className="guide-panel"><label className="guide-field" htmlFor="rate-state">Your state<select id="rate-state" value={state} onChange={e => { setState(e.target.value); setRetry(0); setApplied(false) }}>{states.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label><p className="guide-note">The U.S. Energy Information Administration reports monthly average residential prices. Rates vary between utilities and plans and even within a state. These are not public charger fees or time of use prices for an address.</p><a href="https://www.eia.gov/opendata/">EIA Open Data ↗</a><p className="guide-note">The reported month can lag today. Check your actual utility bill before estimating charging costs.</p></div><div className="location-result" aria-live="polite" aria-busy={loading}>{loading ? <p>Loading state rates…</p> : error ? <><p role="status">{error}</p><button className="guide-primary" type="button" onClick={() => setRetry(v => v + 1)}>Try again</button></> : data && <>{data.stale && <p role="status">Showing previously loaded rates. Refresh to check for updates. <button type="button" onClick={() => setRetry(v => v + 1)}>Retry</button></p>}<span className="section-title">{month(data.period)} · RESIDENTIAL AVERAGE</span><div className="carbon-big">{data.price.toFixed(2)}<small>¢ per kWh in {states.find(([code]) => code === data.state)?.[1]}</small></div><p>About <strong>${(data.price / 100 * efficiency).toFixed(2)}</strong> per 100 miles at {efficiency} kWh/100 mi.</p><div className="rate-history" aria-label="Available monthly rate history">{[...data.history].reverse().map(row => <div key={row.period} title={`${month(row.period)}: ${row.price.toFixed(2)}¢/kWh`}><i style={{ height: `${row.price / maxPrice * 90}%` }} /><span>{row.period.slice(5)}</span></div>)}</div><details><summary>View monthly prices</summary><table className="rate-table"><thead><tr><th>Month</th><th>¢/kWh</th></tr></thead><tbody>{data.history.map(row => <tr key={row.period}><td>{month(row.period)}</td><td>{row.price.toFixed(2)}</td></tr>)}</tbody></table></details><button className="guide-primary" type="button" onClick={() => { onUseRate(Number(data.price.toFixed(2))); setApplied(true) }}>{applied ? '✓ Added to cost calculator' : 'Use this rate in the calculator'}</button></>}</div></div></section>
}
