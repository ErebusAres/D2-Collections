import type { BuildCatalogKind, BuildGuardianClass, BuildNamedEntry, BuildSubclass } from "@guardian-nexus/contracts";
import { Search } from "lucide-react";
import { useState } from "react";
import { namedEntryFromCatalog, useBuildCatalog } from "../../modules/builds/buildCatalog";
import { searchDestinySymbols } from "../../modules/builds/destinySymbols";
import styles from "../../pages/Builds.module.css";

type PickerCategory = { id: string; label: string; source: "emoji" | "symbol" | "catalog"; kind?: BuildCatalogKind };

const CATEGORIES: PickerCategory[] = [
  { id: "symbols", label: "Destiny symbols", source: "symbol" },
  { id: "emoji", label: "Emoji", source: "emoji" },
  { id: "traits", label: "Traits & icons", source: "catalog", kind: "icon" },
  { id: "weapons", label: "Weapons", source: "catalog", kind: "weapon" },
  { id: "perks", label: "Weapon perks", source: "catalog", kind: "weaponPerk" },
  { id: "armor", label: "Armor", source: "catalog", kind: "armor" },
  { id: "spirits", label: "Spirits", source: "catalog", kind: "exoticSpirit" },
  { id: "subclasses", label: "Subclasses", source: "catalog", kind: "subclass" },
  { id: "supers", label: "Supers", source: "catalog", kind: "super" },
  { id: "class-abilities", label: "Class abilities", source: "catalog", kind: "classAbility" },
  { id: "movement", label: "Movement", source: "catalog", kind: "movement" },
  { id: "grenades", label: "Grenades", source: "catalog", kind: "grenade" },
  { id: "melees", label: "Melees", source: "catalog", kind: "melee" },
  { id: "transcendence", label: "Transcendence", source: "catalog", kind: "transcendence" },
  { id: "aspects", label: "Aspects", source: "catalog", kind: "aspect" },
  { id: "fragments", label: "Fragments", source: "catalog", kind: "fragment" },
  { id: "mods", label: "Armor mods", source: "catalog", kind: "armorMod" },
  { id: "artifact", label: "Artifact", source: "catalog", kind: "artifactPerk" }
];

const NATIVE_EMOJI = [
  ["✅", "check ready complete"], ["⚠️", "warning caution"], ["❌", "cross no avoid"], ["⭐", "star favorite"],
  ["🔥", "fire hot damage"], ["⚡", "lightning arc fast"], ["🛡️", "shield defense"], ["💥", "impact burst"],
  ["🎯", "target precision"], ["💀", "skull danger"], ["👑", "crown leader"], ["🧠", "brain strategy"],
  ["⏱️", "timer cooldown"], ["📍", "pin location"], ["👍", "thumbs up"], ["👎", "thumbs down"]
] as const;

export function BuildNotesIconPicker({ classType, subclass, onIcon, onEmoji, onAlias }: {
  classType: BuildGuardianClass;
  subclass: BuildSubclass;
  onIcon: (entry: BuildNamedEntry) => void;
  onEmoji: (emoji: string) => void;
  onAlias: (alias: string) => void;
}) {
  const [categoryId, setCategoryId] = useState("symbols");
  const [query, setQuery] = useState("");
  const categories = CATEGORIES.filter((entry) => entry.id !== "transcendence" || subclass === "prismatic");
  const category = categories.find((entry) => entry.id === categoryId) || categories[0]!;
  const catalog = useBuildCatalog({
    kind: category.kind || "noteIcon",
    query,
    classType,
    subclass,
    enabled: category.source === "catalog",
    allowEmpty: true
  });
  const native = NATIVE_EMOJI.filter(([, keywords]) => !query.trim() || keywords.includes(query.trim().toLocaleLowerCase()));
  const symbols = searchDestinySymbols(query, classType);
  const results = catalog.data?.data.results || [];
  return <section className={styles.notesIconPicker} aria-label="Emoji and Destiny icon picker">
    <nav>{categories.map((entry) => <button type="button" key={entry.id} data-active={entry.id === category.id} onClick={() => { setCategoryId(entry.id); setQuery(""); }}>{entry.label}</button>)}</nav>
    <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${category.label.toLocaleLowerCase()}…`} autoFocus /></label>
    <div className={styles.notesIconResults}>
      {category.source === "emoji" && native.map(([emoji, keywords]) => <button type="button" key={emoji} title={keywords} aria-label={`Insert ${keywords.split(" ")[0]} emoji`} onClick={() => onEmoji(emoji)}><b>{emoji}</b><span>{keywords.split(" ")[0]}</span></button>)}
      {category.source === "symbol" && symbols.map((entry) => <button type="button" key={entry.alias} title={`:${entry.alias}: · ${entry.name} · ${entry.itemType}`} aria-label={`Insert :${entry.alias}: ${entry.name} symbol`} onClick={() => onAlias(entry.alias)}><img src={entry.icon} alt="" /><span>:{entry.alias}: · {entry.name}</span></button>)}
      {category.source === "catalog" && catalog.isLoading && <p>Loading the current Bungie catalog…</p>}
      {category.source === "catalog" && catalog.error && <p>That catalog category is temporarily unavailable. Choose another category or try again.</p>}
      {category.source === "catalog" && !catalog.isLoading && !catalog.error && results.map((entry) => <button type="button" key={`${entry.hash}-${entry.name}`} title={`${entry.name} · ${entry.itemType}`} aria-label={`Insert ${entry.name} Destiny icon`} onClick={() => onIcon(namedEntryFromCatalog(entry))}>
        <img src={entry.icon} alt="" loading="lazy" /><span>{entry.name}</span>
      </button>)}
      {category.source === "symbol" && !symbols.length && <p>No built-in Destiny symbol matches this search.</p>}
      {category.source === "catalog" && !catalog.isLoading && !catalog.error && !results.length && <p>No current Bungie definition matches this search.</p>}
    </div>
  </section>;
}
