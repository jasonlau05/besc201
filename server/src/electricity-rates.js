const states = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
const cache = new Map();

module.exports = async function electricityRates(req, res) {
  const state = typeof req.query.state === 'string' ? req.query.state.toUpperCase() : '';
  if (!states.has(state)) return res.status(400).json({ error: 'Choose a valid US state or DC.' });
  const key = process.env.EIA_API_KEY;
  if (!key || key === 'replace_with_your_eia_key') return res.status(503).json({ error: 'Electricity rates are not configured yet. Please try again later.' });
  const cached = cache.get(state);
  if (cached && cached.expires > Date.now()) return res.json(cached.data);
  const url = new URL('https://api.eia.gov/v2/electricity/retail-sales/data/');
  for (const [name, value] of Object.entries({ api_key: key, frequency: 'monthly', 'data[0]': 'price', 'facets[stateid][0]': state, 'facets[sectorid][0]': 'RES', 'sort[0][column]': 'period', 'sort[0][direction]': 'desc', offset: '0', length: '12' })) url.searchParams.set(name, value);
  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!upstream.ok) throw new Error('EIA request failed');
    const payload = await upstream.json();
    const rows = payload.response?.data;
    const history = (Array.isArray(rows) ? rows : []).filter(row => row.stateid === state && row.sectorid === 'RES' && /^\d{4}-\d{2}$/.test(row.period) && row.price !== null && row.price !== '' && Number.isFinite(Number(row.price)) && Number(row.price) > 0 && row['price-units'] === 'cents per kilowatt-hour').map(row => ({ period: row.period, price: Number(row.price) })).sort((a, b) => b.period.localeCompare(a.period));
    if (!history.length) return res.status(502).json({ error: 'No residential price data is currently available for this location.' });
    const data = { state, sector: 'Residential', unit: 'cents per kWh', ...history[0], history, source: 'https://www.eia.gov/opendata/' };
    cache.set(state, { data, expires: Date.now() + 3600000 });
    // Only normalized data is returned. EIA's request echo contains the API key.
    return res.json(data);
  } catch {
    return res.status(502).json({ error: 'EIA rates are temporarily unavailable. Please try again.' });
  }
};
