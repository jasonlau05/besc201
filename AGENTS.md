# Group9 EV comparison guide

## A. Project overview

This BESC 201 guide teaches EV basics, compares carbon and operating costs, locates US chargers and answers EV questions. It uses npm workspaces, React 19 with Vite, Three.js and Express 5. Vercel serves the browser app and API separately.

## B. Project structure

- Start at `client/index.html`, `client/src/main.jsx` and `client/src/App.jsx`. App maps paths, handles browser history, focus and scroll restoration. SiteLayout owns navigation. Problem, Learn, Info, Chargers and EvChat own the five user experiences.
- Keep page components, shared controls (GuideUI), corresponding CSS and browser API helpers in `client/src/`. Put cutaway rendering and motion under `client/src/ev-animation/`. Fonts, icons and the separate motion runtime live in `client/public/`.
- Register Express routes and application middleware in `server/src/index.js`. Keep validation, provider calls and query logic in the corresponding feature module in `server/src/`. Refresh programs belong in `server/scripts/`, snapshots in `server/data/`, shared charger fixtures in `server/test/`. Colocate tests with their modules.

## C. JavaScript coding standards

Use PascalCase JSX components and camelCase functions. Client helpers and refresh scripts use ES modules, server handlers use CommonJS. Keep calculations pure and reusable across controls. Use the existing injected clock, fetch and dataset patterns for asynchronous code. Handle timeouts and cancellations separately from invalid input. Log actionable failure context without user prompts, addresses, coordinates or credentials.

## D. Frontend development

Preserve the existing visual language unless a redesign is requested. Reuse palette tokens, RangeControl, AnimatedDetails and page layouts. Keep EV efficiency and MPG synchronized between both calculators. Document units, comparison boundaries, dates and sources when changing educational estimates.
Use relative `/api/` URLs and feature helpers. Cover loading, stale data, empty results, errors and retry. Preserve landmarks, labels, keyboard focus, mobile tabs, reduced motion and the WebGL fallback. Clean up listeners, observers, timers and renderer resources. Verify the guide remains usable on a narrow screen.

## E. Express backend

Preserve the exported app and guarded local listener. Validate request bodies and query parameters before provider calls or snapshot access. Preserve existing JSON contracts, cache headers, bounded results, provider timeouts and meaningful HTTP status codes. Enforce authorization server-side for any new sensitive operation. Treat per-process quotas and caches as local to one warm instance.

## F. Data and integrity

Persistence is committed JSON. EIA stores state/DC residential observations and history. AFDC stores normalized public stations. See `rates-dataset.js` and `charger-data.js` in `server/src/` for schema validation and the in-memory latitude index. Coordinate format changes across producers, validators, API consumers and fixtures. Preserve validated temporary-file replacement and the last good snapshot. There is no database migration runner.

## G. Security

Keep OpenRouter credentials on the server and refresh credentials in the refresh environment. Use server-owned prompt/context, bounded conversation roles and lengths, fixed provider destinations and React text rendering. Validate untrusted data on the backend. Use parameterized queries if a SQL store is introduced. Review dependency provenance and endpoint authorization before changing trust boundaries. Obtain explicit permission before any destructive production operation.

## H. Testing and commands

Run from the repository root with existing workspace dependencies. Use a clean checkout for installation. The lockfile-backed install command is `npm ci`.

| Task | Command |
|---|---|
| Start both services | `npm run dev` |
| Start separately | `npm run dev:client` and `npm run dev:server` |
| Client lint and build | `npm run lint -w client` and `npm run build -w client` |
| Full Node suite | `npm test` |
| Connected browser journeys | `npm exec -w client -- playwright install chromium webkit --only-shell`, then `npm run test:browser -w client` |
| Cutaway browser regression with dev server running | `node client/scripts/check-ev-deconstruction.mjs --url http://127.0.0.1:5173` (requires a Chrome/Edge executable at a path listed in the script and writes ignored .taste-skill artifacts) |

Add or update a regression test for changed behavior. Exercise affected UI controls, responsive layout and keyboard navigation. For API changes test successful, invalid, unavailable and applicable unauthorized requests with fixtures. Run the relevant checks and report failures or unexecuted checks explicitly.

## I. Vercel deployment

Use root `vercel.json`. Route `/api/(.*)` to the Express service before the client catch-all. Vite builds `client/dist/`. Client deep links need its index rewrite. Local Vite proxies to port 5000. Express reads `server/.env` locally and accepts `PORT`. Chat uses `OPENROUTER_API_KEY`; address search optionally accepts `NOMINATIM_URL`. For shared public geocoding on multiple instances, configure server-only `GEOCODER_REDIS_REST_URL` and `GEOCODER_REDIS_REST_TOKEN` as described in `server/README.md`. Daily workflows in `.github/workflows/` use `EIA_API_KEY` and `AFDC_API_KEY`. The charger workflow supports `VERCEL_DEPLOY_HOOK_URL`. After an authorized deployment, reload deep links directly, check health, a saved rate, nearby stations and snapshot dates against the deployed revision.

## J. Future sessions

Read this file first. Trace the affected feature before editing. Preserve established behavior, keep changes scoped and reuse dependencies. Ask when an ambiguity could materially change the outcome. Explain significant design decisions and summarize changed files, executed checks and remaining risks. Obtain permission before changing production records.

## K. Skill usage

Choose by task. Use agents-md for this file, find-bugs and code-review for regressions, security-review for trust boundaries, nodejs-backend-patterns and api-design-principles for handlers, javascript-testing-patterns for coverage, and web-design-guidelines, responsive-design and accessibility-compliance for UI work. Use vercel-optimize when project metrics are available and deploy-to-vercel for an authorized deployment.
