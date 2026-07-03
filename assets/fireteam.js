(() => {
  const CONFIG = window.D2_BUNGIE_CONFIG || {};
  const ACTIVITY_MAP = window.D2_FIRETEAM_ACTIVITY_MAP || { aliases: {}, suggestions: [] };
  const API_ROOT = "https://www.bungie.net/Platform";
  const AUTH_KEY = "d2-collections-auth-v1";
  const SESSION_KEY = "d2-collections-bungie-session-v2";
  const RETURN_KEY = "d2-collections-oauth-return-v1";
  const STATE_KEY = "d2-collections-oauth-state-v1";
  const RECORD_CACHE_KEY = "d2-fireteam-record-def-cache-v1";
  const ITEM_CACHE_KEY = "d2-fireteam-item-def-cache-v2";
  const OBJECTIVE_CACHE_KEY = "d2-fireteam-objective-def-cache-v1";
  const MANUAL_TRACK_KEY = "d2-fireteam-manual-track-v1";
  const AUTO_REFRESH_MS = 90 * 1000;
  const MAX_QUEST_ITEMS = 120;
  const ITEM_STATE_TRACKED = 2;
  const ITEM_STATE_HIGHLIGHTED_OBJECTIVE = 16;
  const CLASS_LABELS = {
    "2271682572": "Warlock",
    "3655393761": "Titan",
    "671679327": "Hunter"
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

  const els = {
    loginBtn: document.querySelector("#loginBtn"),
    refreshBtn: document.querySelector("#refreshBtn"),
    authState: document.querySelector("#authState"),
    playerName: document.querySelector("#playerName"),
    playerMeta: document.querySelector("#playerMeta"),
    lastUpdated: document.querySelector("#lastUpdated"),
    statusBox: document.querySelector("#statusBox"),
    cloudStatus: document.querySelector("#cloudStatus"),
    membersList: document.querySelector("#membersList"),
    memberCount: document.querySelector("#memberCount"),
    questList: document.querySelector("#questList"),
    questCount: document.querySelector("#questCount"),
    questTabs: document.querySelector("#questTabs"),
    questRailCount: document.querySelector("#questRailCount"),
    questRailLabel: document.querySelector(".fireteam-vertical-label span"),
    manualTrackList: document.querySelector("#manualTrackList"),
    manualTrackCount: document.querySelector("#manualTrackCount"),
    activityList: document.querySelector("#activityList"),
    activityCount: document.querySelector("#activityCount"),
    debugBox: document.querySelector("#debugBox")
  };

  let latestSnapshot = null;
  let savedSnapshots = [];
  let refreshing = false;
  let autoRefreshTimer = 0;
  let questFilter = "all";
  let classFilter = "";
  let manualTracked = readManualTracked();
  let manualRenderSeq = 0;

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

  function saveManualTracked() {
    localStorage.setItem(MANUAL_TRACK_KEY, JSON.stringify([...manualTracked]));
  }

  function questKey(quest) {
    return String(quest?.instanceId || quest?.itemHash || quest?.hash || "");
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
    return Boolean((saved.access_token && saved.expires_at > now) || (saved.refresh_token && (!saved.refresh_expires_at || saved.refresh_expires_at > now)));
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
      className: CLASS_LABELS[String(character.classHash)] || "Guardian",
      light: Number(character.light || 0),
      emblemPath: character.emblemPath || "",
      lastPlayed: character.dateLastPlayed || "",
      minutesPlayedTotal: Number(character.minutesPlayedTotal || 0)
    })).sort((a, b) => b.light - a.light || a.className.localeCompare(b.className));
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

  async function recordDefinition(hash, cache) {
    const key = String(hash);
    if (cache[key]) return cache[key];
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
    if (cache[key]) return cache[key];
    try {
      const def = await bungieGet(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${encodeURIComponent(key)}/?lc=en`);
      const display = def?.displayProperties || {};
      cache[key] = {
        name: display.name || `Item ${key}`,
        description: display.description || "",
        icon: display.icon || "",
        itemType: Number(def?.itemType || 0),
        itemTypeDisplayName: def?.itemTypeDisplayName || "",
        itemTypeAndTierDisplayName: def?.itemTypeAndTierDisplayName || "",
        itemCategoryHashes: def?.itemCategoryHashes || [],
        inventoryBucketHash: def?.inventory?.bucketTypeHash || "",
        objectiveHashes: def?.objectives?.objectiveHashes || [],
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
      cache[key] = { name: `Item ${key}`, description: "", icon: "", itemType: 0, itemTypeDisplayName: "", unresolved: true, resolvedAt: new Date().toISOString() };
    }
    saveItemCache(cache);
    return cache[key];
  }

  async function objectiveDefinition(hash, cache) {
    const key = String(hash || "");
    if (!key) return { name: "Objective", description: "" };
    if (cache[key]) return cache[key];
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

  async function resolveObjectiveRows(items) {
    const cache = objectiveCache();
    const hashes = [...new Set(items.flatMap(item => item.objectives || []).map(row => row.objectiveHash).filter(Boolean))];
    for (const hash of hashes) {
      await objectiveDefinition(hash, cache);
    }
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

  async function questTimelineForItem(definition, currentHash, liveObjectives = []) {
    const liveObjectiveCache = objectiveCache();
    for (const row of liveObjectives) {
      if (row.objectiveHash) await objectiveDefinition(row.objectiveHash, liveObjectiveCache);
    }
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
        name: definition?.name || "Current step",
        description: definition?.description || "",
        status: "current",
        objectives: liveRows
      }];
    }

    const cache = itemCache();
    const objectiveDefs = objectiveCache();
    const current = String(currentHash || "");
    const steps = [];
    for (const entry of chain.slice(0, 24)) {
      const hash = String(entry.itemHash || "");
      const stepDef = await itemDefinition(hash, cache);
      const objectiveHashes = stepDef.objectiveHashes || [];
      for (const objectiveHash of objectiveHashes) {
        await objectiveDefinition(objectiveHash, objectiveDefs);
      }
      steps.push({
        hash,
        name: stepDef.name || definition?.setData?.questLineName || definition?.name || "Quest step",
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
      });
    }

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
    return items.filter(item => item.itemHash).slice(0, MAX_QUEST_ITEMS);
  }

  function classifyQuestItem(definition = {}, item = {}) {
    const text = [
      definition.itemTypeDisplayName,
      definition.itemTypeAndTierDisplayName,
      definition.name,
      definition.description
    ].join(" ").toLowerCase();
    if (item.expirationDate) return "bounty";
    if (text.includes("bounty")) return "bounty";
    if (text.includes("quest")) return "quest";
    if (text.includes("pursuit")) return "quest";
    if (Number(definition.itemType) === 26) return "bounty";
    if (Number(definition.itemType) === 12) return "quest";
    return "pursuit";
  }

  async function activeQuestItems(profile, activeHashes, characters) {
    const cache = itemCache();
    const items = inventoryObjectiveItems(profile, characters);
    const resolved = [];
    for (const item of items) {
      const definition = await itemDefinition(item.itemHash, cache);
      const summary = objectiveSummary(item.objectives, activeHashes);
      const complete = summary.rows.length > 0 && summary.rows.every(row => row.complete);
      resolved.push({
        hash: item.itemHash,
        itemHash: item.itemHash,
        instanceId: item.instanceId,
        bucketHash: item.bucketHash,
        expirationDate: item.expirationDate,
        source: item.source,
        characterId: item.characterId,
        character: item.character,
        kind: classifyQuestItem(definition, item),
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
        setData: definition.setData || null,
        pct: summary.pct,
        name: definition.name || `Item ${item.itemHash}`,
        description: definition.description || "",
        icon: definition.icon || "",
        unresolved: Boolean(definition.unresolved)
      });
    }
    return resolved;
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
      .slice(0, 18);
    for (const item of top.slice(0, 12)) {
      item.definition = await recordDefinition(item.hash, cache);
    }
    const recordItems = top.map(item => ({
      ...item,
      name: item.definition?.name || `Record ${item.hash}`,
      description: item.definition?.description || "",
      icon: item.definition?.icon || "",
      unresolved: Boolean(item.definition?.unresolved)
    }));
    const combined = [...activeItems, ...recordItems]
      .sort((a, b) => Number(b.inGameTracked) - Number(a.inGameTracked) || Number(b.inInventory) - Number(a.inInventory) || Number(a.complete) - Number(b.complete) || b.pct - a.pct)
      .slice(0, 80);
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
    const components = "100,102,103,200,201,202,204,301,800,900,1200";
    const profile = await bungieGet(`/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?components=${components}`);
    const characters = characterSummaries(profile);
    const quests = await trackedQuestProgress(profile);
    const activities = suggestedActivities(quests);
    const inventoryQuestItemCount = quests.filter(item => item.inInventory).length;
    const trackedQuestItemCount = quests.filter(item => item.inGameTracked).length;
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
      if (els.playerMeta) els.playerMeta.innerHTML = `<span>Sign in to read your Bungie profile and save a fireteam snapshot.</span>`;
      if (els.lastUpdated) els.lastUpdated.textContent = "Never";
      return;
    }
    if (els.playerName) els.playerName.textContent = snapshot.playerDisplayName || "Unknown Guardian";
    if (els.lastUpdated) els.lastUpdated.textContent = formatShort(snapshot.updatedAt);
    if (els.playerMeta) {
      const inventoryCount = snapshot.inventoryQuestItemCount ?? snapshot.activeQuestItemCount ?? 0;
      const trackedCount = snapshot.trackedQuestItemCount ?? (snapshot.trackedQuestProgress || []).filter(item => item.inGameTracked).length;
      els.playerMeta.innerHTML = [
        metaLine("Membership", `${snapshot.membership?.membershipTypeLabel || "Destiny"} / ${snapshot.membership?.membershipId || "unknown"}`),
        metaLine("Bungie", snapshot.bungieGlobalDisplayName || "Unknown"),
        metaLine("Characters", `${snapshot.characterSummaries?.length || 0} loaded`),
        metaLine("Quests", `${trackedCount} tracked / ${inventoryCount} inventory`)
      ].join("");
    }
  }

  function metaLine(label, value) {
    return `<span><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</span>`;
  }

  function renderMembers(snapshots = []) {
    const list = snapshots.length ? snapshots : latestSnapshot ? [latestSnapshot] : [];
    if (els.memberCount) els.memberCount.textContent = `${list.length} saved`;
    if (!els.membersList) return;
    if (!list.length) {
      els.membersList.innerHTML = emptyState("No known fireteam snapshots yet. Refresh from Bungie to save the first one.");
      return;
    }
    els.membersList.innerHTML = list.map(snapshot => {
      const chars = snapshot.characterSummaries || snapshot.fireteamSnapshot?.characterSummaries || [];
      const display = snapshot.playerDisplayName || snapshot.displayName || snapshot.fireteamSnapshot?.playerDisplayName || "Unknown Guardian";
      const updatedAt = snapshot.updatedAt || snapshot.syncedAt || snapshot.fireteamSnapshot?.updatedAt || "";
      return `<article class="fireteam-mini-card">
        <div>
          <strong>${escapeHtml(display)}</strong>
          <span>${escapeHtml(formatShort(updatedAt))}</span>
        </div>
        <div class="fireteam-character-row">${chars.slice(0, 3).map(renderCharacterPill).join("") || `<span class="badge">No characters</span>`}</div>
      </article>`;
    }).join("");
  }

  function renderCharacterPill(character) {
    const icon = character.emblemPath ? `<img src="${escapeHtml(iconUrl(character.emblemPath))}" alt="" width="28" height="28" loading="lazy" decoding="async" aria-hidden="true" />` : "";
    const className = character.className || "Guardian";
    const active = classFilter && className === classFilter;
    const buttonAttr = className !== "Guardian" ? ` type="button" data-class-filter="${escapeHtml(className)}" aria-pressed="${active ? "true" : "false"}" title="${active ? "Clear class filter" : `Show ${className} quests`}"` : "";
    return `<button class="character-pill ${active ? "active" : ""}"${buttonAttr}>${icon}<strong>${escapeHtml(className)}</strong><em>${Number(character.light || 0)}</em></button>`;
  }

  function renderQuests(quests = []) {
    const classScoped = quests.filter(classFilterMatches);
    const visible = classScoped.filter(quest => {
      if (questFilter === "all") return true;
      if (questFilter === "tracked") return Boolean(quest.inGameTracked);
      if (questFilter === "inventory") return Boolean(quest.inInventory);
      return quest.kind === questFilter;
    });
    if (els.questCount) els.questCount.textContent = `${visible.length} / ${classScoped.length}`;
    if (els.questRailCount) els.questRailCount.textContent = `${visible.length} / ${classScoped.length}`;
    if (els.questRailLabel) {
      const active = [...(els.questTabs?.querySelectorAll("[data-quest-filter]") || [])].find(button => button.dataset.questFilter === questFilter);
      const filterLabel = active?.dataset.label || "All quests";
      els.questRailLabel.textContent = classFilter ? `${classFilter} / ${filterLabel}` : filterLabel;
    }
    if (!els.questList) return;
    if (!visible.length) {
      els.questList.innerHTML = emptyState(quests.length ? "No items match this tab." : "No quest, bounty, pursuit, or objective records found in the current profile response.");
      return;
    }
    els.questList.innerHTML = visible.map(quest => {
      const pct = Math.max(0, Math.min(100, Number(quest.pct || 0)));
      const isRecord = quest.kind === "record";
      const unresolved = quest.unresolved || (isRecord && /^Record\s+\d+$/i.test(String(quest.name || "")));
      const title = unresolved ? "Unmapped Bungie record" : quest.name || `Record ${quest.hash}`;
      const hash = unresolved ? ` <span class="record-hash">Hash ${escapeHtml(quest.hash)}</span>` : "";
      const trackedBadge = quest.inGameTracked ? `<span class="fireteam-tracked-badge">Tracked in game</span>` : "";
      const sourceChip = questSourceChip(quest);
      const objectiveRows = renderObjectiveSteps(quest.objectives || []);
      const key = questKey(quest);
      const isPinned = manualTracked.has(key);
      const pinButton = key ? `<button class="manual-track-toggle ${isPinned ? "is-pinned" : ""}" type="button" data-manual-track="${escapeHtml(key)}" aria-pressed="${isPinned ? "true" : "false"}" title="${isPinned ? "Unpin from site tracker" : "Pin to site tracker"}"><span aria-hidden="true"></span></button>` : "";
      const icon = quest.icon ? `<img src="${escapeHtml(iconUrl(quest.icon))}" alt="" width="36" height="36" loading="lazy" decoding="async" aria-hidden="true" />` : `<span class="fireteam-icon-fallback">${unresolved ? "?" : "Q"}</span>`;
      return `<article class="fireteam-progress-card ${unresolved ? "is-unresolved" : ""} ${quest.inGameTracked ? "is-tracked" : ""} ${quest.highlightedObjective ? "is-highlighted-objective" : ""} ${quest.inInventory ? "is-inventory" : ""} ${escapeHtml(`is-${quest.kind || "record"}`)}" tabindex="0">
        ${pinButton}
        ${icon}
        <div>
          <strong>${escapeHtml(title)}${trackedBadge}</strong>
          <span><em class="quest-kind-chip">${escapeHtml(titleCase(quest.kind || "record"))}</em>${escapeHtml(quest.objectiveComplete || 0)}/${escapeHtml(quest.objectiveTotal || 0)} objectives ${sourceChip}${hash}</span>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          ${objectiveRows}
        </div>
      </article>`;
    }).join("");
  }

  function pinnedQuests(quests = []) {
    const byKey = new Map(quests.map(quest => [questKey(quest), quest]).filter(([key]) => key));
    return [...manualTracked].map(key => byKey.get(key)).filter(Boolean);
  }

  async function ensureQuestTimeline(quest) {
    if (!quest || quest.questSteps?.length || !quest.itemHash) return quest;
    const cache = itemCache();
    const definition = await itemDefinition(quest.itemHash, cache);
    quest.questLineName = quest.questLineName || definition.setData?.questLineName || definition.name || "";
    quest.questLineDescription = quest.questLineDescription || definition.setData?.questLineDescription || "";
    quest.questSteps = await questTimelineForItem(definition, quest.itemHash, quest.objectives || []);
    return quest;
  }

  async function renderManualTracker(quests = latestSnapshot?.trackedQuestProgress || []) {
    const renderSeq = ++manualRenderSeq;
    const pinned = pinnedQuests(quests).filter(classFilterMatches);
    if (els.manualTrackCount) els.manualTrackCount.textContent = `${pinned.length} pinned`;
    if (!els.manualTrackList) return;
    if (!pinned.length) {
      els.manualTrackList.innerHTML = emptyState("Click a green marker on any quest card to pin it here.");
      return;
    }
    await Promise.all(pinned.map(ensureQuestTimeline));
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
            <span>${escapeHtml(titleCase(quest.kind || "quest"))} / Step ${currentIndex + 1} of ${steps.length}</span>
          </div>
          <button class="manual-track-remove" type="button" data-manual-track="${escapeHtml(questKey(quest))}" title="Unpin from site tracker">x</button>
        </div>
        <div class="manual-step-list">${steps.map((step, index) => renderTimelineStep(step, index, steps.length)).join("")}</div>
      </article>`;
    }).join("");
  }

  function renderTimelineStep(step, index, total) {
    const objectives = step.objectives || [];
    const current = step.status === "current";
    return `<section class="manual-step is-${escapeHtml(step.status || "future")}">
      <div class="manual-step-title">
        <span>${index + 1}</span>
        <strong>${escapeHtml(step.name || `Step ${index + 1}`)}</strong>
        <em>${escapeHtml(step.status || (index + 1 === total ? "future" : "step"))}</em>
      </div>
      ${step.description ? `<p>${escapeHtml(step.description)}</p>` : ""}
      <div class="manual-step-objectives">${objectives.length ? objectives.map(row => renderManualObjective(row, current)).join("") : `<span class="manual-step-empty">No objective rows exposed for this step.</span>`}</div>
    </section>`;
  }

  function renderManualObjective(row, showValue) {
    const total = Number(row.total || 0);
    const progress = Number(row.progress || 0);
    const pct = total ? Math.max(0, Math.min(100, Math.round((progress / total) * 100))) : row.complete ? 100 : 0;
    const value = showValue && total ? `${progress}/${total}` : row.complete ? "Complete" : "";
    return `<div class="manual-objective ${row.complete ? "is-complete" : ""}">
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

  function renderCloudStatus(snapshots = savedSnapshots) {
    if (!els.cloudStatus) return;
    if (!apiBase()) {
      els.cloudStatus.innerHTML = `<span class="is-warn"><strong>Cloud</strong>Not configured</span>`;
      return;
    }
    els.cloudStatus.innerHTML = snapshots.length
      ? snapshots.slice(0, 4).map(snapshot => `<span class="is-good"><strong>${escapeHtml(snapshot.player || snapshot.displayName || "Saved")}</strong>${escapeHtml(formatShort(snapshot.syncedAt || snapshot.updatedAt))}</span>`).join("")
      : `<span class="is-idle"><strong>Cloud</strong>No fireteam snapshots</span>`;
  }

  function emptyState(text) {
    return `<div class="empty-state">${escapeHtml(text)}</div>`;
  }

  function renderSnapshot(snapshot = latestSnapshot) {
    renderPlayer(snapshot);
    renderMembers(savedSnapshots);
    renderQuests(snapshot?.trackedQuestProgress || []);
    renderManualTracker(snapshot?.trackedQuestProgress || []);
    renderActivities(snapshot?.suggestedActivities || []);
    renderCloudStatus();
    if (els.debugBox) els.debugBox.value = snapshot ? JSON.stringify(snapshot, null, 2) : "";
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
      renderMembers(savedSnapshots);
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
      renderSnapshot(latestSnapshot);
      try {
        const saved = await saveCloudSnapshot(latestSnapshot);
        setStatus(`Fireteam snapshot saved for ${saved.player || latestSnapshot.playerDisplayName} at ${formatDate(saved.syncedAt || latestSnapshot.updatedAt)}.`, "good");
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
    els.questTabs?.addEventListener("click", event => {
      const button = event.target.closest("[data-quest-filter]");
      if (!button) return;
      questFilter = button.dataset.questFilter || "all";
      els.questTabs.querySelectorAll("[data-quest-filter]").forEach(item => item.classList.toggle("active", item === button));
      renderQuests(latestSnapshot?.trackedQuestProgress || []);
    });
    document.addEventListener("click", event => {
      const classButton = event.target.closest("[data-class-filter]");
      if (classButton) {
        event.preventDefault();
        const nextClass = String(classButton.dataset.classFilter || "");
        classFilter = classFilter === nextClass ? "" : nextClass;
        renderMembers(savedSnapshots);
        renderQuests(latestSnapshot?.trackedQuestProgress || []);
        renderManualTracker(latestSnapshot?.trackedQuestProgress || []);
        return;
      }

      const button = event.target.closest("[data-manual-track]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const key = String(button.dataset.manualTrack || "");
      if (!key) return;
      if (manualTracked.has(key)) manualTracked.delete(key);
      else manualTracked.add(key);
      saveManualTracked();
      renderQuests(latestSnapshot?.trackedQuestProgress || []);
      renderManualTracker(latestSnapshot?.trackedQuestProgress || []);
    });
    if (sessionIsUsable() || hasSavedCode()) refreshFromBungie({ silent: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
