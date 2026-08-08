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
  crucibleRank?: PvpProgression;
  rewardsPassRank: number;
  rewardsPassProgress: RewardsPassProgress;
  mailboxCount: number;
}

export type GuardianRankQuestState = "completed" | "in-progress" | "not-started" | "unavailable";
export type GuardianRankTierState = "previous" | "current" | "next" | "future";

export interface GuardianRankQuestObjective {
  objectiveHash: string;
  name: string;
  progress: number;
  completionValue: number;
  percent: number;
  complete: boolean;
  progressAvailable: boolean;
}

export interface GuardianRankQuest {
  recordHash: string;
  name: string;
  description: string;
  icon: string;
  state: GuardianRankQuestState;
  stateFlags?: number;
  trackedInDestiny: boolean;
  objectives: GuardianRankQuestObjective[];
}

export interface GuardianRankCategory {
  nodeHash: string;
  name: string;
  description: string;
  icon: string;
  seasonal: boolean;
  completed: number;
  total: number;
  quests: GuardianRankQuest[];
}

export interface GuardianRankTier {
  rankHash: string;
  rankNumber: number;
  name: string;
  description: string;
  icon: string;
  foregroundImage: string;
  overlayImage: string;
  state: GuardianRankTierState;
  completed: number;
  total: number;
  categories: GuardianRankCategory[];
}

export interface GuardianRankData {
  currentRank: number;
  renewedRank: number;
  highestAchievedRank: number;
  lifetimeHighestRank: number;
  maximumRank: number;
  suggestedRank: number;
  ranks: GuardianRankTier[];
  sources: {
    ranks: "DestinyProfileComponent and DestinyGuardianRankDefinition";
    objectives: "DestinyPresentationNodeDefinition, DestinyRecordDefinition, and profile records (component 900)";
  };
}

export type PowerSlotKind = "kinetic" | "energy" | "power" | "helmet" | "gauntlets" | "chest" | "legs" | "class-item";
export type PowerItemLocation = "vault" | "inventory" | "equipped";

export interface PowerItem {
  instanceId: string;
  itemHash: string;
  name: string;
  icon: string;
  power: number;
  slot: PowerSlotKind;
  location: PowerItemLocation;
  ownerCharacterId?: string;
}

export interface PowerSlot {
  kind: PowerSlotKind;
  label: string;
  power: number;
  deficit: number;
  lowest: boolean;
  item?: PowerItem;
  vaultBest?: PowerItem;
}

export interface CharacterPowerCeiling {
  characterId: string;
  className: GuardianClass;
  emblemPath: string;
  emblemBackgroundPath: string;
  currentPower: number;
  maximumPower: number;
  averagePower: number;
  progressToNextPower: number;
  lowestSlotPower: number;
  slots: PowerSlot[];
}

export interface PowerData {
  selectedCharacterId: string;
  accountMaximumPower: number;
  highestItemPower: number;
  vaultHighestItemPower: number;
  characters: CharacterPowerCeiling[];
  sources: {
    items: "Destiny2.GetProfile inventories, equipment, and item instances";
    definitions: "DestinyInventoryItemDefinition manifest data";
  };
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
  progressionMode?: "reward-rank" | "bright-engram";
  activeLevel?: number;
  levelsPerBrightEngram?: number;
  segmentsPerRank?: number;
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

export type PvpProgressionKind = "crucible" | "competitive" | "trials" | "iron-banner";

export interface PvpProgression {
  kind: PvpProgressionKind;
  progressionHash: string;
  name: string;
  description: string;
  icon: string;
  rankName: string;
  level: number;
  stepIndex: number;
  currentProgress: number;
  progressToNextLevel: number;
  nextLevelAt?: number;
  percent?: number;
  resets: number;
}

export interface PvpModeStats {
  kind: "all" | "competitive" | "trials" | "iron-banner";
  name: string;
  mode: number;
  matches: number;
  wins: number;
  winRate: number;
  kills: number;
  deaths: number;
  assists: number;
  kd: number;
  efficiency: number;
  precisionKills: number;
  bestSingleGameKills: number;
  longestKillSpree: number;
  combatRating?: number;
}

export interface PvpData {
  characterId: string;
  manifestVersion: string;
  primaryRank?: PvpProgression;
  progressions: PvpProgression[];
  overall: PvpModeStats;
  modes: PvpModeStats[];
  hasActivity: boolean;
  sources: {
    ranks: "Destiny2.GetProfile characterProgressions (component 202) and DestinyProgressionDefinition manifest data";
    stats: "Destiny2.GetHistoricalStats across the account's characters";
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
  roles: { dev: boolean; matrixWriter: boolean; buildEditor: boolean; reportAdmin: boolean };
  rolesState?: "verified" | "stale";
}

export type ReportCategory = "bug" | "suggestion" | "feedback" | "data" | "performance" | "accessibility" | "account" | "other";
export type ReportStatus = "open" | "in_progress" | "completed" | "dismissed";
export type ReportPriority = "low" | "normal" | "high" | "urgent";
export type ReportActivityType = "created" | "comment" | "status" | "priority" | "assignment" | "resolution" | "admin_note";

export interface ReportClientContext {
  userAgent?: string;
  viewport?: string;
  appPath?: string;
}

export interface GuardianReport {
  id: number;
  reference: string;
  reporterMembershipId?: string;
  reporterDisplayName: string;
  category: ReportCategory;
  title: string;
  description: string;
  reproductionSteps?: string;
  expectedResult?: string;
  actualResult?: string;
  pageUrl?: string;
  clientContext?: ReportClientContext;
  status: ReportStatus;
  priority: ReportPriority;
  assignedToMembershipId?: string;
  assignedToDisplayName?: string;
  adminNotes?: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  version: number;
}

export interface ReportActivity {
  id: number;
  type: ReportActivityType;
  actorDisplayName: string;
  actorRole: "reporter" | "admin";
  body?: string;
  metadata?: Record<string, string>;
  visibility: "public" | "admin";
  createdAt: string;
}

export interface ReportDetailData {
  report: GuardianReport;
  activity: ReportActivity[];
  canManage: boolean;
  canComment: boolean;
}

export interface ReportListData {
  reports: GuardianReport[];
  canManage: boolean;
  counts?: Record<ReportStatus, number>;
}

export interface ReportAdminSummaryData {
  counts: Record<ReportStatus, number>;
  unresolvedCount: number;
}

export interface CreateReportRequest {
  category: ReportCategory;
  title: string;
  description: string;
  reproductionSteps?: string;
  expectedResult?: string;
  actualResult?: string;
  pageUrl?: string;
  clientContext?: ReportClientContext;
}

export interface CreateReportCommentRequest {
  body: string;
}

export interface UpdateReportRequest {
  expectedVersion: number;
  status?: ReportStatus;
  priority?: ReportPriority;
  assignment?: "claim" | "release";
  adminNotes?: string;
  resolution?: string;
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
  objectives: QuestObjective[];
  percent: number;
  progressAvailable: boolean;
  trackedInDestiny: boolean;
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

export interface JourneyObjective {
  objectiveHash: string;
  name: string;
  progress: number;
  completionValue: number;
  percent: number;
  complete: boolean;
}

export interface JourneyRecord {
  recordHash: string;
  name: string;
  description: string;
  icon: string;
  type: string;
  category: string;
  title?: string;
  complete: boolean;
  tracked: boolean;
  percent: number;
  score: number;
  objectives: JourneyObjective[];
}

export interface JourneyTitle {
  recordHash: string;
  name: string;
  title: string;
  description: string;
  icon: string;
  complete: boolean;
  tracked: boolean;
  percent: number;
  objectives: JourneyObjective[];
}

export interface JourneyWeeklyChallenge {
  id: string;
  activityHash: string;
  name: string;
  description: string;
  icon: string;
  objective: JourneyObjective;
}

export interface JourneyCurrentActivity {
  activityHash: string;
  name: string;
  description: string;
  icon: string;
}

export interface JourneyArtifactProgress {
  artifactHash: string;
  pointsAcquired: number;
  pointsSpent: number;
  powerBonus: number;
  powerProgress: number;
  powerNextLevelAt: number;
}

export interface JourneyProgressData {
  triumphScore: {
    active: number;
    lifetime: number;
    legacy: number;
  };
  titles: JourneyTitle[];
  triumphs: JourneyRecord[];
  seasonalChallenges: JourneyRecord[];
  weeklyChallenges: JourneyWeeklyChallenge[];
  currentActivities: JourneyCurrentActivity[];
  artifact?: JourneyArtifactProgress;
  manifestVersion: string;
}

export type FireteamTrackedItemKind = "quest" | "bounty" | "order" | "guardian-rank" | "triumph" | "title" | "seasonal" | "weekly" | "exotic" | "catalyst" | "build";

export interface FireteamTrackedItemObjective {
  objectiveHash: string;
  name: string;
  progress: number;
  completionValue: number;
  percent: number;
  complete: boolean;
  progressAvailable: boolean;
}

/** A privacy-scoped, explicitly tracked pursuit shared with the current fireteam. */
export interface FireteamTrackedItem {
  id: string;
  definitionHash: string;
  kind: FireteamTrackedItemKind;
  name: string;
  description: string;
  icon: string;
  context: string;
  trackedInDestiny: boolean;
  trackedInGuardianNexus: boolean;
  objectives: FireteamTrackedItemObjective[];
  percent: number;
  updatedAt: string;
  acquisitionGuide?: {
    summary: string;
    steps: string[];
    prerequisites: string[];
  };
}

export interface FireteamCompletedTrackedItem extends FireteamTrackedItem {
  completedAt: string;
}

export type ActivityHistoryKind = "pve" | "pvp" | "gambit" | "other";

export interface ActivityHistoryEntry {
  instanceId: string;
  characterId: string;
  characterClass: GuardianClass;
  period: string;
  activityHash: string;
  activityName: string;
  activityDescription?: string;
  kind: ActivityHistoryKind;
  mode?: number;
  modeName: string;
  completed?: boolean;
  durationSeconds?: number;
  score?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
}

export interface ActivityHistoryData {
  manifestVersion: string;
  state: "available" | "partial" | "empty" | "unavailable";
  activities: ActivityHistoryEntry[];
  returnedCharacters: number;
  totalCharacters: number;
  sources: {
    activities: "Destiny2.GetActivityHistory for each current character";
    definitions: "DestinyActivityDefinition manifest data";
  };
}

export type FireteamReadinessRole = "damage" | "support" | "control" | "flex";
export type FireteamReadinessState = "ready" | "needs-attention" | "not-checked";

/** A player-confirmed, activity-scoped summary. It never contains raw inventory or Collections data. */
export interface FireteamReadinessSummary {
  schemaVersion: 1;
  activityName: string;
  role: FireteamReadinessRole;
  state: FireteamReadinessState;
  build?: {
    id?: string;
    title: string;
    subclass?: string;
  };
  prerequisites: {
    id: string;
    label: string;
    state: FireteamReadinessState;
  }[];
  note?: string;
  source: "player-confirmed";
  updatedAt: string;
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
  trackedItems: FireteamTrackedItem[];
  recentlyCompletedItems?: FireteamCompletedTrackedItem[];
  readiness?: FireteamReadinessSummary;
  /** @deprecated Retained for compatibility with Fireteam shares created by older web bundles. */
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
  friendsState?: "available" | "reauthorization-required" | "unavailable";
  clanState?: "available" | "unavailable";
  contacts: FireteamContact[];
  warning?: string;
}

export type FireteamSharingMode = "temporary" | "persistent";

export interface FireteamData {
  sharingEnabled: boolean;
  sharingMode: "off" | FireteamSharingMode;
  sharingExpiresAt?: string;
  hiddenTrackedItemKeys?: string[];
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

export interface AudienceMetrics {
  uniqueVisitors: number;
  uniqueLogins: number;
  visitorsTrackingSince: string;
}

export interface MatrixData {
  guardians: MatrixGuardian[];
  snapshots: MatrixSnapshot[];
  canSync: boolean;
  audience?: AudienceMetrics;
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

export type WeaponRollDataState = "complete" | "partial" | "unavailable";
export type WeaponReviewState = "configured" | "unique" | "duplicate-review" | "incomplete-data";

export interface WeaponPerkColumn {
  socketIndex: number;
  /** DIM wishlist position: barrel/sight, magazine/battery, trait one, or trait two. */
  ratingColumn?: 0 | 1 | 2 | 3;
  active?: ArmorPerk;
  options: ArmorPerk[];
}

export interface WeaponStat {
  hash: string;
  name: string;
  value: number;
  maximumValue: number;
  displayAsNumeric?: boolean;
}

export interface WeaponItem {
  instanceId: string;
  itemHash: string;
  name: string;
  icon: string;
  itemType: string;
  slot: "Kinetic" | "Energy" | "Power" | "Unknown";
  damageType: "Kinetic" | "Arc" | "Solar" | "Void" | "Stasis" | "Strand" | "Unknown";
  rarity: string;
  power: number;
  ownerCharacterId?: string;
  location: GearLocation;
  equipped: boolean;
  locked: boolean;
  masterworked: boolean;
  crafted: boolean;
  enhanced: boolean;
  perkColumns: WeaponPerkColumn[];
  originTraits: ArmorPerk[];
  masterwork?: ArmorPerk;
  stats?: WeaponStat[];
  trackerValue?: number;
  rollDataState: WeaponRollDataState;
  reviewState: WeaponReviewState;
  reviewReasons: string[];
  duplicateCount: number;
  wishlisted: boolean;
  tag?: GearTag;
  firstSeenAt: string;
  dismissedAt?: string;
  isNew: boolean;
}

export interface GearData {
  gearSchemaVersion?: 2;
  manifestVersion: string;
  selectedCharacterId: string;
  selectedClass: GuardianClass;
  items: ArmorItem[];
  weapons?: WeaponItem[];
  statIcons: Partial<Record<ArmorStatKey, string>>;
  totals: { armor: number; weapons?: number; vault: number; equipped: number; locked: number; grouped: number; newItems: number };
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

export type WatchlistKind = "item" | "perk" | "vendor" | "collection" | "catalyst" | "pursuit" | "reward" | "postmaster";
export type WatchlistMatchState = "matched" | "unmatched" | "unknown" | "expired";

export interface WatchlistEntry {
  id: string;
  kind: WatchlistKind;
  label: string;
  target: string;
  notes?: string;
  enabled: boolean;
  notify: boolean;
  createdAt: string;
  expiresAt?: string;
  resetAware?: boolean;
  threshold?: number;
}

export interface WatchlistDocument {
  schemaVersion: 1;
  entries: WatchlistEntry[];
}

export interface WatchlistMatch {
  entryId: string;
  state: WatchlistMatchState;
  summary: string;
  reason: string;
  source: "gear" | "xur" | "collection" | "quests" | "rewards" | "mailbox" | "preference";
  destinationUrl: string;
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
  manualCodes: string[];
  manualCodesConfigured: boolean;
  limitation: string;
}

export interface UpdateRewardCodePreferenceRequest {
  code: string;
  redeemed: boolean;
}

export type LoadoutSocketCategory = "element" | "super" | "melee" | "grenade" | "prismatic-grenade" | "transcendence" | "class-ability" | "movement" | "aspect" | "fragment" | "artifact-perk" | "modifier" | "other";

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
  equipment: LoadoutItem[];
  subclass?: LoadoutItem;
  artifact?: LoadoutItem;
  artifactMods: LoadoutSocket[];
  isPrismatic: boolean;
  transcendence?: LoadoutSocket;
  prismaticGrenade?: LoadoutSocket;
  abilities: LoadoutSocket[];
  aspects: LoadoutSocket[];
  fragments: LoadoutSocket[];
  modifiers: LoadoutSocket[];
  unresolvedItemCount: number;
}

/** @deprecated Artifact data is scoped to each GuardianLoadout after Destiny 2 Update 9.7.0. */
export interface LoadoutArtifact {
  item?: LoadoutItem;
  mods: LoadoutSocket[];
  source: "saved-loadout-compatibility";
  limitation: string;
}

export interface LoadoutsData {
  manifestVersion: string;
  characterId: string;
  characterClass: GuardianClass;
  equipped?: GuardianLoadout;
  equippedState?: "available" | "partial" | "unavailable";
  loadouts: GuardianLoadout[];
  /** @deprecated Retained temporarily so a Worker-first production rollout cannot break the previous web bundle. */
  artifact: LoadoutArtifact;
  equipRestriction: string;
}

export type UserPreferenceKey =
  | "gear.sort"
  | "gear.filters"
  | "gear.workspace"
  | "fireteam.recentLoot.v1"
  | "fireteam.recentLootLimit.v1"
  | "weapons.filters"
  | "weapons.wishlist"
  | "collection.sort"
  | "collection.filters"
  | "collection.tracked"
  | "fireteam.trackedOrder"
  | "fireteam.readinessDraft.v1"
  | "quests.layout"
  | "quests.filters"
  | "guardianRank.tracked"
  | "journey.tracked"
  | "rewardCodes.filters"
  | "builds.filters"
  | "build.detail.layout"
  | "planner.duration"
  | "planner.mode"
  | "planner.focus"
  | "watchlists.buildAcquisitions"
  | "buildAdvisor.trackedBuilds.v1"
  | "watchlists.v1"
  | "projects.v1"
  | "fashion.looks.v1"
  | "challenges.v1"
  | "site.autoRefresh"
  | "site.reducedMotion"
  | "site.highContrast"
  | "site.textScale"
  | "site.locale"
  | "site.character";

export type SiteLocale = "en-US" | "es-ES" | "fr-FR";
export type SiteTextScale = "standard" | "large" | "largest";

export interface FashionLookSlot {
  slot: BuildArmorSlot;
  ornament?: BuildNamedEntry;
  shader?: BuildNamedEntry;
}

export interface FashionLook {
  id: string;
  name: string;
  classType: BuildGuardianClass;
  slots: FashionLookSlot[];
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FashionLooksDocument { schemaVersion: 1; looks: FashionLook[]; }
export interface PortableFashionLookEnvelope {
  format: "guardian-nexus-fashion-look";
  version: 1;
  exportedAt: string;
  look: Pick<FashionLook, "name" | "classType" | "slots" | "note">;
}

export type CommunityChallengeMode = "solo" | "fireteam" | "clan";
export interface CommunityChallengeTask { id: string; label: string; points: number; state: GuardianProjectItemState; }
export interface CommunityChallenge {
  id: string;
  title: string;
  description?: string;
  mode: CommunityChallengeMode;
  tasks: CommunityChallengeTask[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
export interface CommunityChallengesDocument { schemaVersion: 1; challenges: CommunityChallenge[]; }
export interface PortableCommunityChallengeEnvelope {
  format: "guardian-nexus-community-challenge";
  version: 1;
  exportedAt: string;
  challenge: Pick<CommunityChallenge, "title" | "description" | "mode"> & { tasks: Array<Pick<CommunityChallengeTask, "label" | "points">>; };
}

export interface UserPreferencesData {
  values: Partial<Record<UserPreferenceKey, string>>;
}

export interface UpdateUserPreferenceRequest {
  key: UserPreferenceKey;
  value: string;
}

export type GuardianProjectKind = "activity" | "clan" | "collection";
export type GuardianProjectItemState = "todo" | "done" | "skipped";

export interface GuardianProjectItem {
  id: string;
  label: string;
  state: GuardianProjectItemState;
  assignee?: string;
}

export interface GuardianProject {
  id: string;
  kind: GuardianProjectKind;
  title: string;
  activity?: string;
  scheduledAt?: string;
  note?: string;
  sourceUrl?: string;
  items: GuardianProjectItem[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface GuardianProjectsDocument {
  schemaVersion: 1;
  projects: GuardianProject[];
}

export interface PortableGuardianProjectEnvelope {
  kind: "guardian-nexus-project";
  schemaVersion: 1;
  exportedAt: string;
  project: Omit<GuardianProject, "id" | "createdAt" | "updatedAt" | "completedAt" | "items"> & {
    items: Array<Omit<GuardianProjectItem, "id">>;
  };
}

export type BuildStatus = "draft" | "published" | "pending_review" | "rejected" | "archived";
export type BuildVisibility = "private" | "unlisted" | "public";
export type BuildGuardianClass = "hunter" | "titan" | "warlock";
export type BuildSubclass = "prismatic" | "arc" | "solar" | "void" | "strand" | "stasis";
export type BuildVoteValue = "up" | "down";
export type BuildLinkKind = "dim" | "mobalytics" | "youtube" | "twitch" | "source" | "other";

export interface BuildNamedEntry {
  name: string;
  hash?: string;
  icon?: string;
  itemType?: string;
  rarity?: string;
  damageType?: string;
  description?: string;
  notes?: string;
  required?: boolean;
  quantity?: number;
  setName?: string;
  requiredPieces?: number;
  row?: 1 | 2;
  artifactTier?: 1 | 2 | 3;
  artifactSlot?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  bonuses?: BuildNamedEntry[];
}

export type BuildArmorSlot = "helmet" | "arms" | "chest" | "legs" | "classItem";
export type BuildStatName = "Health" | "Melee" | "Grenade" | "Super" | "Class" | "Weapons";

export type BuildCatalogKind =
  | "class"
  | "subclass"
  | "super"
  | "classAbility"
  | "movement"
  | "melee"
  | "grenade"
  | "transcendence"
  | "aspect"
  | "fragment"
  | "weapon"
  | "weaponPerk"
  | "armor"
  | "armorTrait"
  | "exoticSpirit"
  | "armorMod"
  | "armorSetBonus"
  | "artifact"
  | "artifactPerk"
  | "champion"
  | "cosmetic"
  | "noteIcon"
  | "icon";

export interface BuildCatalogEntry {
  hash: string;
  name: string;
  description: string;
  icon: string;
  itemType: string;
  rarity: string;
  slot: string;
  damageType: string;
  kind: BuildCatalogKind;
  classType?: BuildGuardianClass;
  subclass?: BuildSubclass;
  exotic: boolean;
  applicableSlots?: BuildArmorSlot[];
  setName?: string;
  requiredPieces?: number;
  bonuses?: BuildNamedEntry[];
  traits?: BuildNamedEntry[];
  row?: 1 | 2;
  artifactTier?: 1 | 2 | 3;
}

export interface BuildArtifactPerkPool {
  tiers: Record<"1" | "2" | "3", string[]>;
  slots: Record<"1" | "2" | "3", number>;
}

export interface BuildCatalogManifest {
  version: string;
  generatedAt: string;
  groups: Partial<Record<BuildCatalogKind, string>>;
  statDefinitions: Record<BuildStatName, { hash: string; name: BuildStatName; icon: string }>;
}

export interface BuildCatalogChunk {
  version: string;
  kind: BuildCatalogKind;
  entries: BuildCatalogEntry[];
  weaponPerkHashes?: Record<string, string[]>;
  spiritHashes?: Record<string, { row1: string[]; row2: string[] }>;
  spiritHashesByClass?: Partial<Record<BuildGuardianClass, { row1: string[]; row2: string[] }>>;
  artifactPerkPools?: Record<string, BuildArtifactPerkPool>;
}

export interface XurOffer {
  saleIndex: string;
  itemHash: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  itemType: string;
  slot: string;
  className?: GuardianClass;
  category: "exotic-weapon" | "exotic-armor" | "exotic-class-item" | "exotic-catalyst" | "legendary-weapon" | "legendary-armor" | "other";
  collectibleHash?: string;
  collectionState?: "owned" | "missing" | "unknown" | "not-applicable";
  quantity: number;
  costs: Array<{ itemHash: string; name: string; icon: string; quantity: number }>;
  stats: Array<{ statHash: string; name: string; icon: string; value: number }>;
  statTotal?: number;
  perks: Array<{ itemHash: string; name: string; description: string; icon: string }>;
}

export interface XurCurrencyBalance {
  itemHash: string;
  name: string;
  icon: string;
  quantity: number;
}

export interface XurData {
  state: "available" | "away" | "unavailable";
  inventoryStatus?: "live" | "last-shipment";
  checkedAt: string;
  inventoryCapturedAt?: string;
  nextRefreshAt?: string;
  strangeCoins?: XurCurrencyBalance;
  offers: XurOffer[];
}

export interface AudienceLoginRow {
  membershipId: string;
  membershipType: number;
  displayName: string;
  bungieName: string;
  firstLoginAt: string;
  lastLoginAt: string;
  lastProfileAt?: string;
  characterClass?: string;
  power?: number;
  guardianRank?: number;
  rewardsPassRank?: number;
  emblemPath?: string;
}

export interface AudienceVisitorRow {
  visitorId: string;
  firstSeenAt: string;
}

export interface AudienceDetailData extends AudienceMetrics {
  logins: AudienceLoginRow[];
  visitors: AudienceVisitorRow[];
}

export interface BuildCatalogData {
  manifestVersion: string;
  available: boolean;
  warning?: string;
  results: BuildCatalogEntry[];
}

export interface BuildLink {
  kind: BuildLinkKind;
  label: string;
  url: string;
}

export interface BuildSubclassConfig {
  super?: BuildNamedEntry;
  classAbility?: BuildNamedEntry;
  movement?: BuildNamedEntry;
  melee?: BuildNamedEntry;
  grenade?: BuildNamedEntry;
  transcendence?: BuildNamedEntry;
  aspects: BuildNamedEntry[];
  fragments: BuildNamedEntry[];
  notes?: string;
}

export interface BuildEquipmentEntry extends BuildNamedEntry {
  slot: string;
  perks?: string;
  selectedPerks?: BuildNamedEntry[];
  traits?: BuildNamedEntry[];
  selectedSpirits?: BuildNamedEntry[];
  exotic?: boolean;
}

export interface BuildEquipment {
  weapons: BuildEquipmentEntry[];
  armor: BuildEquipmentEntry[];
  armorSets: BuildNamedEntry[];
}

export interface BuildStatPriority {
  stat: BuildStatName;
  icon?: string;
  target?: number;
  minimum?: number;
  maximum?: number;
  priority: number;
  notes?: string;
}

export interface BuildArmorMods {
  helmet: BuildNamedEntry[];
  arms: BuildNamedEntry[];
  chest: BuildNamedEntry[];
  legs: BuildNamedEntry[];
  classItem: BuildNamedEntry[];
}

export interface BuildGhostFocus {
  mod: BuildNamedEntry;
  primaryStat: BuildStatName;
  secondaryStat: BuildStatName;
  notes?: string;
}

export interface BuildArtifactSelection extends BuildNamedEntry {
  perks: BuildNamedEntry[];
  tier?: string;
}

export interface BuildCosmetics {
  shader?: BuildNamedEntry;
  ornaments: BuildNamedEntry[];
  ghost?: BuildNamedEntry;
  sparrow?: BuildNamedEntry;
  ship?: BuildNamedEntry;
  notes?: string;
}

export interface BuildGameplayStep {
  text: string;
  icon?: string;
}

export interface BuildChangelogEntry {
  version?: string;
  notes: string;
  date: string;
}

export interface BuildDocument {
  title: string;
  originalCreatorName?: string;
  classType: BuildGuardianClass;
  classIcon?: string;
  subclass: BuildSubclass;
  subclassIcon?: string;
  tags: string[];
  activityTags: string[];
  summary: string;
  notes: string;
  concepts: BuildNamedEntry[];
  championCounters: BuildNamedEntry[];
  links: BuildLink[];
  subclassConfig: BuildSubclassConfig;
  equipment: BuildEquipment;
  statPriorities: BuildStatPriority[];
  ghostFocus?: BuildGhostFocus;
  armorMods: BuildArmorMods;
  artifacts: BuildArtifactSelection[];
  gameplayLoop: BuildGameplayStep[];
  cosmetics: BuildCosmetics;
  patch?: string;
  outdated: boolean;
  changelog: BuildChangelogEntry[];
  status: BuildStatus;
  visibility: BuildVisibility;
}

export interface BuildRating {
  upvotes: number;
  downvotes: number;
  total: number;
  score: number;
  percentPositive?: number;
}

export interface GuardianBuild extends BuildDocument {
  id: string;
  slug: string;
  authorMembershipId: string;
  authorDisplayName: string;
  rating: BuildRating;
  viewerVote?: BuildVoteValue;
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface BuildsData {
  builds: GuardianBuild[];
  canCreate: boolean;
}

export interface BuildData {
  build: GuardianBuild;
}

/** Account-neutral export format. Identity, ownership, votes, and private Guardian data are intentionally excluded. */
export interface PortableBuildEnvelope {
  schemaVersion: 1;
  kind: "guardian-nexus-build";
  exportedAt: string;
  source: "guardian-nexus";
  document: BuildDocument;
}

export type GuardianSnapshotVisibility = "private" | "unlisted";

/** A player-curated card. Omitted fields stay private and no inventory ownership is supported. */
export interface GuardianSnapshotDocument {
  schemaVersion: 1;
  title: string;
  summary?: string;
  visibility: GuardianSnapshotVisibility;
  guardian?: {
    displayName?: string;
    className?: string;
    power?: number;
    guardianRank?: number;
  };
  role?: string;
  selectedBuild?: { title: string; url?: string };
  goals: string[];
  tags: string[];
  note?: string;
  source: "player-curated";
}

export interface GuardianSnapshot {
  slug: string;
  document: GuardianSnapshotDocument;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
}

export interface GuardianSnapshotsData {
  snapshots: GuardianSnapshot[];
}

export interface BuildWorkingDraft {
  buildId: string;
  document: BuildDocument;
  baseUpdatedAt: string;
  savedAt: string;
}

export interface BuildWorkingDraftData {
  draft?: BuildWorkingDraft;
}

export type BuildAdvisorAssemblyStatus =
  | "fully-assembleable"
  | "assembleable-with-substitutions"
  | "missing-one-important-item"
  | "missing-several-core-items"
  | "not-viable";

export type BuildAdvisorRollQuality = "perfect" | "strong" | "functional" | "poor" | "unknown" | "missing";
export type BuildAdvisorItemLocation = "equipped" | "inventory" | "vault";
export type BuildAdvisorArtifactDependency = "none" | "low" | "medium" | "high";
export type BuildAdvisorFocus =
  | "Balanced"
  | "Boss Damage"
  | "General PvE"
  | "Solo / Survivability"
  | "Add Clear"
  | "Ability Uptime"
  | "Power Progression";
export type BuildAdvisorCategory =
  | "Best Overall"
  | "Best Boss Damage"
  | "Best General PvE"
  | "Best Solo / Survivability"
  | "Best Add Clear"
  | "Best Build While Increasing Power"
  | "Easiest Strong Build to Assemble"
  | "Best Build With Current Equipped Gear";

export interface BuildAdvisorOwnedItem {
  instanceId: string;
  itemHash: string;
  name: string;
  icon: string;
  itemType: string;
  rarity: string;
  slot: string;
  damageType?: string;
  className?: GuardianClass;
  location: BuildAdvisorItemLocation;
  ownerCharacterId?: string;
  ownerClassName?: GuardianClass;
  equipped: boolean;
  transferable?: boolean;
  power: number;
  exotic: boolean;
  crafted: boolean;
  perks: BuildNamedEntry[];
  enhancedPerks: string[];
  selectablePerks: BuildNamedEntry[];
  rollDataState: "known" | "unknown";
  armorStats?: Partial<Record<BuildStatName, number>>;
  armorBaseTotal?: number;
  armorCurrentTotal?: number;
  armorTier?: number;
  armorArchetype?: BuildNamedEntry;
  armorSetBonuses?: BuildNamedEntry[];
  tunedStat?: BuildStatName;
  masterworked?: boolean;
}

export interface BuildAdvisorCollectionItem {
  itemHash: string;
  name: string;
  icon: string;
  itemType: string;
  className?: GuardianClass;
}

export interface BuildAdvisorWeaponEvaluation {
  requirementId: string;
  label: string;
  item?: BuildAdvisorOwnedItem;
  quality: BuildAdvisorRollQuality;
  substitution: "exact" | "strong" | "functional" | "poor" | "missing";
  matchedPerks: string[];
  missingPerks: string[];
  notes: string[];
}

export interface BuildAdvisorArmorEvaluation {
  slot: "helmet" | "arms" | "chest" | "legs" | "classItem";
  label: string;
  item?: BuildAdvisorOwnedItem;
  score: number;
  quality: "excellent" | "strong" | "functional" | "missing";
  notes: string[];
}

export interface BuildAdvisorScoreFactor {
  id: string;
  label: string;
  earned: number;
  available: number;
  assessment: "excellent" | "high" | "medium" | "low" | "missing";
  detail: string;
}

export interface BuildAdvisorMissingItemGuide {
  id: string;
  name: string;
  kind: "specific-item" | "weapon-role" | "armor-slot";
  itemHash?: string;
  icon?: string;
  itemType?: string;
  acquisition: string;
  source: "collections" | "bungie-manifest" | "loadout-requirement";
  steps: string[];
}

export interface BuildAdvisorArmorTargetResult {
  stat: BuildStatName;
  target?: number;
  actual: number;
  met: boolean;
}

export interface BuildAdvisorArmorCombination {
  id: string;
  items: BuildAdvisorOwnedItem[];
  score: number;
  statTotals: Partial<Record<BuildStatName, number>>;
  targets: BuildAdvisorArmorTargetResult[];
  setBonuses: Array<{ name: string; pieces: number }>;
}

export interface BuildAdvisorArmorOptimization {
  strategy: "account-wide-combination-v1";
  candidatesEvaluated: number;
  selected: BuildAdvisorArmorCombination;
  alternatives: BuildAdvisorArmorCombination[];
}

export type BuildAdvisorComponentKind = "exotic-armor" | "weapon" | "armor" | "subclass" | "mod" | "artifact" | "catalyst";
export type BuildAdvisorComponentState =
  | "exact-owned"
  | "strong-owned"
  | "functional-owned"
  | "configuration-needed"
  | "collection-only"
  | "owned-other-character"
  | "missing"
  | "unavailable"
  | "unknown";

/** Account-specific truth for one build requirement. Unknown is intentionally distinct from missing. */
export interface BuildAdvisorComponentVerification {
  id: string;
  kind: BuildAdvisorComponentKind;
  name: string;
  state: BuildAdvisorComponentState;
  required: boolean;
  item?: BuildAdvisorOwnedItem | BuildAdvisorCollectionItem;
  reasons: string[];
  actions: string[];
}

export type BuildAdvisorAlternativeTier = "exact" | "strong" | "functional" | "easy-to-acquire";

export interface BuildAdvisorAlternativeSuggestion {
  id: string;
  requirementId: string;
  kind: "weapon" | "armor" | "mod" | "subclass";
  name: string;
  tier: BuildAdvisorAlternativeTier;
  score: number;
  item?: BuildAdvisorOwnedItem;
  matchedTraits: string[];
  missingTraits: string[];
  benefits: string[];
  tradeoffs: string[];
}

export type BuildAdvisorAcquisitionAvailability = "available-now" | "rotating" | "prerequisite" | "collection" | "unavailable" | "unknown";
export type BuildAdvisorAcquisitionCertainty = "guaranteed" | "deterministic" | "random" | "unknown";

export interface BuildAdvisorAcquisitionRoute {
  id: string;
  label: string;
  description: string;
  source: "collections" | "bungie-manifest" | "build-requirement" | "vendor" | "activity" | "quest";
  availability: BuildAdvisorAcquisitionAvailability;
  certainty: BuildAdvisorAcquisitionCertainty;
  steps: string[];
  prerequisites: string[];
  externalUrl?: string;
  resetAt?: string;
}

export interface BuildAdvisorAcquisitionPlan {
  id: string;
  componentId: string;
  name: string;
  targetTraits: {
    required: string[];
    preferred: string[];
    acceptable: string[];
  };
  routes: BuildAdvisorAcquisitionRoute[];
  trackingKey: string;
}

export type BuildAdvisorUpgradeStageKind = "playable-now" | "next-upgrade" | "strong" | "ideal";

export interface BuildAdvisorUpgradeStage {
  id: string;
  kind: BuildAdvisorUpgradeStageKind;
  title: string;
  description: string;
  readinessTarget: number;
  componentIds: string[];
}

export interface BuildAdvisorSubclassValidation {
  state: "validated" | "unverified";
  checkedCount: number;
  message: string;
}

export interface BuildAdvisorRecommendationSource {
  kind: "curated-template" | "published-build";
  label: string;
  buildId?: string;
  buildSlug?: string;
  authorDisplayName?: string;
  rating?: BuildRating;
}

export interface BuildAdvisorVerificationSource {
  label: string;
  url: string;
}

export interface BuildAdvisorVerification {
  state: "verified-current" | "current-community";
  sandbox: string;
  verifiedAt: string;
  sources: BuildAdvisorVerificationSource[];
}

export interface BuildAdvisorEquipPlan {
  state: "ready" | "already-equipped" | "partial" | "blocked";
  canEquip: boolean;
  itemCount: number;
  transferCount: number;
  equippedCount: number;
  blockers: string[];
}

export interface BuildAdvisorRecommendation {
  /** Structured-advice schema. Absent on legacy cached responses. */
  adviceSchemaVersion?: 2;
  id: string;
  templateId: string;
  templateVersion: number;
  reviewedAt: string;
  release: string;
  name: string;
  classType: BuildGuardianClass;
  subclass: BuildSubclass;
  /** Combined recommendation rank. Prefer the component scores when explaining a result. */
  score: number;
  /** Account-independent strength of the template in its intended activities. */
  viabilityScore: number;
  /** Account-specific completion based on owned armor, weapons, and roll quality. */
  readinessScore: number;
  status: BuildAdvisorAssemblyStatus;
  categories: BuildAdvisorCategory[];
  focuses: BuildAdvisorFocus[];
  coreExoticArmor: BuildAdvisorOwnedItem | BuildAdvisorCollectionItem;
  exoticWeapon?: BuildAdvisorOwnedItem;
  weapons: BuildAdvisorWeaponEvaluation[];
  armor: BuildAdvisorArmorEvaluation[];
  armorOptimization?: BuildAdvisorArmorOptimization;
  ghostFocus: BuildGhostFocus;
  missingItems: string[];
  missingItemGuides: BuildAdvisorMissingItemGuide[];
  substitutions: string[];
  componentVerifications?: BuildAdvisorComponentVerification[];
  alternatives?: BuildAdvisorAlternativeSuggestion[];
  acquisitionPlans?: BuildAdvisorAcquisitionPlan[];
  upgradePath?: BuildAdvisorUpgradeStage[];
  activities: string[];
  style: string;
  damageProfile: "high" | "medium" | "low";
  survivability: "high" | "medium" | "low";
  complexity: "high" | "medium" | "low";
  artifactDependency: BuildAdvisorArtifactDependency;
  powerFriendly: boolean;
  reason: string;
  gameplayLoop: string[];
  damageRotation: string[];
  limitations: string[];
  upgrades: string[];
  notes: string[];
  factors: BuildAdvisorScoreFactor[];
  source: BuildAdvisorRecommendationSource;
  verification: BuildAdvisorVerification;
  subclassValidation: BuildAdvisorSubclassValidation;
  equipPlan: BuildAdvisorEquipPlan;
  build: BuildDocument;
}

export interface BuildAdvisorInventoryAnalysis {
  physicalItemCount: number;
  savedLoadoutCount: number;
  ownedExoticArmorByClass: Partial<Record<GuardianClass, BuildAdvisorOwnedItem[]>>;
  ownedExoticWeapons: BuildAdvisorOwnedItem[];
  equippedExotics: BuildAdvisorOwnedItem[];
  vaultExotics: BuildAdvisorOwnedItem[];
  collectionOnlyExotics: BuildAdvisorCollectionItem[];
  relevantLegendaryRolls: BuildAdvisorWeaponEvaluation[];
  missingHighImpactItems: string[];
  syncTimestamp: string;
  warnings: string[];
}

export interface BuildAdvisorData {
  characterId: string;
  characterClass: GuardianClass;
  characterPower: number;
  manifestVersion: string;
  templateSetVersion: number;
  templateReviewedAt: string;
  state: "current" | "may-be-stale" | "sync-required" | "incomplete";
  recommendations: BuildAdvisorRecommendation[];
  analysis: BuildAdvisorInventoryAnalysis;
}

export interface EquipBuildAdvisorRequest {
  recommendationId: string;
  characterId: string;
}

export interface EquipBuildAdvisorResult {
  recommendationId: string;
  characterId: string;
  transferredItemIds: string[];
  equippedItemIds: string[];
  equipped: true;
}

export interface SaveBuildWorkingDraftRequest {
  document: BuildDocument;
  baseUpdatedAt: string;
}

export interface BuildVoteRequest {
  vote: BuildVoteValue | null;
}

export interface BuildVoteResult {
  rating: BuildRating;
  viewerVote: BuildVoteValue | null;
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
  milestoneDefinitions?: Record<string, Record<string, unknown>>;
  activityModifierDefinitions?: Record<string, Record<string, unknown>>;
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
  pvpProgressionDefinitions?: Record<string, Record<string, unknown>>;
  itemDefinitions: Record<string, Record<string, unknown>>;
}

export interface GuardianRankManifestNode {
  hash: string;
  name: string;
  description: string;
  icon: string;
  seasonal: boolean;
  completionRecordHash?: string;
  childNodeHashes: string[];
  recordHashes: string[];
}

export interface GuardianRankManifestRecord {
  hash: string;
  name: string;
  description: string;
  icon: string;
  scope: number;
  objectiveHashes: string[];
}

export interface GuardianRankManifestObjective {
  hash: string;
  name: string;
  description: string;
  completionValue: number;
}

export interface GuardianRankManifest {
  version: string;
  generatedAt: string;
  rootNodeHash: string;
  maximumRank: number;
  ranks: Array<{
    hash: string;
    rankNumber: number;
    name: string;
    description: string;
    icon: string;
    foregroundImage: string;
    overlayImage: string;
    presentationNodeHash: string;
  }>;
  nodes: Record<string, GuardianRankManifestNode>;
  records: Record<string, GuardianRankManifestRecord>;
  objectives: Record<string, GuardianRankManifestObjective>;
}

export interface JourneyProgressManifest {
  version: string;
  generatedAt: string;
  records: Record<string, {
    hash: string;
    name: string;
    description: string;
    icon: string;
    scope: number;
    type: string;
    score: number;
    title: string;
    objectiveHashes: string[];
    parentNodeHashes: string[];
  }>;
  objectives: Record<string, GuardianRankManifestObjective>;
  nodes: Record<string, {
    hash: string;
    name: string;
    description: string;
    icon: string;
  }>;
}

export type NotificationPriority = "critical" | "high" | "normal" | "low";
export type NotificationScope = "global" | "account";
export type NotificationStatus = "active" | "expired" | "dismissed" | "read" | "archived";
export type NotificationSourceConfidence = "confirmed" | "live-api" | "observed" | "community-reported" | "estimated" | "predicted" | "unavailable";
export type NotificationCategory =
  | "distortion"
  | "crucible"
  | "trials"
  | "iron-banner"
  | "gambit"
  | "vanguard"
  | "exotic"
  | "legendary"
  | "seasonal"
  | "eververse"
  | "bungie-news"
  | "completion"
  | "warning"
  | "outage"
  | "redemption-code"
  | "system";

export interface GuardianNotification {
  id: string;
  eventKey?: string;
  type: string;
  category: NotificationCategory;
  scope: NotificationScope;
  priority: NotificationPriority;
  status: NotificationStatus;
  title: string;
  subtitle?: string;
  description?: string;
  icon?: string;
  imageUrl?: string;
  badge?: string;
  destinationUrl?: string;
  externalUrl?: string;
  createdAt: string;
  updatedAt?: string;
  startsAt?: string;
  expiresAt?: string;
  dismissible: boolean;
  autoDismiss: boolean;
  autoDismissMs?: number;
  repeatable?: boolean;
  source?: string;
  sourceLabel?: string;
  sourceConfidence?: NotificationSourceConfidence;
  readAt?: string;
  dismissedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationPreferences {
  enabledCategories: NotificationCategory[];
  globalNotifications: boolean;
  accountNotifications: boolean;
  bannerVisible: boolean;
  autoDismissMs: number;
  reducedMotion: boolean;
  sound: boolean;
  lowPriorityInFeed: boolean;
  frequency: "all" | "important" | "minimal";
}

export interface NotificationFeedData {
  notifications: GuardianNotification[];
  unreadCount: number;
  nextCursor?: string;
  preferences: NotificationPreferences;
}

export interface UpdateNotificationStateRequest {
  notificationId: string;
  action: "read" | "unread" | "dismiss" | "restore" | "archive" | "delete";
}

export interface UpdateNotificationPreferencesRequest {
  preferences: NotificationPreferences;
}

export type DistortionDataState = "live" | "stale" | "unavailable" | "manually-reported";

export interface DistortionObservation {
  id: string;
  destination: string;
  destinationIcon?: string;
  destinationImage?: string;
  observedStartAt: string;
  observedEndAt?: string;
  firstDetectedAt: string;
  lastConfirmedAt: string;
  source: string;
  confidence: NotificationSourceConfidence;
  complete: boolean;
}

export interface DistortionPrediction {
  state: "insufficient-data" | "no-reliable-pattern" | "possible-pattern" | "available" | "pattern-changed" | "disabled";
  expectedDestination?: string;
  confidencePercent?: number;
  sampleSize: number;
  calculatedAt: string;
  explanation: string;
  recentAccuracyPercent?: number;
}

export interface DistortionStatistics {
  observations: number;
  destinationCounts: Array<{ destination: string; count: number; percentage: number; lastSeenAt: string }>;
  mostCommonDestination?: string;
  leastCommonDestination?: string;
  averageIntervalMinutes?: number;
  shortestIntervalMinutes?: number;
  longestIntervalMinutes?: number;
  consecutiveRepeats: number;
}

export interface DistortionData {
  state: DistortionDataState;
  current?: DistortionObservation;
  nextHourlyChangeAt: string;
  history: DistortionObservation[];
  statistics: DistortionStatistics;
  prediction: DistortionPrediction;
  sourceLabel: string;
  sourceConfidence: NotificationSourceConfidence;
  lastSuccessfulUpdateAt?: string;
}

export type HappeningCardState = "live" | "upcoming" | "ending-soon" | "unavailable" | "stale" | "inactive";
export type HappeningSection = "live" | "weekly" | "vendors" | "daily" | "news" | "discoveries" | "upcoming" | "personal";

export interface HappeningCard {
  id: string;
  section: HappeningSection;
  category: NotificationCategory;
  priority: NotificationPriority;
  state: HappeningCardState;
  title: string;
  status: string;
  description?: string;
  icon?: string;
  imageUrl?: string;
  startsAt?: string;
  endsAt?: string;
  destinationUrl?: string;
  externalUrl?: string;
  sourceLabel: string;
  sourceConfidence: NotificationSourceConfidence;
  observedAt?: string;
}

export interface WhatsHappeningData {
  cards: HappeningCard[];
  generatedAt: string;
  nextDailyResetAt: string;
  nextWeeklyResetAt: string;
}

export interface RaidRotationsData {
  cards: HappeningCard[];
  generatedAt: string;
  nextWeeklyResetAt: string;
}
