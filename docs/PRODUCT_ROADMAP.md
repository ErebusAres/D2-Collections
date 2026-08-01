# Guardian Nexus product roadmap

Guardian Nexus is a player-decision companion. New features should help a Guardian decide what to keep, equip, pursue, or coordinate without exposing private account data or pretending Bungie's APIs are more authoritative than they are.

## Delivery status

Last updated: 2026-08-01

- **Published for review:** Phase 1 structured Build Advisor advice, account verification, owned alternatives, acquisition plans, farming watchlists, upgrade stages, and account-wide armor optimization are in draft PR #53.
- **Published for review:** The first Phase 3 session planner slice and the Phase 4 installable PWA foundation are also in draft PR #53.
- **Implemented on the PR branch:** Phase 2 weapon manifest, private physical-roll normalization, duplicate/perk comparison, crafted/enhanced visibility, wishlist support, explainable review states, and existing Gear actions.
- **Published for review:** Versioned account-private watchlists now cover items, perks, Xûr offers, Collection unlocks, catalysts, pursuits, Rewards Pass claims, and Postmaster thresholds with browser-alert consent, reset-aware expiry, and explicit unknown states.
- **Validated on the PR branch:** The session planner now uses source-aware effort confidence, objective overlap, known deadline urgency, and explicit handoff into Fireteam tracking.
- **Validated on the PR branch:** Mobile/PWA readiness now includes a safe-area-aware phone dock, prioritized app shortcuts, native install prompting, cache migration, and regression coverage.
- **Validated on the PR branch:** Activity-scoped Fireteam readiness uses explicit opt-in, player-confirmed roles and prerequisites, public build summaries, and an official Bungie Fireteam Finder handoff without sharing inventory or Collections.
- **Validated on the PR branch:** Build snapshots now support public discovery, unlisted direct links, private drafts, and a versioned account-neutral JSON export/import path.
- **Validated on the PR branch:** Guardian snapshots are separately stored, player-curated, private by default, optionally unlisted through unguessable links, field-selective, and revocable; inventory and Collections fields are rejected.
- **Validated on the PR branch:** Guardian Projects provides account-private activity plans, clan coordination drafts, reusable collection checklists, optional display-label assignments, and clearly player-recorded completion history.
- **Active next implementation:** Bungie-backed activity history summaries and broader new-player guidance.
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
- [ ] Finish narrow-layout review of feature-specific Xur and quick-inventory surfaces as those pages evolve.
- [x] Activity-scoped readiness with explicitly shared roles, prerequisites, and public build summaries.
- [x] Recruitment remains in Bungie's official Fireteam Finder; Guardian Nexus prepares the group and links outward.

## Phase 5: Expansion features

- [x] Private drafts and unlisted direct-link build snapshots.
- [x] Versioned account-neutral build export/import that always imports as a private draft.
- [x] Private or unlisted Guardian snapshots with explicit field selection and revocation.
- [x] Account-private clan/activity planning and broader collectible checklists with player-recorded completion history.
- [ ] Bungie-backed activity history, new-player explanations, broader cross-tool adapters, accessibility/localization, and fashion or challenge modes.

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
