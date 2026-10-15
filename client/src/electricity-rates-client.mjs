const FRESH_MS = 6 * 60 * 60 * 1000
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const PREFIX = 'group9:eia:v1:'

function valid(data, state) {
  return data?.state === state && Number.isFinite(data.price) && data.price > 0
    && /^\d{4}-(0[1-9]|1[0-2])$/.test(data.period)
    && Array.isArray(data.history) && data.history.length > 0 && data.history.length <= 12
    && data.history.every(row => Number.isFinite(row.price) && row.price > 0 && /^\d{4}-(0[1-9]|1[0-2])$/.test(row.period))
}

export function createRatesClient({
  fetchImpl = (...args) => fetch(...args), now = Date.now,
  storage = () => { try { return window.sessionStorage } catch { return null } },
} = {}) {
  const cache = new Map()
  const inFlight = new Map()
  function peek(state, allowStale = false) {
    let entry = cache.get(state)
    if (!entry) {
      try { entry = JSON.parse(storage()?.getItem(PREFIX + state) ?? 'null') } catch { /* Storage may be unavailable. */ }
      if (entry && valid(entry.data, state)) cache.set(state, entry)
    }
    if (!entry || !valid(entry.data, state) || !Number.isFinite(entry.savedAt) || !Number.isFinite(entry.expiresAt)) return null
    if (now() - entry.savedAt >= MAX_AGE_MS) return null
    if (now() < entry.expiresAt) return entry.data
    return allowStale ? { ...entry.data, stale: true } : null
  }
  function save(state, data) {
    const savedAt = now()
    const upstreamTime = Date.parse(data.fetchedAt)
    const expiresAt = data.stale ? savedAt + 30000 : Math.min(savedAt + FRESH_MS, (Number.isFinite(upstreamTime) ? upstreamTime : savedAt) + FRESH_MS)
    const entry = { data, savedAt: Number.isFinite(upstreamTime) ? Math.min(savedAt, upstreamTime) : savedAt, expiresAt }
    cache.set(state, entry)
    try { storage()?.setItem(PREFIX + state, JSON.stringify(entry)) } catch { /* Memory cache still works. */ }
  }
  function load(state, { force = false } = {}) {
    const cached = peek(state)
    if (cached && !force) return Promise.resolve(cached)
    if (inFlight.has(state)) return inFlight.get(state)
    const fallback = peek(state, true)
    const request = (async () => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      try {
        const response = await fetchImpl(`/api/electricity-rates?state=${encodeURIComponent(state)}`, { signal: controller.signal, cache: force ? 'no-cache' : 'default' })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Rates are unavailable. Please try again.')
        if (!valid(result, state)) throw new Error('Rates are unavailable. Please try again.')
        save(state, result)
        return result
      } catch (error) {
        if (fallback) return { ...fallback, stale: true }
        if (error.name === 'AbortError') throw new Error('The rate request timed out. Please try again.')
        throw new Error(error instanceof SyntaxError || error instanceof TypeError ? 'Unable to load electricity rates. Please try again.' : error.message)
      } finally {
        clearTimeout(timeout)
      }
    })().finally(() => inFlight.delete(state))
    inFlight.set(state, request)
    return request
  }
  return { peek, load }
}

export const ratesClient = createRatesClient()
