// All instances using the same public geocoder must share the same Redis key.
// Only a constant marker is stored. Addresses and coordinates stay out of Redis.
function createGeocoderLimit({ url, token, fetchImpl = fetch }) {
  if (!url && !token) return null;
  return async function reserve() {
    if (!url || !token || new URL(url).protocol !== 'https:') {
      throw new Error('Incomplete shared geocoder limit configuration.');
    }
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      redirect: 'error',
      body: JSON.stringify(['SET', 'group9:geocoder:dispatch', '1', 'NX', 'PX', 1100]),
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) throw new Error('Shared geocoder limit unavailable.');
    const { result, error } = await response.json();
    if (error || (result !== null && result !== 'OK')) throw new Error('Invalid shared geocoder limit response.');
    return result === 'OK';
  };
}

module.exports = { createGeocoderLimit };
