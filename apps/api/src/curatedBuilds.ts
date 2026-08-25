import type { BuildLink, BuildNamedEntry, GuardianBuild } from "@guardian-nexus/contracts";
import { BUILD_ADVISOR_CURATED_VERIFICATION, BUILD_ADVISOR_LIBRARY_TEMPLATES, type BuildAdvisorTemplate, type BuildAdvisorWeaponRequirement } from "./buildAdvisorTemplates";

const AUTHOR = "Guardian Nexus research desk";
const AUTHOR_ID = "guardian-nexus-curated";

export function curatedBuilds(): GuardianBuild[] {
  return BUILD_ADVISOR_LIBRARY_TEMPLATES.filter((template) => template.enabled).map(curatedBuildFromTemplate);
}

export function curatedBuildByIdentifier(identifier: string): GuardianBuild | undefined {
  return curatedBuilds().find((build) => build.id === identifier || build.slug === identifier);
}

function curatedBuildFromTemplate(template: BuildAdvisorTemplate): GuardianBuild {
  const reviewedAt = `${template.reviewedAt}T12:00:00.000Z`;
  const verification = template.verification?.sources || BUILD_ADVISOR_CURATED_VERIFICATION.sources;
  const sourceLinks = verification.map((source): BuildLink => ({
    kind: source.url.includes("mobalytics.gg") ? "mobalytics" : "source",
    label: source.label,
    url: source.url
  }));
  const armorSets = (template.recommendedArmorSets || []).map((name) => ({ name, setName: name, requiredPieces: 2 }));
  const notes = [
    `[h1]How this build works[/h1]`,
    template.summary,
    `[h2]Strengths[/h2]`,
    ...template.strengths.map((entry) => `• ${entry}`),
    `[h2]Limitations[/h2]`,
    ...template.weaknesses.map((entry) => `• ${entry}`),
    `[h2]Damage rotation[/h2]`,
    ...template.damageRotation.map((entry, index) => `${index + 1}. ${entry}`),
    `[h2]Gear and acquisition priorities[/h2]`,
    ...template.upgrades.map((entry) => `• ${entry}`),
    `Open this build in Build Advisor to check every requirement against your account, find owned alternatives, and get item-specific acquisition routes.`
  ].join("\n");
  return {
    id: `curated-${template.id}`,
    slug: `field-guide-${template.id}`,
    authorMembershipId: AUTHOR_ID,
    authorDisplayName: AUTHOR,
    originalCreatorName: template.source?.authorDisplayName,
    rating: { upvotes: 0, downvotes: 0, total: 0, score: 0 },
    canEdit: false,
    canVote: false,
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    publishedAt: reviewedAt,
    title: template.name,
    classType: template.classType,
    subclass: template.subclass,
    tags: unique([template.role.length <= 40 ? template.role : `${template.subclass} ${template.damageProfile} damage`, "Reviewed field guide"]),
    activityTags: template.activities,
    summary: template.summary,
    notes,
    concepts: [
      ...template.strengths.map((name) => ({ name, itemType: "Strength" })),
      ...template.weaknesses.map((name) => ({ name, itemType: "Limitation" }))
    ],
    championCounters: [],
    links: uniqueLinks(sourceLinks),
    subclassConfig: {
      super: named(template.abilities.super),
      classAbility: named(template.abilities.classAbility),
      movement: named(template.abilities.movement),
      melee: named(template.abilities.melee),
      grenade: named(template.abilities.grenade),
      aspects: template.abilities.aspects.map(named),
      fragments: template.abilities.fragments.map(named)
    },
    equipment: {
      weapons: template.weapons.map(weaponEntry),
      armor: [{ name: template.requiredExoticArmor, slot: armorSlot(template.requiredExoticArmor), exotic: true, required: true }],
      armorSets
    },
    statPriorities: template.statPriorities,
    ghostFocus: {
      mod: named(`${template.ghostFocus.archetype} Armorer`),
      primaryStat: template.ghostFocus.primaryStat,
      secondaryStat: template.ghostFocus.secondaryStat,
      notes: template.ghostFocus.notes
    },
    armorMods: {
      helmet: (template.armorMods.helmet || []).map(named),
      arms: (template.armorMods.arms || []).map(named),
      chest: (template.armorMods.chest || []).map(named),
      legs: (template.armorMods.legs || []).map(named),
      classItem: (template.armorMods.classItem || []).map(named)
    },
    artifacts: template.artifactPerks.length ? [{ name: "Monument of Triumph artifacts", perks: template.artifactPerks.map((name) => ({ name, required: template.artifactDependency === "high" })) }] : [],
    gameplayLoop: template.gameplayLoop.map((text) => ({ text })),
    cosmetics: { ornaments: [] },
    patch: template.release,
    outdated: false,
    changelog: [{ version: `Template v${template.version}`, notes: template.sourceNotes, date: reviewedAt }],
    status: "published",
    visibility: "public"
  };
}

function weaponEntry(requirement: BuildAdvisorWeaponRequirement) {
  const name = requirement.preferredNames?.[0] || requirement.label;
  const selectedPerks = unique([...(requirement.requiredPerks || []), ...(requirement.preferredPerks || [])]).map(named);
  const alternatives = unique(requirement.acceptablePerks || []);
  const perkSummary = [
    requirement.requiredPerks?.length ? `Required: ${requirement.requiredPerks.join(", ")}` : "",
    requirement.preferredPerks?.length ? `Preferred: ${requirement.preferredPerks.join(", ")}` : "",
    alternatives.length ? `Alternatives: ${alternatives.join(", ")}` : ""
  ].filter(Boolean).join(" · ");
  return {
    name,
    slot: requirement.slots?.[0] || requirement.label,
    itemType: requirement.archetypes?.join(" / "),
    damageType: requirement.damageTypes?.join(" / "),
    selectedPerks,
    perks: perkSummary || undefined,
    exotic: Boolean(requirement.requiresExotic),
    required: Boolean(requirement.requiresExotic || requirement.requiredPerks?.length)
  };
}

function armorSlot(name: string): string {
  if (/boot|leg|st0mp|orpheus|speedloader|dance machine/i.test(name)) return "Leg Armor";
  if (/gauntlet|handshake|grasp|brace|synthoceps|renewal|ahamkara|nothing manacles/i.test(name)) return "Gauntlets";
  if (/hauberk|heart|protocol|harmony|raiment|coyote|armamentarium|alchemy/i.test(name)) return "Chest Armor";
  return "Helmet";
}

function named(name: string): BuildNamedEntry { return { name }; }
function unique(values: string[]): string[] { return [...new Set(values.filter(Boolean))]; }
function uniqueLinks(links: BuildLink[]): BuildLink[] { return [...new Map(links.map((link) => [link.url, link])).values()]; }
