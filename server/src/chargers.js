const { loadSavedChargerSearch, validCoordinate } = require('./charger-data');
const RADII = new Set([1, 5, 10, 25]);

class SearchError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function createChargerHandlers({
  fetchImpl = (...args) => fetch(...args), now = Date.now,
  nominatimUrl = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search',
  getSavedSearch = loadSavedChargerSearch, requestTimeoutMs = 8000,
} = {}) {
  const locations = new Map();
  const pending = new Map();
  let nextGeocodeAt = 0;

  function cachedLocation(key, work) {
    const entry = locations.get(key);
    if (entry && entry.expires > now()) return Promise.resolve(entry.value);
    if (pending.has(key)) return pending.get(key);
    const request = Promise.resolve().then(work).then(value => {
      locations.delete(key);
      if (locations.size >= 200) locations.delete(locations.keys().next().value);
      locations.set(key, { value, expires: now() + 86400000 });
      return value;
    }).finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  }

  async function requestLocations(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetchImpl(url, {
        headers: { 'User-Agent': 'Group9-EV-Charger-Finder/2.0', Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 429) throw Object.assign(new SearchError(429, 'Address search is busy. Wait a moment and try again.'), { retryAfter: '30' });
        throw new SearchError(502, 'Address search is unavailable. Please try again.');
      }
      return await response.json();
    } catch (error) {
      if (error instanceof SearchError) throw error;
      if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new SearchError(504, 'Address search took too long. Try again or use your location.');
      throw new SearchError(502, 'Address search could not be reached. Try again or use your location.');
    } finally { clearTimeout(timeout); }
  }

  function route(handler) {
    return async (req, res) => {
      res.set('Cache-Control', 'no-store');
      try { res.json(await handler(req.query)); }
      catch (error) {
        if (error.status === 429) res.set('Retry-After', error.retryAfter || '2');
        res.status(error instanceof SearchError ? error.status : 502).json({
          error: error instanceof SearchError ? error.message : 'Charger search is unavailable. Please try again.',
        });
      }
    };
  }

  return {
    locations: route(async query => {
      if (typeof query.q !== 'string' || query.q.trim().length < 3 || query.q.trim().length > 200) {
        throw new SearchError(400, 'Enter an address or city between 3 and 200 characters.');
      }
      const address = query.q.trim().replace(/\s+/g, ' ');
      const results = await cachedLocation(address.toLowerCase(), async () => {
        // Explicit submissions only; public Nominatim allows one request per second.
        if (now() < nextGeocodeAt) throw new SearchError(429, 'Address search is busy. Wait a moment and try again.');
        nextGeocodeAt = now() + 1100;
        const url = new URL(nominatimUrl);
        url.search = new URLSearchParams({ q: address, format: 'jsonv2', limit: '5', 'accept-language': 'en', countrycodes: 'us' }).toString();
        const data = await requestLocations(url);
        if (!Array.isArray(data)) throw new SearchError(502, 'Address search returned an incomplete response. Please try again.');
        return data.flatMap(place => {
          const latitude = Number(place.lat);
          const longitude = Number(place.lon);
          const label = typeof place.display_name === 'string' ? place.display_name.trim().slice(0, 400) : '';
          return place.lat != null && place.lon != null && validCoordinate(latitude, longitude) && label
            ? [{ id: String(place.place_id), label, latitude, longitude }] : [];
        }).slice(0, 5);
      });
      return { locations: results };
    }),
    nearby: route(async query => {
      const latitude = typeof query.lat === 'string' && query.lat.trim() ? Number(query.lat) : NaN;
      const longitude = typeof query.lng === 'string' && query.lng.trim() ? Number(query.lng) : NaN;
      const radius = query.radius === undefined ? 1 : typeof query.radius === 'string' ? Number(query.radius) : NaN;
      if (!validCoordinate(latitude, longitude) || !RADII.has(radius)) {
        throw new SearchError(400, 'Choose a valid location and a radius of 1, 5, 10, or 25 miles.');
      }
      let search;
      try { search = getSavedSearch(); }
      catch { throw new SearchError(503, 'Saved charger data is unavailable. Please try again later.'); }
      return search({ latitude, longitude }, radius, now());
    }),
  };
}

module.exports = { createChargerHandlers };
