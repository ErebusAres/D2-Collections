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

The Bungie application must include the `ReadUserData` OAuth scope for the Fireteam social roster. After adding that scope in Bungie's developer portal, existing users must authorize the app again before their friend list can be read. Clan and fireteam presence degrade gracefully when Bungie withholds social data.

Guardian Nexus does not simulate unsupported actions: joining, whispering, and leader removal controls copy Destiny 2 text-chat commands, and Rewards Pass claiming links to Bungie's official authenticated tracker.

## Validation

```powershell
pnpm audit
```

The manifest sync requires network access. A compact artifact generated from Bungie's official manifest is checked in so builds remain deterministic between scheduled refreshes.
