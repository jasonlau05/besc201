# EIA electricity rates

Copy `.env.example` to `.env` in this directory and set `EIA_API_KEY` to your key. The `.env` file is ignored by Git. Do not use a `VITE_` environment variable for the key; those variables are exposed to browsers.

Start the server with `npm run dev` in `server`, then run `npm run dev` in `client`. Vite proxies `/api` to port 5000. If you change the server port, update the proxy target too.

For deployment, set `EIA_API_KEY` as a server environment variable and route `/api/electricity-rates` to this Express app. The browser only calls that same-origin endpoint. The app exports its Express instance for platforms that support Express deployments.

The endpoint accepts a two-letter US state or DC, requests the latest 12 monthly residential price observations from EIA API v2, and returns prices in cents/kWh with reporting periods. Successful responses are cached per state for six hours, with one shared in-flight request per state. The EIA query searches only the last two years. Transient failures are retried once (six seconds per attempt, 200 ms between attempts). Cache-Control headers enable browser and Vercel CDN caching, with background revalidation at the CDN. Errors are not cached. If a refresh fails, a previous successful result can be returned for up to seven days with `stale: true`; a 30-second cooldown avoids repeatedly calling an unavailable upstream. The frontend also keeps public rates in sessionStorage and labels fallback data. Responses include `fetchedAt`; the origin sends `X-Rate-Cache` for diagnostics. These are state averages, not utility tariffs, address-specific prices, or hourly forecasts.

Run API tests with `node --test src/electricity-rates.test.js`. They use mocked upstream responses and do not need a key.
