# Gear Cleanup

Cleanup is an explicit review tool, not a dismantler or background watcher. Analyze compares the whole account and defaults to vault candidates. It makes one fresh profile request per analysis/revalidation, never per item, and does not poll.

## Evidence and confidence

- 99% means matching physical selectable rolls or matching armor fits/base stats, with a retained keeper. It is a disclosed rule tier, not a measured probability.
- 95% means compatible armor with no lower base stat and at least one higher stat, or a matching weapon that offers every physical selectable option plus more without worse stats or investment.
- 70% means opt-in preference evidence. Armor comparisons respect explicitly ignored stats; weapon preferences require agreement from every selected catalog in every selected activity mode. Missing ratings are not negative evidence. Overlapping catalogs are not counted as independent votes.

Comparisons retain at least one highest-Power copy per compatible slot, and reserve every nominated keeper outside the recommendation batch. Weapon hashes, available socket sets (including attachments and origin sockets), masterwork, crafting/enhancement, stat outcomes, Power and tracker investment constrain equivalence. Armor requires matching item/class/slot/tier/archetype/tuning/set/perk identity. Matching the same item hash deliberately avoids unsupported comparisons across armor variants.

Locked, equipped, manually tagged, saved-build/loadout, Exotic, crafted and enhanced items remain protected. Aggressive review can display protected duplicates, but never approve them. Crafted/enhanced gear is deliberately more conservative than ordinary gear. Weapon-superset comparisons require matching stat outcomes and compatible socket indexes and categories, not hypothetical catalog rolls.

Missing component/protection information or profile data older than two minutes disables affected recommendations. Approved pulls revalidate current ownership, matching recommendation evidence, protections and destination capacity. They never clear space by moving other gear.

## Persistence and mutations

Migration `0037_gear_cleanup.sql` adds account-scoped settings, separate recommendation marks, dismissals, batches and cosmetic journals. Manual Favorite/Keep/Junk/Infuse/Archive tags are not overwritten. Approval/undo endpoints require authentication and CSRF. Batch IDs make replay safe; SQL guards preserve manual tags added concurrently and prevent tagging a keeper already marked by another batch. Undo removes only marks still belonging to that batch.

Dismissals are tied to item, keeper, evidence and settings. Changing the compared roll or rules creates a new review. Preview fingerprints include inventory, protection, manifest, settings and source dates, and must match before approval.

Optional cosmetics apply only after an approved pull. Both chosen and original plugs must be reported insertable. Only Bungie's free insertion action is used. The original/applied pair is journaled before insertion; failures distinguish successful transfer from failed appearance changes. Restore never overwrites a later manual appearance change. Appearance restoration remains available independently of tag-batch undo.

## Verification

Domain tests cover physical versus hypothetical rolls, origin traits, swords/bows, investments, armor distributions, source disagreement, missing evidence and keeper preservation. API tests cover stale approvals, replay/undo, concurrent manual tags, capacity and cosmetic failure/restore. Desktop tests cover selected-item shortcuts, typing focus and cache updates. Browser layout checks use a temporary synthetic fixture, removed before publication. Real transfers and cosmetics require specifically selected test items and are not performed during automated verification.
