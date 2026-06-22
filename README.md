# D2 Collections

A static Destiny 2 exotic collection tracker for Corey and Matt.

The live app is intended to run from `index.html` on GitHub Pages.

## Design goals

- Manual-first: no Bungie API required for checklist state.
- Easy to edit: exotic catalog and player checklist are plain JavaScript data files.
- Dense but readable: weapons show ownership plus catalyst status; armor is split into Warlock and Titan panels.
- Future-ready: `index.html` can later become the Bungie OAuth/API entry point without replacing the UI.

## Files

- `index.html` — main GitHub Pages entry point.
- `assets/styles.css` — full UI styling.
- `assets/app.js` — rendering, filters, progress, import/export, and local checklist edits.
- `data/catalog.js` — exotic weapon and armor catalog.
- `data/checklist.js` — manually editable Corey/Matt checklist state.

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

The app also lets you tick boxes in the browser. Those changes are saved to `localStorage` and can be exported as JSON from the page.
