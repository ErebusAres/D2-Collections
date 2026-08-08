import { describe, expect, it } from "vitest";
import { eventForTransition, inventoryObservations } from "./recentItems";

describe("recent item timeline transitions", () => {
  const now = "2026-08-08T12:00:00.000Z";

  it("silently establishes catalyst and inventory baselines", () => {
    expect(eventForTransition({ key: "inventory:1", kind: "inventory", state: "owned", quantity: 40, metadata: { itemHash: "1", name: "Enhancement Core" } }, undefined, true, now)).toBeUndefined();
    expect(eventForTransition({ key: "catalyst:2", kind: "catalyst", state: "complete", quantity: 1, metadata: { recordHash: "2", name: "Test Catalyst" } }, undefined, true, now)).toBeUndefined();
  });

  it("emits only the positive material delta so rapid observations can stack", () => {
    const event = eventForTransition(
      { key: "inventory:1", kind: "inventory", state: "owned", quantity: 14, metadata: { itemHash: "1", name: "Enhancement Core", itemType: "Material", rarity: "Legendary" } },
      { state_value: "owned", quantity: 10, observed_at: "2026-08-08T11:59:00.000Z" }, false, now
    );
    expect(event).toMatchObject({ kind: "inventory-gained", quantity: 4, name: "Enhancement Core" });
  });

  it("records catalyst acquisition and completion as separate transitions", () => {
    const observation = { key: "catalyst:2", kind: "catalyst" as const, state: "obtained", quantity: 1, metadata: { recordHash: "2", name: "Test Catalyst", percent: 0 } };
    expect(eventForTransition(observation, { state_value: "missing", quantity: 0, observed_at: now }, false, now)).toMatchObject({ kind: "catalyst-found" });
    expect(eventForTransition({ ...observation, state: "complete", metadata: { ...observation.metadata, percent: 100 } }, { state_value: "obtained", quantity: 1, observed_at: now }, false, now)).toMatchObject({ kind: "catalyst-completed", percent: 100 });
  });

  it("aggregates stackable inventory across account and characters while excluding physical gear", () => {
    const manifest: any = { itemDefinitions: {
      "1": { itemType: 8, itemTypeDisplayName: "Material", inventory: { tierTypeName: "Legendary" }, displayProperties: { name: "Enhancement Core", icon: "/core.png" } },
      "2": { itemType: 3, displayProperties: { name: "Weapon" } }
    } };
    const profile = {
      profileInventory: { data: { items: [{ itemHash: 1, quantity: 2 }, { itemHash: 2, itemInstanceId: "22", quantity: 1 }] } },
      characterInventories: { data: { guardian: { items: [{ itemHash: 1, quantity: 3 }] } } }
    };
    expect(inventoryObservations(profile, manifest)).toEqual([expect.objectContaining({ key: "inventory:1", quantity: 5, metadata: expect.objectContaining({ name: "Enhancement Core" }) })]);
  });
});
