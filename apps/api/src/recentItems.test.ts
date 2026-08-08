import { describe, expect, it } from "vitest";
import { coalesceTimelineEvents, eventForTransition, eventId, inventoryObservations, inventorySnapshotAvailable } from "./recentItems";

describe("recent item timeline transitions", () => {
  const now = "2026-08-08T12:00:00.000Z";

  it("silently establishes catalyst and inventory baselines", () => {
    expect(eventForTransition({ key: "inventory:1", kind: "inventory", state: "owned", quantity: 40, metadata: { itemHash: "1", name: "Enhancement Core" } }, undefined, true, now)).toBeUndefined();
    expect(eventForTransition({ key: "catalyst:2", kind: "catalyst", state: "complete", quantity: 1, metadata: { recordHash: "2", name: "Test Catalyst" } }, undefined, true, now)).toBeUndefined();
  });

  it("silently establishes the initial gear baseline instead of calling the existing vault new", () => {
    const gear: any = { key: "gear:existing", kind: "gear", state: "weapon", quantity: 1, metadata: { itemHash: "10", instanceId: "existing", name: "Existing Rifle", gear: { firstSeenAt: now } } };
    expect(eventForTransition(gear, undefined, true, now)).toBeUndefined();
    expect(eventForTransition(gear, undefined, false, now)).toMatchObject({ kind: "weapon-found", instanceId: "existing" });
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

  it("requires complete inventory containers and definitions before accepting a zero baseline", () => {
    const manifest: any = { version: "current", itemDefinitions: {} };
    const profile = { profileInventory: { data: { items: [] } }, characterInventories: { data: { guardian: { items: [] } } } };
    expect(inventorySnapshotAvailable(profile, manifest)).toBe(true);
    expect(inventorySnapshotAvailable({ ...profile, characterInventories: {} }, manifest)).toBe(false);
    expect(inventorySnapshotAvailable(profile, { ...manifest, version: "unavailable" })).toBe(false);
  });

  it("coalesces rapid material deltas while moving the updated stack to newest-left", () => {
    const event = (id: string, observedAt: string, quantity: number): any => ({ id, kind: "inventory-gained", sourceKey: "inventory:1", itemHash: "1", name: "Enhancement Core", icon: "", quantity, observedAt, lastObservedAt: observedAt });
    const events: any[] = [
      { id: "catalyst", kind: "catalyst-found", sourceKey: "catalyst:2", name: "Catalyst", icon: "", quantity: 1, observedAt: "2026-08-08T12:03:00.000Z", lastObservedAt: "2026-08-08T12:03:00.000Z" },
      event("first", "2026-08-08T12:00:00.000Z", 2),
      event("second", "2026-08-08T12:05:00.000Z", 3)
    ];
    expect(coalesceTimelineEvents(events)).toEqual([
      expect.objectContaining({ id: "first", quantity: 5, observedAt: "2026-08-08T12:00:00.000Z", lastObservedAt: "2026-08-08T12:05:00.000Z" }),
      expect.objectContaining({ id: "catalyst" })
    ]);
  });

  it("uses a stable event identity for retries but a new identity for a later material transition", async () => {
    const event: any = { kind: "inventory-gained", sourceKey: "inventory:1", itemHash: "1", name: "Enhancement Core", icon: "", quantity: 4, observedAt: now, lastObservedAt: now };
    const observation: any = { key: "inventory:1", kind: "inventory", state: "owned", quantity: 14, metadata: {} };
    const prior: any = { quantity: 10, observed_at: "2026-08-08T11:00:00.000Z", updated_at: "2026-08-08T11:59:00.000Z" };
    expect(await eventId("member", event, observation, prior)).toBe(await eventId("member", event, observation, prior));
    expect(await eventId("member", event, observation, prior)).not.toBe(await eventId("member", event, observation, { ...prior, updated_at: "2026-08-08T12:30:00.000Z" }));
  });
});
