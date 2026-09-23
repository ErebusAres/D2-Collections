import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyItemCosmetic, itemCosmeticChoices } from "./itemCosmetics";
const mock = vi.hoisted(() => ({ profile: {} as any, manifest: {} as any, post: vi.fn() }));
vi.mock("./bungie", () => ({ profileFor: async () => ({ profile: mock.profile, accessToken: "test" }), loadGearManifest: async () => mock.manifest, bungiePost: mock.post }));
const entry = (hash: number, canInsert = true) => ({ plugItemHash: hash, canInsert, enabled: true });
beforeEach(() => {
  mock.post.mockReset();
  mock.profile = {
    characters: { data: { "9": {} } },
    characterInventories: { data: { "9": { items: [{ itemInstanceId: "1", itemHash: 10 }] } } },
    itemComponents: { sockets: { data: { "1": { sockets: [{ plugHash: 20 }] } } }, reusablePlugs: { data: { "1": { plugs: { "0": [entry(20), entry(30)] } } } } },
    profilePlugSets: { data: { plugs: { "100": [entry(40), entry(50, false)], "999": [entry(60)] } } },
    characterPlugSets: { data: { "9": { plugs: { "100": [entry(70)] } } } }
  };
  mock.manifest = { gearItemDefinitions: { "10": { cosmeticSockets: { "0": { reusablePlugSetHash: "100", plugSources: 14 } } } }, plugDefinitions: Object.fromEntries([20,30,40,50,60,70].map(hash => [String(hash), { plug: { plugCategoryIdentifier: "armor_skins_warlock_head" }, displayProperties: { name: `Skin ${hash}`, icon: "/icon.png" } }])) };
});
describe("owned item appearances", () => {
  it("combines instance, account and character sources, excluding unowned and unrelated sets", () => {
    const result = itemCosmeticChoices(mock.profile, mock.manifest, "1");
    expect(result.choices.map(choice => choice.hash)).toEqual(["20", "30", "40", "70"]);
    expect(result.choices[0]!.selected).toBe(true);
    expect(result.canApply).toBe(true);
  });
  it("respects socket source flags and never treats manifest entries as ownership", () => {
    mock.manifest.gearItemDefinitions["10"].cosmeticSockets["0"].plugSources = 2;
    expect(itemCosmeticChoices(mock.profile, mock.manifest, "1").choices.map(choice => choice.hash)).toEqual(["20", "30"]);
  });
  it("shows character-owned appearances on vault items but requires pulling first", async () => {
    mock.profile.profileInventory = { data: { items: mock.profile.characterInventories.data["9"].items } };
    mock.profile.characterInventories.data["9"].items = [];
    const result = itemCosmeticChoices(mock.profile, mock.manifest, "1");
    expect(result.choices.some(choice => choice.hash === "70")).toBe(true);
    expect(result.canApply).toBe(false);
    await expect(applyItemCosmetic({} as any, {} as any, { itemId: "1", socketIndex: 0, hash: "40", expectedHash: "20" })).rejects.toThrow(/Pull/);
    expect(mock.post).not.toHaveBeenCalled();
  });
  it("rejects stale changes and unavailable choices", async () => {
    await expect(applyItemCosmetic({} as any, {} as any, { itemId: "1", socketIndex: 0, hash: "40", expectedHash: "99" })).rejects.toThrow(/changed/);
    await expect(applyItemCosmetic({} as any, {} as any, { itemId: "1", socketIndex: 0, hash: "50", expectedHash: "20" })).rejects.toThrow(/not currently owned/);
    expect(mock.post).not.toHaveBeenCalled();
  });
  it("only inserts freely and repeated approval is a no-op", async () => {
    const input = { itemId: "1", socketIndex: 0, hash: "40", expectedHash: "20" };
    await applyItemCosmetic({ membership_type: 3 } as any, {} as any, input);
    expect(mock.post).toHaveBeenCalledWith("/Destiny2/Actions/Items/InsertSocketPlugFree/", expect.objectContaining({ plug: { socketIndex: 0, socketArrayType: 0, plugItemHash: 40 } }), {}, "test");
    mock.profile.itemComponents.sockets.data["1"].sockets[0].plugHash = 40;
    await applyItemCosmetic({} as any, {} as any, input);
    expect(mock.post).toHaveBeenCalledTimes(1);
  });
  it("rejects items outside this account", () => {
    expect(() => itemCosmeticChoices(mock.profile, mock.manifest, "999")).toThrow(/no longer/);
  });
});
