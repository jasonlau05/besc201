const STATE_CODES = Object.freeze('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function validateDataset(dataset, minimumHistory = 1) {
  if (dataset?.schemaVersion !== 1 || dataset.sector !== 'Residential' || dataset.unit !== 'cents per kWh'
    || !Number.isFinite(Date.parse(dataset.retrievedAt))
    || !dataset.states || Object.keys(dataset.states).length !== STATE_CODES.length) {
    throw new Error('Invalid saved electricity-rate dataset.');
  }
  for (const state of STATE_CODES) {
    const rate = dataset.states[state];
    if (!rate || !MONTH.test(rate.period) || !Number.isFinite(rate.price) || rate.price <= 0
      || !Array.isArray(rate.history) || rate.history.length < minimumHistory || rate.history.length > 12
      || rate.history[0].period !== rate.period || rate.history[0].price !== rate.price) {
      throw new Error('Incomplete electricity-rate dataset.');
    }
    let previous = null;
    for (const observation of rate.history) {
      if (!MONTH.test(observation.period) || !Number.isFinite(observation.price) || observation.price <= 0
        || (previous && previous <= observation.period)) throw new Error('Invalid monthly rate history.');
      previous = observation.period;
    }
  }
  return dataset;
}

function buildDataset(payload, retrievedAt) {
  const rows = payload?.response?.data;
  if (payload?.error || !Array.isArray(rows) || !rows.length
    || (Number.isFinite(Number(payload.response.total)) && Number(payload.response.total) > rows.length)) {
    throw new Error('EIA returned an incomplete batch; saved rates were not changed.');
  }
  const grouped = new Map(STATE_CODES.map(state => [state, new Map()]));
  for (const row of rows) {
    if (!grouped.has(row?.stateid)) continue;
    if (row.sectorid !== 'RES' || !MONTH.test(row.period)
      || !/^cents per kilowatt-?hour$/i.test(String(row['price-units'] ?? '').trim())
      || typeof row.price === 'boolean' || String(row.price ?? '').trim() === ''
      || !Number.isFinite(Number(row.price)) || Number(row.price) <= 0) {
      throw new Error('EIA returned an invalid residential observation; saved rates were not changed.');
    }
    const observations = grouped.get(row.stateid);
    const price = Number(row.price);
    if (observations.has(row.period) && observations.get(row.period) !== price) throw new Error('EIA returned conflicting monthly rates.');
    observations.set(row.period, price);
  }
  const states = {};
  for (const [state, observations] of grouped) {
    const history = [...observations].sort(([a], [b]) => b.localeCompare(a)).slice(0, 12).map(([period, price]) => ({ period, price }));
    states[state] = { ...history[0], history };
  }
  const dataset = { schemaVersion: 1, kind: 'scheduled', source: 'https://www.eia.gov/opendata/',
    dataset: 'EIA API v2 electricity/retail-sales', sector: 'Residential', unit: 'cents per kWh', retrievedAt, states };
  validateDataset(dataset, 12);
  if (new Set(Object.values(states).map(rate => rate.period)).size !== 1) {
    throw new Error('EIA did not return the latest month for every state; saved rates were not changed.');
  }
  return dataset;
}

module.exports = { STATE_CODES, validateDataset, buildDataset };
