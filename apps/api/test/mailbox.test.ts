import { describe, expect, it } from "vitest";
import { normalizeMailbox, postmasterItemsForCharacter, postmasterPullEligibility, postmasterRoomCandidate } from "../src/mailbox";

describe("normalizeMailbox", () => {
  it("only includes real Postmaster items and reports per-character capacity", () => {
    const profile = {
      characters: { data: {
        c1: { characterId: "c1", classType: 1, raceType: 0, emblemPath: "/hunter.png", dateLastPlayed: "2026-07-15T00:00:00Z" },
        c2: { characterId: "c2", classType: 0, raceType: 2, emblemPath: "/titan.png", dateLastPlayed: "2026-07-14T00:00:00Z" }
      } },
      characterInventories: { data: {
        c1: { items: [
          { itemHash: 10, itemInstanceId: "100", bucketHash: 215593132, quantity: 2, transferStatus: 4 },
          { itemHash: 11, itemInstanceId: "101", bucketHash: 1498876634, quantity: 1, transferStatus: 0 }
        ] },
        c2: { items: [{ itemHash: 12, itemInstanceId: "102", bucketHash: 215593132, quantity: 1, transferStatus: 2 }] }
      } }
    };
    const manifest: any = {
      version: "test", generatedAt: "now",
      bucketDefinitions: { "215593132": { itemCount: 21 } },
      itemDefinitions: {
        "10": { displayProperties: { name: "Lost Weapon", icon: "/weapon.png" }, itemTypeDisplayName: "Auto Rifle", inventory: { tierTypeName: "Legendary", bucketTypeHash: 1498876634 } },
        "12": { displayProperties: { name: "Blocked Item", icon: "/blocked.png" }, itemTypeDisplayName: "Material", inventory: { tierTypeName: "Rare" } }
      },
      loadoutNameDefinitions: {}, loadoutIconDefinitions: {}, loadoutColorDefinitions: {}
    };

    const data = normalizeMailbox(profile, manifest);
    expect(data).toMatchObject({ count: 2, capacity: 42 });
    expect(data.characters[0]?.items[0]).toMatchObject({ name: "Lost Weapon", icon: "https://www.bungie.net/weapon.png", quantity: 2, canPull: true, needsSpace: true });
    expect(data.characters[1]?.items[0]).toMatchObject({ name: "Blocked Item", canPull: false });
    expect(postmasterItemsForCharacter(profile, "c1")).toHaveLength(1);
  });

  it("blocks destructive pulls and selects only a safe same-slot item when room is required", () => {
    expect(postmasterPullEligibility({ itemInstanceId: "200", transferStatus: 0 }, { doesPostmasterPullHaveSideEffects: true })).toMatchObject({ canPull: false });
    expect(postmasterPullEligibility({ itemInstanceId: "201", transferStatus: 2 }, {})).toMatchObject({ canPull: false });
    const profile = {
      characterInventories: { data: { c1: { items: [
        { itemHash: 20, itemInstanceId: "301", bucketHash: 1498876634, transferStatus: 0 },
        { itemHash: 21, itemInstanceId: "302", bucketHash: 1498876634, transferStatus: 0 },
        { itemHash: 22, itemInstanceId: "303", bucketHash: 2465295065, transferStatus: 0 }
      ] } } },
      itemComponents: {
        state: { data: { "301": { state: 1 }, "302": { state: 0 } } },
        instances: { data: { "302": { primaryStat: { value: 470 } }, "303": { primaryStat: { value: 400 } } } }
      }
    };
    expect(postmasterRoomCandidate(profile, "c1", "1498876634")?.itemInstanceId).toBe("302");
  });
});
