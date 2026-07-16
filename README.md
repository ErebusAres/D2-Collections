# Guardian Nexus

Guardian Nexus is a desktop-first Destiny 2 companion for personal Exotic collections, quest progress, opt-in fireteam coordination, and three-Guardian collection comparison.

## Workspace

- `apps/web` — React, TypeScript, and Vite interface deployed to Cloudflare Pages.
- `apps/api` — Cloudflare Worker API and D1 schema.
- `packages/contracts` — shared API and domain types.
- `packages/domain` — pure normalization and recommendation rules.
- `tools` — Bungie manifest and reward-code tooling.

The web application follows a feature-oriented frontend structure:

- `src/components` — reusable presentation, layout, and feature components.
- `src/context` — application-wide React context providers.
- `src/modules` — feature-specific state and pure helpers.
- `src/pages` — route-level page composition.
- `src/services` — external API clients and connection state.
- `src/styles` — global theme and application styles.

Cloudflare entrypoints remain outside that structure: `apps/web/functions` is the Pages API proxy and `apps/api/src/index.ts` is the Worker entrypoint.

## Local setup

```powershell
pnpm install
pnpm manifest:sync
pnpm dev
pnpm dev:api
```

Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` and supply Bungie/Cloudflare development values. Never commit secrets.

The Bungie application must include the `ReadUserData` OAuth scope for the Fireteam social roster and `MoveEquipDestinyItems` for Postmaster pulls and loadout equipping. After adding a scope in Bungie's developer portal, existing users must authorize the app again before the added capability is available. Social, Postmaster, and loadout actions degrade gracefully when Bungie withholds data or permission.

Guardian Nexus does not simulate unsupported actions: joining, whispering, and leader removal controls copy Destiny 2 text-chat commands, and Rewards Pass claiming links to Bungie's official authenticated tracker.

## Validation

```powershell
pnpm audit
```

The manifest sync requires network access. A compact artifact generated from Bungie's official manifest is checked in so builds remain deterministic between scheduled refreshes.
