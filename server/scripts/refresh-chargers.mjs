import { readFile, writeFile, rename, rm, mkdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { buildChargerDataset, validateChargerDataset } from '../src/charger-data.js'
import { STATE_CODES } from '../src/rates-dataset.js'

export const DATA_PATH = fileURLToPath(new URL('../data/charging-stations.json', import.meta.url))

export function buildBatchUrl() {
  const url = new URL('https://developer.nlr.gov/api/alt-fuel-stations/v1.json')
  url.search = new URLSearchParams({ fuel_type: 'ELEC', access: 'public', status: 'E', country: 'US', limit: 'all' }).toString()
  return url
}

export function serializeDataset(dataset) {
  const { stations, ...metadata } = dataset
  // Stable IDs and one record per line keep daily data changes reviewable in Git.
  return JSON.stringify(metadata).slice(0, -1) + ',"stations":[\n'
    + stations.map(station => JSON.stringify(station)).join(',\n') + '\n]}\n'
}

export async function refreshChargers({
  key = process.env.AFDC_API_KEY, outputPath = DATA_PATH, now = () => new Date(),
  fetchImpl = (...args) => fetch(...args), requestTimeoutMs = 120000,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  minimumStations = 50000, requiredStates = STATE_CODES,
} = {}) {
  if (!key?.trim() || /^(DEMO_KEY|your_key|replace_.*)$/i.test(key.trim())) {
    throw new Error('Set AFDC_API_KEY in server/.env or GitHub Actions secrets to refresh chargers.')
  }
  let previous
  try { previous = validateChargerDataset(JSON.parse(await readFile(outputPath, 'utf8'))) }
  catch (error) {
    if (error.code !== 'ENOENT') throw new Error('The saved charger dataset is invalid; refresh stopped without changing it.')
  }
  let payload
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)
    try {
      const response = await fetchImpl(buildBatchUrl(), {
        // Keep credentials out of URLs, generated data, and logs.
        headers: { 'X-Api-Key': key.trim(), Accept: 'application/json', 'User-Agent': 'Group9-EV-Charger-Finder/2.0' },
        signal: controller.signal,
      })
      if (!response.ok) {
        await response.body?.cancel()
        if (response.status >= 500 && attempt === 0) { await sleep(2000); continue }
        throw Object.assign(new Error(response.status === 429
          ? 'AFDC rate limit reached; saved chargers were not changed.'
          : `AFDC returned HTTP ${response.status}; saved chargers were not changed.`), { providerError: true })
      }
      payload = await response.json()
      break
    } catch (error) {
      if (error.providerError) throw error
      if (attempt === 0 && error.name !== 'SyntaxError') { await sleep(2000); continue }
      throw new Error('AFDC timed out or returned invalid data; saved chargers were not changed.')
    } finally { clearTimeout(timeout) }
  }
  const dataset = buildChargerDataset(payload, now().toISOString())
  const states = new Set(dataset.stations.map(station => station.state))
  if (dataset.stationCount < minimumStations || requiredStates.some(state => !states.has(state))
    || dataset.stationCount < dataset.sourceCount * 0.99
    || (previous && dataset.stationCount < previous.stationCount * 0.9)) {
    throw new Error('AFDC returned unexpectedly low station coverage; saved chargers were not changed.')
  }
  if (previous && Date.parse(dataset.retrievedAt) < Date.parse(previous.retrievedAt)) {
    throw new Error('The new snapshot is older than the saved dataset; saved chargers were not changed.')
  }
  const contents = serializeDataset(dataset)
  const bytes = Buffer.byteLength(contents)
  if (bytes > 100000000) throw new Error('The trimmed dataset exceeds the deployment size budget; saved chargers were not changed.')
  const temporary = outputPath + '.' + randomUUID() + '.tmp'
  await mkdir(dirname(outputPath), { recursive: true })
  try {
    await writeFile(temporary, contents, { flag: 'wx' })
    await rename(temporary, outputPath)
  } finally { await rm(temporary, { force: true }) }
  return {
    stationCount: dataset.stationCount, excluded: dataset.sourceCount - dataset.stationCount,
    states: states.size, bytes, retrievedAt: dataset.retrievedAt,
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    try { process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url))) }
    catch (error) { if (error.code !== 'ENOENT') throw new Error('Could not read server/.env.') }
    console.log(JSON.stringify(await refreshChargers()))
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
