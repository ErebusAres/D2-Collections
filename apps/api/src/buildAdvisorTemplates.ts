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

export const BUILD_ADVISOR_TEMPLATE_SET_VERSION = 1;
export const BUILD_ADVISOR_TEMPLATE_REVIEWED_AT = "2026-07-26";

const sharedMods = {
  helmet: ["Harmonic Siphon", "Heavy Ammo Finder"],
  chest: ["Concussive Dampener"],
  legs: ["Recuperation", "Weapon Surge"],
  classItem: ["Reaper", "Time Dilation"]
} satisfies BuildAdvisorTemplate["armorMods"];

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
    weapons: [
      { id: "void-primary", label: "Void primary", slots: ["Energy Weapons"], damageTypes: ["Void"], archetypes: ["Pulse Rifle", "Auto Rifle", "Submachine Gun", "Hand Cannon", "Combat Bow"], preferredNames: ["Graviton Lance"], preferredPerks: ["Repulsor Brace", "Destabilizing Rounds"], acceptablePerks: ["Frenzy", "One for All", "Golden Tricorn"] },
      { id: "damage-heavy", label: "Boss-capable heavy", slots: ["Power Weapons"], archetypes: ["Rocket Launcher", "Grenade Launcher", "Linear Fusion Rifle", "Machine Gun"], preferredPerks: ["Bait and Switch", "Explosive Light", "Envious Arsenal"], acceptablePerks: ["Vorpal Weapon", "Firing Line", "Frenzy"] }
    ],
    abilities: { super: "Shadowshot: Deadfall", classAbility: "Gambler's Dodge", movement: "Triple Jump", melee: "Snare Bomb", grenade: "Vortex Grenade", aspects: ["Vanishing Step", "Stylish Executioner"], fragments: ["Echo of Starvation", "Echo of Persistence", "Echo of Cessation", "Echo of Obscurity"] },
    armorMods: { ...sharedMods, arms: ["Firepower", "Bolstering Detonation"] },
    statPriorities: [{ stat: "Class", priority: 1, target: 100 }, { stat: "Health", priority: 2, target: 100 }, { stat: "Grenade", priority: 3, target: 70 }, { stat: "Weapons", priority: 4 }],
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
    weapons: [
      { id: "melee-special", label: "Melee-synergy special", archetypes: ["Shotgun"], requiredPerks: ["One-Two Punch"], acceptablePerks: ["Trench Barrel", "Pugilist"] },
      { id: "damage-heavy", label: "Reliable heavy", slots: ["Power Weapons"], archetypes: ["Rocket Launcher", "Grenade Launcher", "Sword", "Machine Gun"], preferredPerks: ["Bait and Switch", "Explosive Light", "Surrounded"], acceptablePerks: ["Vorpal Weapon", "Frenzy", "Whirlwind Blade"] }
    ],
    abilities: { super: "Gathering Storm", classAbility: "Gambler's Dodge", movement: "Triple Jump", melee: "Combination Blow", grenade: "Pulse Grenade", aspects: ["Flow State", "Lethal Current"], fragments: ["Spark of Resistance", "Spark of Feedback", "Spark of Ions", "Spark of Amplitude"] },
    armorMods: { ...sharedMods, arms: ["Heavy Handed", "Impact Induction"] },
    statPriorities: [{ stat: "Health", priority: 1, target: 100 }, { stat: "Class", priority: 2, target: 100 }, { stat: "Melee", priority: 3, target: 70 }, { stat: "Weapons", priority: 4 }],
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
    preferredExoticWeapon: "Sunshot",
    weapons: [
      { id: "solar-primary", label: "Solar primary", slots: ["Energy Weapons"], damageTypes: ["Solar"], archetypes: ["Hand Cannon", "Pulse Rifle", "Auto Rifle", "Submachine Gun", "Scout Rifle"], preferredNames: ["Sunshot"], preferredPerks: ["Incandescent"], acceptablePerks: ["Frenzy", "One for All", "Golden Tricorn"] },
      { id: "boss-heavy", label: "Boss-damage heavy", slots: ["Power Weapons"], archetypes: ["Rocket Launcher", "Grenade Launcher", "Linear Fusion Rifle"], preferredPerks: ["Bait and Switch", "Explosive Light", "Envious Arsenal"], acceptablePerks: ["Vorpal Weapon", "Firing Line", "Frenzy"] }
    ],
    abilities: { super: "Golden Gun: Marksman", classAbility: "Gambler's Dodge", movement: "Triple Jump", melee: "Knife Trick", grenade: "Healing Grenade", aspects: ["Knock 'Em Down", "On Your Mark"], fragments: ["Ember of Torches", "Ember of Solace", "Ember of Empyrean", "Ember of Searing"] },
    armorMods: { ...sharedMods, arms: ["Focusing Strike", "Heavy Handed"] },
    statPriorities: [{ stat: "Super", priority: 1, target: 100 }, { stat: "Weapons", priority: 2, target: 100 }, { stat: "Health", priority: 3, target: 100 }, { stat: "Class", priority: 4 }],
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
    weapons: [
      { id: "arc-primary", label: "Arc primary", damageTypes: ["Arc"], archetypes: ["Pulse Rifle", "Auto Rifle", "Submachine Gun", "Hand Cannon"], preferredPerks: ["Voltshot"], acceptablePerks: ["Frenzy", "One for All"] },
      { id: "boss-heavy", label: "Boss-damage heavy", slots: ["Power Weapons"], archetypes: ["Rocket Launcher", "Grenade Launcher", "Linear Fusion Rifle"], preferredPerks: ["Bait and Switch", "Explosive Light"], acceptablePerks: ["Vorpal Weapon", "Firing Line"] }
    ],
    abilities: { super: "Thundercrash", classAbility: "Thruster", movement: "Strafe Lift", melee: "Thunderclap", grenade: "Pulse Grenade", aspects: ["Knockout", "Touch of Thunder"], fragments: ["Spark of Resistance", "Spark of Shock", "Spark of Ions", "Spark of Magnitude"] },
    armorMods: { ...sharedMods, arms: ["Firepower", "Impact Induction"] },
    statPriorities: [{ stat: "Super", priority: 1, target: 100 }, { stat: "Health", priority: 2, target: 100 }, { stat: "Grenade", priority: 3, target: 80 }],
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
    weapons: [
      { id: "melee-special", label: "Close-range special", archetypes: ["Shotgun", "Glaive"], preferredPerks: ["One-Two Punch", "Close to Melee"], acceptablePerks: ["Trench Barrel", "Pugilist"] },
      { id: "damage-heavy", label: "Reliable heavy", slots: ["Power Weapons"], archetypes: ["Sword", "Rocket Launcher", "Grenade Launcher"], preferredPerks: ["Surrounded", "Bait and Switch", "Whirlwind Blade"], acceptablePerks: ["Frenzy", "Vorpal Weapon"] }
    ],
    abilities: { super: "Bladefury", classAbility: "Rally Barricade", movement: "Catapult Lift", melee: "Frenzied Blade", grenade: "Grapple", aspects: ["Banner of War", "Into the Fray"], fragments: ["Thread of Warding", "Thread of Fury", "Thread of Generation", "Thread of Transmutation"] },
    armorMods: { ...sharedMods, arms: ["Heavy Handed", "Impact Induction"] },
    statPriorities: [{ stat: "Health", priority: 1, target: 100 }, { stat: "Melee", priority: 2, target: 100 }, { stat: "Class", priority: 3, target: 70 }],
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
    weapons: [
      { id: "void-primary", label: "Void primary", damageTypes: ["Void"], archetypes: ["Pulse Rifle", "Auto Rifle", "Submachine Gun", "Hand Cannon"], preferredNames: ["Graviton Lance"], preferredPerks: ["Repulsor Brace", "Destabilizing Rounds"], acceptablePerks: ["Frenzy", "One for All"] },
      { id: "damage-heavy", label: "Reliable heavy", slots: ["Power Weapons"], archetypes: ["Rocket Launcher", "Grenade Launcher", "Machine Gun"], preferredPerks: ["Bait and Switch", "Explosive Light"], acceptablePerks: ["Vorpal Weapon", "Frenzy"] }
    ],
    abilities: { super: "Nova Bomb: Cataclysm", classAbility: "Healing Rift", movement: "Burst Glide", melee: "Pocket Singularity", grenade: "Vortex Grenade", aspects: ["Chaos Accelerant", "Feed the Void"], fragments: ["Echo of Remnants", "Echo of Undermining", "Echo of Persistence", "Echo of Harvest"] },
    armorMods: { ...sharedMods, arms: ["Firepower", "Bolstering Detonation"] },
    statPriorities: [{ stat: "Grenade", priority: 1, target: 100 }, { stat: "Health", priority: 2, target: 100 }, { stat: "Class", priority: 3, target: 70 }],
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
