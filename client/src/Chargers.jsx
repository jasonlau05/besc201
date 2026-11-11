import { useEffect, useRef, useState } from 'react'
import { SiteHeader, SiteFooter } from './SiteLayout'
import ChargerMap from './ChargerMap'
import { googleMapsDirections, findChargers, findLocations, formatDistance } from './chargers-client.mjs'
import './Chargers.css'

const NO_CHARGERS = []

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
}

function LocationIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></svg>
}

function ChargerIcon() {
  return <svg viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="6" y="5" width="17" height="26" rx="2" /><path d="M4 31h21m-2-19h3a3 3 0 0 1 3 3v8a2 2 0 0 0 4 0V10l-4-4M16 10l-5 7h7l-5 7" /></svg>
}

export default function Chargers() {
  const [address, setAddress] = useState('')
  const [radius, setRadius] = useState(5)
  const [phase, setPhase] = useState('idle')
  const [locations, setLocations] = useState([])
  const [origin, setOrigin] = useState(null)
  const [results, setResults] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const request = useRef(null)
  const addressInput = useRef(null)
  const choicesHeading = useRef(null)
  const busy = ['resolving', 'locating', 'loading'].includes(phase)
  const chargers = results?.chargers || NO_CHARGERS

  useEffect(() => {
    const oldTitle = document.title
    document.title = 'Chargers near me — Group9'
    document.documentElement.dataset.type = 'software'
    return () => { request.current?.abort(); document.title = oldTitle }
  }, [])

  useEffect(() => { if (locations.length) choicesHeading.current?.focus() }, [locations])

  function startRequest() {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setError('')
    setFieldError('')
    setLocations([])
    return controller
  }

  async function searchNear(location, searchRadius, controller) {
    setPhase('loading')
    setOrigin(location)
    setResults(null)
    setSelectedId(null)
    try {
      const data = await findChargers(location, searchRadius, controller.signal)
      if (controller.signal.aborted) return
      setResults(data)
      setPhase('done')
    } catch (failure) {
      if (controller.signal.aborted) return
      setError(failure.message)
      setPhase('error')
    }
  }

  async function submit(event) {
    event.preventDefault()
    if (address.trim().length < 3) {
      setFieldError('Enter a street address or city with at least 3 characters.')
      addressInput.current?.focus()
      return
    }
    const controller = startRequest()
    setPhase('resolving')
    setOrigin(null)
    setResults(null)
    setSelectedId(null)
    try {
      const matches = await findLocations(address.trim(), controller.signal)
      if (controller.signal.aborted) return
      if (!matches.length) {
        setFieldError('No address found. Add a city or ZIP code and try again.')
        setPhase('idle')
        addressInput.current?.focus()
      } else if (matches.length === 1) await searchNear(matches[0], radius, controller)
      else { setLocations(matches); setPhase('choosing') }
    } catch (failure) {
      if (controller.signal.aborted) return
      setError(failure.message)
      setPhase('error')
    }
  }

  function useLocation() {
    const controller = startRequest()
    setResults(null)
    setSelectedId(null)
    setOrigin(null)
    if (!navigator.geolocation) { setError('Location is unavailable in this browser. Enter an address instead.'); setPhase('error'); return }
    setPhase('locating')
    navigator.geolocation.getCurrentPosition(position => {
      if (controller.signal.aborted) return
      setAddress('')
      searchNear({ latitude: position.coords.latitude, longitude: position.coords.longitude, label: 'Your current location' }, radius, controller)
    }, failure => {
      if (controller.signal.aborted) return
      setError(failure.code === 1 ? 'Location access was declined. Enter an address to find chargers.' : 'Could not find your location. Enter an address instead.')
      setPhase('error')
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 })
  }

  function editAddress(value) {
    request.current?.abort()
    setAddress(value)
    setFieldError('')
    setError('')
    setLocations([])
    setPhase('idle')
    setOrigin(null)
    setResults(null)
    setSelectedId(null)
  }

  function selectStation(id) {
    setSelectedId(id)
  }

  const statusText = phase === 'resolving' ? 'Finding your address…'
    : phase === 'locating' ? 'Finding your location…'
      : phase === 'loading' ? `Finding chargers within ${radius} miles…`
        : results ? `${results.total} ${results.total === 1 ? 'charger' : 'chargers'} found within ${radius} miles.${results.total > chargers.length ? ` Showing the nearest ${chargers.length}.` : ''}` : ''

  return <div className="app-shell chargers-page">
    <a className="chargers-skip" href="#charger-title">Skip to content</a>
    <SiteHeader page="chargers" />
    <main id="charger-content" aria-labelledby="charger-title">
      <section className="charger-finder hero" aria-labelledby="charger-title">
        <div className="wrap charger-wrap">
          <header className="charger-intro hero-text">
            <h1 id="charger-title" tabIndex={-1}>EV chargers near me</h1>
            <p className="hero__lead">Find EV charging stations around an address, then get directions to your next stop.</p>
          </header>

          <form className="charger-search" action="/api/charging-locations" method="get" onSubmit={submit} noValidate role="search" aria-label="Find nearby EV chargers" aria-describedby="charger-search-status">
            <div className="charger-address-field">
              <label htmlFor="charger-address">Street address or city</label>
              <div className="charger-address-input"><SearchIcon /><input ref={addressInput} id="charger-address" name="q" type="search" autoComplete="street-address" placeholder="Enter an address or city" value={address} maxLength={200} onChange={event => editAddress(event.target.value)} aria-invalid={fieldError ? true : undefined} aria-describedby={fieldError ? 'charger-address-error charger-privacy' : 'charger-privacy'} /></div>
            </div>
            <div className="charger-radius-field"><label htmlFor="charger-radius">Search within</label><select id="charger-radius" value={radius} disabled={busy} onChange={event => {
              const value = Number(event.target.value)
              setRadius(value)
              if (origin) searchNear(origin, value, startRequest())
            }}><option value="5">5 miles</option><option value="10">10 miles</option><option value="25">25 miles</option></select></div>
            <button className="btn charger-primary" type="submit" disabled={busy}>{busy ? 'Searching…' : 'Find chargers'}<svg className="m-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></button>
            {fieldError && <p id="charger-address-error" className="charger-field-error" role="alert">{fieldError}</p>}
            <p id="charger-search-status" className="charger-search-status" role="status" aria-live="polite">{statusText}</p>
          </form>
          <div className="charger-search-meta"><button className="charger-location-button" type="button" onClick={useLocation} disabled={busy}><LocationIcon />Use my location</button><p id="charger-privacy">Location shared with OpenStreetMap and Google Maps.</p></div>

          <div className="charger-workspace app-frame" aria-busy={busy}>
            <div className="charger-results">
              <div className="charger-results-heading"><h2>{locations.length ? 'Choose an address' : 'Nearby chargers'}</h2>{results && <span className="charger-count">{results.total}</span>}</div>
              {origin && <p className="charger-origin" title={origin.label}>{origin.label}</p>}
              {error && <div className="charger-error" role="alert"><h3>Search unavailable</h3><p>{error}</p>{origin && <button type="button" className="charger-inline-button" onClick={() => searchNear(origin, radius, startRequest())}>Retry search <span aria-hidden="true">→</span></button>}</div>}
              {locations.length > 0 && <div className="charger-address-choices"><p ref={choicesHeading} tabIndex={-1}>Select the location you mean.</p><ul>{locations.map(location => <li key={location.id}><button type="button" onClick={() => searchNear(location, radius, startRequest())}><span>{location.label}</span><span aria-hidden="true">→</span></button></li>)}</ul></div>}
              {busy && <div className="charger-results-empty"><ChargerIcon /><h3>{phase === 'locating' ? 'Locating you' : 'Searching your area'}</h3><p>{phase === 'locating' ? 'Allow location access in your browser to search nearby.' : 'Checking mapped charging stations near your search location.'}</p></div>}
              {!busy && !error && !locations.length && !results && <div className="charger-results-empty"><ChargerIcon /><h3>Find a place to plug in</h3><p>Search an address or use your location. Nearby stations will appear here, closest first.</p><span className="charger-radius-note">Start with a 5-mile search</span></div>}
              {results && !chargers.length && <div className="charger-results-empty"><ChargerIcon /><h3>No mapped chargers nearby</h3><p>Try a larger search radius or a different address. OpenStreetMap coverage varies by area.</p>{radius < 25 && <button type="button" className="charger-inline-button" onClick={() => { const value = radius === 5 ? 10 : 25; setRadius(value); searchNear(origin, value, startRequest()) }}>Search {radius === 5 ? 10 : 25} miles <span aria-hidden="true">→</span></button>}</div>}
              {chargers.length > 0 && <ol className="charger-station-list">{chargers.map((station, index) => <li key={station.id} className={selectedId === station.id ? 'is-selected' : undefined}>
                <button type="button" className="charger-station-select" onClick={() => selectStation(station.id)} aria-pressed={selectedId === station.id}><span className="charger-station-number">{index + 1}</span><span className="charger-station-heading"><span className="charger-station-name">{station.name}</span><span className="charger-station-distance">{formatDistance(station.distanceMiles)} away</span></span><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="m7 4 6 6-6 6" /></svg></button>
                <div className="charger-station-details">
                  <p>{station.address || 'Street address not listed'}</p>
                  {station.network && station.network !== station.name && <p>{station.network}</p>}
                  <div className="charger-station-specs"><span>{station.maxPowerKw ? `Up to ${station.maxPowerKw} kW` : 'Power not listed'}</span><span>{station.connectors.length ? station.connectors.join(' · ') : 'Connector not listed'}</span></div>
                  {station.access && !['yes', 'permissive', 'public'].includes(station.access) && <p className="charger-access">{station.access === 'customers' ? 'Customers only' : station.access === 'destination' ? 'For visitors at this destination' : `Access: ${station.access}`}</p>}
                  {station.openingHours && <p>{station.openingHours === '24/7' ? 'Open 24 hours' : `Hours: ${station.openingHours}`}</p>}
                  <div className="charger-station-links"><a href={googleMapsDirections(station)} target="_blank" rel="noreferrer">Get directions <span aria-hidden="true">↗</span></a><a href={station.osmUrl} target="_blank" rel="noreferrer" aria-label={`View ${station.name} on OpenStreetMap`}>Station details <span aria-hidden="true">↗</span></a></div>
                </div>
              </li>)}</ol>}
            </div>
            <ChargerMap origin={origin} chargers={chargers} radius={radius} selectedId={selectedId} />
          </div>
          <div className="charger-data-note"><p>Distances are straight-line estimates. Check the operator for connector compatibility, access, pricing, and live availability.</p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>
}
