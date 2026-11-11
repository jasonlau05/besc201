const RADIUS_ZOOM = { 1: 14, 5: 12, 10: 11, 25: 10 }

function hasCoordinates(location) {
  return Number.isFinite(location?.latitude) && Math.abs(location.latitude) <= 90
    && Number.isFinite(location?.longitude) && Math.abs(location.longitude) <= 180
}

export function googleMapsView({ origin = null, chargers = [], radius = 1, selectedId = null } = {}) {
  const index = chargers.findIndex(charger => charger.id === selectedId && hasCoordinates(charger))
  const station = index >= 0 ? chargers[index] : null
  const location = station || (hasCoordinates(origin) ? origin : null)
  const coordinates = location ? `${location.latitude},${location.longitude}` : null
  const query = coordinates || 'United States'
  const zoom = station ? 16 : location ? RADIUS_ZOOM[radius] || RADIUS_ZOOM[1] : 4
  // Google's web-map iframe works without a Cloud API key or a JavaScript SDK.
  const embed = new URLSearchParams({ q: query, z: String(zoom), t: 'k', output: 'embed', hl: 'en' })
  const map = new URLSearchParams({ api: '1', query })

  return {
    embedUrl: `https://maps.google.com/maps?${embed}`,
    mapUrl: `https://www.google.com/maps/search/?${map}`,
    label: station ? `Charger ${index + 1}` : location ? 'Search location' : 'Google Maps',
    title: station ? `${station.name} on Google Maps` : location ? `Google Maps around ${origin.label || 'your search location'}` : 'Google Maps — search an address to find nearby chargers',
  }
}
