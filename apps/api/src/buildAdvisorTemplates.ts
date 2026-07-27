import type {
  BuildAdvisorArtifactDependency,
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

export const BUILD_ADVISOR_TEMPLATE_SET_VERSION = 2;
export const BUILD_ADVISOR_TEMPLATE_REVIEWED_AT = "2026-07-26";

const sharedMods = {
  helmet: ["Harmonic Siphon", "Heavy Ammo Finder", "Heavy Ammo Scout"],
  chest: ["Concussive Dampener", "Harmonic Resistance", "Melee Damage Resistance"],
  legs: ["Recuperation", "Innervation", "Invigoration"],
  classItem: ["Reaper", "Powerful Attraction", "Time Dilation"]
} satisfies BuildAdvisorTemplate["armorMods"];

function stats(...entries: Array<[BuildStatName, number, string]>): BuildAdvisorTemplate["statPriorities"] {
  return entries.map(([stat, target, notes], index) => ({ stat, priority: index + 1, target, notes }));
}

export const BUILD_ADVISOR_TEMPLATES: BuildAdvisorTemplate[] = [
  {
    id: "hunter-void-gyrfalcon",
    version: 1,
    reviewedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT,
    release: "Monument of Triumph",
    sourceNotes: "Curated Guardian Nexus test template. Recheck after Void, Gyrfalcon, or Artifact sandbox changes.",
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
    sourceNotes: "Curated melee test template. Recheck Combination Blow and Liar's Handshake tuning after sandbox patches.",
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
  }
];

export function named(value: string, required = false): BuildNamedEntry {
  return { name: value, ...(required ? { required: true } : {}) };
}
