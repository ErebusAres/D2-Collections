import type { BuildDocument } from "@guardian-nexus/contracts";

export type BuildSectionState = "complete" | "optional" | "needs-attention";
export interface BuildCompletionSection { id: string; label: string; state: BuildSectionState; errors: string[] }

export function buildCompletion(document: BuildDocument): BuildCompletionSection[] {
  const basics = [
    ...(!document.title.trim() || document.title.trim().length < 3 ? ["Add a title with at least three characters."] : []),
    ...(!document.tags.length ? ["Add at least one tag."] : [])
  ];
  const hasSubclass = Boolean(document.subclassConfig.super || document.subclassConfig.aspects.length || document.subclassConfig.fragments.length);
  const hasEquipment = Boolean(document.equipment.weapons.length || document.equipment.armor.length || document.equipment.armorSets.length);
  const hasArtifact = Boolean(document.artifacts.length || document.championCounters.length);
  const hasGameplay = Boolean(document.gameplayLoop.length || document.notes.trim());
  return [
    section("basics", "Basics", basics.length ? "needs-attention" : "complete", basics),
    section("subclass", "Subclass", hasSubclass ? "complete" : "optional"),
    section("equipment", "Equipment", hasEquipment ? "complete" : "optional"),
    section("stats", "Stats & mods", document.statPriorities.length ? "complete" : "optional"),
    section("artifact", "Artifact", hasArtifact ? "complete" : "optional"),
    section("gameplay", "Gameplay", hasGameplay ? "complete" : "optional"),
    section("review", "Review", basics.length ? "needs-attention" : "complete", basics)
  ];
}

function section(id: string, label: string, state: BuildSectionState, errors: string[] = []): BuildCompletionSection { return { id, label, state, errors }; }
