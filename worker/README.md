# D2 Collections Cloud Sync

This Worker adds an optional Cloudflare D1 backend for the static GitHub Pages site.

## What It Does

- `GET /api/snapshots` returns saved Ares/Icee collection snapshots.
- `POST /api/snapshots` verifies the current Bungie access token, maps the login to Ares/Corey or Icee/Matt, then saves ownership, catalyst, completion, and Rahool resource data.
- The browser never receives D1 credentials or a DB write secret.

## Deploy Steps

1. Sign in to Cloudflare and enable Workers.
2. Run `npm install`.
3. Run `npm run cf:d1:create`.
4. Copy `worker/wrangler.toml.example` to `worker/wrangler.toml`.
5. Put the D1 `database_id` from step 3 into `worker/wrangler.toml`.
6. Run `npx wrangler secret put BUNGIE_API_KEY --config worker/wrangler.toml` and paste the D2 Collections Bungie API key.
7. Run `npm run cf:d1:migrate`.
8. Run `npm run cf:deploy`.
9. Copy the deployed Worker URL into `data/bungie-config.js` as `cloudSyncApi`.

Cloudflare D1 is currently included on Workers Free, with daily read/write limits and a 5 GB total D1 storage allowance. If the free daily limits are exceeded, D1 returns errors until the limit resets.
