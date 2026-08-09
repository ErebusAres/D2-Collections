# Guardian Nexus Codex handoff

Last updated: 2026-08-08

This file is the operational handoff for Chris Codex or another maintainer continuing the current Guardian Nexus roadmap implementation. Keep it current when scope, validation, or publish state changes.

## Current objective

The original roadmap and catalog corrections are live on `main`. Build Advisor template set v7 has 72 reviewed foundations: 24 per class and exactly four core-Exotic paths for every subclass. It groups visible recommendations by subclass and generates up to 24 additional account-specific variants when a different physical owned weapon strongly matches a reviewed template's bounded role. Generated variants never infer unsupported subclass setups or ownership. Build checklist tracking remains privacy-scoped to Fireteam.

The Alerts & Watches page has been removed from navigation, routing, mobile shortcuts, and the PWA shortcut list pending a later product rethink. Existing private watchlist preference parsing remains for backward compatibility with Build Advisor and Weapon Rolls data. Loadouts now includes a separately labeled live Equipped area, honest partial/unavailable states, collapsible cards with icon previews, and a header-docked horizontal jump frame. Saved-loadout markers reuse Bungie's returned icon and color assets, retain the in-game slot number, and expose viewport-aware name/class/element tooltips.

Guardian Share Cards have also been retired as a creation surface because they duplicated public Builds and Fireteam readiness while becoming stale manually. The primary navigation and Projects link are removed, and POST creation returns a retired-feature response. Legacy `/snapshots` management and unlisted direct links remain available solely so existing account-private cards are not deleted or made impossible to review and revoke.

Mobile/PWA promotion is paused. The Options installer, `beforeinstallprompt` listener, mobile quick-action dock, web-app manifest, and service-worker build/cache path are removed. Startup unregisters older Guardian Nexus service workers so previously installed caches do not keep serving stale bundles. Ordinary responsive CSS remains for narrow browser windows, but mobile-specific product work is not active scope.

Gear loot management uses the existing private `gear_item_state` source of truth. Fireteam consumes `/api/v1/me/recent-items`, a private schema-v1 D1 timeline of observed weapon, armor, catalyst-acquired, catalyst-completed, and stackable inventory-gain events. It establishes a silent baseline for every category, refuses to zero inventory observations from incomplete snapshots, uses retry-stable event identities, preserves events for 30 days, caps displayed reads at 200, coalesces identical material gains observed within ten minutes at presentation time, and orders its one-row pager by the latest observation. Observation runs across signed-in Guardian Nexus pages while the site is open, even when the Fireteam row is hidden. Catalysts are chronological events rather than pinned current-state cards. Weapon cards show explicit community roll-match percentages; armor remains Power-only. Times describe Guardian Nexus snapshots, never exact acquisition.

The Gear `Loot` workspace now consumes that durable recent-item timeline rather than rebuilding a gear-only list from current inventory. It presents three independent full-width paged rails: Recent Weapons, Recent Armor, and Recent Loot. Every rail runs newest-left to oldest-right across the selected 1/3/7/14/30-day window; the 30-day retained history is the default. The Loot rail is deliberately limited to catalysts, Exotic Engrams, stackable materials, and other miscellaneous inventory gains. The tab count comes from the same event stream, search spans every category, gear-tag filtering applies only where a physical gear snapshot exists, and incomplete weapon cards say `Roll unknown` instead of the generic `Bungie data` label.

The Fireteam activity release adds a combined recent-find and short-message feed. It promotes Exotic Engram gains to an explicit recent-item event and shares only weapon, armor, catalyst-acquired, and Exotic Engram finds; materials and catalyst-completion events stay out. Entries are restricted to enabled, actively shared members of the viewer's current Bungie party. Messages use a stable current-party channel key, require another enabled synced member, accept at most 240 normalized characters, allow three sends per ten seconds, expire after seven days, and share the same bounded 60-entry chronology as finds. Shared gear strips private tags, dismissal state, and owner-character IDs while retaining the existing themed item tooltip and weapon rating. The D1 migration is `0017_fireteam_activity_feed.sql`.

The `codex/remove-fireteam-readiness` follow-up removes the Fireteam Readiness editor/member summaries and the redundant Fireteam signal/location/sharing strip. The API keeps backward-compatible stored readiness parsing, but the browser no longer fetches Builds for it or writes readiness. Fireteam Activity defaults enabled for legacy and new shares unless explicitly disabled. Its UI is a fixed bottom-right messenger-style window with minimize, hide/restore, and disable/enable controls. It starts pinned; Pop out makes it draggable and resizable within the viewport, and the account-scoped local preference remembers mode, position, and dimensions. Resize and restored-state clamping keep it recoverable after viewport changes.

Live QA after PR #89 exposed a legacy-default migration edge: the previous opt-in client had automatically persisted `activityFeedEnabled: false`, making those values indistinguishable from a player click. The narrow `codex/fireteam-activity-default-migration` follow-up adds `activityFeedPreferenceSet` to the internal share payload. Legacy unmarked false values migrate to enabled; the Options/Fireteam Disable action writes the marker and remains durable; background refresh no longer submits or rewrites the preference.

The `codex/fireteam-activity-tooltip-overlay` follow-up renders activity item details through a document-level portal rather than inside the floating window. The overlay uses fixed, viewport-clamped placement beside the triggering item, stays above the site and activity window, repositions on scroll/resize/content-size changes, and retains hover/focus interaction while crossing the portal boundary.

The same follow-up simplifies the Fireteam Recent Loot rail: the left cell contains only the title, while timeline scope/count/history controls live in a thin header and snapshot/reconnection notes live in a footer. Xûr's canonical visit schedule is corrected to Bungie's 17:00 UTC reset (Friday arrival through Tuesday weekly reset), which is noon CDT while daylight saving time is active.

Fireteam loot lines use a compact rarity-colored diamond before a small item thumbnail and item name. The diamond contains the Destiny manifest tier number (Exotic 6, Legendary/Superior 5, Rare 4, Common 3, Uncommon/Basic 2, Currency 1, unknown 0) as a dark hollow-style numeral for rapid scanning; item names retain their rarity color and open the same detailed tooltip.

Gear now also has a dedicated Vault tab after Loot. It combines only physical vaulted weapons and armor, supports item kind, slot, rarity, weapon type/element, armor class, lock, tag, search, sort, and six-stat base/current range filters, and renders large result sets in bounded 120-item increments. Existing private tags and Bungie-supported lock, pull, and equip actions are reused. Bungie's third-party API exposes no delete/dismantle operation, so the workspace explicitly sends filtered cleanup candidates through the private Junk tag for in-game verification instead of claiming unsupported deletion.

The Vault icon-card footer no longer tries to fit three large action buttons beside the compact tag picker. Each card now has one matching 28px circular item-actions trigger that opens a themed, keyboard-accessible Lock/Unlock, Pull to Guardian, and Equip menu above the card. The menu closes on selection, outside pointer input, or Escape; action colors follow the existing gold/cyan/success palette, and the original Gear API call shapes and confirmation boundary remain intact.

The current objective-icon release replaces Bungie's bracketed objective markers such as `[Auto Rifle]` and `[Headshot]` with the corresponding compact Destiny weapon/combat symbols. One shared renderer covers the compact Seasonal Hub Orders rail, Fireteam shared tracked items, quest cards, expanded routes, full quest details, and the quest inspection overlay. It inventories every marker present in the deployed pursuit manifest, uses Bungie's existing element art, vendors the CC0 Destiny weapon symbols at pinned source commit `394ed05`, preserves tooltip and screen-reader labels, and leaves unknown future markers as text instead of hiding them.

## Current repository state

- Checkout: `C:\Users\Erebu\OneDrive\Documents\GitHub\D2-Collections`
- Current implementation branch: `codex/objective-icons-live-handoff`, a documentation-only checkpoint after the complete objective-icon release in PRs #96-#99. The production-proof size constraint lives inline on the shared renderer so generic card image rules and CSS minification cannot stretch compact markers.
- Base branch: `main`; use `git rev-parse HEAD` for the current tip. The Fireteam activity product merge is `1b996632927c6dcc37be986ce1f3ebe16fcd187e` (PR #86), followed by its delivery-state handoff merge `48bd7ed3441b237708f0545ec527fdf27ae2ad75` (PR #87).
- Remote: `https://github.com/ErebusAres/D2-Collections.git`
- Foundation commit: `bd3e875` (`Add Build Advisor planning foundation`)
- Weapon workspace commit: `c2282b7` (`Add private weapon roll workspace`)
- Use `git rev-parse HEAD` for the latest validated roadmap slice; this handoff intentionally avoids a self-referential stale tip SHA.
- Completed pull request: `https://github.com/ErebusAres/D2-Collections/pull/53`
- PR #53 merged and deployed successfully through workflow run `30721416376`.
- The pre-existing untracked `.codex-remote-attachments/` directory is unrelated and must not be staged.
- Production deployed merge commit `3409a83bd008f04d46bbac2394bd899853c8241c` successfully through Guardian Nexus workflow run `31284667912` on 2026-08-08 before the current Gear Loot follow-up.
- Previous Fireteam activity validation on 2026-08-08: archive/source/CSS boundaries, ESLint, every TypeScript target, 193 API tests, 259 web tests, 24 domain tests, tooling/Python tests, API and Web production builds, and performance budgets all passed. Entry output was 365,120 bytes JavaScript (112,518 bytes gzip) and 33,043 bytes CSS. The current follow-up's full audit and deployment must replace this checkpoint after completion.
- PR #86 merged and deployed successfully through production workflow run `31280373982`; additive migration `0017_fireteam_activity_feed.sql`, API, and Web deployment all passed. Signed-in production QA confirmed the opted-out existing-share state, correct placement below member quest tracking and above Social, disabled solo composer, minimize/restore controls, and zero browser console errors.
- Gear Loot follow-up validation on 2026-08-08: full `pnpm run audit` passes archive/source/CSS boundaries, ESLint, every TypeScript target, 24 domain tests, the complete API and web suites including the new three-rail categorization/paging regressions, tooling/Python tests, API and Web production builds, and performance budgets. Output is 365,120 bytes entry JavaScript (112,531 bytes gzip) and 33,043 bytes CSS. PR #92 merged as `b7db01775b2b5a3fca439d1ce4efad7067828069`; production workflow `31285363245` refreshed manifests/ratings, reran the audit, applied migrations, and deployed the API and web successfully. Signed-in production QA confirmed a 30-day default with 22 real events split into 6 Recent Weapons, 6 Recent Armor, and 10 miscellaneous Recent Loot gains; all three rows expose independent edge arrows/page counts, a Service Revolver opened the complete themed stat tooltip, the generic `Bungie data` card label was absent, and the browser console had zero errors.
- Compact Vault action follow-up validation on 2026-08-08: full `pnpm run audit` passes archive/source/CSS boundaries across 38 stylesheets, ESLint, every TypeScript target, 24 domain tests, the complete API and 264-test web suites, tooling/Python tests, production builds, and performance budgets. Output is 365,157 bytes entry JavaScript (112,548 bytes gzip) and 33,043 bytes CSS. PR #94 merged as `61e269b6e0c845319a9977caef92086550045f93`; production workflow `31286055350` refreshed manifests/ratings, reran the audit, applied migrations, and deployed the API and web successfully. Signed-in production QA narrowed 1,185 real Vault items to three Apotheosis Veil cards, confirmed each 104px card had one 28×28 circular action trigger beside its tag control, opened the themed Unlock/Pull to Guardian/Equip menu, verified Escape dismissal, and invoked no Bungie inventory mutation. Console entries were limited to external browser-extension connection messages rather than Guardian Nexus application failures.

- Objective requirement icon validation on 2026-08-08: full `pnpm run audit` passes archive/source/CSS boundaries across 39 stylesheets, ESLint, every TypeScript target, 24 domain tests, 194 API tests, 266 web tests, tooling/Python tests, production builds, and performance budgets. Output is 365,322 bytes entry JavaScript (112,616 bytes gzip) and 33,043 bytes CSS. PRs #96-#99 are merged; final implementation merge `7a2505c99ba7663b68161affb204a9b82610aebb` deployed successfully through workflow `31287925611`. Signed-in production QA found five real Seasonal Hub Orders, zero raw bracket markers, and loaded Solar and Trace Rifle icons with matching title/alt labels, `object-fit: contain`, and compact 14.8x9.4px rendered dimensions.

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
60. Added a dedicated combined Vault workspace with vault-only physical gear, broad weapon/armor metadata filters, six-stat base/current ranges, bounded rendering, private tags, and supported lock/pull/equip actions. Dismantling remains explicitly in-game because Bungie's API has no third-party delete operation.
61. Reworked first-observed Loot into compact icon cards with Power on every item, weapon-only community percentages, keyboard/touch inspection, and a Guardian-themed detail surface containing identity, tracker value when Bungie returns it, weapon stat bars, masterwork, perks, provenance, and explicit unknown states. Armor cards intentionally show no rating.
62. Replaced the empty weapon-rating placeholder with a generated schema-v2 dataset covering 1,220 current weapon definitions from the default DIM Voltron community wishlist. `pnpm ratings:sync` refreshes it; PvE/PvP weights and the exact formula are documented in `docs/WEAPON_RATINGS.md`.
63. Added the independent `/support` route and `/api/v1/support/diagnostics` endpoint. The page renders without `GuardianProvider`, probes only the current session, preserves Bungie HTTP/application error fields, tests every linked membership with Profiles/Characters, detects 1601/wrong-platform/stale-mapping/zero-character states, exercises the real profile loader and account normalizer, checks sanitized D1/session/build state, and copies text or JSON only on explicit user action.
64. Corrected OAuth completion to probe all returned Destiny memberships and prefer a verified usable D2 profile over an unusable primary/first entry. Cross Save and primary membership remain ranking signals rather than unverified assumptions.
65. Corrected Fireteam Seasonal Hub order completion precedence. An observed incomplete-to-complete transition now enters the shared `CompletionPing` pipeline and displays `Order complete` before the active rail cleans up the completed order; it is no longer treated as an unexplained dismissal.
66. Restored Fireteam Recent Loot after the icon-card redesign: the compact bar now reserves the cards' full interaction height and keeps its tag control visible, shows the five newest items first observed within seven days even after tagging, refreshes visible gear every 60 seconds when auto-refresh is enabled, and sits directly below Fireteam Readiness and above the tracked-item/member segment.
67. Replaced the schema-v2 perk-coverage heuristic with an evidence-backed schema-v3 roll evaluator. Exact DIM Voltron records now use normalized column weights of 0.25/0.25/1/1, separate PvE/PvP scores, stable Excellent/Strong/Mixed/Weak/Poor tiers, and explicit high confidence. All 17 current weapon types have lower-confidence fallback profiles for weapons without exact source entries; unseen evidence remains unrated rather than being treated as bad. The tooltip exposes basis, confidence, applicable-column coverage, reasons, source, and review date.
68. Expanded Fireteam Recent Loot from a fixed five gear cards plus two legacy catalyst chips to a persisted 12/24/48-card mixed grid, defaulting to 24. Gear and catalyst entries remain private, a bounded catalyst reservation prevents either category from disappearing when both are populated, and catalyst observations now use the same themed icon-card and tooltip language as new weapons and armor. The preference API now explicitly accepts both the visibility and display-limit keys.
69. Refined Fireteam Recent Loot into a single responsive row with explicit previous/next page arrows and a page counter. The row calculates its page size from available width, retains the larger 12/24/48 history choices, exposes weapon rating percentages/quality instead of suppressing them in compact mode, and replaces finished-catalyst `Complete` text with a green check, 100%, and `Masterworked` language.
70. Replaced Fireteam's mixed current-state list with a private, versioned item-event timeline. It detects physical weapon/armor instances, catalyst acquisition and completion transitions, and positive stackable-inventory deltas; coalesces rapid identical material gains into `×N`; retains chronological events after items leave current inventory; and pages the full retained timeline newest-left without pinning catalysts. Migration `0016_recent_item_timeline.sql`, API module tests, UI ordering/quantity tests, and the `/api/v1/me/recent-items` contract are the maintenance boundary.
71. Rebuilt Gear's Loot workspace around `/api/v1/me/recent-items` with separate Recent Weapons, Recent Armor, and miscellaneous Recent Loot rails. Each full-width row pages its complete filtered history newest-left to oldest-right; the miscellaneous rail contains catalysts, engrams, materials, and other inventory gains, while physical gear keeps its themed cards, tooltips, tags, and honest roll-rating state.
72. Replaced the Vault cards' overflowing inline Lock/Pull/Equip buttons with one compact themed item-actions trigger and a labeled keyboard-accessible flyout, preserving the same supported Bungie operations and equip confirmation.
73. Replaced Bungie's space-heavy bracket objective markers with compact accessible Destiny icons across Fireteam Orders and every quest progress surface. The renderer covers all markers in the current pursuit manifest, preserves unknown markers as readable text, and vendors the source-pinned CC0 weapon/combat SVGs for reliable production delivery.

## Files in release scope

- `apps/api/src/buildAdvisor.ts`
- `apps/api/src/buildAdvisor.test.ts`
- `apps/api/src/index.ts`
- `apps/web/index.html`
- `apps/web/src/pages/BuildAdvisorPage.tsx`
- `apps/web/src/pages/BuildAdvisorPage.module.css`
- `apps/web/src/components/gear/WeaponWorkspace.tsx`
- `apps/web/src/components/gear/WeaponWorkspace.test.tsx`
- `apps/web/src/components/gear/VaultWorkspace.tsx`
- `apps/web/src/components/gear/VaultWorkspace.test.tsx`
- `apps/web/src/components/gear/VaultWorkspace.module.css`
- `apps/web/src/components/gear/RecentLoot.tsx`
- `apps/web/src/components/quests/ObjectiveRequirementText.tsx`
- `apps/web/src/components/quests/ObjectiveRequirementText.module.css`
- `apps/web/src/components/quests/ObjectiveRequirementText.test.tsx`
- `apps/web/src/components/quests/QuestInspectPanel.tsx`
- `apps/web/public/icons/destiny/objectives/`
- `apps/web/src/pages/FireteamPage.tsx`
- `apps/web/src/pages/QuestsPage.tsx`
- `apps/web/src/pages/QuestDetailPage.tsx`
- `apps/web/src/components/gear/RecentLoot.module.css`
- `apps/web/src/components/gear/LootWorkspace.tsx`
- `apps/web/src/components/gear/LootWorkspace.test.tsx`
- `apps/web/src/pages/SupportPage.tsx`
- `apps/web/src/pages/SupportPage.module.css`
- `apps/api/src/supportDiagnostics.ts`
- `apps/web/public/data/weapon-value.v4.json`
- `apps/web/src/modules/loot/weaponEvaluator.ts`
- `apps/web/src/modules/loot/weaponEvaluator.test.ts`
- `apps/api/src/gear.ts`
- `apps/api/test/gear.test.ts`
- `packages/contracts/src/index.ts`
- `tools/sync-weapon-ratings.mjs`
- `docs/WEAPON_RATINGS.md`
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

The following passed on 2026-08-07:

- `pnpm run audit`
- archive boundary audit
- frontend source-boundary audit
- CSS-module usage audit
- ESLint with zero warnings
- TypeScript checks for contracts, domain, API, web, service worker, and edge functions
- 24 domain tests
- 176 API tests
- 240 web tests
- Node tooling tests
- 19 Python manifest tests
- API and web production builds
- performance budgets: 364,482 bytes JavaScript, 112,355 bytes gzip, and 32,989 bytes entry CSS
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

## 2026-08-07 Loot cards and support diagnostics follow-up

- Working branch: `codex/gear-cards-support-diagnostics`, based on `main` at `38e4caa`.
- Implemented: icon-first Loot cards; Power on armor/weapons; no armor rating; detailed themed tooltip; Bungie weapon stats/tracker normalization; schema-v2 DIM Voltron rating artifact and refresh script; independent `/support` UI; sanitized current-session diagnostics endpoint; all-membership profile probes; ErrorCode 1601 diagnoses; stale/wrong membership detection; normal bootstrap profile/normalizer validation; corrected OAuth membership selection.
- Source-backed rating artifact: `apps/web/public/data/weapon-value.v2.json`, 1,220 current weapon records generated on 2026-08-07. It loads once as a cacheable runtime asset so the Loot route stays inside its JavaScript performance budget. Refresh with `pnpm ratings:sync`; method and provenance are in `docs/WEAPON_RATINGS.md`.
- Validation completed: full `pnpm run audit` passed on 2026-08-08, including archive/source/CSS boundaries, lint, every TypeScript target, 24 domain tests, 178 API tests, 242 web tests, Node tooling, 19 Python tests, production API/web builds, and performance budgets. The final entry bundle is 364,877 bytes JavaScript (112,468 bytes gzip) and 33,043 bytes CSS; the Loot chunk is 14,980 bytes rather than bundling the 999,751-byte rating catalog.
- Local visual QA completed for the independent `/support` route. The Gear route itself requires a reachable authenticated API session to populate real cards; automated card/evaluator coverage passed. Remaining before release: inspect the final diff, commit/push/PR/merge/deploy, then verify production. Keep `.codex-remote-attachments/` untracked and excluded.
- Production verification should include an unauthenticated `/support` load, an authenticated diagnostics run, Copy Report/Copy JSON, a known valid account, and—when available—the recovered/no-initialized-profile test case. The page never accepts arbitrary membership IDs and must continue returning only current-session data.
- Read-only invariant: `/support` decrypts only an unexpired current access token and passes it into the real `profileFor` loader. It must not call the rotating `accessTokenFor` helper, update/delete `oauth_sessions`, or otherwise mutate Guardian Nexus/Bungie state. An expired token is reported explicitly with `refreshAttempted: false` and a sign-in next step.
- Production smoke check on 2026-08-08 confirmed `/support` ran all 10 stages successfully for a signed-in account, Copy Diagnostic Report worked, the deployed frontend identified merge `1d3b1ef`, the runtime rating asset exposed schema v2 with 1,220 records, and live Gear rendered power-only armor plus rated/unrated weapon cards. A click/focus race found during this check was corrected immediately so touch/click reliably opens the detail tooltip.

## 2026-08-08 Recent Loot and rating hardening

- Shipped through PR #82 and merge `036d7db42c6f58d706b398d3f322876b12b74e60`; the production Guardian Nexus workflow run `31273219961` completed successfully.
- Silent first baseline now covers physical weapons and armor as well as catalysts and stackable inventory. Existing vault contents are not emitted as new-account loot.
- Inventory observations advance to zero only when both Bungie inventory containers and the companion manifest are complete. A partial component or manifest outage therefore cannot turn a recovered material stack into a false gain.
- New event IDs are deterministic for their source transition and inserts use `INSERT OR IGNORE`, making a retry or concurrent observer safe after an event write. Material deltas remain separate stored observations and coalesce into `×N` only in the read model; ordering uses `lastObservedAt`, so a newly enlarged stack returns to the left.
- The global signed-in shell observes the timeline every normal live-refresh interval while Guardian Nexus is open, including when the Fireteam row is hidden. This still cannot detect a physical item acquired and dismantled entirely while the site is closed, or reconstruct gross material drops that were spent between Bungie snapshots; UI language says observed timeline rather than every exact pickup.
- Fireteam distinguishes loading, baseline, warning, and error states; exposes retry, retention, and last-check context; resets to the newest page for a genuinely new leading event; provides compact event cards without empty action strips; constrains edge tooltips; labels Postmaster gear correctly; and supports Escape/toggle inspection.
- Weapon rating schema v4 preserves DIM-curated trait pairings, uses equal per-source-column weight rather than an undocumented 4× opinion, calls the result a roll match, and retains separate PvE/PvP, exact/type basis, confidence, evidence, source, and honest unavailable states. The hardened DIM block-note parser generated 1,194 exact current-weapon records plus all 17 type fallbacks on 2026-08-08. The browser validates `/data/weapon-value.v4.json` and retries transient failures.
- Both production deployment and the scheduled manifest refresh now regenerate ratings after the Bungie manifest, preventing new-definition drift. `docs/WEAPON_RATINGS.md`, generator tests, evaluator tests, timeline tests, runtime data, and handoff must move together on future schema changes.
- Full `pnpm run audit` passed outside the known OneDrive/esbuild sandbox restriction: archive/source/CSS boundaries, ESLint, every TypeScript target, 24 domain tests, 186 API tests, 257 web tests, 7 Node tooling tests, 19 Python manifest tests, production API/web builds, and performance budgets of 365,109 bytes entry JavaScript (112,531 gzip) and 33,043 bytes CSS.
- Live verification after deployment returned HTTP 200 for `/fireteam` and `/data/weapon-value.v4.json`. The production catalog reports schema v4, review date 2026-08-08, 1,194 reviewed weapons out of 2,208 manifest weapons, and all 17 supported type profiles. The legacy v3 URL remains present in Cloudflare's immutable asset history, but current application code requests only v4.
- Authenticated production QA on 2026-08-08 confirmed that Fireteam renders readiness before the one-row Recent Loot timeline, clearly reports saved-data/reconnect and zero-event baseline states, disables unavailable paging, and emits no browser warnings or errors. That account had no captured events yet, so live weapon/catalyst card interaction still requires a future observed drop. The same pass exposed duplicate cross-save clan rows; API normalization now collapses rows sharing a complete globally unique Bungie Name, prefers a confirmed-online platform identity, and preserves combined friend/clan status.

## Next implementation queue

### Superseded historical milestone: Evidence-backed weapon ratings v3

- Replaced the schema-v2 any-column/pair heuristic with exact DIM Voltron column comparisons using `0.25, 0.25, 1, 1` weights. Bungie-normalized sockets now carry optional rating positions so frames, intrinsics, mods, and other non-wishlist sockets cannot shift the comparison.
- Added separate PvE/PvP and overall scores, Excellent/Strong/Mixed/Weak/Poor tiers, exact-vs-type basis, high/medium/low confidence, applicable-column coverage, reasons, source, and review date to the existing icon-card/detail UI.
- The generated schema-v3 asset contains 1,220 exact weapon records from the current Voltron snapshot and lower-confidence fallback profiles for every one of the Gear manifest's 17 weapon types. Missing comparison evidence remains Unrated and does not become zero.
- Validation on 2026-08-08: archive/source/CSS boundaries, ESLint, all TypeScript targets, 452 Vitest tests, 7 Node tooling tests, 19 Python manifest tests, API/Web production builds, and performance budgets all pass. Entry output remains 364,883 bytes JavaScript (112,489 bytes gzip) and 33,043 bytes CSS; the rating artifact remains a separately cached runtime file.
- Refresh procedure and methodological limits are in `docs/WEAPON_RATINGS.md`. Regenerate with `pnpm ratings:sync`; change the schema, generator test, evaluator tests, docs, and runtime artifact together.

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

#### Retired: Fireteam readiness

- The readiness editor and member-card summaries were removed from `/fireteam` because they duplicated preparation information without enough player value.
- The adjacent Fireteam signal/current-location/sharing status strip was also removed; the page header, sharing controls, and member cards already communicate those states.
- The Web component, CSS, draft parser, and their tests were deleted. Fireteam no longer fetches Builds solely for readiness or submits readiness changes.
- API contracts, validation, stored preference compatibility, and existing share-payload preservation remain temporarily intact so older data and rolling clients are not corrupted.

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
