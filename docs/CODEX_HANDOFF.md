# Guardian Nexus Codex handoff

Last updated: 2026-08-05

This file is the operational handoff for Chris Codex or another maintainer continuing the current Guardian Nexus roadmap implementation. Keep it current when scope, validation, or publish state changes.

## Current objective

The original roadmap and catalog corrections are live on `main`. Build Advisor template set v7 has 72 reviewed foundations: 24 per class and exactly four core-Exotic paths for every subclass. It groups visible recommendations by subclass and generates up to 24 additional account-specific variants when a different physical owned weapon strongly matches a reviewed template's bounded role. Generated variants never infer unsupported subclass setups or ownership. Build checklist tracking remains privacy-scoped to Fireteam.

The Alerts & Watches page has been removed from navigation, routing, mobile shortcuts, and the PWA shortcut list pending a later product rethink. Existing private watchlist preference parsing remains for backward compatibility with Build Advisor and Weapon Rolls data. Loadouts now includes a separately labeled live Equipped area, honest partial/unavailable states, collapsible cards with icon previews, and a header-docked horizontal jump frame. Saved-loadout markers reuse Bungie's returned icon and color assets, retain the in-game slot number, and expose viewport-aware name/class/element tooltips.

Guardian Share Cards have also been retired as a creation surface because they duplicated public Builds and Fireteam readiness while becoming stale manually. The primary navigation and Projects link are removed, and POST creation returns a retired-feature response. Legacy `/snapshots` management and unlisted direct links remain available solely so existing account-private cards are not deleted or made impossible to review and revoke.

Mobile/PWA promotion is paused. The Options installer, `beforeinstallprompt` listener, mobile quick-action dock, web-app manifest, and service-worker build/cache path are removed. Startup unregisters older Guardian Nexus service workers so previously installed caches do not keep serving stale bundles. Ordinary responsive CSS remains for narrow browser windows, but mobile-specific product work is not active scope.

Gear loot management now uses the existing private `gear_item_state` source of truth. The Loot tab defaults to a tall rolling seven-day history of first-observed physical weapons and armor, retains reviewed/tagged items in that period, and offers 1/3/7/14/30-day filters. Armor and Weapons keep compact recent rows; Fireteam uses a distinct single-line private glance bar with up to five gear items and two catalyst signals. Shared cards, tooltips, tags, and Shift+1–5 shortcuts remain consistent, and tooltips escape the Fireteam frame rather than being clipped. Fireteam can hide the bar and records first local observation of catalysts reported obtained/complete by Bungie. Times are labeled first observed, never exact acquisition. Weapon value data is versioned and exact-roll based; missing community coverage is unrated rather than scored down.

## Current repository state

- Checkout: `C:\Users\Erebu\OneDrive\Documents\GitHub\D2-Collections`
- Follow-up branch: `agent/build-advisor-catalog-v5` (create from current `main` before publishing)
- Base branch: `main` at merge commit `1b95714e983c2897ab4e823a6dc7edd1997d0626`
- Remote: `https://github.com/ErebusAres/D2-Collections.git`
- Foundation commit: `bd3e875` (`Add Build Advisor planning foundation`)
- Weapon workspace commit: `c2282b7` (`Add private weapon roll workspace`)
- Use `git rev-parse HEAD` for the latest validated roadmap slice; this handoff intentionally avoids a self-referential stale tip SHA.
- Completed pull request: `https://github.com/ErebusAres/D2-Collections/pull/53`
- PR #53 merged and deployed successfully through workflow run `30721416376`.
- The pre-existing untracked `.codex-remote-attachments/` directory is unrelated and must not be staged.
- Production currently serves merge commit `1b95714`; this v5 catalog correction is not live until its follow-up PR is merged and deployed.

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
10. Added an installable PWA foundation; this was later retired when mobile-specific product work was paused.
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
22. Added a safe-area-aware mobile quick-action dock; this was later removed when mobile-specific product work was paused.
23. Added native PWA installation and cache migration; these surfaces were later retired, including active service-worker unregistration.
24. Added a versioned, player-confirmed Fireteam readiness summary with activity, role, prerequisite states, optional public build summary, note, and timestamp validation.
25. Added a private readiness draft preference and explicit share consent. The API stores only the scoped summary in the existing Fireteam payload, preserves it across background refreshes, and never includes inventory or Collections data.
26. Added responsive readiness editing and member-card summaries plus a verified outward link to Bungie's official Fireteam Finder; Guardian Nexus does not recreate recruitment or matchmaking.
27. Implemented published `unlisted` builds end to end: they remain absent from public catalog discovery but are available to anyone holding the direct link.
28. Added versioned portable build JSON export/import. Exports explicitly omit membership IDs, author identity, votes, permissions, and server timestamps; imports are capped at 1 MB, version checked, normalized, and forced into a private draft.
29. Added a separate Guardian snapshot contract and D1 store with owner-only private cards, unlisted direct-link cards using random UUID slugs, and immediate owner revocation.
30. Added field-by-field snapshot inclusion for display name, class, Power, Guardian Rank, role, public build, goals, tags, and notes. The strict API schema rejects inventory, Collections, membership IDs, public discovery, unknown account fields, and unsafe link schemes.
31. Added responsive snapshot creation, management, copy/open, public unlisted viewing, and revocation at `/snapshots`; snapshot responses never serialize the stored owner membership ID.
32. Added a versioned `projects.v1` account preference with defensive normalization, bounded projects and checklist items, safe reference URLs, and backward-compatible empty defaults.
33. Added private activity plans, clan coordination drafts, and broader collection checklists with optional player-entered assignee labels, schedules, notes, and progress states.
34. Added explicit completion and restore controls plus a clearly labeled player-recorded history. It does not claim to be Bungie activity history or share data with clan members.
35. Added a private `/api/v1/me/activity-history` endpoint that requests recent activity separately for each current character, deduplicates and caps rows, and resolves names through the deployed activity manifest.
36. Added explicit available, partial, empty, and unavailable history states; failed or private characters generate warnings and never cause missing activity to be estimated.
37. Added a responsive Journey history timeline with PvE, PvP, Gambit, and other filters, optional metrics only when Bungie returned them, and source freshness.
38. Added a versioned, season-agnostic new-Guardian guide covering Guardian Rank, playable builds, physical ownership versus Collections, efficient planning, Postmaster safety, and the site's verified/unknown/player-recorded vocabulary.
39. Retained the working persistent high-contrast and reduced-motion preferences. Retired the incomplete interface-size and partial-language preview controls, their client runtime state, and their catalogs; legacy server preference keys remain accepted for backward compatibility with older clients but are ignored by the current interface.
42. Added a versioned portable Guardian Project envelope: JSON export strips private IDs, timestamps, completion history, and assignee labels by default; import is size/version checked and always creates a new private active project. Markdown brief copying is a separate explicit action that includes player-entered labels.
43. Added a private `/fashion` workspace for Hunter, Titan, and Warlock looks with five stable armor slots, per-slot ornament/shader references, notes, duplication, and a one-action shader application across all slots.
44. Fashion selections search the versioned cached Bungie cosmetic manifest and are explicitly labeled as manifest references with unknown unlock ownership; the site does not claim an ornament or shader is owned and never equips fashion items.
45. Added normalized `fashion.looks.v1` account storage capped at 20 looks and 40 KB, with backward-safe parsing at the read boundary.
46. Added versioned, account-neutral fashion JSON export/import. Private IDs and timestamps are omitted on export and regenerated on import.
47. Added a private `/challenges` workspace with versioned evergreen templates plus custom solo, Fireteam, and clan-labeled challenges. Scoring and completion are explicitly player-recorded and do not create a public leaderboard or community feed.
48. Added bounded `challenges.v1` preference storage, defensive parsing, task state history, active/complete restore flows, and data-driven template content that can be updated independently of page logic.
49. Added versioned account-neutral challenge JSON export/import, a Markdown invite copied only by explicit action, and an adapter that creates a new private Guardian Project without silently sharing Guardian snapshots.
50. Completed the feature-specific phone pass for Xur and Gear with single-column summaries and controls, compact two-column vendor cards, scroll-safe tabs/recent gear, touch-size controls, and a full-width comparison overlay.
51. Corrected the under-delivered Build Advisor catalog by adding 17 alternate-role templates, bringing the total to 36. Hunter, Titan, and Warlock each have 12 entries, and every Arc, Solar, Void, Strand, Stasis, and Prismatic pairing has two different required Exotic armor paths.
52. Fixed the post-release catalog visibility defect that hid builds when several core items were missing. All 12 valid builds for the selected class now remain visible; readiness ranking, ownership filters, substitutions, and acquisition guidance communicate what the player does not own instead of removing those builds from the response. The per-class API regression now requires exactly 12 recommendations and two per subclass even with a sparse inventory.
53. Every new path reuses the existing verified subclass configuration while supplying a distinct Exotic armor anchor, Exotic weapon preference, gameplay loop, strengths, weaknesses, role, upgrades, owned-item verification, alternative suggestions, trait targets, and acquisition-plan integration.
54. Added an explicit catalog banner and truthful build-option count so the expansion is immediately visible instead of being hidden behind backend scoring terminology. All 24 newly referenced Exotic names were checked against the generated site manifests.
55. Expanded template set v7 to 72 builds, with 24 options per class and four distinct core-Exotic approaches for every class/subclass pair. Sparse accounts still receive the full class catalog with owned alternatives and structured acquisition routes. Recommendations are visibly grouped by subclass with a path count.
56. Added explicit Build Advisor checklist tracking to Fireteam. Only the player-selected build name, readiness, required-component states, and bounded acquisition steps are shared; inventory and Collections remain private, and unknown component data stays unknown.
55. Alternate Exotic weapons carry their own slot, damage type, and archetype profiles rather than inheriting those fields from the base build. Regression coverage explicitly checks slot-changing paths such as Lumina and Grand Overture so ownership verification cannot falsely report them missing.
57. Added a third Gear Loot workspace with chronological first-observed weapons/armor, shared detail tooltips, rarity treatment, filtering, quick global tags, and keyboard shortcuts across Loot, Armor, Weapons, and Fireteam.
58. Added optional private Fireteam recent-loot visibility plus locally observed catalyst acquisition/completion signals. No inventory is added to Fireteam share payloads.
59. Added a versioned exact-roll weapon evaluation boundary sourced to DIM community wishlist documentation. It supports separate PvE/PvP/overall values when reviewed records are loaded and returns explicit unrated or incomplete states otherwise.

## Files in release scope

- `apps/api/src/buildAdvisor.ts`
- `apps/api/src/buildAdvisor.test.ts`
- `apps/api/src/index.ts`
- `apps/web/index.html`
- `apps/web/src/pages/BuildAdvisorPage.tsx`
- `apps/web/src/pages/BuildAdvisorPage.module.css`
- `apps/web/src/components/gear/WeaponWorkspace.tsx`
- `apps/web/src/components/gear/WeaponWorkspace.test.tsx`
- `apps/web/src/modules/watchlists/watchlists.ts`
- `apps/web/src/modules/watchlists/watchlists.test.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/App.module.css`
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
- `apps/web/src/components/fireteam/FireteamReadinessPanel.tsx`
- `apps/web/src/components/fireteam/FireteamReadinessPanel.module.css`
- `apps/web/src/components/fireteam/FireteamReadinessPanel.test.tsx`
- `apps/web/src/modules/fireteam/readiness.ts`
- `apps/web/src/modules/fireteam/readiness.test.ts`
- `apps/web/src/modules/builds/portableBuild.ts`
- `apps/web/src/modules/builds/portableBuild.test.ts`
- `apps/api/src/guardianSnapshots.ts`
- `apps/api/src/guardianSnapshots.test.ts`
- `apps/api/src/activityHistory.ts`
- `apps/api/src/activityHistory.test.ts`
- `apps/api/src/bungie.ts`
- `apps/api/migrations/0015_guardian_snapshots.sql`
- `apps/web/src/pages/GuardianSnapshotsPage.tsx`
- `apps/web/src/pages/GuardianSnapshotsPage.module.css`
- `apps/web/src/modules/projects/projects.ts`
- `apps/web/src/modules/projects/projects.test.ts`
- `apps/web/src/pages/ProjectsPage.tsx`
- `apps/web/src/pages/ProjectsPage.module.css`
- `apps/web/src/modules/projects/portableProject.ts`
- `apps/web/src/modules/projects/portableProject.test.ts`
- `apps/web/src/modules/fashion/fashion.ts`
- `apps/web/src/modules/fashion/fashion.test.ts`
- `apps/web/src/pages/FashionPage.tsx`
- `apps/web/src/pages/FashionPage.module.css`
- `apps/web/src/pages/FashionPage.test.tsx`
- `apps/web/src/data/challenge-templates.v1.json`
- `apps/web/src/modules/challenges/challenges.ts`
- `apps/web/src/modules/challenges/challenges.test.ts`
- `apps/web/src/pages/ChallengesPage.tsx`
- `apps/web/src/pages/ChallengesPage.module.css`
- `apps/web/src/pages/ChallengesPage.test.tsx`
- `apps/web/src/modules/i18n/catalog.ts`
- `apps/web/src/modules/i18n/catalog.test.ts`
- `apps/web/src/context/GuardianContext.tsx`
- `apps/web/src/styles/theme.css`
- `apps/web/src/pages/ActivityHistoryPage.tsx`
- `apps/web/src/pages/ActivityHistoryPage.module.css`
- `apps/web/src/pages/ActivityHistoryPage.test.tsx`
- `apps/web/src/data/onboarding-guide.v1.json`
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
- 174 API tests
- 226 web tests
- Node tooling tests
- 19 Python manifest tests
- API and web production builds
- performance budgets: 367,432 bytes JavaScript, 113,190 bytes gzip, and 34,124 bytes entry CSS
- `git diff --check` with only expected Windows LF-to-CRLF notices

The package-manager vulnerability command `pnpm audit` is distinct from the repository script `pnpm run audit`. The former currently reports four high-severity upstream advisories involving Wrangler/Miniflare's `sharp`, React Router, and transitive `brace-expansion`. Do not apply major dependency upgrades inside this feature PR without a separate compatibility review.

## Publish access

Git and GitHub CLI authentication were verified successfully outside the restricted execution sandbox. The ErebusAres keyring credential has `repo` and `workflow` access. A sandboxed authentication check produced a false invalid-token result; do not treat that result as authoritative without repeating the check with network access.

## Remaining release steps

1. Complete and monitor the focused Build Advisor v5 follow-up PR checks.
2. Perform a signed-in live-account check after deployment and confirm 12 recommendations for each selected class before inventory/readiness filters.
3. Keep `.codex-remote-attachments/` excluded from future commits.
4. Mark the PR ready only after the reviewer agrees that the current phased scope is appropriate.
5. Merge and deploy only when explicitly authorized; report merge SHA, workflow result, and production state separately.
6. Treat additional feature work as a new reviewed roadmap addition; the currently accepted roadmap is complete on this branch.
7. D1 migration `0015_guardian_snapshots.sql` was applied successfully by production workflow `30721416376`; do not reframe it as pending.

## Build Advisor v5 follow-up state

- Intended focused files: `apps/api/src/buildAdvisorTemplates.ts`, `apps/api/src/buildAdvisor.test.ts`, `apps/web/src/pages/BuildAdvisorPage.tsx`, its CSS module and test, plus these two handoff documents.
- Required invariant: 72 templates total, 24 per class, four per class/subclass pair, one required Exotic armor and one preferred Exotic weapon per template.
- Full `pnpm run audit` passed on 2026-08-01: archive/source/CSS boundaries, lint, all TypeScript targets, 24 domain tests, 174 API tests, 226 web tests, Node tooling, 19 Python tests, production builds, and budgets of 367,432 bytes entry JavaScript, 113,190 bytes gzip, and 34,124 bytes entry CSS.
- Keep `.codex-remote-attachments/` excluded, commit and push through the focused review branch, then monitor CI. Merge/deploy only after explicit authorization; after deployment, perform the signed-in 12-build-per-class check described above.

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

#### Retired: Mobile/PWA readiness

- Added persistent phone quick actions, 44-pixel-plus touch targets, notch/home-indicator spacing, scroll-safe section tabs, and content/scroll-top clearance for the dock.
- Added a user-initiated native install action, prioritized OS shortcuts, Apple mobile metadata, and a bumped core cache so installed clients receive the shell update.
- Install promotion, the mobile dock, manifest metadata, and service-worker caching are removed. Responsive browser layout remains, but no mobile-specific product delivery is currently planned.

#### Completed: Fireteam readiness

- Readiness drafts remain private until the player enables the scoped share and names an activity; shared data is explicitly labeled player-confirmed.
- Roles, overall state, prerequisite checks, optional public build title/subclass, and a short note are validated at the API boundary and rendered on Fireteam member cards.
- Background share refreshes preserve the existing readiness summary when no readiness update is submitted. Disabling readiness explicitly removes it from the payload.
- Recruitment links to Bungie's official Fireteam Finder rather than recreating matchmaking.

### P3: Expansion foundations

- Completed the build portion of the versioned snapshot/export foundation: private drafts, link-only unlisted publication, account-neutral JSON export, and private-draft import.
- Completed the separately consented Guardian snapshot contract without reusing the build envelope or adding ownership fields to public/unlisted builds.
- Completed the account-private Guardian Projects foundation for activity plans, clan coordination drafts, broader collection checklists, and player-recorded completion history.
- Projects is routed through the existing lazy planning surface at `/next/projects` and linked from Next Steps, keeping the global header stable and the entry bundle inside its enforced budgets.
- Completed Bungie-backed recent activity history at `/journey/history`, with private per-character reads, manifest labels, partial/unavailable states, and no inferred missing rows.
- Completed the first versioned new-player explanation pack inside the same Journey surface; it contains evergreen guidance rather than hard-coded seasonal facts.
- Retained the validated high-contrast and reduced-motion accessibility controls. Interface scaling and partial localization are intentionally retired until they can cover the whole product reliably.
- Completed portable project JSON and Markdown adapters with privacy-safe defaults and private-import semantics.
- Completed the modular private fashion workspace with manifest-backed references, honest unknown ownership, five stable slots, and account-neutral adapters.
- Completed private challenge/community modes with versioned templates, custom point goals, portable invites, player-recorded status, and an explicit private Projects adapter; Guardian snapshots are never silently included.
- Completed the remaining feature-specific phone review for Xur and Gear while preserving compact inventory verification and comparison controls.
- No accepted feature remains queued. Preserve the modular, data-driven challenge and onboarding foundations when future scope is approved.

## Non-negotiable constraints

- Do not import from or reuse archived implementation files.
- Keep account ownership and inventory private; public snapshots remain account-agnostic.
- Use membership IDs for authorization, never mutable display names.
- Distinguish unknown or stale Bungie data from confirmed absence.
- Do not automate gameplay or dismantling.
- Keep seasonal facts and recommendation templates versioned and updateable.
- Preserve backward compatibility for stored preferences and cached response shapes.
