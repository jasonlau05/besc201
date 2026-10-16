import { readFile, writeFile, rename, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { buildDataset, validateDataset, STATE_CODES } from '../src/rates-dataset.js'

export const DATA_PATH = fileURLToPath(new URL('../data/electricity-rates.json', import.meta.url))

export function buildBatchUrl(key, now = new Date()) {
  const url = new URL('https://api.eia.gov/v2/electricity/retail-sales/data/')
  const start = new Date(Date.UTC(now.getUTCFullYear() - 2, now.getUTCMonth(), 1))
  for (const [name, value] of Object.entries({
    api_key: key, frequency: 'monthly', 'data[0]': 'price',
    'facets[sectorid][0]': 'RES', start: start.toISOString().slice(0, 7),
    'sort[0][column]': 'period', 'sort[0][direction]': 'desc', offset: '0', length: '5000',
  })) url.searchParams.set(name, value)
  STATE_CODES.forEach((state, index) => url.searchParams.set(`facets[stateid][${index}]`, state))
  return url
}

export async function refreshRates({
  key = process.env.EIA_API_KEY, outputPath = DATA_PATH, now = () => new Date(),
  fetchImpl = (...args) => fetch(...args), sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  if (!key?.trim() || key === 'replace_with_your_eia_key') throw new Error('Set the EIA_API_KEY Actions secret to refresh rates.')
  // Read and validate before the request; a failed refresh never replaces the saved file.
  const previous = validateDataset(JSON.parse(await readFile(outputPath, 'utf8')))
  const url = buildBatchUrl(key.trim(), now())
  let payload
  for (let attempt = 0; attempt < 2; attempt++) {
    let response
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(45000) })
    } catch {
      if (attempt === 0) { await sleep(2000); continue }
      throw new Error('EIA timed out or could not be reached; saved rates were not changed.')
    }
    // Do not retry a throttled key or an authentication error.
    if (response.status === 429) throw new Error('EIA rate limit reached. Wait for the next scheduled run; saved rates were not changed.')
    if (!response.ok) {
      if (response.status >= 500 && attempt === 0) { await sleep(2000); continue }
      throw new Error(`EIA returned HTTP ${response.status}; saved rates were not changed.`)
    }
    try { payload = await response.json() } catch { throw new Error('EIA returned invalid JSON; saved rates were not changed.') }
    break
  }
  const dataset = buildDataset(payload, now().toISOString())
  for (const state of STATE_CODES) {
    if (dataset.states[state].period < previous.states[state].period) throw new Error('EIA returned older rates; saved rates were not changed.')
  }
  const temporary = outputPath + '.' + randomUUID() + '.tmp'
  try {
    await writeFile(temporary, JSON.stringify(dataset, null, 2) + '\n', { flag: 'wx' })
    await rename(temporary, outputPath)
  } finally {
    await rm(temporary, { force: true })
  }
  // Only summary counts are logged; raw EIA responses and URLs may expose the key.
  return { states: STATE_CODES.length, months: 12, latestPeriod: dataset.states.TX.period, retrievedAt: dataset.retrievedAt }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(await refreshRates())) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
