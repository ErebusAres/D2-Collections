import { describe, expect, it } from "vitest";
import { profileComponentsFor } from "./bungie";
import { gearActionItemsFromProfile } from "./gear";

describe("gear action inventory", () => {
  it("requests only the inventory components required for mutations", () => {
    expect(profileComponentsFor("gear-action")).toBe("100,102,200,201,205,307");
  });

  it("finds action targets without loading or normalizing the Gear manifest", () => {
    const items = gearActionItemsFromProfile({
      profileInventory: { data: { items: [{ itemInstanceId: "vault-1", itemHash: 11 }] } },
      characterInventories: { data: { c1: { items: [{ itemInstanceId: "held-1", itemHash: 22 }] } } },
      characterEquipment: { data: { c1: { items: [{ itemInstanceId: "equipped-1", itemHash: 33 }] } } },
      itemComponents: { state: { data: { "vault-1": { state: 1 } } } }
    });

    expect(items.get("vault-1")).toMatchObject({ itemHash: "11", location: "vault", equipped: false, locked: true });
    expect(items.get("held-1")).toMatchObject({ ownerCharacterId: "c1", location: "inventory", equipped: false });
    expect(items.get("equipped-1")).toMatchObject({ ownerCharacterId: "c1", location: "equipped", equipped: true });
  });
});
