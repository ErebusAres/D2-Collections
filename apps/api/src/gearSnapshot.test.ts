import { describe, expect, it } from "vitest";
import type { GearData } from "@guardian-nexus/contracts";
import { hydrateGearSnapshot, readGearSnapshot } from "./gearSnapshot";

const base: GearData = {
  gearSchemaVersion: 2 as const, manifestVersion: "v1", selectedCharacterId: "old", selectedClass: "Titan" as const,
  items: [{ instanceId: "1", itemHash: "10", name: "Helm", icon: "", className: "Warlock" as const, slot: "Helmet", rarity: "Legendary", power: 500, ownerCharacterId: "new", location: "vault" as const, equipped: false, locked: false, masterworked: false, gearTier: 5, perks: [], setBonuses: [], baseStats: { health: 1, melee: 1, grenade: 1, super: 1, class: 1, weapons: 1 }, currentStats: { health: 1, melee: 1, grenade: 1, super: 1, class: 1, weapons: 1 }, adjustments: [], baseTotal: 6, currentTotal: 6, grade: { letter: "C", score: 6 }, firstSeenAt: "2026-09-01", isNew: true }],
  weapons: [], statIcons: {}, totals: { armor: 1, weapons: 0, vault: 1, equipped: 0, locked: 0, grouped: 0, newItems: 1 }
};

describe("durable Gear snapshots", () => {
  it("overlays current local state, cleanup marks and selected character", () => {
    const states = new Map([["1", { item_instance_id: "1", tag: "keep" as const, first_seen_at: "2026-09-01", dismissed_at: "2026-09-02" }]]);
    const data = hydrateGearSnapshot(base, "new", states, { "1": { batchId: "b", reason: "duplicate", confidence: 99 } });
    expect(data).toMatchObject({ selectedCharacterId: "new", selectedClass: "Warlock", totals: { newItems: 0 } });
    expect(data.items[0]).toMatchObject({ tag: "keep", dismissedAt: "2026-09-02", isNew: false, cleanupRecommendation: { confidence: 99 } });
  });

  it("preserves cached item state when no newer or meaningful override exists", () => {
    const cached = { ...base, items: [{ ...base.items[0]!, tag: "favorite" as const, dismissedAt: "2026-09-03", isNew: false }] };
    const data = hydrateGearSnapshot(cached, undefined, new Map(), {});
    expect(data.items[0]).toMatchObject({ tag: "favorite", dismissedAt: "2026-09-03", isNew: false });
  });

  it("rejects malformed or obsolete cached payloads", async () => {
    const env = { DB: { prepare: () => ({ bind: () => ({ first: async () => ({ data_json: "{}", source_minted_at: "x", refreshed_at: "y" }) }) }) } } as any;
    expect(await readGearSnapshot("m", env)).toBeUndefined();
  });
});
