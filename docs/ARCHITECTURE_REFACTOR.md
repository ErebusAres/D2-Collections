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

## File-tree rules

The web application must continue converging on the same externally visible
structure demonstrated by ProdTracker:

```text
apps/web/src/
├── App.tsx
├── main.tsx
├── assets/
├── components/
│   ├── common/
│   └── <product-area>/
├── context/
├── pages/
├── services/
├── styles/
└── theme/
```

- `components/` contains focused reusable UI containers and controls.
- `pages/` contains route-level composition only.
- `context/` contains genuinely application-wide React state.
- `services/` contains external communication and browser infrastructure, not UI.
- `styles/` and `theme/` contain shared visual foundations; component-specific
  styles belong beside the component that owns them.
- Use `components/<product-area>/` when multiple components share a clear product
  genre and the subdirectory makes the tree easier to scan and understand. For
  example, Fireteam presentation belongs in `components/fireteam/` and build
  presentation belongs in `components/builds/`.
- Component subdirectories may group related components, styles, and focused
  component helpers, but they may not become alternate application trees or
  contain route-level pages.
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
dependency will remain temporarily; moving Fireteam-specific selectors beside
their owning components is a later bounded section.

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
- The first complete repository audit reached the production performance check
  and found the entry JavaScript gzip output 3 bytes over its 115,000-byte
  budget. The equivalent tracked-item ordering helper was simplified and the
  production budget then passed at 114,995 bytes gzip.
- The complete `pnpm run audit` workflow passed: archive and source boundaries,
  CSS usage, linting, every workspace typecheck, 24 domain tests, 257 API tests,
  325 web tests, 7 Node tooling tests, 24 manifest tests, API/Web builds, and the
  production performance budget.

## Completed sections

- Created `refactor/component-workflow` from `main` at `9e151cc`.
- Recorded the Plum Creek architecture as the mandatory refactor rule.
- Completed the Fireteam tracked-item presentation extraction.

## Future sections

- Next bounded section: extract the Fireteam member card from
  `FireteamPage.tsx`, including its transition state, while keeping the page as
  the owner of page-level query and mutation orchestration.
- Move Fireteam query/mutation orchestration into clearly named service-facing
  hooks while keeping the page as the composition layer.
- Move Fireteam component styles out of the shared `Pages.module.css` file.
- Apply the same page/component separation to Build Advisor, Collection, Gear,
  and other oversized route files.
- Reduce `Shell.tsx` to application-shell composition.
- Split the shared API client by transport, connection state, offline storage,
  and mutation queue responsibilities.
- Split API routing and feature behavior out of `apps/api/src/index.ts`.
- Divide shared contracts and domain exports into human-readable product areas
  while preserving stable package entry points.
