# Guardian Nexus product roadmap

Guardian Nexus is a player-decision companion. New features should help a Guardian decide what to keep, equip, pursue, or coordinate without exposing private account data or pretending Bungie's APIs are more authoritative than they are.

## Delivery status

Last updated: 2026-08-01

- **Build Advisor 2.0 catalog expansion:** Template set v7 contains 72 reviewed foundations: 24 per class and four different core-Exotic paths for each of the 18 class/subclass combinations. The API can add bounded account-specific variants when a different owned weapon strongly satisfies a reviewed template role, so the recommendation set adapts as inventory changes without inventing unsupported subclass configurations. The UI groups recommendations by subclass and distinguishes filtered counts from the full result set. Missing gear changes readiness and acquisition guidance rather than catalog visibility. Players can explicitly track a bounded, privacy-scoped build checklist on Fireteam.

- **Live from PR #53:** Phase 1 structured Build Advisor advice, account verification, owned alternatives, acquisition plans, farming watchlists, upgrade stages, and account-wide armor optimization are deployed.
- **Live from PR #53:** The Phase 3 session planner and Phase 4 installable PWA foundation are deployed.
- **Implemented on the PR branch:** Phase 2 weapon manifest, private physical-roll normalization, duplicate/perk comparison, crafted/enhanced visibility, wishlist support, explainable review states, and existing Gear actions.
- **Live from PR #53:** Versioned account-private watchlists cover items, perks, Xûr offers, Collection unlocks, catalysts, pursuits, Rewards Pass claims, and Postmaster thresholds with browser-alert consent, reset-aware expiry, and explicit unknown states.
- **Validated on the PR branch:** The session planner now uses source-aware effort confidence, objective overlap, known deadline urgency, and explicit handoff into Fireteam tracking.
- **Validated on the PR branch:** Mobile/PWA readiness now includes a safe-area-aware phone dock, prioritized app shortcuts, native install prompting, cache migration, and regression coverage.
- **Validated on the PR branch:** Activity-scoped Fireteam readiness uses explicit opt-in, player-confirmed roles and prerequisites, public build summaries, and an official Bungie Fireteam Finder handoff without sharing inventory or Collections.
- **Validated on the PR branch:** Build snapshots now support public discovery, unlisted direct links, private drafts, and a versioned account-neutral JSON export/import path.
- **Validated on the PR branch:** Guardian snapshots are separately stored, player-curated, private by default, optionally unlisted through unguessable links, field-selective, and revocable; inventory and Collections fields are rejected.
- **Validated on the PR branch:** Guardian Projects provides account-private activity plans, clan coordination drafts, reusable collection checklists, optional display-label assignments, and clearly player-recorded completion history.
- **Validated on the PR branch:** Private recent-activity history now uses Bungie's per-character activity endpoint with explicit available, partial, empty, and unavailable states; a versioned evergreen new-Guardian guide explains account truth and practical first steps.
- **Validated on the PR branch:** Accessibility preferences now include high contrast, three base text sizes, reduced motion, and persistent root semantics; typed English, Spanish, and French catalogs cover core navigation/settings with explicit fallback and preview scope.
- **Validated on the PR branch:** Guardian Projects now export account-neutral JSON, import as new private active projects, and copy Markdown briefs through an explicit player action.
- **Validated on the PR branch:** Fashion workspace saves private five-slot ornament/shader references, uses the versioned manifest without claiming unlock ownership, and supports account-neutral JSON import/export.
- **Validated on the PR branch:** Private challenge modes now support versioned evergreen templates, custom point goals, solo/Fireteam/clan labels, player-recorded scoring, portable invites, and explicit conversion into private Guardian Projects.
- **Validated on the PR branch:** Xur and quick-inventory surfaces now collapse into compact, touch-friendly phone layouts without hiding verification or comparison controls.
- **Accepted roadmap status:** All feature work listed below is implemented and validated. Draft PR review, live-account/device QA, migration, merge, and deployment remain release decisions rather than missing product scope.
- **Release handoff:** See `docs/CODEX_HANDOFF.md` for the exact branch, PR, validation, exclusions, and remaining release steps.

## Product principles

1. **Account truth before advice.** Distinguish a physical item, a Collections unlock, a compatible substitute, a confirmed absence, and data that Bungie did not return.
2. **Useful now, ideal later.** Recommendations should include a playable owned version and a path toward a stronger version instead of requiring a perfect inventory.
3. **Explain every recommendation.** Scores, substitutions, farms, and alerts need concise reasons and source/freshness information.
4. **Opt-in sharing.** Collection ownership, inventory, build readiness, and pursuit progress remain private unless the player explicitly shares a scoped summary.
5. **No unsupported automation.** Guardian Nexus may use Bungie's supported transfer/equip actions, but it must not simulate gameplay, dismantle items, or imply unsupported real-time state.
6. **Updateable data, stable code.** Sandbox facts, sources, rotations, perk targets, and build templates belong in versioned data. Domain rules and UI components should consume contracts rather than embed seasonal facts.
7. **Backward-compatible storage.** Saved builds and preferences are migrated or normalized at read boundaries. A deployment must not strand records created by an older web bundle.

## Phase 1: Build Studio and Advisor 2.0

- Structured component verification with exact, strong, functional, configuration-needed, collection-only, missing, unavailable, and unknown states.
- Ranked owned and obtainable alternatives with explicit tradeoffs.
- Structured acquisition plans with availability and certainty rather than unverified drop-rate promises.
- Playable-now, next-upgrade, strong, and ideal build stages.
- Account-wide armor combination optimization with stat, Exotic, set-bonus, tuning, and mod constraints.
- Build discovery by activity, anchor item, subclass, role, complexity, ownership, and content access.
- Versioned template review and stale-build detection.
- [x] Two distinct core-Exotic build paths for every Hunter, Titan, and Warlock subclass, with each path flowing through ownership checks, ranked alternatives, trait targets, acquisition plans, and progression stages.

## Phase 2: Weapon workspace

- [x] Weapon inventory alongside the existing armor workspace.
- [x] Duplicate and perk-column comparison, crafted/enhanced state, wishlists, tags, locks, transfers, and equip actions.
- [x] Explainable configured, unique, duplicate-review, and incomplete-data labels. Guardian Nexus never dismantles an item.
- [x] Shared versioned Gear definitions and plug vocabulary used by private inventory and Build Advisor data paths.

## Phase 3: Watchlists and session planning

- [x] Account-private watchlists for items, perks, vendor offers, Collection gaps, catalysts, expiring pursuits, rewards, and Postmaster thresholds.
- [x] Browser notifications first; optional external delivery remains a separate consented integration.
- [x] A session planner using available time, solo or Fireteam preference, desired outcome, tracked goals, rotations, and reset deadlines.
- [x] Plans maximize overlapping progress and can be sent to Fireteam tracking.

## Phase 4: Mobile and Fireteam readiness

- [x] Installable, responsive second-screen navigation for Director, alerts, Postmaster, tracked goals, and Fireteam, with safe-area support and native install prompting.
- [x] Finish narrow-layout review of feature-specific Xur and quick-inventory surfaces as those pages evolve.
- [x] Activity-scoped readiness with explicitly shared roles, prerequisites, and public build summaries.
- [x] Recruitment remains in Bungie's official Fireteam Finder; Guardian Nexus prepares the group and links outward.

## Phase 5: Expansion features

- [x] Private drafts and unlisted direct-link build snapshots.
- [x] Versioned account-neutral build export/import that always imports as a private draft.
- [x] Private or unlisted Guardian snapshots with explicit field selection and revocation.
- [x] Account-private clan/activity planning and broader collectible checklists with player-recorded completion history.
- [x] Bungie-backed recent activity history with partial/unavailable handling and versioned new-player explanations.
- [x] Portable Guardian Project JSON/Markdown adapters and accessibility/localization foundations.
- [x] Private, portable fashion workspace with manifest-backed references and explicit unknown ownership.
- [x] Private challenge/community modes with updateable templates, custom scoring, portable invites, and Guardian Projects handoff.

## Maintenance requirements

- Every externally sourced record carries a source, observed/reviewed timestamp, and confidence or availability state.
- Seasonal definitions are versioned and can be disabled without deleting history.
- New recommendation logic is pure and unit-tested where possible.
- API responses use shared contracts; UI components do not infer ownership from labels.
- New user preferences are namespaced and have safe defaults.
- Player-specific data is never written into public build, world-state, or shared-cache payloads.
- Feature releases include focused tests, typecheck, lint, build, and regression-budget checks through `pnpm audit`.

## Delivery order

1. Build verification and structured advice foundation.
2. Alternatives, acquisition plans, and upgrade stages in the Build Advisor UI.
3. Armor combination optimizer and expanded build catalog.
4. Weapon workspace using the same requirement and verification model. **Implemented on the PR branch.**
5. Watchlists and session planner.
6. Mobile second-screen and Fireteam readiness.
7. Expansion features based on usage and player reports.
