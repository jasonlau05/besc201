async function getJson(path, params, signal) {
  let response;
  try { response = await fetch(`${path}?${new URLSearchParams(params)}`, { signal }); }
  catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Could not reach charger search. Check your connection and try again.');
  }
  let data;
  try { data = await response.json(); }
  catch { throw new Error('Charger search is unavailable. Please try again.'); }
  if (!response.ok) throw new Error(data.error || 'Charger search is unavailable. Please try again.');
  return data;
}

export async function findLocations(address, signal) {
  const data = await getJson('/api/charging-locations', { q: address }, signal);
  if (!Array.isArray(data.locations)) throw new Error('Address search returned an incomplete response. Please try again.');
  return data.locations;
}

export async function findChargers(location, radius, signal) {
  const data = await getJson('/api/chargers', { lat: location.latitude, lng: location.longitude, radius }, signal);
  if (!Array.isArray(data.chargers)) throw new Error('Charger search returned an incomplete response. Please try again.');
  return data;
}

export function googleMapsDirections(station) {
  const params = new URLSearchParams({ api: '1', destination: `${station.latitude},${station.longitude}`, travelmode: 'driving' });
  return `https://www.google.com/maps/dir/?${params}`;
}

export function formatDistance(miles) {
  return miles < 0.1 ? 'Under 0.1 mi' : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(miles)} mi`;
}
