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

## Future sections

- Next bounded section: add a `FireteamRoster` section container under
  `components/fireteam/` that composes the extracted `FireteamMemberCard`
  components. Keep the page as owner of member data, leader permissions,
  tracked-item preferences, and mutation callbacks.
- Move Fireteam query/mutation orchestration into clearly named service-facing
  hooks while keeping the page as the composition layer.
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
