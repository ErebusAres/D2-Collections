# D2 Collections

A static Destiny 2 exotic collection tracker for Corey and Matt.

The live app is intended to run from `index.html` on GitHub Pages.

## Design goals

- Repo-backed truth: the checklist displays from `data/checklist.js`, so every computer sees the same status after the repo updates.
- No fake sync: GitHub Pages is static, so the visible board uses static status icons instead of browser-only checkboxes.
- Dense but readable: weapons show ownership plus catalyst status; armor is split into Corey Warlock and Matt Titan panels.
- Easy to edit: exotic catalog and player checklist are plain JavaScript data files.
- Icon-ready: catalog entries can include Bungie/CDN icon paths through `icon` or `iconUrl`; fallback initials display when no icon exists.
- Future-ready: `index.html` can later become the Bungie OAuth/API entry point without replacing the UI.

## Files

- `index.html` — main GitHub Pages entry point.
- `assets/styles.css` — full UI styling.
- `assets/app.js` — rendering, filters, progress, export, static status icons, icon rendering, and Bungie login scaffolding.
- `data/catalog.js` — exotic weapon and armor catalog.
- `data/checklist.js` — manually editable Corey/Matt checklist state.
- `data/bungie-config.js` — Bungie OAuth/client config, including the API key used by the static GitHub Pages app.

## Manual checklist editing

Open `data/checklist.js` and change booleans for each player.

For weapons:

```js
"sunshot": {
  corey: { owned: true, catalyst: true, complete: true, equipped: false },
  matt:  { owned: true, catalyst: false, complete: false, equipped: false }
}
```

For armor:

```js
"hallowfire-heart": {
  corey: { owned: false, equipped: false },
  matt:  { owned: true, equipped: true }
}
```

Status icons shown by the app:

- `✅` — owned / obtained / complete
- `⛔` — missing / not obtained / incomplete
- `⭐` — marked equipped or currently used
- `—` — not marked equipped

## Item icons

Add an `icon` or `iconUrl` field to any catalog item.

```js
{ id: "sunshot", name: "Sunshot", icon: "/common/destiny2_content/icons/example.jpg", slot: "Energy", type: "Hand Cannon", element: "Solar", source: "World drop" }
```

Relative Bungie paths starting with `/` are automatically rendered from `https://www.bungie.net`. If no icon is available, the app shows a compact initials tile.

## Bungie API setup

The app bundles the Bungie API key in `data/bungie-config.js` so GitHub Pages can call Bungie without prompting every browser for a key. OAuth still requires each player to sign in with Bungie before dumping account collection data.

Current public OAuth config:

```js
clientId: "53180"
authUrl: "https://www.bungie.net/en/OAuth/Authorize"
tokenUrl: "https://www.bungie.net/Platform/App/OAuth/Token/"
```

The login button builds the Bungie OAuth URL and captures the returned `code` locally. The dump flow exchanges that code for a token, pulls the logged-in account memberships/profile collections, and writes the JSON dump into the API handoff box.

## Cross-device sync options

GitHub Pages cannot save checklist changes by itself because it serves static files. Possible future sync paths:

1. Manual repo update: export data, send it to GPT, and commit `data/checklist.js` updates.
2. GitHub write-back: use a GitHub OAuth/PAT flow to commit checklist updates from the browser. This is powerful but should be handled carefully.
3. Small backend/database: Firebase, Supabase, Cloudflare Worker, or similar.

For now, the app intentionally uses repo data as the shared source of truth.
