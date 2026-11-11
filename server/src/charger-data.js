const { readFileSync } = require('node:fs');
const path = require('node:path');

const EARTH_RADIUS_MILES = 3958.7613;
const SOURCE_URL = 'https://afdc.energy.gov/stations/';
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;
const CONNECTORS = {
  J1772: 'J1772', J1772COMBO: 'CCS1', CHADEMO: 'CHAdeMO', TESLA: 'NACS / Tesla',
  NEMA1450: 'NEMA 14-50', NEMA515: 'NEMA 5-15', NEMA520: 'NEMA 5-20', J3271: 'MCS',
};

function validCoordinate(latitude, longitude) {
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

function distanceMiles(a, b) {
  const radians = value => value * Math.PI / 180;
  const h = Math.sin(radians(b.latitude - a.latitude) / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude))
    * Math.sin(radians(b.longitude - a.longitude) / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

function text(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalizeStation(row) {
  if (!row || row.fuel_type_code !== 'ELEC' || row.country !== 'US'
    || row.access_code !== 'public' || row.status_code !== 'E'
    || !Number.isSafeInteger(row.id) || row.id <= 0
    || !validCoordinate(row.latitude, row.longitude) || !text(row.station_name)
    || !/^[A-Z]{2}$/.test(row.state)) return null;
  const units = Array.isArray(row.ev_charging_units) ? row.ev_charging_units : [];
  const unitConnectors = units.flatMap(unit => Object.entries(unit?.connectors || {})
    .filter(([, info]) => Number.isFinite(info?.port_count) && info.port_count > 0));
  const connectors = [...new Set([
    ...(Array.isArray(row.ev_connector_types) ? row.ev_connector_types : []),
    ...unitConnectors.map(([connector]) => connector),
  ].flatMap(connector => CONNECTORS[connector] ? [CONNECTORS[connector]] : []))].sort();
  // AFDC explicitly reports kW. Missing values and zero-port connector entries are omitted.
  const powers = unitConnectors.map(([, info]) => info.power_kw)
    .filter(power => Number.isFinite(power) && power > 0 && power <= 5000);
  const address = [text(row.street_address), text(row.city), text(row.state), text(row.zip)].filter(Boolean).join(', ');
  return {
    id: `afdc/${row.id}`, latitude: row.latitude, longitude: row.longitude,
    name: text(row.station_name), address: address || null, state: row.state,
    network: row.ev_network === 'Non-Networked' ? null : text(row.ev_network) || null,
    connectors, maxPowerKw: powers.length ? Math.max(...powers) : null,
    openingHours: text(row.access_days_time, 500) || null, access: 'public',
  };
}

function validateChargerDataset(dataset) {
  const fail = () => { throw new Error('Invalid saved AFDC charger dataset.'); };
  if (dataset?.schemaVersion !== 1 || dataset.source !== 'AFDC' || dataset.coverage !== 'US'
    || dataset.sourceUrl !== SOURCE_URL || !Number.isFinite(Date.parse(dataset.retrievedAt))
    || !Array.isArray(dataset.stations) || !dataset.stations.length
    || dataset.stationCount !== dataset.stations.length
    || !Number.isSafeInteger(dataset.sourceCount) || dataset.sourceCount < dataset.stationCount) fail();
  const seen = new Set();
  for (const station of dataset.stations) {
    if (!station || !/^afdc\/[1-9]\d*$/.test(station.id) || seen.has(station.id)
      || !validCoordinate(station.latitude, station.longitude) || !text(station.name)
      || station.name.length > 200 || !/^[A-Z]{2}$/.test(station.state)
      || !Array.isArray(station.connectors) || station.connectors.some(connector => !Object.values(CONNECTORS).includes(connector))
      || (station.maxPowerKw !== null && (!Number.isFinite(station.maxPowerKw) || station.maxPowerKw <= 0 || station.maxPowerKw > 5000))
      || (station.address !== null && (typeof station.address !== 'string' || station.address.length > 1000))
      || (station.network !== null && (typeof station.network !== 'string' || station.network.length > 200))
      || (station.openingHours !== null && (typeof station.openingHours !== 'string' || station.openingHours.length > 500))
      || station.access !== 'public') fail();
    seen.add(station.id);
  }
  return dataset;
}

function buildChargerDataset(payload, retrievedAt) {
  if (payload?.errors || !Number.isSafeInteger(payload?.total_results) || payload.total_results <= 0
    || !Array.isArray(payload.fuel_stations) || payload.fuel_stations.length !== payload.total_results) {
    throw new Error('AFDC returned an incomplete station list; saved chargers were not changed.');
  }
  const stations = payload.fuel_stations.map(normalizeStation).filter(Boolean)
    .sort((a, b) => Number(a.id.slice(5)) - Number(b.id.slice(5)));
  return validateChargerDataset({
    schemaVersion: 1, source: 'AFDC', sourceUrl: SOURCE_URL, coverage: 'US', retrievedAt,
    sourceCount: payload.total_results, stationCount: stations.length, stations,
  });
}

function createChargerSearch(dataset) {
  validateChargerDataset(dataset);
  // One shared latitude index per warm instance; searches only scan a narrow latitude band.
  const stations = [...dataset.stations].sort((a, b) => a.latitude - b.latitude);
  function lowerBound(latitude) {
    let low = 0;
    let high = stations.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (stations[middle].latitude < latitude) low = middle + 1;
      else high = middle;
    }
    return low;
  }
  return (origin, radius, now = Date.now()) => {
    const latitudeDelta = radius / EARTH_RADIUS_MILES * 180 / Math.PI + 1e-9;
    const matches = [];
    for (let i = lowerBound(origin.latitude - latitudeDelta);
      i < stations.length && stations[i].latitude <= origin.latitude + latitudeDelta; i++) {
      const station = stations[i];
      const distance = distanceMiles(origin, station);
      if (distance <= radius) matches.push({ station, distance });
    }
    matches.sort((a, b) => a.distance - b.distance || a.station.id.localeCompare(b.station.id));
    return {
      chargers: matches.slice(0, 30).map(({ station, distance }) => ({
        ...station, distanceMiles: Math.round(distance * 100) / 100,
        detailsUrl: `${SOURCE_URL}#/station/${station.id.slice(5)}`,
      })),
      total: matches.length, radius, source: 'AFDC', sourceUrl: SOURCE_URL, coverage: 'US',
      retrievedAt: dataset.retrievedAt, stale: now - Date.parse(dataset.retrievedAt) > STALE_AFTER_MS,
    };
  };
}

let savedSearch;
function loadSavedChargerSearch() {
  // Keep this static path traceable by Vercel's function bundler. No provider requests at runtime.
  if (!savedSearch) savedSearch = createChargerSearch(JSON.parse(readFileSync(
    path.join(__dirname, '../data/charging-stations.json'), 'utf8',
  )));
  return savedSearch;
}

module.exports = {
  SOURCE_URL, validCoordinate, distanceMiles, normalizeStation,
  validateChargerDataset, buildChargerDataset, createChargerSearch, loadSavedChargerSearch,
};
