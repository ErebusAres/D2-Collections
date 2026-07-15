import { describe, expect, it } from "vitest";
import { normalizeGear } from "../src/gear";

describe("normalizeGear", () => {
  it("uses Bungie manifest imagery and separates base from active adjustments", () => {
    const profile = {
      profileInventory: { data: { items: [{ itemHash: 10, itemInstanceId: "100", state: 1 }] } },
      itemComponents: {
        stats: { data: { "100": { stats: { "392767087": { value: 20 }, "4244567218": { value: 10 } } } } },
        sockets: { data: { "100": { sockets: [{ plugHash: 20 }] } } }, instances: { data: { "100": { primaryStat: { value: 500 } } } }, state: { data: {} }
      }
    };
    const manifest: any = { version: "test", generatedAt: "now", gearItemDefinitions: { "10": { itemType: 2, classType: 2, itemTypeDisplayName: "Helmet", inventory: { tierTypeName: "Legendary" }, displayProperties: { name: "Test Helm", icon: "/item.png" } } }, plugDefinitions: { "20": { hash: 20, displayProperties: { name: "Armor Mod", icon: "/mod.png" }, plug: { plugCategoryIdentifier: "armor.mod" }, investmentStats: [{ statTypeHash: 392767087, value: 5 }] } }, statDefinitions: { "392767087": { displayProperties: { icon: "/health.png" } } } };
    const data = normalizeGear(profile, manifest, "character", "Warlock", new Map(), "2026-07-15T00:00:00Z");
    expect(data.items[0]).toMatchObject({ name: "Test Helm", icon: "https://www.bungie.net/item.png", locked: true, baseStats: { health: 15 }, currentStats: { health: 20 } });
    expect(data.statIcons.health).toBe("https://www.bungie.net/health.png");
  });
});
