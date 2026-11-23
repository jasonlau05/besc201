// Serve the production bundle with local data and an isolated geocoder fixture.
const path = require('node:path');
const express = require('express');
const electricityRates = require('../../server/src/electricity-rates');
const { createChargerHandlers } = require('../../server/src/chargers');

const app = express();
const dist = path.resolve(__dirname, '../dist');
let nowTick = 0;
const geocoder = createChargerHandlers({
  now: () => (nowTick += 2000),
  fetchImpl: async () => Response.json([{ place_id: 1, lat: '41.88', lon: '-87.63', display_name: 'Chicago, Illinois' }]),
});
app.get('/api/charging-locations', geocoder.locations);
app.get('/api/chargers', geocoder.nearby);
app.get('/api/electricity-rates', electricityRates);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use(express.static(dist, { extensions: ['html'] }));
app.get('/{*path}', (_req, res) => res.status(404).sendFile(path.join(dist, '404.html')));

const server = app.listen(4189, '127.0.0.1');
function shutdown() {
  if (server.closeAllConnections) server.closeAllConnections();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.stdin.resume();
process.stdin.on('close', shutdown);
