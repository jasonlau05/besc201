# API and saved datasets

The API serves `data/electricity-rates.json` for all 50 states and DC. It never contacts EIA while handling visitor traffic and does not need `EIA_API_KEY` at runtime.

- `GET /api/electricity-rates`: returns the complete saved dataset.
- `GET /api/electricity-rates?state=TX`: optional lookup in the same data.
- `GET /api/health`: health check.
- `POST /api/chat`: EV assistant using OpenRouter; returns `{ "reply": "..." }` or a safe `{ "error": "..." }`.
- `GET /api/chargers?lat=41.88&lng=-87.63&radius=1`: up to 30 nearby public U.S. stations from the saved AFDC dataset; supported radii are 1 (default), 5, 10, and 25 miles.
- `GET /api/charging-locations?q=Chicago`: explicitly submitted U.S. address search through Nominatim.

## Saved AFDC chargers

`data/charging-stations.json` contains only the fields the charger page uses, normalized from the DOE AFDC All Stations API. It stays in the server deployment; nearby searches load it once per warm instance, use a shared latitude index, and return only nearby records. They make no provider requests and need no AFDC key at runtime. Responses include the original retrieval timestamp, a delayed-data flag after 48 hours, and `Cache-Control: no-store`. Missing/corrupt data returns a safe 503.

For an intentional refresh, add `AFDC_API_KEY=your_key` to this directory's ignored `.env`, then run `npm run refresh:chargers` from the repository root. The script loads `.env` automatically, sends the key in an HTTP header, validates a complete public/available/U.S./electric batch, and atomically replaces the saved file. Incomplete data, authentication errors, throttling, timeouts, and suspicious coverage drops preserve the previous data. Restart the backend after refreshing, or deploy the new file for Vercel. This dataset does not provide live plug availability.

The daily `../.github/workflows/refresh-chargers.yml` uses the repository Actions secret `AFDC_API_KEY`; the local `.env` is not uploaded. It runs at 11:47 UTC and commits only the generated station file. Configure Vercel to deploy the bot's commits, or optionally set the Actions secret `VERCEL_DEPLOY_HOOK_URL` to publish after successful refreshes. Until the workflow is pushed and the secret configured, daily refreshes are not active.

Address search still uses Nominatim with explicit submissions, a per-process rate limit, bounded cache, and timeout. Use `NOMINATIM_URL` to configure another compatible geocoder. Overpass and its former environment variables are no longer used. Current-location searches bypass geocoding entirely.

Run all charger tests from the repository root with `npm run test:chargers`. Tests use local fixtures and do not contact AFDC or Nominatim. The root README documents setup, update validation, and deployment details.

## OpenRouter chat configuration

Edit `context.txt` to guide the assistant’s tone, answer length, EV topics, and website knowledge. It is loaded at server startup and sent as the system message on every chat request. The default guidance asks for 2-4 sentences, usually 40-80 words, with a loose connection to EVs. Restart the backend after editing it, or redeploy for Vercel. Keep `context.txt` included in the server deployment.

Add `OPENROUTER_API_KEY` to this directory’s existing `.env` and restart the server. Every request sends the ordered model list `dots-studio/dots-3-note-preview:free`, then `nvidia/nemotron-3.5-super-vl:free`, regardless of account defaults or `OPENROUTER_MODEL` environment values. OpenRouter uses the backup when the primary returns an error. The explicitly selected backup is a paid model and can consume OpenRouter credits. If both models fail, the app returns its existing safe error without an additional retry. In Vercel, configure the key as a server runtime environment variable and redeploy. Never place the key in client code or a `VITE_` variable.

Chat forwards recent conversation history to OpenRouter with an EV-focused system prompt. It does not persist messages on the server. Missing configuration returns 503; provider failures return a safe message without exposing upstream details. Requests are bounded, have a 35-second timeout, and use per-instance rate/concurrency limits. Free-model availability and OpenRouter quotas still apply. Use host-level abuse protection for public deployments.

Run `npm run dev` in this directory and start the client in another terminal. The default API port is 5000; `.env` can override `PORT` if the client proxy is updated too.

The daily GitHub Action at `../.github/workflows/refresh-electricity-rates.yml` uses the repository secret `EIA_API_KEY` to request one monthly residential batch for all states, validate 12 months per location, atomically update the JSON, and commit it. It runs at 11:23 UTC and can be started manually from GitHub Actions. No dependencies need installing for the updater.

A missing secret, HTTP 429, timeout, malformed response, partial state coverage, or older reporting month leaves the previous file intact. The initial file reuses the verified July 2026 reference rates; it is not a new API fetch. The JSON persists in Git rather than ephemeral server memory.

Deploy the new data commit to publish its rates. The server loads the JSON at startup; local processes need a restart after a file refresh. The frontend fetches all states once and changes selection with local lookups.

Tests (no EIA requests):

```sh
node --test src/electricity-rates.test.js src/ev-chat.test.js scripts/refresh-electricity-rates.test.mjs
```

See the root README for Actions secret configuration, repository permissions, cache behavior, data provenance, and deployment troubleshooting.
