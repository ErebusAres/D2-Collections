# Guardian Nexus

Guardian Nexus is a desktop-first Destiny 2 companion for personal Exotic collections, quest progress, opt-in fireteam coordination, and three-Guardian collection comparison.

This is a greenfield application. The prior D2 Collections implementation is preserved under `archive/` for historical API and feature reference only. Active code must never import or read archived source or assets.

## Workspace

- `apps/web` — React and TypeScript interface deployed to Cloudflare Pages.
- `apps/api` — Cloudflare Worker API and new D1 schema.
- `packages/contracts` — shared API and domain types.
- `packages/domain` — pure normalization and recommendation rules.
- `tools` — archive-boundary and Bungie manifest tooling.

## Local setup

```powershell
pnpm install
pnpm manifest:sync
pnpm dev
pnpm dev:api
```

Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` and supply Bungie/Cloudflare development values. Never commit secrets.

## Validation

```powershell
pnpm audit
```

The manifest sync requires network access. A compact artifact generated from Bungie's official manifest is checked in so builds remain deterministic between scheduled refreshes.
