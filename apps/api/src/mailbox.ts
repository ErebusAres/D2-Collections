import type { CompanionManifest, MailboxData, MailboxItem } from "@guardian-nexus/contracts";
import { imageUrl } from "@guardian-nexus/domain";
import { charactersFromProfile } from "./normalize";

const POSTMASTER_BUCKET_HASH = "215593132";

export function postmasterPullEligibility(item: any, definition: any): { canPull: boolean; needsSpace?: boolean; unavailableReason?: string } {
  const instanceId = String(item?.itemInstanceId ?? "");
  if (!/^\d+$/.test(instanceId)) return { canPull: false, unavailableReason: "Bungie did not provide an item identifier." };
  if (!definition) return { canPull: false, unavailableReason: "Item details are unavailable, so Guardian Nexus cannot verify a safe pull." };
  if (definition?.allowActions === false) return { canPull: false, unavailableReason: "Bungie does not allow API actions for this item." };
  if (Number(definition?.itemType) === 8 || /\bengram\b/i.test(String(definition?.itemTypeDisplayName || ""))) {
    return { canPull: false, unavailableReason: "Engrams must be collected from the Postmaster in Destiny." };
  }
  if (definition?.doesPostmasterPullHaveSideEffects) return { canPull: false, unavailableReason: "Pulling this item may consume or replace rewards, so it must be collected in Destiny." };
  const transferStatus = Number(item?.transferStatus || 0);
  return { canPull: true, ...((transferStatus & 4) !== 0 ? { needsSpace: true } : {}) };
}

export function postmasterRoomCandidate(profile: any, characterId: string, destinationBucketHash: string): any | undefined {
  const states = profile?.itemComponents?.state?.data || {};
  const instances = profile?.itemComponents?.instances?.data || {};
  return [...(profile?.characterInventories?.data?.[characterId]?.items || [])]
    .filter((item: any) => String(item?.bucketHash || "") === destinationBucketHash && String(item?.bucketHash || "") !== POSTMASTER_BUCKET_HASH)
    .filter((item: any) => /^\d+$/.test(String(item?.itemInstanceId || "")) && Number(item?.transferStatus || 0) === 0)
    .filter((item: any) => {
      const instanceId = String(item.itemInstanceId);
      const state = Number(states[instanceId]?.state || 0);
      return (state & 5) === 0 && !instances[instanceId]?.isCrafted;
    })
    .sort((left: any, right: any) => Number(instances[String(left.itemInstanceId)]?.primaryStat?.value || 0) - Number(instances[String(right.itemInstanceId)]?.primaryStat?.value || 0))[0];
}

export function postmasterItemsForCharacter(profile: any, characterId: string): any[] {
  return (profile?.characterInventories?.data?.[characterId]?.items || [])
    .filter((item: any) => String(item?.bucketHash || "") === POSTMASTER_BUCKET_HASH);
}

export function postmasterItemForPull(profile: any, characterId: string, itemInstanceId: string, itemHash: string): any | undefined {
  return postmasterItemsForCharacter(profile, characterId).find((item: any) =>
    String(item?.itemInstanceId ?? "") === itemInstanceId && String(item?.itemHash ?? "") === itemHash
  );
}

export function normalizeMailbox(profile: any, manifest: CompanionManifest): MailboxData {
  const characters = charactersFromProfile(profile);
  const bucket = manifest.bucketDefinitions[POSTMASTER_BUCKET_HASH] as any;
  const capacity = Math.max(0, Number(bucket?.itemCount || 0));
  const rows = characters.map((character) => {
    const items = postmasterItemsForCharacter(profile, character.characterId).map((item: any): MailboxItem => {
      const itemHash = String(item?.itemHash || "");
      const instanceId = String(item?.itemInstanceId ?? "");
      const definition = manifest.itemDefinitions[itemHash] as any;
      const properties = definition?.displayProperties || {};
      const definitionAvailable = Boolean(properties.name);
      const eligibility = postmasterPullEligibility(item, definition);
      return {
        instanceId,
        itemHash,
        characterId: character.characterId,
        name: String(properties.name || "Item definition unavailable"),
        description: String(properties.description || ""),
        icon: imageUrl(properties.icon),
        itemType: String(definition?.itemTypeDisplayName || "Item type unavailable"),
        rarity: String(definition?.inventory?.tierTypeName || "Rarity unavailable"),
        quantity: Math.max(1, Number(item?.quantity || 1)),
        bucketHash: String(item?.bucketHash || ""),
        ...eligibility,
        definitionAvailable
      };
    });
    return {
      characterId: character.characterId,
      className: character.className,
      emblemPath: character.emblemPath,
      count: items.length,
      capacity,
      items
    };
  });
  return {
    manifestVersion: manifest.version,
    count: rows.reduce((total, character) => total + character.count, 0),
    capacity: rows.reduce((total, character) => total + character.capacity, 0),
    characters: rows
  };
}
