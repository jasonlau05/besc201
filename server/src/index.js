const express = require("express");
const cors = require("cors");
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });
const electricityRates = require('./electricity-rates');
const evChat = require('./ev-chat');
const { createChargerHandlers } = require('./chargers');

const { createGeocoderLimit } = require('./geocoder-limit');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.get('/api/electricity-rates', electricityRates);
app.post('/api/chat', evChat);
const chargers = createChargerHandlers({
  reserveGeocode: createGeocoderLimit({
    url: process.env.GEOCODER_REDIS_REST_URL,
    token: process.env.GEOCODER_REDIS_REST_TOKEN,
  }),
});
app.get('/api/charging-locations', chargers.locations);
app.get('/api/chargers', chargers.nearby);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

if (require.main === module) app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
module.exports = app;
