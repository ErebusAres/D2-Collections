import type { BuildGuardianClass, BuildNamedEntry } from "@guardian-nexus/contracts";

export interface DestinySymbol extends BuildNamedEntry {
  alias: string;
  keywords: string;
}

const BUNGIE = "https://www.bungie.net/common/destiny2_content/icons/";

const SYMBOLS: DestinySymbol[] = [
  symbol("arc", "Arc", `${BUNGIE}DestinyDamageTypeDefinition_092d066688b879c807c3b460afdd61e6.png`, "Element", "light electricity subclass"),
  symbol("solar", "Solar", `${BUNGIE}DestinyDamageTypeDefinition_2a1773e10968f2d088b97c22b22bba9e.png`, "Element", "light fire subclass"),
  symbol("void", "Void", `${BUNGIE}DestinyDamageTypeDefinition_ceb2f6197dccf3958bb31cc783eb97a0.png`, "Element", "light purple subclass"),
  symbol("stasis", "Stasis", `${BUNGIE}DestinyDamageTypeDefinition_530c4c3e7981dc2aefd24fd3293482bf.png`, "Element", "darkness ice subclass"),
  symbol("strand", "Strand", `${BUNGIE}DestinyDamageTypeDefinition_b2fe51a94f3533f97079dfa0d27a4096.png`, "Element", "darkness green subclass"),
  symbol("kinetic", "Kinetic", `${BUNGIE}DestinyDamageTypeDefinition_3385a924fd3ccb92c343ade19f19a370.png`, "Damage Type", "weapon slot primary"),
  symbol("power", "Power", "/icons/destiny/power.svg", "Guardian Power", "light level heavy power weapon"),
  symbol("super", "Super", `${BUNGIE}585ae4ede9c3da96b34086fccccdc8cd.png`, "Guardian Stat", "ability ultimate"),
  symbol("grenade", "Grenade", `${BUNGIE}065cdaabef560e5808e821cefaeaa22c.png`, "Guardian Stat", "ability discipline"),
  symbol("melee", "Melee", `${BUNGIE}fa534aca76d7f2d7e7b4ba4df4271b42.png`, "Guardian Stat", "ability strength"),
  symbol("class", "Class Ability", `${BUNGIE}7eb845acb5b3a4a9b7e0b2f05f5c43f1.png`, "Guardian Stat", "dodge barricade rift"),
  symbol("weapons", "Weapons", `${BUNGIE}bc69675acdae9e6b9a68a02fb4d62e07.png`, "Guardian Stat", "guns weapon stat"),
  symbol("health", "Health", `${BUNGIE}717b8b218cc14325a54869bef21d2964.png`, "Guardian Stat", "survivability armor"),
  symbol("transcendence", "Transcendence", `${BUNGIE}cecb681426570c4cdde540284e6407c4.jpg`, "Prismatic Ability", "prismatic light dark"),
  symbol("overload", "Overload Champion", "/icons/destiny/overload.svg", "Champion", "overcharge disrupt champion"),
  symbol("barrier", "Barrier Champion", "/icons/destiny/barrier.svg", "Champion", "shield anti-barrier champion"),
  symbol("unstoppable", "Unstoppable Champion", "/icons/destiny/unstoppable.svg", "Champion", "stagger champion")
];

const PRISMATIC: Record<BuildGuardianClass, DestinySymbol> = {
  hunter: symbol("prismatic", "Prismatic Hunter", `${BUNGIE}fab506e62fa4f188bfe2fb6d56b39614.png`, "Hunter Subclass", "light dark transcendence"),
  titan: symbol("prismatic", "Prismatic Titan", `${BUNGIE}c1740d829e62afc40a9e57af4e3cad4c.png`, "Titan Subclass", "light dark transcendence"),
  warlock: symbol("prismatic", "Prismatic Warlock", `${BUNGIE}652406349e99e3db0c3198f78af4eeae.png`, "Warlock Subclass", "light dark transcendence")
};

const ALIAS_REDIRECTS: Record<string, string> = {
  overcharge: "overload",
  shield: "barrier",
  weapon: "weapons",
  heavy: "power"
};

export function destinySymbols(classType: BuildGuardianClass = "titan"): DestinySymbol[] {
  return [...SYMBOLS, PRISMATIC[classType]];
}

export function destinySymbol(alias: string, classType: BuildGuardianClass = "titan"): DestinySymbol | undefined {
  const normalized = ALIAS_REDIRECTS[alias.toLocaleLowerCase()] || alias.toLocaleLowerCase();
  return destinySymbols(classType).find((entry) => entry.alias === normalized);
}

export function searchDestinySymbols(query: string, classType: BuildGuardianClass): DestinySymbol[] {
  const needle = query.trim().toLocaleLowerCase();
  return destinySymbols(classType).filter((entry) => !needle || `${entry.alias} ${entry.name} ${entry.itemType} ${entry.keywords}`.toLocaleLowerCase().includes(needle));
}

function symbol(alias: string, name: string, icon: string, itemType: string, keywords: string): DestinySymbol {
  return { alias, hash: `guardian-nexus-symbol-${alias}`, name, icon, itemType, keywords };
}
