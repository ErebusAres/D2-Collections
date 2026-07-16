import assert from "node:assert/strict";
import test from "node:test";
import { inferRewardCodeKind, mergeRewardCodes } from "./sync-reward-codes.mjs";

test("adds only newly discovered, validated reward codes", () => {
  const existing = [{ code: "AAA-BBB-CCC", reward: "Existing", kind: "Emblem", verifiedAt: "2026-07-01", sourceUrl: "https://example.com" }];
  const upstream = {
    lastUpdated: "2026-07-16",
    codeToEmblem: { "AAA-BBB-CCC": "Existing", "DDD-EEE-FFF": "New Reward" },
    emblems: { "New Reward": { note: "Ghost shell" } }
  };
  const { catalog, discovered } = mergeRewardCodes(existing, upstream);

  assert.equal(discovered.length, 1);
  assert.deepEqual(discovered[0], {
    code: "DDD-EEE-FFF",
    reward: "New Reward",
    kind: "Ghost Shell",
    verifiedAt: "2026-07-16",
    sourceUrl: "https://github.com/Manaiakalani/destiny-code-finder/blob/main/public/data/emblems.json"
  });
  assert.equal(catalog[1], existing[0]);
});

test("infers supported non-emblem reward types from source definitions", () => {
  assert.equal(inferRewardCodeKind("Rainbow", { Rainbow: { note: "Transmat Effect" } }), "Transmat");
  assert.equal(inferRewardCodeKind("Deadlands Warlock Ornament Set"), "Ornament");
  assert.equal(inferRewardCodeKind("A Normal Emblem"), "Emblem");
});

test("rejects malformed upstream codes instead of publishing them", () => {
  assert.throws(() => mergeRewardCodes([], {
    lastUpdated: "2026-07-16",
    codeToEmblem: { "not-a-code": "Bad data" },
    emblems: {}
  }), /malformed upstream reward code/);
});
