// Serve the production bundle with local data and an isolated geocoder fixture.
const path = require('node:path');
const express = require('express');
const electricityRates = require('../../server/src/electricity-rates');
const { createChargerHandlers } = require('../../server/src/chargers');

const app = express();
const dist = path.resolve(__dirname, '../dist');
const geocoder = createChargerHandlers({
  fetchImpl: async () => Response.json([{ place_id: 1, lat: '41.88', lon: '-87.63', display_name: 'Chicago, Illinois' }]),
});
app.get('/api/charging-locations', geocoder.locations);
app.get('/api/chargers', geocoder.nearby);
app.get('/api/electricity-rates', electricityRates);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use(express.static(dist));
app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
app.listen(4189, '127.0.0.1');
