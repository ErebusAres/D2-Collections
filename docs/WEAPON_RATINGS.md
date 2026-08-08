# Guardian Nexus weapon ratings

Guardian Nexus rates the quality of the active perk roll on a physical weapon. It does not claim that Bungie assigns quality ratings, that one roll is universally best, or that a low score is automatic dismantle advice.

## Evidence and provenance

- Primary recommendation source: the default DIM community wishlist, Voltron, maintained in [`48klocs/dim-wish-list-sources`](https://github.com/48klocs/dim-wish-list-sources) under the MIT license.
- DIM wishlists are curated recommendations that still require player judgment and can lag newly released content; Guardian Nexus preserves that limitation as confidence and unavailable states rather than hiding it.
- [Destiny Recipes Loot Companion](https://destinyrecipes.com/loot/) inspired the compact presentation. Guardian Nexus independently documents its evidence and formula rather than claiming an unpublished third-party implementation is identical.
- Bungie's API and manifest provide the owned instance, active perks, item type, and other factual item data. Bungie does not provide a universal good/bad score.

## Score method (schema v4)

PvE and PvP are evaluated separately. The generated artifact records four recommendation columns: barrel/sight, magazine/battery, trait one, and trait two. Each source-specified column has equal weight. Guardian Nexus does not invent a hidden authority for numeric weights that DIM does not publish.

For a weapon with an exact DIM entry, the artifact preserves curated trait-one/trait-two pairings instead of unioning every endorsed trait into independent lists. The evaluator finds the best matching recommended trait pairing, then compares barrel/sight and magazine/battery against their source-backed column evidence. An active perk earns its column's equal share when it matches. This prevents a pair of individually popular traits that were never recommended together from becoming an artificial 100% roll.

When DIM has no entry for that exact weapon, Guardian Nexus may show a clearly labeled lower-confidence weapon-type comparison. The sync process measures how strongly each perk is endorsed in the same column across reviewed weapons of that type and normalizes it against the strongest signal in that column. The tooltip reports that it is a type fallback, how many columns had evidence, and its confidence. It never presents this as an exact review.

Quality tiers are stable and intentionally broad:

- `90–100`: Excellent
- `75–89`: Strong
- `50–74`: Mixed
- `25–49`: Weak
- `0–24`: Poor

Overall is the mean of whichever PvE/PvP scores have applicable evidence. Cards call the result a **roll match**, and the tooltip keeps mode scores separate because a roll can be excellent in one mode and poor in the other.

## Honest unknown states

- Incomplete Bungie socket data remains `incomplete`.
- A missing catalog or missing applicable source evidence remains `unavailable`, never zero.
- A low exact-weapon score is allowed only when the source reviewed that weapon and its active perks do not match those recommendations.
- A type fallback ignores columns with no comparable evidence and visibly lowers confidence. New or unseen perks are not silently treated as bad.
- The score evaluates the owned roll. It does not rank the weapon frame, current sandbox meta, DPS, ease of use, or synergy with a specific build.

## Update path

`pnpm ratings:sync` downloads the current Voltron source, follows DIM block-note boundaries, limits recommendations to weapon definitions in Guardian Nexus's versioned Gear manifest, and writes `apps/web/public/data/weapon-value.v4.json`. The 2026-08-08 artifact contains 1,194 exact current-weapon records and fallback evidence for all 17 current weapon types. The artifact carries its schema, review date, source, license, method, total manifest coverage, exact reviewed-weapon count, and type coverage.

Production deployment and the scheduled Tuesday manifest refresh both run `ratings:sync` after refreshing Bungie's manifest. The browser validates the separately loaded versioned asset and retries a transient load failure while a weapon card remains mounted.

The generator has a deterministic fixture test. Any formula or schema change must update the generator test, evaluator tests, this document, and the runtime asset in one pull request.
