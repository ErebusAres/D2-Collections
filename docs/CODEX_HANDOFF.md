# Guardian Nexus Codex handoff

Last updated: 2026-08-10

This file is the operational handoff for Chris Codex or another maintainer continuing the current Guardian Nexus roadmap implementation. Keep it current when scope, validation, or publish state changes.

## Current objective

### 2026-08-10 single Fireteam presence authority

The remaining member-card flip-flop had four deterministic paths. Full quest/order share refreshes and narrow presence refreshes both replaced the same party fields using different Bungie component sets, so their completion order could alternate the saved party. Progress refreshes now preserve an established presence snapshot, and their D1 upsert atomically carries forward the newest stored party/location/online fields so an older in-flight request cannot overwrite them. Only the narrow presence refresher advances those fields. A transient Worker failure can no longer restore cached teammate cards from IndexedDB; Fireteam fallback retains only the viewer's own card with presence and activity claims removed. Bungie's potentially stale party list can no longer prove the viewer online and thereby authorize itself for display: teammate cards require an independently live character session. Finally, presence used to become undisplayable after two minutes despite the page's five-minute coordinator, guaranteeing a remove/background-refresh/restore cycle. Refresh-due state and display-usability are now separate: the response can request its short follow-up without dropping a bounded last-known party. Temporary sharing renews non-blockingly while issuing only one core read instead of racing two reads. Fireteam activity and social query caches are membership-scoped, IndexedDB response writes are ordered per cache key, and the header resolves its character from the shared selected-character state.

The follow-up CI run exposed that awaiting a queued temporary-share renewal can block the core Fireteam read and prevent the coordinator from scheduling its next cycle during an outage. Renewal is therefore non-blocking again, but unlike the old implementation it does not launch a second core read when the write eventually succeeds. The primary Fireteam query key now includes membership ID, and all non-session React Query data is discarded when the authenticated membership changes, preventing same-character IDs or recent-item caches from crossing accounts. D1 now provides a two-minute presence-refresh lease so simultaneous tabs and stale-response collectors cannot launch duplicate Bungie presence calls for the same Guardian. The support diagnostic reports whether that lease is active.

The browser API fallback previously accepted an older IndexedDB record after a newer live response whenever a subsequent request failed before the asynchronous disk write completed. This could alternate the visible page between current and held data. Every exact path now retains its newest successful envelope in memory, uses that before disk fallback, and rejects a successful response whose `observedAt` predates the accepted envelope. The map is cleared on membership change. The primary Fireteam query no longer polls at 15 seconds, refetches on focus, or refetches when another observer mounts; it has one initial GET and the route coordinator's one GET per five-minute cycle.

### 2026-08-10 stale-member recurrence and duplicate refresh removal

The persistent Fireteam page could continue showing a saved teammate after everyone left Destiny. The five-minute browser share rebuild updated `presence_refreshed_at` before the narrow presence refresher could run, but `storeShare` did not apply the existing directly-offline party collapse. The same full persistent share was also rebuilt by the five-minute Worker cron, duplicating Bungie profile and manifest work once per open browser tab. Both share and presence paths now use one tested viewer-party resolver; an account with no character session minutes collapses immediately to self, clears retained activity, and stores the viewer offline. Persistent share rebuilding is cron-owned, while temporary 15-minute shares still renew from the browser.

The three Fireteam query declarations in the route, page, and Options panel now reuse one query hook and a 30-second stale window. React Query retains its single cache entry and avoids remount fetches across those observers. Posting a Fireteam Activity message invalidates only Activity instead of also reloading core member presence. The five-minute page coordinator continues to refresh pursuit/order status, bounded core Fireteam presence, and Recent Items independently.

### 2026-08-09 recurrence: durable account bootstrap and party preservation

The Fireteam core now follows the site's enabled 60-second live-refresh cadence again. Each core read remains a bounded D1 response, but a presence snapshot at least 60 seconds old schedules the narrow Bungie presence refresh in the background, so subsequent polls advance party recovery without requiring a reload or manual "Refresh all data" action. During the existing three-confirmed-solo grace period, retained teammates are marked unobserved and therefore render with unknown presence instead of remaining falsely online; the third confirmed solo observation removes them. Cloudflare 1102 fallback remains route-scoped and cached Fireteam presence older than two minutes is still stripped of online/activity claims.

A production follow-up found that Bungie's transitory party component can itself remain stale after the viewer leaves Destiny. A directly loaded selected character with zero session minutes now overrides that stale party claim: the saved current party collapses to self immediately, the viewer is stored/rendered offline, and retained activity is cleared. The three-observation grace remains only for an online viewer whose otherwise-present transitory component briefly reports solo.

The next reliability follow-up keeps the 60-second tracked-progress share sync from blocking the read-only Fireteam and quest refetches. Only one share sync may remain pending while live reads continue on schedule. A viewer presence snapshot older than two minutes no longer supports any current teammate cards in the response; the saved party remains available internally for a later successful Bungie recovery, but the UI shows only self until that recovery is fresh.

Client saved-data warnings now clear every cached failure variant for a route after that route succeeds. Abandoned failures from unmounted or old-character queries age out after two minutes during subsequent live reads, preventing an obsolete Social or character-specific request from leaving the global connection control permanently interrupted.

Signed-in production testing reproduced the user's report as two related symptoms: the Fireteam page initially rendered only `ErebusAres#0634` from saved data, while the global connection control remained in its saved-data/over-capacity state. The next bounded presence refresh recovered the current three-member party, proving that the D1 core read was healthy but a refresh had temporarily collapsed the saved party. The cause is deterministic: `storeShare` intentionally uses the `fireteam-share` Bungie component set without component 1000, but treated the omitted transitory component as an observed solo party and rewrote `activityPartyMembers` to self-only. `refreshFireteamPresence` had the same collapse behavior whenever Bungie omitted the requested transitory component.

Branch `codex/fireteam-session-cache` preserves the last verified at-most-12 party whenever transitory data was not returned; a real returned empty party remains authoritative and can still transition the user to solo. The regression helper explicitly distinguishes “component absent” from “component present with no teammates.” This prevents explicit and scheduled tracked-progress refreshes from erasing valid member cards.

The remaining global Worker risk was outside `/api/v1/fireteam`: the always-on `/api/v1/session` and `/api/v1/me/rewards` requests still parsed Bungie account data and reward manifests on their response paths. Migration `0020_guardian_session_cache.sql` adds durable account and per-character Rewards Pass snapshots. Both routes now return fresh or stale D1 data immediately, remove live presence claims from stale account data, and refresh through `waitUntil`. A two-minute D1 lease prevents concurrent tabs and 60-second refreshes from starting duplicate Bungie work; failed refreshes release or age out the lease while the last snapshot remains usable for 24 hours and beyond as explicitly stale data. Existing persistent Fireteam shares seed a safe minimal account snapshot during migration rollout, so established users do not need one successful expensive bootstrap before the route can respond. The session profile no longer requests unrelated transitory component 1000, and the web session query does not retry Cloudflare 1102 responses.

Support diagnostics now expose account-cache age/state, refresh-in-progress state, and the last refresh failure alongside the existing Fireteam presence and Social cache details. The complete `pnpm run audit` passes archive/source/CSS boundaries across 40 stylesheets, ESLint, every TypeScript target, 24 domain tests, 201 API tests, 271 Web tests, tooling tests, 21 manifest Python tests, production API/Web builds, and performance budgets at 367,440 bytes JavaScript (113,264 gzip) and 33,043 bytes CSS. PR/merge/deploy, repeated signed-in production acceptance, and final workflow evidence remain pending at this checkpoint.

PR #109 passed workflow `31297541444`, squash-merged as `da1d1052ae8a931d051e409e9709d3a43c5d2ae5`, and deployed successfully through production workflow `31297609585`, including migration `0020_guardian_session_cache.sql`. The first signed-in production load immediately confirmed the global connection state was healthy and Recent Loot, Activity, and Social all rendered without 1102. It also exposed one narrower remaining case: Bungie returned a present-but-empty transitory party, which the first release considered authoritative and reduced the stored party to self. Follow-up branch `codex/fireteam-party-grace` requires three consecutive successful solo observations before clearing a previously verified multi-member party. Missing transitory data never increments the counter, and any observed teammate resets it. This intentionally allows stale member cards with unknown presence for a few minutes instead of letting one flaky Bungie response erase the party. The complete repository audit passes for this follow-up with 24 domain, 201 API, 271 Web, and 21 manifest tests plus all typechecks, builds, source-boundary checks, and performance budgets; its PR/merge/deploy and production member-card recovery remain pending.

PR #110 passed workflow `31297973909`, squash-merged as `f5b08f0c859d675df4a8fe7dd27e673db0514bf0`, and deployed successfully through production workflow `31298056632`. Signed-in production remained connected and all independent Fireteam sections rendered, but a forced refresh could not reconstruct the already-overwritten party. The recovery trace found that `storeShare` and scheduled presence refreshes read component 1000 while the `fireteam-share` Bungie profile request did not request it. Follow-up branch `codex/fireteam-party-recovery` adds only component 1000 to that write/refresh profile mode and asserts it in the API suite; the lightweight Fireteam read endpoint is unchanged.

PR #111 passed workflow `31298274231`, squash-merged as `a0125f3b0fdce9e01177cfe7b889c677cc9e40d4`, and deployed successfully through production workflow `31298355328`. The signed-in Fireteam page stayed connected through reload, a full account refresh, and its own 60-second share refresh; Recent Loot, Activity, and Social remained independently available. `/support` passed 11/11 diagnostic stages, including D1, compact-manifest infrastructure, session, OAuth, linked profiles, and account bootstrap, with no 1102. The Fireteam timestamp advanced after the component-1000 share write, but Bungie's current party observation still contained only the signed-in Guardian, so the already-lost member IDs could not be reconstructed during acceptance. Do not synthesize current party membership from clan or historical activity. The release is prepared to restore members on the next real Bungie party observation and then retain that known party across up to two transient solo observations. A direct Wrangler D1 metadata query was unavailable from this workstation because the local Cloudflare credential was not authorized for the production account; the private browser diagnostic remained available and passed.

The `codex/fireteam-activity-tier-diamond` follow-up restores the compact numbered diamond requested for gear finds in Fireteam Activity. It reads only the shared weapon or armor snapshot's real Bungie `gearTier`, normalizes it through the same 1-5 contract used by Gear, and renders the tier number before the existing small item icon. Tiers 1-2 use the light treatment, 3-4 purple, and 5 gold. Catalysts, Exotic Engrams, messages, materials, missing tiers, zero, and out-of-range values remain marker-free. The regression suite asserts both the Tier 4 weapon diamond and the Exotic Engram exclusion. The complete audit passes with 24 domain, 201 API, 272 Web, and 21 manifest tests plus all typechecks, builds, source-boundary checks, and performance budgets at 367,440 bytes JavaScript (113,293 gzip) and 33,043 bytes CSS.

PR #113 passed workflow `31299143255`, squash-merged as `c63af2c1f2f8da95ebd727b5f7c00587484698c5`, and deployed successfully through production workflow `31299224457`. Live Activity inspection showed the renderer was present but the retained legacy feed rows lacked their embedded gear snapshot, so no numbered diamonds appeared there even though the same items had tiers in Recent Loot. Follow-up branch `codex/fireteam-activity-tier-rehydrate` keeps Activity D1-only and bounded while changing its existing event query to left-join the matching current observation. The current weapon/armor snapshot replaces missing or older embedded gear data, private tag/owner/dismissal fields are stripped afterward, and the UI can therefore render the same real tier without a Bungie request or an additional D1 round trip. Its complete audit passes with 24 domain, 202 API, 272 Web, and 21 manifest tests, all typechecks/builds, and performance budgets at 367,440 bytes JavaScript (113,285 gzip) and 33,043 bytes CSS.

PR #114 passed workflow `31299500861`, squash-merged as `d830c1583902e2c0a2e6d26bcbd6a673aa5273a6`, and deployed successfully through production workflow `31299582217`. Signed-in production verification confirmed the retained Activity history now exposes numbered weapon and armor tiers: visible examples included Tier 3 Infinite Paths 8 and Thunderhead Cover, Tier 4 Synchronic Roulette and Thunderhead Boots, and Tier 5 Thunderhead Gloves. The diamond precedes the existing small item icon, matches the purple/gold Guardian Nexus treatment, and leaves untiered Volta Bracket and Phyllotactic Spiral rows marker-free. The global Guardian connection remained healthy during verification.

### Fireteam Worker reliability hardening

Signed-in production reproduction on 2026-08-08 returned Cloudflare error 1102 for 6/6 `/api/v1/fireteam` requests. The responses identified a Worker resource-limit failure rather than a D1 synchronization problem. The former core route combined the 1.13 MB activity manifest, an unbounded active-share scan, public member profile resolution, Fireteam Activity, and Bungie friends/clan roster work in one request.

Branch `codex/fireteam-worker-reliability` makes the core response intentionally narrow: it loads the compact activity-name lookup, queries Fireteam shares only for the current party's at-most-12 membership IDs, trusts synchronized shares for two minutes, preserves known membership types for a single-platform public lookup, limits stale-member lookups to three concurrent requests, and omits Social and Activity data. Member lookup gaps retain saved member data instead of failing the party. Structured logs report only numeric phase durations, party size, share count, and cache state; they contain no names, IDs, tokens, or payload contents.

`GET /api/v1/fireteam/social` now owns the existing `FireteamSocialData` contract. Migration `0018_fireteam_social_cache.sql` adds account-scoped normalized D1 roster caching: 10 minutes fresh, up to 24 hours stale-usable with a `waitUntil` refresh, and a bounded isolated refresh on a miss. `/api/v1/fireteam/activity` remains D1-only. Recent Items, core member cards, Activity, and Social use distinct account-scoped browser cache keys and render independently, so a failed core route no longer removes the other Fireteam sections.

Manifest generation now writes `activity-names.json` atomically with the other static artifacts. The checked artifact is 138,690 bytes, retains every non-empty activity name from `activity-manifest.json`, and matches its version and generation timestamp. `/session`, `/overview`, `/fireteam`, Support bootstrap, and pursuit normalization use this lookup; Journey/PvP/history keep the rich manifest where required.

The web client recognizes raw Cloudflare 1102 pages as `worker_resource_limit`, retains the Ray ID in account-local Support diagnostics, skips React Query retries, and opens a route-specific 60-second circuit breaker with up to 10 seconds of jitter. Cached Fireteam presence older than two minutes is changed to `unknown` with activity removed. Saved-section warnings name only the delayed section rather than declaring the whole site over capacity. `/support` reports compact-manifest state/version, D1 reachability, Social cache age/state and last-refresh failure, request ID, inbound Ray ID, and the last browser-observed route/Ray ID without exposing account identifiers.

Release validation passes the complete `pnpm run audit`: archive/source/CSS boundaries across 40 stylesheets, ESLint, every TypeScript target, 24 domain tests, 198 API tests, 270 web tests, 21 manifest Python tests plus tooling tests, production API/Web builds, and performance budgets. Output is 367,384 bytes entry JavaScript (113,236 bytes gzip) and 33,043 bytes CSS.

PR #105 passed workflow `31292958884`, merged as `d687e08f17759604bb9287bdef2978f566f1106b`, and deployed successfully through production workflow `31293058853`. The production workflow refreshed Bungie manifests and weapon ratings, reran the audit, applied migration `0018_fireteam_social_cache.sql`, and deployed the API and web. Signed-in `/support` showed the exact frontend commit, passed 11/11 stages, measured D1 at 51 ms, compact Fireteam reliability diagnostics at 17 ms, linked-profile probes at 1,326 ms, and full bootstrap at 1,860 ms. Signed-in browser acceptance completed 25/25 Fireteam core loads with resolved member cards and zero 1102/resource-limit or circuit-breaker states; warm page loads were generally 0.97-1.40 seconds, with a 2.22-second first load and one 3.00-second outlier. Final QA showed three current member cards plus the independent 38-event Recent Loot, Fireteam Activity, and 57-member Social sections. A 15-minute post-deploy window and production tail observed no Worker exception or route-failure stream; normal page auto-refresh remained healthy. The only browser console error was an unrelated browser-extension connection message. Forced two-minute presence aging is covered by the web client regression because production QA did not mutate the signed-in browser's private IndexedDB cache. Cloudflare's tail stream did not expose billed CPU values, so exact numerical CPU headroom remains an observability limitation; the zero-1102 acceptance and route timing are the current production evidence.

Production regressed later on 2026-08-08. Direct authenticated probes reproduced Cloudflare 1102 on both `/api/v1/fireteam` (Ray `a283fdbdfe9afb0f`) and `/api/v1/me/recent-items` (Ray `a283fdddac55fb0f`) even though `/support` still completed all 11 stages. The follow-up branch `codex/fireteam-durable-snapshots` removes the remaining expensive work from both response paths. Fireteam core now performs only bounded D1 reads over the viewer's saved at-most-12 party identifiers and share payloads; it performs no Bungie profile request, manifest parse, emblem lookup, or public-member probe before responding. A stale presence snapshot becomes unknown immediately and schedules a narrow presence refresh through `waitUntil`. Migration `0019_fireteam_presence_cache.sql` records presence refresh age/error independently, and Support exposes that cache state. Future share payloads retain normalized party names, membership types, status, and IDs so the D1 core can improve as synchronization catches up.

Recent Items GET now reads the retained D1 event/observation timeline first, rehydrates current gear metadata using bounded instance batches, and returns saved history even when live observation exceeds Worker limits. Observation runs as a background continuation with a narrower Bungie component set and cannot withhold the saved response. The Fireteam page no longer performs a full `/fireteam/share` rebuild merely because the route mounted or local state initialized; explicit share, untrack, activity preference, and stop-sharing actions remain intact. The full audit passes with 199 API tests, 270 web tests, 24 domain tests, 21 manifest tests, production builds, and performance budgets at 367,384 bytes JavaScript (113,262 gzip) and 33,043 bytes CSS.

PR #107 passed workflow `31295309023`, squash-merged as `18f2c813b1ceea11b8a1a932ff85c5230865f39b`, and deployed successfully through production workflow `31295389935`; the workflow applied migration `0019_fireteam_presence_cache.sql` before deploying the Worker and Pages frontend. Signed-in `/support` confirmed frontend commit `18f2c813`, 11/11 diagnostic stages, D1 at 52 ms, Fireteam reliability at 33 ms, full bootstrap at 9 ms, and an overall 1,455 ms diagnostic response. The production Fireteam page returned 52 saved timeline events, its saved member card with stale presence correctly marked unknown, Fireteam Activity, Social, and the global connected state. Ten consecutive signed-in page loads completed in 1.85-1.89 seconds with all four independent sections present and zero 1102, resource-limit, over-capacity, or saved-data fallback states. Direct raw API navigation is blocked by the browser-control safety client after deployment, so the post-release acceptance verifies the same core and Recent Items requests through their rendered independent sections rather than another raw document navigation.

The original roadmap and catalog corrections are live on `main`. Build Advisor template set v7 has 72 reviewed foundations: 24 per class and exactly four core-Exotic paths for every subclass. It groups visible recommendations by subclass and generates up to 24 additional account-specific variants when a different physical owned weapon strongly matches a reviewed template's bounded role. Generated variants never infer unsupported subclass setups or ownership. Build checklist tracking remains privacy-scoped to Fireteam.

The Alerts & Watches page has been removed from navigation, routing, mobile shortcuts, and the PWA shortcut list pending a later product rethink. Existing private watchlist preference parsing remains for backward compatibility with Build Advisor and Weapon Rolls data. Loadouts now includes a separately labeled live Equipped area, honest partial/unavailable states, collapsible cards with icon previews, and a header-docked horizontal jump frame. Saved-loadout markers reuse Bungie's returned icon and color assets, retain the in-game slot number, and expose viewport-aware name/class/element tooltips.

Guardian Share Cards have also been retired as a creation surface because they duplicated public Builds and Fireteam readiness while becoming stale manually. The primary navigation and Projects link are removed, and POST creation returns a retired-feature response. Legacy `/snapshots` management and unlisted direct links remain available solely so existing account-private cards are not deleted or made impossible to review and revoke.

Mobile/PWA promotion is paused. The Options installer, `beforeinstallprompt` listener, mobile quick-action dock, web-app manifest, and service-worker build/cache path are removed. Startup unregisters older Guardian Nexus service workers so previously installed caches do not keep serving stale bundles. Ordinary responsive CSS remains for narrow browser windows, but mobile-specific product work is not active scope.

Gear loot management uses the existing private `gear_item_state` source of truth. Fireteam consumes `/api/v1/me/recent-items`, a private schema-v1 D1 timeline of observed weapon, armor, catalyst-acquired, catalyst-completed, and stackable inventory-gain events. It establishes a silent baseline for every category, refuses to zero inventory observations from incomplete snapshots, uses retry-stable event identities, preserves events for 30 days, caps displayed reads at 200, coalesces identical material gains observed within ten minutes at presentation time, and orders its one-row pager by the latest observation. Observation runs across signed-in Guardian Nexus pages while the site is open, even when the Fireteam row is hidden. Catalysts are chronological events rather than pinned current-state cards. Weapon cards show explicit community roll-match percentages; armor remains Power-only. Times describe Guardian Nexus snapshots, never exact acquisition.

The Gear `Loot` workspace now consumes that durable recent-item timeline rather than rebuilding a gear-only list from current inventory. It presents three independent full-width paged rails: Recent Weapons, Recent Armor, and Recent Loot. Every rail runs newest-left to oldest-right across the selected 1/3/7/14/30-day window; the 30-day retained history is the default. The Loot rail is deliberately limited to catalysts, Exotic Engrams, stackable materials, and other miscellaneous inventory gains. The tab count comes from the same event stream, search spans every category, and gear-tag filtering applies only where a physical gear snapshot exists. A weapon with identifiable active rating-column perks receives a lower-confidence provisional `Est. N%` score even when Bungie's socket snapshot is incomplete; the evaluator automatically replaces that estimate when fuller data arrives. Only weapons with no identifiable active rating evidence say `Roll pending`.

The Fireteam activity release adds a combined recent-find and short-message feed. It promotes Exotic Engram gains to an explicit recent-item event and shares only weapon, armor, catalyst-acquired, and Exotic Engram finds; materials and catalyst-completion events stay out. Entries are restricted to enabled, actively shared members of the viewer's current Bungie party. Messages use a stable current-party channel key, require another enabled synced member, accept at most 240 normalized characters, allow three sends per ten seconds, expire after seven days, and share the same bounded 60-entry chronology as finds. Shared gear strips private tags, dismissal state, and owner-character IDs while retaining the existing themed item tooltip and weapon rating. The D1 migration is `0017_fireteam_activity_feed.sql`.

The `codex/remove-fireteam-readiness` follow-up removes the Fireteam Readiness editor/member summaries and the redundant Fireteam signal/location/sharing strip. The API keeps backward-compatible stored readiness parsing, but the browser no longer fetches Builds for it or writes readiness. Fireteam Activity defaults enabled for legacy and new shares unless explicitly disabled. Its UI is a fixed bottom-right messenger-style window with minimize, hide/restore, and disable/enable controls. It starts pinned; Pop out makes it draggable and resizable within the viewport, and the account-scoped local preference remembers mode, position, and dimensions. Resize and restored-state clamping keep it recoverable after viewport changes.

Live QA after PR #89 exposed a legacy-default migration edge: the previous opt-in client had automatically persisted `activityFeedEnabled: false`, making those values indistinguishable from a player click. The narrow `codex/fireteam-activity-default-migration` follow-up adds `activityFeedPreferenceSet` to the internal share payload. Legacy unmarked false values migrate to enabled; the Options/Fireteam Disable action writes the marker and remains durable; background refresh no longer submits or rewrites the preference.

The `codex/fireteam-activity-tooltip-overlay` follow-up renders activity item details through a document-level portal rather than inside the floating window. The overlay uses fixed, viewport-clamped placement beside the triggering item, stays above the site and activity window, repositions on scroll/resize/content-size changes, and retains hover/focus interaction while crossing the portal boundary.

The same follow-up simplifies the Fireteam Recent Loot rail: the left cell contains only the title, while timeline scope/count/history controls live in a thin header and snapshot/reconnection notes live in a footer. Xûr's canonical visit schedule is corrected to Bungie's 17:00 UTC reset (Friday arrival through Tuesday weekly reset), which is noon CDT while daylight saving time is active.

Physical weapons and armor use one shared five-diamond Gear rail sourced exclusively from Bungie's nullable `DestinyItemInstanceComponent.gearTier`. Only real tiers 1 through 5 render; the number of active diamonds equals the returned tier, using the existing white/purple/gold Gear treatment. Weapons now preserve `gearTier` through API normalization just as armor already did. Fireteam Activity uses a distinct compact numbered diamond for those same valid weapon/armor tiers so the floating feed remains legible; catalysts, engrams, materials, currencies, messages, and all other non-gear events never receive a tier marker. Missing, zero, and out-of-range values render no tier. This supersedes the incorrect PR #101 rarity-number badge, which confused `DestinyTierType` rarity with the separate item-instance gear tier.

Gear now also has a dedicated Vault tab after Loot. It combines only physical vaulted weapons and armor, supports item kind, slot, rarity, weapon type/element, armor class, lock, tag, search, sort, and six-stat base/current range filters, and renders large result sets in bounded 120-item increments. Existing private tags and Bungie-supported lock, pull, and equip actions are reused. Bungie's third-party API exposes no delete/dismantle operation, so the workspace explicitly sends filtered cleanup candidates through the private Junk tag for in-game verification instead of claiming unsupported deletion.

The Vault icon-card footer no longer tries to fit three large action buttons beside the compact tag picker. Each card now has one matching 28px circular item-actions trigger that opens a themed, keyboard-accessible Lock/Unlock, Pull to Guardian, and Equip menu above the card. The menu closes on selection, outside pointer input, or Escape; action colors follow the existing gold/cyan/success palette, and the original Gear API call shapes and confirmation boundary remain intact.

The current objective-icon release replaces Bungie's bracketed objective markers such as `[Auto Rifle]` and `[Headshot]` with the corresponding compact Destiny weapon/combat symbols. One shared renderer covers the compact Seasonal Hub Orders rail, Fireteam shared tracked items, quest cards, expanded routes, full quest details, and the quest inspection overlay. It inventories every marker present in the deployed pursuit manifest, uses Bungie's existing element art, vendors the CC0 Destiny weapon symbols at pinned source commit `394ed05`, preserves tooltip and screen-reader labels, and leaves unknown future markers as text instead of hiding them.

## Current repository state

- Checkout: `C:\Users\Erebu\OneDrive\Documents\GitHub\D2-Collections`
- Current implementation branch: `codex/fireteam-tier-evidence`, based on production merge `d830c15`; the numbered Activity diamond and legacy-event rehydration are live, while only this final evidence handoff is pending release.
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
- Superseded PR #101 tier-diamond release: production inspection confirmed that the rarity-number badges rendered, but that implementation was conceptually wrong because it treated manifest rarity as gear tier and displayed badges on non-gear events and Fireteam Activity. Do not restore `LootTierBadge` or its 0-6 mapping.
- Real gear-tier and partial-rating correction validation on 2026-08-08: full `pnpm run audit` passes archive/source/CSS boundaries across 40 stylesheets, ESLint, every TypeScript target, 24 domain tests, 195 API tests, 269 web tests, tooling/Python tests, production builds, and performance budgets. Output is 365,322 bytes entry JavaScript (112,608 bytes gzip) and 33,043 bytes CSS. Focused regressions prove weapon and armor instance tiers 1-5, no markers on chat or miscellaneous loot, provisional exact/type rating scores from the known active columns in partial snapshots, and `Roll pending` only when no active rating perk is identifiable. PR #103 merged as `3c07fff18849566c5c652d18cb10f09cad529bce`; production workflow `31289684515` refreshed manifests/ratings, reran the audit, applied migrations, and deployed the API and web successfully. Signed-in production QA found only real weapon/armor tier 2, 3, and 5 rails in the current data; all 10 inspected Gear rails contained five marks and exactly the labeled count active; Fireteam miscellaneous items and all 17 Gear Recent Loot entries had no tier marker. Four partial weapons received provisional estimates instead of `Roll unknown`; the newest Cynosure showed `Est. 51%`, separate 29% PvE/73% PvP values, low confidence, Rocket Launcher fallback evidence across 56 reviewed weapons, and an explicit automatic-update explanation.

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
