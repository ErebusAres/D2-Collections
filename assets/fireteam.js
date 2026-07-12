(() => {
  const CONFIG = window.D2_BUNGIE_CONFIG || {};
  const ACTIVITY_MAP = window.D2_FIRETEAM_ACTIVITY_MAP || { aliases: {}, suggestions: [] };
  const API_ROOT = "https://www.bungie.net/Platform";
  const AUTH_KEY = "d2-collections-auth-v1";
  const SESSION_KEY = "d2-collections-bungie-session-v2";
  const RETURN_KEY = "d2-collections-oauth-return-v1";
  const STATE_KEY = "d2-collections-oauth-state-v1";
  const RECORD_CACHE_KEY = "d2-fireteam-record-def-cache-v1";
  const ITEM_CACHE_KEY = "d2-fireteam-item-def-cache-v4";
  const OBJECTIVE_CACHE_KEY = "d2-fireteam-objective-def-cache-v1";
  const MANUAL_TRACK_KEY = "d2-fireteam-manual-track-v1";
  const MANUAL_TRACK_CACHE_KEY = "d2-fireteam-manual-track-cache-v1";
  const MANUAL_DRAWER_KEY = "d2-fireteam-manual-drawer-minimized-v1";
  const AUTO_REFRESH_MS = 90 * 1000;
  const MAX_RECORD_ITEMS = 18;
  const ITEM_STATE_TRACKED = 2;
  const ITEM_STATE_HIGHLIGHTED_OBJECTIVE = 16;
  const SIDE_TRACKER_LIMIT = 12;
  const SIDE_TRACKER_ICONS = {
    bounty: "assets/dim-icons/dim_exclamation_triangle.svg",
    seasonal: "assets/dim-icons/dim_pursuit_complete.svg",
    tracked: "assets/dim-icons/dim_tracked.svg"
  };
  const CLASS_LABELS = {
    "2271682572": "Warlock",
    "3655393761": "Titan",
    "671679327": "Hunter"
  };
  const RACE_LABELS = {
    "3887404748": "Human",
    "2803282938": "Awoken",
    "898834093": "Exo"
  };
  const MEMBERSHIP_LABELS = {
    1: "Xbox",
    2: "PlayStation",
    3: "Steam",
    4: "Battle.net",
    5: "Stadia",
    6: "Epic",
    10: "Demon",
    254: "Bungie"
  };
  const PLAYER_SHORT_NAMES = [
    { id: "corey", label: "Ares", needles: ["4611686018470688010", "erebusares", "corey", "ares"] },
    { id: "matt", label: "Icee", needles: ["4611686018470677739", "iceededpple", "matt", "icee"] },
    { id: "chris", label: "Fears", needles: ["4611686018470990353", "fears", "chris"] }
  ];

  const els = {
    loginBtn: document.querySelector("#loginBtn"),
    refreshBtn: document.querySelector("#refreshBtn"),
    authState: document.querySelector("#authState"),
    playerName: document.querySelector("#playerName"),
    profileGuardianName: document.querySelector("#profileGuardianName"),
    profileGuardianMeta: document.querySelector("#profileGuardianMeta"),
    profileTopStats: document.querySelector("#profileTopStats"),
    profileEmblem: document.querySelector("#profileEmblem"),
    profileBannerImage: document.querySelector("#profileBannerImage"),
    profileSelectorToggle: document.querySelector("#profileSelectorToggle"),
    profileCharacterSelector: document.querySelector("#profileCharacterSelector"),
    playerMeta: document.querySelector("#playerMeta"),
    lastUpdated: document.querySelector("#lastUpdated"),
    statusBox: document.querySelector("#statusBox"),
    cloudStatus: document.querySelector("#cloudStatus"),
    socialDrawerToggle: document.querySelector("#socialDrawerToggle"),
    socialDrawerClose: document.querySelector("#socialDrawerClose"),
    socialDrawer: document.querySelector("#socialDrawer"),
    socialCount: document.querySelector("#socialCount"),
    socialPlayerName: document.querySelector("#socialPlayerName"),
    socialPlayerMeta: document.querySelector("#socialPlayerMeta"),
    socialList: document.querySelector("#socialList"),
    socialPrev: document.querySelector("#socialPrev"),
    socialNext: document.querySelector("#socialNext"),
    membersList: document.querySelector("#membersList"),
    memberCount: document.querySelector("#memberCount"),
    sideTrackerList: document.querySelector("#sideTrackerList"),
    sideTrackerCount: document.querySelector("#sideTrackerCount"),
    questList: document.querySelector("#questList"),
    questCount: document.querySelector("#questCount"),
    questTabs: document.querySelector("#questTabs"),
    triumphList: document.querySelector("#triumphList"),
    triumphCount: document.querySelector("#triumphCount"),
    manualTrackerPanel: document.querySelector("#manualTrackerPanel"),
    manualTrackDrawerToggle: document.querySelector("#manualTrackDrawerToggle"),
    manualTrackList: document.querySelector("#manualTrackList"),
    manualTrackCount: document.querySelector("#manualTrackCount"),
    activityList: document.querySelector("#activityList"),
    activityCount: document.querySelector("#activityCount"),
    debugBox: document.querySelector("#debugBox")
  };

  let latestSnapshot = null;
  let savedSnapshots = [];
  let selectedSnapshotKey = "";
  let refreshing = false;
  let autoRefreshTimer = 0;
  let questFilter = "all";
  let classFilter = "";
  let socialTab = "fireteam";
  let manualTracked = readManualTracked();
  let manualTrackCache = readManualTrackCache();
  let manualRenderSeq = 0;
  let floatingTooltip = null;
  let floatingTooltipCard = null;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function readManualTracked() {
    try {
      const saved = JSON.parse(localStorage.getItem(MANUAL_TRACK_KEY) || "[]");
      return new Set(Array.isArray(saved) ? saved.map(String) : []);
    } catch {
      return new Set();
    }
  }

  function readManualTrackCache() {
    try {
      const saved = JSON.parse(localStorage.getItem(MANUAL_TRACK_CACHE_KEY) || "{}");
      return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    } catch {
      return {};
    }
  }

  function saveManualTracked() {
    localStorage.setItem(MANUAL_TRACK_KEY, JSON.stringify([...manualTracked]));
    const nextCache = {};
    [...manualTracked].forEach(key => {
      if (manualTrackCache[key]) nextCache[key] = manualTrackCache[key];
    });
    manualTrackCache = nextCache;
    localStorage.setItem(MANUAL_TRACK_CACHE_KEY, JSON.stringify(manualTrackCache));
  }

  function questKey(quest) {
    const base = String(quest?.instanceId || quest?.itemHash || quest?.hash || "");
    const owner = String(quest?.fireteamOwnerKey || quest?.ownerKey || "");
    return owner && base ? `${owner}:${base}` : base;
  }

  function legacyQuestKey(quest) {
    return String(quest?.instanceId || quest?.itemHash || quest?.hash || "");
  }

  function rememberManualQuest(quest) {
    const key = questKey(quest);
    if (!key) return;
    manualTrackCache[key] = {
      hash: quest.hash,
      itemHash: quest.itemHash,
      instanceId: quest.instanceId,
      kind: quest.kind,
      name: quest.name,
      description: quest.description,
      icon: quest.icon,
      source: quest.source,
      fireteamOwner: quest.fireteamOwner,
      fireteamOwnerKey: quest.fireteamOwnerKey,
      questLineName: quest.questLineName,
      questLineDescription: quest.questLineDescription,
      flavorText: quest.flavorText,
      rewards: quest.rewards || [],
      objectiveComplete: quest.objectiveComplete,
      objectiveTotal: quest.objectiveTotal,
      pct: quest.pct,
      character: quest.character ? {
        className: quest.character.className,
        emblemPath: quest.character.emblemPath
      } : null,
      objectives: quest.objectives || [],
      questSteps: quest.questSteps || []
    };
  }

  function questStepHashes(quest) {
    const hashes = new Set();
    [quest?.hash, quest?.itemHash].forEach(hash => {
      if (hash !== undefined && hash !== null && hash !== "") hashes.add(String(hash));
    });
    (quest?.questSteps || []).forEach(step => {
      if (step?.hash !== undefined && step.hash !== null && step.hash !== "") hashes.add(String(step.hash));
    });
    return hashes;
  }

  function sameQuestLine(a, b) {
    const aOwner = String(a?.fireteamOwner || "").toLowerCase();
    const bOwner = String(b?.fireteamOwner || "").toLowerCase();
    if (aOwner && bOwner && aOwner !== bOwner) return false;
    const aLine = String(a?.questLineName || a?.name || "").toLowerCase();
    const bLine = String(b?.questLineName || b?.name || "").toLowerCase();
    if (!aLine || !bLine) return false;
    return aLine === bLine || aLine.includes(bLine) || bLine.includes(aLine);
  }

  function findAdvancedPinnedQuest(cachedQuest, questPool) {
    if (!cachedQuest) return null;
    const stepHashes = questStepHashes(cachedQuest);
    return questPool.find(quest => {
      const liveKey = questKey(quest);
      if (!liveKey || liveKey === questKey(cachedQuest)) return false;
      if (stepHashes.has(String(quest.itemHash || quest.hash || liveKey))) return true;
      return sameQuestLine(cachedQuest, quest);
    }) || null;
  }

  function snapshotPayload(snapshot) {
    return snapshot?.fireteamSnapshot || snapshot || null;
  }

  function snapshotKey(snapshot) {
    const payload = snapshotPayload(snapshot) || {};
    return String(payload.primaryMembershipId || snapshot?.membershipId || snapshot?.player || payload.player || snapshot?.displayName || payload.playerDisplayName || "");
  }

  function snapshotDisplayName(snapshot) {
    const payload = snapshotPayload(snapshot) || {};
    return shortPlayerName(payload) || payload.playerDisplayName || snapshot?.displayName || snapshot?.player || "Unknown Guardian";
  }

  function shortPlayerName(payload = {}) {
    const haystack = [
      payload.player,
      payload.playerDisplayName,
      payload.displayName,
      payload.bungieGlobalDisplayName,
      payload.primaryMembershipId,
      payload.membershipId,
      payload.membership?.membershipId,
      payload.membership?.displayName
    ].filter(Boolean).join(" ").toLowerCase();
    return PLAYER_SHORT_NAMES.find(player => player.needles.some(needle => haystack.includes(needle)))?.label || "";
  }

  function fireteamSnapshotList() {
    const seen = new Set();
    return [latestSnapshot, ...savedSnapshots].filter(Boolean).filter(snapshot => {
      const key = snapshotKey(snapshot);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function allFireteamQuestItems() {
    const byKey = new Map();
    fireteamSnapshotList().forEach(snapshot => {
      const owner = snapshotDisplayName(snapshot);
      const ownerKey = snapshotKey(snapshot);
      (snapshotPayload(snapshot)?.trackedQuestProgress || []).filter(quest => quest.kind !== "record").forEach(quest => {
        const remembered = { ...quest, fireteamOwner: owner, fireteamOwnerKey: ownerKey };
        const key = questKey(remembered);
        if (!key || byKey.has(key)) return;
        byKey.set(key, remembered);
        if (manualTracked.has(key) || manualTracked.has(legacyQuestKey(remembered))) rememberManualQuest(remembered);
      });
    });
    return [...byKey.values()];
  }

  function ownerScopedQuests(snapshot) {
    const payload = snapshotPayload(snapshot);
    const owner = snapshotDisplayName(payload);
    const ownerKey = snapshotKey(payload);
    return (payload?.trackedQuestProgress || []).map(quest => ({
      ...quest,
      fireteamOwner: quest.fireteamOwner || owner,
      fireteamOwnerKey: quest.fireteamOwnerKey || ownerKey
    }));
  }

  function hasLocalAuth() {
    return sessionIsUsable() || hasSavedCode();
  }

  function activeSnapshot() {
    if (selectedSnapshotKey) {
      const saved = savedSnapshots.find(snapshot => snapshotKey(snapshot) === selectedSnapshotKey);
      if (saved) return snapshotPayload(saved);
    }
    if (latestSnapshot) return latestSnapshot;
    // Do not flash another Guardian's cloud snapshot while the signed-in
    // account is still loading its own live profile.
    if (hasLocalAuth()) return null;
    return snapshotPayload(savedSnapshots[0]);
  }

  function setSelectedSnapshot(key) {
    selectedSnapshotKey = key || "";
    renderSnapshot(activeSnapshot());
  }

  function setManualDrawerMinimized(minimized) {
    document.body.classList.toggle("manual-tracker-minimized", minimized);
    localStorage.setItem(MANUAL_DRAWER_KEY, minimized ? "1" : "0");
    if (els.manualTrackDrawerToggle) {
      els.manualTrackDrawerToggle.setAttribute("aria-expanded", minimized ? "false" : "true");
      els.manualTrackDrawerToggle.title = minimized ? "Open manual tracker" : "Minimize manual tracker";
    }
  }

  function ensureFloatingTooltip() {
    if (floatingTooltip) return floatingTooltip;
    floatingTooltip = document.createElement("div");
    floatingTooltip.className = "fireteam-quest-tooltip is-floating";
    floatingTooltip.setAttribute("role", "tooltip");
    floatingTooltip.hidden = true;
    document.body.appendChild(floatingTooltip);
    return floatingTooltip;
  }

  function positionFloatingTooltip(card) {
    if (!floatingTooltip || !card || floatingTooltip.hidden) return;
    const rect = card.getBoundingClientRect();
    const width = Math.min(440, Math.max(300, window.innerWidth - 32));
    const sideRect = document.querySelector(".fireteam-side-column")?.getBoundingClientRect();
    const rightLimit = sideRect && sideRect.left > rect.left ? Math.min(window.innerWidth - 16, sideRect.left - 14) : window.innerWidth - 16;
    let left = rect.left + 34;
    if (left + width > rightLimit) left = rightLimit - width;
    if (left < 16) left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));

    floatingTooltip.style.width = `${width}px`;
    const height = Math.min(floatingTooltip.scrollHeight || 520, window.innerHeight - 24);
    let top = rect.bottom - 66;
    if (top + height > window.innerHeight - 12) top = window.innerHeight - height - 12;
    if (top < 12) top = 12;

    floatingTooltip.style.setProperty("--tooltip-left", `${Math.round(left)}px`);
    floatingTooltip.style.setProperty("--tooltip-top", `${Math.round(top)}px`);
  }

  function showFloatingTooltip(card) {
    const source = card?.querySelector(".fireteam-quest-tooltip");
    if (!source) return;
    const tooltip = ensureFloatingTooltip();
    floatingTooltipCard = card;
    tooltip.innerHTML = source.innerHTML;
    tooltip.hidden = false;
    positionFloatingTooltip(card);
  }

  function hideFloatingTooltip(card = null) {
    if (card && floatingTooltipCard !== card) return;
    floatingTooltipCard = null;
    if (floatingTooltip) floatingTooltip.hidden = true;
  }

  function syncFloatingTooltipTarget(event) {
    if (!floatingTooltipCard) return;
    const card = event.target.closest?.(".fireteam-progress-card") || null;
    if (!card) {
      hideFloatingTooltip();
      return;
    }
    if (card !== floatingTooltipCard) showFloatingTooltip(card);
  }

  function classFilterMatches(quest) {
    if (!classFilter) return true;
    const confidentClass = quest?.character?.className || (["Warlock", "Hunter", "Titan"].includes(quest?.source) ? quest.source : "");
    return !confidentClass || confidentClass === classFilter;
  }

  function nowSeconds() {
    return Math.floor(Date.now() / 1000);
  }

  function sessionIsUsable() {
    if (window.D2_COLLECTIONS_AUTH?.sessionIsUsable?.()) return true;
    const saved = readJson(SESSION_KEY);
    const now = nowSeconds() + 60;
    return Boolean(!saved.auth_error && (
      (saved.access_token && saved.expires_at > now) ||
      (saved.server_session_token && (!saved.refresh_expires_at || saved.refresh_expires_at > now)) ||
      (saved.refresh_token && (!saved.refresh_expires_at || saved.refresh_expires_at > now))
    ));
  }

  function hasSavedCode() {
    return Boolean(readJson(AUTH_KEY).oauthCode);
  }

  function setStatus(text, kind = "idle") {
    if (!els.statusBox) return;
    els.statusBox.textContent = text;
    els.statusBox.dataset.kind = kind;
  }

  function setAuthState(text) {
    if (els.authState) els.authState.textContent = text;
    if (els.loginBtn) els.loginBtn.textContent = sessionIsUsable() || hasSavedCode() ? "Refresh Bungie login" : "Sign in with Bungie";
  }

  function formatDate(value) {
    if (!value) return "Never";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return date.toLocaleString();
  }

  function formatShort(value) {
    if (!value) return "No sync";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function formatCompactNumber(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number) || number <= 0) return "";
    if (number >= 1000000) return `${Math.round(number / 100000) / 10}m`;
    if (number >= 10000) return `${Math.round(number / 1000)}k`;
    return String(number);
  }

  function headerStatMarkup(className, icon, label, value) {
    if (!value && value !== 0) return "";
    const iconMarkup = icon
      ? `<img class="stat-icon" src="${escapeHtml(icon)}" alt="" width="16" height="16" loading="lazy" decoding="async" aria-hidden="true" />`
      : `<i class="stat-icon" aria-hidden="true"></i>`;
    return `<span class="${escapeHtml(className)}" title="${escapeHtml(`${label}: ${value}`)}">${iconMarkup}<em>${escapeHtml(label)}</em><strong>${escapeHtml(value)}</strong></span>`;
  }

  function headerClassStatMarkup(className, icon) {
    if (!className || !icon) return "";
    return `<span class="stat-class" title="${escapeHtml(`Class: ${className}`)}"><img class="stat-icon" src="${escapeHtml(icon)}" alt="" width="16" height="16" loading="lazy" decoding="async" aria-hidden="true" /><em>${escapeHtml(className)}</em></span>`;
  }

  function apiBase() {
    return String(CONFIG.cloudSyncApi || "").replace(/\/+$/, "");
  }

  function apiKey() {
    return CONFIG.apiKey || localStorage.getItem("d2-collections-bungie-api-key") || "";
  }

  function authRedirectUri() {
    return CONFIG.redirectUri || "https://erebusares.github.io/D2-Collections/index.html";
  }

  function buildAuthUrl() {
    const state = crypto?.randomUUID?.() || String(Date.now());
    localStorage.setItem(STATE_KEY, state);
    localStorage.setItem(RETURN_KEY, new URL("fireteam.html", window.location.href).toString());
    const params = new URLSearchParams({
      client_id: CONFIG.clientId || "53180",
      response_type: "code",
      redirect_uri: authRedirectUri(),
      state
    });
    return `${CONFIG.authUrl || "https://www.bungie.net/en/OAuth/Authorize"}?${params.toString()}`;
  }

  function captureOAuthCode() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (!code) return false;
    const returnedState = url.searchParams.get("state") || "";
    const expectedState = localStorage.getItem(STATE_KEY) || "";
    if (expectedState && returnedState !== expectedState) {
      setStatus("Bungie login returned with a state mismatch. Try signing in again.", "warn");
      return false;
    }
    writeJson(AUTH_KEY, {
      ...readJson(AUTH_KEY),
      oauthCode: code,
      lastSaved: new Date().toISOString()
    });
    localStorage.removeItem(STATE_KEY);
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, document.title, url.toString());
    return true;
  }

  async function accessToken() {
    if (window.D2_COLLECTIONS_AUTH?.ensureAccessToken) {
      return window.D2_COLLECTIONS_AUTH.ensureAccessToken(els.statusBox);
    }
    const saved = readJson(SESSION_KEY);
    if (saved.access_token && saved.expires_at > nowSeconds() + 60) return saved.access_token;
    throw new Error("No shared Bungie auth helper loaded. Sign in again from Fireteam.");
  }

  async function bungieGet(path) {
    const key = apiKey();
    if (!key) throw new Error("Missing Bungie API key in data/bungie-config.js.");
    const token = await accessToken();
    const response = await fetch(`${API_ROOT}${path}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "X-API-Key": key
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ErrorCode > 1) {
      throw new Error(data.Message || data.error || `Bungie request failed (${response.status}).`);
    }
    return data.Response || data;
  }

  function orderedDestinyMemberships(memberships) {
    const list = memberships.destinyMemberships || [];
    const primary = list.find(item => String(item.membershipId) === String(memberships.primaryMembershipId));
    return primary ? [primary, ...list.filter(item => item !== primary)] : list;
  }

  function membershipTypeLabel(type) {
    return MEMBERSHIP_LABELS[Number(type)] || `Type ${type || "?"}`;
  }

  function characterSummaries(profile) {
    return Object.values(profile?.characters?.data || {}).map(character => ({
      characterId: String(character.characterId || ""),
      emblemHash: String(character.emblemHash || ""),
      className: CLASS_LABELS[String(character.classHash)] || "Guardian",
      raceName: RACE_LABELS[String(character.raceHash)] || "",
      light: Number(character.light || 0),
      emblemPath: character.emblemPath || "",
      emblemBackgroundPath: character.emblemBackgroundPath || "",
      lastPlayed: character.dateLastPlayed || "",
      minutesPlayedTotal: Number(character.minutesPlayedTotal || 0)
    })).sort((a, b) => b.light - a.light || a.className.localeCompare(b.className));
  }

  function progressionPct(progression) {
    const progress = Number(progression?.progressToNextLevel || progression?.progress || 0);
    const next = Number(progression?.nextLevelAt || progression?.completionValue || 0);
    return next > 0 ? Math.max(0, Math.min(100, Math.round((progress / next) * 100))) : 0;
  }

  function seasonProgressSummary(profile) {
    const data = profile?.profileProgression?.data || {};
    const profileData = profile?.profile?.data || {};
    const artifact = data.seasonalArtifact || {};
    const seasonPass = data.seasonPassProgression || data.currentSeasonPassProgression || {};
    const candidates = [
      data.seasonPassProgression,
      data.currentSeasonPassProgression,
      data.seasonalRankProgression
    ].filter(Boolean);
    const progression = candidates.find(item => Number(item?.nextLevelAt || item?.completionValue || 0) > 0) || candidates[0] || null;
    const rank = Number(
      seasonPass.level ||
      seasonPass.rank ||
      seasonPass.currentLevel ||
      data.seasonPassRank ||
      data.currentSeasonPassRank ||
      data.seasonRank ||
      data.currentSeasonRank ||
      profileData.seasonPassRank ||
      profileData.currentSeasonPassRank ||
      profileData.seasonRank ||
      profileData.currentSeasonRank ||
      0
    );
    const progress = Number(progression?.progressToNextLevel || progression?.progress || 0);
    const next = Number(progression?.nextLevelAt || progression?.completionValue || 0);
    return {
      rank,
      progress,
      next,
      pct: progressionPct(progression),
      label: rank ? "Season Rank" : "Season Progress"
    };
  }

  function profileStatSummary(profile) {
    const progression = profile?.profileProgression?.data || {};
    const profileData = profile?.profile?.data || {};
    const records = profile?.profileRecords?.data || {};
    const guardianRank = Number(
      progression.currentGuardianRank ||
      progression.lifetimeHighestGuardianRank ||
      profileData.currentGuardianRank ||
      profileData.lifetimeHighestGuardianRank ||
      0
    );
    const recordScore = Number(
      records.score ||
      records.activeScore ||
      records.legacyScore ||
      profileData.triumphScore ||
      0
    );
    return { guardianRank, recordScore };
  }

  function characterMap(profile) {
    return new Map(characterSummaries(profile).map(character => [character.characterId, character]));
  }

  function characterLabel(characterId, characters) {
    if (!characterId) return "Profile";
    const character = characters.get(String(characterId));
    return character?.className || "Guardian";
  }

  function recordCache() {
    return readJson(RECORD_CACHE_KEY);
  }

  function saveRecordCache(cache) {
    writeJson(RECORD_CACHE_KEY, cache);
  }

  function itemCache() {
    return readJson(ITEM_CACHE_KEY);
  }

  function saveItemCache(cache) {
    writeJson(ITEM_CACHE_KEY, cache);
  }

  function objectiveCache() {
    return readJson(OBJECTIVE_CACHE_KEY);
  }

  function saveObjectiveCache(cache) {
    writeJson(OBJECTIVE_CACHE_KEY, cache);
  }

  function reusableDefinition(entry) {
    if (!entry) return false;
    if (!entry.unresolved) return true;
    const resolvedAt = Date.parse(entry.resolvedAt || "");
    return Number.isFinite(resolvedAt) && Date.now() - resolvedAt < 10 * 60 * 1000;
  }

  async function mapWithConcurrency(values, limit, mapper) {
    const items = Array.from(values || []);
    const results = new Array(items.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await mapper(items[index], index);
      }
    });
    await Promise.all(workers);
    return results;
  }

  async function recordDefinition(hash, cache) {
    const key = String(hash);
    if (reusableDefinition(cache[key])) return cache[key];
    try {
      const def = await bungieGet(`/Destiny2/Manifest/DestinyRecordDefinition/${encodeURIComponent(key)}/?lc=en`);
      const name = def?.displayProperties?.name || "";
      cache[key] = {
        name: name || `Record ${key}`,
        description: def?.displayProperties?.description || "",
        icon: def?.displayProperties?.icon || "",
        unresolved: !name,
        resolvedAt: new Date().toISOString()
      };
    } catch {
      cache[key] = { name: `Record ${key}`, description: "", icon: "", resolvedAt: new Date().toISOString(), unresolved: true };
    }
    saveRecordCache(cache);
    return cache[key];
  }

  async function itemDefinition(hash, cache) {
    const key = String(hash);
    if (reusableDefinition(cache[key])) return cache[key];
    try {
      const def = await bungieGet(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${encodeURIComponent(key)}/?lc=en`);
      const display = def?.displayProperties || {};
      cache[key] = {
        hash: key,
        name: display.name || `Item ${key}`,
        description: display.description || "",
        icon: display.icon || "",
        secondaryIcon: def?.secondaryIcon || display.secondaryIcon || "",
        secondaryOverlay: def?.secondaryOverlay || display.secondaryOverlay || "",
        secondarySpecial: def?.secondarySpecial || display.secondarySpecial || "",
        flavorText: def?.flavorText || "",
        itemType: Number(def?.itemType || 0),
        itemTypeDisplayName: def?.itemTypeDisplayName || "",
        itemTypeAndTierDisplayName: def?.itemTypeAndTierDisplayName || "",
        itemCategoryHashes: def?.itemCategoryHashes || [],
        inventoryBucketHash: def?.inventory?.bucketTypeHash || "",
        objectiveHashes: def?.objectives?.objectiveHashes || [],
        rewardItemHashes: (def?.value?.itemValue || def?.value?.items || def?.rewardItems || [])
          .map(entry => String(entry.itemHash || entry.hash || entry.item || ""))
          .filter(Boolean),
        setData: def?.setData ? {
          questLineName: def.setData.questLineName || "",
          questLineDescription: def.setData.questLineDescription || "",
          questStepSummary: def.setData.questStepSummary || "",
          setType: def.setData.setType || "",
          itemList: (def.setData.itemList || []).map(entry => ({
            itemHash: String(entry.itemHash || entry.hash || ""),
            trackingValue: entry.trackingValue || 0
          })).filter(entry => entry.itemHash)
        } : null,
        resolvedAt: new Date().toISOString()
      };
    } catch {
      cache[key] = { hash: key, name: `Item ${key}`, description: "", icon: "", flavorText: "", itemType: 0, itemTypeDisplayName: "", rewardItemHashes: [], unresolved: true, resolvedAt: new Date().toISOString() };
    }
    saveItemCache(cache);
    return cache[key];
  }

  async function objectiveDefinition(hash, cache) {
    const key = String(hash || "");
    if (!key) return { name: "Objective", description: "" };
    if (reusableDefinition(cache[key])) return cache[key];
    try {
      const def = await bungieGet(`/Destiny2/Manifest/DestinyObjectiveDefinition/${encodeURIComponent(key)}/?lc=en`);
      const display = def?.displayProperties || {};
      cache[key] = {
        name: display.name || `Objective ${key}`,
        description: display.description || "",
        progressDescription: def?.progressDescription || "",
        resolvedAt: new Date().toISOString()
      };
    } catch {
      cache[key] = { name: `Objective ${key}`, description: "", progressDescription: "", unresolved: true, resolvedAt: new Date().toISOString() };
    }
    saveObjectiveCache(cache);
    return cache[key];
  }

  function isGeneratedHashLabel(value, prefix = "Item") {
    return new RegExp(`^${prefix}\\s+\\d+$`, "i").test(String(value || "").trim());
  }

  async function resolveObjectiveRows(items) {
    const cache = objectiveCache();
    const hashes = [...new Set(items.flatMap(item => item.objectives || []).map(row => row.objectiveHash).filter(Boolean))];
    await mapWithConcurrency(hashes, 6, hash => objectiveDefinition(hash, cache));
    items.forEach(item => {
      item.objectives = (item.objectives || []).map(row => {
        const def = cache[row.objectiveHash] || {};
        return {
          ...row,
          name: def.progressDescription || def.name || `Objective ${row.objectiveHash}`,
          description: def.description || ""
        };
      });
    });
    return items;
  }

  async function questTimelineForItem(definition, currentHash, liveObjectives = [], fallbackQuest = null) {
    const liveObjectiveCache = objectiveCache();
    await mapWithConcurrency(
      [...new Set(liveObjectives.map(row => row.objectiveHash).filter(Boolean))],
      6,
      hash => objectiveDefinition(hash, liveObjectiveCache)
    );
    const liveRows = liveObjectives.map(row => {
      const def = liveObjectiveCache[row.objectiveHash] || {};
      return {
        ...row,
        name: row.name || def.progressDescription || def.name || `Objective ${row.objectiveHash || ""}`,
        description: row.description || def.description || ""
      };
    });
    const chain = definition?.setData?.itemList || [];
    if (!chain.length) {
      return [{
        hash: String(currentHash || ""),
        name: isGeneratedHashLabel(definition?.name) ? (fallbackQuest?.name || "Current step") : (definition?.name || fallbackQuest?.name || "Current step"),
        description: definition?.description || fallbackQuest?.description || "",
        status: "current",
        objectives: liveRows
      }];
    }

    const cache = itemCache();
    const objectiveDefs = objectiveCache();
    const current = String(currentHash || "");
    const chainEntries = chain.slice(0, 24);
    const stepDefinitions = await mapWithConcurrency(chainEntries, 6, entry => itemDefinition(String(entry.itemHash || ""), cache));
    const allObjectiveHashes = [...new Set(stepDefinitions.flatMap(step => step.objectiveHashes || []).filter(Boolean))];
    await mapWithConcurrency(allObjectiveHashes, 6, hash => objectiveDefinition(hash, objectiveDefs));
    const steps = chainEntries.map((entry, index) => {
      const hash = String(entry.itemHash || "");
      const stepDef = stepDefinitions[index] || {};
      const objectiveHashes = stepDef.objectiveHashes || [];
      return {
        hash,
        name: isGeneratedHashLabel(stepDef.name)
          ? (definition?.setData?.questLineName || fallbackQuest?.questLineName || fallbackQuest?.name || `Step ${index + 1}`)
          : (stepDef.name || definition?.setData?.questLineName || fallbackQuest?.name || "Quest step"),
        description: stepDef.description || stepDef.setData?.questStepSummary || "",
        icon: stepDef.icon || "",
        objectives: objectiveHashes.map(objectiveHash => {
          const def = objectiveDefs[objectiveHash] || {};
          return {
            objectiveHash,
            name: def.progressDescription || def.name || `Objective ${objectiveHash}`,
            description: def.description || "",
            progress: 0,
            total: 0,
            complete: false
          };
        })
      };
    });

    const currentIndex = Math.max(0, steps.findIndex(step => step.hash === current));
    steps.forEach((step, index) => {
      step.status = index < currentIndex ? "past" : index === currentIndex ? "current" : "future";
      if (step.status === "past") {
        step.objectives = step.objectives.map(row => ({ ...row, complete: true }));
      }
      if (step.status === "current" && liveRows.length) {
        step.objectives = liveRows;
      }
    });
    return steps;
  }

  function activeObjectiveHashes(profile) {
    const hashes = new Set();
    Object.values(profile?.itemComponents?.objectives?.data || {}).forEach(item => {
      (item?.objectives || []).forEach(objective => {
        if (objective?.objectiveHash !== undefined && objective?.objectiveHash !== null) {
          hashes.add(String(objective.objectiveHash));
        }
      });
    });
    return hashes;
  }

  function objectiveSummary(objectives = [], activeHashes = new Set()) {
    const rows = objectives.map(objective => {
      const progress = Number(objective.progress || 0);
      const total = Number(objective.completionValue || 0);
      const objectiveHash = String(objective.objectiveHash || "");
      return {
        progress,
        total,
        complete: Boolean(objective.complete) || (total > 0 && progress >= total),
        objectiveHash,
        active: objectiveHash ? activeHashes.has(objectiveHash) : false
      };
    });
    const complete = rows.filter(row => row.complete).length;
    return {
      rows,
      complete,
      total: rows.length,
      active: rows.filter(row => row.active).length,
      pct: rows.length ? Math.round((complete / rows.length) * 100) : 0
    };
  }

  function inventoryObjectiveItems(profile, characters) {
    const objectiveData = profile?.itemComponents?.objectives?.data || {};
    const items = [];
    const addItems = (source, characterId, entries = []) => {
      (entries || []).forEach(item => {
        const instanceId = String(item?.itemInstanceId || "");
        const objectiveComponent = objectiveData[instanceId] || {};
        if (!instanceId || !objectiveComponent.objectives?.length) return;
        const itemState = Number(item.state || 0);
        const tracked = Boolean(
          itemState & ITEM_STATE_TRACKED ||
          item.tracked ||
          item.isTracked ||
          item.tracking ||
          objectiveComponent.tracked ||
          objectiveComponent.isTracked ||
          objectiveComponent.tracking
        );
        items.push({
          hash: String(item.itemHash || ""),
          itemHash: String(item.itemHash || ""),
          instanceId,
          bucketHash: String(item.bucketHash || ""),
          expirationDate: item.expirationDate || "",
          itemState,
          tracked,
          highlightedObjective: Boolean(itemState & ITEM_STATE_HIGHLIGHTED_OBJECTIVE),
          source: characterId ? characterLabel(characterId, characters) : source,
          characterId: characterId || "",
          character: characters.get(String(characterId)) || null,
          objectives: objectiveComponent.objectives || []
        });
      });
    };
    addItems("Profile inventory", "", profile?.profileInventory?.data?.items);
    Object.entries(profile?.characterInventories?.data || {}).forEach(([characterId, data]) => addItems(`Character ${characterId}`, characterId, data?.items));
    return items.filter(item => item.itemHash);
  }

  function classifyQuestItem(definition = {}, item = {}) {
    const text = [
      definition.itemTypeDisplayName,
      definition.itemTypeAndTierDisplayName,
      definition.name,
      definition.description
    ].join(" ").toLowerCase();
    if (/\border(s)?\b/.test(text) || /seasonal arsenal|rewards pass/.test(text)) return "order";
    if (item.expirationDate) return "bounty";
    if (text.includes("bounty")) return "bounty";
    if (text.includes("quest")) return "quest";
    if (text.includes("pursuit")) return "quest";
    if (Number(definition.itemType) === 26) return "bounty";
    if (Number(definition.itemType) === 12) return "quest";
    return "pursuit";
  }

  function isCatalystQuest(definition = {}) {
    const text = [
      definition.itemTypeDisplayName,
      definition.itemTypeAndTierDisplayName,
      definition.name,
      definition.description,
      definition.setData?.questLineName,
      definition.setData?.questLineDescription,
      definition.setData?.questStepSummary
    ].join(" ").toLowerCase();
    return /\bcatalyst\b/.test(text);
  }

  async function rewardItemsForDefinition(definition = {}, cache) {
    const hashes = [...new Set(definition.rewardItemHashes || [])].filter(hash => hash && hash !== String(definition.hash || ""));
    const rewards = await mapWithConcurrency(hashes.slice(0, 4), 4, async hash => {
      const reward = await itemDefinition(hash, cache);
      if (!reward?.name || reward.unresolved) return null;
      return {
        hash,
        name: reward.name,
        icon: reward.icon || "",
        itemTypeDisplayName: reward.itemTypeDisplayName || ""
      };
    });
    return rewards.filter(Boolean);
  }

  async function activeQuestItems(profile, activeHashes, characters) {
    const cache = itemCache();
    const items = inventoryObjectiveItems(profile, characters);
    return mapWithConcurrency(items, 6, async item => {
      const definition = await itemDefinition(item.itemHash, cache);
      const summary = objectiveSummary(item.objectives, activeHashes);
      const complete = summary.rows.length > 0 && summary.rows.every(row => row.complete);
      const catalystQuest = isCatalystQuest(definition);
      const rewards = await rewardItemsForDefinition(definition, cache);
      return {
        hash: item.itemHash,
        itemHash: item.itemHash,
        instanceId: item.instanceId,
        bucketHash: item.bucketHash,
        expirationDate: item.expirationDate,
        source: item.source,
        characterId: item.characterId,
        character: item.character,
        kind: classifyQuestItem(definition, item),
        catalystQuest,
        complete,
        inInventory: true,
        inGameTracked: Boolean(item.tracked),
        highlightedObjective: Boolean(item.highlightedObjective),
        itemState: item.itemState,
        activeObjectiveCount: summary.active || summary.total,
        objectives: summary.rows,
        objectiveComplete: summary.complete,
        objectiveTotal: summary.total,
        questLineName: definition.setData?.questLineName || definition.name || "",
        questLineDescription: definition.setData?.questLineDescription || "",
        flavorText: definition.flavorText || "",
        rewards,
        setData: definition.setData || null,
        pct: summary.pct,
        name: definition.name || `Item ${item.itemHash}`,
        description: definition.description || "",
        icon: definition.icon || "",
        unresolved: Boolean(definition.unresolved)
      };
    });
  }

  async function enrichCharacterEmblems(characters = []) {
    const cache = itemCache();
    await mapWithConcurrency(characters, 3, async character => {
      if (!character.emblemHash) return;
      const definition = await itemDefinition(character.emblemHash, cache);
      character.emblemIconPath = definition.secondarySpecial || definition.secondaryOverlay || definition.secondaryIcon || character.emblemPath || "";
    });
    return characters;
  }

  async function trackedQuestProgress(profile) {
    const activeHashes = activeObjectiveHashes(profile);
    const characters = characterMap(profile);
    const activeItems = await activeQuestItems(profile, activeHashes, characters);
    const records = [];
    const addRecords = (source, entries = {}, characterId = "") => {
      Object.entries(entries || {}).forEach(([hash, entry]) => {
        const objectives = entry?.objectives || [];
        if (!objectives.length) return;
        const summary = objectiveSummary(objectives, activeHashes);
        const hasProgress = summary.rows.some(row => row.progress > 0 || row.complete);
        const complete = summary.rows.length > 0 && summary.rows.every(row => row.complete);
        const inGameTracked = Boolean(entry?.tracked || entry?.tracking || entry?.isTracked);
        if (!hasProgress && complete) return;
        records.push({
          hash: String(hash),
          source,
          characterId,
          character: characters.get(String(characterId)) || null,
          kind: "record",
          complete,
          state: Number(entry.state || 0),
          inGameTracked,
          activeObjectiveCount: summary.active,
          objectives: summary.rows,
          objectiveComplete: summary.complete,
          objectiveTotal: summary.total,
          pct: summary.pct
        });
      });
    };
    addRecords("Profile", profile?.profileRecords?.data?.records);
    Object.entries(profile?.characterRecords?.data || {}).forEach(([characterId, data]) => addRecords(characterLabel(characterId, characters), data?.records, characterId));

    const cache = recordCache();
    const top = records
      .sort((a, b) => Number(b.inGameTracked) - Number(a.inGameTracked) || Number(a.complete) - Number(b.complete) || b.pct - a.pct)
      .slice(0, MAX_RECORD_ITEMS);
    await mapWithConcurrency(top.slice(0, 12), 6, async item => {
      item.definition = await recordDefinition(item.hash, cache);
    });
    const recordItems = top.map(item => ({
      ...item,
      name: item.definition?.name || `Record ${item.hash}`,
      description: item.definition?.description || "",
      icon: item.definition?.icon || "",
      unresolved: Boolean(item.definition?.unresolved)
    }));
    const combined = [...activeItems, ...recordItems]
      .sort((a, b) => Number(b.inGameTracked) - Number(a.inGameTracked) || Number(b.inInventory) - Number(a.inInventory) || Number(a.complete) - Number(b.complete) || b.pct - a.pct);
    return resolveObjectiveRows(combined);
  }

  function suggestionMatches(quest, suggestion) {
    const haystack = [quest.name, quest.description, quest.hash].join(" ").toLowerCase();
    return (suggestion.match || []).some(term => haystack.includes(String(term).toLowerCase()));
  }

  function suggestedActivities(quests) {
    const suggestions = [];
    (ACTIVITY_MAP.suggestions || []).forEach(rule => {
      const matches = quests.filter(quest => suggestionMatches(quest, rule));
      if (!matches.length) return;
      suggestions.push({
        id: rule.id,
        label: rule.label,
        activity: rule.activity,
        priority: rule.priority || "Next",
        count: matches.length,
        sample: matches[0]?.name || ""
      });
    });
    if (!suggestions.length) {
      suggestions.push({
        id: "review",
        label: "Review tracked objectives",
        activity: quests.length ? "Open the highest-progress incomplete records in game and confirm current quest steps." : "Refresh from Bungie after picking up quests, bounties, or progressing objectives.",
        priority: "Baseline",
        count: quests.length,
        sample: quests[0]?.name || ""
      });
    }
    return suggestions;
  }

  function displayName(memberships, membership) {
    return membership?.displayName || memberships?.bungieNetUser?.uniqueName || memberships?.bungieNetUser?.displayName || "Unknown Guardian";
  }

  async function buildFireteamSnapshot() {
    setStatus("Reading Bungie memberships...", "loading");
    const memberships = await bungieGet("/User/GetMembershipsForCurrentUser/");
    const membership = orderedDestinyMemberships(memberships)[0];
    if (!membership?.membershipType || !membership?.membershipId) {
      throw new Error("No Destiny membership was available for this Bungie account.");
    }

    setStatus(`Reading profile for ${displayName(memberships, membership)}...`, "loading");
    const components = "100,102,103,104,200,201,202,204,301,800,900,1200";
    const profile = await bungieGet(`/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?components=${components}`);
    const characters = await enrichCharacterEmblems(characterSummaries(profile));
    const quests = await trackedQuestProgress(profile);
    const questItems = quests.filter(item => item.kind !== "record");
    const activities = suggestedActivities(questItems);
    const inventoryQuestItemCount = quests.filter(item => item.inInventory).length;
    const trackedQuestItemCount = questItems.filter(item => item.inGameTracked).length;
    const updatedAt = new Date().toISOString();
    return {
      ok: true,
      kind: "fireteam",
      updatedAt,
      playerDisplayName: displayName(memberships, membership),
      bungieGlobalDisplayName: memberships?.bungieNetUser?.uniqueName || memberships?.bungieNetUser?.displayName || "",
      primaryMembershipId: memberships.primaryMembershipId || membership.membershipId || "",
      membership: {
        membershipType: membership.membershipType,
        membershipTypeLabel: membershipTypeLabel(membership.membershipType),
        membershipId: membership.membershipId,
        displayName: membership.displayName || ""
      },
      membershipCount: (memberships.destinyMemberships || []).length,
      characterSummaries: characters,
      seasonProgress: seasonProgressSummary(profile),
      profileStats: profileStatSummary(profile),
      activeQuestItemCount: inventoryQuestItemCount,
      inventoryQuestItemCount,
      trackedQuestItemCount,
      trackedQuestProgress: quests,
      suggestedActivities: activities
    };
  }

  function iconUrl(path) {
    if (!path) return "";
    return path.startsWith("/") ? `https://www.bungie.net${path}` : path;
  }

  function renderPlayer(snapshot) {
    if (!snapshot) {
      if (els.playerName) els.playerName.textContent = "Not linked";
      if (els.profileGuardianName) els.profileGuardianName.textContent = "Fireteam Progress";
      if (els.profileGuardianMeta) {
        els.profileGuardianMeta.style.setProperty("--season-progress", "0%");
        els.profileGuardianMeta.innerHTML = `<span>Season Progress</span><strong>Sign in to load Guardian data</strong>`;
      }
      if (els.profileTopStats) els.profileTopStats.innerHTML = "";
      if (els.profileEmblem) {
        els.profileEmblem.src = "assets/d2-collections-mark.svg";
        els.profileEmblem.classList.remove("is-game-emblem");
      }
      if (els.profileBannerImage) els.profileBannerImage.style.removeProperty("background-image");
      document.documentElement.style.removeProperty("--fireteam-profile-banner-image");
      renderProfileCharacterSelector(null);
      if (els.playerMeta) els.playerMeta.innerHTML = `<span>Sign in to read your Bungie profile and save a fireteam snapshot.</span>`;
      if (els.lastUpdated) els.lastUpdated.textContent = "Never";
      return;
    }
    const visiblePlayerName = snapshotDisplayName(snapshot);
    if (els.playerName) els.playerName.textContent = visiblePlayerName;
    if (els.profileGuardianName) els.profileGuardianName.textContent = visiblePlayerName;
    const selectedCharacter = classFilter
      ? snapshot.characterSummaries?.find(character => character.className === classFilter)
      : snapshot.characterSummaries?.[0];
    const maxLight = snapshot.characterSummaries?.length ? Math.max(...snapshot.characterSummaries.map(character => Number(character.light || 0))) : 0;
    const displayLight = Number(selectedCharacter?.light || maxLight || 0);
    const season = snapshot.seasonProgress || {};
    if (els.profileTopStats) {
      const stats = snapshot.profileStats || {};
      const guardianRank = Number(stats.guardianRank || 0);
      const selectedClass = selectedCharacter?.className || classFilter || "";
      const selectedClassIcon = classIconPath(selectedClass);
      els.profileTopStats.innerHTML = [
        season.rank ? headerStatMarkup("stat-season", "assets/dim-icons/bt_season_rank.svg", "Season Pass Rank", season.rank) : "",
        guardianRank ? headerStatMarkup("stat-rank", "assets/dim-icons/bt_guardian_rank.svg", "Guardian Rank", guardianRank) : "",
        selectedClass && selectedClassIcon ? headerClassStatMarkup(selectedClass, selectedClassIcon) : "",
        displayLight ? headerStatMarkup("is-power", "assets/dim-icons/bt_light_level.svg", "Light", `+${displayLight}`) : ""
      ].filter(Boolean).join("");
    }
    if (els.profileEmblem) {
      const emblem = selectedCharacter?.emblemIconPath || selectedCharacter?.emblemPath || snapshot.characterSummaries?.find(character => character.emblemIconPath || character.emblemPath)?.emblemIconPath || snapshot.characterSummaries?.find(character => character.emblemPath)?.emblemPath || "";
      els.profileEmblem.src = emblem ? iconUrl(emblem) : "assets/d2-collections-mark.svg";
      els.profileEmblem.classList.toggle("is-game-emblem", Boolean(emblem));
    }
    const banner = selectedCharacter?.emblemBackgroundPath || snapshot.characterSummaries?.find(character => character.emblemBackgroundPath)?.emblemBackgroundPath || "";
    if (banner) {
      const bannerUrl = iconUrl(banner);
      if (els.profileBannerImage) els.profileBannerImage.style.backgroundImage = `url("${bannerUrl}")`;
      document.documentElement.style.setProperty("--fireteam-profile-banner-image", `url("${bannerUrl}")`);
    } else {
      if (els.profileBannerImage) els.profileBannerImage.style.removeProperty("background-image");
      document.documentElement.style.removeProperty("--fireteam-profile-banner-image");
    }
    if (els.lastUpdated) els.lastUpdated.textContent = formatShort(snapshot.updatedAt);
    if (els.playerMeta) {
      const inventoryCount = snapshot.inventoryQuestItemCount ?? snapshot.activeQuestItemCount ?? 0;
      const trackedCount = snapshot.trackedQuestItemCount ?? (snapshot.trackedQuestProgress || []).filter(item => item.inGameTracked).length;
      if (els.profileGuardianMeta) {
        const progress = Number(season.progress || 0);
        const next = Number(season.next || 0);
        const pct = Number(season.pct || 0);
        els.profileGuardianMeta.style.setProperty("--season-progress", `${pct}%`);
        els.profileGuardianMeta.innerHTML = next
          ? `<span>${escapeHtml(season.label || "Season Progress")}</span><strong>${escapeHtml(progress.toLocaleString())}/${escapeHtml(next.toLocaleString())}</strong>`
          : `<span>Season Progress</span><strong>${escapeHtml(trackedCount)} tracked / ${escapeHtml(inventoryCount)} quest items</strong>`;
      }
      els.playerMeta.innerHTML = [
        metaLine("Player", visiblePlayerName),
        metaLine("Characters", `${snapshot.characterSummaries?.length || 0} loaded`),
        metaLine("Quests", `${trackedCount} tracked / ${inventoryCount} inventory`)
      ].join("");
    }
    renderProfileCharacterSelector(snapshot);
  }

  function metaLine(label, value) {
    return `<span><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</span>`;
  }

  function setProfileSelectorOpen(open) {
    if (!els.profileCharacterSelector || !els.profileSelectorToggle) return;
    els.profileCharacterSelector.hidden = !open;
    els.profileSelectorToggle.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.classList.toggle("fireteam-character-selector-open", open);
  }

  function renderProfileCharacterSelector(snapshot) {
    if (!els.profileCharacterSelector) return;
    const characters = snapshot?.characterSummaries || [];
    if (!characters.length) {
      els.profileCharacterSelector.innerHTML = `<div class="fireteam-selector-empty">Sign in or refresh to load characters.</div>`;
      setProfileSelectorOpen(false);
      return;
    }
    const account = profileAccountName(snapshot);
    const subtitle = snapshot.clanName || snapshot.clan?.name || snapshot.membership?.displayName || snapshot.membership?.membershipTypeLabel || "Guardian profile";
    const season = snapshot.seasonProgress || {};
    const progress = Number(season.progress || 0);
    const next = Number(season.next || 0);
    const pct = next ? Math.max(0, Math.min(100, Math.round((progress / next) * 100))) : Number(season.pct || 0);
    const seasonRank = Number(season.rank || 0);
    els.profileCharacterSelector.innerHTML = `
      <div class="fireteam-selector-account">
        <div>
          <strong>${profileNameMarkup(account)}</strong>
          <span>${escapeHtml(String(subtitle).toUpperCase())}</span>
        </div>
        ${seasonRank ? `<span class="fireteam-selector-rank">${headerStatMarkup("stat-season", "assets/dim-icons/bt_season_rank.svg", "Season Pass Rank", seasonRank)}</span>` : ""}
      </div>
      <div class="fireteam-selector-xp">
        <span>Experience</span>
        <strong>${next ? `${escapeHtml(progress.toLocaleString())}/${escapeHtml(next.toLocaleString())}` : "No season progress"}</strong>
        <i style="width:${pct}%"></i>
      </div>
      <div class="fireteam-selector-list">
        ${characters.map(character => renderProfileCharacterOption(character)).join("")}
      </div>
      <div class="fireteam-selector-actions">
        ${classFilter ? `<button class="fireteam-selector-clear" type="button" data-class-filter="">All classes</button>` : ""}
        <button class="fireteam-selector-search" type="button" data-profile-search>Profile Search</button>
      </div>`;
  }

  function renderProfileCharacterOption(character) {
    const className = character.className || "Guardian";
    const classIcon = classIconPath(className);
    const emblem = character.emblemPath ? iconUrl(character.emblemPath) : "";
    const banner = character.emblemBackgroundPath ? iconUrl(character.emblemBackgroundPath) : "";
    const active = classFilter && className === classFilter;
    const emblemMarkup = emblem
      ? `<img class="selector-emblem" src="${escapeHtml(emblem)}" alt="" width="48" height="48" loading="lazy" decoding="async" aria-hidden="true" />`
      : `<span class="fireteam-icon-fallback">G</span>`;
    const classMarkup = classIcon
      ? `<img class="selector-class" src="${escapeHtml(classIcon)}" alt="" width="34" height="34" loading="lazy" decoding="async" aria-hidden="true" />`
      : "";
    const race = character.raceName || "Guardian";
    return `<button class="fireteam-selector-character ${active ? "active" : ""}" type="button" data-class-filter="${escapeHtml(className)}" aria-pressed="${active ? "true" : "false"}" ${banner ? `style="--character-banner:url('${escapeHtml(banner)}')"` : ""}>
      ${emblemMarkup}
      <span><strong>${escapeHtml(className)}</strong><em>${escapeHtml(race)}</em></span>
      ${classMarkup}
      <b>+${Number(character.light || 0)}</b>
    </button>`;
  }

  function profileAccountName(snapshot = {}) {
    return snapshot.bungieGlobalDisplayName || snapshot.playerDisplayName || snapshot.displayName || snapshot.membership?.displayName || snapshotDisplayName(snapshot);
  }

  function profileNameMarkup(name) {
    const value = String(name || "Guardian");
    const match = value.match(/^(.*?)(#\d+)$/);
    if (!match) return escapeHtml(value);
    return `${escapeHtml(match[1])}<em>${escapeHtml(match[2])}</em>`;
  }

  function renderMembers(snapshots = []) {
    const latestKey = snapshotKey(latestSnapshot);
    const list = latestSnapshot
      ? [latestSnapshot, ...snapshots.filter(snapshot => snapshotKey(snapshot) !== latestKey)]
      : snapshots;
    if (els.memberCount) els.memberCount.textContent = `${list.length} saved`;
    if (!els.membersList) return;
    if (!list.length) {
      els.membersList.innerHTML = emptyState("No known fireteam snapshots yet. Refresh from Bungie to save the first one.");
      return;
    }
    const activeKey = snapshotKey(activeSnapshot());
    els.membersList.innerHTML = list.map(snapshot => {
      const payload = snapshotPayload(snapshot) || {};
      const key = snapshotKey(snapshot);
      const chars = payload.characterSummaries || [];
      const display = snapshotDisplayName(snapshot);
      const updatedAt = snapshot.syncedAt || payload.updatedAt || "";
      const questItems = (payload.trackedQuestProgress || []).filter(item => item.kind !== "record");
      const trackedCount = payload.trackedQuestItemCount ?? questItems.filter(item => item.inGameTracked).length;
      const active = key && key === activeKey;
      return `<article class="fireteam-mini-card fireteam-member-card ${active ? "active" : ""}" role="button" tabindex="0" data-view-snapshot="${escapeHtml(key)}" aria-pressed="${active ? "true" : "false"}">
        <div>
          <strong>${escapeHtml(display)}</strong>
          <span>${escapeHtml(formatShort(updatedAt))} / ${escapeHtml(trackedCount)} tracked / ${escapeHtml(questItems.length)} quests</span>
        </div>
        <div class="fireteam-character-row">${chars.slice(0, 3).map(renderCharacterPill).join("") || `<span class="badge">No characters</span>`}</div>
      </article>`;
    }).join("");
  }

  function socialSnapshotList() {
    const latestKey = snapshotKey(latestSnapshot);
    return latestSnapshot
      ? [latestSnapshot, ...savedSnapshots.filter(snapshot => snapshotKey(snapshot) !== latestKey)]
      : savedSnapshots;
  }

  function setSocialDrawerOpen(open) {
    if (!els.socialDrawer || !els.socialDrawerToggle) return;
    els.socialDrawer.hidden = !open;
    els.socialDrawerToggle.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.classList.toggle("fireteam-social-open", open);
  }

  function renderSocialDrawer() {
    const list = socialSnapshotList();
    if (els.socialCount) els.socialCount.textContent = String(list.length);
    if (els.socialPlayerName) els.socialPlayerName.textContent = snapshotDisplayName(activeSnapshot()) || "Fireteam";
    if (els.socialPlayerMeta) els.socialPlayerMeta.textContent = `${list.length} synced Guardian${list.length === 1 ? "" : "s"}`;
    if (!els.socialList) return;

    const activeKey = snapshotKey(activeSnapshot());
    const visible = socialTab === "clan" ? [] : list;
    if (!visible.length) {
      const message = socialTab === "clan"
        ? "Clan roster sync is not wired yet. Use Fireteam for saved cloud snapshots."
        : "No synced Guardians yet. Refresh from Bungie or wait for a fireteam member snapshot.";
      els.socialList.innerHTML = emptyState(message);
      return;
    }

    els.socialList.innerHTML = visible.map(snapshot => {
      const payload = snapshotPayload(snapshot) || {};
      const key = snapshotKey(snapshot);
      const active = key && key === activeKey;
      const chars = payload.characterSummaries || [];
      const primary = chars[0] || {};
      const emblem = primary.emblemPath ? `<img src="${escapeHtml(iconUrl(primary.emblemPath))}" alt="" width="28" height="28" loading="lazy" decoding="async" aria-hidden="true" />` : `<span></span>`;
      const display = snapshotDisplayName(snapshot);
      const quests = (payload.trackedQuestProgress || []).filter(item => item.kind !== "record");
      const power = chars.length ? Math.max(...chars.map(character => Number(character.light || 0))) : 0;
      return `<button class="fireteam-social-row ${active ? "active" : ""}" type="button" data-view-snapshot="${escapeHtml(key)}" aria-pressed="${active ? "true" : "false"}">
        ${emblem}
        <strong>${escapeHtml(display)}</strong>
        <em>${escapeHtml(formatShort(snapshot.syncedAt || payload.updatedAt || ""))}</em>
        <b>${power || quests.length}</b>
      </button>`;
    }).join("");
  }

  function renderCharacterPill(character) {
    const icon = character.emblemPath ? `<img src="${escapeHtml(iconUrl(character.emblemPath))}" alt="" width="28" height="28" loading="lazy" decoding="async" aria-hidden="true" />` : "";
    const className = character.className || "Guardian";
    const active = classFilter && className === classFilter;
    const classIcon = classIconPath(className);
    const classMarkup = classIcon
      ? `<img class="character-class-icon" src="${escapeHtml(classIcon)}" alt="${escapeHtml(className)}" width="28" height="28" loading="lazy" decoding="async" />`
      : `<strong>${escapeHtml(className)}</strong>`;
    const title = active ? `Clear ${className} filter` : `Show ${className} quests`;
    const buttonAttr = className !== "Guardian" ? ` type="button" data-class-filter="${escapeHtml(className)}" aria-pressed="${active ? "true" : "false"}" aria-label="${escapeHtml(title)}" title="${escapeHtml(title)}"` : "";
    return `<button class="character-pill ${active ? "active" : ""}"${buttonAttr}>${icon}${classMarkup}<em>${Number(character.light || 0)}</em></button>`;
  }

  function classIconPath(className) {
    const key = String(className || "").toLowerCase();
    if (key === "warlock") return "assets/dim-icons/class_warlock.png";
    if (key === "hunter") return "assets/dim-icons/class_hunter.png";
    if (key === "titan") return "assets/dim-icons/class_titan.png";
    return "";
  }

  function questSearchText(quest) {
    return [
      quest?.kind,
      quest?.name,
      quest?.description,
      quest?.source,
      quest?.questLineName,
      quest?.questLineDescription,
      quest?.setData?.questLineName,
      quest?.setData?.questLineDescription,
      quest?.character?.className
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function isSeasonalOrderQuest(quest) {
    if (quest?.kind === "order") return true;
    const text = questSearchText(quest);
    return /\border(s)?\b|seasonal arsenal|rewards pass/.test(text);
  }

  function questCategory(quest) {
    const text = questSearchText(quest);
    if (isSeasonalOrderQuest(quest)) return "edge-of-fate";
    if (quest.kind === "bounty" || /\bbount(y|ies)\b/.test(text)) return "bounty";
    if (/pathfinder/.test(text)) return "pathfinder";
    if (/new light|guardian rank|guardian ranks|tutorial|introduct|cosmodrome|shaw han/.test(text)) return "new-light";
    if (/edge of fate|kepler|altar of relativity|world tier|portal|seasonal hub|the portal|matterspark|fabled|mythic/.test(text)) return "edge-of-fate";
    if (quest.catalystQuest || /exotic|catalyst|banshee|xur|rahool/.test(text)) return "exotics";
    if (/vanguard|crucible|gambit|playlist|ritual|strike|nightfall|gunsmith|shaxx|zavala|drifter|iron banner|trials/.test(text)) return "playlists";
    if (/shadowkeep|moon|essence|europa|beyond light|stasis|throne world|witch queen|neomuna|lightfall|pale heart|final shape|legacy|past|forsaken|dreaming city/.test(text)) return "past";
    return "quest";
  }

  function questMatchesFilter(quest, filter) {
    if (filter === "all") return true;
    if (filter === "tracked") return Boolean(quest.inGameTracked || manualTracked.has(questKey(quest)));
    if (filter === "quest") return quest.kind === "quest" || quest.kind === "pursuit" || isSeasonalOrderQuest(quest);
    if (filter === "bounty") return quest.kind === "bounty" && !isSeasonalOrderQuest(quest);
    return questCategory(quest) === filter;
  }

  function updateQuestTabCounts(quests = []) {
    if (!els.questTabs) return;
    const tabs = [...els.questTabs.querySelectorAll("[data-quest-filter]")];
    tabs.forEach(button => {
      const count = quests.filter(quest => questMatchesFilter(quest, button.dataset.questFilter || "all")).length;
      const label = button.dataset.label || button.dataset.questFilter || "Filter";
      const copy = button.dataset.copy || "";
      const tooltip = copy ? `${label}: ${copy}` : label;
      button.dataset.count = String(count);
      button.classList.toggle("is-empty", count === 0);
      button.title = tooltip;
      button.setAttribute("aria-label", tooltip);
    });
  }

  function renderQuests(quests = []) {
    const classScoped = quests
      .filter(quest => quest.kind !== "record")
      .filter(quest => !(quest.unresolved || /^Item\s+\d+$/i.test(String(quest.name || ""))))
      .filter(classFilterMatches);
    updateQuestTabCounts(classScoped);
    const visible = classScoped.filter(quest => questMatchesFilter(quest, questFilter));
    if (els.questCount) {
      const active = [...(els.questTabs?.querySelectorAll("[data-quest-filter]") || [])].find(button => button.dataset.questFilter === questFilter);
      const filterLabel = active?.dataset.label || "All quests";
      const label = classFilter ? `${classFilter} / ${filterLabel}` : filterLabel;
      els.questCount.textContent = `${label} ${visible.length} / ${classScoped.length}`;
    }
    if (!els.questList) return;
    if (!visible.length) {
      els.questList.innerHTML = emptyState(quests.length ? "No quest items match this tab." : "No quest, bounty, or pursuit items found in the current profile response.");
      return;
    }
    els.questList.innerHTML = visible.map(quest => progressCardMarkup(quest, { allowPin: true })).join("");
  }

  function renderTriumphs(quests = []) {
    const records = quests
      .filter(quest => quest.kind === "record")
      .filter(quest => !(quest.unresolved || /^Record\s+\d+$/i.test(String(quest.name || ""))))
      .filter(classFilterMatches);
    if (els.triumphCount) els.triumphCount.textContent = `${records.length} records`;
    if (!els.triumphList) return;
    if (!records.length) {
      els.triumphList.innerHTML = emptyState("No active triumph or record objective progress found.");
      return;
    }
    els.triumphList.innerHTML = records.map(quest => progressCardMarkup(quest, { allowPin: false })).join("");
  }

  function progressCardMarkup(quest, { allowPin = true } = {}) {
      const pct = Math.max(0, Math.min(100, Number(quest.pct || 0)));
      const isRecord = quest.kind === "record";
      const unresolved = quest.unresolved || (isRecord && /^Record\s+\d+$/i.test(String(quest.name || "")));
      const title = unresolved ? "Unmapped Bungie record" : quest.name || `Record ${quest.hash}`;
      const hash = unresolved ? ` <span class="record-hash">Hash ${escapeHtml(quest.hash)}</span>` : "";
      const trackedBadge = quest.inGameTracked ? `<span class="fireteam-tracked-badge">Tracked in game</span>` : "";
      const catalystBadge = quest.catalystQuest ? `<span class="fireteam-catalyst-badge">Catalyst quest</span>` : "";
      const sourceChip = questSourceChip(quest);
      const objectiveRows = renderObjectiveSteps(quest.objectives || []);
      const key = questKey(quest);
      const isPinned = manualTracked.has(key);
      const pinButton = allowPin && key ? `<button class="manual-track-toggle ${isPinned ? "is-pinned" : ""}" type="button" data-manual-track="${escapeHtml(key)}" aria-pressed="${isPinned ? "true" : "false"}" title="${isPinned ? "Unpin from site tracker" : "Pin to site tracker"}"><span aria-hidden="true"></span></button>` : "";
      const icon = quest.icon ? `<img src="${escapeHtml(iconUrl(quest.icon))}" alt="" width="36" height="36" loading="lazy" decoding="async" aria-hidden="true" />` : `<span class="fireteam-icon-fallback">${unresolved ? "?" : "Q"}</span>`;
      const cardVisuals = cardVisualMarkup(quest, pct, { isPinned });
      const tooltip = questTooltipMarkup(quest, { title, pct, sourceChip, objectiveRows, hash, icon });
      return `<article class="fireteam-progress-card ${unresolved ? "is-unresolved" : ""} ${quest.inGameTracked ? "is-tracked" : ""} ${quest.highlightedObjective ? "is-highlighted-objective" : ""} ${quest.inInventory ? "is-inventory" : ""} ${escapeHtml(`is-${quest.kind || "record"}`)}" tabindex="0" style="--card-progress:${pct}%">
        ${pinButton}
        ${icon}
        <div>
          <strong>${escapeHtml(title)}${trackedBadge}${catalystBadge}</strong>
          <p class="fireteam-card-summary">${escapeHtml(quest.description || quest.questLineDescription || quest.activity || `${quest.objectiveComplete || 0}/${quest.objectiveTotal || 0} objectives`)}</p>
          ${cardVisuals}
        </div>
        ${tooltip}
      </article>`;
  }

  function cardVisualMarkup(quest, pct, { isPinned = false } = {}) {
    const statusItems = [
      quest.inGameTracked ? ["Tracked in game", "tracked"] : null,
      isPinned ? ["Pinned here", "pinned"] : null,
      quest.catalystQuest ? ["Catalyst", "catalyst"] : null
    ].filter(Boolean);
    const status = statusItems.length
      ? `<div class="fireteam-card-status">${statusItems.map(([label, key]) => `<span class="is-${escapeHtml(key)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"></span>`).join("")}</div>`
      : "";
    return status ? `<div class="fireteam-card-visuals">${status}</div>` : "";
  }

  function questTooltipMarkup(quest, { title, pct, sourceChip, objectiveRows, hash, icon } = {}) {
    const seasonalOrder = isSeasonalOrderQuest(quest);
    const kind = seasonalOrder ? "Order" : titleCase(quest.kind || "quest");
    const stepLabel = seasonalOrder ? "Seasonal Hub: Orders" : "Quest Step";
    const stepInfo = quest.questLineName
      ? `<span>${escapeHtml(quest.questLineName)}</span>`
      : "";
    const description = quest.description || quest.questLineDescription || quest.activity || "";
    const flavor = quest.flavorText || "";
    const rewards = Array.isArray(quest.rewards) ? quest.rewards.filter(reward => reward?.name) : [];
    const trackerState = [
      quest.inGameTracked ? "Tracked in game" : "",
      quest.highlightedObjective ? "Highlighted objective" : "",
      quest.catalystQuest ? "Catalyst quest" : ""
    ].filter(Boolean);
    const contextRows = [
      quest.fireteamOwner ? ["Owner", quest.fireteamOwner] : null,
      quest.character?.className ? ["Class", quest.character.className] : null,
      quest.source ? ["Source", quest.source] : null,
      quest.objectives?.length ? ["Objectives", `${quest.objectives.filter(row => row.complete).length}/${quest.objectives.length}`] : null
    ].filter(Boolean);
    const rarityLabel = quest.catalystQuest || questCategory(quest) === "exotics" ? "Exotic" : kind;
    return `<div class="fireteam-quest-tooltip" role="tooltip">
      <div class="fireteam-quest-tooltip-head">
        <div class="fireteam-tooltip-icon">${icon || `<span class="fireteam-icon-fallback">Q</span>`}</div>
        <div>
          <strong>${escapeHtml(title || quest.name || "Quest item")}</strong>
          <span>${escapeHtml(stepLabel)}</span>
        </div>
        <em>${escapeHtml(rarityLabel)}</em>
      </div>
      <div class="fireteam-quest-tooltip-progress" aria-label="${escapeHtml(Math.round(Number(pct || 0)))} percent complete">
        <i style="width:${Math.max(0, Math.min(100, Number(pct || 0)))}%"></i>
        <span>${escapeHtml(Math.round(Number(pct || 0)))}%</span>
      </div>
      ${description ? `<p>${escapeHtml(description)}</p>` : ""}
      ${quest.questLineDescription && quest.questLineDescription !== description ? `<p>${escapeHtml(quest.questLineDescription)}</p>` : ""}
      ${objectiveRows || `<div class="quest-step-list"><div class="quest-step-more">No objective rows exposed by Bungie for this item.</div></div>`}
      ${flavor ? `<blockquote class="fireteam-quest-flavor">${escapeHtml(flavor)}</blockquote>` : ""}
      ${rewards.length ? `<div class="fireteam-quest-rewards"><strong>Rewards</strong>${rewards.map(reward => `<span>${reward.icon ? `<img src="${escapeHtml(iconUrl(reward.icon))}" alt="" width="24" height="24" loading="lazy" decoding="async" aria-hidden="true" />` : `<i class="fireteam-icon-fallback">R</i>`}<em>${escapeHtml(reward.name)}</em></span>`).join("")}</div>` : ""}
      <div class="fireteam-quest-tooltip-meta">
        ${sourceChip || ""}
        ${stepInfo}
        ${hash || ""}
        ${contextRows.map(([label, value]) => `<span><b>${escapeHtml(label)}</b>${escapeHtml(value)}</span>`).join("")}
        ${trackerState.map(state => `<span>${escapeHtml(state)}</span>`).join("")}
      </div>
    </div>`;
  }

  function pinnedQuests(quests = allFireteamQuestItems()) {
    const questPool = quests.filter(quest => quest.kind !== "record");
    const byKey = new Map(questPool.map(quest => [questKey(quest), quest]).filter(([key]) => key));
    let changed = false;
    const pinned = [...manualTracked].map(key => {
      let quest = byKey.get(key) || manualTrackCache[key];
      const advancedQuest = !byKey.has(key) ? findAdvancedPinnedQuest(manualTrackCache[key], questPool) : null;
      if (advancedQuest) {
        const nextKey = questKey(advancedQuest);
        manualTracked.delete(key);
        delete manualTrackCache[key];
        manualTracked.add(nextKey);
        quest = advancedQuest;
        changed = true;
      }
      if (quest && byKey.has(questKey(quest))) rememberManualQuest(quest);
      return quest;
    }).filter(Boolean);
    if (changed) saveManualTracked();
    return pinned;
  }

  async function ensureQuestTimeline(quest) {
    if (!quest || quest.questSteps?.length || !quest.itemHash) return quest;
    const cache = itemCache();
    const definition = await itemDefinition(quest.itemHash, cache);
    const resolvedLineName = definition.setData?.questLineName || (isGeneratedHashLabel(definition.name) ? "" : definition.name) || "";
    quest.questLineName = quest.questLineName || resolvedLineName;
    quest.questLineDescription = quest.questLineDescription || definition.setData?.questLineDescription || "";
    quest.questSteps = await questTimelineForItem(definition, quest.itemHash, quest.objectives || [], quest);
    return quest;
  }

  async function renderManualTracker(quests = allFireteamQuestItems()) {
    const renderSeq = ++manualRenderSeq;
    const pinned = pinnedQuests(quests);
    if (els.manualTrackCount) els.manualTrackCount.textContent = `${pinned.length} pinned`;
    if (!els.manualTrackList) return;
    if (!pinned.length) {
      els.manualTrackList.innerHTML = emptyState("Click a green marker on any quest card to pin it here.");
      return;
    }
    await Promise.all(pinned.map(ensureQuestTimeline));
    pinned.forEach(rememberManualQuest);
    if (renderSeq !== manualRenderSeq) return;
    els.manualTrackList.innerHTML = pinned.map(quest => {
      const steps = quest.questSteps?.length ? quest.questSteps : [{
        hash: quest.hash,
        name: quest.name,
        description: quest.description,
        status: "current",
        objectives: quest.objectives || []
      }];
      const currentIndex = Math.max(0, steps.findIndex(step => step.status === "current"));
      const icon = quest.icon ? `<img src="${escapeHtml(iconUrl(quest.icon))}" alt="" loading="lazy" decoding="async" aria-hidden="true" />` : `<span class="fireteam-icon-fallback">Q</span>`;
      return `<article class="manual-track-card">
        <div class="manual-track-head">
          ${icon}
          <div>
            <strong>${escapeHtml(quest.questLineName || quest.name || "Pinned quest")}</strong>
            <span>${escapeHtml(quest.fireteamOwner || "Fireteam")} / ${escapeHtml(titleCase(quest.kind || "quest"))} / Step ${currentIndex + 1} of ${steps.length}</span>
          </div>
          <button class="manual-track-remove" type="button" data-manual-track="${escapeHtml(questKey(quest))}" title="Unpin from site tracker">x</button>
        </div>
        <div class="manual-step-list">${steps.map((step, index) => renderTimelineStep(step, index, steps.length)).join("")}</div>
      </article>`;
    }).join("");
    requestAnimationFrame(() => {
      els.manualTrackList?.querySelector(".manual-step.is-current")?.scrollIntoView({ block: "center", inline: "nearest" });
    });
  }

  function renderTimelineStep(step, index, total) {
    const objectives = step.objectives || [];
    const status = step.status || "future";
    const statusLabel = status === "future" ? "Unavailable right now" : status === "past" ? "Done" : "Current";
    return `<section class="manual-step is-${escapeHtml(step.status || "future")}">
      <div class="manual-step-title">
        <span>${index + 1}</span>
        <strong>${escapeHtml(step.name || `Step ${index + 1}`)}</strong>
        <em>${escapeHtml(statusLabel)}</em>
      </div>
      ${step.description ? `<p>${escapeHtml(step.description)}</p>` : ""}
      <div class="manual-step-objectives">${objectives.length ? objectives.map(row => renderManualObjective(row, status)).join("") : `<span class="manual-step-empty">No objective rows exposed for this step.</span>`}</div>
    </section>`;
  }

  function renderManualObjective(row, status) {
    const total = Number(row.total || 0);
    const progress = Number(row.progress || 0);
    const isPast = status === "past";
    const isFuture = status === "future";
    const complete = Boolean(row.complete || isPast);
    const pct = isPast ? 100 : isFuture ? 0 : total ? Math.max(0, Math.min(100, Math.round((progress / total) * 100))) : complete ? 100 : 0;
    const value = isFuture ? "Unavailable" : status === "current" && total && !complete ? `${progress}/${total}` : "";
    return `<div class="manual-objective ${complete ? "is-complete" : ""} ${isFuture ? "is-unavailable" : ""}">
      <span class="quest-step-check" aria-hidden="true"></span>
      <div>
        <strong>${escapeHtml(row.name || `Objective ${row.objectiveHash || ""}`)}</strong>
        ${value ? `<em>${escapeHtml(value)}</em>` : ""}
        <div class="quest-step-track"><i style="width:${pct}%"></i></div>
      </div>
    </div>`;
  }

  function renderObjectiveSteps(objectives = []) {
    if (!objectives.length) return "";
    const visible = objectives.slice(0, 6);
    const hidden = Math.max(0, objectives.length - visible.length);
    return `<div class="quest-step-list">${visible.map(row => {
      const total = Number(row.total || 0);
      const progress = Number(row.progress || 0);
      const pct = total ? Math.max(0, Math.min(100, Math.round((progress / total) * 100))) : row.complete ? 100 : 0;
      const value = total ? `${progress}/${total}` : row.complete ? "100%" : `${progress}`;
      return `<div class="quest-step ${row.complete ? "is-complete" : ""}">
        <span class="quest-step-check" aria-hidden="true"></span>
        <div>
          <strong>${escapeHtml(row.name || `Objective ${row.objectiveHash || ""}`)}</strong>
          <em>${escapeHtml(value)}</em>
          <div class="quest-step-track"><i style="width:${pct}%"></i></div>
        </div>
      </div>`;
    }).join("")}${hidden ? `<div class="quest-step-more">+${hidden} more objective(s)</div>` : ""}</div>`;
  }

  function questSourceChip(quest) {
    const character = quest.character;
    if (character?.emblemPath) {
      return `<span class="quest-source-chip"><img src="${escapeHtml(iconUrl(character.emblemPath))}" alt="" width="18" height="18" loading="lazy" decoding="async" aria-hidden="true" />${escapeHtml(character.className || quest.source || "Guardian")}</span>`;
    }
    return `<span class="quest-source-chip">${escapeHtml(quest.source || "Profile")}</span>`;
  }

  function renderActivities(activities = []) {
    if (els.activityCount) els.activityCount.textContent = `${activities.length} ideas`;
    if (!els.activityList) return;
    if (!activities.length) {
      els.activityList.innerHTML = emptyState("No suggested activities yet.");
      return;
    }
    els.activityList.innerHTML = activities.map(activity => `<article class="fireteam-activity-card">
      <span class="badge focus">${escapeHtml(activity.priority || "Next")}</span>
      <strong>${escapeHtml(activity.label || "Next activity")}</strong>
      <p>${escapeHtml(activity.activity || "")}</p>
      <em>${escapeHtml(activity.count || 0)} matching item(s)${activity.sample ? ` - ${escapeHtml(activity.sample)}` : ""}</em>
    </article>`).join("");
  }

  function questPct(quest) {
    return Math.max(0, Math.min(100, Math.round(Number(quest?.pct || 0))));
  }

  function isSeasonalHubQuest(quest) {
    if (questCategory(quest) === "edge-of-fate" || questCategory(quest) === "pathfinder") return true;
    const text = questSearchText(quest);
    return /(season|seasonal|episode|hub|pathfinder|portal|edge of fate|renegades|pale heart|kepler|altar|world tier|event|vendor|playlist|weekly)/i.test(text);
  }

  function sideTrackerKind(item) {
    if (isSeasonalOrderQuest(item)) return "order";
    if (item?.kind === "bounty") return "bounty";
    if (item?.sourceType === "activity") return "activity";
    return "seasonal";
  }

  function sideTrackerLabel(item) {
    const kind = sideTrackerKind(item);
    if (kind === "order") return "Seasonal Hub: Orders";
    if (kind === "bounty") return "Bounty";
    if (kind === "activity") return "Director";
    return "Seasonal hub";
  }

  function sideTrackerIcon(item) {
    const kind = sideTrackerKind(item);
    if (item?.icon) {
      return `<img src="${escapeHtml(iconUrl(item.icon))}" alt="" width="28" height="28" loading="lazy" decoding="async" aria-hidden="true" />`;
    }
    const fallback = kind === "bounty" ? SIDE_TRACKER_ICONS.bounty : SIDE_TRACKER_ICONS.seasonal;
    return `<img class="side-track-category-icon" src="${escapeHtml(fallback)}" alt="" width="28" height="28" loading="lazy" decoding="async" aria-hidden="true" />`;
  }

  function sideTrackerMeta(item) {
    const parts = [sideTrackerLabel(item)];
    if (item?.inGameTracked) parts.push("Tracked");
    if (item?.highlightedObjective) parts.push("Highlighted");
    if (item?.character?.className) parts.push(item.character.className);
    else if (item?.source) parts.push(item.source);
    return parts.join(" / ");
  }

  function suggestedActivityTrackerItem(activity) {
    return {
      sourceType: "activity",
      name: activity.label || "Suggested activity",
      description: activity.activity || "",
      pct: 0,
      count: activity.count || 0,
      priority: activity.priority || "Next",
      sample: activity.sample || ""
    };
  }

  function renderSideTracker(quests = [], activities = []) {
    if (!els.sideTrackerList) return;
    const questItems = quests
      .filter(quest => quest.kind !== "record")
      .filter(classFilterMatches)
      .filter(quest => quest.kind === "bounty" || isSeasonalHubQuest(quest));
    const ranked = questItems
      .sort((a, b) => {
        const aTracked = Number(Boolean(a.inGameTracked || a.highlightedObjective));
        const bTracked = Number(Boolean(b.inGameTracked || b.highlightedObjective));
        if (aTracked !== bTracked) return bTracked - aTracked;
        const aDone = questPct(a) >= 100;
        const bDone = questPct(b) >= 100;
        if (aDone !== bDone) return Number(aDone) - Number(bDone);
        if (questPct(a) !== questPct(b)) return questPct(b) - questPct(a);
        return String(a.name || "").localeCompare(String(b.name || ""));
      })
      .slice(0, SIDE_TRACKER_LIMIT);
    const fallback = ranked.length ? [] : activities.slice(0, 5).map(suggestedActivityTrackerItem);
    const items = [...ranked, ...fallback];
    if (els.sideTrackerCount) els.sideTrackerCount.textContent = ranked.length ? `${ranked.length} focus` : `${fallback.length} ideas`;
    if (!items.length) {
      els.sideTrackerList.innerHTML = emptyState("No bounty or seasonal hub objectives found for this Guardian.");
      return;
    }
    els.sideTrackerList.innerHTML = items.map(item => {
      const pct = questPct(item);
      const kind = sideTrackerKind(item);
      const categoryIcon = kind === "bounty" ? SIDE_TRACKER_ICONS.bounty : SIDE_TRACKER_ICONS.seasonal;
      const trackedIcon = item.inGameTracked || item.highlightedObjective
        ? `<img src="${SIDE_TRACKER_ICONS.tracked}" alt="" width="14" height="14" loading="lazy" decoding="async" aria-hidden="true" />`
        : "";
      const count = item.count ? `<em>${escapeHtml(item.count)} item(s)</em>` : "";
      return `<article class="side-track-row is-${escapeHtml(kind)} ${item.inGameTracked ? "is-tracked" : ""} ${item.highlightedObjective ? "is-highlighted-objective" : ""}" title="${escapeHtml(item.description || item.activity || item.name || "")}">
        <span class="side-track-icon">${sideTrackerIcon(item)}</span>
        <div class="side-track-main">
          <div class="side-track-bar" style="--pct:${pct}%">
            <strong>${escapeHtml(item.name || "Objective")}</strong>
            <em>${pct}%</em>
          </div>
          <span><img src="${escapeHtml(categoryIcon)}" alt="" width="14" height="14" loading="lazy" decoding="async" aria-hidden="true" />${trackedIcon}${escapeHtml(sideTrackerMeta(item))}${count}</span>
        </div>
      </article>`;
    }).join("");
  }

  function renderCloudStatus(snapshots = savedSnapshots) {
    if (!els.cloudStatus) return;
    if (!apiBase()) {
      els.cloudStatus.innerHTML = `<span class="is-warn"><strong>Cloud</strong>Not configured</span>`;
      return;
    }
    els.cloudStatus.innerHTML = snapshots.length
      ? snapshots.slice(0, 4).map(snapshot => `<span class="is-good"><strong>${escapeHtml(snapshotDisplayName(snapshot) || "Saved")}</strong>${escapeHtml(formatShort(snapshot.syncedAt || snapshot.updatedAt))}</span>`).join("")
      : `<span class="is-idle"><strong>Cloud</strong>No fireteam snapshots</span>`;
  }

  function emptyState(text) {
    return `<div class="empty-state">${escapeHtml(text)}</div>`;
  }

  function renderSnapshot(snapshot = activeSnapshot()) {
    hideFloatingTooltip();
    const payload = snapshotPayload(snapshot);
    const quests = ownerScopedQuests(payload);
    renderPlayer(payload);
    renderMembers(savedSnapshots);
    renderQuests(quests);
    renderTriumphs(quests);
    renderManualTracker();
    renderSideTracker(quests, payload?.suggestedActivities || []);
    renderActivities(payload?.suggestedActivities || []);
    renderCloudStatus();
    renderSocialDrawer();
    if (els.debugBox) els.debugBox.value = payload ? JSON.stringify(payload, null, 2) : "";
  }

  function titleCase(value) {
    return String(value || "").replace(/[-_]+/g, " ").replace(/\b\w/g, char => char.toUpperCase());
  }

  async function loadCloudSnapshots() {
    if (!apiBase()) {
      renderCloudStatus([]);
      return [];
    }
    try {
      const response = await fetch(`${apiBase()}/api/fireteam-snapshots`, { headers: { "Accept": "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.message || data.reason || "Fireteam cloud read failed.");
      savedSnapshots = data.snapshots || [];
      if (!selectedSnapshotKey && !latestSnapshot && savedSnapshots.length && !hasLocalAuth()) selectedSnapshotKey = snapshotKey(savedSnapshots[0]);
      if (selectedSnapshotKey && !savedSnapshots.some(snapshot => snapshotKey(snapshot) === selectedSnapshotKey)) selectedSnapshotKey = "";
      renderMembers(savedSnapshots);
      renderSnapshot(activeSnapshot());
      renderCloudStatus(savedSnapshots);
      return savedSnapshots;
    } catch (error) {
      renderCloudStatus([]);
      setStatus(`Cloud sync unavailable: ${error.message || error}`, "warn");
      return [];
    }
  }

  async function saveCloudSnapshot(snapshot) {
    if (!apiBase()) return { ok: false, reason: "cloud_not_configured" };
    const token = await accessToken();
    const response = await fetch(`${apiBase()}/api/fireteam-snapshots`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fireteamSnapshot: snapshot })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.message || data.reason || "Fireteam cloud write failed.");
    return data;
  }

  async function refreshFromBungie({ silent = false } = {}) {
    if (refreshing) return;
    refreshing = true;
    if (els.refreshBtn) els.refreshBtn.disabled = true;
    try {
      setAuthState(sessionIsUsable() || hasSavedCode() ? "Bungie linked" : "Sign in required");
      if (!sessionIsUsable() && !hasSavedCode()) {
        setStatus("Sign in with Bungie to read Fireteam progress.", "warn");
        return;
      }
      latestSnapshot = await buildFireteamSnapshot();
      selectedSnapshotKey = snapshotKey(latestSnapshot);
      renderSnapshot(latestSnapshot);
      try {
        const saved = await saveCloudSnapshot(latestSnapshot);
        setStatus(`Fireteam snapshot saved for ${snapshotDisplayName(latestSnapshot)} at ${formatDate(saved.syncedAt || latestSnapshot.updatedAt)}.`, "good");
        await loadCloudSnapshots();
      } catch (error) {
        setStatus(`Bungie refresh worked, but cloud save failed: ${error.message || error}`, "warn");
      }
    } catch (error) {
      if (!silent) setStatus(error.message || String(error), "warn");
      setAuthState(sessionIsUsable() || hasSavedCode() ? "Login ready" : "Sign in required");
    } finally {
      refreshing = false;
      if (els.refreshBtn) els.refreshBtn.disabled = false;
      scheduleAutoRefresh();
    }
  }

  function scheduleAutoRefresh() {
    if (autoRefreshTimer) clearTimeout(autoRefreshTimer);
    if (!sessionIsUsable()) return;
    autoRefreshTimer = setTimeout(() => refreshFromBungie({ silent: true }), AUTO_REFRESH_MS);
  }

  function init() {
    captureOAuthCode();
    setAuthState(sessionIsUsable() || hasSavedCode() ? "Login ready" : "Bungie offline");
    renderSnapshot(null);
    loadCloudSnapshots();
    els.loginBtn?.addEventListener("click", () => {
      window.location.assign(buildAuthUrl());
    });
    els.refreshBtn?.addEventListener("click", () => refreshFromBungie());
    els.socialDrawerToggle?.addEventListener("click", () => {
      renderSocialDrawer();
      setSocialDrawerOpen(els.socialDrawer?.hidden !== false);
    });
    els.socialDrawerClose?.addEventListener("click", () => setSocialDrawerOpen(false));
    els.socialPrev?.addEventListener("click", () => {
      socialTab = socialTab === "clan" ? "friends" : socialTab === "friends" ? "fireteam" : "clan";
      document.querySelectorAll("[data-social-tab]").forEach(item => item.classList.toggle("active", item.dataset.socialTab === socialTab));
      renderSocialDrawer();
    });
    els.socialNext?.addEventListener("click", () => {
      socialTab = socialTab === "fireteam" ? "friends" : socialTab === "friends" ? "clan" : "fireteam";
      document.querySelectorAll("[data-social-tab]").forEach(item => item.classList.toggle("active", item.dataset.socialTab === socialTab));
      renderSocialDrawer();
    });
    setManualDrawerMinimized(localStorage.getItem(MANUAL_DRAWER_KEY) === "1");
    els.manualTrackDrawerToggle?.addEventListener("click", () => {
      setManualDrawerMinimized(!document.body.classList.contains("manual-tracker-minimized"));
    });
    els.questTabs?.addEventListener("click", event => {
      const button = event.target.closest("[data-quest-filter]");
      if (!button) return;
      questFilter = button.dataset.questFilter || "all";
      els.questTabs.querySelectorAll("[data-quest-filter]").forEach(item => item.classList.toggle("active", item === button));
      renderSnapshot(activeSnapshot());
    });
    document.addEventListener("pointerover", event => {
      const card = event.target.closest(".fireteam-progress-card");
      if (!card) {
        hideFloatingTooltip();
        return;
      }
      if (!card.contains(event.target) || card.contains(event.relatedTarget)) return;
      showFloatingTooltip(card);
    });
    document.addEventListener("pointerout", event => {
      const card = event.target.closest(".fireteam-progress-card");
      if (!card || card.contains(event.relatedTarget)) return;
      hideFloatingTooltip(card);
    });
    document.addEventListener("pointermove", syncFloatingTooltipTarget, { passive: true });
    document.addEventListener("pointerleave", () => hideFloatingTooltip());
    document.addEventListener("focusin", event => {
      const card = event.target.closest(".fireteam-progress-card");
      if (card) showFloatingTooltip(card);
    });
    document.addEventListener("focusout", event => {
      const card = event.target.closest(".fireteam-progress-card");
      if (!card) return;
      requestAnimationFrame(() => {
        if (!card.contains(document.activeElement)) hideFloatingTooltip(card);
      });
    });
    window.addEventListener("scroll", () => positionFloatingTooltip(floatingTooltipCard), { passive: true });
    window.addEventListener("resize", () => positionFloatingTooltip(floatingTooltipCard), { passive: true });
    window.addEventListener("blur", () => hideFloatingTooltip());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) hideFloatingTooltip();
    });
    document.addEventListener("click", event => {
      const socialTabButton = event.target.closest("[data-social-tab]");
      if (socialTabButton) {
        event.preventDefault();
        socialTab = socialTabButton.dataset.socialTab || "fireteam";
        document.querySelectorAll("[data-social-tab]").forEach(item => item.classList.toggle("active", item === socialTabButton));
        renderSocialDrawer();
        return;
      }

      const profileToggle = event.target.closest("#profileSelectorToggle");
      if (profileToggle) {
        event.preventDefault();
        setProfileSelectorOpen(els.profileCharacterSelector?.hidden !== false);
        return;
      }

      const classButton = event.target.closest("[data-class-filter]");
      if (classButton) {
        event.preventDefault();
        const nextClass = String(classButton.dataset.classFilter || "");
        classFilter = classFilter === nextClass ? "" : nextClass;
        setProfileSelectorOpen(false);
        renderSnapshot(activeSnapshot());
        return;
      }

      if (!event.target.closest("#profileCharacterSelector")) {
        setProfileSelectorOpen(false);
      }

      const snapshotButton = event.target.closest("[data-view-snapshot]");
      if (snapshotButton) {
        event.preventDefault();
        setSelectedSnapshot(String(snapshotButton.dataset.viewSnapshot || ""));
        if (snapshotButton.closest("#socialDrawer")) setSocialDrawerOpen(false);
        return;
      }

      const button = event.target.closest("[data-manual-track]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const key = String(button.dataset.manualTrack || "");
      if (!key) return;
      if (manualTracked.has(key)) {
        manualTracked.delete(key);
        delete manualTrackCache[key];
      } else {
        const quest = allFireteamQuestItems().find(item => questKey(item) === key) || ownerScopedQuests(activeSnapshot()).find(item => questKey(item) === key);
        if (quest) rememberManualQuest(quest);
        manualTracked.add(key);
      }
      saveManualTracked();
      renderSnapshot(activeSnapshot());
    });
    document.addEventListener("keydown", event => {
      if ((event.key === "Enter" || event.key === " ") && event.target.closest("#profileSelectorToggle")) {
        event.preventDefault();
        setProfileSelectorOpen(els.profileCharacterSelector?.hidden !== false);
        return;
      }
      if (event.key === "Escape") {
        setProfileSelectorOpen(false);
        setSocialDrawerOpen(false);
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") return;
      const snapshotCard = event.target.closest("[data-view-snapshot]");
      if (!snapshotCard || event.target.closest("[data-class-filter]")) return;
      event.preventDefault();
      setSelectedSnapshot(String(snapshotCard.dataset.viewSnapshot || ""));
    });
    if (sessionIsUsable() || hasSavedCode()) refreshFromBungie({ silent: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
