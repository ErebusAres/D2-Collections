export type FreshnessState = "fresh" | "stale" | "offline" | "privacy-limited" | "throttled" | "unavailable";

export interface Freshness {
  state: FreshnessState;
  observedAt: string;
  sourceMintedAt?: string;
  ageSeconds?: number;
}

export interface ApiEnvelope<T> {
  data: T;
  freshness: Freshness;
  warnings: string[];
  requestId: string;
}

export interface ApiError {
  code: string;
  message: string;
  retryAfterSeconds?: number;
  requestId: string;
}

export type GuardianClass = "Titan" | "Hunter" | "Warlock" | "Unknown";

export interface CharacterSummary {
  characterId: string;
  className: GuardianClass;
  raceName: string;
  emblemPath: string;
  emblemBackgroundPath: string;
  power: number;
  dateLastPlayed: string;
  minutesPlayedThisSession: number;
}

export interface HeaderStats {
  power: number;
  guardianRank: number;
  rewardsPassRank: number;
}

export interface GuardianSummary {
  membershipId: string;
  membershipType: number;
  displayName: string;
  bungieName: string;
  selectedCharacterId: string;
  characters: CharacterSummary[];
  stats: HeaderStats;
  currentActivity?: string;
  isInGame: boolean;
}

export interface SessionData {
  authenticated: boolean;
  guardian?: GuardianSummary;
  csrfToken?: string;
  roles: { dev: boolean; matrixWriter: boolean };
}

export type ExoticKind = "weapon" | "armor";
export type CatalystState = "unavailable" | "missing" | "obtained" | "complete";

export interface GuideSource {
  label: string;
  url?: string;
}

export interface GuideEntry {
  itemHash: string;
  acquisition: string;
  steps: string[];
  prerequisites: string[];
  catalystSource?: string;
  catalystCompletion?: string;
  confidence: "verified" | "partial" | "pending";
  verifiedAt?: string;
  sources: GuideSource[];
}

export interface ExoticCollectionEntry {
  itemHash: string;
  collectibleHash?: string;
  name: string;
  description: string;
  icon: string;
  watermark?: string;
  kind: ExoticKind;
  className?: GuardianClass;
  slot: string;
  itemType: string;
  damageType?: string;
  source: string;
  owned: boolean;
  catalyst: CatalystState;
  xurSelling: boolean;
  guide: GuideEntry;
}

export interface CollectionData {
  manifestVersion: string;
  entries: ExoticCollectionEntry[];
  totals: { owned: number; available: number; catalystsAvailable: number; catalystsOwned: number; catalystsComplete: number; xurSelling: number };
  xur: {
    state: "available" | "away" | "unavailable";
    checkedAt: string;
    nextRefreshAt?: string;
  };
}

export interface QuestObjective {
  objectiveHash: string;
  name: string;
  progress: number;
  completionValue: number;
  complete: boolean;
  percent: number;
}

export interface QuestProgress {
  instanceId: string;
  itemHash: string;
  name: string;
  description: string;
  icon: string;
  currentStep: string;
  stepNumber?: number;
  stepCount?: number;
  characterId: string;
  inGameTracked: boolean;
  sitePinned: boolean;
  expiresAt?: string;
  isExoticUnlock: boolean;
  activityName?: string;
  rewards: string[];
  objectives: QuestObjective[];
  percent: number;
  updatedAt: string;
}

export interface QuestRecommendation {
  quest: QuestProgress;
  score: number;
  reasons: string[];
}

export interface QuestData {
  quests: QuestProgress[];
  recommendations: QuestRecommendation[];
  currentActivity?: string;
}

export interface FireteamMember {
  membershipId: string;
  displayName: string;
  inGameName: string;
  emblemPath?: string;
  presenceLabel: string;
  onlineState: "online" | "offline" | "unknown";
  character?: CharacterSummary;
  activity?: string;
  activitySource: "public" | "shared" | "fireteam" | "unavailable";
  isSelf: boolean;
  isLeader: boolean;
  syncState: "synced" | "not-synced";
  sharing: boolean;
  sharingMode?: FireteamSharingMode;
  expiresAt?: string;
  quests: QuestProgress[];
  overlaps: string[];
  freshness: Freshness;
}

export type FireteamSharingMode = "temporary" | "persistent";

export interface FireteamData {
  sharingEnabled: boolean;
  sharingMode: "off" | FireteamSharingMode;
  sharingExpiresAt?: string;
  activity?: string;
  members: FireteamMember[];
}

export interface MatrixSnapshot {
  membershipId: string;
  displayName: string;
  syncedAt: string;
  manifestVersion: string;
  entries: Pick<ExoticCollectionEntry, "itemHash" | "name" | "kind" | "className" | "owned" | "catalyst">[];
}

export interface MatrixData {
  snapshots: MatrixSnapshot[];
  canSync: boolean;
}

export type ArmorStatKey = "health" | "melee" | "grenade" | "super" | "class" | "weapons";
export type GearTag = "favorite" | "keep" | "junk" | "infuse" | "archive";
export type GearLocation = "equipped" | "inventory" | "vault";

export interface ArmorStats {
  health: number;
  melee: number;
  grenade: number;
  super: number;
  class: number;
  weapons: number;
}

export interface ArmorAdjustment {
  type: "masterwork" | "mod" | "artifice" | "tuning" | "other";
  stats: Partial<ArmorStats>;
}

export interface ArmorPerk {
  hash: string;
  name: string;
  description: string;
  icon?: string;
}

export interface ArmorGrade { letter: "S" | "A" | "B" | "C" | "D" | "F" | "—"; score?: number }

export interface ArmorItem {
  instanceId: string;
  itemHash: string;
  name: string;
  icon: string;
  className: GuardianClass;
  slot: string;
  rarity: string;
  power: number;
  ownerCharacterId?: string;
  location: GearLocation;
  equipped: boolean;
  locked: boolean;
  masterworked: boolean;
  gearTier: number;
  archetype?: ArmorPerk;
  tuning?: ArmorPerk & { stats: Partial<ArmorStats> };
  tunedStat?: ArmorStatKey;
  setBonuses: Array<ArmorPerk & { pieces?: number; active: boolean }>;
  perks: ArmorPerk[];
  baseStats: ArmorStats;
  currentStats: ArmorStats;
  adjustments: ArmorAdjustment[];
  baseTotal: number;
  currentTotal: number;
  grade: ArmorGrade;
  tag?: GearTag;
  firstSeenAt: string;
  dismissedAt?: string;
  isNew: boolean;
}

export interface GearData {
  manifestVersion: string;
  selectedCharacterId: string;
  selectedClass: GuardianClass;
  items: ArmorItem[];
  statIcons: Partial<Record<ArmorStatKey, string>>;
  totals: { armor: number; vault: number; equipped: number; locked: number; grouped: number; newItems: number };
}

export type GearActionRequest =
  | { action: "transfer"; itemInstanceId: string; target: "vault" | "character"; targetCharacterId?: string }
  | { action: "equip"; itemInstanceId: string; characterId: string }
  | { action: "setLock"; itemInstanceId: string; locked: boolean; characterId?: string }
  | { action: "groupPull"; itemInstanceIds: string[]; characterId: string };

export interface GearActionResult {
  action: GearActionRequest["action"];
  succeeded: string[];
  skipped: Array<{ itemInstanceId: string; reason: string }>;
  failed: Array<{ itemInstanceId: string; code: string; message: string }>;
}

export type DevProbeKey =
  | "memberships"
  | "profile"
  | "character"
  | "item"
  | "collectible"
  | "public-milestones"
  | "manifest";

export interface DevProbeResult {
  probe: DevProbeKey;
  status: number;
  durationMs: number;
  responseSize: number;
  throttleSeconds: number;
  mintedAt?: string;
  body: unknown;
}

export interface ManifestItem {
  itemHash: string;
  collectibleHash?: string;
  name: string;
  description: string;
  icon: string;
  watermark?: string;
  kind: ExoticKind;
  className?: GuardianClass;
  slot: string;
  itemType: string;
  damageType?: string;
  source: string;
  catalystRecordHashes: string[];
}

export interface CompactManifest {
  version: string;
  generatedAt: string;
  items: ManifestItem[];
  itemDefinitions: Record<string, Record<string, unknown>>;
  objectiveDefinitions: Record<string, Record<string, unknown>>;
  activityDefinitions: Record<string, Record<string, unknown>>;
  recordDefinitions: Record<string, Record<string, unknown>>;
  gearItemDefinitions?: Record<string, Record<string, unknown>>;
  plugDefinitions?: Record<string, Record<string, unknown>>;
  statDefinitions?: Record<string, Record<string, unknown>>;
}

export interface GearManifest {
  version: string;
  generatedAt: string;
  gearItemDefinitions: Record<string, Record<string, unknown>>;
  plugDefinitions: Record<string, Record<string, unknown>>;
  statDefinitions: Record<string, Record<string, unknown>>;
}
