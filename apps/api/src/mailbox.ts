import type { CompanionManifest, MailboxData, MailboxItem } from "@guardian-nexus/contracts";
import { imageUrl } from "@guardian-nexus/domain";
import { charactersFromProfile } from "./normalize";

const POSTMASTER_BUCKET_HASH = "215593132";

export function postmasterItemsForCharacter(profile: any, characterId: string): any[] {
  return (profile?.characterInventories?.data?.[characterId]?.items || [])
    .filter((item: any) => String(item?.bucketHash || "") === POSTMASTER_BUCKET_HASH);
}

export function normalizeMailbox(profile: any, manifest: CompanionManifest): MailboxData {
  const characters = charactersFromProfile(profile);
  const bucket = manifest.bucketDefinitions[POSTMASTER_BUCKET_HASH] as any;
  const capacity = Math.max(0, Number(bucket?.itemCount || 0));
  const rows = characters.map((character) => {
    const items = postmasterItemsForCharacter(profile, character.characterId).map((item: any): MailboxItem => {
      const itemHash = String(item?.itemHash || "");
      const instanceId = String(item?.itemInstanceId || "");
      const definition = manifest.itemDefinitions[itemHash] as any;
      const properties = definition?.displayProperties || {};
      const definitionAvailable = Boolean(properties.name);
      const transferStatus = Number(item?.transferStatus || 0);
      const canPull = /^\d+$/.test(instanceId) && transferStatus === 0;
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
        canPull,
        ...(!canPull ? { unavailableReason: instanceId ? "Bungie has marked this item as non-transferable." : "Bungie did not provide an item instance ID." } : {}),
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
