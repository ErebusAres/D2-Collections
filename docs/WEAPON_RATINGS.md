# Guardian Nexus weapon ratings

Guardian Nexus rates the quality of the active perk roll on a physical weapon. It does not claim that Bungie assigns quality ratings, that one roll is universally best, or that a low score is automatic dismantle advice.

## Evidence and provenance

- Primary recommendation source: the default DIM community wishlist, Voltron, maintained in [`48klocs/dim-wish-list-sources`](https://github.com/48klocs/dim-wish-list-sources) under the MIT license.
- DIM wishlists are curated recommendations that still require player judgment and can lag newly released content; Guardian Nexus preserves that limitation as confidence and unavailable states rather than hiding it.
- [Destiny Recipes Loot Companion](https://destinyrecipes.com/loot/) also uses Voltron and a column-weighted comparison. Guardian Nexus independently implements the same explainable principle while retaining its own data contract, UI, confidence rules, and unknown-data safeguards.
- Bungie's API and manifest provide the owned instance, active perks, item type, and other factual item data. Bungie does not provide a universal good/bad score.

## Score method (schema v3)

PvE and PvP are evaluated separately. The generated artifact records four recommendation columns: barrel/sight, magazine/battery, trait one, and trait two. Their normalized weights are `0.25, 0.25, 1, 1`, so gameplay-defining traits each count four times as much as the first two stat-shaping columns.

For a weapon with an exact DIM entry, an active perk earns its column's full weight when DIM recommends it for that weapon and mode. A reviewed but unmatched perk earns zero for that column. The weighted total becomes a percentage.

When DIM has no entry for that exact weapon, Guardian Nexus may show a clearly labeled lower-confidence weapon-type comparison. The sync process measures how strongly each perk is endorsed in the same column across reviewed weapons of that type and normalizes it against the strongest signal in that column. The tooltip reports that it is a type fallback, how many columns had evidence, and its confidence. It never presents this as an exact review.

Quality tiers are stable and intentionally broad:

- `90–100`: Excellent
- `75–89`: Strong
- `50–74`: Mixed
- `25–49`: Weak
- `0–24`: Poor

Overall is the mean of whichever PvE/PvP scores have applicable evidence. The tooltip keeps those mode scores separate because a roll can be excellent in one mode and poor in the other.

## Honest unknown states

- Incomplete Bungie socket data remains `incomplete`.
- A missing catalog or missing applicable source evidence remains `unavailable`, never zero.
- A low exact-weapon score is allowed only when the source reviewed that weapon and its active perks do not match those recommendations.
- A type fallback ignores columns with no comparable evidence and visibly lowers confidence. New or unseen perks are not silently treated as bad.
- The score evaluates the owned roll. It does not rank the weapon frame, current sandbox meta, DPS, ease of use, or synergy with a specific build.

## Update path

`pnpm ratings:sync` downloads the current Voltron source, limits it to weapon definitions in Guardian Nexus's versioned Gear manifest, and writes `apps/web/public/data/weapon-value.v3.json`. The artifact carries its schema, review date, source, license, method, total manifest coverage, exact reviewed-weapon count, and type coverage. The UI consumes this versioned artifact without embedding seasonal perk opinions in component code.

The generator has a deterministic fixture test. Any formula or schema change must update the generator test, evaluator tests, this document, and the runtime asset in one pull request.
