# Guardian Nexus Codex handoff

Last updated: 2026-08-01

This file is the operational handoff for Chris Codex or another maintainer continuing the current Guardian Nexus roadmap implementation. Keep it current when scope, validation, or publish state changes.

## Current objective

Implement every accepted product-roadmap feature in dependency order while keeping draft PR #53 reviewable. Build Advisor 2, weapon rolls, unified private watchlists, the session-planner refinement, and mobile/PWA readiness are complete; activity-scoped Fireteam readiness is next.

## Current repository state

- Checkout: `C:\Users\Erebu\OneDrive\Documents\GitHub\D2-Collections`
- Release branch: `agent/build-advisor-planning-foundation`
- Base branch: `main` at `3390937b4dbe7de670636cf18bae869b7cd5baa2`
- Remote: `https://github.com/ErebusAres/D2-Collections.git`
- Foundation commit: `bd3e875` (`Add Build Advisor planning foundation`)
- Weapon workspace commit: `c2282b7` (`Add private weapon roll workspace`)
- Use `git rev-parse HEAD` for the latest validated roadmap slice; this handoff intentionally avoids a self-referential stale tip SHA.
- Draft pull request: `https://github.com/ErebusAres/D2-Collections/pull/53`
- The release branch is pushed and tracks `origin/agent/build-advisor-planning-foundation`.
- The pre-existing untracked `.codex-remote-attachments/` directory is unrelated and must not be staged.
- No production deployment has been requested or performed. The release is published for review only.

## Completed release scope

1. Added versioned Build Advisor 2 response contracts while retaining compatibility with legacy cached recommendations.
2. Added structured verification states that distinguish physical ownership, Collections unlocks, valid substitutes, configuration gaps, confirmed missing items, and unknown data.
3. Added ranked owned weapon and armor alternatives with benefits, tradeoffs, matching traits, and missing traits.
4. Added structured acquisition plans with availability, certainty, steps, and required, preferred, or acceptable target traits.
5. Added playable-now, next-upgrade, strong, and ideal progression stages.
6. Replaced independent armor-slot selection with a bounded account-wide combination optimizer. Candidate count and alternatives are included in the response for explainability.
7. Added Build Advisor filters for subclass, focus, activity, complexity, and inventory readiness.
8. Added account-private build-farm watchlists through namespaced user preferences.
9. Added a session planner with 30, 60, and 120 minute budgets, solo or Fireteam preference, goal focus, and player-facing recommendation reasons.
10. Added an installable web manifest, shortcuts, mobile metadata, and service-worker cache coverage as the PWA foundation.
11. Added `docs/PRODUCT_ROADMAP.md` with product principles, phased delivery, and maintenance rules.
12. Expanded the versioned Gear manifest from armor-only to armor and weapons, retaining roll-bearing plugs and adding a Gear-only sync command to prevent unrelated artifact churn.
13. Added private physical weapon normalization with active/selectable perk columns, origin traits, weapon slots and damage types, crafted/enhanced/masterwork state, and roll-data certainty.
14. Added the Weapon Rolls workspace beside Armor with duplicate comparison, search and filters, private wishlists, tags, locks, transfers, equip actions, and explainable review states.
15. Added a versioned `watchlists.v1` contract and private preference with safe parsing, a 50-entry limit, pause/resume, per-watch alert consent, deadlines, and explicit matched, watching, unknown, and expired results.
16. Added a unified responsive Watchlists page evaluating owned items, active/selectable weapon perks, Xûr inventory, Collection ownership, catalyst state, active pursuits, claimable Rewards Pass items, and configurable Postmaster thresholds.
17. Connected Build Advisor farming targets and Weapon Rolls wishlists to the unified watchlist while retaining the older preference keys for backward compatibility.
18. Added deduplicated browser notifications that fire only after permission is granted and only when a matched result changes; no external delivery or public account snapshot is created.
19. Reworked session planning into a bounded greedy route that rewards shared playlist, activity, element, weapon, combatant, precision, and ability requirements after the first objective is selected.
20. Added known-deadline urgency, expired-deadline rejection, source-aware 30/60/120-minute estimates, and explicit high, medium, or low confidence explanations.
21. Added an explicit route handoff that deduplicates and writes quest, Guardian Rank, and Collection objectives into the existing private Fireteam tracking channels before the player chooses whether to share them.
22. Added a safe-area-aware mobile quick-action dock for Director, Watchlists, Next Steps, Postmaster, and Fireteam while preserving the full horizontally scrollable section navigation.
23. Added native `beforeinstallprompt` handling in Options, prioritized mobile manifest shortcuts, edge-to-edge viewport metadata, and a versioned service-worker cache migration.

## Files in release scope

- `apps/api/src/buildAdvisor.ts`
- `apps/api/src/buildAdvisor.test.ts`
- `apps/api/src/index.ts`
- `apps/web/index.html`
- `apps/web/public/manifest.webmanifest`
- `apps/web/service-worker.ts`
- `apps/web/src/pages/BuildAdvisorPage.tsx`
- `apps/web/src/pages/BuildAdvisorPage.module.css`
- `apps/web/src/components/gear/WeaponWorkspace.tsx`
- `apps/web/src/components/gear/WeaponWorkspace.test.tsx`
- `apps/web/src/modules/watchlists/watchlists.ts`
- `apps/web/src/modules/watchlists/watchlists.test.ts`
- `apps/web/src/pages/WatchlistsPage.tsx`
- `apps/web/src/pages/WatchlistsPage.module.css`
- `apps/web/src/App.tsx`
- `apps/web/src/components/layout/Shell.tsx`
- `apps/web/src/components/layout/Shell.module.css`
- `apps/web/src/components/layout/Shell.test.tsx`
- `apps/web/src/components/layout/OptionsPanel.tsx`
- `apps/web/src/components/layout/OptionsPanel.module.css`
- `apps/web/src/pages/GearPage.tsx`
- `apps/web/src/pages/Pages.module.css`
- `apps/web/src/pages/NextStepsPage.tsx`
- `apps/web/src/pages/NextStepsPage.module.css`
- `apps/web/src/pages/NextStepsPage.test.ts`
- `packages/contracts/src/index.ts`
- `tools/sync-manifest.py`
- `tools/sync_manifest_test.py`
- `apps/web/public/data/gear-manifest.json`
- `package.json`
- `docs/PRODUCT_ROADMAP.md`
- `docs/CODEX_HANDOFF.md`

## Validation completed

The following passed on 2026-08-01:

- `pnpm run audit`
- archive boundary audit
- frontend source-boundary audit
- CSS-module usage audit
- ESLint with zero warnings
- TypeScript checks for contracts, domain, API, web, service worker, and edge functions
- 24 domain tests
- 168 API tests
- 206 web tests
- Node tooling tests
- 19 Python manifest tests
- API and web production builds
- performance budgets: 373,723 bytes JavaScript, 114,739 bytes gzip, and 39,836 bytes CSS
- `git diff --check` with only expected Windows LF-to-CRLF notices

The package-manager vulnerability command `pnpm audit` is distinct from the repository script `pnpm run audit`. The former currently reports four high-severity upstream advisories involving Wrangler/Miniflare's `sharp`, React Router, and transitive `brace-expansion`. Do not apply major dependency upgrades inside this feature PR without a separate compatibility review.

## Publish access

Git and GitHub CLI authentication were verified successfully outside the restricted execution sandbox. The ErebusAres keyring credential has `repo` and `workflow` access. A sandboxed authentication check produced a false invalid-token result; do not treat that result as authoritative without repeating the check with network access.

## Remaining release steps

1. Monitor draft PR #53 checks and inspect any failure before changing code.
2. Perform review and any requested browser or live-account QA on the draft branch.
3. Keep `.codex-remote-attachments/` excluded from future commits.
4. Mark the PR ready only after the reviewer agrees that the current phased scope is appropriate.
5. Merge and deploy only when explicitly authorized; report merge SHA, workflow result, and production state separately.
6. Continue the accepted roadmap in dependency order on the draft integration branch, updating this handoff after every validated slice.

## Next implementation queue

### Completed: Weapon workspace data foundation

- Completed in the current PR branch with a dedicated `pnpm manifest:sync:gear` path and backward-compatible optional weapon fields.

### Completed: Weapon inventory and comparison

- Completed in the current PR branch. Review states describe verified configuration and comparison needs; they do not claim universal roll quality and never automate dismantling.

### Completed: Watchlist expansion

- Completed in the current PR branch with a versioned preference contract, eight source types, explicit unavailable-data handling, reset-aware deadlines, alert deduplication, and browser notification consent.
- Build Advisor farms and Weapon Rolls wishlists dual-write into the unified document while legacy keys remain readable for rolling deployments.

### Completed: Session planner refinement

- Completed in the current PR branch with explainable estimate confidence, controlled overlap vocabulary, known deadline urgency, and explicit route handoff into the existing private tracking preferences.
- Deadlines are used only when Bungie or an already verified source provides them; missing timing remains visibly unknown.

### P2: Mobile and Fireteam readiness

#### Completed: Mobile/PWA readiness

- Added persistent phone quick actions, 44-pixel-plus touch targets, notch/home-indicator spacing, scroll-safe section tabs, and content/scroll-top clearance for the dock.
- Added a user-initiated native install action, prioritized OS shortcuts, Apple mobile metadata, and a bumped core cache so installed clients receive the shell update.
- Component, manifest, service-worker, and type checks cover the install surface. The in-app browser confirmed the new navigation rendered from the live development branch; its fresh-tab viewport override continued to report desktop dimensions, so exact-device visual QA remains a release-review task rather than a correctness claim.

#### Next: Fireteam readiness

- Add activity-scoped, opt-in readiness summaries for roles, prerequisites, and selected build readiness.
- Keep inventory and Collections private; share only the scoped summary the player chooses.
- Link recruitment to Bungie's official Fireteam Finder rather than recreating matchmaking.

## Non-negotiable constraints

- Do not import from or reuse archived implementation files.
- Keep account ownership and inventory private; public snapshots remain account-agnostic.
- Use membership IDs for authorization, never mutable display names.
- Distinguish unknown or stale Bungie data from confirmed absence.
- Do not automate gameplay or dismantling.
- Keep seasonal facts and recommendation templates versioned and updateable.
- Preserve backward compatibility for stored preferences and cached response shapes.
