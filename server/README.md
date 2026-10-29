# Shared electricity-rate dataset

The API serves `data/electricity-rates.json` for all 50 states and DC. It never contacts EIA while handling visitor traffic and does not need `EIA_API_KEY` at runtime.

- `GET /api/electricity-rates`: returns the complete saved dataset.
- `GET /api/electricity-rates?state=TX`: optional lookup in the same data.
- `GET /api/health`: health check.
- `POST /api/chat`: EV assistant using OpenRouter; returns `{ "reply": "..." }` or a safe `{ "error": "..." }`.

## OpenRouter chat configuration

Edit `context.txt` to guide the assistant’s tone, answer length, EV topics, and website knowledge. It is loaded at server startup and sent as the system message on every chat request. The default guidance asks for 2-4 sentences, usually 40-80 words, with a loose connection to EVs. Restart the backend after editing it, or redeploy for Vercel. Keep `context.txt` included in the server deployment.

Add `OPENROUTER_API_KEY` to this directory’s existing `.env` and restart the server. Every request explicitly uses `openrouter/free`, regardless of account defaults or `OPENROUTER_MODEL` environment values. There is no paid-model fallback. In Vercel, configure the key as a server runtime environment variable and redeploy. Never place the key in client code or a `VITE_` variable.

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
