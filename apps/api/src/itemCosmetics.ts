import type { GearManifest } from "@guardian-nexus/contracts";
import { imageUrl } from "@guardian-nexus/domain";
import { bungiePost, loadGearManifest, profileFor } from "./bungie";
import { gearActionItemsFromProfile } from "./gear";
import { httpError } from "./security";
import type { Env, SessionRow } from "./types";

export function cosmeticKind(definition: any): "shader" | "ornament" | undefined {
  const category = String(definition?.plug?.plugCategoryIdentifier || "");
  return /shader/i.test(category) ? "shader" : /ornament|skin/i.test(category) ? "ornament" : undefined;
}

/** Resolve only the live plug sources referenced by this exact socket. Definitions are not ownership. */
export function cosmeticSocketEntries(profile: any, manifest: GearManifest, itemHash: string, itemId: string, socketIndex: number, characterId?: string): any[] {
  const socket = (manifest.gearItemDefinitions[itemHash] as any)?.cosmeticSockets?.[String(socketIndex)];
  const entries: any[] = [...(profile?.itemComponents?.reusablePlugs?.data?.[itemId]?.plugs?.[String(socketIndex)] || [])];
  if (!socket?.reusablePlugSetHash) return entries;
  const sources = Number(socket.plugSources || 0), hash = String(socket.reusablePlugSetHash);
  if (sources & 4) entries.push(...(profile?.profilePlugSets?.data?.plugs?.[hash] || []));
  if (sources & 8) {
    const characters = characterId ? [characterId] : Object.keys(profile?.characters?.data || {});
    for (const id of characters) entries.push(...(profile?.characterPlugSets?.data?.[id]?.plugs?.[hash] || []));
  }
  return entries;
}

export function itemCosmeticChoices(profile: any, manifest: GearManifest, itemId: string, characterId?: string) {
  const item = gearActionItemsFromProfile(profile).get(itemId);
  if (!item) throw httpError(404, "ownership_invalid", "This item is no longer in your inventory.");
  const owner = item.ownerCharacterId || characterId;
  const sockets: any[] = profile?.itemComponents?.sockets?.data?.[itemId]?.sockets || [];
  const choices = sockets.flatMap((socket, socketIndex) => {
    const unique = new Map<string, { hash: string; name: string; icon: string; kind: "shader" | "ornament"; socketIndex: number; selected: boolean; enabled: boolean }>();
    const candidates = cosmeticSocketEntries(profile, manifest, item.itemHash, itemId, socketIndex, owner);
    candidates.push({ plugItemHash: socket.plugHash, canInsert: true, enabled: true });
    for (const entry of candidates) {
      if (entry.canInsert !== true) continue;
      const hash = String(entry.plugItemHash), def = manifest.plugDefinitions[hash] as any, kind = cosmeticKind(def);
      if (!kind || !def?.displayProperties?.name) continue;
      const previous = unique.get(hash);
      unique.set(hash, { hash, name: def.displayProperties.name, icon: imageUrl(def.displayProperties.icon), kind, socketIndex, selected: hash === String(socket.plugHash), enabled: entry.enabled === true || previous?.enabled === true });
    }
    return [...unique.values()].sort((a, b) => Number(b.selected) - Number(a.selected) || a.name.localeCompare(b.name));
  });
  return { itemId, characterId: owner, canApply: Boolean(owner && !item.inPostmaster && item.location !== "vault"), choices, warning: !sockets.length ? "Bungie did not return this item's sockets. Refresh before changing appearance." : item.location === "vault" ? "Pull this item to a character before changing its appearance." : undefined };
}

export async function readItemCosmetics(row: SessionRow, env: Env, itemId: string, characterId?: string) {
  const [{ profile }, manifest] = await Promise.all([profileFor(row, env, "gear-action", true), loadGearManifest(env)]);
  return itemCosmeticChoices(profile, manifest, itemId, characterId);
}

export async function applyItemCosmetic(row: SessionRow, env: Env, input: { itemId: string; socketIndex: number; hash: string; expectedHash: string }) {
  const [{ profile, accessToken }, manifest] = await Promise.all([profileFor(row, env, "gear-action", true), loadGearManifest(env)]);
  const data = itemCosmeticChoices(profile, manifest, input.itemId);
  if (!data.canApply || !data.characterId) throw httpError(409, "cosmetic_location", data.warning || "Move this item to a character first.");
  const current = String(profile?.itemComponents?.sockets?.data?.[input.itemId]?.sockets?.[input.socketIndex]?.plugHash || "");
  if (current === input.hash) return { itemId: input.itemId, hash: input.hash };
  if (current !== input.expectedHash) throw httpError(409, "cosmetic_changed", "This item's appearance changed. Refresh the choices before applying.");
  const choice = data.choices.find((entry) => entry.socketIndex === input.socketIndex && entry.hash === input.hash && entry.enabled);
  if (!choice) throw httpError(409, "cosmetic_unavailable", "This appearance is not currently owned, compatible, and insertable on this item.");
  await bungiePost("/Destiny2/Actions/Items/InsertSocketPlugFree/", { itemId: input.itemId, characterId: data.characterId, membershipType: row.membership_type, plug: { socketIndex: input.socketIndex, socketArrayType: 0, plugItemHash: Number(input.hash) } }, env, accessToken);
  return { itemId: input.itemId, hash: input.hash };
}
