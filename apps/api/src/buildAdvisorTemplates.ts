import type {
  BuildAdvisorArtifactDependency,
  BuildAdvisorRecommendationSource,
  BuildAdvisorVerification,
  BuildGuardianClass,
  BuildNamedEntry,
  BuildStatName,
  BuildSubclass
} from "@guardian-nexus/contracts";

export interface BuildAdvisorWeaponRequirement {
  id: string;
  label: string;
  slots?: string[];
  archetypes?: string[];
  damageTypes?: string[];
  preferredNames?: string[];
  requiresExotic?: boolean;
  requiredPerks?: string[];
  preferredPerks?: string[];
  acceptablePerks?: string[];
}

export interface BuildAdvisorTemplate {
  id: string;
  version: number;
  reviewedAt: string;
  release: string;
  sourceNotes: string;
  source?: BuildAdvisorRecommendationSource;
  verification?: BuildAdvisorVerification;
  enabled: boolean;
  name: string;
  classType: BuildGuardianClass;
  subclass: BuildSubclass;
  summary: string;
  requiredExoticArmor: string;
  preferredExoticWeapon?: string;
  ghostFocus: {
    archetype: string;
    primaryStat: BuildStatName;
    secondaryStat: BuildStatName;
    notes: string;
  };
  weapons: BuildAdvisorWeaponRequirement[];
  abilities: {
    super: string;
    classAbility: string;
    movement: string;
    melee: string;
    grenade: string;
    aspects: string[];
    fragments: string[];
  };
  recommendedArmorSets?: string[];
  armorMods: Partial<Record<"helmet" | "arms" | "chest" | "legs" | "classItem", string[]>>;
  statPriorities: Array<{ stat: BuildStatName; priority: number; target?: number; notes?: string }>;
  artifactPerks: string[];
  artifactDependency: BuildAdvisorArtifactDependency;
  gameplayLoop: string[];
  damageRotation: string[];
  activities: string[];
  strengths: string[];
  weaknesses: string[];
  style: string;
  role: string;
  damageProfile: "high" | "medium" | "low";
  bossDamage: "high" | "medium" | "low";
  addClear: "high" | "medium" | "low";
  survivability: "high" | "medium" | "low";
  abilityUptime: "high" | "medium" | "low";
  complexity: "high" | "medium" | "low";
  solo: "high" | "medium" | "low";
  group: "high" | "medium" | "low";
  powerFriendly: boolean;
  difficultExecution: boolean;
  teammateDependency: "none" | "low" | "medium" | "high";
  upgrades: string[];
}

export const BUILD_ADVISOR_TEMPLATE_SET_VERSION = 8;
export const BUILD_ADVISOR_TEMPLATE_REVIEWED_AT = "2026-08-24";
export const BUILD_ADVISOR_CURRENT_SANDBOX = "Monument of Triumph · Update 9.7.0";
export const BUILD_ADVISOR_CURRENT_SANDBOX_RELEASED_AT = "2026-06-09";
export const BUILD_ADVISOR_CURATED_VERIFICATION: BuildAdvisorVerification = {
  state: "verified-current",
  sandbox: BUILD_ADVISOR_CURRENT_SANDBOX,
  verifiedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT,
  sources: [
    { label: "Bungie Update 9.7.0", url: "https://www.bungie.net/7/en/News/Article/destiny_update_9_7_0" },
    { label: "Bungie build-crafting guide", url: "https://help.bungie.net/hc/en-us/articles/47117806971796--12-Creating-a-Good-Build" }
  ]
};

const sharedMods = {
  helmet: ["Harmonic Siphon", "Heavy Ammo Finder", "Heavy Ammo Scout"],
  chest: ["Concussive Dampener", "Harmonic Resistance", "Melee Damage Resistance"],
  legs: ["Recuperation", "Innervation", "Invigoration"],
  classItem: ["Reaper", "Powerful Attraction", "Time Dilation"]
} satisfies BuildAdvisorTemplate["armorMods"];

function currentVerification(label: string, url: string): BuildAdvisorVerification {
  return {
    ...BUILD_ADVISOR_CURATED_VERIFICATION,
    sources: [...BUILD_ADVISOR_CURATED_VERIFICATION.sources, { label, url }]
  };
}

function stats(...entries: Array<[BuildStatName, number, string]>): BuildAdvisorTemplate["statPriorities"] {
  return entries.map(([stat, target, notes], index) => ({ stat, priority: index + 1, target, notes }));
}

export const BUILD_ADVISOR_LIBRARY_TEMPLATES: BuildAdvisorTemplate[] = [
  {
    id: "hunter-void-gyrfalcon",
    version: 1,
    reviewedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT,
    release: "Monument of Triumph",
    sourceNotes: "Reviewed Void weapon template. Recheck after Void, Gyrfalcon, or Artifact sandbox changes.",
    enabled: true,
    name: "Invisible Volatile Hunter",
    classType: "hunter",
    subclass: "void",
    summary: "Aggressive invisibility loops turn a Void primary into sustained volatile add clear.",
    requiredExoticArmor: "Gyrfalcon's Hauberk",
    preferredExoticWeapon: "Graviton Lance",
    ghostFocus: { archetype: "Reaver", primaryStat: "Class", secondaryStat: "Melee", notes: "Use a Reaver Armorer Ghost mod to favor Class-first drops; the secondary Melee bias is still useful for weaken and invisibility setup." },
    weapons: [
      { id: "exotic-primary", label: "Key exotic weapon", slots: ["Energy Weapons"], preferredNames: ["Graviton Lance"], requiresExotic: true },
      { id: "kinetic-special", label: "Kinetic-slot special", slots: ["Kinetic Weapons"], archetypes: ["Fusion Rifle", "Shotgun", "Sniper Rifle", "Grenade Launcher"], preferredPerks: ["Chill Clip", "Recombination", "Controlled Burst", "Vorpal Weapon"], acceptablePerks: ["Auto-Loading Holster", "Lead from Gold"] },
      { id: "damage-heavy", label: "Boss-capable heavy", slots: ["Power Weapons"], archetypes: ["Rocket Launcher", "Grenade Launcher", "Linear Fusion Rifle", "Machine Gun"], preferredPerks: ["Bait and Switch", "Explosive Light", "Envious Arsenal"], acceptablePerks: ["Vorpal Weapon", "Firing Line", "Frenzy"] }
    ],
    abilities: { super: "Shadowshot: Deadfall", classAbility: "Gambler's Dodge", movement: "Triple Jump", melee: "Snare Bomb", grenade: "Vortex Grenade", aspects: ["Vanishing Step", "Stylish Executioner"], fragments: ["Echo of Starvation", "Echo of Persistence", "Echo of Cessation", "Echo of Obscurity"] },
    armorMods: { ...sharedMods, arms: ["Firepower", "Bolstering Detonation", "Focusing Strike"], legs: ["Recuperation", "Void Weapon Surge", "Innervation"] },
    statPriorities: stats(
      ["Class", 100, "Dodge starts the invisibility loop."],
      ["Health", 100, "Keeps aggressive invisibility breaks survivable."],
      ["Weapons", 100, "Improves the Void-primary side of the build."],
      ["Grenade", 70, "Supports Vortex weaken and area control."],
      ["Melee", 50, "Refreshes Snare Bomb setup."],
      ["Super", 30, "Orbs and encounter pacing cover Deadfall uptime."]
    ),
    artifactPerks: [],
    artifactDependency: "none",
    gameplayLoop: ["Dodge to enter invisibility.", "Break invisibility with a Void weapon to activate Volatile Rounds.", "Use volatile defeats and Stylish Executioner to re-enter invisibility.", "Refresh Devour with Orbs and keep moving between targets."],
    damageRotation: ["Apply weaken with Snare Bomb or Vortex Grenade.", "Use the strongest owned heavy weapon for the damage window.", "Return to the Void primary to rebuild invisibility and Devour between windows."],
    activities: ["General PvE", "Solo activities", "Nightfalls", "Power progression"],
    strengths: ["Excellent add clear", "Frequent invisibility", "Self-sufficient healing", "Low Artifact dependence"],
    weaknesses: ["Boss damage depends on the owned heavy roll", "Requires deliberate invisibility timing"],
    style: "Mobile, weapon-led aggression with frequent invisibility resets.",
    role: "Add clear and survivable general PvE",
    damageProfile: "medium", bossDamage: "medium", addClear: "high", survivability: "high", abilityUptime: "high", complexity: "medium", solo: "high", group: "high", powerFriendly: true, difficultExecution: false, teammateDependency: "none",
    upgrades: ["A strong Void primary with Repulsor Brace or Destabilizing Rounds", "A heavy weapon with a current damage-and-reload perk pairing"]
  },
  {
    id: "hunter-arc-liars",
    version: 1,
    reviewedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT,
    release: "Monument of Triumph",
    sourceNotes: "Reviewed Arc melee template. Recheck Combination Blow and Liar's Handshake tuning after sandbox patches.",
    enabled: true,
    name: "Cross Counter Hunter",
    classType: "hunter",
    subclass: "arc",
    summary: "A close-range dodge and Combination Blow loop built around Liar's Handshake.",
    requiredExoticArmor: "Liar's Handshake",
    preferredExoticWeapon: "Tractor Cannon",
    ghostFocus: { archetype: "Reaver", primaryStat: "Class", secondaryStat: "Melee", notes: "Use Reaver Armorer so new drops directly support the dodge-and-melee loop." },
    weapons: [
      { id: "melee-special", label: "One-Two Punch special", slots: ["Kinetic Weapons"], archetypes: ["Shotgun"], requiredPerks: ["One-Two Punch"], acceptablePerks: ["Trench Barrel", "Pugilist"] },
      { id: "arc-primary", label: "Arc primary", slots: ["Energy Weapons"], damageTypes: ["Arc"], archetypes: ["Auto Rifle", "Pulse Rifle", "Submachine Gun", "Hand Cannon", "Sidearm"], preferredPerks: ["Voltshot"], acceptablePerks: ["Frenzy", "Pugilist", "One for All"] },
      { id: "exotic-heavy", label: "Key exotic weapon", slots: ["Power Weapons"], preferredNames: ["Tractor Cannon"], requiresExotic: true }
    ],
    abilities: { super: "Gathering Storm", classAbility: "Gambler's Dodge", movement: "Triple Jump", melee: "Combination Blow", grenade: "Pulse Grenade", aspects: ["Flow State", "Lethal Current"], fragments: ["Spark of Resistance", "Spark of Feedback", "Spark of Ions", "Spark of Amplitude"] },
    armorMods: { ...sharedMods, arms: ["Heavy Handed", "Impact Induction", "Focusing Strike"], legs: ["Recuperation", "Arc Weapon Surge", "Invigoration"] },
    statPriorities: stats(
      ["Class", 100, "Dodge restores Combination Blow."],
      ["Melee", 100, "Directly supports the core damage loop."],
      ["Health", 100, "Adds safety at melee range."],
      ["Weapons", 70, "Improves shotgun and Arc-primary follow-up."],
      ["Grenade", 50, "Pulse Grenade controls targets outside melee reach."],
      ["Super", 30, "Gathering Storm is reserved for priority targets."]
    ),
    artifactPerks: [],
    artifactDependency: "none",
    gameplayLoop: ["Dodge near an enemy to restore Combination Blow.", "Melee to build Combination Blow and trigger the Lethal Current loop.", "Use a One-Two Punch shotgun before tougher melee targets.", "Create and collect Orbs to sustain healing while moving forward."],
    damageRotation: ["Build Combination Blow before a major target.", "Fire a One-Two Punch shotgun burst, then immediately melee.", "Use Gathering Storm and the strongest owned heavy when close-range uptime is unsafe."],
    activities: ["General PvE", "Solo activities", "Dungeons", "Power progression"],
    strengths: ["Fast room-to-room tempo", "Strong close-range sustain", "Low teammate dependence"],
    weaknesses: ["Risky in content that punishes melee range", "Loses damage when Combination Blow falls off"],
    style: "Fast, close-range, dodge-driven aggression.",
    role: "Mobile melee clear and solo sustain",
    damageProfile: "high", bossDamage: "medium", addClear: "high", survivability: "high", abilityUptime: "high", complexity: "medium", solo: "high", group: "medium", powerFriendly: true, difficultExecution: true, teammateDependency: "none",
    upgrades: ["A One-Two Punch shotgun", "A high-damage heavy for encounters where melee uptime is unsafe"]
  },
  {
    id: "hunter-solar-nighthawk",
    version: 1,
    reviewedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT,
    release: "Monument of Triumph",
    sourceNotes: "Curated precision damage template. Recheck Golden Gun and Celestial Nighthawk tuning after sandbox patches.",
    enabled: true,
    name: "Celestial Precision Hunter",
    classType: "hunter",
    subclass: "solar",
    summary: "Precision Golden Gun burst backed by a Solar primary and a sustained-damage heavy.",
    requiredExoticArmor: "Celestial Nighthawk",
    preferredExoticWeapon: "Still Hunt",
    ghostFocus: { archetype: "Powerhouse", primaryStat: "Weapons", secondaryStat: "Super", notes: "Use Powerhouse Armorer to bias drops toward the two stats that drive the precision damage rotation." },
    weapons: [
      { id: "kinetic-primary", label: "Kinetic-slot primary", slots: ["Kinetic Weapons"], archetypes: ["Hand Cannon", "Pulse Rifle", "Auto Rifle", "Submachine Gun", "Scout Rifle", "Sidearm"], preferredPerks: ["Kinetic Tremors"], acceptablePerks: ["Frenzy", "One for All", "Explosive Payload"] },
      { id: "exotic-special", label: "Key exotic weapon", slots: ["Energy Weapons"], preferredNames: ["Still Hunt"], requiresExotic: true },
      { id: "solar-heavy", label: "Solar boss heavy", slots: ["Power Weapons"], damageTypes: ["Solar"], archetypes: ["Rocket Launcher", "Grenade Launcher", "Linear Fusion Rifle"], preferredPerks: ["Bait and Switch", "Explosive Light", "Envious Arsenal"], acceptablePerks: ["Vorpal Weapon", "Firing Line", "Frenzy"] }
    ],
    abilities: { super: "Golden Gun: Marksman", classAbility: "Gambler's Dodge", movement: "Triple Jump", melee: "Knife Trick", grenade: "Healing Grenade", aspects: ["Knock 'Em Down", "On Your Mark"], fragments: ["Ember of Torches", "Ember of Solace", "Ember of Empyrean", "Ember of Searing"] },
    armorMods: { ...sharedMods, arms: ["Focusing Strike", "Heavy Handed", "Impact Induction"], legs: ["Recuperation", "Solar Weapon Surge", "Innervation"] },
    statPriorities: stats(
      ["Weapons", 100, "Supports Still Hunt and the heavy damage phase."],
      ["Super", 100, "Improves access to Celestial Golden Gun."],
      ["Health", 100, "Keeps precision setup safe under pressure."],
      ["Class", 70, "Gambler's Dodge refreshes Knife Trick."],
      ["Grenade", 50, "Restores Healing Grenade more often."],
      ["Melee", 30, "Knife Trick is useful but not the damage engine."]
    ),
    artifactPerks: [],
    artifactDependency: "none",
    gameplayLoop: ["Use the Solar primary to clear enemies and extend Restoration or Radiant effects.", "Use Healing Grenade before dangerous pushes.", "Create Orbs consistently so Golden Gun is ready for priority targets.", "Keep precision weapon damage active between Super windows."],
    damageRotation: ["Become Radiant before the damage window.", "Land the Celestial Golden Gun precision shot.", "Swap into the strongest owned heavy damage rotation.", "Use the Solar primary to rebuild buffs and Super energy."],
    activities: ["Boss encounters", "Dungeons", "Raids", "General PvE"],
    strengths: ["Excellent burst damage", "Simple damage rotation", "Strong at range"],
    weaknesses: ["Missing the Golden Gun precision shot is costly", "Add clear depends on the selected Solar weapon"],
    style: "Precision-focused weapon play with a decisive burst Super.",
    role: "Boss burst and general Solar weapon damage",
    damageProfile: "high", bossDamage: "high", addClear: "medium", survivability: "medium", abilityUptime: "medium", complexity: "low", solo: "medium", group: "high", powerFriendly: false, difficultExecution: true, teammateDependency: "low",
    upgrades: ["A Solar primary with Incandescent", "A current heavy damage roll with both a reload and damage perk"]
  },
  {
    id: "hunter-prismatic-liars",
    version: 1,
    reviewedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT,
    release: "Monument of Triumph",
    sourceNotes: "Curated Prismatic melee template. Recheck Liar's Handshake, Combination Blow, and Prismatic fragment tuning after sandbox patches.",
    enabled: true,
    name: "Prismatic Cross Counter Hunter",
    classType: "hunter",
    subclass: "prismatic",
    summary: "Prismatic crowd control and invisibility support a fast Combination Blow and Cross Counter loop.",
    requiredExoticArmor: "Liar's Handshake",
    preferredExoticWeapon: "Conditional Finality",
    ghostFocus: { archetype: "Reaver", primaryStat: "Class", secondaryStat: "Melee", notes: "Use Reaver Armorer to favor the dodge and melee stats that keep the loop moving." },
    weapons: [
      { id: "exotic-special", label: "Key exotic weapon", slots: ["Kinetic Weapons"], preferredNames: ["Conditional Finality"], requiresExotic: true },
      { id: "arc-primary", label: "Arc primary", slots: ["Energy Weapons"], damageTypes: ["Arc"], archetypes: ["Auto Rifle", "Pulse Rifle", "Submachine Gun", "Hand Cannon", "Sidearm"], preferredPerks: ["Voltshot"], acceptablePerks: ["Frenzy", "Pugilist", "One for All"] },
      { id: "stasis-heavy", label: "Stasis heavy", slots: ["Power Weapons"], damageTypes: ["Stasis"], archetypes: ["Grenade Launcher", "Rocket Launcher", "Machine Gun"], preferredPerks: ["Bait and Switch", "Explosive Light", "Envious Arsenal"], acceptablePerks: ["Frenzy", "Vorpal Weapon"] }
    ],
    abilities: { super: "Silence and Squall", classAbility: "Gambler's Dodge", movement: "Triple Jump", melee: "Combination Blow", grenade: "Duskfield Grenade", aspects: ["Stylish Executioner", "Winter's Shroud"], fragments: ["Facet of Protection", "Facet of Purpose", "Facet of Dawn", "Facet of Ruin", "Facet of Courage"] },
    armorMods: { ...sharedMods, arms: ["Heavy Handed", "Impact Induction", "Focusing Strike"], legs: ["Recuperation", "Arc Weapon Surge", "Invigoration"] },
    statPriorities: stats(
      ["Class", 100, "Dodge restores Combination Blow and applies slow."],
      ["Melee", 100, "Combination Blow and Cross Counter are the damage engine."],
      ["Health", 100, "Adds safety while fighting at point-blank range."],
      ["Weapons", 70, "Supports Conditional Finality and Voltshot cleanup."],
      ["Grenade", 50, "Duskfield supplies control and Light/Dark energy."],
      ["Super", 30, "Silence and Squall is used for control or damage setup."]
    ),
    artifactPerks: [],
    artifactDependency: "none",
    gameplayLoop: ["Dodge near enemies to slow them and restore Combination Blow.", "Use melee defeats to build Combination Blow and trigger Stylish Executioner.", "Use Conditional Finality or Duskfield Grenade when a target needs hard control.", "Alternate Light and Dark damage to enter Transcendence, then keep the melee loop moving."],
    damageRotation: ["Build Combination Blow before the priority target.", "Freeze or ignite with Conditional Finality, then trigger Cross Counter with melee.", "Use the Stasis heavy and Silence and Squall when remaining in melee range is unsafe."],
    activities: ["General PvE", "Solo activities", "Dungeons", "Power progression"],
    strengths: ["High mobility", "Frequent invisibility", "Strong close-range control", "Self-contained loop"],
    weaknesses: ["Requires close-range execution", "Loses momentum when Combination Blow expires"],
    style: "Fast, weapon-assisted melee aggression with Prismatic control.",
    role: "Mobile melee clear and crowd control",
    damageProfile: "high", bossDamage: "medium", addClear: "high", survivability: "high", abilityUptime: "high", complexity: "high", solo: "high", group: "medium", powerFriendly: true, difficultExecution: true, teammateDependency: "none",
    upgrades: ["Conditional Finality for reliable freeze and ignition setup", "A Stasis heavy with a current reload-and-damage perk pairing"]
  },
  {
    id: "hunter-stasis-renewal",
    version: 1,
    reviewedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT,
    release: "Monument of Triumph",
    sourceNotes: "Curated Stasis control template. Recheck Renewal Grasps, Duskfield Grenade, and Ager's Scepter tuning after sandbox patches.",
    enabled: true,
    name: "Renewal Field Hunter",
    classType: "hunter",
    subclass: "stasis",
    summary: "Large Duskfield Grenades lock down a lane while Ager's Scepter and Stasis heavy damage capitalize on frozen targets.",
    requiredExoticArmor: "Renewal Grasps",
    preferredExoticWeapon: "Ager's Scepter",
    ghostFocus: { archetype: "Demolitionist", primaryStat: "Grenade", secondaryStat: "Class", notes: "Use Demolitionist Armorer to favor Duskfield uptime while retaining useful dodge investment." },
    weapons: [
      { id: "exotic-special", label: "Key exotic weapon", slots: ["Kinetic Weapons"], preferredNames: ["Ager's Scepter"], requiresExotic: true },
      { id: "energy-primary", label: "Energy primary", slots: ["Energy Weapons"], archetypes: ["Auto Rifle", "Pulse Rifle", "Submachine Gun", "Hand Cannon", "Scout Rifle", "Sidearm"], preferredPerks: ["Demolitionist", "Attrition Orbs"], acceptablePerks: ["Frenzy", "One for All", "Explosive Payload"] },
      { id: "stasis-heavy", label: "Stasis heavy", slots: ["Power Weapons"], damageTypes: ["Stasis"], archetypes: ["Grenade Launcher", "Rocket Launcher", "Machine Gun"], preferredPerks: ["Bait and Switch", "Explosive Light", "Envious Arsenal"], acceptablePerks: ["Frenzy", "Vorpal Weapon"] }
    ],
    abilities: { super: "Silence and Squall", classAbility: "Gambler's Dodge", movement: "Triple Jump", melee: "Withering Blade", grenade: "Duskfield Grenade", aspects: ["Touch of Winter", "Grim Harvest"], fragments: ["Whisper of Durance", "Whisper of Shards", "Whisper of Chains", "Whisper of Conduction"] },
    armorMods: { ...sharedMods, arms: ["Firepower", "Bolstering Detonation", "Momentum Transfer"], legs: ["Recuperation", "Stasis Weapon Surge", "Innervation"] },
    statPriorities: stats(
      ["Grenade", 100, "Duskfield Grenade is the control engine."],
      ["Health", 100, "Supports safe play inside contested lanes."],
      ["Weapons", 100, "Improves Ager's and Stasis-heavy follow-up."],
      ["Class", 70, "Gambler's Dodge refreshes Withering Blade."],
      ["Super", 50, "Silence and Squall supports Ager's alternate fire decisions."],
      ["Melee", 30, "Withering Blade extends slow but is not the primary engine."]
    ),
    artifactPerks: [],
    artifactDependency: "none",
    gameplayLoop: ["Place an enhanced Duskfield where enemies must cross.", "Use Ager's Scepter to freeze and shatter targets held in the field.", "Collect Stasis shards and Orbs while rotating to the next lane.", "Use Withering Blade to extend slow when the grenade is unavailable."],
    damageRotation: ["Freeze the priority target with Duskfield or Ager's Scepter.", "Shatter and swap to the Stasis heavy for sustained damage.", "Use Silence and Squall for a long control window; use Ager's alternate fire only when spending Super energy is worthwhile."],
    activities: ["Nightfalls", "General PvE", "Solo activities", "Power progression"],
    strengths: ["Excellent crowd control", "Safe ranged loop", "Low teammate dependence"],
    weaknesses: ["Lower immediate boss burst", "Requires deliberate grenade placement"],
    style: "Controlled forward pressure built around freeze and shatter.",
    role: "Crowd control and safe weapon damage",
    damageProfile: "medium", bossDamage: "medium", addClear: "high", survivability: "high", abilityUptime: "high", complexity: "medium", solo: "high", group: "high", powerFriendly: true, difficultExecution: false, teammateDependency: "none",
    upgrades: ["Ager's Scepter for reliable freeze chains", "A Stasis heavy with a current reload-and-damage pairing"]
  },
  {
    id: "hunter-strand-cyrtarachne",
    version: 1,
    reviewedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT,
    release: "Monument of Triumph",
    sourceNotes: "Curated Strand mobility template. Recheck Cyrtarachne's Facade, Grapple, and Final Warning tuning after sandbox patches.",
    enabled: true,
    name: "Woven Grapple Hunter",
    classType: "hunter",
    subclass: "strand",
    summary: "Grapple movement, Woven Mail, and Final Warning keep an aggressive Strand Hunter mobile and protected.",
    requiredExoticArmor: "Cyrtarachne's Facade",
    preferredExoticWeapon: "Final Warning",
    ghostFocus: { archetype: "Gunner", primaryStat: "Weapons", secondaryStat: "Grenade", notes: "Use Gunner Armorer to support Final Warning damage and the Grapple charge that activates Woven Mail." },
    weapons: [
      { id: "exotic-primary", label: "Key exotic weapon", slots: ["Kinetic Weapons"], preferredNames: ["Final Warning"], requiresExotic: true },
      { id: "energy-special", label: "Energy special", slots: ["Energy Weapons"], archetypes: ["Shotgun", "Fusion Rifle", "Grenade Launcher", "Sniper Rifle", "Glaive"], preferredPerks: ["Lead from Gold", "Controlled Burst", "Chain Reaction"], acceptablePerks: ["Vorpal Weapon", "Auto-Loading Holster", "Frenzy"] },
      { id: "strand-heavy", label: "Strand heavy", slots: ["Power Weapons"], damageTypes: ["Strand"], archetypes: ["Grenade Launcher", "Rocket Launcher", "Machine Gun"], preferredPerks: ["Bait and Switch", "Explosive Light", "Envious Arsenal"], acceptablePerks: ["Frenzy", "Vorpal Weapon"] }
    ],
    abilities: { super: "Silkstrike", classAbility: "Gambler's Dodge", movement: "Triple Jump", melee: "Threaded Spike", grenade: "Grapple", aspects: ["Widow's Silk", "Ensnaring Slam"], fragments: ["Thread of Warding", "Thread of Generation", "Thread of Mind", "Thread of Continuity"] },
    armorMods: { ...sharedMods, arms: ["Firepower", "Focusing Strike", "Momentum Transfer"], legs: ["Recuperation", "Strand Weapon Surge", "Innervation"] },
    statPriorities: stats(
      ["Weapons", 100, "Final Warning and the heavy weapon carry sustained damage."],
      ["Grenade", 100, "Grapple activates the exotic and controls movement."],
      ["Health", 100, "Backs up Woven Mail during aggressive pushes."],
      ["Class", 70, "Gambler's Dodge and Ensnaring Slam control close targets."],
      ["Melee", 50, "Threaded Spike spreads sever and supports follow-up."],
      ["Super", 30, "Silkstrike is reserved for dense groups or safe damage."]
    ),
    artifactPerks: [],
    artifactDependency: "none",
    gameplayLoop: ["Grapple to enter a fight and activate Woven Mail.", "Use Final Warning lock-on bursts while moving between cover.", "Suspend dangerous groups with Ensnaring Slam, then recover dodge through Thread of Mind.", "Catch Threaded Spike on return and use Orbs to refresh Woven Mail."],
    damageRotation: ["Apply sever or suspend before committing.", "Use a full Final Warning lock-on burst, then swap to the Strand heavy.", "Use Silkstrike when movement and melee access are safe."],
    activities: ["General PvE", "Solo activities", "Power progression", "Dungeons"],
    strengths: ["Excellent mobility", "Reliable Woven Mail", "Strong moving weapon damage"],
    weaknesses: ["Grapple mistakes can expose the Hunter", "Boss damage depends on the owned heavy roll"],
    style: "Mobile, self-protected Strand weapon aggression.",
    role: "Mobile damage and crowd control",
    damageProfile: "high", bossDamage: "medium", addClear: "high", survivability: "high", abilityUptime: "high", complexity: "medium", solo: "high", group: "high", powerFriendly: true, difficultExecution: true, teammateDependency: "none",
    upgrades: ["Final Warning for the intended mobile damage loop", "A Strand heavy with a current reload-and-damage pairing"]
  },
  {
    id: "titan-arc-cuirass",
    version: 1,
    reviewedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT,
    release: "Monument of Triumph",
    sourceNotes: "Curated Arc burst template. Recheck Thundercrash and Cuirass tuning after sandbox patches.",
    enabled: true,
    name: "Thundercrash Vanguard",
    classType: "titan",
    subclass: "arc",
    summary: "Direct Arc ability pressure with a Cuirass-amplified Thundercrash damage window.",
    requiredExoticArmor: "Cuirass of the Falling Star",
    preferredExoticWeapon: "Grand Overture",
    ghostFocus: { archetype: "Colossus", primaryStat: "Super", secondaryStat: "Health", notes: "Use Colossus Armorer to favor Thundercrash uptime without giving up front-line durability." },
    weapons: [
      { id: "kinetic-special", label: "Kinetic-slot special", slots: ["Kinetic Weapons"], archetypes: ["Shotgun", "Fusion Rifle", "Grenade Launcher", "Sniper Rifle"], preferredPerks: ["Recombination", "Chill Clip"], acceptablePerks: ["Lead from Gold", "Vorpal Weapon"] },
      { id: "arc-primary", label: "Arc primary", slots: ["Energy Weapons"], damageTypes: ["Arc"], archetypes: ["Pulse Rifle", "Auto Rifle", "Submachine Gun", "Hand Cannon"], preferredPerks: ["Voltshot"], acceptablePerks: ["Frenzy", "One for All"] },
      { id: "exotic-heavy", label: "Key exotic weapon", slots: ["Power Weapons"], preferredNames: ["Grand Overture"], requiresExotic: true }
    ],
    abilities: { super: "Thundercrash", classAbility: "Thruster", movement: "Strafe Lift", melee: "Thunderclap", grenade: "Pulse Grenade", aspects: ["Knockout", "Touch of Thunder"], fragments: ["Spark of Resistance", "Spark of Shock", "Spark of Ions", "Spark of Magnitude"] },
    armorMods: { ...sharedMods, arms: ["Firepower", "Impact Induction", "Bolstering Detonation"], legs: ["Recuperation", "Arc Weapon Surge", "Innervation"] },
    statPriorities: stats(
      ["Super", 100, "Thundercrash is the defining burst tool."],
      ["Health", 100, "Protects the return from Thundercrash."],
      ["Grenade", 100, "Feeds Touch of Thunder Pulse Grenades."],
      ["Weapons", 70, "Improves the Arc weapon and heavy rotation."],
      ["Class", 50, "Keeps Thruster available for repositioning."],
      ["Melee", 30, "Thunderclap remains situational setup."]
    ),
    artifactPerks: [], artifactDependency: "none",
    gameplayLoop: ["Use Pulse Grenades and Arc weapons to control groups.", "Use Thruster to reposition without stopping weapon pressure.", "Save Thundercrash for a priority target or a safe damage window."],
    damageRotation: ["Apply weapon debuffs or activate damage perks.", "Use Thundercrash when the return path is safe.", "Continue with the strongest owned heavy weapon."],
    activities: ["Boss encounters", "General PvE", "Dungeons"],
    strengths: ["Immediate burst damage", "Straightforward loop", "Good Arc area control"],
    weaknesses: ["Thundercrash can leave the Titan exposed", "Sustained damage depends on the heavy weapon"],
    style: "Direct, aggressive ability and weapon pressure.",
    role: "Burst damage and Arc control",
    damageProfile: "high", bossDamage: "high", addClear: "medium", survivability: "medium", abilityUptime: "medium", complexity: "low", solo: "medium", group: "high", powerFriendly: false, difficultExecution: false, teammateDependency: "low",
    upgrades: ["An Arc primary with Voltshot", "A boss heavy with a current reload-and-damage pairing"]
  },
  {
    id: "titan-strand-synthoceps",
    version: 1,
    reviewedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT,
    release: "Monument of Triumph",
    sourceNotes: "Curated Banner of War template. Recheck Synthoceps and Strand tuning after sandbox patches.",
    enabled: true,
    name: "Banner Brawler Titan",
    classType: "titan",
    subclass: "strand",
    summary: "Synthoceps powers an aggressive Banner of War melee loop with strong self-sustain.",
    requiredExoticArmor: "Synthoceps",
    preferredExoticWeapon: "Tractor Cannon",
    ghostFocus: { archetype: "Skirmisher", primaryStat: "Melee", secondaryStat: "Weapons", notes: "Use Skirmisher Armorer to reinforce both Frenzied Blade and the close-range weapon rotation." },
    weapons: [
      { id: "strand-primary", label: "Strand primary", slots: ["Kinetic Weapons"], damageTypes: ["Strand"], archetypes: ["Auto Rifle", "Pulse Rifle", "Submachine Gun", "Hand Cannon", "Sidearm"], preferredPerks: ["Hatchling", "Slice"], acceptablePerks: ["Frenzy", "Pugilist", "One for All"] },
      { id: "melee-special", label: "One-Two Punch special", slots: ["Energy Weapons"], archetypes: ["Shotgun"], requiredPerks: ["One-Two Punch"], acceptablePerks: ["Trench Barrel", "Pugilist"] },
      { id: "exotic-heavy", label: "Key exotic weapon", slots: ["Power Weapons"], preferredNames: ["Tractor Cannon"], requiresExotic: true }
    ],
    abilities: { super: "Bladefury", classAbility: "Rally Barricade", movement: "Catapult Lift", melee: "Frenzied Blade", grenade: "Grapple", aspects: ["Banner of War", "Into the Fray"], fragments: ["Thread of Warding", "Thread of Fury", "Thread of Generation", "Thread of Transmutation"] },
    armorMods: { ...sharedMods, arms: ["Heavy Handed", "Impact Induction", "Focusing Strike"], legs: ["Recuperation", "Strand Weapon Surge", "Invigoration"] },
    statPriorities: stats(
      ["Melee", 100, "Frenzied Blade starts and maintains Banner."],
      ["Health", 100, "Adds durability while fighting at close range."],
      ["Weapons", 100, "Supports shotgun and Strand-primary pressure."],
      ["Class", 70, "Rally Barricade stabilizes exposed damage windows."],
      ["Grenade", 50, "Grapple is primarily movement and initiation."],
      ["Super", 30, "Bladefury is saved for dense or durable targets."]
    ),
    artifactPerks: [], artifactDependency: "none",
    gameplayLoop: ["Start Banner of War with a melee, finisher, or Sword defeat.", "Keep defeating enemies to extend Banner and heal through pressure.", "Use Grapple and Frenzied Blade to move directly between groups."],
    damageRotation: ["Build Banner of War before committing to a durable target.", "Prime a melee-synergy special if owned.", "Use Frenzied Blade, Bladefury, and the strongest close-range heavy when safe."],
    activities: ["General PvE", "Solo activities", "Dungeons", "Power progression"],
    strengths: ["High close-range damage", "Strong self-sustain", "Excellent mobility"],
    weaknesses: ["Punished by encounters that deny close range", "Requires active Banner maintenance"],
    style: "Relentless close-range movement and melee pressure.",
    role: "Melee damage, sustain, and add clear",
    damageProfile: "high", bossDamage: "medium", addClear: "high", survivability: "high", abilityUptime: "high", complexity: "medium", solo: "high", group: "high", powerFriendly: true, difficultExecution: true, teammateDependency: "none",
    upgrades: ["A One-Two Punch shotgun or Close to Melee Glaive", "A Sword or heavy weapon that rewards close-range uptime"]
  },
  {
    id: "warlock-void-contraverse",
    version: 1,
    reviewedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT,
    release: "Monument of Triumph",
    sourceNotes: "Curated Void grenade template. Recheck Contraverse Hold and Chaos Accelerant tuning after sandbox patches.",
    enabled: true,
    name: "Contraverse Breach Warlock",
    classType: "warlock",
    subclass: "void",
    summary: "Charged Vortex Grenades and Devour support an aggressive Void weapon loop.",
    requiredExoticArmor: "Contraverse Hold",
    preferredExoticWeapon: "Graviton Lance",
    ghostFocus: { archetype: "Grenadier", primaryStat: "Grenade", secondaryStat: "Super", notes: "Use Grenadier Armorer to favor Vortex Grenade uptime; Super is the useful paired bias available on that archetype." },
    weapons: [
      { id: "kinetic-special", label: "Kinetic-slot special", slots: ["Kinetic Weapons"], archetypes: ["Fusion Rifle", "Shotgun", "Sniper Rifle", "Grenade Launcher"], preferredPerks: ["Chill Clip", "Recombination", "Controlled Burst"], acceptablePerks: ["Lead from Gold", "Vorpal Weapon"] },
      { id: "exotic-primary", label: "Key exotic weapon", slots: ["Energy Weapons"], preferredNames: ["Graviton Lance"], requiresExotic: true },
      { id: "damage-heavy", label: "Reliable heavy", slots: ["Power Weapons"], archetypes: ["Rocket Launcher", "Grenade Launcher", "Machine Gun"], preferredPerks: ["Bait and Switch", "Explosive Light"], acceptablePerks: ["Vorpal Weapon", "Frenzy"] }
    ],
    abilities: { super: "Nova Bomb: Cataclysm", classAbility: "Healing Rift", movement: "Burst Glide", melee: "Pocket Singularity", grenade: "Vortex Grenade", aspects: ["Chaos Accelerant", "Feed the Void"], fragments: ["Echo of Remnants", "Echo of Undermining", "Echo of Persistence", "Echo of Harvest"] },
    armorMods: { ...sharedMods, arms: ["Firepower", "Bolstering Detonation", "Momentum Transfer"], legs: ["Recuperation", "Void Weapon Surge", "Innervation"] },
    statPriorities: stats(
      ["Grenade", 100, "Vortex Grenade drives the entire loop."],
      ["Health", 100, "Protects charged-grenade setup and forward play."],
      ["Weapons", 100, "Supports Graviton and heavy follow-up."],
      ["Class", 70, "Keeps Healing Rift available between Devour chains."],
      ["Super", 50, "Nova Bomb provides burst after weaken."],
      ["Melee", 30, "Pocket Singularity is control rather than a damage engine."]
    ),
    artifactPerks: [], artifactDependency: "none",
    gameplayLoop: ["Charge and throw Vortex Grenade into a dense group.", "Use Void weapon defeats to sustain Devour.", "Push forward while Contraverse energy restores the next grenade."],
    damageRotation: ["Apply weaken with Vortex Grenade.", "Use Nova Bomb for burst.", "Continue with the strongest owned heavy while Devour protects the follow-through."],
    activities: ["General PvE", "Solo activities", "Nightfalls", "Power progression"],
    strengths: ["Reliable grenade uptime", "Strong self-healing", "Good area control"],
    weaknesses: ["Grenade placement matters", "Boss damage depends on the owned heavy roll"],
    style: "Forward-moving grenade control backed by Void weapons.",
    role: "Area damage and self-sufficient Void pressure",
    damageProfile: "medium", bossDamage: "medium", addClear: "high", survivability: "high", abilityUptime: "high", complexity: "low", solo: "high", group: "high", powerFriendly: true, difficultExecution: false, teammateDependency: "none",
    upgrades: ["A Void primary with Repulsor Brace or Destabilizing Rounds", "A stronger heavy damage roll"]
  },
  {
    id: "hunter-solar-speedloader",
    version: 1,
    reviewedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT,
    release: BUILD_ADVISOR_CURRENT_SANDBOX,
    sourceNotes: "Current Crackshot Solar Hunter setup reviewed against Update 9.7.0 and a July 2026 Monument of Triumph build guide.",
    verification: {
      ...BUILD_ADVISOR_CURATED_VERIFICATION,
      sources: [
        ...BUILD_ADVISOR_CURATED_VERIFICATION.sources,
        { label: "Current Solar Hunter build guide", url: "https://games.gg/destiny-2/guides/destiny-2-monument-of-triumph-solar-hunter-build-guide/" }
      ]
    },
    enabled: true,
    name: "Crackshot Ignition Hunter",
    classType: "hunter",
    subclass: "solar",
    summary: "Crackshot, class-ability cycling, and Dragon's Breath sustain scorch and ignition pressure.",
    requiredExoticArmor: "Speedloader Slacks",
    preferredExoticWeapon: "Dragon's Breath",
    ghostFocus: { archetype: "Reaver", primaryStat: "Class", secondaryStat: "Melee", notes: "Focus Class first for the Speedloader and On Your Mark loop, then Melee for Knife Trick uptime." },
    weapons: [
      { id: "kinetic-special", label: "Kinetic-slot special", slots: ["Kinetic Weapons"], archetypes: ["Fusion Rifle", "Shotgun", "Sniper Rifle", "Grenade Launcher"], preferredPerks: ["Recombination", "Controlled Burst", "Chill Clip"], acceptablePerks: ["Auto-Loading Holster", "Lead from Gold", "Vorpal Weapon"] },
      { id: "solar-primary", label: "Solar primary", slots: ["Energy Weapons"], damageTypes: ["Solar"], archetypes: ["Auto Rifle", "Pulse Rifle", "Submachine Gun", "Hand Cannon", "Sidearm"], preferredPerks: ["Incandescent", "Heal Clip"], acceptablePerks: ["Frenzy", "One for All", "Demolitionist"] },
      { id: "exotic-heavy", label: "Key exotic weapon", slots: ["Power Weapons"], preferredNames: ["Dragon's Breath"], requiresExotic: true }
    ],
    abilities: { super: "Blade Barrage", classAbility: "Gambler's Dodge", movement: "Triple Jump", melee: "Knife Trick", grenade: "Healing Grenade", aspects: ["Crackshot", "On Your Mark"], fragments: ["Ember of Torches", "Ember of Singeing", "Ember of Char", "Ember of Empyrean", "Ember of Benevolence"] },
    armorMods: {
      helmet: ["Dynamo", "Powerful Friends", "Solar Siphon"],
      arms: ["Heavy Handed", "Focusing Strike", "Melee Font"],
      chest: ["Charged Up", "Sniper Damage Resistance", "Concussive Dampener"],
      legs: ["Insulation", "Better Already", "Stacks on Stacks"],
      classItem: ["Class Font", "Powerful Attraction", "Reaper"]
    },
    statPriorities: stats(
      ["Class", 100, "Drives dodge, Speedloader stacks, and On Your Mark."],
      ["Weapons", 100, "Supports the Solar primary and Dragon's Breath rotation."],
      ["Melee", 100, "Knife Trick applies Radiant and starts scorch chains."],
      ["Health", 70, "Adds safety while extending restoration and radiant effects."],
      ["Grenade", 50, "Healing Grenade is a safety and Ember of Benevolence trigger."],
      ["Super", 30, "Blade Barrage is reserved for burst windows."]
    ),
    artifactPerks: [],
    artifactDependency: "none",
    gameplayLoop: ["Use Knife Trick to become Radiant.", "Dodge to refresh melee and build Speedloader and On Your Mark stacks.", "Use a Solar primary to extend Radiant and Restoration while Crackshot spreads scorch.", "Ignite dense groups and refresh the loop before buffs expire."],
    damageRotation: ["Apply Dragon's Breath to the priority target.", "Cast Blade Barrage after scorch and ignition setup.", "Use the owned Solar primary and special weapon while Dragon's Breath reloads itself."],
    activities: ["General PvE", "Boss encounters", "Dungeons", "Solo activities"],
    strengths: ["High class-ability uptime", "Strong ignition clear", "Reliable healing access", "Sustained damage rotation"],
    weaknesses: ["Requires deliberate buff extension", "Dragon's Breath needs safe damage-over-time pacing"],
    style: "Fast Solar weapon pressure with frequent dodge, scorch, and ignition resets.",
    role: "General PvE, add clear, and sustained boss damage",
    damageProfile: "high", bossDamage: "high", addClear: "high", survivability: "high", abilityUptime: "high", complexity: "medium", solo: "high", group: "high", powerFriendly: true, difficultExecution: false, teammateDependency: "none",
    upgrades: ["Dragon's Breath and its catalyst", "A Solar primary with Incandescent and a reload or healing perk"]
  },
  {
    id: "warlock-arc-stormdancer",
    version: 1,
    reviewedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT,
    release: BUILD_ADVISOR_CURRENT_SANDBOX,
    sourceNotes: "Current Ionic Sentry Arc Warlock setup reviewed against Update 9.7.0 and a July 2026 Monument of Triumph build guide.",
    verification: {
      ...BUILD_ADVISOR_CURATED_VERIFICATION,
      sources: [
        ...BUILD_ADVISOR_CURATED_VERIFICATION.sources,
        { label: "Current Arc Warlock build guide", url: "https://games.gg/destiny-2/guides/destiny-2-monument-of-triumph-arc-warlock-build-guide/" }
      ]
    },
    enabled: true,
    name: "Ionic Sentry Stormcaller",
    classType: "warlock",
    subclass: "arc",
    summary: "Delicate Tomb feeds Ionic Traces into Ionic Sentry and frequent Stormtrance activations.",
    requiredExoticArmor: "Stormdancer's Brace",
    preferredExoticWeapon: "Delicate Tomb",
    ghostFocus: { archetype: "Colossus", primaryStat: "Super", secondaryStat: "Health", notes: "Focus Super for Stormtrance cycling; Health keeps the Warlock safe while Ionic Sentry and Arc chains build momentum." },
    weapons: [
      { id: "kinetic-primary", label: "Kinetic primary", slots: ["Kinetic Weapons"], archetypes: ["Pulse Rifle", "Auto Rifle", "Scout Rifle", "Hand Cannon", "Submachine Gun"], preferredPerks: ["Kinetic Tremors"], acceptablePerks: ["Frenzy", "One for All", "Demolitionist"] },
      { id: "exotic-special", label: "Key exotic weapon", slots: ["Energy Weapons"], preferredNames: ["Delicate Tomb"], requiresExotic: true },
      { id: "linear-heavy", label: "Boss-capable linear fusion", slots: ["Power Weapons"], archetypes: ["Linear Fusion Rifle"], preferredPerks: ["Bait and Switch", "Firing Line", "Precision Instrument"], acceptablePerks: ["Vorpal Weapon", "Frenzy"] }
    ],
    abilities: { super: "Stormtrance", classAbility: "Healing Rift", movement: "Burst Glide", melee: "Chain Lightning", grenade: "Pulse Grenade", aspects: ["Ionic Sentry", "Electrostatic Mind"], fragments: ["Spark of Shock", "Spark of Ions", "Spark of Brilliance", "Spark of Beacons"] },
    armorMods: { ...sharedMods, arms: ["Firepower", "Bolstering Detonation", "Momentum Transfer"], legs: ["Recuperation", "Arc Weapon Surge", "Innervation"] },
    statPriorities: stats(
      ["Super", 100, "Stormdancer's Brace rewards frequent Stormtrance use."],
      ["Grenade", 100, "Pulse Grenade jolts targets and helps create Ionic Traces."],
      ["Health", 100, "Supports aggressive Arc positioning."],
      ["Weapons", 70, "Improves Delicate Tomb and the heavy damage option."],
      ["Class", 50, "Keeps Healing Rift available between trace chains."],
      ["Melee", 30, "Chain Lightning is a supplemental jolt trigger."]
    ),
    artifactPerks: [],
    artifactDependency: "none",
    gameplayLoop: ["Defeat targets with Delicate Tomb to create Ionic Traces.", "Collect traces to charge Ionic Sentry and refresh abilities.", "Jolt and blind grouped enemies with Pulse Grenade and Delicate Tomb.", "Use Stormtrance on dense waves, then rebuild it through Stormdancer's Brace."],
    damageRotation: ["Use Delicate Tomb and abilities to clear adds and charge the Super.", "Cast Stormtrance when a wave can refund meaningful Super energy.", "Use the owned linear fusion rifle on bosses and isolated durable targets."],
    activities: ["General PvE", "Nightfalls", "Onslaught", "Group activities"],
    strengths: ["Excellent add clear", "Frequent Ionic Traces", "Fast Super cycling", "Strong crowd control"],
    weaknesses: ["Boss damage relies on the legendary heavy", "Stormtrance is most valuable when enemies are grouped"],
    style: "Ability-heavy Arc chaining with repeated Sentry and Stormtrance windows.",
    role: "Add clear, crowd control, and general PvE",
    damageProfile: "medium", bossDamage: "medium", addClear: "high", survivability: "medium", abilityUptime: "high", complexity: "medium", solo: "medium", group: "high", powerFriendly: true, difficultExecution: false, teammateDependency: "low",
    upgrades: ["Delicate Tomb and its catalyst", "A linear fusion rifle with a current reload-and-damage perk pairing"]
  },
  {
    id: "titan-void-doom-fang",
    version: 1,
    reviewedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT,
    release: BUILD_ADVISOR_CURRENT_SANDBOX,
    sourceNotes: "Current Sentinel Shield Void Titan setup reviewed against Update 9.7.0 and a July 2026 Monument of Triumph build guide.",
    verification: {
      ...BUILD_ADVISOR_CURATED_VERIFICATION,
      sources: [
        ...BUILD_ADVISOR_CURATED_VERIFICATION.sources,
        { label: "Current Void Titan build guide", url: "https://games.gg/destiny-2/guides/destiny-2-monument-of-triumph-void-titan-build-guide/" }
      ]
    },
    enabled: true,
    name: "Turncoat Sentinel Titan",
    classType: "titan",
    subclass: "void",
    summary: "Turncoat and Doom Fang Pauldron combine Void weapon pressure, overshields, and long Sentinel Shield uptime.",
    requiredExoticArmor: "Doom Fang Pauldron",
    preferredExoticWeapon: "Turncoat",
    ghostFocus: { archetype: "Skirmisher", primaryStat: "Melee", secondaryStat: "Weapons", notes: "Focus Melee for Shield Throw and Doom Fang, then Weapons for Turncoat and the heavy rotation." },
    weapons: [
      { id: "kinetic-special", label: "Kinetic-slot special", slots: ["Kinetic Weapons"], archetypes: ["Fusion Rifle", "Shotgun", "Grenade Launcher", "Sniper Rifle"], preferredPerks: ["Recombination", "Controlled Burst", "Chill Clip"], acceptablePerks: ["Lead from Gold", "Vorpal Weapon"] },
      { id: "exotic-primary", label: "Key exotic weapon", slots: ["Energy Weapons"], preferredNames: ["Turncoat"], requiresExotic: true },
      { id: "damage-heavy", label: "Boss-capable heavy", slots: ["Power Weapons"], archetypes: ["Rocket Launcher", "Grenade Launcher", "Machine Gun"], preferredPerks: ["Bait and Switch", "Explosive Light", "Envious Arsenal"], acceptablePerks: ["Vorpal Weapon", "Frenzy"] }
    ],
    abilities: { super: "Sentinel Shield", classAbility: "Rally Barricade", movement: "Catapult Lift", melee: "Shield Throw", grenade: "Vortex Grenade", aspects: ["Offensive Bulwark", "Controlled Demolition"], fragments: ["Echo of Reprisal", "Echo of Vigilance", "Echo of Persistence", "Echo of Harvest"] },
    armorMods: { ...sharedMods, arms: ["Heavy Handed", "Focusing Strike", "Impact Induction"], legs: ["Recuperation", "Void Weapon Surge", "Invigoration"] },
    statPriorities: stats(
      ["Melee", 100, "Shield Throw starts overshield and Doom Fang loops."],
      ["Super", 100, "Doom Fang extends Sentinel Shield value."],
      ["Health", 100, "Supports front-line overshield play."],
      ["Weapons", 70, "Improves Turncoat and heavy follow-up."],
      ["Class", 50, "Rally Barricade stabilizes weapon windows."],
      ["Grenade", 30, "Vortex Grenade supports Controlled Demolition."]
    ),
    artifactPerks: [],
    artifactDependency: "none",
    gameplayLoop: ["Use Shield Throw to create Void overshield and feed Doom Fang.", "Use Turncoat and Controlled Demolition to spread Void pressure.", "Fight behind Rally Barricade when a lane cannot be pushed safely.", "Cast Sentinel Shield into dense waves and extend it through active defeats."],
    damageRotation: ["Apply volatile and Void debuffs before the damage window.", "Use the strongest owned heavy on the priority target.", "Reserve Sentinel Shield for add-heavy phases or team protection."],
    activities: ["General PvE", "Group activities", "Nightfalls", "Solo activities"],
    strengths: ["Long Sentinel Shield uptime", "Reliable overshields", "Strong Void add clear", "Good team utility"],
    weaknesses: ["Single-target boss damage depends on the heavy roll", "Super value drops in sparse encounters"],
    style: "Front-line Void weapon pressure backed by overshields and an extended roaming Super.",
    role: "General PvE, survivability, and add clear",
    damageProfile: "medium", bossDamage: "medium", addClear: "high", survivability: "high", abilityUptime: "high", complexity: "medium", solo: "high", group: "high", powerFriendly: true, difficultExecution: false, teammateDependency: "low",
    upgrades: ["Turncoat and its catalyst", "A current heavy weapon with a reload-and-damage perk pairing"]
  },
  {
    id: "titan-solar-hallowfire", version: 1, reviewedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT, release: BUILD_ADVISOR_CURRENT_SANDBOX,
    sourceNotes: "Hallowfire Heart Sunbreaker reviewed against Update 9.7.0 and Divide's June 2026 Solar Titan guide.",
    verification: currentVerification("Current Solar Titan build guide", "https://mobalytics.gg/destiny-2/builds/titan/solar/divide-titan-solar-dps-ability"),
    enabled: true, name: "Sunfire Furnace Titan", classType: "titan", subclass: "solar",
    summary: "Throwing Hammer, Sunspots, and Hallowfire Heart build Sunfire Furnace stacks for repeated ability and Super windows.",
    requiredExoticArmor: "Hallowfire Heart", preferredExoticWeapon: "Sunshot",
    ghostFocus: { archetype: "Skirmisher", primaryStat: "Melee", secondaryStat: "Weapons", notes: "Favor Melee for the Throwing Hammer loop, then Weapons for Solar cleanup between ability defeats." },
    weapons: [
      { id: "kinetic-special", label: "Kinetic-slot special", slots: ["Kinetic Weapons"], archetypes: ["Fusion Rifle", "Shotgun", "Grenade Launcher", "Sniper Rifle"], preferredPerks: ["Recombination", "Chill Clip"], acceptablePerks: ["Lead from Gold", "Vorpal Weapon"] },
      { id: "exotic-primary", label: "Key exotic weapon", slots: ["Energy Weapons"], preferredNames: ["Sunshot"], requiresExotic: true },
      { id: "damage-heavy", label: "Boss-capable heavy", slots: ["Power Weapons"], archetypes: ["Sword", "Rocket Launcher", "Grenade Launcher"], preferredPerks: ["Bait and Switch", "Explosive Light"], acceptablePerks: ["Vorpal Weapon", "Frenzy"] }
    ],
    abilities: { super: "Burning Maul", classAbility: "Rally Barricade", movement: "Catapult Lift", melee: "Throwing Hammer", grenade: "Healing Grenade", aspects: ["Roaring Flames", "Sol Invictus"], fragments: ["Ember of Torches", "Ember of Combustion", "Ember of Solace", "Ember of Ashes"] },
    recommendedArmorSets: ["Lustrous"],
    armorMods: { ...sharedMods, arms: ["Heavy Handed", "Impact Induction", "Focusing Strike"], legs: ["Recuperation", "Solar Weapon Surge", "Invigoration"] },
    statPriorities: stats(["Melee", 100, "Throwing Hammer drives the loop."], ["Super", 100, "Hallowfire converts furnace stacks through Burning Maul."], ["Weapons", 100, "Solar weapons maintain pressure between abilities."], ["Grenade", 70, "Healing Grenade is the safety reset."], ["Class", 50, "Barricade supports exposed lanes."], ["Health", 30, "Healing and Sunspots provide the primary sustain."]),
    artifactPerks: [], artifactDependency: "none",
    gameplayLoop: ["Defeat an enemy with Throwing Hammer to create a Sunspot.", "Collect Orbs and Firesprites while maintaining Radiant and Restoration.", "Build Sunfire Furnace while the Super is charged.", "Cast Burning Maul at maximum value, then rebuild the loop."],
    damageRotation: ["Become Radiant and establish Roaring Flames.", "Cast Burning Maul after building Sunfire Furnace.", "Use the strongest owned heavy while abilities recover."],
    activities: ["General PvE", "Dungeons", "Solo activities", "Boss encounters"],
    strengths: ["Strong ability damage", "Reliable healing", "Fast Super cycling"], weaknesses: ["Throwing Hammer retrieval matters", "Long-range encounters reduce melee value"],
    style: "Close-range Solar ability pressure with a charged-Super payoff.", role: "Ability damage and solo sustain",
    damageProfile: "high", bossDamage: "high", addClear: "high", survivability: "high", abilityUptime: "high", complexity: "medium", solo: "high", group: "medium", powerFriendly: true, difficultExecution: false, teammateDependency: "none",
    upgrades: ["Sunshot and its catalyst", "Photogalvanic armor pieces", "A current reload-and-damage heavy roll"]
  },
  {
    id: "titan-stasis-icefall", version: 1, reviewedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT, release: BUILD_ADVISOR_CURRENT_SANDBOX,
    sourceNotes: "Icefall crystal-shatter Behemoth reviewed against Update 9.7.0 and Rick Kackis's June 2026 Stasis guide.",
    verification: currentVerification("Current Stasis Titan build guide", "https://mobalytics.gg/destiny-2/builds/titan/stasis/rickkackis-nuclear-bomb-shatters"),
    enabled: true, name: "Nuclear Shatter Titan", classType: "titan", subclass: "stasis",
    summary: "Howl of the Storm and Glacier Grenade flood the field with crystals while Icefall Mantle supplies Frost Armor and healing.",
    requiredExoticArmor: "Icefall Mantle", preferredExoticWeapon: "Ice Breaker",
    ghostFocus: { archetype: "Skirmisher", primaryStat: "Melee", secondaryStat: "Weapons", notes: "Melee fuels Howl of the Storm; Weapons improves the Stasis and Kinetic shatter follow-up." },
    weapons: [
      { id: "stasis-primary", label: "Stasis primary", slots: ["Kinetic Weapons"], damageTypes: ["Stasis"], archetypes: ["Submachine Gun", "Auto Rifle", "Pulse Rifle", "Hand Cannon"], preferredPerks: ["Headstone"], acceptablePerks: ["Rimestealer", "Frenzy"] },
      { id: "exotic-special", label: "Key exotic weapon", slots: ["Energy Weapons"], preferredNames: ["Ice Breaker"], requiresExotic: true },
      { id: "damage-heavy", label: "Reliable heavy", slots: ["Power Weapons"], archetypes: ["Machine Gun", "Grenade Launcher", "Rocket Launcher"], preferredPerks: ["Bait and Switch", "Explosive Light"], acceptablePerks: ["Frenzy", "Vorpal Weapon"] }
    ],
    abilities: { super: "Glacial Quake", classAbility: "Rally Barricade", movement: "Strafe Lift", melee: "Shiver Strike", grenade: "Glacier Grenade", aspects: ["Howl of the Storm", "Tectonic Harvest"], fragments: ["Whisper of Fissures", "Whisper of Shards", "Whisper of Conduction", "Whisper of Rime"] },
    recommendedArmorSets: ["Seventh Seraph"],
    armorMods: { ...sharedMods, arms: ["Heavy Handed", "Impact Induction", "Focusing Strike"], legs: ["Recuperation", "Stasis Weapon Surge", "Invigoration"] },
    statPriorities: stats(["Weapons", 100, "Weapon damage detonates the crystal field."], ["Melee", 100, "Howl of the Storm is the main crystal generator."], ["Grenade", 100, "Glacier Grenade expands the shatter chain."], ["Super", 70, "Glacial Quake supplies major shatter windows."], ["Class", 50, "Icefall replaces and benefits from class ability uptime."], ["Health", 30, "Frost Armor is the primary defensive engine."]),
    artifactPerks: [], artifactDependency: "none",
    gameplayLoop: ["Slide-melee with Howl of the Storm to create crystals.", "Break crystals with Stasis or Kinetic damage.", "Collect Shatter Shards to maintain Frost Armor and ability energy.", "Use Icefall Mantle before dangerous pushes."],
    damageRotation: ["Create a dense crystal field with Howl and Glacier Grenade.", "Shatter the field with Ice Breaker or the best owned weapon.", "Cast Glacial Quake when the target and arena support repeated shatters."],
    activities: ["Endgame PvE", "Onslaught", "Solo activities", "Crowd control"],
    strengths: ["Exceptional crowd control", "High shatter damage", "Strong Frost Armor sustain"], weaknesses: ["Crystal placement can obstruct teammates", "Boss performance varies by arena"],
    style: "Deliberate crystal creation followed by large chained shatters.", role: "Crowd control, area damage, and survivability",
    damageProfile: "high", bossDamage: "medium", addClear: "high", survivability: "high", abilityUptime: "high", complexity: "medium", solo: "high", group: "medium", powerFriendly: true, difficultExecution: false, teammateDependency: "none",
    upgrades: ["Ice Breaker and its catalyst", "Seventh Seraph armor pieces", "A Stasis primary with Headstone or Rimestealer"]
  },
  {
    id: "titan-prismatic-consecration", version: 1, reviewedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT, release: BUILD_ADVISOR_CURRENT_SANDBOX,
    sourceNotes: "Stoicism Consecration setup reviewed against Update 9.7.0 and Rick Kackis's July 2026 Prismatic Titan guide.",
    verification: currentVerification("Current Prismatic Titan build guide", "https://mobalytics.gg/destiny-2/builds/titan/prismatic/rickkackis-consecration-titan"),
    enabled: true, name: "Prismatic Consecration Titan", classType: "titan", subclass: "prismatic",
    summary: "Three Frenzied Blade charges feed repeated Consecrations while Knockout and Prismatic buffs keep the Titan in the fight.",
    requiredExoticArmor: "Stoicism", preferredExoticWeapon: "Conditional Finality",
    ghostFocus: { archetype: "Skirmisher", primaryStat: "Melee", secondaryStat: "Weapons", notes: "Melee directly feeds Consecration charges; Weapons supports the rotation while charges recover." },
    weapons: [
      { id: "exotic-special", label: "Key exotic weapon", slots: ["Kinetic Weapons"], preferredNames: ["Conditional Finality"], requiresExotic: true },
      { id: "solar-primary", label: "Solar primary", slots: ["Energy Weapons"], damageTypes: ["Solar"], archetypes: ["Auto Rifle", "Pulse Rifle", "Hand Cannon", "Submachine Gun"], preferredPerks: ["Incandescent"], acceptablePerks: ["Frenzy", "Pugilist"] },
      { id: "damage-heavy", label: "Boss-capable heavy", slots: ["Power Weapons"], archetypes: ["Sword", "Rocket Launcher", "Grenade Launcher"], preferredPerks: ["Bait and Switch", "Explosive Light"], acceptablePerks: ["Vorpal Weapon", "Frenzy"] }
    ],
    abilities: { super: "Glacial Quake", classAbility: "Thruster", movement: "Strafe Lift", melee: "Frenzied Blade", grenade: "Glacier Grenade", aspects: ["Consecration", "Knockout"], fragments: ["Facet of Protection", "Facet of Purpose", "Facet of Ruin", "Facet of Courage"] },
    recommendedArmorSets: ["Legacy's Oath"],
    armorMods: { ...sharedMods, arms: ["Heavy Handed", "Impact Induction", "Focusing Strike"], legs: ["Recuperation", "Solar Weapon Surge", "Invigoration"] },
    statPriorities: stats(["Melee", 100, "Every Frenzied Blade charge can become Consecration."], ["Super", 100, "Glacial Quake and Facet of Purpose support the loop."], ["Grenade", 100, "Glacier Grenade supplies control and Darkness energy."], ["Weapons", 70, "Weapons bridge melee-charge downtime."], ["Class", 50, "Thruster supports Reaper and positioning."], ["Health", 30, "Knockout and defensive buffs supply sustain."]),
    artifactPerks: [], artifactDependency: "none",
    gameplayLoop: ["Slide and spend Frenzied Blade through Consecration.", "Use Knockout follow-ups to heal and maintain pressure.", "Alternate Light and Dark damage to charge Transcendence.", "Use Transcendence to accelerate the entire ability loop."],
    damageRotation: ["Freeze or control the target with Glacier Grenade or Conditional Finality.", "Chain Consecration slams through available melee charges.", "Use the heavy weapon or Glacial Quake when melee access is unsafe."],
    activities: ["Endgame PvE", "Solo activities", "Nightfalls", "Dungeons"],
    strengths: ["Very high melee damage", "Strong add clear", "Multiple melee charges"], weaknesses: ["Requires close-range execution", "Preferred Stoicism spirit roll is not guaranteed"],
    style: "Aggressive repeated Consecration with Prismatic control and healing.", role: "Endgame add clear and close-range burst",
    damageProfile: "high", bossDamage: "high", addClear: "high", survivability: "high", abilityUptime: "high", complexity: "medium", solo: "high", group: "high", powerFriendly: false, difficultExecution: true, teammateDependency: "none",
    upgrades: ["Stoicism with a melee-focused spirit pairing", "Cursed Fist armor pieces", "Conditional Finality and its catalyst"]
  },
  {
    id: "warlock-solar-battle-harmony", version: 1, reviewedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT, release: BUILD_ADVISOR_CURRENT_SANDBOX,
    sourceNotes: "Solar Well and Mantle of Battle Harmony setup reviewed against Update 9.7.0 and Plunder's July 2026 guide.",
    verification: currentVerification("Current Solar Warlock build guide", "https://mobalytics.gg/destiny-2/builds/warlock/solar/plunder-best-well-warlock"),
    enabled: true, name: "Battle Harmony Well-Lock", classType: "warlock", subclass: "solar",
    summary: "Solar weapon pressure fuels Well of Radiance through Mantle of Battle Harmony while Hellion and Touch of Flame control the room.",
    requiredExoticArmor: "Mantle of Battle Harmony", preferredExoticWeapon: "Prometheus Lens",
    ghostFocus: { archetype: "Colossus", primaryStat: "Super", secondaryStat: "Health", notes: "Favor Super for Well uptime and Health for safe support positioning." },
    weapons: [
      { id: "kinetic-primary", label: "Kinetic-slot primary", slots: ["Kinetic Weapons"], archetypes: ["Auto Rifle", "Pulse Rifle", "Scout Rifle"], preferredPerks: ["Kinetic Tremors"], acceptablePerks: ["Frenzy", "One for All"] },
      { id: "exotic-special", label: "Key exotic weapon", slots: ["Energy Weapons"], preferredNames: ["Prometheus Lens"], requiresExotic: true },
      { id: "solar-heavy", label: "Solar heavy", slots: ["Power Weapons"], damageTypes: ["Solar"], archetypes: ["Machine Gun", "Rocket Launcher", "Grenade Launcher"], preferredPerks: ["Bait and Switch", "Explosive Light"], acceptablePerks: ["Frenzy", "Vorpal Weapon"] }
    ],
    abilities: { super: "Well of Radiance", classAbility: "Phoenix Dive", movement: "Burst Glide", melee: "Incinerator Snap", grenade: "Healing Grenade", aspects: ["Hellion", "Touch of Flame"], fragments: ["Ember of Ashes", "Ember of Empyrean", "Ember of Eruption", "Ember of Singeing"] },
    recommendedArmorSets: ["Exodus Down"],
    armorMods: { ...sharedMods, arms: ["Firepower", "Bolstering Detonation", "Momentum Transfer"], legs: ["Recuperation", "Solar Weapon Surge", "Innervation"] },
    statPriorities: stats(["Super", 100, "Well of Radiance is the team and damage anchor."], ["Weapons", 100, "Matching Solar damage drives Battle Harmony."], ["Class", 100, "Phoenix Dive deploys Hellion and emergency healing."], ["Grenade", 70, "Healing Grenade extends support uptime."], ["Melee", 50, "Incinerator Snap supplies scorch and ignitions."], ["Health", 30, "Restoration and positioning are the main defenses."]),
    artifactPerks: [], artifactDependency: "none",
    gameplayLoop: ["Use Solar weapon damage to build Super through Battle Harmony.", "Deploy Hellion with Phoenix Dive.", "Extend Solar buffs through Ember of Empyrean.", "Cast Well for team damage or a dangerous hold."],
    damageRotation: ["Apply scorch with Hellion, melee, or Prometheus Lens.", "Cast Well before the coordinated damage window.", "Use the best Solar heavy while Battle Harmony and surge effects are active."],
    activities: ["Raids", "Dungeons", "Nightfalls", "Group activities"],
    strengths: ["Excellent team support", "Fast Super generation", "Strong Solar weapon damage"], weaknesses: ["Lower damage reduction outside healing effects", "Best value requires matching Solar weapons"],
    style: "Weapon-led Solar support with frequent Well and Hellion uptime.", role: "Team support and sustained Solar damage",
    damageProfile: "high", bossDamage: "high", addClear: "high", survivability: "high", abilityUptime: "high", complexity: "low", solo: "medium", group: "high", powerFriendly: true, difficultExecution: false, teammateDependency: "low",
    upgrades: ["Prometheus Lens and its catalyst", "Exodus Down or Smoke Jumper armor pieces", "A Solar heavy with a current damage roll"]
  },
  {
    id: "warlock-strand-mataiodoxia", version: 1, reviewedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT, release: BUILD_ADVISOR_CURRENT_SANDBOX,
    sourceNotes: "Mataiodoxia Broodweaver reviewed against Update 9.7.0 and ImNexusss's July 2026 Strand guide.",
    verification: currentVerification("Current Strand Warlock build guide", "https://mobalytics.gg/destiny-2/builds/warlock/strand/imnexusss-ultimate-strand-warlock"),
    enabled: true, name: "Suspending Broodweaver", classType: "warlock", subclass: "strand",
    summary: "Mataiodoxia turns Arcane Needle into reliable suspension while Weavewalk and Threadlings provide safety and pressure.",
    requiredExoticArmor: "Mataiodoxia", preferredExoticWeapon: "Barrow-Dyad",
    ghostFocus: { archetype: "Skirmisher", primaryStat: "Melee", secondaryStat: "Weapons", notes: "Melee feeds Arcane Needle suspension; Weapons improves Barrow-Dyad and Strand follow-up." },
    weapons: [
      { id: "exotic-primary", label: "Key exotic weapon", slots: ["Kinetic Weapons"], preferredNames: ["Barrow-Dyad"], requiresExotic: true },
      { id: "energy-primary", label: "Energy primary", slots: ["Energy Weapons"], archetypes: ["Pulse Rifle", "Auto Rifle", "Hand Cannon"], preferredPerks: ["Voltshot", "Incandescent"], acceptablePerks: ["Frenzy", "One for All"] },
      { id: "strand-heavy", label: "Strand heavy", slots: ["Power Weapons"], damageTypes: ["Strand"], archetypes: ["Linear Fusion Rifle", "Machine Gun", "Grenade Launcher"], preferredPerks: ["Bait and Switch", "Firing Line"], acceptablePerks: ["Frenzy", "Vorpal Weapon"] }
    ],
    abilities: { super: "Needlestorm", classAbility: "Healing Rift", movement: "Burst Glide", melee: "Arcane Needle", grenade: "Shackle Grenade", aspects: ["Weavewalk", "The Wanderer"], fragments: ["Thread of Rebirth", "Thread of Evolution", "Thread of Generation", "Thread of Warding", "Thread of Propagation"] },
    recommendedArmorSets: ["Seventh Seraph"],
    armorMods: { ...sharedMods, arms: ["Firepower", "Impact Induction", "Momentum Transfer"], legs: ["Recuperation", "Strand Weapon Surge", "Invigoration"] },
    statPriorities: stats(["Super", 100, "Needlestorm provides the main burst window."], ["Grenade", 100, "Shackle Grenade supplies immediate control."], ["Melee", 100, "Arcane Needle activates Mataiodoxia."], ["Class", 70, "Healing Rift stabilizes difficult holds."], ["Weapons", 50, "Strand weapons sustain unravel and Threadlings."], ["Health", 30, "Woven Mail and Weavewalk are the primary defense."]),
    artifactPerks: [], artifactDependency: "none",
    gameplayLoop: ["Tag priority targets with Arcane Needle.", "Defeat marked targets to trigger suspending detonations.", "Use Weavewalk to reposition and generate perched Threadlings.", "Throw or destroy Tangles to continue the control loop."],
    damageRotation: ["Apply unravel and suspension before Needlestorm.", "Cast Needlestorm on the priority target.", "Follow with the strongest owned Strand heavy while Threadlings continue attacking."],
    activities: ["Endgame PvE", "Nightfalls", "Solo activities", "Crowd control"],
    strengths: ["Reliable suspension", "Strong ranged melee economy", "Safe repositioning"], weaknesses: ["Melee-charge management matters", "Boss damage depends on Needlestorm tracking and heavy roll"],
    style: "Ranged Strand control through Arcane Needle, Threadlings, and Tangles.", role: "Crowd control and ranged ability damage",
    damageProfile: "high", bossDamage: "high", addClear: "high", survivability: "high", abilityUptime: "high", complexity: "medium", solo: "high", group: "high", powerFriendly: true, difficultExecution: false, teammateDependency: "none",
    upgrades: ["Barrow-Dyad and its catalyst", "Seventh Seraph armor pieces", "A Strand heavy with a current damage roll"]
  },
  {
    id: "warlock-stasis-frostpulse", version: 1, reviewedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT, release: BUILD_ADVISOR_CURRENT_SANDBOX,
    sourceNotes: "Frostpulse Shadebinder reviewed against Update 9.7.0 and RestAssured's June 2026 Stasis guide.",
    verification: currentVerification("Current Stasis Warlock build guide", "https://mobalytics.gg/destiny-2/builds/warlock/stasis/rest-definitive-frostpulse"),
    enabled: true, name: "Frostpulse Fortress Warlock", classType: "warlock", subclass: "stasis",
    summary: "Frostpulse freezes nearby enemies on Rift cast while Glacial Harvest converts the control loop into Frost Armor.",
    requiredExoticArmor: "Vesper of Radius", preferredExoticWeapon: "Ager's Scepter",
    ghostFocus: { archetype: "Reaver", primaryStat: "Class", secondaryStat: "Melee", notes: "Class maximizes Frostpulse Rift access; Melee supports Penumbral Blast between casts." },
    weapons: [
      { id: "exotic-special", label: "Key exotic weapon", slots: ["Kinetic Weapons"], preferredNames: ["Ager's Scepter"], requiresExotic: true },
      { id: "energy-primary", label: "Energy primary", slots: ["Energy Weapons"], archetypes: ["Auto Rifle", "Pulse Rifle", "Hand Cannon"], preferredPerks: ["Demolitionist", "Attrition Orbs"], acceptablePerks: ["Frenzy", "One for All"] },
      { id: "stasis-heavy", label: "Stasis heavy", slots: ["Power Weapons"], damageTypes: ["Stasis"], archetypes: ["Rocket Launcher", "Grenade Launcher", "Machine Gun"], preferredPerks: ["Bait and Switch", "Explosive Light"], acceptablePerks: ["Frenzy", "Vorpal Weapon"] }
    ],
    abilities: { super: "Winter's Wrath", classAbility: "Healing Rift", movement: "Burst Glide", melee: "Penumbral Blast", grenade: "Shatter Grenade", aspects: ["Frostpulse", "Glacial Harvest"], fragments: ["Whisper of Fissures", "Whisper of Refraction", "Whisper of Conduction", "Whisper of Rime", "Whisper of Torment"] },
    recommendedArmorSets: ["Corrupting Echo"],
    armorMods: { ...sharedMods, arms: ["Bolstering Detonation", "Focusing Strike", "Momentum Transfer"], legs: ["Recuperation", "Stasis Weapon Surge", "Innervation"] },
    statPriorities: stats(["Class", 100, "Every Rift is a Frostpulse control and armor trigger."], ["Weapons", 100, "Ager's Scepter drives repeated freezes."], ["Grenade", 100, "Shatter Grenade adds direct burst and control."], ["Melee", 70, "Penumbral Blast stops priority targets."], ["Super", 50, "Winter's Wrath is the emergency freeze field."], ["Health", 30, "Frost Armor and Rift healing provide sustain."]),
    artifactPerks: [], artifactDependency: "none",
    gameplayLoop: ["Cast Healing Rift near enemies to trigger Frostpulse.", "Collect Shatter Shards from frozen targets to gain Frost Armor.", "Use Ager's Scepter and Shatter Grenade to chain freezes and shatters.", "Recycle Rift energy through Whisper of Refraction."],
    damageRotation: ["Freeze the field before exposing yourself.", "Shatter grouped targets with the best owned weapon.", "Use Winter's Wrath or Ager's catalyst mode for major control windows."],
    activities: ["Endgame PvE", "Onslaught", "Solo activities", "Crowd control"],
    strengths: ["Excellent freeze control", "Strong Frost Armor sustain", "Safe solo play"], weaknesses: ["Requires close Rift placement for Frostpulse", "Lower direct boss damage than damage-first subclasses"],
    style: "Defensive Rift placement that turns into repeated freezes and shatters.", role: "Endgame crowd control and survivability",
    damageProfile: "medium", bossDamage: "low", addClear: "high", survivability: "high", abilityUptime: "high", complexity: "medium", solo: "high", group: "high", powerFriendly: true, difficultExecution: false, teammateDependency: "none",
    upgrades: ["Ager's Scepter and its catalyst", "Corrupting Echo armor for Overflowing Coffers", "A Stasis heavy with a current damage roll"]
  },
  {
    id: "warlock-prismatic-buddies", version: 1, reviewedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT, release: BUILD_ADVISOR_CURRENT_SANDBOX,
    sourceNotes: "Getaway Artist buddy setup reviewed against Update 9.7.0 and RestAssured's July 2026 Prismatic guide.",
    verification: currentVerification("Current Prismatic Warlock build guide", "https://mobalytics.gg/destiny-2/builds/warlock/prismatic/rest-definitive-buddies"),
    enabled: true, name: "Prismatic Buddy Warlock", classType: "warlock", subclass: "prismatic",
    summary: "Getaway Artist, Hellion, and Devour create autonomous pressure while the Warlock cycles grenade energy and Transcendence.",
    requiredExoticArmor: "Getaway Artist", preferredExoticWeapon: "No Time to Explain",
    ghostFocus: { archetype: "Demolitionist", primaryStat: "Grenade", secondaryStat: "Class", notes: "Grenade sustains Getaway Artist; Class keeps Phoenix Dive and Hellion available." },
    weapons: [
      { id: "exotic-primary", label: "Key exotic weapon", slots: ["Kinetic Weapons"], preferredNames: ["No Time to Explain"], requiresExotic: true },
      { id: "energy-special", label: "Energy special", slots: ["Energy Weapons"], archetypes: ["Fusion Rifle", "Shotgun", "Grenade Launcher"], preferredPerks: ["Lead from Gold", "Controlled Burst"], acceptablePerks: ["Vorpal Weapon", "Frenzy"] },
      { id: "damage-heavy", label: "Boss-capable heavy", slots: ["Power Weapons"], archetypes: ["Rocket Launcher", "Grenade Launcher", "Machine Gun"], preferredPerks: ["Bait and Switch", "Explosive Light"], acceptablePerks: ["Frenzy", "Vorpal Weapon"] }
    ],
    abilities: { super: "Song of Flame", classAbility: "Phoenix Dive", movement: "Burst Glide", melee: "Arcane Needle", grenade: "Storm Grenade", aspects: ["Feed the Void", "Hellion"], fragments: ["Facet of Protection", "Facet of Purpose", "Facet of Courage", "Facet of Dominance"] },
    recommendedArmorSets: ["Smoke Jumper"],
    armorMods: { ...sharedMods, arms: ["Firepower", "Bolstering Detonation", "Momentum Transfer"], legs: ["Recuperation", "Kinetic Weapon Surge", "Innervation"] },
    statPriorities: stats(["Grenade", 100, "Storm Grenade is consumed for the Getaway Arc Soul."], ["Class", 100, "Phoenix Dive deploys Hellion and emergency healing."], ["Super", 100, "Song of Flame provides damage and survival."], ["Weapons", 70, "Weapon damage layers another autonomous buddy."], ["Melee", 50, "Arcane Needle supplies Darkness energy."], ["Health", 30, "Devour and Phoenix Dive are the primary sustain."]),
    artifactPerks: [], artifactDependency: "none",
    gameplayLoop: ["Consume Storm Grenade to create the Getaway Arc Soul.", "Use Phoenix Dive to deploy Hellion.", "Maintain Devour through ability and weapon defeats.", "Alternate Light and Dark damage to enter Transcendence."],
    damageRotation: ["Deploy Arc Soul and Hellion before engaging.", "Use Transcendence or Song of Flame for major waves.", "Apply the strongest heavy rotation while autonomous buddies continue firing."],
    activities: ["Endgame PvE", "Nightfalls", "Solo activities", "General PvE"],
    strengths: ["High autonomous damage", "Excellent Devour sustain", "Easy target coverage"], weaknesses: ["Grenade is committed to Arc Soul upkeep", "Can feel passive when all buddies are active"],
    style: "Layered autonomous companions backed by Devour and Prismatic uptime.", role: "Safe endgame damage and add clear",
    damageProfile: "high", bossDamage: "high", addClear: "high", survivability: "high", abilityUptime: "high", complexity: "low", solo: "high", group: "high", powerFriendly: true, difficultExecution: false, teammateDependency: "none",
    upgrades: ["Getaway Artist", "Smoke Jumper armor for its Orb-based protection", "No Time to Explain and its catalyst"]
  }
];

interface AlternateBuildDefinition {
  id: string;
  baseId: string;
  name: string;
  exoticArmor: string;
  exoticWeapon: string;
  summary: string;
  role: string;
  gameplayLoop: string[];
  strengths: string[];
  weaknesses: string[];
}

const ALTERNATE_BUILD_DEFINITIONS: AlternateBuildDefinition[] = [
  { id: "hunter-void-orpheus", baseId: "hunter-void-gyrfalcon", name: "Orpheus Anchor Hunter", exoticArmor: "Orpheus Rig", exoticWeapon: "Le Monarque", summary: "Repeated Deadfall tethers control dense rooms while a Void primary sustains weaken and Devour loops.", role: "Super control and team add clear", gameplayLoop: ["Place Deadfall where waves converge.", "Use Void weapon defeats and Orbs to rebuild Super energy.", "Dodge and use Stylish Executioner when pressure reaches the firing line."], strengths: ["Frequent team-oriented tethers", "Safe ranged Void loop", "Strong Orb generation"], weaknesses: ["Less personal weapon amplification than Gyrfalcon", "Needs clustered targets for best Super returns"] },
  { id: "hunter-arc-raiden", baseId: "hunter-arc-liars", name: "Raiden Storm Hunter", exoticArmor: "Raiden Flux", exoticWeapon: "Thunderlord", summary: "A safer Arc alternative that converts Arc Staff uptime into sustained roaming damage instead of committing to a melee loop.", role: "Roaming Super clear and Arc weapon pressure", gameplayLoop: ["Build Amplified with Arc weapon and ability defeats.", "Use dodge and Combination Blow for cleanup without depending on melee stacks.", "Deploy Arc Staff into dense or mobile waves and keep attacking to extend its value."], strengths: ["Safer than the Liar's melee loop", "Long roaming-Super uptime", "Strong Arc add clear"], weaknesses: ["Lower burst against stationary bosses", "Exotic contributes little outside Arc Staff"] },
  { id: "hunter-stasis-bakris", baseId: "hunter-stasis-renewal", name: "Bakris Shift Hunter", exoticArmor: "Mask of Bakris", exoticWeapon: "Verglas Curve", summary: "Light Shift turns the Stasis dodge into an evasive damage setup for frozen targets and Arc or Stasis weapons.", role: "Mobile Stasis weapon damage and control", gameplayLoop: ["Freeze targets with Duskfield or Verglas Curve.", "Dodge through danger to trigger Light Shift.", "Use the damage window on frozen priority targets, then shatter and reposition."], strengths: ["Excellent repositioning", "Strong weapon burst into frozen targets", "Reliable Stasis control"], weaknesses: ["Dodge cooldown has deliberate downtime", "Less team protection than Renewal Grasps"] },
  { id: "hunter-strand-sixth-coyote", baseId: "hunter-strand-cyrtarachne", name: "Double-Decoy Threadrunner", exoticArmor: "The Sixth Coyote", exoticWeapon: "Final Warning", summary: "A second dodge charge creates more Threaded Specters and safer openings for aggressive Strand weapon play.", role: "Decoy control and mobile Strand damage", gameplayLoop: ["Dodge near pressure to leave a Threaded Specter.", "Use the second charge to cross exposed space or redirect another wave.", "Apply unravel with Final Warning and clean up around the decoys."], strengths: ["Two emergency dodges", "Frequent decoys", "Flexible solo control"], weaknesses: ["Loses Cyrtarachne's Woven Mail trigger", "Requires careful dodge-charge management"] },
  { id: "hunter-prismatic-gifted", baseId: "hunter-prismatic-liars", name: "Gifted Tempest Hunter", exoticArmor: "Gifted Conviction", exoticWeapon: "Khvostov 7G-0X", summary: "Ascension and jolt provide a ranged Prismatic alternative to the point-blank Cross Counter setup.", role: "Mobile jolt clear and team support", gameplayLoop: ["Use Ascension to jolt nearby targets and become Amplified.", "Defeat debuffed enemies to maintain Stylish Executioner safety.", "Alternate Light and Dark damage before using Transcendence on priority waves."], strengths: ["Does not require melee range", "Strong jolt coverage", "Good team movement support"], weaknesses: ["Lower single-target melee burst", "Relies on class-ability timing"] },
  { id: "titan-arc-point-contact", baseId: "titan-arc-cuirass", name: "Thunderclap Titan", exoticArmor: "Point-Contact Cannon Brace", exoticWeapon: "Thunderlord", summary: "Thunderclap becomes a repeatable room-clearing tool while Arc weapons cover targets outside melee reach.", role: "Arc melee clear and frontline pressure", gameplayLoop: ["Charge Thunderclap from cover or behind a barricade.", "Release into grouped enemies to trigger lightning strikes.", "Use Arc weapon defeats and Orbs to rebuild melee energy before the next wave."], strengths: ["Powerful repeatable melee clear", "Strong Arc synergy", "Does not reserve the Exotic only for Super"], weaknesses: ["Charging Thunderclap can expose the Titan", "Lower boss burst than Cuirass"] },
  { id: "titan-strand-abeyant", baseId: "titan-strand-synthoceps", name: "Abeyant Control Titan", exoticArmor: "Abeyant Leap", exoticWeapon: "Deterministic Chaos", summary: "Improved Drengr's Lash suspends lanes and creates Woven Mail openings for a safer Strand frontline.", role: "Suspend control and team safety", gameplayLoop: ["Cast barricade toward a lane to send improved suspending lashes.", "Defeat suspended enemies to stabilize the frontline.", "Use Deterministic Chaos on priority targets when the team needs ranged weaken support."], strengths: ["Excellent ranged suspend", "Safer than a melee-first Synthoceps loop", "Useful team control"], weaknesses: ["Lower close-range burst", "Barricade placement determines control value"] },
  { id: "titan-void-second-chance", baseId: "titan-void-doom-fang", name: "Second-Chance Sentinel", exoticArmor: "Second Chance", exoticWeapon: "Graviton Lance", summary: "Two shield throws provide repeatable barrier utility and ranged weaken pressure between Sentinel Shield windows.", role: "Barrier utility and ranged Void support", gameplayLoop: ["Throw shields into priority targets to apply the build's Void setup.", "Use Graviton Lance to clear weakened groups and sustain Void effects.", "Reserve the second melee charge for champions or an emergency overshield cycle."], strengths: ["Two ranged melee charges", "Champion utility", "Safe Void play"], weaknesses: ["Less roaming-Super uptime than Doom Fang", "Shield throws require clear sightlines"] },
  { id: "titan-solar-pyrogale", baseId: "titan-solar-hallowfire", name: "Pyrogale Maul Titan", exoticArmor: "Pyrogale Gauntlets", exoticWeapon: "Polaris Lance", summary: "Consecration clears waves while Pyrogale compresses Burning Maul into a focused boss-damage Super.", role: "Solar burst and Consecration clear", gameplayLoop: ["Scorch groups at range before closing in.", "Use Consecration through clustered enemies to trigger ignitions.", "Commit the Pyrogale Burning Maul slam to a priority target after applying Solar setup."], strengths: ["Strong one-and-done Super", "Excellent ignition clear", "Useful at both range and close quarters"], weaknesses: ["More execution-heavy than Hallowfire", "Consecration positioning can be punished"] },
  { id: "titan-stasis-hoarfrost", baseId: "titan-stasis-icefall", name: "Hoarfrost Shatter Titan", exoticArmor: "Hoarfrost-Z", exoticWeapon: "Ice Breaker", summary: "The Stasis barricade creates crystals on demand for cover, Shatter Shards, and controlled burst damage.", role: "Crystal control and defensive shatter play", gameplayLoop: ["Cast the Hoarfrost barricade to create crystals and cover.", "Break selected crystals to gain Shatter Shards and damage nearby enemies.", "Repeat from a new angle while Ice Breaker handles distant priority targets."], strengths: ["On-demand cover", "Frequent crystal generation", "Strong defensive control"], weaknesses: ["Crystal placement can obstruct teammates", "Lower direct weapon bonus than Icefall Mantle"] },
  { id: "titan-prismatic-hazardous", baseId: "titan-prismatic-consecration", name: "Hazardous Rocket Titan", exoticArmor: "Hazardous Propulsion", exoticWeapon: "Grand Overture", summary: "Thruster-loaded Exodus rockets create a weapon-led Prismatic option that does not depend on Consecration melee uptime.", role: "Rocket-assisted weapon damage", gameplayLoop: ["Build Exodus rocket charges with precision hits and defeats.", "Use Thruster to release rockets into a priority target.", "Follow with rocket-assisted heavy damage, then alternate Light and Dark abilities toward Transcendence."], strengths: ["Strong ranged burst", "Rewards normal weapon play", "Safer than melee-first Prismatic"], weaknesses: ["Needs weapon setup before each burst", "Missed Exodus rockets reduce the damage window"] },
  { id: "warlock-void-nezarec", baseId: "warlock-void-contraverse", name: "Nezarec Devour Warlock", exoticArmor: "Nezarec's Sin", exoticWeapon: "Le Monarque", summary: "Void weapon and ability defeats accelerate every ability for a flexible Devour loop without charging every grenade.", role: "Void weapon clear and broad ability uptime", gameplayLoop: ["Start Devour with an ability defeat.", "Chain Void weapon defeats to trigger Abyssal Extractors.", "Spend the accelerated grenade, melee, and Rift cooldowns before returning to the Void weapon."], strengths: ["Improves every ability", "Flexible Void weapon choices", "Excellent general play"], weaknesses: ["Needs frequent Void defeats", "Less grenade damage resistance than Contraverse"] },
  { id: "warlock-arc-fallen-sunstar", baseId: "warlock-arc-stormdancer", name: "Fallen Sunstar Warlock", exoticArmor: "Fallen Sunstar", exoticWeapon: "Riskrunner", summary: "Enhanced Ionic Traces feed the whole ability kit and nearby allies instead of concentrating value in Stormtrance.", role: "Arc ability battery and team support", gameplayLoop: ["Jolt groups with abilities or an Arc weapon.", "Collect Ionic Traces to refill abilities and support nearby allies.", "Spend abilities aggressively so incoming traces never waste energy."], strengths: ["Excellent neutral-game uptime", "Shares ability energy", "Strong Arc add clear"], weaknesses: ["Less Super scaling than Stormdancer's Brace", "Trace generation slows against isolated bosses"] },
  { id: "warlock-solar-speakers", baseId: "warlock-solar-battle-harmony", name: "Speaker's Sight Warlock", exoticArmor: "Speaker's Sight", exoticWeapon: "Lumina", summary: "Healing turrets and Lumina provide a dedicated support option while Solar abilities maintain Radiant and Restoration.", role: "Fireteam healing and Solar support", gameplayLoop: ["Deploy a healing turret before the team takes sustained pressure.", "Use Lumina Noble Rounds to reinforce allies between grenade cycles.", "Maintain Solar buffs with melee and weapon defeats while repositioning with Phoenix Dive."], strengths: ["Excellent team healing", "Safe ranged support", "Strong Restoration access"], weaknesses: ["Lower personal damage than Battle Harmony", "Healing grenade energy is committed to support"] },
  { id: "warlock-strand-swarmers", baseId: "warlock-strand-mataiodoxia", name: "Swarmers Threadling Warlock", exoticArmor: "Swarmers", exoticWeapon: "Final Warning", summary: "Tangles and Threadlings create autonomous Strand pressure as an alternative to Mataiodoxia suspend chains.", role: "Threadling clear and unravel support", gameplayLoop: ["Create Tangles with Strand debuffs and defeats.", "Destroy Tangles to release Threadlings through Swarmers.", "Use Final Warning to unravel priority targets while Threadlings clean up the field."], strengths: ["Strong autonomous add clear", "Frequent unravel", "Easy ranged Strand loop"], weaknesses: ["Less direct suspend than Mataiodoxia", "Threadling targeting can spread damage unpredictably"] },
  { id: "warlock-stasis-osmiomancy", baseId: "warlock-stasis-frostpulse", name: "Osmiomancy Turret Warlock", exoticArmor: "Osmiomancy Gloves", exoticWeapon: "Verglas Curve", summary: "Two Coldsnap charges support Bleak Watcher turrets and repeated freezes from a safer distance.", role: "Long-duration Stasis turret control", gameplayLoop: ["Convert one grenade into a Bleak Watcher before the engagement.", "Use the second Coldsnap charge directly when a priority target must stop immediately.", "Shatter frozen groups and recover grenade energy through the control loop."], strengths: ["Exceptional ranged freeze control", "Two grenade charges", "Safe in difficult content"], weaknesses: ["Lower burst damage", "Turret placement and grenade economy require planning"] },
  { id: "warlock-prismatic-nezarec", baseId: "warlock-prismatic-buddies", name: "Prismatic Nezarec Warlock", exoticArmor: "Nezarec's Sin", exoticWeapon: "Graviton Lance", summary: "Void weapon defeats accelerate the Prismatic ability kit while Devour and Hellion keep the Warlock aggressive.", role: "Weapon-led Prismatic ability engine", gameplayLoop: ["Trigger Devour with an ability defeat.", "Chain Graviton Lance defeats to activate Abyssal Extractors.", "Spend the accelerated Light and Dark abilities to build Transcendence, then repeat."], strengths: ["Broad ability acceleration", "Excellent Void add clear", "Simple Devour sustain"], weaknesses: ["Requires a Void weapon for best uptime", "Loses Getaway Artist's autonomous Arc Soul"] },
  { id: "hunter-void-omnioculus", baseId: "hunter-void-gyrfalcon", name: "Omnioculus Pathfinder Hunter", exoticArmor: "Omnioculus", exoticWeapon: "Collective Obligation", summary: "Two smoke charges and damage resistance turn invisibility into a deliberate team-survival tool for difficult activities.", role: "Fireteam invisibility and safe revives", gameplayLoop: ["Use Trapper's Ambush to make nearby allies invisible before exposed movement.", "Regain melee energy by cloaking teammates and reserve the second charge for recovery.", "Leech and return Void debuffs with Collective Obligation between invisibility rotations."], strengths: ["Excellent team survivability", "Two smoke charges", "Reliable revive access"], weaknesses: ["Lower personal damage than Gyrfalcon", "Best melee refunds require nearby teammates"] },
  { id: "hunter-arc-shinobu", baseId: "hunter-arc-liars", name: "Shinobu Skip Hunter", exoticArmor: "Shinobu's Vow", exoticWeapon: "Riskrunner", summary: "Enhanced Skip Grenades provide a ranged Arc loop for players who do not want to live inside melee range.", role: "Ranged Arc jolt and grenade clear", gameplayLoop: ["Throw Skip Grenades into grouped targets to begin the jolt loop.", "Collect Ionic Traces and Orbs while Riskrunner handles Arc-heavy rooms.", "Spend the second grenade charge before incoming energy can overflow."], strengths: ["Safe ranged ability loop", "Two grenade charges", "Strong tracking against mobile targets"], weaknesses: ["Lower melee burst than Liar's Handshake", "Skip Grenades lose value against isolated bosses"] },
  { id: "hunter-solar-caliban", baseId: "hunter-solar-nighthawk", name: "Caliban Ignition Hunter", exoticArmor: "Caliban's Hand", exoticWeapon: "Sunshot", summary: "Proximity Knife ignitions and Sunshot explosions create a Solar chain-reaction build for dense encounters.", role: "Solar ignition add clear", gameplayLoop: ["Scorch a group with Sunshot or grenade damage.", "Land a charged Proximity Knife defeat to trigger an ignition.", "Use Gambler's Dodge near enemies when the knife loop breaks, then repeat."], strengths: ["Excellent chain-reaction clear", "Simple Solar weapon pairing", "Fast melee resets"], weaknesses: ["Knife defeats are required for the strongest ignition chain", "Less boss burst than Celestial Nighthawk"] },
  { id: "hunter-stasis-fealty", baseId: "hunter-stasis-renewal", name: "Mask of Fealty Hunter", exoticArmor: "Mask of Fealty", exoticWeapon: "Wicked Implement", summary: "Withering Blades generate crystals and erupt into additional blades for an aggressive ranged Stasis loop.", role: "Ranged Stasis melee and shatter clear", gameplayLoop: ["Throw Withering Blade through grouped targets to create crystals.", "Shatter a frozen target or crystal with the next blade to trigger the eruption.", "Use Wicked Implement to slow distant targets and maintain Frost Armor resources."], strengths: ["Strong ranged melee clear", "Frequent crystal creation", "Safe slow and shatter setup"], weaknesses: ["Requires careful blade and crystal sequencing", "Less defensive area coverage than Renewal Grasps"] },
  { id: "hunter-strand-mothkeeper", baseId: "hunter-strand-cyrtarachne", name: "Mothkeeper Threadrunner", exoticArmor: "Mothkeeper's Wraps", exoticWeapon: "Ex Diris", summary: "Moth grenades alternate between overshields and blinding damage while Ex Diris adds another reliable moth source.", role: "Flexible support and blinding control", gameplayLoop: ["Throw a moth grenade toward allies who need an overshield or enemies who need to be blinded.", "Use Ex Diris defeats to release additional moths.", "Create Tangles and reposition with grapple or dodge while grenade charges recover."], strengths: ["Flexible offense and defense", "Reliable blind", "Useful team overshields"], weaknesses: ["Moth targeting can choose a different target than intended", "Lower direct Strand synergy than Cyrtarachne"] },
  { id: "hunter-prismatic-relativism", baseId: "hunter-prismatic-liars", name: "Relativism Flex Hunter", exoticArmor: "Relativism", exoticWeapon: "Khvostov 7G-0X", summary: "The Exotic class item supports an adaptable Prismatic loop whose final role depends on the verified spirit roll.", role: "Flexible Prismatic general play", gameplayLoop: ["Use Light and Dark abilities in alternation to charge Transcendence.", "Lean into the two effects actually present on the owned Relativism roll.", "Use Khvostov and Orbs as the stable weapon engine while ability interactions cycle."], strengths: ["Highly adaptable", "Can combine two Exotic spirit effects", "Strong general-play weapon base"], weaknesses: ["Power depends on the physical spirit roll", "Guardian Nexus cannot assume an unverified perk combination"] },
  { id: "titan-arc-skullfort", baseId: "titan-arc-cuirass", name: "Skullfort Striker Titan", exoticArmor: "An Insurmountable Skullfort", exoticWeapon: "Centrifuse", summary: "Arc melee defeats restore health and melee energy for a self-sustaining frontline loop.", role: "Arc melee sustain and general clear", gameplayLoop: ["Become Amplified with Centrifuse or an Arc ability.", "Secure powered-melee defeats to restore health and melee energy.", "Use Thruster or cover to reset whenever a melee fails to kill."], strengths: ["Excellent melee uptime", "Built-in healing", "Simple general-play loop"], weaknesses: ["The loop stops when the melee does not secure a defeat", "Less boss burst than Cuirass"] },
  { id: "titan-void-ursa", baseId: "titan-void-doom-fang", name: "Ursa Banner Sentinel", exoticArmor: "Ursa Furiosa", exoticWeapon: "Collective Obligation", summary: "Banner Shield protects the Fireteam and converts blocked damage into safer Super cycling.", role: "Team protection and Void support", gameplayLoop: ["Build Super through Void debuffs, Orbs, and weapon pressure.", "Raise Banner Shield during dangerous team movement or sustained incoming fire.", "Return captured Void debuffs with Collective Obligation after the protection window."], strengths: ["Excellent team protection", "Safe objective control", "Void debuff utility"], weaknesses: ["Trades personal damage for team safety", "Requires teammates to use the protected firing lane"] },
  { id: "titan-solar-loreley", baseId: "titan-solar-hallowfire", name: "Loreley Sunspot Titan", exoticArmor: "Loreley Splendor Helm", exoticWeapon: "Sunshot", summary: "Automatic Sunspot recovery creates a forgiving Solar option for solo and progression content.", role: "Solar survival and steady add clear", gameplayLoop: ["Use Solar abilities and Sunshot to create Sunspots.", "Fight from Sunspots to maintain Restoration and ability recovery.", "Keep Barricade available so Loreley can provide an emergency recovery trigger."], strengths: ["Forgiving survivability", "Strong solo sustain", "Easy Solar weapon loop"], weaknesses: ["Lower peak damage than Pyrogale", "Emergency activation consumes class-ability energy"] },
  { id: "titan-stasis-cadmus", baseId: "titan-stasis-icefall", name: "Cadmus Lancecap Titan", exoticArmor: "Cadmus Ridge Lancecap", exoticWeapon: "Wicked Implement", summary: "A rally-barricade firing position generates Diamond Lances and crystals for controlled ranged Stasis play.", role: "Ranged Stasis control and team position", gameplayLoop: ["Place Rally Barricade with a clear view of the encounter.", "Land Stasis precision hits and defeats to create Diamond Lances near the position.", "Throw lances to freeze priority targets, then shatter with Wicked Implement or heavy damage."], strengths: ["Safe ranged freeze", "Frequent Diamond Lances", "Strong defensive position"], weaknesses: ["Less mobile than other Behemoth builds", "Barricade placement determines the loop's value"] },
  { id: "titan-strand-wishful", baseId: "titan-strand-synthoceps", name: "Wishful Frenzy Titan", exoticArmor: "Wishful Ignorance", exoticWeapon: "Quicksilver Storm", summary: "Additional Frenzied Blade pressure and Banner of War scaling create a dedicated Strand melee engine.", role: "Strand melee pressure and Banner support", gameplayLoop: ["Start Banner of War with a melee, finisher, or sword defeat.", "Chain Frenzied Blade through priority targets while allies extend the banner pulse.", "Use Quicksilver Storm at range and convert grenades when closing distance is unsafe."], strengths: ["Strong sustained melee", "Team healing pulses", "Multiple melee charges"], weaknesses: ["Requires close-range access", "Banner momentum falls off during long pauses"] },
  { id: "titan-prismatic-stoicism", baseId: "titan-prismatic-consecration", name: "Stoicism Flex Titan", exoticArmor: "Stoicism", exoticWeapon: "Khvostov 7G-0X", summary: "The Exotic class item creates an adaptable Prismatic Titan whose final loop follows the verified spirit pairing.", role: "Flexible Prismatic frontline", gameplayLoop: ["Inspect the owned Stoicism roll and prioritize the two effects it actually provides.", "Alternate Light and Dark abilities to reach Transcendence.", "Use Khvostov and Orb generation as the consistent engine between ability bursts."], strengths: ["Highly adaptable", "Can combine two Exotic spirit effects", "Works across many activities"], weaknesses: ["Quality depends on the physical spirit roll", "No specific spirit pairing is assumed when Bungie data is missing"] },
  { id: "warlock-void-briarbinds", baseId: "warlock-void-contraverse", name: "Briarbinds Void Soul Warlock", exoticArmor: "Briarbinds", exoticWeapon: "Collective Obligation", summary: "Reusable Void Souls weaken multiple positions and feed a deliberate Devour control loop.", role: "Void weaken control and ability sustain", gameplayLoop: ["Cast Rift and send the Void Soul into a dense group.", "Retrieve the Soul after its target dies, then redeploy it into the next lane.", "Use Collective Obligation to capture and return the build's Void debuffs."], strengths: ["Repeatable ranged weaken", "Strong lane control", "Excellent Devour compatibility"], weaknesses: ["Requires retrieving the Void Soul", "Less immediate grenade burst than Contraverse"] },
  { id: "warlock-arc-geomag", baseId: "warlock-arc-stormdancer", name: "Geomag Chaos Warlock", exoticArmor: "Geomag Stabilizers", exoticWeapon: "Delicate Tomb", summary: "Ionic Traces and Geomag Stabilizers turn Chaos Reach into the build's repeatable priority-target tool.", role: "Arc Super damage and Ionic Trace clear", gameplayLoop: ["Use Delicate Tomb and Arc abilities to generate Ionic Traces.", "Spend abilities aggressively while traces rebuild the kit and Super.", "Commit Chaos Reach to a priority target or dense lane, then cancel when continued channeling is wasteful."], strengths: ["Strong ranged Super", "Good Ionic Trace economy", "Safe priority-target damage"], weaknesses: ["Channeling Super limits movement", "Less neutral-game team energy than Fallen Sunstar"] },
  { id: "warlock-solar-dawn-chorus", baseId: "warlock-solar-battle-harmony", name: "Dawn Chorus Scorch Warlock", exoticArmor: "Dawn Chorus", exoticWeapon: "Dragon's Breath", summary: "Improved scorch damage and melee recovery create repeated ignitions around a strong Solar damage-over-time weapon.", role: "Solar scorch and ignition damage", gameplayLoop: ["Apply scorch with Hellion, melee, and Dragon's Breath.", "Let scorch ticks rebuild melee energy through Dawn Chorus.", "Trigger ignitions on priority targets and move the damage-over-time pressure to the next lane."], strengths: ["Strong scorch damage", "Frequent melee recovery", "Good sustained boss pressure"], weaknesses: ["Needs scorch stacking before peak damage", "Offers less direct healing than Speaker's Sight"] },
  { id: "warlock-stasis-rimecoat", baseId: "warlock-stasis-frostpulse", name: "Rime-Coat Domain Warlock", exoticArmor: "Rime-Coat Raiment", exoticWeapon: "Wicked Implement", summary: "Enhanced Bleak Watcher domains create crystals, slow fields, and a protected firing position.", role: "Stasis turret domain and ranged control", gameplayLoop: ["Deploy Bleak Watcher where its domain covers the main approach.", "Fight from the storm to use its defensive and slowing benefits.", "Break generated crystals and use Wicked Implement to extend slow and Frost Armor control."], strengths: ["Excellent area denial", "Strong turret coverage", "Safe ranged play"], weaknesses: ["Grenade energy is committed to turret uptime", "Damage is gradual rather than burst-oriented"] },
  { id: "warlock-strand-necrotic", baseId: "warlock-strand-mataiodoxia", name: "Necrotic Broodweaver", exoticArmor: "Necrotic Grip", exoticWeapon: "Osteo Striga", summary: "Poison spreads through crowded rooms while Arcane Needle adds unravel and Strand energy to the weapon-led loop.", role: "Poison spread and Strand add clear", gameplayLoop: ["Apply poison with Osteo Striga or a powered melee.", "Let chained poison defeats soften the next group.", "Use Arcane Needle and Tangles to add unravel before Needlestorm or heavy damage."], strengths: ["Excellent spreading damage", "Strong weapon-led clear", "Safe ranged melee access"], weaknesses: ["Poison takes time to spread", "Less direct suspension than Mataiodoxia"] },
  { id: "warlock-prismatic-solipsism", baseId: "warlock-prismatic-buddies", name: "Solipsism Flex Warlock", exoticArmor: "Solipsism", exoticWeapon: "Khvostov 7G-0X", summary: "The Exotic class item supports a flexible Prismatic engine whose exact strengths follow its verified spirit roll.", role: "Flexible Prismatic ability play", gameplayLoop: ["Inspect the owned Solipsism pairing before choosing which ability to emphasize.", "Alternate Light and Dark damage to charge Transcendence.", "Use Khvostov and Orbs as the dependable center while the spirit effects add specialization."], strengths: ["Highly adaptable", "Can combine two Exotic spirit effects", "Strong general-play foundation"], weaknesses: ["Power depends on the physical spirit roll", "Unknown perk data remains unknown rather than assumed"] }
  ,{ id: "hunter-void-graviton-forfeit", baseId: "hunter-void-gyrfalcon", name: "Graviton Vanishing Hunter", exoticArmor: "Graviton Forfeit", exoticWeapon: "Graviton Lance", summary: "Longer invisibility and faster recovery create a forgiving solo Nightstalker path for repositioning, revives, and safe weapon pressure.", role: "Solo invisibility and recovery", gameplayLoop: ["Enter invisibility before crossing exposed ground or starting a revive.", "Use the extended invisible window to recover melee and class ability energy.", "Break invisibility with Graviton Lance from a safe angle, then repeat the Void loop."], strengths: ["Forgiving invisibility duration", "Strong solo recovery", "Safe ranged play"], weaknesses: ["Lower team utility than Omnioculus", "Less weapon amplification than Gyrfalcon"] },
  { id: "hunter-arc-lucky-raspberry", baseId: "hunter-arc-liars", name: "Lucky Raspberry Arcbolt Hunter", exoticArmor: "Lucky Raspberry", exoticWeapon: "Riskrunner", summary: "Arcbolt chains and jolt provide an ability-led Arc option that clears safely without committing to point-blank Combination Blow loops.", role: "Arc grenade chaining and add clear", gameplayLoop: ["Throw Arcbolt Grenade into grouped targets to start the chain.", "Use jolted defeats and Ionic Traces to rebuild the grenade.", "Let Riskrunner cover the space between grenade cycles and protect against incoming Arc damage."], strengths: ["Strong ranged Arc clear", "Simple grenade loop", "Does not require melee range"], weaknesses: ["Best returns need clustered targets", "Lower boss burst than Gathering Storm-focused paths"] },
  { id: "hunter-solar-shards", baseId: "hunter-solar-nighthawk", name: "Shards Blade Barrage Hunter", exoticArmor: "Shards of Galanor", exoticWeapon: "Sunshot", summary: "Blade Barrage hits refund Super energy while Solar weapon explosions keep scorch, ignitions, and add clear moving between casts.", role: "Repeatable Solar Super burst", gameplayLoop: ["Use Sunshot and Solar abilities to clear waves and create Orbs.", "Cast Blade Barrage into a dense wave or priority target where every knife can connect.", "Use the refunded Super energy and Orbs to shorten the next rotation."], strengths: ["Frequent one-and-done Supers", "Strong Solar add clear", "Easy damage rotation"], weaknesses: ["Refund depends on Blade Barrage hits", "Lower single-shot precision damage than Celestial Nighthawk"] },
  { id: "hunter-stasis-frostees", baseId: "hunter-stasis-renewal", name: "Frostees Shatter Hunter", exoticArmor: "Fr0st-EE5", exoticWeapon: "Wicked Implement", summary: "Sprint-driven cooldown recovery keeps Duskfields, shurikens, and dodges available for a mobile freeze-and-shatter loop.", role: "Mobile Stasis ability cycling", gameplayLoop: ["Slow and freeze a lane with Duskfield and Withering Blade.", "Sprint while repositioning to accelerate the next ability cycle.", "Use Wicked Implement to extend slow at range before shattering the group."], strengths: ["Improves the whole ability kit", "Excellent mobility", "Flexible neutral game"], weaknesses: ["Requires movement between engagements", "Less direct protection than Renewal Grasps"] },
  { id: "hunter-strand-balance", baseId: "hunter-strand-cyrtarachne", name: "Balance of Power Threadrunner", exoticArmor: "Balance of Power", exoticWeapon: "Quicksilver Storm", summary: "Improved Threaded Specters create a decoy-led Strand route for controlling attention while Quicksilver supplies ranged damage and Tangles.", role: "Threaded Specter deception and control", gameplayLoop: ["Dodge near a threatened lane to deploy an improved Threaded Specter.", "Attack from another angle while enemies commit to the decoy.", "Use Quicksilver Storm and Tangles to unravel and clear the distracted group."], strengths: ["Excellent enemy distraction", "Safe repositioning", "Strong Strand weapon pairing"], weaknesses: ["Relies on enemy attention behavior", "Loses Cyrtarachne's immediate Woven Mail"] },
  { id: "hunter-prismatic-sealed", baseId: "hunter-prismatic-liars", name: "Sealed Surge Hunter", exoticArmor: "Sealed Ahamkara Grasps", exoticWeapon: "Khvostov 7G-0X", summary: "Powered melee hits feed a weapon-damage loop that keeps Prismatic flexible instead of tying the entire build to Cross Counter.", role: "Melee-triggered weapon pressure", gameplayLoop: ["Apply a powered melee to activate the weapon-focused Exotic loop.", "Use Khvostov and ricochets during the damage window.", "Alternate Light and Dark abilities toward Transcendence, then refresh the melee trigger."], strengths: ["Weapon-led Prismatic damage", "Flexible melee choices", "Good general play"], weaknesses: ["Requires melee contact to start peak output", "Less direct survivability than Liar's Handshake"] },
  { id: "titan-arc-inmost", baseId: "titan-arc-cuirass", name: "Inmost Arc Engine Titan", exoticArmor: "Heart of Inmost Light", exoticWeapon: "Thunderlord", summary: "Empowered ability cycling turns barricade, grenade, and Thunderclap into a balanced Arc engine instead of reserving the Exotic for Super damage.", role: "Broad Arc ability uptime", gameplayLoop: ["Cast barricade or Thruster to empower the next grenade and melee.", "Rotate the empowered abilities rather than repeating the same input.", "Use Thunderlord and Ionic Traces while the rotation rebuilds."], strengths: ["Improves every neutral ability", "Flexible engagement range", "Reliable general play"], weaknesses: ["Requires deliberate ability ordering", "Lower Thundercrash burst than Cuirass"] },
  { id: "titan-void-no-backup", baseId: "titan-void-doom-fang", name: "No Backup Bulwark Titan", exoticArmor: "No Backup Plans", exoticWeapon: "Graviton Lance", summary: "Void overshields and close-range weapon pressure create a durable Sentinel route for holding aggressive lanes.", role: "Void overshield frontline", gameplayLoop: ["Establish a Void overshield before entering close range.", "Use close-range weapon defeats to sustain the Exotic's defensive loop.", "Fall back to Graviton Lance when the lane is unsafe, then re-enter behind a fresh overshield."], strengths: ["Strong frontline durability", "Reliable overshield access", "Good close-range pressure"], weaknesses: ["Best output requires close range", "Less Super uptime than Doom Fang"] },
  { id: "titan-solar-synthoceps", baseId: "titan-solar-hallowfire", name: "Synthoceps Consecration Titan", exoticArmor: "Synthoceps", exoticWeapon: "Sunshot", summary: "Enhanced close-range damage turns Consecration and Solar melee attacks into a direct ignition route backed by Sunshot clear.", role: "Solar melee and ignition burst", gameplayLoop: ["Use Sunshot to soften and group a wave.", "Slide into Consecration when nearby enemies activate the close-range damage advantage.", "Create Sunspots and Orbs, then recover before the next melee commitment."], strengths: ["High Consecration damage", "Excellent ignition clear", "Strong aggressive loop"], weaknesses: ["Requires dangerous engagement range", "Less passive cooldown help than Hallowfire Heart"] },
  { id: "titan-stasis-stronghold", baseId: "titan-stasis-icefall", name: "Stronghold Glacier Titan", exoticArmor: "Stronghold", exoticWeapon: "The Lament", summary: "Sword guarding and Stasis control create a durable close-range Behemoth that can safely advance through frozen lanes.", role: "Defensive sword frontline", gameplayLoop: ["Freeze or block a lane with Stasis crystals before advancing.", "Guard with The Lament to absorb pressure and stabilize the approach.", "Counterattack into frozen targets, then retreat behind newly created crystals."], strengths: ["Exceptional sword durability", "Strong close-range sustain", "Stasis creates safe approaches"], weaknesses: ["Ammo-dependent", "Cannot solve distant threats quickly"] },
  { id: "titan-strand-inmost", baseId: "titan-strand-synthoceps", name: "Inmost Berserker Engine", exoticArmor: "Heart of Inmost Light", exoticWeapon: "Quicksilver Storm", summary: "Barricade, grapple, and Frenzied Blade empower one another for a Strand route that values uptime over maximum melee burst.", role: "Strand ability cycling and Tangles", gameplayLoop: ["Use barricade to empower grapple and Frenzied Blade.", "Rotate through empowered abilities to create Tangles and sever pressure.", "Use Quicksilver Storm between cycles and detonate Tangles from safety."], strengths: ["Balanced ability uptime", "Flexible at range or close quarters", "Frequent Strand interactions"], weaknesses: ["Lower peak melee damage than Synthoceps", "Requires disciplined rotation"] },
  { id: "titan-prismatic-cuirass", baseId: "titan-prismatic-consecration", name: "Cuirass Thundercrash Titan", exoticArmor: "Cuirass of the Falling Star", exoticWeapon: "Grand Overture", summary: "Thundercrash burst and Grand Overture missiles provide a boss-focused Prismatic alternative to repeated Consecration slams.", role: "Prismatic boss burst", gameplayLoop: ["Build Grand Overture missiles and Light/Dark energy during neutral play.", "Enter Transcendence to clear the approach and prepare the damage window.", "Commit Thundercrash and the loaded missile volley to the priority target."], strengths: ["Strong boss burst", "Simple damage window", "Useful ranged heavy setup"], weaknesses: ["Exotic value concentrates in Thundercrash", "Requires safe return after Super impact"] },
  { id: "warlock-void-nothing-manacles", baseId: "warlock-void-contraverse", name: "Nothing Manacles Voidlock", exoticArmor: "Nothing Manacles", exoticWeapon: "Graviton Lance", summary: "Two improved Scatter Grenades provide immediate Void burst and flexible Devour triggers without charging a Vortex grenade.", role: "Void grenade burst and Devour", gameplayLoop: ["Throw Scatter Grenade into a priority group to start Devour.", "Use Graviton Lance while the first charge recovers.", "Spend the second grenade when Devour needs refreshing or a new wave arrives."], strengths: ["Two grenade charges", "Fast grenade delivery", "Easy Devour activation"], weaknesses: ["Less sustained area control than Vortex grenades", "Poor throws can waste Scatter projectiles"] },
  { id: "warlock-arc-crown", baseId: "warlock-arc-stormdancer", name: "Crown Conduction Warlock", exoticArmor: "Crown of Tempests", exoticWeapon: "Riskrunner", summary: "Arc ability and jolt defeats extend a broad conduction loop for frequent grenades, melee, Rift, and Stormtrance.", role: "Arc ability chaining", gameplayLoop: ["Start Conduction Tines with an Arc ability or jolt defeat.", "Spend the accelerated abilities before the stacks expire.", "Use Riskrunner against dense Arc pressure and carry the chain into Stormtrance."], strengths: ["Broad ability acceleration", "Long Stormtrance uptime", "Excellent dense-wave clear"], weaknesses: ["Needs continuous Arc defeats", "Loses value against isolated bosses"] },
  { id: "warlock-solar-sunbracers", baseId: "warlock-solar-battle-harmony", name: "Sunbracers Solar Grenadier", exoticArmor: "Sunbracers", exoticWeapon: "Dragon's Breath", summary: "Powered melee defeats open a short window of rapid Solar grenades for ignitions, area denial, and strong solo damage.", role: "Solar grenade spam and ignitions", gameplayLoop: ["Secure a powered melee defeat to activate Sunbracers.", "Spread Solar grenades across the wave or stack them around a durable target.", "Use Dragon's Breath while scorch and ignitions recover the next opening."], strengths: ["Extremely high grenade output", "Strong area denial", "Excellent solo damage"], weaknesses: ["Requires a melee final blow", "Grenade placement is execution-sensitive"] },
  { id: "warlock-stasis-ballidorse", baseId: "warlock-stasis-frostpulse", name: "Ballidorse Frostpulse Warlock", exoticArmor: "Ballidorse Wrathweavers", exoticWeapon: "Ager's Scepter", summary: "Frostpulse and Winter's Wrath become a close-control support package with Stasis weapon pressure and team protection.", role: "Stasis Super support and freeze control", gameplayLoop: ["Freeze nearby pressure with Frostpulse before it reaches the team.", "Use Ager's Scepter to extend freeze and shatter chains at range.", "Cast Winter's Wrath for dangerous waves and use its enhanced pulses deliberately."], strengths: ["Strong panic control", "Team-oriented Stasis support", "Powerful roaming freeze"], weaknesses: ["Requires close Rift placement for Frostpulse", "Less turret uptime than Osmiomancy"] },
  { id: "warlock-strand-verity", baseId: "warlock-strand-mataiodoxia", name: "Verity Threadling Warlock", exoticArmor: "Verity's Brow", exoticWeapon: "Final Warning", summary: "Matching Strand weapon defeats empower grenade damage and recovery for a Threadling-led Broodweaver loop.", role: "Strand grenade damage and Threadlings", gameplayLoop: ["Build Death Throes with Final Warning defeats.", "Spend the empowered grenade on a dense wave or priority target.", "Use Threadlings and Tangles to maintain pressure while rebuilding stacks."], strengths: ["High grenade damage", "Strong matching-weapon loop", "Useful team grenade recovery"], weaknesses: ["Requires Strand weapon defeats", "Stacks can fall off between sparse waves"] },
  { id: "warlock-prismatic-mataiodoxia", baseId: "warlock-prismatic-buddies", name: "Mataiodoxia Prismatic Weaver", exoticArmor: "Mataiodoxia", exoticWeapon: "Khvostov 7G-0X", summary: "Arcane Needle and suspend create a control-first Prismatic route with Devour sustain and straightforward Transcendence generation.", role: "Prismatic suspend and champion control", gameplayLoop: ["Use Arcane Needle charges to unravel and suspend priority targets through the Exotic loop.", "Trigger Devour and use Khvostov to clear the controlled group.", "Alternate remaining Light and Dark abilities into Transcendence before rebuilding melee charges."], strengths: ["Strong ranged control", "Multiple melee charges", "Good champion utility"], weaknesses: ["Depends on melee charge management", "Lower autonomous damage than Getaway Artist"] }
];

const ALTERNATE_EXOTIC_WEAPON_PROFILES: Record<string, Pick<BuildAdvisorWeaponRequirement, "slots" | "damageTypes" | "archetypes">> = {
  "Le Monarque": { slots: ["Energy Weapons"], damageTypes: ["Void"], archetypes: ["Bow"] },
  Thunderlord: { slots: ["Power Weapons"], damageTypes: ["Arc"], archetypes: ["Machine Gun"] },
  "Verglas Curve": { slots: ["Kinetic Weapons"], damageTypes: ["Stasis"], archetypes: ["Bow"] },
  "Final Warning": { slots: ["Kinetic Weapons"], damageTypes: ["Strand"], archetypes: ["Sidearm"] },
  "Khvostov 7G-0X": { slots: ["Kinetic Weapons"], damageTypes: ["Kinetic"], archetypes: ["Auto Rifle"] },
  "Deterministic Chaos": { slots: ["Power Weapons"], damageTypes: ["Void"], archetypes: ["Machine Gun"] },
  "Graviton Lance": { slots: ["Energy Weapons"], damageTypes: ["Void"], archetypes: ["Pulse Rifle"] },
  "Polaris Lance": { slots: ["Energy Weapons"], damageTypes: ["Solar"], archetypes: ["Scout Rifle"] },
  "Ice Breaker": { slots: ["Energy Weapons"], damageTypes: ["Solar"], archetypes: ["Sniper Rifle"] },
  "Grand Overture": { slots: ["Power Weapons"], damageTypes: ["Arc"], archetypes: ["Machine Gun"] },
  Riskrunner: { slots: ["Energy Weapons"], damageTypes: ["Arc"], archetypes: ["Submachine Gun"] },
  Lumina: { slots: ["Kinetic Weapons"], damageTypes: ["Kinetic"], archetypes: ["Hand Cannon"] },
  "Collective Obligation": { slots: ["Energy Weapons"], damageTypes: ["Void"], archetypes: ["Pulse Rifle"] },
  Sunshot: { slots: ["Energy Weapons"], damageTypes: ["Solar"], archetypes: ["Hand Cannon"] },
  "Wicked Implement": { slots: ["Kinetic Weapons"], damageTypes: ["Stasis"], archetypes: ["Scout Rifle"] },
  "Ex Diris": { slots: ["Energy Weapons"], damageTypes: ["Arc"], archetypes: ["Grenade Launcher"] },
  Centrifuse: { slots: ["Energy Weapons"], damageTypes: ["Arc"], archetypes: ["Auto Rifle"] },
  "Quicksilver Storm": { slots: ["Kinetic Weapons"], damageTypes: ["Strand"], archetypes: ["Auto Rifle"] },
  "Delicate Tomb": { slots: ["Energy Weapons"], damageTypes: ["Arc"], archetypes: ["Fusion Rifle"] },
  "Dragon's Breath": { slots: ["Power Weapons"], damageTypes: ["Solar"], archetypes: ["Rocket Launcher"] },
  "Osteo Striga": { slots: ["Kinetic Weapons"], damageTypes: ["Kinetic"], archetypes: ["Submachine Gun"] }
  ,"The Lament": { slots: ["Power Weapons"], damageTypes: ["Solar"], archetypes: ["Sword"] },
  "Ager's Scepter": { slots: ["Kinetic Weapons"], damageTypes: ["Stasis"], archetypes: ["Trace Rifle"] }
};

function alternateTemplate(definition: AlternateBuildDefinition): BuildAdvisorTemplate {
  const base = BUILD_ADVISOR_LIBRARY_TEMPLATES.find((entry) => entry.id === definition.baseId);
  if (!base) throw new Error(`Unknown Build Advisor base template ${definition.baseId}.`);
  const exoticProfile = ALTERNATE_EXOTIC_WEAPON_PROFILES[definition.exoticWeapon];
  if (!exoticProfile) throw new Error(`Missing weapon profile for alternate Exotic ${definition.exoticWeapon}.`);
  return {
    ...base,
    id: definition.id,
    version: 1,
    reviewedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT,
    release: BUILD_ADVISOR_CURRENT_SANDBOX,
    sourceNotes: `Guardian Nexus alternate-role review derived from ${base.name}; recheck the core Exotic and subclass after sandbox changes.`,
    verification: BUILD_ADVISOR_CURATED_VERIFICATION,
    name: definition.name,
    summary: definition.summary,
    requiredExoticArmor: definition.exoticArmor,
    preferredExoticWeapon: definition.exoticWeapon,
    weapons: base.weapons.map((requirement) => requirement.requiresExotic ? { ...requirement, ...exoticProfile, preferredNames: [definition.exoticWeapon] } : { ...requirement }),
    gameplayLoop: definition.gameplayLoop,
    strengths: definition.strengths,
    weaknesses: definition.weaknesses,
    style: definition.summary,
    role: definition.role,
    upgrades: [definition.exoticArmor, `${definition.exoticWeapon} and its catalyst when available`, ...base.upgrades.slice(0, 1)]
  };
}

export const BUILD_ADVISOR_TEMPLATES: BuildAdvisorTemplate[] = [
  ...BUILD_ADVISOR_LIBRARY_TEMPLATES,
  ...ALTERNATE_BUILD_DEFINITIONS.map(alternateTemplate)
];

export function named(value: string, required = false): BuildNamedEntry {
  return { name: value, ...(required ? { required: true } : {}) };
}
