const states = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
const FRESH_MS = 6 * 60 * 60 * 1000;
const STALE_MS = 7 * 24 * 60 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 30000;

class RateError extends Error {
  constructor(message, retryable = false) { super(message); this.retryable = retryable; }
}

function normalize(rows, state) {
  const history = (Array.isArray(rows) ? rows : [])
    .filter(row => row?.stateid === state && row.sectorid === 'RES'
      && /^\d{4}-(0[1-9]|1[0-2])$/.test(row.period)
      && typeof row.price !== 'boolean' && row.price !== null && String(row.price ?? '').trim() !== ''
      && Number.isFinite(Number(row.price)) && Number(row.price) > 0
      && /^cents per kilowatt-?hour$/i.test(String(row['price-units'] ?? '').trim()))
    .map(row => ({ period: row.period, price: Number(row.price) }))
    .sort((a, b) => b.period.localeCompare(a.period));
  return [...new Map(history.map(row => [row.period, row])).values()].slice(0, 12);
}

function createElectricityRatesHandler({
  fetchImpl = (...args) => fetch(...args),
  now = Date.now,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  getKey = () => process.env.EIA_API_KEY,
} = {}) {
  const cache = new Map();
  const inFlight = new Map();
  const failures = new Map();

  async function load(state, key) {
    const url = new URL('https://api.eia.gov/v2/electricity/retail-sales/data/');
    // Bound EIA's search to two years; only the latest 12 monthly observations are needed.
    const start = new Date(now());
    start.setUTCFullYear(start.getUTCFullYear() - 2, start.getUTCMonth(), 1);
    for (const [name, value] of Object.entries({
      api_key: key, frequency: 'monthly', 'data[0]': 'price',
      'facets[stateid][0]': state, 'facets[sectorid][0]': 'RES',
      'sort[0][column]': 'period', 'sort[0][direction]': 'desc',
      start: start.toISOString().slice(0, 7), offset: '0', length: '12',
    })) url.searchParams.set(name, value);

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(6000) });
        if (!response.ok) throw new RateError('EIA rates are temporarily unavailable. Please try again.', response.status === 429 || response.status >= 500);
        const payload = await response.json();
        const history = normalize(payload.response?.data, state);
        if (!history.length) throw new RateError('No residential price data is currently available for this location.');
        const fetchedAt = now();
        // Never return EIA's raw payload: its request metadata can echo the API key.
        const data = { state, sector: 'Residential', unit: 'cents per kWh', ...history[0],
          history, source: 'https://www.eia.gov/opendata/', fetchedAt: new Date(fetchedAt).toISOString(), stale: false };
        cache.set(state, { data, fetchedAt });
        failures.delete(state);
        return data;
      } catch (error) {
        if (attempt === 0 && (!(error instanceof RateError) || error.retryable)) {
          await sleep(200);
          continue;
        }
        throw error;
      }
    }
  }

  return async function electricityRates(req, res) {
    // Errors must never be cached by the browser or CDN.
    res.set('Cache-Control', 'no-store');
    const state = typeof req.query.state === 'string' ? req.query.state.trim().toUpperCase() : '';
    if (!states.has(state)) return res.status(400).json({ error: 'Choose a valid US state or DC.' });
    const key = getKey()?.trim();
    if (!key || key === 'replace_with_your_eia_key') return res.status(503).json({ error: 'Electricity rates are not configured yet. Please try again later.' });

    const cached = cache.get(state);
    const age = cached ? now() - cached.fetchedAt : Infinity;
    function send(data, cacheStatus) {
      const remaining = Math.max(0, Math.floor((FRESH_MS - (now() - Date.parse(data.fetchedAt))) / 1000));
      res.set('Cache-Control', data.stale
        ? 'public, max-age=30, s-maxage=30'
        : `public, max-age=${Math.min(300, remaining)}, s-maxage=${remaining}, stale-while-revalidate=86400`);
      res.set('X-Rate-Cache', cacheStatus);
      return res.json(data);
    }
    if (cached && age < FRESH_MS) return send(cached.data, 'HIT');

    // Back off during outages instead of sending a new EIA request on every retry.
    const failure = failures.get(state);
    if (failure && now() < failure.until) {
      if (cached && age < STALE_MS) return send({ ...cached.data, stale: true }, 'STALE');
      res.set('Retry-After', String(Math.ceil((failure.until - now()) / 1000)));
      return res.status(502).json({ error: failure.message });
    }

    const shared = inFlight.has(state);
    if (!shared) {
      const request = load(state, key)
        .catch(error => {
          const message = error instanceof RateError ? error.message : 'EIA rates are temporarily unavailable. Please try again.';
          failures.set(state, { until: now() + FAILURE_COOLDOWN_MS, message });
          throw new RateError(message);
        })
        .finally(() => inFlight.delete(state));
      inFlight.set(state, request);
    }
    try {
      return send(await inFlight.get(state), shared ? 'SHARED' : 'MISS');
    } catch (error) {
      if (cached && now() - cached.fetchedAt < STALE_MS) return send({ ...cached.data, stale: true }, 'STALE');
      res.set('Retry-After', '30');
      return res.status(502).json({ error: error.message });
    }
  };
}

module.exports = createElectricityRatesHandler();
module.exports.createElectricityRatesHandler = createElectricityRatesHandler;
