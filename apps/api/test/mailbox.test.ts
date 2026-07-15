import { describe, expect, it } from "vitest";
import { normalizeMailbox, postmasterItemsForCharacter } from "../src/mailbox";

describe("normalizeMailbox", () => {
  it("only includes real Postmaster items and reports per-character capacity", () => {
    const profile = {
      characters: { data: {
        c1: { characterId: "c1", classType: 1, raceType: 0, emblemPath: "/hunter.png", dateLastPlayed: "2026-07-15T00:00:00Z" },
        c2: { characterId: "c2", classType: 0, raceType: 2, emblemPath: "/titan.png", dateLastPlayed: "2026-07-14T00:00:00Z" }
      } },
      characterInventories: { data: {
        c1: { items: [
          { itemHash: 10, itemInstanceId: "100", bucketHash: 215593132, quantity: 2, transferStatus: 0 },
          { itemHash: 11, itemInstanceId: "101", bucketHash: 1498876634, quantity: 1, transferStatus: 0 }
        ] },
        c2: { items: [{ itemHash: 12, itemInstanceId: "102", bucketHash: 215593132, quantity: 1, transferStatus: 2 }] }
      } }
    };
    const manifest: any = {
      version: "test", generatedAt: "now",
      bucketDefinitions: { "215593132": { itemCount: 21 } },
      itemDefinitions: {
        "10": { displayProperties: { name: "Lost Engram", icon: "/engram.png" }, itemTypeDisplayName: "Engram", inventory: { tierTypeName: "Legendary" } },
        "12": { displayProperties: { name: "Blocked Item", icon: "/blocked.png" }, itemTypeDisplayName: "Material", inventory: { tierTypeName: "Rare" } }
      },
      loadoutNameDefinitions: {}, loadoutIconDefinitions: {}, loadoutColorDefinitions: {}
    };

    const data = normalizeMailbox(profile, manifest);
    expect(data).toMatchObject({ count: 2, capacity: 42 });
    expect(data.characters[0]?.items[0]).toMatchObject({ name: "Lost Engram", icon: "https://www.bungie.net/engram.png", quantity: 2, canPull: true });
    expect(data.characters[1]?.items[0]).toMatchObject({ name: "Blocked Item", canPull: false });
    expect(postmasterItemsForCharacter(profile, "c1")).toHaveLength(1);
  });
});
