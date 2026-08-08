# Guardian Nexus weapon ratings

Guardian Nexus ratings are transparent community-recommendation coverage scores. They are not Bungie ratings, universal “god roll” claims, or dismantling advice.

## Source and update path

- Source: the default DIM community wishlist, Voltron, maintained in [`48klocs/dim-wish-list-sources`](https://github.com/48klocs/dim-wish-list-sources) under the MIT license.
- The source includes recommendations from multiple named community curators and marks recommendations for PvE and/or PvP.
- `pnpm ratings:sync` downloads the current source, limits it to weapon definitions in Guardian Nexus's versioned gear manifest, and writes the cacheable runtime asset `apps/web/public/data/weapon-value.v2.json`.
- The generated artifact records its schema version, review date, source URL, license, and method. Updating it does not require changing UI code.

## Score method (schema v2)

PvE and PvP are evaluated separately:

1. 50 points measure how many active perk columns appear anywhere in that weapon's curator recommendations for the selected mode.
2. 50 points require the exact final two trait columns to appear together in a curator recommendation for that mode.
3. The displayed overall percentage is the mean of the available PvE and PvP scores.

An item with incomplete Bungie socket data is `incomplete`. A weapon absent from the curated source is `unavailable`. Neither state is converted to zero, bad, or dismantle advice.

This deliberately favors explainability and updateability over an opaque model. A future schema may add source consensus or archetype-specific weighting, but it must preserve visible provenance and unknown-data handling.
