import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLEANUP_DEFAULTS } from "@guardian-nexus/domain";
import { cosmeticChoices, cosmeticSetChoices, markCleanupCosmetics, restoreCleanupCosmetics } from "./cleanupCosmetics";
const mock = vi.hoisted(() => ({ profile: {} as any, manifest: {} as any, post: vi.fn() }));
vi.mock("./bungie", () => ({ profileFor: async () => ({ profile: mock.profile, accessToken: "test" }), loadGearManifest: async () => mock.manifest, bungiePost: mock.post }));
const row = { membership_id: "m", membership_type: 3 } as any;
const changes: any[] = [];
const writes: string[] = [];
const env = { DB: { prepare: (sql: string) => ({ bind: (..._values: unknown[]) => ({ first: async () => null, all: async () => ({ results: changes }), run: async () => { writes.push(sql); } }) }) } } as any;
beforeEach(() => {
  changes.length = 0; writes.length = 0; mock.post.mockReset();
  mock.profile = { characterInventories: { data: { "9": { items: [{ itemInstanceId: "1", itemHash: 10, state: 0 }] } } }, itemComponents: { sockets: { data: { "1": { sockets: [{ plugHash: 20 }] } } }, reusablePlugs: { data: { "1": { plugs: { "0": [20, 30].map((hash) => ({ plugItemHash: hash, canInsert: true, enabled: true })) } } } } } };
  mock.manifest = { gearItemDefinitions: { "10": { itemType: 3 } }, plugDefinitions: { "30": { plug: { plugCategoryIdentifier: "shader" }, displayProperties: { name: "Cleanup shader" } } } };
});
describe("cleanup cosmetic safety", () => {
  it("deduplicates identical collection styles without hiding the selected one", () => {
    const pieces = { "Warlock:Helmet": "30" };
    mock.manifest.cosmeticSets = [{ id: "a", name: "Suit", className: "Warlock", pieces }, { id: "b", name: "Suit", className: "Warlock", pieces }];
    expect(cosmeticSetChoices(mock.manifest, [{ hash: "30", name: "Helm", kind: "ornament", group: "Warlock:Helmet" }], { Warlock: "b" })).toEqual([{ id: "b", name: "Suit", className: "Warlock", pieces, owned: 1 }]);
  });
  it("resolves a class style to the correct slot and rechecks ownership", async () => {
    mock.manifest.gearItemDefinitions["10"] = { itemType: 2, classType: 2, itemTypeDisplayName: "Helmet" };
    mock.manifest.plugDefinitions["30"].plug.plugCategoryIdentifier = "armor_skins_warlock_head";
    mock.manifest.cosmeticSets = [{ id: "set", className: "Warlock", pieces: { "Warlock:Helmet": "30", "Warlock:Gauntlets": "99" } }];
    const settings = { ...CLEANUP_DEFAULTS, cosmetics: { enabled: true, ornaments: {}, classStyles: { Warlock: "set" } } };
    await markCleanupCosmetics(row, env, "1", "9", settings);
    expect(mock.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ plug: { socketIndex: 0, socketArrayType: 0, plugItemHash: 30 } }), env, "test");
    mock.post.mockClear();
    mock.profile.itemComponents.reusablePlugs.data["1"].plugs["0"][1].canInsert = false;
    expect((await markCleanupCosmetics(row, env, "1", "9", settings))[0]).toMatch(/not owned or insertable/);
    expect(mock.post).not.toHaveBeenCalled();
  });
  it("offers only owned insertable cosmetics, never arbitrary socket plugs", () => {
    mock.profile.itemComponents.reusablePlugs.data["1"].plugs["0"].push({ plugItemHash: 40, canInsert: false, enabled: true });
    mock.manifest.plugDefinitions["40"] = { plug: { plugCategoryIdentifier: "shader" }, displayProperties: { name: "Unowned" } };
    expect(cosmeticChoices(mock.profile, { items: [], weapons: [{ instanceId: "1", itemHash: "10" }] } as any, mock.manifest)).toEqual([expect.objectContaining({ hash: "30", name: "Cleanup shader", kind: "shader", group: "weapons" })]);
  });
  it("does nothing by default and refuses irreversible changes", async () => {
    expect(await markCleanupCosmetics(row, env, "1", "9", CLEANUP_DEFAULTS)).toEqual([]);
    mock.profile.itemComponents.reusablePlugs.data["1"].plugs["0"][0].canInsert = false;
    expect((await markCleanupCosmetics(row, env, "1", "9", { ...CLEANUP_DEFAULTS, cosmetics: { enabled: true, weaponShader: "30", ornaments: {} } }))[0]).toMatch(/cannot currently be restored/);
    expect(mock.post).not.toHaveBeenCalled(); expect(writes).toEqual([]);
  });
  it("records original cosmetics before free insertion and distinguishes partial failure", async () => {
    mock.post.mockRejectedValue(new Error("Bungie offline"));
    const warnings = await markCleanupCosmetics(row, env, "1", "9", { ...CLEANUP_DEFAULTS, cosmetics: { enabled: true, weaponShader: "30", ornaments: {} } });
    expect(writes[0]).toMatch(/INSERT OR IGNORE INTO cleanup_cosmetics/);
    expect(mock.post).toHaveBeenCalledWith("/Destiny2/Actions/Items/InsertSocketPlugFree/", expect.objectContaining({ itemId: "1" }), env, "test");
    expect(warnings[0]).toMatch(/Pulled successfully/);
  });
  it("never overwrites a subsequent manual appearance change", async () => {
    changes.push({ socket_index: 0, original_hash: "20", applied_hash: "30" });
    mock.profile.itemComponents.sockets.data["1"].sockets[0].plugHash = 99;
    expect((await restoreCleanupCosmetics(row, env, "1"))[0]).toMatch(/not overwritten/);
    expect(mock.post).not.toHaveBeenCalled(); expect(writes).toEqual([]);
  });
  it("restores only the journaled socket and clears its record after success", async () => {
    changes.push({ socket_index: 0, original_hash: "20", applied_hash: "30" });
    mock.profile.itemComponents.sockets.data["1"].sockets[0].plugHash = 30;
    expect(await restoreCleanupCosmetics(row, env, "1")).toEqual([]);
    expect(mock.post).toHaveBeenCalledWith(expect.stringContaining("InsertSocketPlugFree"), expect.objectContaining({ plug: { socketIndex: 0, socketArrayType: 0, plugItemHash: 20 } }), env, "test");
    expect(writes[0]).toMatch(/DELETE FROM cleanup_cosmetics/);
  });
});
