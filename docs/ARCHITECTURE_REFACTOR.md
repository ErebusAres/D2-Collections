# Guardian Nexus architecture refactor

This document is the required living record for the `refactor/component-workflow`
branch. Every refactor change must update this file in the same commit so the next
section starts with the current architecture, completed work, and remaining work.

## Master rule

The Plum Creek `ProdTracker` structure is the source of truth for both the file
tree and the internal component workflow.

The required composition direction is:

```text
main.tsx
└── application providers
    └── App.tsx
        └── application shell and routes
            └── page component
                └── reusable section component
                    └── smaller focused component
```

The dependency direction must not reverse. A small component must not import a
page, a page must not contain reusable component implementations, `App.tsx` must
not contain page behavior, and `main.tsx` must only bootstrap the application.

If a planned change conflicts with this rule, stop that change, return to this
document, and restructure the work before editing more code.

## Verified ProdTracker reference

The `FearsRedemption/ProdTracker` `main` tree was re-read directly before the
external-tree migration began. Its application source is organized as:

```text
src/
├── App.tsx
├── main.tsx
├── assets/
├── components/
├── context/
├── pages/
├── theme/
└── styles.css
```

Its internal composition is also verified directly: `main.tsx` installs the
provider and renders `App`; `App.tsx` composes `AppHeader` and
`ProductSearchPage`; `ProductSearchPage` composes `SearchComponent`; and the
focused components own their own markup.

Guardian Nexus is larger and may use product-area subdirectories, `services/`,
and a shared `styles/` directory where their ownership is real. Those additions
must extend the ProdTracker structure rather than replacing its clear
application → page → section → component direction.

## File-tree rules

The web application must continue converging on the same externally visible
structure demonstrated by ProdTracker:

```text
apps/web/src/
├── App.tsx
├── main.tsx
├── assets/
│   └── data/
├── components/
│   ├── common/
│   └── <product-area>/
├── context/
├── pages/
├── services/
├── styles/
│   ├── common/
│   └── <product-area>/
└── theme/
```

- `components/` contains focused reusable UI containers, controls, and
  component helpers. Styling files do not belong in this directory.
- `assets/` contains source-controlled static inputs imported by the
  application. Static JSON must not live in a competing top-level `data/`
  directory.
- `pages/` contains route-level composition only.
- `context/` contains genuinely application-wide React state.
- `services/` contains external communication and browser infrastructure, not UI.
- `styles/` owns application styling outside the global theme. Organize styles
  under `styles/<product-area>/` or `styles/common/` rather than placing CSS
  files inside `components/` or `pages/`.
- `theme/` owns the application-wide theme entry and design tokens. `styles/`
  owns page, component, behavioral, and accessibility styling.
- Use `components/<product-area>/` when multiple components share a clear product
  genre and the subdirectory makes the tree easier to scan and understand. For
  example, Fireteam presentation belongs in `components/fireteam/` and build
  presentation belongs in `components/builds/`.
- Component subdirectories may group related components and focused component
  helpers, but they may not contain styling, become alternate application
  trees, or contain route-level pages.
- Do not introduce a competing `features/` hierarchy.
- Existing `modules/` code must be evaluated as it is touched. Pure shared domain
  rules should move to `packages/domain`; browser service behavior should move to
  `services/`; UI behavior should move with its owning component.

The same composition rule applies to the API: its entry point should assemble
feature routes, while validation, request handling, business behavior, Bungie
communication, and persistence live in smaller files with one clear purpose.

## Naming rules

- Prefer complete product terms over generic placeholders such as `data`, `item`,
  `value`, or `result` when a more specific term is available.
- Names must distinguish membership IDs, character IDs, item instance IDs, and
  definition hashes.
- Names must distinguish live, cached, stored, stale, and displayed snapshots.
- File and primary export names must agree.
- One file should have one primary responsibility.
- Preserve public API fields and stored preference keys until an explicit,
  backward-compatible migration exists.

## Refactor method

1. Select one bounded section.
2. Record its intended change and follow-up work here.
3. Add or retain regression coverage before changing behavior.
4. Move the smallest components first, then simplify the page/container.
5. Run focused tests, type checking, and the repository audit as appropriate.
6. Commit and push the completed section before beginning another section.
7. Do not merge this branch into `main` until the complete migration is verified.

Component and page restructuring is the primary work. A stylesheet move should
normally accompany the component or page boundary that owns those selectors;
do not spend successive checkpoints moving CSS without also advancing the
application → page → section → component composition. Pure style-tree moves are
reserved for cases where the owning TSX boundary is already correct and the
move is the only remaining structural defect.

## Cold-start handoff

This file must be committed and pushed with every bounded refactor section so a
new contributor or chat can continue using only the repository state.

Before continuing work:

1. Check out `refactor/component-workflow`; do not perform this migration on
   `main`.
2. Read this complete document before changing code.
3. Reapply the Master rule and File-tree rules to the planned boundary.
4. Confirm the latest completed section and select only the next bounded section.
5. Preserve behavior unless the section explicitly records an approved behavior
   change.
6. Update this document with implementation details, validation results, and the
   next bounded section in the same commit as the code.
7. Commit and push the section before beginning another one. Do not open or merge
   into `main` until the full migration is complete and verified.

## Current section: external foundation directories — complete

The earlier Fireteam checkpoints correctly improved internal component
composition, but they did not create a new directory because
`components/fireteam/` already existed on `main`. They must not be treated as
completed external-tree migration.

Goal: begin the visible ProdTracker-style source-tree migration with ownership
that is unambiguous.

Planned moves:

- `data/challenge-templates.v1.json` →
  `assets/data/challenge-templates.v1.json`
- `data/onboarding-guide.v1.json` →
  `assets/data/onboarding-guide.v1.json`
- `styles/theme.css` → `theme/guardianNexusTheme.css`

The old top-level `data/` directory will disappear after its two static assets
move. The shared `styles/` directory remains because it still owns accessibility
and dynamically loaded notification styles. No runtime content, schema, styling,
or import behavior may change in this section.

Implemented:

- Re-read the actual `ProdTracker` source tree and component chain before making
  this structural change.
- Created the visible `assets/data/` and `theme/` ownership boundaries in the web
  source tree.
- Moved both imported static JSON files from the competing top-level `data/`
  directory into `assets/data/` with byte-for-byte identical contents.
- Moved the global theme entry from `styles/theme.css` to the explicit
  `theme/guardianNexusTheme.css` path with byte-for-byte identical contents.
- Updated only the three imports required by those moves. The old `src/data/`
  directory is now empty and therefore removed from the Git tree.
- Retained `styles/accessibility.css`, `styles/guardian-fanfare.css`, and
  `styles/loadStylesheet.ts` because they still have genuinely shared ownership.

Validation completed for this section:

- Direct byte comparisons against the pre-move files passed for all three
  renames; Git recognizes each move as a 100% rename.
- Focused Activity History and Challenges page tests passed: 2 files and 2 tests.
- Complete web test suite passed: 89 files and 331 tests.
- Workspace lint and every workspace TypeScript check passed, including the web
  application and Pages Functions.
- Frontend source-boundary, CSS-module-usage, and staged diff checks passed.
- Web production build and performance budget passed at 114,990 bytes gzip.

## Current section: Fireteam component style ownership — complete

Goal: restore the required dependency direction by removing every import of the
page-level `Pages.module.css` stylesheet from the focused Fireteam components.
This section changes stylesheet ownership only; it must not redesign the
Fireteam page or change its runtime behavior.

Implemented:

- Added the human-readable `styles/fireteam/FireteamComponents.module.css`
  stylesheet under the dedicated styling tree and matched it to the Fireteam
  component genre.
- Moved the pre-existing `FireteamActivityFeed.module.css` out of
  `components/fireteam/` and into `styles/fireteam/` so the Fireteam component
  directory contains no styling files.
- Moved the member-card, tracked-item, sharing-control, Recent Loot control,
  animation, and reduced-motion selectors out of `pages/Pages.module.css`.
- Updated `FireteamMemberCard`, `FireteamTrackedItem`,
  `FireteamSharingHeader`, and `FireteamRecentLootSection` to import the
  Fireteam-owned stylesheet. No component under `components/fireteam/` now
  imports a page stylesheet or contains a styling file.
- Kept page-only Fireteam layout selectors in `Pages.module.css`. Shared
  `primaryAction` and `gearError` rules also remain there for unrelated pages;
  the Fireteam stylesheet owns its local sharing action and explicitly named
  `actionError` presentation.
- Organized the new stylesheet into named component sections while retaining a
  single genre-level CSS module. Four separate CSS modules were evaluated, but
  their generated module overhead exceeded the production entry budget; the
  shared Fireteam module preserves the same ownership boundary and passed it.
- Updated the Fireteam regression test to inspect the class exported by the
  stylesheet that now owns tracked-item presentation.

Validation completed for this section:

- Compared 142 component selector blocks, all retained page selector blocks,
  and all relevant keyframes against the pre-move stylesheet; declarations and
  values are unchanged.
- Complete web test suite passed: 89 files and 331 tests.
- After the final path correction for the pre-existing Activity Feed stylesheet,
  focused Fireteam validation passed: 2 files and 30 tests.
- CSS-module usage passed across 42 stylesheets, frontend source boundaries
  passed, no Fireteam component imports `Pages.module.css`, and
  `components/fireteam/` contains no CSS files.
- Workspace lint, every workspace TypeScript check, archive boundaries, and
  `git diff --check` passed.
- Web production build and performance budget passed at 114,996 bytes gzip.

Known styling-tree debt after this checkpoint:

- No CSS files remain under `components/fireteam/`.
- Fifteen legacy CSS files remain under other `components/` genres and 24 remain
  under `pages/`. They must move into `styles/common/` or the matching
  `styles/<product-area>/` directory in bounded, consumer-verified sections.
- Do not bulk-move or deduplicate those files without first mapping every TSX
  importer and selector consumer.

## Current section: common style-tree ownership — complete

Goal: create the shared presentation boundary required by the File-tree rules
and remove styling files from `components/common/` without changing rendered
behavior.

Implemented:

- Mapped the exact production importers before moving either stylesheet.
  `CompletionPing.tsx` is the only importer of
  `CompletionPing.module.css`, and `Page.tsx` is the only importer of
  `Page.module.css`; no test imports either CSS module directly.
- Created `styles/common/` and moved the two shared component stylesheets to
  `styles/common/CompletionPing.module.css` and
  `styles/common/Page.module.css`.
- Updated only the two owning components to import the new style-tree paths.
- Preserved every selector, declaration, value, and keyframe. The only CSS
  content additions are short ownership comments.
- Confirmed that `components/common/` now contains only TypeScript components,
  helpers, and tests. It contains no styling files.

Validation completed for this section:

- Direct comparisons against the pre-move files passed after excluding the new
  ownership comments.
- No stale imports reference either former component-directory stylesheet.
- Complete web test suite passed: 89 files and 331 tests.
- CSS-module usage passed across 42 stylesheets, frontend source boundaries
  passed, and `components/common/` contains no CSS files.
- Workspace lint, every workspace TypeScript check, archive boundaries, and
  `git diff --check` passed.
- Web production build and performance budget passed at 114,996 bytes gzip.

Known styling-tree debt after this checkpoint:

- Thirteen legacy CSS files remain under other `components/` genres and 24
  remain under `pages/`.
- Each remaining stylesheet must be moved in a bounded section only after its
  TSX importers and selector-aware tests have been mapped.

## Current section: layout style-tree ownership — complete

Goal: create the application-layout styling boundary required by the File-tree
rules and remove styling files from `components/layout/` without changing shell
or options-panel behavior.

Implemented:

- Mapped every production importer before moving either stylesheet.
  `OptionsPanel.tsx` is the only importer of `OptionsPanel.module.css`;
  `Shell.tsx` and `ServiceIncidentBanner.tsx` are the complete importer set for
  `Shell.module.css`. No test imports either CSS module directly.
- Created `styles/layout/` and moved the stylesheets to
  `styles/layout/OptionsPanel.module.css` and
  `styles/layout/Shell.module.css`.
- Updated only those three owning components to import the new style-tree paths.
- Preserved both stylesheets byte-for-byte, including every selector,
  declaration, value, keyframe, media query, and global reduced-motion rule.
- Confirmed that `components/layout/` now contains only TypeScript components
  and the shell regression test. It contains no styling files.

Validation completed for this section:

- Direct byte comparisons against the pre-move files passed for both moves.
- No stale imports reference either former component-directory stylesheet.
- Complete web test suite passed: 89 files and 331 tests, including all nine
  shell regression tests.
- CSS-module usage passed across 42 stylesheets, frontend source boundaries
  passed, and `components/layout/` contains no CSS files.
- Workspace lint, every workspace TypeScript check, archive boundaries, and
  `git diff --check` passed.
- The first build correctly rejected two non-functional CSS ownership comments
  at 115,004 bytes gzip. Removing only those comments restored byte-for-byte
  stylesheet moves; the final production build and performance budget passed at
  114,996 bytes gzip without changing the budget.

Known styling-tree debt after this checkpoint:

- Eleven legacy CSS files remain under other `components/` genres and 24 remain
  under `pages/`.
- Continue by product genre in small, consumer-verified checkpoints; do not
  combine this structural migration with selector consolidation.

## Current section: Journey style-tree ownership — complete

Goal: create the Journey product-area styling boundary required by the
File-tree rules and remove styling files from `components/journey/` without
changing navigation or progress-summary presentation.

Implemented:

- Mapped every production importer and style token before moving either
  stylesheet. `JourneyNav.tsx` is the only importer of
  `JourneyNav.module.css`, and `ProgressSummaryCard.tsx` is the only importer of
  `ProgressSummaryCard.module.css`; no test imports either CSS module directly.
- Created `styles/journey/` and moved the stylesheets to
  `styles/journey/JourneyNav.module.css` and
  `styles/journey/ProgressSummaryCard.module.css`.
- Updated only the two owning Journey components to import the new style-tree
  paths.
- Updated the CSS-module audit's existing `ProgressSummaryCard` dynamic-tone
  mapping to the stylesheet's new canonical path. The known `gold`, `green`,
  and `violet` class values are unchanged.
- Preserved both stylesheets byte-for-byte, including every selector,
  declaration, value, media query, and transition.
- Confirmed that `components/journey/` now contains only the two reusable
  TypeScript components. It contains no styling files.

Validation completed for this section:

- Direct byte comparisons against the pre-move files passed for both moves.
- No stale imports reference either former component-directory stylesheet.
- Complete web test suite passed: 89 files and 331 tests.
- The CSS-module audit initially exposed its stale dynamic-tone path, then
  passed across all 42 stylesheets after that canonical path was updated.
- Frontend source boundaries passed, and `components/journey/` contains no CSS
  files.
- Workspace lint, focused lint for the changed audit tool, every workspace
  TypeScript check, archive boundaries, and `git diff --check` passed.
- Web production build and performance budget passed at 114,996 bytes gzip.

Known styling-tree debt after this checkpoint:

- Nine legacy CSS files remain under other `components/` genres and 24 remain
  under `pages/`.
- Continue by product genre in small, consumer-verified checkpoints; do not
  combine this structural migration with selector consolidation.

## Current section: notification style-tree ownership — complete

Goal: create the notification product-area styling boundary required by the
File-tree rules and remove styling files from `components/notifications/`
without changing banner or notification-center behavior.

Implemented:

- Mapped every production importer before moving either stylesheet.
  `GuardianFeed.tsx` is the only TypeScript importer of
  `GuardianFeed.module.css`, and `NotificationCenter.tsx` is the only importer
  of `NotificationCenter.module.css`.
- Mapped both non-component path consumers: the CSS-module audit owns the
  Guardian Feed dynamic priority and animation values, and
  `notification-visuals.test.mjs` reads the Guardian Feed stylesheet directly
  for presentation regression assertions.
- Created `styles/notifications/` and moved the stylesheets to
  `styles/notifications/GuardianFeed.module.css` and
  `styles/notifications/NotificationCenter.module.css`.
- Updated the two owning components, the CSS-module audit mapping, and the
  visual regression test to use the new canonical paths.
- Preserved both stylesheets byte-for-byte, including every selector,
  declaration, value, keyframe, media query, and reduced-motion rule.
- Confirmed that `components/notifications/` now contains only TypeScript
  components and their focused tests. It contains no styling files.

Validation completed for this section:

- Direct byte comparisons against the pre-move files passed for both moves.
- No stale import, audit, or test path references either former
  component-directory stylesheet.
- Complete web test suite passed: 89 files and 331 tests, including five
  Guardian Feed render tests and five Notification Center tests.
- The direct notification visual-regression suite passed: 3 tests.
- CSS-module usage passed across all 42 stylesheets, frontend source boundaries
  passed, and `components/notifications/` contains no CSS files.
- Workspace lint, every workspace TypeScript check, archive boundaries, and
  `git diff --check` passed.
- Web production build and performance budget passed at 114,996 bytes gzip.

Known styling-tree debt after this checkpoint:

- Seven legacy CSS files remain under other `components/` genres and 24 remain
  under `pages/`.
- Continue by product genre in small, consumer-verified checkpoints; do not
  combine this structural migration with selector consolidation.

## Current section: quest style-tree ownership — complete

Goal: create the quest product-area styling boundary required by the File-tree
rules and remove styling files from `components/quests/` without changing
objective requirement presentation.

Implemented:

- Mapped the complete dependency set before moving the stylesheet.
  `ObjectiveRequirementText.tsx` is its only TypeScript importer; no test or
  tooling file reads the CSS module path directly.
- Confirmed the component uses the stylesheet's single `icon` class and that
  its focused test suite covers recognized and unknown requirement icons.
- Created `styles/quests/` and moved the stylesheet to
  `styles/quests/ObjectiveRequirementText.module.css`.
- Updated only the owning component to import the new style-tree path.
- Preserved the stylesheet byte-for-byte, including every selector,
  declaration, value, and attribute rule.
- Confirmed that `components/quests/` now contains only TypeScript components
  and the focused objective-requirement test. It contains no styling files.

Validation completed for this section:

- Direct byte comparison against the pre-move stylesheet passed.
- No stale import references the former component-directory stylesheet.
- Complete web test suite passed: 89 files and 331 tests, including both
  focused `ObjectiveRequirementText` tests.
- CSS-module usage passed across all 42 stylesheets, frontend source boundaries
  passed, and `components/quests/` contains no CSS files.
- Workspace lint, every workspace TypeScript check, archive boundaries, and
  `git diff --check` passed.
- Web production build and performance budget passed at 114,996 bytes gzip.

Known styling-tree debt after this checkpoint:

- Six legacy CSS files remain under other `components/` genres and 24 remain
  under `pages/`.
- Continue by product genre in small, consumer-verified checkpoints; do not
  combine this structural migration with selector consolidation.

## Current section: Fireteam tracked-item presentation — complete

Goal: begin reducing `FireteamPage.tsx` to page-level composition by moving the
tracked-item row into its own reusable component and moving reusable tracked-item
conversion and ordering rules out of the page.

Planned files:

- `components/fireteam/FireteamTrackedItem.tsx`
- `components/fireteam/fireteamTrackedItems.ts`
- `components/fireteam/fireteamTrackedItems.test.ts`
- `pages/FireteamPage.tsx`

Behavior must remain unchanged in this section. The existing Fireteam stylesheet
dependency will remain temporarily; moving Fireteam-specific selectors into
`styles/fireteam/` is a later bounded section.

Implemented:

- Moved the tracked-item row out of `FireteamPage.tsx` into the focused
  `FireteamTrackedItem` component.
- Replaced abbreviated component properties with explicit names such as
  `trackedItem`, `isReorderable`, `isDragging`, `isDragTarget`, `isFirst`, and
  `isLast`.
- Moved tracked-item keys, ordering, legacy quest conversion, completion-event
  identity, and presence-location formatting into the colocated
  `fireteamTrackedItems.ts` helper.
- Added focused regression coverage for key creation, saved ordering behavior,
  legacy conversion, and presence wording.
- Reduced `FireteamPage.tsx` from 535 lines to 464 lines without changing the
  Fireteam API, storage keys, query keys, or user-visible behavior.

Validation completed for this section:

- Web test suite: 87 files and 325 tests passed.
- Web TypeScript checks passed for the application and Pages Functions.
- ESLint passed for every changed TypeScript file.
- Frontend source-boundary and CSS-module-usage checks passed.
- `git diff --check` passed.

## Current section: Fireteam Recent Loot presentation — complete

Goal: replace the embedded Recent Loot conditional in `FireteamPage.tsx` with a
named Fireteam-level section container that composes the existing reusable
`CompactRecentLootBar` and the hidden-state control.

Planned files:

- `components/fireteam/FireteamRecentLootSection.tsx`
- `components/fireteam/FireteamRecentLootSection.test.tsx`
- `pages/FireteamPage.tsx`
- `docs/ARCHITECTURE_REFACTOR.md`

The page will retain Recent Loot query ownership, gear and watcher mutations,
selected-character context, and preference updates. The section will receive
plain display state and explicit callbacks. Existing ordering, labels, warning
and error behavior, hide/show preference values, gear action payloads, watcher
behavior, and retry behavior must remain unchanged.

Implemented:

- Added `FireteamRecentLootSection` as the Fireteam-level container that composes
  the existing gear-level `CompactRecentLootBar`, hidden-state control, and gear
  action error presentation.
- Replaced the page's compressed conditional JSX with a named component call and
  explicit properties such as `recentLootEvents`, `onTagItem`, `onPullItem`,
  `onChangeWeaponSocket`, `actionsPending`, and `watcherUpdatePending`.
- Kept the Recent Loot query, selected-character IDs, tag/transfer/socket request
  payloads, watcher mutation, and `fireteam.recentLoot.v1` preference writes in
  `FireteamPage.tsx`.
- Preserved the existing behavior where gear-action errors remain visible even
  when the Recent Loot timeline is hidden.
- Added focused coverage for hidden-state recovery, visible timeline composition,
  and action-error presentation. Existing page tests continue to verify the
  actual tag and transfer API payloads.
- `FireteamPage.tsx` changed from 323 to 355 physical lines because the previous
  one-line prop block is now expanded into human-readable named inputs; the page
  no longer contains the section's presentation implementation.

Validation completed for this section:

- Web test suite: 89 files and 331 tests passed.
- ESLint, all workspace TypeScript checks, archive boundaries, frontend source
  boundaries, CSS-module usage, and `git diff --check` passed.
- 24 domain tests, 257 API tests, 7 Node tooling tests, and 24 manifest tests
  passed.
- Contracts, domain, and Web builds passed. The Web production performance
  budget passed at 114,990 bytes gzip. The unchanged Cloudflare API deployment
  dry-run was omitted from this local-only validation after its external wrapper
  was blocked during the prior section.
- The first complete repository audit reached the production performance check
  and found the entry JavaScript gzip output 3 bytes over its 115,000-byte
  budget. The equivalent tracked-item ordering helper was simplified and the
  production budget then passed at 114,995 bytes gzip.
- The complete `pnpm run audit` workflow passed: archive and source boundaries,
  CSS usage, linting, every workspace typecheck, 24 domain tests, 257 API tests,
  325 web tests, 7 Node tooling tests, 24 manifest tests, API/Web builds, and the
  production performance budget.

## Current section: Fireteam member-card presentation — complete

Goal: continue reducing `FireteamPage.tsx` to route-level composition by moving
the complete member card into `components/fireteam/`. The component will own its
local entry, removal, completion, drag, and dismissal presentation state. The
page will continue to own queries, mutations, saved tracking preferences, and
the callbacks that change shared Fireteam data.

Planned files:

- `components/fireteam/FireteamMemberCard.tsx`
- `pages/FireteamPage.tsx`
- `docs/ARCHITECTURE_REFACTOR.md`

Behavior, storage keys, completion timing, copy commands, ordering callbacks,
and Fireteam API behavior must remain unchanged. Existing page-level tests will
continue acting as end-to-end component regression coverage for this extraction.

Implemented:

- Moved the complete member-card presentation from `FireteamPage.tsx` into the
  focused `FireteamMemberCard` component under `components/fireteam/`.
- Kept entry, removal, completion, drag, audio, and session-dismissal state inside
  the card that presents those states.
- Kept queries, mutations, saved tracked-item order, and data-changing callbacks
  in `FireteamPage.tsx`, so the page remains the route-level composition owner.
- Replaced abbreviated component properties with explicit names including
  `canManageMember`, `copiedCommand`, `onCopyCommand`, `onUntrackItem`,
  `trackedItemOrder`, `onReorderTrackedItem`, and `untrackingItemKey`.
- Colocated the shared 1,600 ms tracked-item exit timing with the Fireteam
  tracked-item helpers used by both the page mutation and member-card transition.
- Reduced `FireteamPage.tsx` from 464 lines to 320 lines without changing the
  Fireteam API, browser storage keys, completion timing, copy commands, or
  user-visible behavior.

Validation completed for this section:

- Web test suite: 87 files and 325 tests passed.
- Web TypeScript checks passed for the application and Pages Functions.
- ESLint passed for every changed TypeScript file.
- Frontend source-boundary and CSS-module-usage checks passed.
- `git diff --check` passed.
- The complete `pnpm run audit` workflow passed: archive and source boundaries,
  CSS usage, linting, every workspace typecheck, 24 domain tests, 257 API tests,
  325 web tests, 7 Node tooling tests, 24 manifest tests, API/Web builds, and the
  production performance budget at 114,997 bytes gzip.

## Current section: Fireteam sharing-header presentation — complete

Goal: continue reducing `FireteamPage.tsx` to route-level composition by moving
the Fireteam title, freshness display, and sharing controls into a focused
`FireteamSharingHeader` container under `components/fireteam/`.

Planned files:

- `components/fireteam/FireteamSharingHeader.tsx`
- `components/fireteam/FireteamSharingHeader.test.tsx`
- `pages/FireteamPage.tsx`
- `docs/ARCHITECTURE_REFACTOR.md`

The page will continue to select the current Fireteam data and warning and own
all sharing mutations. The header will receive explicit display state and
callbacks. Existing labels, button order, disabled behavior, freshness source,
and sharing commands must remain unchanged.

Implemented:

- Added `FireteamSharingHeader` as the Fireteam-level container that composes the
  shared `PageHeader` and `Freshness` components with Fireteam sharing controls.
- Replaced the embedded header markup in `FireteamPage.tsx` with one named
  component boundary and explicit state/callback properties.
- Kept warning selection, Fireteam response state, temporary/persistent sharing
  mutations, and stop-sharing mutation ownership in `FireteamPage.tsx`.
- Used `sharingEnabled: undefined` to preserve the unloaded state without
  displaying premature sharing actions; `false` and `true` retain the existing
  inactive and active control sets.
- Added focused component coverage for unloaded, inactive-sharing, and
  temporary-sharing states while retaining the page-level mutation regression
  coverage.

Validation completed for this section:

- Web test suite: 88 files and 328 tests passed.
- Web TypeScript checks passed for the application and Pages Functions.
- ESLint passed for every changed TypeScript file.
- Archive, frontend source-boundary, and CSS-module-usage checks passed.
- Every workspace typecheck, 24 domain tests, 257 API tests, 7 Node tooling
  tests, and 24 manifest tests passed.
- The API dry-run build and direct Web production build passed. The performance
  budget passed at 114,980 bytes gzip after the environment blocked only the
  final output poll of the combined audit command.
- `git diff --check` passed.

## Current section: Fireteam roster composition — complete

Goal: continue reducing `FireteamPage.tsx` to route-level composition by
replacing its embedded member loop with a named Fireteam section container. The
same vertical slice must also move the roster layout selector out of the page
stylesheet and into the existing Fireteam style tree.

Implemented:

- Added `components/fireteam/FireteamRoster.tsx` as the larger Fireteam section
  container that composes the smaller `FireteamMemberCard` components.
- Kept Fireteam response data, current-Guardian selection, leader status,
  tracked-item preference order, clipboard behavior, and tracking mutations in
  `FireteamPage.tsx`. The roster receives plain values and explicit callbacks.
- Replaced the page's member loop with one readable `FireteamRoster` boundary
  and used complete property names such as `currentGuardianIsLeader`,
  `copiedCommandIdentifier`, and `onUntrackCurrentGuardianItem`.
- Centralized the self-versus-teammate routing rule in the roster: only the
  current Guardian receives untrack, reorder, saved-order, and removal-state
  inputs; only other members receive leader-management capability.
- Moved the unchanged three-column grid declarations from the page-owned
  `fireteamGrid` selector to the human-readable `roster` selector in
  `styles/fireteam/FireteamComponents.module.css`. No styling file was added to
  `components/`, and no additional CSS module was introduced.
- Added focused roster regression coverage for member composition, leader-only
  commands, current-Guardian-only tracking controls, ordering callbacks, and
  current-Guardian-only removal presentation.
- Reduced the embedded roster block in `FireteamPage.tsx` from 25 lines to one
  named section call while preserving page ownership of workflow behavior.

Validation completed for this section:

- Complete web test suite passed: 90 files and 333 tests, including the two new
  focused roster tests and all 22 Fireteam page tests.
- Focused ESLint, web application and Pages Functions TypeScript checks,
  CSS-module usage, frontend source boundaries, and `git diff --check` passed.
- The complete `pnpm run audit` workflow passed: archive and source boundaries,
  CSS usage, workspace lint, every workspace typecheck, 24 domain tests, 257 API
  tests, 333 web tests, 7 Node tooling tests, 24 manifest tests, and API/Web
  production builds.
- The production performance budget passed at exactly 115,000 bytes gzip without
  raising or changing the budget.

## Completed sections

- Created `refactor/component-workflow` from `main` at `9e151cc`.
- Recorded the Plum Creek architecture as the mandatory refactor rule.
- Completed the Fireteam tracked-item presentation extraction.
- Completed the Fireteam member-card presentation extraction.
- Completed the Fireteam sharing-header presentation extraction.
- Completed the Fireteam Recent Loot presentation extraction.
- Completed the external foundation directory migration for static source data
  and the application theme.
- Completed Fireteam component stylesheet ownership and removed the reversed
  component-to-page stylesheet dependency.
- Completed common component stylesheet ownership and removed all CSS files
  from `components/common/`.
- Completed layout component stylesheet ownership and removed all CSS files
  from `components/layout/`.
- Completed Journey component stylesheet ownership and removed all CSS files
  from `components/journey/`.
- Completed notification component stylesheet ownership and removed all CSS
  files from `components/notifications/`.
- Completed quest component stylesheet ownership and removed all CSS files from
  `components/quests/`.
- Completed the Fireteam roster vertical slice, including the section component,
  page simplification, focused tests, and Fireteam-owned roster styling.

## Future sections

- Next bounded vertical slice: extract the Fireteam Bungie-data notice into a
  focused `FireteamDataNotice` component, move its `fireteamDataNote` selector
  from `pages/Pages.module.css` into the existing `styles/fireteam/` stylesheet,
  and remove the icon/presentation implementation from `FireteamPage.tsx`.
  Preserve the exact disclaimer wording and rendered accessibility.
- Move Fireteam query/mutation orchestration into clearly named service-facing
  hooks while keeping the page as the composition layer.
- Move the reward-code marquee stylesheet into `styles/reward-codes/` when that
  component area is selected as part of a bounded TSX ownership review. Preserve
  every styling value and verify that `components/reward-codes/` contains no CSS
  before pushing.
- Run a bounded stylesheet-consolidation audit after the owning component
  boundaries are stable. Inventory every TSX consumer before removing or
  merging selectors, extract genuinely shared patterns such as action controls
  and error notices into `styles/common/`, and update every affected TSX import
  and regression test in the same checkpoint. Product-area styles may be split
  into smaller files when ownership remains clear and the production performance
  budget still passes.
- Move remaining CSS modules out of `pages/` and other source directories into
  the dedicated `styles/<product-area>/` tree as each owning page area is
  refactored. Do not leave or add styling files under `components/` or `pages/`.
- Apply the same page/component separation to Build Advisor, Collection, Gear,
  and other oversized route files.
- Reduce `Shell.tsx` to application-shell composition.
- Split the shared API client by transport, connection state, offline storage,
  and mutation queue responsibilities.
- Split API routing and feature behavior out of `apps/api/src/index.ts`.
- Divide shared contracts and domain exports into human-readable product areas
  while preserving stable package entry points.
