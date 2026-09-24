import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLEANUP_DEFAULTS } from "@guardian-nexus/domain";
import { cleanupAnalyzeData, cleanupSettingsKey, cleanupSnapshot, mutateCleanup, validateCleanupPull } from "./cleanup";

const mocks = vi.hoisted(() => ({ profile: {} as any, gear: {} as any }));
vi.mock("./bungie", () => ({ profileFor: vi.fn(async () => ({ profile: mocks.profile })), loadGearManifest: vi.fn(async () => ({ version: "1", plugDefinitions: {}, gearItemDefinitions: {} })) }));
vi.mock("./gear", async (original) => ({ ...await original<typeof import("./gear")>(), normalizeGear: () => mocks.gear }));
const row = { membership_id: "member" } as any;
const batchId = "10000000-0000-4000-8000-000000000001";
const request = (body: unknown) => new Request("https://example.test", { method: "POST", body: JSON.stringify(body) });
function database() {
  const marks = new Map<string, any>(); const batches = new Map<string, any>(); const dismissed = new Set<string>();
  const statements: string[] = []; let concurrentTag = false;
  const DB: any = { prepare: (sql: string) => ({ bind: (...v: any[]) => {
    const run = async () => {
      statements.push(sql);
      if (sql.startsWith("INSERT INTO cleanup_marks") && !concurrentTag && !marks.has(v[1]) && !marks.has(v[9]) && !batches.has(v[11])) marks.set(v[1], { item_id: v[1], batch_id: v[2], reason: v[3], confidence: v[4], recommendation_key: v[5] });
      if (sql.startsWith("INSERT INTO cleanup_batches") && !batches.has(v[1])) batches.set(v[1], { result_json: v[2], undone: 0 });
      if (sql.startsWith("UPDATE cleanup_batches SET result_json")) batches.get(v[2]).result_json = v[0];
      if (sql.startsWith("UPDATE cleanup_batches SET undone")) batches.get(v[1]).undone = 1;
      if (sql.startsWith("DELETE FROM cleanup_marks") && sql.includes("batch_id")) for (const [id, mark] of marks) if (mark.batch_id === v[1]) marks.delete(id);
      return { success: true };
    };
    return { run, first: async () => sql.includes("cleanup_batches") ? batches.get(v[1]) : sql.includes("cleanup_marks") ? marks.get(v[1]) : null,
      all: async () => ({ results: sql.includes("cleanup_marks") ? [...marks.values()] : sql.includes("cleanup_dismissals") ? [...dismissed].map((key) => ({ recommendation_key: key })) : [] }) };
  } }), batch: async (entries: any[]) => { for (const entry of entries) await entry.run(); } };
  return { env: { DB } as any, marks, batches, statements, setConcurrentTag: () => { concurrentTag = true; } };
}
beforeEach(() => {
  const base = { itemHash: "10", name: "Armor", className: "Hunter", slot: "Helmet", power: 500, location: "vault", locked: false, equipped: false, masterworked: false, rarity: "Legendary", gearTier: 5, baseTotal: 60, baseStats: { health: 10, melee: 10, grenade: 10, super: 10, class: 10, weapons: 10 }, perks: [], setBonuses: [] };
  mocks.gear = { items: [{ ...base, instanceId: "1" }, { ...base, instanceId: "2" }], weapons: [] };
  mocks.profile = { responseMintedTimestamp: new Date().toISOString(), characters: { data: { "9": {} } }, profileInventory: { data: { items: [1, 2].map((id) => ({ itemInstanceId: String(id), itemHash: 10, state: 0, bucketHash: 99 })) } }, characterInventories: { data: { "9": { items: [] } } }, characterEquipment: { data: { "9": { items: [] } } }, characterLoadouts: { data: { "9": { loadouts: [] } } }, itemComponents: { reusablePlugs: { data: {} }, instances: { data: { "1": {}, "2": {} } }, stats: { data: { "1": { stats: {} }, "2": { stats: {} } } }, sockets: { data: { "1": { sockets: [] }, "2": { sockets: [] } } } } };
});
describe("cleanup server approvals", () => {
  it("uses stable settings keys and keeps saved analysis available while refreshing", async () => {
    expect(await cleanupSettingsKey(CLEANUP_DEFAULTS)).toBe(await cleanupSettingsKey({ ...CLEANUP_DEFAULTS }));
    const analysis = (await cleanupSnapshot(row, database().env, CLEANUP_DEFAULTS)).analysis;
    expect(cleanupAnalyzeData({ settingsKey: "saved", settings: CLEANUP_DEFAULTS, analysis, requestedAt: new Date().toISOString(), refreshedAt: new Date().toISOString(), expiresAt: new Date(Date.now() - 1).toISOString() }, CLEANUP_DEFAULTS)).toMatchObject({ status: "saved", analysis });
    expect(cleanupAnalyzeData(undefined, CLEANUP_DEFAULTS)).toMatchObject({ status: "refreshing", requestedSettings: CLEANUP_DEFAULTS });
  });
  it("previews without writes and rejects stale approvals", async () => {
    const db = database(); const { analysis } = await cleanupSnapshot(row, db.env, CLEANUP_DEFAULTS);
    expect(analysis.recommendations).toHaveLength(1); expect(db.statements).toEqual([]);
    mocks.gear.items[1].locked = true;
    await expect(mutateCleanup(request({ action: "approve", batchId, version: analysis.version, settings: CLEANUP_DEFAULTS, itemIds: ["2"] }), row, db.env)).rejects.toThrow(/changed/);
    expect(db.marks.size).toBe(0);
  });
  it("tags once, replays safely, and undoes only its batch", async () => {
    const db = database(); const { analysis } = await cleanupSnapshot(row, db.env, CLEANUP_DEFAULTS);
    const body = { action: "approve", batchId, version: analysis.version, settings: CLEANUP_DEFAULTS, itemIds: ["2"] };
    expect(await mutateCleanup(request(body), row, db.env)).toMatchObject({ itemIds: ["2"] });
    expect(await mutateCleanup(request(body), row, db.env)).toMatchObject({ itemIds: ["2"] });
    db.marks.set("3", { batch_id: "other" });
    await mutateCleanup(request({ ...body, action: "undo" }), row, db.env);
    expect([...db.marks.keys()]).toEqual(["3"]);
    expect(db.statements.some((s) => /UPDATE gear_item_state|DELETE FROM gear_item_state/.test(s))).toBe(false);
  });
  it("reports no tags when a concurrent manual tag blocks insertion", async () => {
    const db = database(); const { analysis } = await cleanupSnapshot(row, db.env, CLEANUP_DEFAULTS); db.setConcurrentTag();
    expect(await mutateCleanup(request({ action: "approve", batchId, version: analysis.version, settings: CLEANUP_DEFAULTS, itemIds: ["2"] }), row, db.env)).toMatchObject({ itemIds: [] });
  });
  it("requires the exact approved reasoning and destination space before pulling", async () => {
    const db = database(); const { analysis } = await cleanupSnapshot(row, db.env, CLEANUP_DEFAULTS);
    const body = { itemId: "2", characterId: "9", settings: CLEANUP_DEFAULTS };
    db.marks.set("2", { recommendation_key: "obsolete" });
    await expect(validateCleanupPull(request(body), row, db.env)).rejects.toThrow(/no longer/);
    db.marks.set("2", { recommendation_key: analysis.recommendations[0]!.key });
    mocks.profile.characterInventories.data["9"].items = Array.from({ length: 9 }, () => ({ bucketHash: 99 }));
    await expect(validateCleanupPull(request(body), row, db.env)).rejects.toThrow(/full/);
    mocks.profile.characterInventories.data["9"].items = [];
    expect(await validateCleanupPull(request(body), row, db.env)).toMatchObject({ itemInstanceId: "2", targetCharacterId: "9" });
  });
  it("blocks recommendations with missing protection, stat or freshness evidence", async () => {
    const db = database(); delete mocks.profile.characterLoadouts;
    expect((await cleanupSnapshot(row, db.env, CLEANUP_DEFAULTS)).analysis.recommendations).toEqual([]);
    mocks.profile.characterLoadouts = { data: { "9": { loadouts: [] } } };
    delete mocks.profile.itemComponents.stats.data["2"];
    expect((await cleanupSnapshot(row, db.env, CLEANUP_DEFAULTS)).analysis.insufficient).toContain("2");
    mocks.profile.responseMintedTimestamp = "2020-01-01";
    expect((await cleanupSnapshot(row, db.env, CLEANUP_DEFAULTS)).analysis.recommendations).toEqual([]);
  });
  it("preserves different available armor tuning choices even with equal active stats", async () => {
    const db = database();
    mocks.profile.itemComponents.sockets.data["1"].sockets = [{ plugHash: 100 }];
    mocks.profile.itemComponents.sockets.data["2"].sockets = [{ plugHash: 100 }];
    mocks.profile.itemComponents.reusablePlugs.data = { "1": { plugs: { "0": [{ plugItemHash: 100 }, { plugItemHash: 200 }] } }, "2": { plugs: { "0": [{ plugItemHash: 100 }] } } };
    expect((await cleanupSnapshot(row, db.env, CLEANUP_DEFAULTS)).analysis.recommendations).toEqual([]);
  });
});
