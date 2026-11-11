async function getJson(path, params, signal) {
  const deadline = new AbortController();
  const requestSignal = signal ? AbortSignal.any([signal, deadline.signal]) : deadline.signal;
  // Release the controls if the API or address lookup stalls during a cold start.
  const timeout = setTimeout(() => deadline.abort(), 20000);
  try {
    let response;
    try { response = await fetch(`${path}?${new URLSearchParams(params)}`, { signal: requestSignal }); }
    catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new Error('Could not reach charger search. Check your connection and try again.');
    }
    let data;
    try { data = await response.json(); }
    catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new Error('Charger search is unavailable. Please try again.');
    }
    if (!response.ok) throw new Error(data?.error || 'Charger search is unavailable. Please try again.');
    return data;
  } catch (error) {
    if (deadline.signal.aborted && !signal?.aborted) {
      throw new Error('The search took too long. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function findLocations(address, signal) {
  const data = await getJson('/api/charging-locations', { q: address }, signal);
  if (!Array.isArray(data?.locations)) throw new Error('Address search returned an incomplete response. Please try again.');
  return data.locations;
}

export async function findChargers(location, radius = 1, signal) {
  const data = await getJson('/api/chargers', { lat: location.latitude, lng: location.longitude, radius }, signal);
  if (!Array.isArray(data?.chargers)) throw new Error('Charger search returned an incomplete response. Please try again.');
  return data;
}

export function googleMapsDirections(station) {
  const params = new URLSearchParams({ api: '1', destination: `${station.latitude},${station.longitude}`, travelmode: 'driving' });
  return `https://www.google.com/maps/dir/?${params}`;
}

export function formatDistance(miles) {
  return miles < 0.1 ? 'Under 0.1 mi' : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(miles)} mi`;
}
