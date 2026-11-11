const { buildChargerDataset } = require('../src/charger-data');

const RETRIEVED_AT = '2026-11-10T12:00:00.000Z';
function station(id = 1, overrides = {}) {
  return {
    id, station_name: `Station ${id}`, latitude: 41.88, longitude: -87.63,
    country: 'US', state: 'IL', fuel_type_code: 'ELEC', access_code: 'public', status_code: 'E',
    street_address: '100 Test Street', city: 'Chicago', zip: '60601', ev_network: 'Test Network',
    ev_connector_types: ['J1772COMBO'], access_days_time: '24 hours daily', ...overrides,
  };
}
function payload(rows = [station()]) { return { total_results: rows.length, fuel_stations: rows }; }
function dataset(rows = [station()], retrievedAt = RETRIEVED_AT) {
  return buildChargerDataset(payload(rows), retrievedAt);
}

module.exports = { RETRIEVED_AT, station, payload, dataset };
