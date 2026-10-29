# Group 9 — EV comparison guide

A BESC 201 web project that helps users explore electric-vehicle carbon emissions, energy costs, and electricity prices. The app has a React/Vite frontend and a small Express backend that serves one shared, saved dataset of residential electricity rates from the US Energy Information Administration (EIA).

The home page introduces the project’s problem statement. Learn explains EV basics, and the EV guide compares carbon and energy costs with saved EIA state electricity-rate data. A floating EV assistant uses OpenRouter through the backend. A daily GitHub Action updates the electricity dataset; visitor requests never call EIA.

## Pages and features

| Route | Purpose | Data |
| --- | --- | --- |
| `/` | Problem statement explaining the project’s purpose | Static project overview |
| `/learn` | EV basics, vehicle types, charging, environmental tradeoffs, and FAQs | EPA and DOE educational sources |
| `/info` | Carbon break-even simulator, annual energy-cost comparison, state electricity prices, and environmental context | Calculated estimates plus saved EIA monthly averages |

### EV assistant

The chatbot’s answer guidance lives in `server/context.txt`. Edit it to change tone, topic boundaries, or website context, then restart the backend or redeploy. By default, replies are usually 2-4 sentences (40-80 words) and loosely related to EVs, driving, energy, or sustainability.

A small fixed circle at the bottom right opens the EV assistant on every page. It supports suggested questions, follow-up context, loading feedback, retry, minimizing, Escape to close, and a new-conversation button. Completed chat messages stay in the current tab’s sessionStorage across page navigation; a new conversation clears them. The server does not save chat logs. Questions and recent conversation context are sent to OpenRouter and its model provider when submitted; AI answers can be inaccurate.

The Express backend owns the system prompt and API key and always requests `openrouter/free`, with no paid-model fallback. Requests have message and history limits, a 35-second provider timeout, a 700-token output limit, and per-instance request/concurrency limits. Free-model availability and OpenRouter quotas still apply. For a public deployment, configure hosting-level abuse protection: in-memory limits reset on cold starts and are not shared across server instances.

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

The page fetches all 50 states and DC together once. Selecting a state is then an instant lookup in that dataset, with no state-change network request. The daily updater saves up to 12 monthly observations per state. The page shows the reporting month, monthly history, and estimated electricity cost per 100 miles. Apply the selected state average directly to the cost calculator.

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
- No EIA key is required to run the site or read saved rates. An EIA key is needed only for the daily refresh job.

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

### 2. Optional local environment

The site serves the committed `server/data/electricity-rates.json` and does not need an EIA key. You may create `server/.env` to override `PORT=5000`. The development proxy must use the same port.

The EIA key belongs in the GitHub Actions repository secret described below. Do not put it in client code or a `VITE_` variable. Existing server EIA environment variables are no longer used for visitor requests.

To enable the EV assistant, add this entry to the existing `server/.env`:

```dotenv
OPENROUTER_API_KEY=your_openrouter_key
```

Restart the backend after changing the key. Keep it server-only; never use a `VITE_` variable. Without a key, the site and Learn content still work, and chat shows that the assistant is not connected. The model is fixed to [OpenRouter’s free router](https://openrouter.ai/openrouter/free), which selects available free models. Account defaults and `OPENROUTER_MODEL` environment values cannot select a paid model. Free usage remains subject to OpenRouter’s quotas and model availability. The integration uses the chat completions HTTP API and does not require the TypeScript SDK.

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
node --test client/src/carbon-model.test.mjs client/src/electricity-rates-client.test.mjs client/src/ev-chat.test.mjs
node --test server/src/electricity-rates.test.js server/src/ev-chat.test.js server/scripts/refresh-electricity-rates.test.mjs
```

Tests cover carbon math, all-state browser caching and lookups, credential-free saved-data serving, batch validation, atomic file updates, network failures, incomplete responses, and HTTP 429 preservation. All use local fixtures or mocked EIA responses. They do not need an EIA key or make live EIA requests.

The backend’s `npm test` command is still a placeholder; use the direct Node command above.

Chat tests use a mocked provider, with no real API key, external requests, or credit use. They cover follow-up context, input validation, error redaction, rate limits, timeouts, disconnect cancellation, and browser history limits.

An optional frontend lint command is available:

```sh
cd client
npm run lint
```

Lint is separate from the production build.

## Daily shared-data refresh

The workflow in [`.github/workflows/refresh-electricity-rates.yml`](.github/workflows/refresh-electricity-rates.yml) runs daily at **11:23 UTC** (6:23 AM CDT / 5:23 AM CST). It also supports **Actions → Refresh state electricity rates → Run workflow**.

### Enable it

1. Push the workflow and code changes to the repository’s default branch.
2. In GitHub, open **Settings → Secrets and variables → Actions → New repository secret**.
3. Name the secret **`EIA_API_KEY`** and paste your EIA key as its value.
4. Enable GitHub Actions and allow the workflow’s `contents: write` permission. Repository rules or branch protection must permit the bot’s data-only commit.
5. When the rate limit clears, let the schedule run or trigger it manually. No initial EIA fetch is required to serve the existing saved data.

GitHub schedules run from the default branch and can be delayed; they are not exact-time guarantees. The workflow checks out that branch, tests the updater, requests one batch, and commits only the generated JSON file. It never force-pushes. If branch protection blocks the push, the job fails and the deployed data is unchanged; allow the bot through your repository policy or adopt a reviewed data-update PR workflow.

### Batch and persistence

`server/scripts/refresh-electricity-rates.mjs` uses EIA API v2 with monthly frequency, residential sector `RES`, the price field, all 51 state/DC facets, a two-year date window, and a 5,000-row limit. This is one successful API request per daily run, rather than one request per visitor or state selection.

The updater requires 12 valid, distinct observations for every state and the same newest reporting month across locations. It rejects truncated results, invalid units, incomplete coverage, conflicting rows, and backward-moving dates. Only normalized public data is saved; raw request metadata and the key are never written or logged.

A complete candidate is written to a temporary file and atomically replaces `server/data/electricity-rates.json`. Network failures or 5xx responses get at most one retry after two seconds; each attempt has a 45-second timeout. **HTTP 429 is not retried.** A failed or throttled refresh leaves the previous saved file untouched.

The committed seed contains previously verified **July 2026** residential values for all 50 states and DC from EIA Table 5.6.A, retrieved October 16, 2026. It has one observed month per state, explicitly labeled as a reference snapshot. The first successful scheduled batch replaces it with 12 months of history. No new EIA fetch was required to seed it.

### Publish refreshed data

The workflow pushes the data commit to the default branch. Vercel must deploy that commit before the site uses the new JSON. With the repository connected, check that the bot’s commits trigger your Vercel Git deployment and that the backend service is included. If your deployment policy skips bot commits, configure that integration or redeploy the updated commit. This workflow refreshes and commits data; it does not use a Vercel token or directly invoke a production deployment.

For an intentional manual refresh outside GitHub, export `EIA_API_KEY` in that process and run:

```sh
node server/scripts/refresh-electricity-rates.mjs
```

This command makes real EIA requests. It does not automatically load a local `.env` file, and it should not be run repeatedly while rate-limited.

## API reference

### POST /api/chat

Accepts `{ "messages": [{ "role": "user", "content": "How does an EV work?" }] }` and returns `{ "reply": "..." }`. Send alternating user/assistant history ending with the new user question. The endpoint accepts up to 15 messages, 1,000 characters per user question, 4,000 per assistant reply, and 16,000 total characters. It prepends a server-owned EV education prompt and calls OpenRouter with the server’s credentials. Client-supplied system messages are rejected.

Responses use `Cache-Control: no-store`. Errors return `{ "error": "..." }`: 400 for invalid input, 429 for throttling, 503 for missing configuration, 502 for provider/network failures, and 504 for timeout. Raw provider errors and credentials are never returned. Every request explicitly selects `openrouter/free`; provider failures return an error instead of falling back to a paid model.

### GET /api/health

Returns `{ "status": "ok" }`.

### GET /api/electricity-rates

Returns the complete saved dataset for all 50 states and DC:

```text
{
  schemaVersion: 1,
  kind: "reference" or "scheduled",
  sector: "Residential",
  unit: "cents per kWh",
  retrievedAt: original snapshot/refresh timestamp,
  source: EIA source URL,
  states: {
    TX: { period: "YYYY-MM", price: number, history: [{ period, price }, ...] },
    ...all other states and DC
  },
  stale: boolean
}
```

History is newest first. The file’s reporting months and retrieval timestamp are preserved; serving it does not make old observations appear newly fetched. Data older than 48 hours since retrieval is labeled as potentially delayed but remains usable.

### GET /api/electricity-rates?state=TX

Optional compatibility route: returns only that state from the same saved file. It does not contact EIA. Lowercase codes and surrounding whitespace are normalized; invalid codes receive HTTP 400 with `Cache-Control: no-store`.

### Cache behavior

The server loads and validates the committed JSON at startup; no EIA credential is needed. Responses carry `X-Rate-Cache: SAVED`, five minutes of browser HTTP caching, one hour of CDN caching, and one day of stale-while-revalidate.

The browser loads the whole dataset once per guide visit and shares in-flight requests, including React StrictMode remounts. It saves one dataset entry in sessionStorage and memory with a 15-minute revalidation window. State changes only call a local lookup; they do not trigger revalidation or EIA requests. An explicit “Reload saved data” reloads the saved API response, not EIA. If the application server is unavailable, previously loaded data is retained and labeled stale; an uncached first visit needs the server to be reachable.

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

Import the repository as a Vercel project using the **repository root**, rather than only `client`, so the top-level services configuration is included. No EIA key is required in Vercel. Deploy both services and keep the saved JSON file included in the server service.

For chat, add `OPENROUTER_API_KEY` to the **server service’s runtime environment** in Vercel, then redeploy. The server always uses `openrouter/free`; no model environment variable is needed. Local `.env` files are ignored by Git and do not configure production. `/api/chat` uses the existing API routing; `/learn` uses the existing SPA fallback.

Routing works in two stages:

1. Top-level `/api/(.*)` requests go to the server service.
2. Other requests go to the client service, which has an SPA rewrite to `/index.html`.

The client fallback lets a direct visit or refresh at `/info` load React. It does not replace the API route. The Express app exports its application instance for deployment and listens on a port when started directly.

After deployment, check:

- `/` loads the problem statement.
- `/learn` loads directly, survives refresh, and appears between Problem statement and EV guide in navigation.
- The bottom-right assistant expands, sends a question after the key is configured, and can be minimized.
- `/info` loads directly and survives a browser refresh.
- `/api/health` returns the health JSON.
- `/api/electricity-rates` returns all 51 saved locations, and state changes require no further request.

Deployment configuration changes and environment changes require a new deployment. Local tests do not confirm that the published Vercel deployment has picked up the changes.

Relevant documentation: [Vercel Services](https://vercel.com/docs/services), [service routing](https://vercel.com/docs/services/routing), and [Vite SPA deep links](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas).

## Troubleshooting

### Scheduled refresh fails

Check the Actions log and the `EIA_API_KEY` repository secret. HTTP 429 means the key is throttled: wait for the next daily run rather than repeatedly retrying. Incomplete or invalid batches are rejected and the last good JSON is preserved.

If the push is rejected, check repository permissions, branch protection, and concurrent commits. The workflow does not force-push or overwrite other work.

### Rates do not change after a successful refresh

Check the data commit in the default branch and the deployed commit SHA in Vercel. The JSON is read at server startup, so a new deployment (or local server restart) is needed to load it. Browser session data can be revalidated using “Reload saved data”; “Last fetched” shows the stored retrieval date.

### The page shows an old per-state EIA error

The current API never calls EIA and does not require an EIA key. Seeing an old configuration or rate-limit error indicates an older server deployment. Deploy the updated server and client together.

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
├── .github/workflows/refresh-electricity-rates.yml # Daily batch job
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── App.jsx                    # Problem statement, /learn, /info, and shared chat
│       ├── App.css                    # Shared styles
│       ├── Learn.jsx                  # EV learning page with EPA/DOE sources
│       ├── Learn.css                  # Learning page styles
│       ├── EvChat.jsx                 # Expandable floating EV assistant
│       ├── EvChat.css                 # Responsive chat styles
│       ├── ev-chat.mjs                # Chat requests and tab session history
│       ├── Info.jsx                   # EV guide and cost calculation
│       ├── Info.css                   # Guide styles
│       ├── CarbonSimulator.jsx        # Carbon controls and SVG chart
│       ├── carbon-model.mjs           # Constants and calculation functions
│       ├── carbon-model.test.mjs      # Carbon tests
│       └── ElectricityRates.jsx       # EIA lookup, history, and apply-rate action
└── server/
    ├── package.json
    ├── README.md
    ├── .env                          # Local port and OpenRouter key; ignored by Git
    ├── context.txt                   # Chatbot answer style, EV focus, and website context
    ├── data/electricity-rates.json     # Shared, persistent all-state dataset
    ├── scripts/refresh-electricity-rates.mjs # Scheduled batch updater
    └── src/
        ├── index.js                  # Express routes and environment loading
        ├── ev-chat.js                # Validated, rate-limited OpenRouter endpoint
        ├── ev-chat.test.js           # Chat API tests with a mocked provider
        ├── electricity-rates.js      # Saved dataset serving; no EIA calls
        └── electricity-rates.test.js # Saved-data API tests
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
