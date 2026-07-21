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
  lifetimeHighestRank: number;
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
  roles: { dev: boolean; matrixWriter: boolean; buildEditor: boolean };
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
  loadouts: GuardianLoadout[];
  /** @deprecated Retained temporarily so a Worker-first production rollout cannot break the previous web bundle. */
  artifact: LoadoutArtifact;
  equipRestriction: string;
}

export type UserPreferenceKey =
  | "gear.sort"
  | "gear.filters"
  | "collection.sort"
  | "collection.filters"
  | "quests.layout"
  | "quests.filters"
  | "guardianRank.tracked"
  | "rewardCodes.filters"
  | "builds.filters"
  | "build.detail.layout"
  | "site.autoRefresh"
  | "site.reducedMotion"
  | "site.character";

export interface UserPreferencesData {
  values: Partial<Record<UserPreferenceKey, string>>;
}

export interface UpdateUserPreferenceRequest {
  key: UserPreferenceKey;
  value: string;
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
  quantity: number;
  costs: Array<{ itemHash: string; name: string; icon: string; quantity: number }>;
  stats: Array<{ statHash: string; name: string; icon: string; value: number }>;
  statTotal?: number;
  perks: Array<{ itemHash: string; name: string; description: string; icon: string }>;
}

export interface XurData {
  state: "available" | "away" | "unavailable";
  checkedAt: string;
  nextRefreshAt?: string;
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

export interface BuildWorkingDraft {
  buildId: string;
  document: BuildDocument;
  baseUpdatedAt: string;
  savedAt: string;
}

export interface BuildWorkingDraftData {
  draft?: BuildWorkingDraft;
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
