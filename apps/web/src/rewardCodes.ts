export type RewardCodeKind = "Emblem" | "Shader" | "Emote" | "Transmat" | "Ornament" | "Ghost Shell" | "Sparrow" | "Ship" | "Legacy reward";

export interface RewardCode {
  code: string;
  reward: string;
  kind: RewardCodeKind;
  verifiedAt: string;
  expiresAt?: string;
  featured?: boolean;
  sourceUrl: string;
}

const COMMUNITY_SOURCE = "https://github.com/Manaiakalani/destiny-code-finder/blob/main/public/data/emblems.json";
const LEGACY_SOURCE = "https://www.bungie.net/pt/Forums/Post/199780021";
const VERIFIED_AT = "2026-07-11";

const entries: Array<[string, string, RewardCodeKind?, boolean?]> = [
  ["VMG-HXK-VAL", "Broken and Bruised", "Emblem", true],
  ["F6K-D44-JH4", "Gloriabundus", "Emblem", true],
  ["JRR-7YA-CCC", "Last Blush", "Emblem", true],
  ["FCX-P94-JCV", "Little Light", "Emblem", true],
  ["7LD-PLJ-FN3", "Lofty Wail", "Emblem", true],
  ["J64-HYC-HTD", "Red Shift Returning", "Emblem", true],
  ["9NG-KDD-PNG", "Tethered Storm", "Emblem", true],
  ["3TG-G67-PYD", "Deadlands Titan Ornament Set", "Ornament", true],
  ["MMX-3HF-CJ4", "Deadlands Warlock Ornament Set", "Ornament", true],
  ["6MC-A3F-X3R", "Deadlands Hunter Ornament Set", "Ornament", true],
  ["FPP-NHV-HNC", "Field Transcriber", "Ghost Shell", true],
  ["7AM-PJR-GMX", "Mobile Array", "Sparrow", true],
  ["K9P-PVD-NR6", "Dynamic Equivalence", "Ship", true],
  ["M3L-7DA-67C", "Evergreen Destrier", "Sparrow", true],
  ["FLK-TXG-P4A", "Hot and Cold", "Shader", true],
  ["YRC-C3D-YNC", "A Classy Order"], ["9FY-KDD-PRT", "Adventurous Spirit"], ["HN3-7K9-93G", "Airlock Invitation"],
  ["PTD-GKG-CVN", "Archived"], ["ML3-FD4-ND9", "Be True"], ["A67-C7X-3GN", "Bulbul Tarang"],
  ["VHT-6A7-3MM", "Conqueror of Infinity"], ["PHV-6LF-9CP", "Countdown to Convergence"], ["D97-YCX-7JK", "Crushed Gamma"],
  ["RA9-XPH-6KJ", "Cryonautics"], ["JXJ-HVA-RCX", "Ever Forward"], ["3J9-AMM-7MG", "Folding Space"],
  ["7LV-GTK-T7J", "Future in Shadow"], ["JYN-JAA-Y7D", "Galilean Excursion"], ["3CV-D6K-RD4", "Gone Home"],
  ["VXN-V3T-MRP", "Harmonic Commencement"], ["L7T-CVV-3RD", "Heliotrope Warren"], ["XVK-RLA-RAM", "In Urbe Inventa"],
  ["J6P-9YH-LLP", "In Vino Mendacium"], ["TNN-DKM-6LG", "Jade's Burrow"], ["VA7-L7H-PNC", "Liminal Nadir"],
  ["XMY-G9M-6XH", "Limitless Horizon"], ["JND-HLR-L69", "M:\\>START"], ["FMM-44A-RKP", "Myopia"],
  ["YAA-37T-FCN", "Neon Mirage"], ["L3P-XXR-GJ4", "Out the Airlock"], ["THR-33A-YKC", "Risen"],
  ["9LX-7YC-6TX", "Schrödinger's Gun"], ["JGN-PX4-DFN", "Secret Signal"], ["7D4-PKR-MD7", "Sequence Flourish"],
  ["XVX-DKJ-CVM", "Seraphim's Gauntlets"], ["F99-KPX-NCF", "Shadow's Light"], ["6LJ-GH7-TPA", "Sneer of the Oni"],
  ["T67-JXY-PH6", "Stag's Spirit"], ["PKH-JL6-L4R", "Tangled Web"], ["XFV-KHP-N97", "The Visionary"],
  ["6AJ-XFR-9ND", "Tigris Fati"], ["993-H3H-M6K", "Visio Spei"], ["HG7-YRG-HHF", "Year of the Snake"],
  ["JVG-VNT-GGG", "Соняшник"], ["HVN-VVC-KHL", "System of Peace"], ["9MX-PA4-RKX", "Parallel Program"],
  ["THR-HTP-LGG", "Field Recognition"], ["6RG-HRH-T9T", "Together We Ramen"], ["J3X-GNT-JAF", "Emblem of the Hibiscus"],
  ["TCN-HCD-TGY", "Emblem of the Fleet"], ["DXL-XHC-X37", "Runner"], ["3VF-LGC-RLX", "Insula Thesauria", "Legacy reward"],
  ["7CP-94V-LFP", "Lone Focus, Jagged Edge", "Legacy reward"], ["A7L-FYC-44X", "Flames of Forgotten Truth", "Legacy reward"],
  ["JD7-4CM-HJG", "Illusion of Light", "Legacy reward"], ["JDT-NLC-JKM", "Ab Aeterno", "Legacy reward"],
  ["JNX-DMH-XLA", "Field of Light", "Legacy reward"], ["N3L-XN6-PXF", "The Reflective Proof", "Legacy reward"],
  ["X9F-GMA-H6D", "The Unimagined Plane", "Legacy reward"], ["7F9-767-F74", "Sign of the Finite", "Legacy reward"],
  ["X4C-FGX-MX3", "Note of Conquest", "Legacy reward"], ["FJ9-LAM-67F", "Binding Focus", "Legacy reward"],
  ["R9J-79M-J6C", "End of the Rainbow", "Transmat"], ["TK7-D3P-FDF", "Rainbow Connection", "Emote"],
  ["D6T-3JR-CKX", "Prismatic Expanse", "Shader"], ["7MM-VPD-MHP", "Double Banshee", "Shader"],
  ["RXC-9XJ-4MH", "Oracle 99", "Shader"], ["JA9-PRC-XKX", "Take the Mantle"]
];

export const rewardCodes: RewardCode[] = [
  ...entries.map(([code, reward, kind = "Emblem", featured = false]) => ({ code, reward, kind, featured, verifiedAt: VERIFIED_AT, sourceUrl: COMMUNITY_SOURCE })),
  { code: "ARR-RRR-RRR", reward: "Three Strange Coins", kind: "Legacy reward", verifiedAt: "2016-09-19", expiresAt: "2016-09-20T00:00:00Z", sourceUrl: LEGACY_SOURCE }
];

export function activeRewardCodes(now = new Date()): RewardCode[] {
  return rewardCodes.filter((entry) => !entry.expiresAt || Date.parse(entry.expiresAt) > now.getTime());
}

export function featuredRewardCodes(now = new Date()): RewardCode[] {
  return activeRewardCodes(now).filter((entry) => entry.featured);
}
