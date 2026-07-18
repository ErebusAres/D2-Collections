import type { BuildCatalogKind, BuildGuardianClass, BuildNamedEntry, BuildSubclass } from "@guardian-nexus/contracts";
import { Search } from "lucide-react";
import { useState } from "react";
import { namedEntryFromCatalog, useBuildCatalog } from "../../modules/builds/buildCatalog";
import styles from "../../pages/Builds.module.css";

const CATEGORIES: Array<{ id: string; label: string; kind?: BuildCatalogKind }> = [
  { id: "emoji", label: "Emoji" },
  { id: "elements", label: "Game symbols", kind: "noteIcon" },
  { id: "symbols", label: "Traits & symbols", kind: "icon" },
  { id: "weapons", label: "Weapons", kind: "weapon" },
  { id: "perks", label: "Weapon perks", kind: "weaponPerk" },
  { id: "armor", label: "Armor", kind: "armor" },
  { id: "spirits", label: "Spirits", kind: "exoticSpirit" },
  { id: "subclasses", label: "Subclasses", kind: "subclass" },
  { id: "supers", label: "Supers", kind: "super" },
  { id: "class-abilities", label: "Class abilities", kind: "classAbility" },
  { id: "movement", label: "Movement", kind: "movement" },
  { id: "grenades", label: "Grenades", kind: "grenade" },
  { id: "melees", label: "Melees", kind: "melee" },
  { id: "transcendence", label: "Transcendence", kind: "transcendence" },
  { id: "aspects", label: "Aspects", kind: "aspect" },
  { id: "fragments", label: "Fragments", kind: "fragment" },
  { id: "mods", label: "Armor mods", kind: "armorMod" },
  { id: "artifact", label: "Artifact", kind: "artifactPerk" }
];

const NATIVE_EMOJI = [
  ["✅", "check ready complete"], ["⚠️", "warning caution"], ["❌", "cross no avoid"], ["⭐", "star favorite"],
  ["🔥", "fire hot damage"], ["⚡", "lightning arc fast"], ["🛡️", "shield defense"], ["💥", "impact burst"],
  ["🎯", "target precision"], ["💀", "skull danger"], ["👑", "crown leader"], ["🧠", "brain strategy"],
  ["⏱️", "timer cooldown"], ["📍", "pin location"], ["👍", "thumbs up"], ["👎", "thumbs down"]
] as const;

export function BuildNotesIconPicker({ classType, subclass, onIcon, onEmoji }: {
  classType: BuildGuardianClass;
  subclass: BuildSubclass;
  onIcon: (entry: BuildNamedEntry) => void;
  onEmoji: (emoji: string) => void;
}) {
  const [categoryId, setCategoryId] = useState("emoji");
  const [query, setQuery] = useState("");
  const category = CATEGORIES.find((entry) => entry.id === categoryId) || CATEGORIES[0]!;
  const catalog = useBuildCatalog({
    kind: category.kind || "noteIcon",
    query,
    classType,
    subclass,
    enabled: Boolean(category.kind),
    allowEmpty: true
  });
  const native = NATIVE_EMOJI.filter(([, keywords]) => !query.trim() || keywords.includes(query.trim().toLocaleLowerCase()));
  const results = catalog.data?.data.results || [];
  return <section className={styles.notesIconPicker} aria-label="Emoji and Destiny icon picker">
    <nav>{CATEGORIES.map((entry) => <button type="button" key={entry.id} data-active={entry.id === categoryId} onClick={() => { setCategoryId(entry.id); setQuery(""); }}>{entry.label}</button>)}</nav>
    <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${category.label.toLocaleLowerCase()}…`} autoFocus /></label>
    <div className={styles.notesIconResults}>
      {!category.kind && native.map(([emoji, keywords]) => <button type="button" key={emoji} title={keywords} aria-label={`Insert ${keywords.split(" ")[0]} emoji`} onClick={() => onEmoji(emoji)}><b>{emoji}</b><span>{keywords.split(" ")[0]}</span></button>)}
      {category.kind && catalog.isLoading && <p>Loading the current Bungie catalog…</p>}
      {category.kind && catalog.error && <p>That catalog category is temporarily unavailable. Choose another category or try again.</p>}
      {category.kind && !catalog.isLoading && !catalog.error && results.map((entry) => <button type="button" key={`${entry.hash}-${entry.name}`} title={`${entry.name} · ${entry.itemType}`} onClick={() => onIcon(namedEntryFromCatalog(entry))}>
        <img src={entry.icon} alt="" loading="lazy" /><span>{entry.name}</span>
      </button>)}
      {category.kind && !catalog.isLoading && !catalog.error && !results.length && <p>No current Bungie definition matches this search.</p>}
    </div>
  </section>;
}
