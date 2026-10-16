const FRESH_MS = 15 * 60 * 1000
const STORAGE_KEY = 'group9:eia:all-states:v2'
const STATE_CODES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ')
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

function valid(dataset) {
  return dataset?.schemaVersion === 1 && dataset.sector === 'Residential' && dataset.unit === 'cents per kWh'
    && Number.isFinite(Date.parse(dataset.retrievedAt))
    && dataset.states && Object.keys(dataset.states).length === STATE_CODES.length
    && STATE_CODES.every(state => {
      const rate = dataset.states[state]
      return rate && MONTH.test(rate.period) && Number.isFinite(rate.price) && rate.price > 0
        && Array.isArray(rate.history) && rate.history.length > 0 && rate.history.length <= 12
        && rate.history[0].period === rate.period && rate.history[0].price === rate.price
        && rate.history.every((row, i) => MONTH.test(row.period) && Number.isFinite(row.price) && row.price > 0
          && (i === 0 || rate.history[i - 1].period > row.period))
    })
}

export function lookupRates(dataset, state, now = Date.now()) {
  if (!dataset?.states || !Object.hasOwn(dataset.states, state)) return null
  const rate = dataset.states[state]
  return { state, ...rate, sector: dataset.sector, unit: dataset.unit, source: dataset.source,
    fetchedAt: dataset.retrievedAt, fallback: dataset.kind === 'reference',
    stale: Boolean(dataset.stale) || now - Date.parse(dataset.retrievedAt) > 48 * 60 * 60 * 1000 }
}

export function createRatesClient({
  fetchImpl = (...args) => fetch(...args), now = Date.now,
  storage = () => { try { return window.sessionStorage } catch { return null } },
} = {}) {
  let saved = null
  let inFlight = null
  function peekDataset(allowStale = false) {
    if (!saved) {
      try { saved = JSON.parse(storage()?.getItem(STORAGE_KEY) ?? 'null') } catch { /* Optional storage. */ }
    }
    if (!saved || !valid(saved.dataset) || !Number.isFinite(saved.savedAt)) { saved = null; return null }
    if (now() - saved.savedAt < FRESH_MS) return saved.dataset
    return allowStale ? { ...saved.dataset, stale: true } : null
  }
  function loadDataset({ force = false } = {}) {
    const fresh = peekDataset()
    if (fresh && !force) return Promise.resolve(fresh)
    if (inFlight) return inFlight
    const previous = peekDataset(true)
    inFlight = (async () => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      try {
        // Fetch all locations once. Selecting another state only calls lookupRates.
        const response = await fetchImpl('/api/electricity-rates', {
          signal: controller.signal, cache: force ? 'no-cache' : 'default',
        })
        const dataset = await response.json()
        if (!response.ok || !valid(dataset)) throw new Error('Saved electricity rates are unavailable. Please try again.')
        saved = { dataset, savedAt: now() }
        try { storage()?.setItem(STORAGE_KEY, JSON.stringify(saved)) } catch { /* Memory still works. */ }
        return dataset
      } catch (error) {
        if (previous) return { ...previous, stale: true }
        if (error.name === 'AbortError') throw new Error('Loading saved rates timed out. Please try again.')
        throw new Error('Unable to load saved electricity rates. Please try again.')
      } finally { clearTimeout(timeout) }
    })().finally(() => { inFlight = null })
    return inFlight
  }
  return { peekDataset, loadDataset }
}

export const ratesClient = createRatesClient()
