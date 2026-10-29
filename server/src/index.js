const express = require("express");
const cors = require("cors");
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });
const electricityRates = require('./electricity-rates');
const evChat = require('./ev-chat');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.get('/api/electricity-rates', electricityRates);
app.post('/api/chat', evChat);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

if (require.main === module) app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
module.exports = app;
