(() => {
  const CONFIG = window.D2_BUNGIE_CONFIG || {};
  const ACTIVITY_MAP = window.D2_FIRETEAM_ACTIVITY_MAP || { aliases: {}, suggestions: [] };
  const API_ROOT = "https://www.bungie.net/Platform";
  const AUTH_KEY = "d2-collections-auth-v1";
  const SESSION_KEY = "d2-collections-bungie-session-v2";
  const RETURN_KEY = "d2-collections-oauth-return-v1";
  const STATE_KEY = "d2-collections-oauth-state-v1";
  const RECORD_CACHE_KEY = "d2-fireteam-record-def-cache-v1";
  const AUTO_REFRESH_MS = 90 * 1000;
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
    activityList: document.querySelector("#activityList"),
    activityCount: document.querySelector("#activityCount"),
    debugBox: document.querySelector("#debugBox")
  };

  let latestSnapshot = null;
  let savedSnapshots = [];
  let refreshing = false;
  let autoRefreshTimer = 0;

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

  function recordCache() {
    return readJson(RECORD_CACHE_KEY);
  }

  function saveRecordCache(cache) {
    writeJson(RECORD_CACHE_KEY, cache);
  }

  async function recordDefinition(hash, cache) {
    const key = String(hash);
    if (cache[key]) return cache[key];
    try {
      const def = await bungieGet(`/Destiny2/Manifest/DestinyRecordDefinition/${encodeURIComponent(key)}/?lc=en`);
      cache[key] = {
        name: def?.displayProperties?.name || `Record ${key}`,
        description: def?.displayProperties?.description || "",
        icon: def?.displayProperties?.icon || "",
        resolvedAt: new Date().toISOString()
      };
    } catch {
      cache[key] = { name: `Record ${key}`, description: "", icon: "", resolvedAt: new Date().toISOString(), unresolved: true };
    }
    saveRecordCache(cache);
    return cache[key];
  }

  function objectiveSummary(objectives = []) {
    const rows = objectives.map(objective => {
      const progress = Number(objective.progress || 0);
      const total = Number(objective.completionValue || 0);
      return {
        progress,
        total,
        complete: Boolean(objective.complete) || (total > 0 && progress >= total),
        objectiveHash: String(objective.objectiveHash || "")
      };
    });
    const complete = rows.filter(row => row.complete).length;
    return {
      rows,
      complete,
      total: rows.length,
      pct: rows.length ? Math.round((complete / rows.length) * 100) : 0
    };
  }

  async function trackedQuestProgress(profile) {
    const records = [];
    const addRecords = (source, entries = {}) => {
      Object.entries(entries || {}).forEach(([hash, entry]) => {
        const objectives = entry?.objectives || [];
        if (!objectives.length) return;
        const summary = objectiveSummary(objectives);
        const hasProgress = summary.rows.some(row => row.progress > 0 || row.complete);
        const complete = summary.rows.length > 0 && summary.rows.every(row => row.complete);
        if (!hasProgress && complete) return;
        records.push({
          hash: String(hash),
          source,
          complete,
          state: Number(entry.state || 0),
          objectives: summary.rows,
          objectiveComplete: summary.complete,
          objectiveTotal: summary.total,
          pct: summary.pct
        });
      });
    };
    addRecords("Profile", profile?.profileRecords?.data?.records);
    Object.entries(profile?.characterRecords?.data || {}).forEach(([characterId, data]) => addRecords(`Character ${characterId}`, data?.records));

    const cache = recordCache();
    const top = records
      .sort((a, b) => Number(a.complete) - Number(b.complete) || b.pct - a.pct)
      .slice(0, 18);
    for (const item of top.slice(0, 12)) {
      item.definition = await recordDefinition(item.hash, cache);
    }
    return top.map(item => ({
      ...item,
      name: item.definition?.name || `Record ${item.hash}`,
      description: item.definition?.description || "",
      icon: item.definition?.icon || ""
    }));
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
        activity: quests.length ? "Open the highest-progress incomplete records in game and confirm current quest steps." : "Refresh from Bungie after picking up active quests or progressing objectives.",
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
    const components = "100,102,103,200,201,202,204,800,900,1200";
    const profile = await bungieGet(`/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?components=${components}`);
    const characters = characterSummaries(profile);
    const quests = await trackedQuestProgress(profile);
    const activities = suggestedActivities(quests);
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
      els.playerMeta.innerHTML = [
        metaLine("Membership", `${snapshot.membership?.membershipTypeLabel || "Destiny"} / ${snapshot.membership?.membershipId || "unknown"}`),
        metaLine("Bungie", snapshot.bungieGlobalDisplayName || "Unknown"),
        metaLine("Characters", `${snapshot.characterSummaries?.length || 0} loaded`),
        metaLine("Tracked", `${snapshot.trackedQuestProgress?.length || 0} objective records`)
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
    return `<span class="character-pill">${icon}<strong>${escapeHtml(character.className || "Guardian")}</strong><em>${Number(character.light || 0)}</em></span>`;
  }

  function renderQuests(quests = []) {
    if (els.questCount) els.questCount.textContent = `${quests.length} tracked`;
    if (!els.questList) return;
    if (!quests.length) {
      els.questList.innerHTML = emptyState("No objective records found in the current profile response.");
      return;
    }
    els.questList.innerHTML = quests.map(quest => {
      const pct = Math.max(0, Math.min(100, Number(quest.pct || 0)));
      const icon = quest.icon ? `<img src="${escapeHtml(iconUrl(quest.icon))}" alt="" width="36" height="36" loading="lazy" decoding="async" aria-hidden="true" />` : `<span class="fireteam-icon-fallback">Q</span>`;
      return `<article class="fireteam-progress-card">
        ${icon}
        <div>
          <strong>${escapeHtml(quest.name || `Record ${quest.hash}`)}</strong>
          <span>${escapeHtml(quest.objectiveComplete || 0)}/${escapeHtml(quest.objectiveTotal || 0)} objectives - ${escapeHtml(quest.source || "Profile")}</span>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>
      </article>`;
    }).join("");
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
      <em>${escapeHtml(activity.count || 0)} matching tracked item(s)${activity.sample ? ` - ${escapeHtml(activity.sample)}` : ""}</em>
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
    renderActivities(snapshot?.suggestedActivities || []);
    renderCloudStatus();
    if (els.debugBox) els.debugBox.value = snapshot ? JSON.stringify(snapshot, null, 2) : "";
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
    if (sessionIsUsable() || hasSavedCode()) refreshFromBungie({ silent: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
