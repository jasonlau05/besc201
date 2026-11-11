const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeStation, buildChargerDataset, validateChargerDataset, createChargerSearch, distanceMiles,
} = require('./charger-data');
const { RETRIEVED_AT, station, payload, dataset } = require('../test/charger-fixtures');

test('normalizes AFDC records and only retains public EV station fields', () => {
  const result = normalizeStation(station(12, {
    ev_connector_types: ['TESLA', 'J1772COMBO', 'UNKNOWN'],
    api_key: 'must not persist', station_phone: 'not needed',
    ev_charging_units: [{ connectors: {
      J1772COMBO: { power_kw: 350, port_count: 2 },
      TESLA: { power_kw: 250, port_count: 4 },
      CHADEMO: { power_kw: 500, port_count: 0 },
    } }],
  }));
  assert.equal(result.id, 'afdc/12');
  assert.equal(result.address, '100 Test Street, Chicago, IL, 60601');
  assert.deepEqual(result.connectors, ['CCS1', 'NACS / Tesla']);
  assert.equal(result.maxPowerKw, 350);
  assert.equal(result.openingHours, '24 hours daily');
  assert.doesNotMatch(JSON.stringify(result), /api_key|must not persist|station_phone|ev_charging_units/);
  assert.equal(normalizeStation(station(1, { ev_network: 'Non-Networked' })).network, null);
});

test('excludes private, closed, planned, non-US, non-EV, and unlocatable stations', () => {
  for (const overrides of [
    { access_code: 'private' }, { status_code: 'T' }, { status_code: 'P' },
    { country: 'CA' }, { fuel_type_code: 'E85' }, { latitude: null },
    { longitude: '' }, { latitude: 91 }, { longitude: -181 },
    { station_name: '' }, { id: '12' }, { state: null },
  ]) assert.equal(normalizeStation(station(1, overrides)), null, JSON.stringify(overrides));
});

test('never invents power from charger counts or missing and invalid kW values', () => {
  for (const power_kw of [null, '150', 0, -1, 6000]) {
    const result = normalizeStation(station(1, {
      ev_dc_fast_num: 20, ev_charging_units: [{ connectors: { J1772COMBO: { port_count: 2, power_kw } } }],
    }));
    assert.equal(result.maxPowerKw, null);
  }
});

test('rejects truncated batches, duplicate IDs, empty data, and malformed saved files', () => {
  for (const invalid of [null, {}, { total_results: 2, fuel_stations: [station()] },
    payload([]), payload([station(1), station(1)]), { ...payload(), errors: ['provider error'] }]) {
    assert.throws(() => buildChargerDataset(invalid, RETRIEVED_AT));
  }
  for (const patch of [{ schemaVersion: 2 }, { stationCount: 100 }, { coverage: 'all' },
    { retrievedAt: 'invalid' }, { sourceUrl: 'https://untrusted.test' }]) {
    assert.throws(() => validateChargerDataset({ ...dataset(), ...patch }));
  }
  const invalid = dataset();
  invalid.stations[0].latitude = '41.88';
  assert.throws(() => validateChargerDataset(invalid));
});

test('radius searches filter the exact circle for 1, 5, 10, and 25 miles', () => {
  const search = createChargerSearch(dataset([
    station(1, { latitude: 0.05, longitude: 0 }), station(2, { latitude: 0.1, longitude: 0 }),
    station(3, { latitude: 0.3, longitude: 0 }), station(4, { latitude: 0.5, longitude: 0 }),
    station(5, { latitude: 0.05, longitude: 1 }),
    station(6, { latitude: 0.01, longitude: 0 }),
  ]));
  for (const [radius, expected] of [[1, ['afdc/6']], [5, ['afdc/6', 'afdc/1']], [10, ['afdc/6', 'afdc/1', 'afdc/2']], [25, ['afdc/6', 'afdc/1', 'afdc/2', 'afdc/3']]]) {
    const response = search({ latitude: 0, longitude: 0 }, radius);
    assert.deepEqual(response.chargers.map(item => item.id), expected);
    assert.equal(response.total, expected.length);
    assert.equal(response.radius, radius);
  }
});

test('reports total matches while returning only the nearest 30 with source and freshness', () => {
  const search = createChargerSearch(dataset(Array.from({ length: 45 }, (_, i) => station(i + 1, { latitude: 41.88 + i * 0.001 }))));
  const result = search({ latitude: 41.88, longitude: -87.63 }, 5, Date.parse(RETRIEVED_AT) + 86400000);
  assert.equal(result.total, 45);
  assert.equal(result.chargers.length, 30);
  assert.deepEqual(result.chargers.slice(0, 2).map(item => item.id), ['afdc/1', 'afdc/2']);
  assert.equal(result.chargers[0].distanceMiles, 0);
  assert.equal(result.chargers[0].detailsUrl, 'https://afdc.energy.gov/stations/#/station/1');
  assert.equal(result.source, 'AFDC');
  assert.equal(result.coverage, 'US');
  assert.equal(result.retrievedAt, RETRIEVED_AT);
  assert.equal(result.stale, false);
  assert.equal(search({ latitude: 41.88, longitude: -87.63 }, 5, Date.parse(RETRIEVED_AT) + 3 * 86400000).stale, true);
});

test('finds stations across the antimeridian and near a pole', () => {
  const search = createChargerSearch(dataset([
    station(1, { latitude: 0, longitude: -179.99 }),
    station(2, { latitude: 89.999, longitude: -120 }),
  ]));
  assert.equal(search({ latitude: 0, longitude: 179.99 }, 5).chargers[0].id, 'afdc/1');
  assert.equal(search({ latitude: 89.999, longitude: 120 }, 5).chargers[0].id, 'afdc/2');
  assert.ok(distanceMiles({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 }) > 12000);
});
