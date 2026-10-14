# EIA electricity rates

Copy `.env.example` to `.env` in this directory and set `EIA_API_KEY` to your key. The `.env` file is ignored by Git. Do not use a `VITE_` environment variable for the key; those variables are exposed to browsers.

Start the server with `npm run dev` in `server`, then run `npm run dev` in `client`. Vite proxies `/api` to port 5000. If you change the server port, update the proxy target too.

For deployment, set `EIA_API_KEY` as a server environment variable and route `/api/electricity-rates` to this Express app. The browser only calls that same-origin endpoint. The app exports its Express instance for platforms that support Express deployments.

The endpoint accepts a two-letter US state or DC, requests the latest 12 monthly residential price observations from EIA API v2, and returns prices in cents/kWh with reporting periods. Responses are cached in memory for one hour. These are state averages, not utility tariffs, address-specific prices, or hourly forecasts.

Run API tests with `node --test src/electricity-rates.test.js`. They use mocked upstream responses and do not need a key.
