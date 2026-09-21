import type { CleanupAnalysis, CleanupSettings, GearData, GearManifest } from "@guardian-nexus/contracts";
import { bungiePost, loadGearManifest, profileFor } from "./bungie";
import { gearActionItemsFromProfile } from "./gear";
import { httpError } from "./security";
import type { Env, SessionRow } from "./types";

export function cosmeticChoices(profile: any, gear: GearData, manifest: GearManifest): CleanupAnalysis["cosmetics"] {
  const result = new Map<string, CleanupAnalysis["cosmetics"][number]>();
  for (const item of [...gear.items, ...(gear.weapons || [])]) {
    const group = "className" in item ? `${item.className}:${item.slot}` : "weapons";
    for (const entries of Object.values(profile?.itemComponents?.reusablePlugs?.data?.[item.instanceId]?.plugs || {}) as any[]) for (const entry of entries) {
      if (entry.canInsert !== true || entry.enabled !== true) continue;
      const hash = String(entry.plugItemHash); const def = manifest.plugDefinitions[hash] as any;
      const category = String(def?.plug?.plugCategoryIdentifier || "");
      const kind = /shader/i.test(category) ? "shader" : /ornament|skin/i.test(category) && group !== "weapons" ? "ornament" : undefined;
      if (kind && def?.displayProperties?.name) result.set(`${group}:${hash}`, { hash, name: def.displayProperties.name, kind, group });
    }
  }
  return [...result.values()].sort((a, b) => a.name.localeCompare(b.name));
}
function insertable(profile: any, itemId: string, index: number, hash: string) {
  return (profile?.itemComponents?.reusablePlugs?.data?.[itemId]?.plugs?.[String(index)] || []).some((p: any) => String(p.plugItemHash) === hash && p.canInsert === true && p.enabled === true);
}
export async function markCleanupCosmetics(row: SessionRow, env: Env, itemId: string, characterId: string, settings: CleanupSettings): Promise<string[]> {
  if (!settings.cosmetics?.enabled) return [];
  const warnings: string[] = [];
  const [{ profile, accessToken }, manifest] = await Promise.all([profileFor(row, env, "build-advisor", true), loadGearManifest(env)]);
  const item = gearActionItemsFromProfile(profile).get(itemId);
  if (!item || item.ownerCharacterId !== characterId || item.equipped || item.locked) return ["Pulled successfully; appearance not changed because ownership or protection changed."];
  const def = manifest.gearItemDefinitions[item.itemHash] as any;
  const isWeapon = Number(def?.itemType) === 3;
  const className = ["Titan", "Hunter", "Warlock"][Number(def?.classType)] || "Unknown";
  const group = `${className}:${String(def?.itemTypeDisplayName || "Armor")}`;
  const styleId = settings.cosmetics.classStyles?.[className];
  const style = styleId ? manifest.cosmeticSets?.find((set) => set.id === styleId && set.className === className) : undefined;
  const ornament = styleId ? style?.pieces[group] : settings.cosmetics.ornaments[group];
  if (!isWeapon && styleId && !ornament) warnings.push("Pulled successfully; the selected class style has no compatible piece for this slot. Appearance left unchanged.");
  const selected = [isWeapon ? settings.cosmetics.weaponShader : settings.cosmetics.armorShader, !isWeapon ? ornament : undefined].filter((v): v is string => Boolean(v));
  for (const hash of selected) {
    const plug = manifest.plugDefinitions[hash] as any;
    if (!/shader|ornament|skin/i.test(String(plug?.plug?.plugCategoryIdentifier || ""))) { warnings.push("Pulled successfully; selected cosmetic definition is unavailable."); continue; }
    const sockets: any[] = profile?.itemComponents?.sockets?.data?.[itemId]?.sockets || [];
    const index = sockets.findIndex((_socket, i) => insertable(profile, itemId, i, hash));
    if (index < 0) { warnings.push("Pulled successfully; selected cosmetic is not owned or insertable on this item."); continue; }
    const original = String(sockets[index]?.plugHash || "");
    if (!original || original === hash) continue;
    if (!insertable(profile, itemId, index, original)) { warnings.push("Pulled successfully; appearance unchanged because the original cosmetic cannot currently be restored."); continue; }
    // Preserve the original appearance across retries. Never overwrite an unresolved journal.
    const previous = await env.DB.prepare("SELECT original_hash, applied_hash FROM cleanup_cosmetics WHERE membership_id = ? AND item_id = ? AND socket_index = ?").bind(row.membership_id, itemId, index).first<{ original_hash: string; applied_hash: string }>();
    if (previous && (previous.applied_hash !== hash || previous.original_hash !== original)) { warnings.push("Pulled successfully; an earlier cosmetic change must be restored before another is applied."); continue; }
    await env.DB.prepare("INSERT OR IGNORE INTO cleanup_cosmetics (membership_id, item_id, socket_index, original_hash, applied_hash) VALUES (?, ?, ?, ?, ?)").bind(row.membership_id, itemId, index, original, hash).run();
    try { await bungiePost("/Destiny2/Actions/Items/InsertSocketPlugFree/", { itemId, characterId, membershipType: row.membership_type, plug: { socketIndex: index, socketArrayType: 0, plugItemHash: Number(hash) } }, env, accessToken); }
    catch { warnings.push("Pulled successfully; Bungie could not apply the selected cosmetic. No currency was spent."); }
  }
  return warnings;
}
export async function restoreCleanupCosmetics(row: SessionRow, env: Env, itemId: string): Promise<string[]> {
  const { profile, accessToken } = await profileFor(row, env, "gear-action", true);
  const item = gearActionItemsFromProfile(profile).get(itemId);
  if (!item?.ownerCharacterId || item.location === "vault" || item.equipped || item.locked) throw httpError(409, "cleanup_restore_unavailable", "Pull the unequipped, unlocked item to a character before restoring its appearance.");
  const rows = await env.DB.prepare("SELECT socket_index, original_hash, applied_hash FROM cleanup_cosmetics WHERE membership_id = ? AND item_id = ?").bind(row.membership_id, itemId).all<{ socket_index: number; original_hash: string; applied_hash: string }>();
  const warnings: string[] = [];
  for (const change of rows.results || []) {
    const current = String(profile?.itemComponents?.sockets?.data?.[itemId]?.sockets?.[change.socket_index]?.plugHash || "");
    if (current !== change.original_hash) {
      if (current !== change.applied_hash) { warnings.push("Appearance changed since cleanup; your newer choice was not overwritten."); continue; }
      if (!insertable(profile, itemId, change.socket_index, change.original_hash)) { warnings.push("Bungie does not currently allow the original cosmetic to be restored."); continue; }
      try { await bungiePost("/Destiny2/Actions/Items/InsertSocketPlugFree/", { itemId, characterId: item.ownerCharacterId, membershipType: row.membership_type, plug: { socketIndex: change.socket_index, socketArrayType: 0, plugItemHash: Number(change.original_hash) } }, env, accessToken); }
      catch { warnings.push("Bungie could not restore one cosmetic; you can retry."); continue; }
    }
    await env.DB.prepare("DELETE FROM cleanup_cosmetics WHERE membership_id = ? AND item_id = ? AND socket_index = ? AND original_hash = ? AND applied_hash = ?").bind(row.membership_id, itemId, change.socket_index, change.original_hash, change.applied_hash).run();
  }
  return warnings;
}
