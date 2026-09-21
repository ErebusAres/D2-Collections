import { expect, it } from "vitest";
import { healthReviewItems } from "./CleanupHealthReview";
import type { LootItem } from "./RecentLoot";
it("shows Health armor even without recommendations and retains protected/character items", () => {
  const items = [
    { kind: "armor", instanceId: "1", baseStats: { health: 10 }, locked: true, location: "inventory" },
    { kind: "armor", instanceId: "2", baseStats: { health: 30 }, location: "vault" },
    { kind: "armor", instanceId: "3", baseStats: { health: 0 } },
    { kind: "armor", instanceId: "4", baseStats: { health: NaN } },
    { kind: "weapon", instanceId: "5" }
  ] as LootItem[];
  expect(healthReviewItems(items).map((item) => item.instanceId)).toEqual(["2", "1"]);
  expect(items[0]?.instanceId).toBe("1");
});
