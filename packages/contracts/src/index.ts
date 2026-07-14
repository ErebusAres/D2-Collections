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
  guide: GuideEntry;
}

export interface CollectionData {
  manifestVersion: string;
  entries: ExoticCollectionEntry[];
  totals: { owned: number; available: number; catalystsAvailable: number; catalystsOwned: number; catalystsComplete: number };
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
  character?: CharacterSummary;
  activity?: string;
  isSelf: boolean;
  sharing: boolean;
  expiresAt?: string;
  quests: QuestProgress[];
  overlaps: string[];
  freshness: Freshness;
}

export interface FireteamData {
  sharingEnabled: boolean;
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
}
