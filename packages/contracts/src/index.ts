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
  rewardsPassProgress: RewardsPassProgress;
  mailboxCount: number;
}

export interface RewardsPassProgress {
  state: "available" | "partial" | "unavailable";
  source: "bungie-profile-character-progressions";
  passHash?: string;
  rewardProgressionHash?: string;
  prestigeProgressionHash?: string;
  activeProgressionHash?: string;
  currentProgress?: number;
  progressToNextLevel?: number;
  nextLevelAt?: number;
  percent?: number;
  reason?: string;
}

export type RewardsPassRewardState = "claimed" | "available" | "earned" | "locked" | "unavailable";

export interface RewardsPassReward {
  rewardItemIndex: number;
  itemHash: string;
  name: string;
  description: string;
  icon: string;
  quantity: number;
  requiredLevel: number;
  track: string;
  state: RewardsPassRewardState;
  stateFlags?: number;
  acquisition: "instant" | "claim-required" | "unknown";
}

export interface RewardsPassData {
  passHash: string;
  name: string;
  description: string;
  icon: string;
  backgroundImage: string;
  manifestVersion: string;
  rank: number;
  progress: RewardsPassProgress;
  rewards: RewardsPassReward[];
  rewardDataState: "available" | "unavailable";
  rewardDataReason?: string;
  sources: {
    rankAndXp: "Destiny2.GetProfile characterProgressions (component 202)";
    rewards: "DestinySeasonPassDefinition and DestinyProgressionDefinition manifest data";
    claimingSupported: false;
  };
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

export interface CollectionCatalyst {
  recordHash: string;
  name: string;
  description: string;
  icon: string;
  state: CatalystState;
}

export interface CollectionFeature {
  itemHash: string;
  name: string;
  description: string;
  icon: string;
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
  catalysts?: CollectionCatalyst[];
  features?: CollectionFeature[];
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

export interface QuestStepProgress {
  itemHash: string;
  stepNumber: number;
  name: string;
  description: string;
  status: "completed" | "current" | "future";
  objectives: QuestObjective[];
  percent: number;
  progressKnown: boolean;
}

export interface QuestReward {
  itemHash: string;
  name: string;
  description: string;
  icon: string;
  quantity: number;
  definitionAvailable: boolean;
}

export interface QuestProgress {
  instanceId: string;
  itemHash: string;
  name: string;
  description: string;
  flavorText?: string;
  itemType?: string;
  rarity?: string;
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
  rewards: QuestReward[];
  objectives: QuestObjective[];
  steps?: QuestStepProgress[];
  percent: number;
  updatedAt: string;
  category?: "quest" | "bounty" | "order";
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

export interface FireteamContact {
  membershipId: string;
  membershipType?: number;
  displayName: string;
  source: "friend" | "clan" | "friend-and-clan";
  clanName?: string;
  onlineState: "online" | "offline" | "unknown";
  inDestiny2: boolean;
}

export interface FireteamSocialData {
  state: "available" | "reauthorization-required" | "unavailable";
  contacts: FireteamContact[];
  warning?: string;
}

export type FireteamSharingMode = "temporary" | "persistent";

export interface FireteamData {
  sharingEnabled: boolean;
  sharingMode: "off" | FireteamSharingMode;
  sharingExpiresAt?: string;
  activity?: string;
  members: FireteamMember[];
  social?: FireteamSocialData;
}

export interface MatrixSnapshot {
  membershipId: string;
  displayName: string;
  syncedAt: string;
  manifestVersion: string;
  entries: Pick<ExoticCollectionEntry, "itemHash" | "name" | "kind" | "className" | "owned" | "catalyst">[];
}

export interface MatrixGuardian {
  membershipId: string;
  displayName: string;
  hasSnapshot: boolean;
  syncedAt?: string;
}

export interface MatrixData {
  guardians: MatrixGuardian[];
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

export interface CompanionManifest {
  version: string;
  generatedAt: string;
  itemDefinitions: Record<string, Record<string, unknown>>;
  itemDefinitionChunks?: string[];
  bucketDefinitions: Record<string, Record<string, unknown>>;
  loadoutNameDefinitions: Record<string, Record<string, unknown>>;
  loadoutIconDefinitions: Record<string, Record<string, unknown>>;
  loadoutColorDefinitions: Record<string, Record<string, unknown>>;
}

export interface MailboxItem {
  instanceId: string;
  itemHash: string;
  characterId: string;
  name: string;
  description: string;
  icon: string;
  itemType: string;
  rarity: string;
  quantity: number;
  bucketHash: string;
  canPull: boolean;
  unavailableReason?: string;
  definitionAvailable: boolean;
}

export interface MailboxCharacter {
  characterId: string;
  className: GuardianClass;
  emblemPath: string;
  count: number;
  capacity: number;
  items: MailboxItem[];
}

export interface MailboxData {
  manifestVersion: string;
  count: number;
  capacity: number;
  characters: MailboxCharacter[];
}

export interface MailboxPullRequest {
  itemInstanceId: string;
  characterId: string;
  quantity: number;
}

export interface MailboxPullResult {
  itemInstanceId: string;
  characterId: string;
  quantity: number;
  pulled: true;
}

export type RewardCodeAccountState = "reward-owned" | "not-owned" | "unavailable";

export interface RewardCodeAccountStatus {
  code: string;
  reward: string;
  state: RewardCodeAccountState;
  matchedCollectibleHashes: string[];
  reason?: string;
}

export interface RewardCodeStatusData {
  manifestVersion: string;
  source: "bungie-profile-collectibles";
  checkedAt: string;
  statuses: RewardCodeAccountStatus[];
  limitation: string;
}

export type LoadoutSocketCategory = "element" | "super" | "melee" | "grenade" | "class-ability" | "movement" | "aspect" | "fragment" | "modifier" | "other";

export interface LoadoutSocket {
  itemHash: string;
  name: string;
  description: string;
  icon: string;
  category: LoadoutSocketCategory;
  categoryLabel: string;
  definitionAvailable: boolean;
}

export interface LoadoutItem {
  instanceId: string;
  itemHash: string;
  name: string;
  icon: string;
  itemType: string;
  rarity: string;
  equipmentSlot: string;
  definitionAvailable: boolean;
  sockets: LoadoutSocket[];
}

export interface GuardianLoadout {
  index: number;
  name: string;
  icon: string;
  color: string;
  element?: string;
  items: LoadoutItem[];
  subclass?: LoadoutItem;
  abilities: LoadoutSocket[];
  aspects: LoadoutSocket[];
  fragments: LoadoutSocket[];
  modifiers: LoadoutSocket[];
  unresolvedItemCount: number;
}

export interface LoadoutsData {
  manifestVersion: string;
  characterId: string;
  characterClass: GuardianClass;
  loadouts: GuardianLoadout[];
  equipRestriction: string;
}

export interface EquipLoadoutRequest {
  loadoutIndex: number;
  characterId: string;
}

export interface EquipLoadoutResult {
  loadoutIndex: number;
  characterId: string;
  equipped: true;
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
  collectionFeatureDefinitions?: Record<string, CollectionFeature[]>;
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

export interface RewardsManifest {
  version: string;
  generatedAt: string;
  seasonPassDefinitions: Record<string, Record<string, unknown>>;
  progressionDefinitions: Record<string, Record<string, unknown>>;
  itemDefinitions: Record<string, Record<string, unknown>>;
}
