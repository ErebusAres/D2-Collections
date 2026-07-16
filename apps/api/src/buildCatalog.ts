import type { BuildCatalogData, BuildCatalogEntry, BuildCatalogKind, BuildGuardianClass, BuildSubclass, CompanionManifest, GearManifest } from "@guardian-nexus/contracts";
import { imageUrl } from "@guardian-nexus/domain";
import { z } from "zod";
import { loadCompanionManifest, loadGearManifest } from "./bungie";
import type { Env } from "./types";

const querySchema = z.object({
  kind: z.enum(["subclass", "super", "classAbility", "movement", "melee", "grenade", "aspect", "fragment", "weapon", "armor", "armorMod", "artifact", "artifactPerk", "champion", "cosmetic", "icon"]),
  q: z.string().trim().max(100).default(""),
  classType: z.enum(["hunter", "titan", "warlock"]).optional(),
  subclass: z.enum(["prismatic", "arc", "solar", "void", "strand", "stasis"]).optional(),
  slot: z.enum(["helmet", "arms", "chest", "legs", "classItem"]).optional()
});

const classByNumber: Record<number, BuildGuardianClass | undefined> = { 0: "titan", 1: "hunter", 2: "warlock" };
const subclassNames: Record<BuildGuardianClass, Record<BuildSubclass, string>> = {
  hunter: { prismatic: "Prismatic Hunter", arc: "Arcstrider", solar: "Gunslinger", void: "Nightstalker", strand: "Threadrunner", stasis: "Revenant" },
  titan: { prismatic: "Prismatic Titan", arc: "Striker", solar: "Sunbreaker", void: "Sentinel", strand: "Berserker", stasis: "Behemoth" },
  warlock: { prismatic: "Prismatic Warlock", arc: "Stormcaller", solar: "Dawnblade", void: "Voidwalker", strand: "Broodweaver", stasis: "Shadebinder" }
};

export async function loadBuildCatalog(url: URL, env: Env): Promise<BuildCatalogData> {
  const input = querySchema.parse(Object.fromEntries(url.searchParams));
  const [companion, gear] = await Promise.all([loadCompanionManifest(env), loadGearManifest(env)]);
  const available = companion.version !== "unavailable";
  return {
    manifestVersion: companion.version,
    available,
    warning: available ? undefined : "The current Bungie manifest is unavailable. Use manual fallback only for definitions that cannot wait for the next manifest sync.",
    results: searchBuildCatalog(companion, gear, input)
  };
}

export function searchBuildCatalog(
  companion: CompanionManifest,
  gear: GearManifest,
  input: z.infer<typeof querySchema>
): BuildCatalogEntry[] {
  if (companion.version === "unavailable") return [];
  const query = input.q.toLocaleLowerCase();
  if (input.kind === "icon" && query.length < 2) return [];
  const seen = new Set<string>();
  const results: BuildCatalogEntry[] = [];
  for (const [hash, raw] of Object.entries(companion.itemDefinitions)) {
    const definition = raw as any;
    const properties = definition.displayProperties || {};
    const name = String(properties.name || "").trim();
    const icon = imageUrl(String(properties.icon || ""));
    if (!name || !icon || unavailableName(name)) continue;
    const itemType = String(definition.itemTypeDisplayName || "");
    const plugCategory = String(definition.plug?.plugCategoryIdentifier || "").toLocaleLowerCase();
    const kind = classifyBuildEntry(definition, input.kind);
    if (!kind) continue;
    const classType = entryClass(plugCategory, (gear.gearItemDefinitions[hash] as any)?.classType, itemType);
    const subclass = entrySubclass(name, plugCategory, classType, itemType);
    if (input.classType && classType && classType !== input.classType) continue;
    if (input.kind === "subclass" && input.classType && classType !== input.classType) continue;
    if (input.kind === "armor" && input.classType && classType !== input.classType) continue;
    if (input.subclass && abilityKind(input.kind) && subclass && subclass !== input.subclass) continue;
    if (input.subclass && abilityKind(input.kind) && !subclass) continue;
    if (input.slot && input.kind === "armorMod" && !matchesArmorModSlot(itemType, input.slot)) continue;
    const description = String(properties.description || "");
    const rarity = String(definition.inventory?.tierTypeName || "");
    const slot = String(definition.equipmentSlot || "");
    const damageType = String(definition.damageType || "");
    const search = `${name} ${itemType} ${description} ${rarity} ${slot} ${damageType}`.toLocaleLowerCase();
    if (query && !search.includes(query)) continue;
    const key = `${input.kind}:${name.toLocaleLowerCase()}:${icon}:${classType || "any"}:${subclass || "any"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      hash,
      name,
      description,
      icon,
      itemType,
      rarity,
      slot,
      damageType,
      kind,
      classType,
      subclass,
      exotic: rarity.toLocaleLowerCase() === "exotic"
    });
  }
  return results.sort((left, right) => {
    const leftExact = query && left.name.toLocaleLowerCase() === query ? 0 : query && left.name.toLocaleLowerCase().startsWith(query) ? 1 : 2;
    const rightExact = query && right.name.toLocaleLowerCase() === query ? 0 : query && right.name.toLocaleLowerCase().startsWith(query) ? 1 : 2;
    return leftExact - rightExact || Number(right.exotic) - Number(left.exotic) || left.name.localeCompare(right.name);
  }).slice(0, 60);
}

function classifyBuildEntry(definition: any, requested: BuildCatalogKind): BuildCatalogKind | undefined {
  const type = String(definition.itemTypeDisplayName || "").toLocaleLowerCase();
  const name = String(definition.displayProperties?.name || "").toLocaleLowerCase();
  const plug = String(definition.plug?.plugCategoryIdentifier || "").toLocaleLowerCase();
  const is = (kind: BuildCatalogKind): boolean => {
    if (kind === "subclass") return type.endsWith(" subclass");
    if (kind === "super") return type.includes("super ability") || plug.endsWith(".supers");
    if (kind === "classAbility") return type === "class ability" || plug.includes("class_abilities");
    if (kind === "movement") return type === "movement ability" || plug.endsWith(".movement");
    if (kind === "melee") return (type.includes("melee") || plug.endsWith(".melee")) && !type.includes("weapon");
    if (kind === "grenade") return (type.includes("grenade") || plug.includes("grenade")) && !type.includes("launcher") && !type.includes("mod") && !type.includes("artifact");
    if (kind === "aspect") return type.includes("aspect") && plug.includes("aspect");
    if (kind === "fragment") return type.includes("fragment") && plug.includes("fragment");
    if (kind === "weapon") return Number(definition.itemType) === 3;
    if (kind === "armor") return Number(definition.itemType) === 2;
    if (kind === "armorMod") return type.includes("armor mod") && !type.includes("deprecated");
    if (kind === "artifact") return type === "artifact" || type === "seasonal artifact";
    if (kind === "artifactPerk") return type === "artifact perk";
    if (kind === "champion") return type === "artifact perk" && /(anti[- ]?barrier|overload|unstoppable)/.test(name);
    if (kind === "cosmetic") return /(ornament|shader|ghost shell|vehicle|ship)/.test(type);
    if (kind === "icon") return ["super", "classAbility", "movement", "melee", "grenade", "aspect", "fragment", "armorMod", "artifactPerk", "champion"].some((entry) => is(entry as BuildCatalogKind));
    return false;
  };
  if (!is(requested)) return undefined;
  if (requested !== "icon") return requested;
  return (["super", "classAbility", "movement", "melee", "grenade", "aspect", "fragment", "armorMod", "artifactPerk", "champion"] as BuildCatalogKind[]).find(is) || "icon";
}

function entryClass(plug: string, gearClassType: unknown, itemType: string): BuildGuardianClass | undefined {
  if (plug.includes("hunter.")) return "hunter";
  if (plug.includes("titan.")) return "titan";
  if (plug.includes("warlock.")) return "warlock";
  if (itemType.toLocaleLowerCase().startsWith("hunter ")) return "hunter";
  if (itemType.toLocaleLowerCase().startsWith("titan ")) return "titan";
  if (itemType.toLocaleLowerCase().startsWith("warlock ")) return "warlock";
  return classByNumber[Number(gearClassType)];
}

function entrySubclass(name: string, plug: string, classType: BuildGuardianClass | undefined, itemType: string): BuildSubclass | undefined {
  if (itemType.endsWith(" Subclass") && classType) {
    return (Object.entries(subclassNames[classType]) as [BuildSubclass, string][]).find(([, label]) => label.toLocaleLowerCase() === name.toLocaleLowerCase())?.[0];
  }
  if (plug.includes(".prism.") || plug.includes("shared.prism.")) return "prismatic";
  return (["arc", "solar", "void", "strand", "stasis"] as BuildSubclass[]).find((value) => plug.includes(`.${value}.`) || plug.includes(`shared.${value}.`));
}

function abilityKind(kind: BuildCatalogKind): boolean {
  return ["super", "classAbility", "movement", "melee", "grenade", "aspect", "fragment"].includes(kind);
}

function matchesArmorModSlot(itemType: string, slot: NonNullable<z.infer<typeof querySchema>["slot"]>): boolean {
  if (itemType === "General Armor Mod" || itemType === "Artifice Armor Mod" || itemType === "Armor Mod") return true;
  const label = slot === "helmet" ? "helmet" : slot === "arms" ? "arms" : slot === "chest" ? "chest" : slot === "legs" ? "leg" : "class item";
  return itemType.toLocaleLowerCase().startsWith(label);
}

function unavailableName(name: string): boolean {
  return /^(empty|locked|deprecated|unfocused|new subclass:)/i.test(name);
}
