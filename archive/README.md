# D2 Collections

A Destiny 2 exotic collection tracker for Ares/Corey and Icee/Matt.

The frontend is a static GitHub Pages site. Bungie login pulls live account collection data, applies owned weapons, armor, catalysts, completion state, Rahool material counts, and weekend Xur matches, then saves a shared snapshot through the Cloudflare Worker/D1 backend.

## Current Architecture

- `index.html` is the GitHub Pages entry point.
- `assets/app.js` renders the collection, filters, summary cards, resource counts, recent claims, and local state merge.
- `assets/bungie-collection-dump.js` handles Bungie OAuth token use and collection/profile reads.
- `assets/cloud-sync.js` reads/writes shared player snapshots through the Worker.
- `worker/src/index.js` verifies Bungie access tokens server-side before writing D1.
- `data/catalog.js`, `data/hunter-catalog.js`, and `data/year-8-catalog.js` define the item catalog.
- `data/bungie-collectible-map.js` stores bundled Bungie collectible/source/catalyst mappings.
- `data/icon-map.js` stores Bungie icon paths for every catalog item.
- `data/checklist.js` is the repo fallback seed, not the only live source of truth.

## Sync Flow

1. Player signs in with Bungie.
2. The browser exchanges/refreshes the OAuth token locally.
3. The site reads Bungie profile collections, character inventory, records, catalysts, and resources.
4. The UI applies the matched catalog ownership locally.
5. The Worker verifies the Bungie token and saves the snapshot to Cloudflare D1.
6. Other browsers load the latest saved snapshots on page load.

Cloud sync is the normal path. The export/manual tools in the gear panel are fallback/debug tools.

## Cloudflare Worker

Worker setup lives in `worker/`.

- `worker/wrangler.toml.example` is the tracked template.
- Local production config should live in `worker/wrangler.toml`.
- D1 schema is in `worker/schema.sql` and `worker/migrations/0001_initial.sql`.

Useful commands:

```powershell
npm install
npm run cf:login
npm run cf:d1:create
npm run cf:d1:migrate
npm run cf:deploy
```

The Worker needs the `BUNGIE_API_KEY` secret:

```powershell
npx wrangler secret put BUNGIE_API_KEY --config worker/wrangler.toml
```

## Bungie App

The public static config is in `data/bungie-config.js`.

Current OAuth client:

```js
clientId: "53180"
redirectUri: "https://erebusares.github.io/D2-Collections/index.html"
cloudSyncApi: "https://d2-collections-sync.erebusares.workers.dev"
```

The Bungie application must have its Origin Header set to:

```text
https://erebusares.github.io
```

## Validation

Run these after source, icon, sync, or catalog changes:

```powershell
node --check assets/app.js
node --check assets/help.js
node --check assets/cloud-sync.js
node --check assets/bungie-collection-dump.js
node --check worker/src/index.js
node tools/verify-icons.mjs
node tools/audit-help-data.mjs
node tools/audit-manifest-exotics.mjs
git diff --check
```

`tools/audit-manifest-exotics.mjs` fetches live Bungie manifest data and requires network access.

## Data Notes

- Bungie source strings are preferred when `data/bungie-collectible-map.js` provides them.
- Catalog source strings are still useful as friendly/context tags, especially when Bungie does not expose a source string.
- Items without Bungie source strings should not be marked Bungie-verified unless a real source has been checked.
- `Cull's Shadow` currently uses externally verified source confidence.
- `Wolfsbane` currently remains catalog-confidence until a reliable source confirms the Heliostat / Ash & Iron route.
