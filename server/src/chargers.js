const MILES_TO_METERS = 1609.344;
const RADII = new Set([5, 10, 25]);
const SOCKETS = {
  type1: 'J1772', type1_combo: 'CCS1', type2: 'Type 2', type2_combo: 'CCS2',
  chademo: 'CHAdeMO', tesla_supercharger: 'NACS / Tesla', tesla_destination: 'Tesla',
  nacs: 'NACS', tesla_standard: 'Tesla', nema_5_15: 'NEMA 5-15',
  nema_14_50: 'NEMA 14-50', schuko: 'Schuko', gb_dc: 'GB/T DC', gb_ac: 'GB/T AC',
};

class SearchError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function validCoordinate(latitude, longitude) {
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

function distanceMiles(a, b) {
  const radians = value => value * Math.PI / 180;
  const latDelta = radians(b.latitude - a.latitude);
  const lngDelta = radians(b.longitude - a.longitude);
  const h = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lngDelta / 2) ** 2;
  return 3958.7613 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

function text(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function powerKw(value) {
  // A unitless socket output is watts in OSM; never silently label watts as kW.
  const match = text(value).match(/^(\d+(?:\.\d+)?)\s*(kW|W|MW)?$/i);
  if (!match) return null;
  const number = Number(match[1]);
  const unit = (match[2] || 'W').toLowerCase();
  const power = unit === 'mw' ? number * 1000 : unit === 'kw' ? number : number / 1000;
  return power > 0 && power <= 2000 ? power : null;
}

function normalizeStations(elements, origin, radius) {
  const seen = new Set();
  return elements.flatMap(element => {
    const tags = element.tags || {};
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    if (tags.amenity !== 'charging_station' || !validCoordinate(latitude, longitude)
      || ['private', 'no'].includes(tags.access) || tags.motorcar === 'no'
      || ['yes', 'true', '1'].includes(tags.disused) || tags['disused:amenity']
      || tags['abandoned:amenity'] || tags['construction:amenity']) return [];
    const id = `${element.type}/${element.id}`;
    if (!['node', 'way', 'relation'].includes(element.type) || !Number.isSafeInteger(element.id) || seen.has(id)) return [];
    seen.add(id);
    const distance = distanceMiles(origin, { latitude, longitude });
    if (distance > radius) return [];
    const connectors = Object.entries(SOCKETS).flatMap(([key, label]) => {
      const count = text(tags[`socket:${key}`]);
      return count && count !== 'no' && count !== '0' ? [label] : [];
    });
    const powers = Object.entries(tags).filter(([key]) => /^socket:[^:]+:output$/.test(key)
      || key === 'charging_station:output').map(([, value]) => powerKw(value)).filter(value => value !== null);
    const street = [text(tags['addr:housenumber']), text(tags['addr:street'])].filter(Boolean).join(' ');
    const address = text(tags['addr:full']) || [street, text(tags['addr:city']), text(tags['addr:state'])].filter(Boolean).join(', ');
    return [{
      id, latitude, longitude,
      name: text(tags.name) || text(tags.brand) || text(tags.operator) || 'EV charging station',
      network: text(tags.network) || text(tags.operator) || null,
      address: address || null, distanceMiles: Math.round(distance * 100) / 100,
      connectors: [...new Set(connectors)], maxPowerKw: powers.length ? Math.max(...powers) : null,
      openingHours: text(tags.opening_hours) || null,
      access: text(tags.access) || null,
      osmUrl: `https://www.openstreetmap.org/${id}`,
    }];
  }).sort((a, b) => a.distanceMiles - b.distanceMiles || a.id.localeCompare(b.id));
}

function createChargerHandlers({
  fetchImpl = (...args) => fetch(...args),
  now = Date.now,
  nominatimUrl = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search',
  overpassUrl = process.env.OVERPASS_URL || 'https://overpass.private.coffee/api/interpreter',
} = {}) {
  const locations = new Map();
  const stations = new Map();
  const pending = new Map();
  let nextGeocodeAt = 0;
  let activeStationSearches = 0;
  const headers = { 'User-Agent': 'Group9-EV-Charger-Finder/1.0', Accept: 'application/json' };

  function cached(cache, key, ttl, work) {
    const entry = cache.get(key);
    if (entry && entry.expires > now()) return Promise.resolve(entry.value);
    const requestKey = `${cache === locations ? 'location' : 'station'}:${key}`;
    if (pending.has(requestKey)) return pending.get(requestKey);
    const request = Promise.resolve().then(work).then(value => {
      cache.delete(key);
      if (cache.size >= 200) cache.delete(cache.keys().next().value);
      cache.set(key, { value, expires: now() + ttl });
      return value;
    }).finally(() => pending.delete(requestKey));
    pending.set(requestKey, request);
    return request;
  }

  async function requestJson(url, options = {}) {
    try {
      const response = await fetchImpl(url, { ...options, headers: { ...headers, ...options.headers }, signal: AbortSignal.timeout(25000) });
      if (!response.ok) {
        if (response.status === 429) throw Object.assign(new SearchError(429, 'The search service is busy. Wait a moment and try again.'), { retryAfter: '30' });
        throw new SearchError(502, 'The search service is unavailable. Please try again.');
      }
      return await response.json();
    } catch (error) {
      if (error instanceof SearchError) throw error;
      if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new SearchError(504, 'The search took too long. Please try again.');
      throw new SearchError(502, 'The search service could not be reached. Please try again.');
    }
  }

  function route(handler) {
    return async (req, res) => {
      // Addresses and precise locations must not enter shared HTTP/CDN caches.
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
      const results = await cached(locations, address.toLowerCase(), 86400000, async () => {
        // Nominatim permits at most one request per second. No autocomplete or automatic retries.
        if (now() < nextGeocodeAt) throw new SearchError(429, 'Address search is busy. Wait a moment and try again.');
        nextGeocodeAt = now() + 1100;
        const url = new URL(nominatimUrl);
        url.search = new URLSearchParams({ q: address, format: 'jsonv2', limit: '5', 'accept-language': 'en' }).toString();
        const data = await requestJson(url);
        if (!Array.isArray(data)) throw new SearchError(502, 'Address search returned an incomplete response. Please try again.');
        return data.flatMap(place => {
          const latitude = Number(place.lat);
          const longitude = Number(place.lon);
          return place.lat != null && place.lon != null && validCoordinate(latitude, longitude) && text(place.display_name)
            ? [{ id: String(place.place_id), label: text(place.display_name, 400), latitude, longitude }] : [];
        }).slice(0, 5);
      });
      return { locations: results };
    }),
    nearby: route(async query => {
      const latitude = typeof query.lat === 'string' && query.lat.trim() ? Number(query.lat) : NaN;
      const longitude = typeof query.lng === 'string' && query.lng.trim() ? Number(query.lng) : NaN;
      const radius = query.radius === undefined ? 5 : typeof query.radius === 'string' ? Number(query.radius) : NaN;
      if (!validCoordinate(latitude, longitude) || !RADII.has(radius)) {
        throw new SearchError(400, 'Choose a valid location and a radius of 5, 10, or 25 miles.');
      }
      const origin = { latitude, longitude };
      const key = `${latitude.toFixed(5)},${longitude.toFixed(5)},${radius}`;
      const elements = await cached(stations, key, 300000, async () => {
        if (activeStationSearches >= 2) throw new SearchError(429, 'Charger search is busy. Wait a moment and try again.');
        activeStationSearches++;
        try {
          const data = `[out:json][timeout:20];nwr(around:${Math.ceil(radius * MILES_TO_METERS)},${latitude},${longitude})["amenity"="charging_station"]["motorcar"!="no"]["access"!~"^(private|no)$"];out center tags;`;
          const result = await requestJson(overpassUrl, {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ data }).toString(),
          });
          // Overpass can return HTTP 200 with a runtime error and partial or empty data.
          if (!Array.isArray(result.elements) || result.remark) throw new SearchError(502, 'Charger search returned an incomplete response. Please try again.');
          return result.elements;
        } finally { activeStationSearches--; }
      });
      const chargers = normalizeStations(elements, origin, radius);
      return { chargers: chargers.slice(0, 30), total: chargers.length, radius, source: 'OpenStreetMap' };
    }),
  };
}

module.exports = { createChargerHandlers, distanceMiles, normalizeStations, powerKw };
