(() => {
  const CONFIG = window.D2_BUNGIE_CONFIG || {};
  const CATALOG = window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: {} };
  const AUTH_KEY = "d2-collections-auth-v1";
  const SESSION_KEY = "d2-collections-bungie-session-v2";
  const API_KEY_STORAGE = "d2-collections-bungie-api-key";
  const MAP_CACHE_KEY = "d2-collections-bungie-catalog-map-v1";
  const API_ROOT = "https://www.bungie.net/Platform";
  const EXPECTED_EXOTIC_TOTAL = 1239;
  const OAUTH_REDIRECT_URI = "https://erebusares.github.io/D2-Collections/";
  const NOT_ACQUIRED = 1;
  let refreshPromise = null;

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function storedApiKey() {
    return localStorage.getItem(API_KEY_STORAGE) || "";
  }

  function apiKey() {
    return CONFIG.apiKey || storedApiKey();
  }

  function requireApiKey(status) {
    const existing = apiKey();
    if (existing) return existing;
    const entered = window.prompt("Paste your Bungie API key once. It will be saved only in this browser for D2 Collections.");
    const value = String(entered || "").trim();
    if (!value) throw new Error("No Bungie API key saved. Paste the key when prompted, then retry Dump logged-in collection.");
    localStorage.setItem(API_KEY_STORAGE, value);
    if (status) status.textContent = "Saved Bungie API key locally. Continuing collection dump...";
    return value;
  }

  function clientId() {
    return CONFIG.clientId || "53180";
  }

  function redirectUri() {
    return CONFIG.redirectUri || window.D2_COLLECTIONS_REDIRECT_URI || OAUTH_REDIRECT_URI;
  }

  function authCode() {
    return readJson(AUTH_KEY).oauthCode || "";
  }

  function token() {
    return readJson(SESSION_KEY);
  }

  function tokenIsValid(saved = token()) {
    return Boolean(saved.access_token && saved.expires_at && saved.expires_at > Math.floor(Date.now() / 1000) + 60);
  }

  function refreshTokenIsValid(saved = token()) {
    return Boolean(saved.refresh_token && (!saved.refresh_expires_at || saved.refresh_expires_at > Math.floor(Date.now() / 1000) + 60));
  }

  function saveToken(nextToken) {
    const now = Math.floor(Date.now() / 1000);
    const previous = token();
    const saved = {
      ...previous,
      ...nextToken,
      saved_at: now,
      expires_at: nextToken.expires_in ? now + Number(nextToken.expires_in) : nextToken.expires_at || previous.expires_at,
      refresh_expires_at: nextToken.refresh_expires_in ? now + Number(nextToken.refresh_expires_in) : nextToken.refresh_expires_at || previous.refresh_expires_at
    };
    writeJson(SESSION_KEY, saved);
    return saved;
  }

  async function parseResponse(response) {
    const text = await response.text().catch(() => "");
    if (!text) return { data: {}, text: "" };
    try { return { data: JSON.parse(text), text }; } catch { return { data: {}, text }; }
  }

  function tokenError(prefix, response, data, text) {
    const parts = [prefix, `HTTP ${response.status}`];
    const msg = data.error_description || data.Message || data.message || data.error;
    if (msg) parts.push(msg);
    if (msg === "OriginHeaderDoesNotMatchKey") {
      parts.push(`required_origin=${window.location.origin}`);
      parts.push("Fix this in the Bungie app for client_id 53180 / this API key: set Origin Header to the required_origin value.");
    }
    if (!msg && text) parts.push(text.slice(0, 600));
    parts.push(`auth_redirect_uri=${redirectUri()}`);
    parts.push(`client_id=${clientId()}`);
    parts.push(`code_present=${Boolean(authCode())}`);
    parts.push(`api_key_present=${Boolean(apiKey())}`);
    return parts.join(" | ");
  }

  async function exchangeCodeForToken() {
    const code = authCode();
    const key = requireApiKey();
    if (!code) throw new Error("No Bungie login code captured. Click Login with Bungie first.");
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", code);
    body.set("client_id", clientId());
    const response = await fetch(CONFIG.tokenUrl || `${API_ROOT}/App/OAuth/Token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-API-Key": key },
      body
    });
    const { data, text } = await parseResponse(response);
    if (!response.ok || !data.access_token) {
      localStorage.removeItem(SESSION_KEY);
      throw new Error(tokenError("Bungie token exchange failed", response, data, text));
    }
    return saveToken(data);
  }

  async function refreshToken() {
    const key = requireApiKey();
    const saved = token();
    if (!saved.refresh_token) throw new Error("No refresh token found. Login with Bungie again.");
    const body = new URLSearchParams();
    body.set("grant_type", "refresh_token");
    body.set("refresh_token", saved.refresh_token);
    body.set("client_id", clientId());
    const response = await fetch(CONFIG.tokenUrl || `${API_ROOT}/App/OAuth/Token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-API-Key": key },
      body
    });
    const { data, text } = await parseResponse(response);
    if (!response.ok || !data.access_token) {
      localStorage.removeItem(SESSION_KEY);
      throw new Error(tokenError("Bungie token refresh failed", response, data, text));
    }
    return saveToken(data);
  }

  async function ensureToken(status) {
    const saved = token();
    if (tokenIsValid(saved)) return saved;
    if (refreshTokenIsValid(saved)) {
      if (!refreshPromise) refreshPromise = refreshToken(status).finally(() => { refreshPromise = null; });
      return refreshPromise;
    }
    return exchangeCodeForToken(status);
  }

  async function bungieGet(path, status) {
    const key = requireApiKey(status);
    const currentToken = await ensureToken(status);
    const response = await fetch(`${API_ROOT}${path}`, {
      headers: {
        "X-API-Key": key,
        "Authorization": `Bearer ${currentToken.access_token}`
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ErrorCode > 1) {
      throw new Error(data.Message || data.error || `Bungie request failed (${response.status}).`);
    }
    return data.Response || data;
  }

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
  }

  function catalogItems() {
    return [
      ...(CATALOG.weapons || []).map(item => ({ ...item, kind: "weapon" })),
      ...Object.entries(CATALOG.armor || {}).flatMap(([className, list]) =>
        (Array.isArray(list) ? list : []).map(item => ({ ...item, kind: "armor", className }))
      )
    ];
  }

  function explicitCollectibleHashes(item) {
    return [item.collectibleHash, item.bungieCollectibleHash, ...(item.collectibleHashes || [])]
      .filter(value => value !== undefined && value !== null)
      .map(String);
  }

  function cacheKeyForItem(item) {
    return `${item.kind}:${item.className || ""}:${item.id}`;
  }

  function readMapCache() {
    const cached = readJson(MAP_CACHE_KEY);
    return cached && cached.version === 1 && cached.items ? cached : { version: 1, items: {} };
  }

  function saveMapCache(cache) {
    writeJson(MAP_CACHE_KEY, cache);
  }

  function collectSearchCandidates(value, output = []) {
    if (!value || typeof value !== "object") return output;
    const name = value.displayProperties?.name;
    const collectibleHash = value.collectibleHash || value.inventory?.collectibleHash;
    if (name && collectibleHash) output.push({ name, collectibleHash: String(collectibleHash), hash: value.hash });
    if (Array.isArray(value)) {
      value.forEach(entry => collectSearchCandidates(entry, output));
      return output;
    }
    Object.values(value).forEach(entry => collectSearchCandidates(entry, output));
    return output;
  }

  async function resolveCatalogItem(item, cache, status, index, total) {
    const explicit = explicitCollectibleHashes(item);
    if (explicit.length) return { name: item.name, collectibleHashes: explicit, source: "catalog" };

    const key = cacheKeyForItem(item);
    const cached = cache.items[key];
    if (cached && cached.name === item.name && Array.isArray(cached.collectibleHashes)) return cached;

    if (status && index % 12 === 0) status.textContent = `Resolving Bungie catalog matches ${index + 1}/${total}...`;
    const searchTerm = encodeURIComponent(item.name || item.id);
    const response = await bungieGet(`/Destiny2/Armory/Search/DestinyInventoryItemDefinition/${searchTerm}/?lc=en`, status);
    const target = normalize(item.name);
    const candidates = collectSearchCandidates(response);
    const exact = candidates.find(candidate => normalize(candidate.name) === target);
    const loose = exact || candidates.find(candidate => normalize(candidate.name).includes(target) || target.includes(normalize(candidate.name)));
    const result = {
      name: item.name,
      collectibleHashes: loose ? [String(loose.collectibleHash)] : [],
      source: loose ? "armory_search" : "unresolved",
      resolvedAt: new Date().toISOString()
    };
    cache.items[key] = result;
    saveMapCache(cache);
    return result;
  }

  async function resolveCatalogMappings(status) {
    const cache = readMapCache();
    const items = catalogItems();
    const mappings = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      try {
        const match = await resolveCatalogItem(item, cache, status, index, items.length);
        mappings.push({ item, ...match });
      } catch (error) {
        mappings.push({ item, name: item.name, collectibleHashes: [], source: "error", error: error.message || String(error) });
      }
    }
    return mappings;
  }

  function isCollectedCollectible(entry) {
    if (!entry || entry.state === undefined) return false;
    return (Number(entry.state) & NOT_ACQUIRED) === 0;
  }

  function ownedCollectibleHashes(profile) {
    const collectibles = profile?.profileCollectibles?.data?.collectibles || {};
    return new Set(Object.entries(collectibles).filter(([, entry]) => isCollectedCollectible(entry)).map(([hash]) => String(hash)));
  }

  function profileNames(dump) {
    const names = [];
    (dump.memberships || []).forEach(item => {
      names.push(item.displayName, item.bungieGlobalDisplayName);
    });
    (dump.profiles || []).forEach(item => {
      names.push(item.displayName, item.bungieGlobalDisplayName);
    });
    return names.filter(Boolean);
  }

  function playerForDump(dump) {
    const haystack = profileNames(dump).map(normalize).join(" ");
    if (haystack.includes("erebusares")) return "corey";
    if (haystack.includes("iceededpple")) return "matt";
    if (haystack.includes("corey") || haystack.includes("ares")) return "corey";
    if (haystack.includes("matt") || haystack.includes("icee")) return "matt";
    return "";
  }

  async function buildLiveSyncPayload(dump, status) {
    const player = playerForDump(dump);
    const allOwnedHashes = new Set();
    (dump.profiles || []).forEach(profileEntry => {
      ownedCollectibleHashes(profileEntry.profile).forEach(hash => allOwnedHashes.add(hash));
    });

    if (!player) {
      return { ok: false, reason: "unknown_player", player: "", itemIds: [], itemNames: [], ownedCollectibleHashes: allOwnedHashes.size };
    }

    const mappings = await resolveCatalogMappings(status);
    const matched = mappings.filter(entry => (entry.collectibleHashes || []).some(hash => allOwnedHashes.has(String(hash))));
    const unresolved = mappings.filter(entry => !(entry.collectibleHashes || []).length).map(entry => ({ id: entry.item.id, name: entry.item.name, kind: entry.item.kind, source: entry.source }));
    return {
      ok: true,
      player,
      matchedCatalogItems: matched.length,
      ownedCollectibleHashes: allOwnedHashes.size,
      itemIds: matched.map(entry => entry.item.id),
      itemNames: matched.map(entry => entry.item.name),
      unresolvedCatalogItems: unresolved.slice(0, 40),
      unresolvedCatalogItemCount: unresolved.length
    };
  }

  function collectibleStats(profile) {
    const collectibleMap = profile?.profileCollectibles?.data?.collectibles || {};
    const ids = Object.keys(collectibleMap);
    const visible = ids.filter(id => collectibleMap[id]?.state !== undefined);
    return {
      expectedFullExoticItemTotal: EXPECTED_EXOTIC_TOTAL,
      returnedCollectibleRecords: ids.length,
      returnedVisibleCollectibleRecords: visible.length,
      note: "Expected total is the full exotic-item target provided by the user. Returned counts are raw Bungie collectible records from this profile response."
    };
  }

  async function buildCollectionDump(status) {
    const memberships = await bungieGet("/User/GetMembershipsForCurrentUser/", status);
    const destinyMemberships = memberships.destinyMemberships || [];
    const profiles = [];
    for (const membership of destinyMemberships) {
      const membershipType = membership.membershipType;
      const membershipId = membership.membershipId;
      if (!membershipType || !membershipId) continue;
      if (status) status.textContent = `Pulling collection/profile data for ${membership.displayName || membershipId}...`;
      const profile = await bungieGet(`/Destiny2/${membershipType}/Profile/${membershipId}/?components=100,200,800,900`, status);
      profiles.push({
        membershipType,
        membershipId,
        displayName: membership.displayName || memberships.bungieNetUser?.displayName || "",
        bungieGlobalDisplayName: memberships.bungieNetUser?.uniqueName || memberships.bungieNetUser?.displayName || "",
        collectionStats: collectibleStats(profile),
        profile
      });
    }
    return {
      d2CollectionsApiDump: true,
      generatedAt: new Date().toISOString(),
      note: "Logged-in Bungie account collection/profile dump. The site also attempts to live-apply owned catalog matches for Ares/Corey or Icee/Matt.",
      source: "logged_in_bungie_account",
      expectedFullExoticItemTotal: EXPECTED_EXOTIC_TOTAL,
      membershipCount: destinyMemberships.length,
      memberships: destinyMemberships.map(item => ({
        membershipType: item.membershipType,
        membershipId: item.membershipId,
        displayName: item.displayName,
        bungieGlobalDisplayName: memberships.bungieNetUser?.uniqueName || memberships.bungieNetUser?.displayName || ""
      })),
      profiles
    };
  }

  function init() {
    const attach = () => {
      const panel = document.querySelector("#apiHandoffPanel");
      const actions = panel?.querySelector(".api-handoff-actions");
      const output = panel?.querySelector("#apiOutputBox");
      const status = panel?.querySelector("#apiHandoffStatus");
      if (!panel || !actions || !output || !status || panel.querySelector("#dumpLoggedInCollectionBtn")) return false;
      const button = document.createElement("button");
      button.id = "dumpLoggedInCollectionBtn";
      button.className = "button primary";
      button.type = "button";
      button.textContent = "Dump logged-in collection";
      actions.prepend(button);
      if (!storedApiKey() && !CONFIG.apiKey) {
        const hint = document.createElement("div");
        hint.className = "api-handoff-status";
        hint.textContent = "First dump will ask for your Bungie API key and save it locally in this browser.";
        actions.insertAdjacentElement("afterend", hint);
      }
      button.addEventListener("click", async () => {
        button.disabled = true;
        status.textContent = "Pulling logged-in Bungie collection/profile data...";
        try {
          const dump = await buildCollectionDump(status);
          const liveSync = await buildLiveSyncPayload(dump, status);
          let applyResult = { ok: false, reason: "app_hook_unavailable" };
          if (liveSync.ok && window.D2_COLLECTIONS_APP?.applyCollectionOwnership) {
            applyResult = window.D2_COLLECTIONS_APP.applyCollectionOwnership(liveSync);
          }
          dump.liveSync = { ...liveSync, applyResult };
          output.value = JSON.stringify(dump, null, 2);
          if (liveSync.ok) {
            status.textContent = `Synced ${applyResult.matchedItems || liveSync.matchedCatalogItems || 0} catalog item(s) for ${liveSync.player}. Newly marked: ${applyResult.weaponsChanged || 0} weapons, ${applyResult.armorChanged || 0} armor. Copy the dump/export if you want this committed to repo data.`;
          } else {
            status.textContent = `Built collection dump, but could not live-sync because ${liveSync.reason}. Copy the dump and tell me whether it is Ares/Corey or Icee/Matt.`;
          }
        } catch (error) {
          status.textContent = error.message || String(error);
        } finally {
          button.disabled = false;
        }
      });
      return true;
    };
    if (attach()) return;
    const timer = setInterval(() => { if (attach()) clearInterval(timer); }, 250);
    setTimeout(() => clearInterval(timer), 5000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
