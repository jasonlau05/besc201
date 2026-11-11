import { useState } from 'react'
import { googleMapsView } from './google-maps.mjs'

function MapFrame({ view }) {
  const [failed, setFailed] = useState(false)

  if (failed) return <div className="charger-map-state" role="status">
    <h3>Google Maps is unavailable</h3>
    <p>You can still find chargers in the list and open directions in Google Maps.</p>
    <div className="charger-map-actions"><button type="button" onClick={() => setFailed(false)}>Retry map</button></div>
  </div>

  return <iframe
    className="charger-map"
    src={view.embedUrl}
    title={view.title}
    loading="lazy"
    allowFullScreen
    referrerPolicy="no-referrer-when-downgrade"
    onError={() => setFailed(true)}
  />
}

export default function ChargerMap({ origin, chargers, radius, selectedId }) {
  const view = googleMapsView({ origin, chargers, radius, selectedId })

  return <div className="charger-map-shell" aria-label="Charger map">
    <div className="charger-map-toolbar">
      <span>{view.label}</span>
      <a href={view.mapUrl} target="_blank" rel="noreferrer">Open Google Maps <span aria-hidden="true">↗</span></a>
    </div>
    <MapFrame key={view.embedUrl} view={view} />
  </div>
}
