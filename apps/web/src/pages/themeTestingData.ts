import type { NotificationCategory } from "@guardian-nexus/contracts";

export type ThemeOptionNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface ThemeOption {
  number: ThemeOptionNumber;
  name: string;
  description: string;
}

export interface NotificationThemeDefinition {
  id: NotificationCategory;
  motif: string;
  designIntent: string;
}

export interface FireteamThemeDefinition {
  id: string;
  label: string;
  motif: string;
  primary: string;
  secondary: string;
  deep: string;
  glow: string;
  designIntent: string;
}

export const notificationThemeOptions: ThemeOption[] = [
  { number: 1, name: "Threshold Reveal", description: "A strong left-side landmark opens and resolves across the banner." },
  { number: 2, name: "Center Event", description: "The category symbol forms at center, expands once, then settles." },
  { number: 3, name: "Twin Signal", description: "Two unequal signals answer one another without mirrored geometry." },
  { number: 4, name: "Horizon Breach", description: "A wide spatial event cuts across the banner with controlled depth." },
  { number: 5, name: "Monument Rise", description: "A vertical category landmark rises behind the notification copy." },
  { number: 6, name: "Orbital Pass", description: "A curved or rotating category element crosses the field once." },
  { number: 7, name: "Fragment Assembly", description: "Separated pieces converge into one readable category mark." },
  { number: 8, name: "Quiet Prestige", description: "Minimal, slow movement with one premium signature detail." }
];

export const fireteamThemeOptions: ThemeOption[] = [
  { number: 1, name: "Left Landmark", description: "A dominant left landmark with a sparse right-side navigation trace." },
  { number: 2, name: "Right Landmark", description: "A heavier right destination feature balanced by a narrow left signal." },
  { number: 3, name: "Staggered Rails", description: "Different top and bottom rail segments that never mirror one another." },
  { number: 4, name: "Broken Segments", description: "Interrupted destination structures with irregular spacing and scale." },
  { number: 5, name: "Opposed Corners", description: "A top-left artifact and lower-right counterweight frame the content." },
  { number: 6, name: "Curved Passage", description: "One curved environmental passage with a separate linear edge response." },
  { number: 7, name: "Artifact Clusters", description: "Uneven clusters of destination objects gathered around key cards." },
  { number: 8, name: "Minimal Frame", description: "Thin premium rails and one destination-specific card signature." }
];

export const notificationThemeDefinitions: NotificationThemeDefinition[] = [
  { id: "distortion", motif: "fracture", designIntent: "Spatial tearing, displaced layers, and restrained red corruption." },
  { id: "crucible", motif: "cross", designIntent: "Decisive combat strikes and crossed Crucible geometry." },
  { id: "trials", motif: "eye", designIntent: "Lighthouse radiance, an eye silhouette, and controlled gold ceremony." },
  { id: "iron-banner", motif: "heraldry", designIntent: "Heavy cloth, heraldic framing, and an Iron Lord crest reveal." },
  { id: "gambit", motif: "coil", designIntent: "A coiling serpent path and motes moving toward a bank." },
  { id: "vanguard", motif: "chevron", designIntent: "Command chevrons, disciplined formation, and a blue tactical pulse." },
  { id: "exotic", motif: "engram", designIntent: "A gold Exotic engram decrypting through geometric layers." },
  { id: "legendary", motif: "prism", designIntent: "A faceted purple prism assembling from distinct planes." },
  { id: "seasonal", motif: "dial", designIntent: "A seasonal mechanism, rotating dial, and time-marker movement." },
  { id: "eververse", motif: "crystal", designIntent: "Bright Engram refraction with clean crystalline motion." },
  { id: "bungie-news", motif: "transmission", designIntent: "A received transmission, scan field, and Director-style data card." },
  { id: "completion", motif: "wreath", designIntent: "A completion wreath and checkmark resolving with one celebratory pulse." },
  { id: "warning", motif: "hazard", designIntent: "Readable hazard bands and a scanner without strobing." },
  { id: "outage", motif: "signal", designIntent: "A broken service signal with displaced blocks and limited jitter." },
  { id: "redemption-code", motif: "terminal", designIntent: "A terminal frame decrypting a reward token into place." },
  { id: "system", motif: "planet", designIntent: "A compact Director world-state orbit with planetary depth." }
];

export const fireteamThemeDefinitions: FireteamThemeDefinition[] = [
  { id: "europa", label: "Europa", motif: "shard", primary: "#9cecff", secondary: "#f4ffff", deep: "#102b35", glow: "rgba(116,217,240,.42)", designIntent: "Irregular ice shards, hard glints, and deep frozen fractures." },
  { id: "tower", label: "Tower / H.E.L.M.", motif: "ceremony", primary: "#f6d77a", secondary: "#fffbe8", deep: "#3f3216", glow: "rgba(227,188,89,.38)", designIntent: "Traveler-white ceremony, gold wayfinding, and clean City geometry." },
  { id: "moon", label: "Moon", motif: "scarlet-ring", primary: "#c9503c", secondary: "#e18a70", deep: "#3b1714", glow: "rgba(143,51,43,.42)", designIntent: "Scarlet Keep cuts, Hellmouth rings, and lunar dust breaks." },
  { id: "dreaming", label: "Dreaming City", motif: "awoken", primary: "#8edbe5", secondary: "#d8c5ff", deep: "#261c43", glow: "rgba(139,111,201,.48)", designIntent: "Awoken arches, amethyst refraction, and pale cyan planes." },
  { id: "neomuna", label: "Neomuna", motif: "neon", primary: "#58f1f2", secondary: "#f05bcf", deep: "#151335", glow: "rgba(55,220,228,.5)", designIntent: "CloudArk grids, offset neon signage, and asymmetric city circuitry." },
  { id: "nessus", label: "Nessus", motif: "vex", primary: "#e25b43", secondary: "#f0a178", deep: "#34191a", glow: "rgba(191,73,59,.44)", designIntent: "Vex angles, radiolarian channels, and red canopy fragments." },
  { id: "edz", label: "EDZ", motif: "foliage", primary: "#7ca257", secondary: "#b7cf91", deep: "#1e2d17", glow: "rgba(98,134,66,.42)", designIntent: "Moss, leaves, and broken Golden Age structure with natural spacing." },
  { id: "cosmodrome", label: "Cosmodrome", motif: "industrial", primary: "#b8734d", secondary: "#e7d4c0", deep: "#342319", glow: "rgba(135,81,54,.44)", designIntent: "Rusted gantries, launch structures, and pale contrail cuts." },
  { id: "throne-world", label: "Throne World", motif: "bone", primary: "#7fa65c", secondary: "#cfe7b7", deep: "#1d2b15", glow: "rgba(97,131,66,.46)", designIntent: "Bone spires, swamp light, and ornate Hive growth." },
  { id: "pale-heart", label: "Pale Heart", motif: "traveler-prism", primary: "#8de2de", secondary: "#e6d3ff", deep: "#26243b", glow: "rgba(202,170,242,.5)", designIntent: "Traveler facets, prismatic seams, and impossible clean geometry." },
  { id: "mars", label: "Mars", motif: "dune", primary: "#d66d3b", secondary: "#edb17e", deep: "#3d2117", glow: "rgba(173,79,46,.46)", designIntent: "Ochre dunes, Braytech bands, and heat-distorted structure." },
  { id: "kepler", label: "Kepler", motif: "gravity", primary: "#8068ed", secondary: "#b9adff", deep: "#17112f", glow: "rgba(89,69,198,.54)", designIntent: "Gravitational lenses, unstable arcs, and dark violet wells." },
  { id: "dreadnaught", label: "Dreadnaught", motif: "hive-rib", primary: "#7da553", secondary: "#bad28f", deep: "#1c2815", glow: "rgba(86,117,56,.48)", designIntent: "Hive ribs, soul-fire vents, and heavy organic architecture." },
  { id: "eternity", label: "Eternity", motif: "star-plane", primary: "#967fd6", secondary: "#bcd9ff", deep: "#17182e", glow: "rgba(110,97,166,.46)", designIntent: "Sparse star clusters and impossible angular planes with large negative space." },
  { id: "orbit", label: "Orbit", motif: "planet", primary: "#77a6d1", secondary: "#b9d8f1", deep: "#07111f", glow: "rgba(82,121,166,.48)", designIntent: "A planetary limb, atmospheric edge, and irregular deep-space stars." },
  { id: "destination", label: "Generic Destination", motif: "waypoint", primary: "#65cfdf", secondary: "#b8e9ef", deep: "#10252a", glow: "rgba(74,169,185,.42)", designIntent: "A neutral Director waypoint and restrained navigation geometry." }
];
