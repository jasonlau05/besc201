# Group 9 — EV comparison guide

A BESC 201 web project that helps users explore electric-vehicle carbon emissions, energy costs, and electricity prices. The app has a React/Vite frontend and a small Express backend that retrieves residential electricity rates from the US Energy Information Administration (EIA).

The home page introduces the project’s problem statement. The EV guide compares carbon and energy costs, with real EIA state electricity-rate data when an API key is configured.

## Pages and features

| Route | Purpose | Data |
| --- | --- | --- |
| `/` | Problem statement explaining the project’s purpose | Static project overview |
| `/info` | Carbon break-even simulator, annual energy-cost comparison, state electricity prices, and environmental context | Calculated estimates plus live EIA monthly averages |

### Carbon break-even simulator

Adjust EV manufacturing emissions, EV energy use, and gas-car fuel economy. The simulator plots estimated cumulative emissions through 150,000 miles and reports the break-even distance and approximate years.

Current controls:

- EV manufacturing: 4–25 tonnes CO₂e; default 12.
- EV energy use: 20–50 kWh per 100 miles; default 30.
- Gas-car efficiency: 15–60 MPG; default 30.
- Annual driving: fixed at **13,662 miles**, the project’s selected US-average driving assumption.

MPG and EV energy use are shared with the energy-cost calculator. Changing either updates both comparisons.

### Annual energy-cost comparison

Compare annual electricity and gasoline spending with editable prices and vehicle efficiency. The calculation uses the same fixed annual mileage.

The dollar difference is **red when an EV costs less** and **green when it costs more**, matching the requested design. This is an energy-cost comparison, not a total cost-of-ownership calculation.

### Electricity by location

Select any US state or Washington, DC to retrieve the latest available monthly residential price and up to 12 observations. The page shows the reporting month, monthly history, and estimated electricity cost per 100 miles. Apply the selected state average directly to the cost calculator.

These are **monthly state averages**, not address-specific utility rates, hourly forecasts, or public-charging prices.

## Technology

- React 19 and Vite 8 for the frontend.
- Plain CSS and SVG charts; no charting library.
- Express 5, CORS, and dotenv for the backend.
- EIA Open Data API v2 for electricity prices.
- Node’s built-in test runner for calculation and API tests.
- Vercel Services configuration for the frontend and backend deployment.

## Requirements

- Node.js **20.19+ within Node 20**, or **22.12+**. Node 22 is a straightforward choice.
- npm, normally installed with Node.js.
- An EIA API key for the state-rate lookup. The problem statement and calculators work without it.

Check your installation:

```sh
node --version
npm --version
```

## Local setup

Run commands from the repository root unless a different directory is shown. Frontend and backend dependencies are installed separately; there is no root npm workspace or start script.

### 1. Install dependencies

```sh
cd client
npm ci
cd ../server
npm ci
cd ..
```

### 2. Configure the EIA key

Register for a key at [EIA Open Data](https://www.eia.gov/opendata/). Create a file named `server/.env` with:

```dotenv
EIA_API_KEY=your_actual_eia_api_key
PORT=5000
```

Replace the example value with your key. The backend explicitly loads `server/.env`, regardless of the directory from which it starts. A root or client `.env` file will not supply the backend key through this loader.

Environment variables already set in the server process take precedence over dotenv values. Restart the server after changing its environment.

| Variable | Required | Purpose |
| --- | --- | --- |
| `EIA_API_KEY` | For EIA requests | Server-side EIA credential |
| `PORT` | No | Local backend port; defaults to 5000 |

Do not prefix the key with `VITE_`: Vite-prefixed variables can be included in the browser bundle. Keep the key in the server environment. The repository ignores `.env` and `.env.*` files, with an exception for optional example files.

### 3. Start the backend

In one terminal:

```sh
cd server
npm run dev
```

This runs nodemon, which reloads the backend when watched source files change. The default address is [http://localhost:5000](http://localhost:5000).

For a server process without automatic reload:

```sh
npm start
```

### 4. Start the frontend

In a second terminal:

```sh
cd client
npm run dev
```

Open the URL printed by Vite, normally [http://localhost:5173](http://localhost:5173). The guide is at [http://localhost:5173/info](http://localhost:5173/info).

Vite proxies `/api` requests to `http://localhost:5000`. If the backend port changes, update the proxy in `client/vite.config.js` too. The proxy applies to the development server; it does not deploy the backend or automatically configure production hosting.

## Build and checks

### Frontend production build

```sh
cd client
npm run build
```

The build writes static assets to `client/dist`.

To inspect the frontend build locally:

```sh
npm run preview
```

Vite’s preview command serves the static frontend. The EIA lookup needs a working same-origin API route; the development proxy is not automatically a production or preview API setup.

### Tests

From the repository root:

```sh
node --test client/src/carbon-model.test.mjs
node --test server/src/electricity-rates.test.js
```

The carbon tests cover unit conversion, curve intersection, MPG effects, fixed annual mileage, and no-break-even cases. API tests mock EIA responses and cover validation, missing credentials, normalization, caching, failures, and avoiding credential echoes. They do not require an EIA key or make live API calls.

The backend’s `npm test` command is still a placeholder; use the direct Node command above.

An optional frontend lint command is available:

```sh
cd client
npm run lint
```

Lint is separate from the production build.

## API reference

### GET /api/health

Returns:

```json
{ "status": "ok" }
```

### GET /api/electricity-rates?state=TX

Accepts a two-letter state abbreviation or `DC`. Lowercase abbreviations are converted to uppercase.

Illustrative success response:

```json
{
  "state": "TX",
  "sector": "Residential",
  "unit": "cents per kWh",
  "period": "2026-07",
  "price": 15.88,
  "history": [
    { "period": "2026-07", "price": 15.88 },
    { "period": "2026-06", "price": 15.94 }
  ],
  "source": "https://www.eia.gov/opendata/"
}
```

The values above demonstrate the response format; they are not a promise of current prices. `history` is sorted newest first, and the top-level price comes from the newest valid observation.

| Status | Meaning |
| --- | --- |
| 200 | Valid residential data returned |
| 400 | Missing or invalid state |
| 503 | EIA key absent or still set to the placeholder |
| 502 | Upstream request failed, timed out, or returned no acceptable observations |

### EIA request and processing

The server queries:

```text
https://api.eia.gov/v2/electricity/retail-sales/data/
```

It requests monthly frequency, the price field, the selected state, residential sector `RES`, descending period order, and up to 12 rows.

Returned rows must match the state and sector, have a YYYY-MM period, contain a positive numeric price, and use EIA’s unit string **`cents per kilowatt-hour`**. The handler converts price strings to numbers.

Successful results are cached per state for one hour in memory. Cache state is lost when the process restarts and is not shared across deployment instances. Upstream requests have a 10-second timeout.

The server returns only normalized fields. It does not forward EIA’s raw response, whose request metadata can echo the API key.

## Calculator assumptions and formulas

Constants and carbon calculations live in `client/src/carbon-model.mjs`.

| Assumption | Value | Context |
| --- | --- | --- |
| Annual driving | 13,662 miles | Fixed project assumption |
| Gas-car manufacturing | 8 tonnes CO₂e | ICCT gasoline SUV benchmark, not an average of every car |
| Grid intensity | 367 g CO₂/kWh | Rounded EIA 2023 US utility-scale average |
| Gasoline tailpipe factor | 8,887 g CO₂/gallon | EPA conversion factor |

### Carbon

```text
EV driving emissions (g/mile) = EV kWh/100 miles × grid g/kWh ÷ 100
Gas driving emissions (g/mile) = 8,887 ÷ gas MPG

Manufacturing difference (g) = (EV tonnes − gas tonnes) × 1,000,000
Driving advantage (g/mile) = gas emissions − EV emissions

Break-even miles = manufacturing difference ÷ driving advantage
Break-even years = break-even miles ÷ 13,662
```

When EV manufacturing starts at or below the gas-car baseline, the simulator reports “Lower from the start.” That describes the initial footprint; higher EV driving emissions can reverse that advantage later.

When EV production starts higher and its driving emissions are equal to or greater than the gas car’s, it reports “No break-even.” For example, **12 tonnes EV manufacturing, 50 kWh/100 miles, and 60 MPG** produces this result.

The chart ends at 150,000 miles. A calculated intersection beyond that distance is reported numerically but is not visible within the chart.

This is a simplified comparison of two newly manufactured cars. It combines manufacturing CO₂e estimates with operating CO₂ estimates and excludes upstream fuel emissions, electricity delivery losses, battery replacements, and end-of-life impacts. It does not assess whether to keep an existing vehicle, and it is not a complete lifecycle analysis.

### Energy cost

```text
Annual EV cost = miles × kWh/100 miles ÷ 100 × electricity cents/kWh ÷ 100
Annual gas cost = miles ÷ MPG × gas dollars/gallon
Difference = annual gas cost − annual EV cost
```

A positive difference means EV energy costs less. Prices are editable assumptions unless a state rate is applied. Use vehicle electricity consumption that includes charging losses.

## Vercel deployment

The repository-root `vercel.json` uses Vercel Services to build and route two services:

| Service | Root | Framework |
| --- | --- | --- |
| client | client | Vite |
| server | server | Express |

Import the repository as a Vercel project using the **repository root**, rather than only `client`, so the top-level services configuration is included. Configure `EIA_API_KEY` in the deployed server environment for the deployment environments you use, then deploy or redeploy.

Routing works in two stages:

1. Top-level `/api/(.*)` requests go to the server service.
2. Other requests go to the client service, which has an SPA rewrite to `/index.html`.

The client fallback lets a direct visit or refresh at `/info` load React. It does not replace the API route. The Express app exports its application instance for deployment and listens on a port when started directly.

After deployment, check:

- `/` loads the problem statement.
- `/info` loads directly and survives a browser refresh.
- `/api/health` returns the health JSON.
- `/api/electricity-rates?state=TX` returns prices when the server key is configured.

Deployment configuration changes and environment changes require a new deployment. Local tests do not confirm that the published Vercel deployment has picked up the changes.

Relevant documentation: [Vercel Services](https://vercel.com/docs/services), [service routing](https://vercel.com/docs/services/routing), and [Vite SPA deep links](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas).

## Troubleshooting

### “Electricity rates are not configured yet”

Check that `EIA_API_KEY` exists in `server/.env` locally or in the deployed server environment. It must not be empty or equal to `replace_with_your_eia_key`. Restart locally or redeploy after updating it.

### “No residential price data is currently available”

The request returned no rows that passed the handler’s filters. Check the state, reporting periods, prices, and units in a sanitized response. EIA currently returns `cents per kilowatt-hour`; using `cents per kilowatthour` rejects valid rows.

Do not print the complete upstream response or request URL, because it can expose the key. Restart the backend after changing the handler, or redeploy the updated code.

### “EIA rates are temporarily unavailable”

Check key validity, backend network access, and EIA availability. The message also covers upstream errors, non-JSON responses, and the 10-second timeout. Retry after resolving the cause.

### /info returns Vercel 404

Confirm that the latest root `vercel.json` is deployed and includes the rewrite inside `services.client`. The frontend service must serve `/index.html` for SPA paths. Confirm Vercel is deploying from the repository root.

### API request returns HTML or fails to connect

Make sure the backend is running and the Vite proxy targets its port. On deployment, confirm `/api` routes to Express rather than to the frontend SPA fallback.

### npm cannot find npm-cli.js on Windows

This indicates a local npm installation or path problem. Repair the Node/npm installation. If dependencies are already installed, the frontend build can be invoked directly in PowerShell:

```powershell
cd client
& .\node_modules\.bin\vite.cmd build
```

This bypasses npm for the build only; it does not install dependencies.

## Project structure

```text
.
├── README.md
├── vercel.json
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── App.jsx                    # Problem statement and /info page selection
│       ├── App.css                    # Shared styles
│       ├── Info.jsx                   # EV guide and cost calculation
│       ├── Info.css                   # Guide styles
│       ├── CarbonSimulator.jsx        # Carbon controls and SVG chart
│       ├── carbon-model.mjs           # Constants and calculation functions
│       ├── carbon-model.test.mjs      # Carbon tests
│       └── ElectricityRates.jsx       # EIA lookup, history, and apply-rate action
└── server/
    ├── package.json
    ├── README.md
    ├── .env                          # Local key; ignored by Git
    └── src/
        ├── index.js                  # Express routes and environment loading
        ├── electricity-rates.js      # EIA request, filtering, cache, and errors
        └── electricity-rates.test.js # Mocked API tests
```

## Sources

- [US EPA: Electric Vehicle Myths](https://www.epa.gov/greenvehicles/electric-vehicle-myths)
- [US EPA: Your Car vs. an Electric Vehicle](https://www.epa.gov/greenvehicles/comparison-your-car-vs-electric-vehicle)
- [EIA: CO₂ per kilowatthour of US generation](https://www.eia.gov/tools/faqs/faq.php?id=74&t=11)
- [ICCT: Why EVs are already greener](https://theicct.org/why-evs-are-already-much-greener-than-combustion-engine-vehicles-jul25/)
- [DOE: Electric Vehicle Benefits and Considerations](https://afdc.energy.gov/fuels/electricity-benefits)
- [EIA Open Data](https://www.eia.gov/opendata/)
- [EIA API documentation](https://www.eia.gov/opendata/documentation.php)
- [The Electric Car Scheme: Environmental overview](https://www.electriccarscheme.com/blog/are-electric-cars-really-better-for-the-environment) — UK-focused supplementary reading.

## Current limitations

The home page is a static problem statement. The EV guide uses estimates and state-average rates; it does not geocode addresses, retrieve utility-specific tariffs, or recommend actual charging windows.

The app has no accounts, EV charger integration, actual charge scheduling, database, or total ownership-cost model. Calculator inputs reset on reload. State-rate data can lag the current month, and the national carbon baseline does not reflect individual locations.

Possible future improvements include actual utility time-of-use data, persistent charging plans, model-specific efficiency and manufacturing estimates, local grid emissions, and a fuller ownership-cost comparison.
