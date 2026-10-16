const savedDataset = require('../data/electricity-rates.json');
const { STATE_CODES, validateDataset } = require('./rates-dataset');
const validStates = new Set(STATE_CODES);

function createElectricityRatesHandler({ dataset = savedDataset, now = Date.now } = {}) {
  validateDataset(dataset);
  return function electricityRates(req, res) {
    const selected = req.query.state;
    if (selected !== undefined && (typeof selected !== 'string' || !validStates.has(selected.trim().toUpperCase()))) {
      res.set('Cache-Control', 'no-store');
      return res.status(400).json({ error: 'Choose a valid US state or DC.' });
    }
    const stale = now() - Date.parse(dataset.retrievedAt) > 48 * 60 * 60 * 1000;
    res.set('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
    res.set('X-Rate-Cache', 'SAVED');
    // No EIA access occurs in the request path. Every user reads the same saved dataset.
    if (selected === undefined) return res.json({ ...dataset, stale });
    const state = selected.trim().toUpperCase();
    return res.json({ state, sector: dataset.sector, unit: dataset.unit, ...dataset.states[state],
      source: dataset.source, fetchedAt: dataset.retrievedAt, stale, fallback: dataset.kind === 'reference' });
  };
}

module.exports = createElectricityRatesHandler();
module.exports.createElectricityRatesHandler = createElectricityRatesHandler;
