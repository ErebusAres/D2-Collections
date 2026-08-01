# Guardian Nexus Codex handoff

Last updated: 2026-08-01

This file is the operational handoff for Chris Codex or another maintainer continuing the current Guardian Nexus release. Keep it current when scope, validation, or publish state changes.

## Current objective

Publish the cohesive Build Advisor 2, farming watchlist, session planner, and PWA-foundation release. Do not mix the larger weapon-manifest migration into this release unless the current changes are intentionally reopened and revalidated.

## Current repository state

- Checkout: `C:\Users\Erebu\OneDrive\Documents\GitHub\D2-Collections`
- Release branch: `agent/build-advisor-planning-foundation`
- Base branch: `main` at `3390937b4dbe7de670636cf18bae869b7cd5baa2`
- Remote: `https://github.com/ErebusAres/D2-Collections.git`
- Local changes are not committed or pushed yet.
- The pre-existing untracked `.codex-remote-attachments/` directory is unrelated and must not be staged.
- No production deployment has been requested. Publishing this change means branch, commit, push, and draft pull request only.

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

## Files in release scope

- `apps/api/src/buildAdvisor.ts`
- `apps/api/src/buildAdvisor.test.ts`
- `apps/api/src/index.ts`
- `apps/web/index.html`
- `apps/web/public/manifest.webmanifest`
- `apps/web/service-worker.ts`
- `apps/web/src/pages/BuildAdvisorPage.tsx`
- `apps/web/src/pages/BuildAdvisorPage.module.css`
- `apps/web/src/pages/NextStepsPage.tsx`
- `apps/web/src/pages/NextStepsPage.module.css`
- `apps/web/src/pages/NextStepsPage.test.ts`
- `packages/contracts/src/index.ts`
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
- 167 API tests
- 196 web tests
- Node tooling tests
- 17 Python manifest tests
- API and web production builds
- performance budgets: 371,081 bytes JavaScript, 114,037 bytes gzip, and 38,019 bytes CSS
- `git diff --check` with only expected Windows LF-to-CRLF notices

The package-manager vulnerability command `pnpm audit` is distinct from the repository script `pnpm run audit`. The former currently reports four high-severity upstream advisories involving Wrangler/Miniflare's `sharp`, React Router, and transitive `brace-expansion`. Do not apply major dependency upgrades inside this feature PR without a separate compatibility review.

## Publish access

Git and GitHub CLI authentication were verified successfully outside the restricted execution sandbox. The ErebusAres keyring credential has `repo` and `workflow` access. A sandboxed authentication check produced a false invalid-token result; do not treat that result as authoritative without repeating the check with network access.

## Remaining release steps

1. Review `git status -sb` and confirm `.codex-remote-attachments/` remains excluded.
2. Stage only the files listed in **Files in release scope**.
3. Inspect `git diff --cached --check` and `git diff --cached --stat`.
4. Commit with `Add Build Advisor planning foundation`.
5. Push the branch with upstream tracking.
6. Open a draft PR targeting `main`. Include scope, player impact, backward compatibility, privacy guarantees, validation, dependency-advisory note, and deferred weapon-manifest work.
7. Report the branch, commit SHA, draft PR URL, check state, and explicit deployment state to the user.

## Next implementation queue

### P1: Weapon workspace data foundation

- Expand `tools/sync-manifest.py` so the Gear artifact includes non-redacted weapon definitions and only the weapon plugs needed for owned-roll inspection.
- Version the manifest shape and preserve armor consumers.
- Add weapon contracts for physical location, damage type, slot, crafted/enhanced state, active perks, selectable perks, origin trait, masterwork, tag, and data certainty.
- Add manifest-size and representative-perk tests before building UI.

### P1: Weapon inventory and comparison

- Normalize physical weapon instances in the private Gear endpoint.
- Reuse existing tags, locks, transfers, and equip actions.
- Add duplicate groups and perk-column comparison.
- Share requirement evaluation with Build Advisor rather than creating a second scoring vocabulary.
- Use explainable keep, situational, and review labels; never automate dismantling.

### P1: Watchlist expansion

- Move the current build-farm preference into a versioned account-private watchlist contract when multiple watchlist types are introduced.
- Add items, perks, vendor offers, catalysts, Collection gaps, expiring pursuits, rewards, and Postmaster thresholds.
- Add deduplication, reset-aware expiry, source/freshness metadata, and notification consent controls.

### P2: Session planner refinement

- Replace coarse effort estimates with source-aware estimates and explicit uncertainty.
- Detect objectives that overlap in activity, destination, combatant, weapon, or playlist requirements.
- Incorporate reset deadlines and active rotations without claiming unsupported live state.
- Allow explicitly sending a selected plan into Fireteam tracking.

### P2: Mobile and Fireteam readiness

- QA the PWA install flow and responsive layouts on representative narrow viewports.
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
