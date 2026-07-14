(() => {
  const CONFIG = window.D2_BUNGIE_CONFIG || {};
  const CATALOG = window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: {} };
  const STATIC_COLLECTIBLES = window.D2_COLLECTIONS_BUNGIE_COLLECTIBLES || { items: {} };
  const ITEM_UNLOCKS = window.D2_COLLECTIONS_ITEM_UNLOCKS || { items: {} };
  const AUTH_KEY = "d2-collections-auth-v1";
  const SESSION_KEY = "d2-collections-bungie-session-v2";
  const API_KEY_STORAGE = "d2-collections-bungie-api-key";
  const MAP_CACHE_KEY = "d2-collections-bungie-catalog-map-v1";
  const API_ROOT = "https://www.bungie.net/Platform";
  const CLOUD_API = String(CONFIG.cloudSyncApi || "").replace(/\/+$/, "");
  const EXPECTED_EXOTIC_TOTAL = 1239;
  const OAUTH_REDIRECT_URI = "https://erebusares.github.io/D2-Collections/index.html";
  const NOT_ACQUIRED = 1;
  const XUR_VENDOR_HASH = "2190858386";
  const VENDOR_SALES_COMPONENT = 402;
  const ITEM_DEF_CACHE_KEY = "d2-collections-item-def-cache-v1";
  const RECORD_DEF_CACHE_KEY = "d2-collections-record-def-cache-v1";
  const EXOTIC_CIPHER_HASHES = new Set(["3467984096", "187236078", "825199458"]);
  const EXOTIC_ENGRAM_HASHES = new Set(["343863063", "685908770", "761932252", "773306547", "903043774", "935088801", "1010947726", "1425215686", "1728121941", "2122520503", "2176771682", "2370072441", "2564361489", "2685382923", "2762058303", "2778705488", "2907562922", "3290874772", "3484503346", "3670763683", "3875551374", "4003905209", "4106630301", "4111522113"]);
  const REFRESH_LOCK_KEY = "d2-collections-bungie-refresh-lock-v1";
  const REFRESH_LOCK_TTL_MS = 60000;
  const REFRESH_WAIT_MS = 65000;
  const EXCHANGE_LOCK_KEY = "d2-collections-bungie-code-exchange";
  const TAB_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let refreshPromise = null;
  let exchangePromise = null;
  let autoExchangeStarted = false;

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
    if (!value) throw new Error("No Bungie API key saved. Paste the key when prompted, then retry sync.");
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

  function clearAuthCode(reason = "") {
    const saved = readJson(AUTH_KEY);
    writeJson(AUTH_KEY, {
      ...saved,
      oauthCode: "",
      clearedAt: new Date().toISOString(),
      clearReason: reason
    });
  }

  function token() {
    return readJson(SESSION_KEY);
  }

  function tokenIsValid(saved = token()) {
    return Boolean(saved.access_token && saved.expires_at && saved.expires_at > Math.floor(Date.now() / 1000) + 60);
  }

  function refreshTokenIsValid(saved = token()) {
    const now = Math.floor(Date.now() / 1000) + 60;
    return Boolean(
      (saved.server_session_token && (!saved.refresh_expires_at || saved.refresh_expires_at > now)) ||
      (!saved.auth_error && saved.refresh_token && (!saved.refresh_expires_at || saved.refresh_expires_at > now))
    );
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function refreshLock() {
    try { return JSON.parse(localStorage.getItem(REFRESH_LOCK_KEY) || "{}"); } catch { return {}; }
  }

  function acquireRefreshLock() {
    const now = Date.now();
    const lock = refreshLock();
    if (lock.owner && lock.expiresAt && lock.expiresAt > now && lock.owner !== TAB_ID) return false;
    const next = { owner: TAB_ID, expiresAt: now + REFRESH_LOCK_TTL_MS };
    localStorage.setItem(REFRESH_LOCK_KEY, JSON.stringify(next));
    return refreshLock().owner === TAB_ID;
  }

  function releaseRefreshLock() {
    if (refreshLock().owner === TAB_ID) localStorage.removeItem(REFRESH_LOCK_KEY);
  }

  function saveToken(nextToken) {
    const now = Math.floor(Date.now() / 1000);
    const previous = token();
    const saved = {
      ...previous,
      ...nextToken,
      auth_error_at: "",
      auth_error: "",
      saved_at: now,
      expires_at: nextToken.expires_in ? now + Number(nextToken.expires_in) : nextToken.expires_at || previous.expires_at,
      refresh_expires_at: nextToken.refresh_expires_in ? now + Number(nextToken.refresh_expires_in) : nextToken.refresh_expires_at || previous.refresh_expires_at
    };
    writeJson(SESSION_KEY, saved);
    return saved;
  }

  function markAuthRefreshError(error) {
    const saved = token();
    if (!saved.access_token && !saved.refresh_token) return saved;
    const next = {
      ...saved,
      auth_error_at: new Date().toISOString(),
      auth_error: String(error || "Bungie refresh failed")
    };
    writeJson(SESSION_KEY, next);
    return next;
  }

  function waitForTokenRotation(usedRefreshToken, timeoutMs = 10000) {
    return new Promise(resolve => {
      let done = false;
      let timer = 0;
      let poll = 0;
      const finish = value => {
        if (done) return;
        done = true;
        window.removeEventListener("storage", onStorage);
        clearTimeout(timer);
        clearInterval(poll);
        resolve(value);
      };
      const check = () => {
        const current = token();
        if (current.refresh_token && current.refresh_token !== usedRefreshToken && (tokenIsValid(current) || refreshTokenIsValid(current))) {
          finish(current);
          return true;
        }
        if (tokenIsValid(current)) {
          finish(current);
          return true;
        }
        return false;
      };
      const onStorage = event => {
        if (event.key === SESSION_KEY) check();
      };
      if (check()) return;
      window.addEventListener("storage", onStorage);
      poll = setInterval(check, 250);
      timer = setTimeout(() => {
        clearInterval(poll);
        finish(null);
      }, timeoutMs);
    });
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

  function isInvalidAuthCode(data) {
    const msg = data.error_description || data.Message || data.message || data.error || "";
    return String(msg).toLowerCase().includes("authorizationcodeinvalid");
  }

  function isInvalidRefreshToken(data) {
    const msg = String(data.error_description || data.Message || data.message || data.error || "").toLowerCase();
    return msg.includes("refreshtoken") || msg.includes("refresh_token") || msg.includes("invalid_grant") || msg.includes("authorizationcodeinvalid");
  }

  async function exchangeCodeForToken() {
    const code = authCode();
    if (!code) throw new Error("No Bungie login code captured. Click Login with Bungie first.");
    const persistent = await exchangeCodeWithWorker(code);
    if (persistent) {
      clearAuthCode("exchanged_for_persistent_session");
      return persistent;
    }
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", code);
    body.set("client_id", clientId());
    const response = await fetch(CONFIG.tokenUrl || `${API_ROOT}/App/OAuth/Token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const { data, text } = await parseResponse(response);
    if (!response.ok || !data.access_token) {
      if (isInvalidAuthCode(data)) {
        clearAuthCode("authorization_code_invalid");
        throw new Error([
          "Bungie login code expired or was already used.",
          "Click Login with Bungie again, then click Sync Bungie + cloud immediately after returning.",
          tokenError("Bungie token exchange failed", response, data, text)
        ].join(" | "));
      }
      throw new Error(tokenError("Bungie token exchange failed", response, data, text));
    }
    clearAuthCode("exchanged_for_token");
    return saveToken(data);
  }

  async function exchangeCodeAcrossTabs(status) {
    const exchange = async () => {
      const code = authCode();
      if (code) return exchangeCodeForToken(status);
      const saved = token();
      if (tokenIsValid(saved)) return saved;
      if (refreshTokenIsValid(saved)) return refreshTokenAcrossTabs(status);
      throw new Error("No Bungie login code captured. Click Login with Bungie first.");
    };
    if (navigator.locks?.request) {
      return navigator.locks.request(EXCHANGE_LOCK_KEY, { mode: "exclusive" }, exchange);
    }
    return exchange();
  }

  function exchangeCodeOnce(status) {
    if (!exchangePromise) {
      exchangePromise = exchangeCodeAcrossTabs(status).finally(() => { exchangePromise = null; });
    }
    return exchangePromise;
  }

  async function refreshToken() {
    const saved = token();
    if (saved.server_session_token) return refreshTokenWithWorker(saved.server_session_token);
    if (!saved.refresh_token) throw new Error("No refresh token found. Login with Bungie again.");
    const usedRefreshToken = saved.refresh_token;
    const body = new URLSearchParams();
    body.set("grant_type", "refresh_token");
    body.set("refresh_token", usedRefreshToken);
    body.set("client_id", clientId());
    const response = await fetch(CONFIG.tokenUrl || `${API_ROOT}/App/OAuth/Token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const { data, text } = await parseResponse(response);
    if (!response.ok || !data.access_token) {
      if (isInvalidRefreshToken(data)) {
        const rotated = await waitForTokenRotation(usedRefreshToken);
        if (rotated) return rotated;
        const current = token();
        if (current.refresh_token && current.refresh_token !== usedRefreshToken && (tokenIsValid(current) || refreshTokenIsValid(current))) return current;
        markAuthRefreshError(tokenError("Bungie token refresh failed", response, data, text));
      }
      if (isInvalidAuthCode(data)) clearAuthCode("refresh_invalidated_auth_code");
      throw new Error(tokenError("Bungie token refresh failed", response, data, text));
    }
    return saveToken(data);
  }

  async function exchangeCodeWithWorker(code) {
    if (!CLOUD_API) return null;
    const response = await fetch(`${CLOUD_API}/api/auth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 404 || (response.status === 503 && ["missing_client_secret", "missing_encryption_key"].includes(data.reason))) return null;
    if (!response.ok || !data.ok || !data.sessionToken || !data.accessToken) {
      throw new Error(data.message || data.reason || "Persistent Bungie login exchange failed.");
    }
    return savePersistentToken(data);
  }

  async function refreshTokenWithWorker(sessionToken) {
    if (!CLOUD_API) throw new Error("Persistent login Worker is not configured.");
    const response = await fetch(`${CLOUD_API}/api/auth/refresh`, {
      method: "POST",
      headers: { "Authorization": `D2Session ${sessionToken}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok || !data.accessToken) {
      if (response.status === 401) {
        const saved = token();
        writeJson(SESSION_KEY, { ...saved, server_session_token: "", access_token: "", expires_at: 0 });
      }
      throw new Error(data.message || data.reason || "Persistent Bungie login refresh failed.");
    }
    return savePersistentToken(data);
  }

  function savePersistentToken(data) {
    return saveToken({
      access_token: data.accessToken,
      expires_at: Number(data.accessExpiresAt || 0),
      expires_in: 0,
      refresh_token: "",
      refresh_expires_at: Number(data.refreshExpiresAt || 0),
      refresh_expires_in: 0,
      server_session_token: data.sessionToken,
      persistent: true,
      player: data.player || "",
      membership_id: data.membershipId || ""
    });
  }

  async function refreshTokenAcrossTabs(status) {
    if (navigator.locks?.request) {
      if (status) status.textContent = "Checking Bungie login session...";
      return navigator.locks.request(REFRESH_LOCK_KEY, { mode: "exclusive" }, async () => {
        const latest = token();
        if (tokenIsValid(latest)) return latest;
        if (!refreshTokenIsValid(latest)) {
          throw new Error("Bungie login refresh expired. Click Login with Bungie again.");
        }
        return refreshToken(status);
      });
    }

    const started = Date.now();
    while (Date.now() - started < REFRESH_WAIT_MS) {
      const current = token();
      if (tokenIsValid(current)) return current;
      if (!refreshTokenIsValid(current)) break;
      if (acquireRefreshLock()) {
        try {
          const latest = token();
          if (tokenIsValid(latest)) return latest;
          if (!refreshTokenIsValid(latest)) break;
          return await refreshToken(status);
        } finally {
          releaseRefreshLock();
        }
      }
      if (status) status.textContent = "Bungie login refresh is already running in another tab...";
      await sleep(350 + Math.floor(Math.random() * 250));
    }
    const finalToken = token();
    if (tokenIsValid(finalToken)) return finalToken;
    if (refreshTokenIsValid(finalToken) && acquireRefreshLock()) {
      try {
        const latest = token();
        if (tokenIsValid(latest)) return latest;
        return await refreshToken(status);
      } finally {
        releaseRefreshLock();
      }
    }
    throw new Error("Bungie login refresh timed out. Click Login with Bungie again if this continues.");
  }

  async function ensureToken(status) {
    // A saved authorization code represents an explicit fresh login and must
    // replace any older Worker or refresh-token session.
    if (authCode()) return exchangeCodeOnce(status);
    const saved = token();
    if (tokenIsValid(saved)) {
      return saved;
    }
    if (refreshTokenIsValid(saved)) {
      if (!refreshPromise) refreshPromise = refreshTokenAcrossTabs(status).finally(() => { refreshPromise = null; });
      return refreshPromise;
    }
    if (saved.access_token || saved.refresh_token || saved.server_session_token) {
      throw new Error("Bungie session needs a fresh login. Click Refresh Bungie login.");
    }
    return exchangeCodeOnce(status);
  }

  window.D2_COLLECTIONS_AUTH = {
    ensureAccessToken: async status => (await ensureToken(status)).access_token || "",
    sessionIsUsable: () => tokenIsValid() || refreshTokenIsValid(),
    clearSession: () => {
      const saved = token();
      if (CLOUD_API && saved.server_session_token) {
        fetch(`${CLOUD_API}/api/auth/session`, {
          method: "DELETE",
          headers: { "Authorization": `D2Session ${saved.server_session_token}` }
        }).catch(() => {});
      }
      localStorage.removeItem(SESSION_KEY);
      clearAuthCode("manual_logout");
    }
  };

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

  function centralParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hour12: false
    }).formatToParts(date).reduce((out, part) => {
      out[part.type] = part.value;
      return out;
    }, {});
    return { weekday: parts.weekday, hour: Number(parts.hour || 0), minute: Number(parts.minute || 0) };
  }

  function xurWindowActive(date = new Date()) {
    const { weekday, hour, minute } = centralParts(date);
    const minutes = hour * 60 + minute;
    if (weekday === "Fri") return minutes >= 12 * 60;
    if (weekday === "Sat" || weekday === "Sun") return true;
    if (weekday === "Mon") return minutes < 12 * 60;
    return false;
  }

  function readItemDefCache() {
    const cached = readJson(ITEM_DEF_CACHE_KEY);
    return cached && cached.version === 1 && cached.items ? cached : { version: 1, items: {} };
  }

  function saveItemDefCache(cache) {
    writeJson(ITEM_DEF_CACHE_KEY, cache);
  }

  function readRecordDefCache() {
    const cached = readJson(RECORD_DEF_CACHE_KEY);
    return cached && cached.version === 1 && cached.items ? cached : { version: 1, items: {} };
  }

  function saveRecordDefCache(cache) {
    writeJson(RECORD_DEF_CACHE_KEY, cache);
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
    const staticMatch = STATIC_COLLECTIBLES.items?.[item.id]?.collectibleHashes || [];
    if (staticMatch.length) return { name: item.name, collectibleHashes: staticMatch.map(String), source: "static_manifest" };

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
    const owned = new Set();
    const addOwned = collectibles => {
      Object.entries(collectibles || {}).forEach(([hash, entry]) => {
        if (isCollectedCollectible(entry)) owned.add(String(hash));
      });
    };
    addOwned(profile?.profileCollectibles?.data?.collectibles);
    Object.values(profile?.characterCollectibles?.data || {}).forEach(characterData => {
      addOwned(characterData?.collectibles);
    });
    return owned;
  }

  function recordIsComplete(entry) {
    if (!entry || entry.state === undefined) return false;
    const state = Number(entry.state);
    const hidden = Boolean(state & 8) || Boolean(state & 16);
    return Boolean(state & 1) || (!hidden && !Boolean(state & 4));
  }

  function recordHasProgress(entry) {
    return (entry?.objectives || []).some(objective => Boolean(objective?.complete) || Number(objective?.progress || 0) > 0);
  }

  function catalystRecordHashes(profile) {
    const active = new Set();
    const complete = new Set();
    const addRecords = records => {
      Object.entries(records || {}).forEach(([hash, entry]) => {
        const key = String(hash);
        if (recordIsComplete(entry)) {
          active.add(key);
          complete.add(key);
        } else if (recordHasProgress(entry)) {
          active.add(key);
        }
      });
    };
    addRecords(profile?.profileRecords?.data?.records);
    Object.values(profile?.characterRecords?.data || {}).forEach(characterData => addRecords(characterData?.records));
    return { active, complete };
  }

  function itemQuantity(entry) {
    return Number(entry?.quantity || entry?.itemInstanceId && 1 || 0);
  }

  function addResourceCountsFromItems(items, counts) {
    (items || []).forEach(item => {
      const hash = String(item?.itemHash || item?.hash || "");
      if (!hash) return;
      const quantity = itemQuantity(item) || 1;
      if (EXOTIC_CIPHER_HASHES.has(hash)) counts.exoticCiphers += quantity;
      if (EXOTIC_ENGRAM_HASHES.has(hash)) counts.exoticEngrams += quantity;
    });
  }

  function profileResourceCounts(profile) {
    const counts = { exoticCiphers: 0, exoticEngrams: 0 };
    addResourceCountsFromItems(profile?.profileCurrencies?.data?.items, counts);
    addResourceCountsFromItems(profile?.profileInventory?.data?.items, counts);
    Object.values(profile?.characterInventories?.data || {}).forEach(characterData => addResourceCountsFromItems(characterData?.items, counts));
    return counts;
  }

  function characterIds(profile) {
    return [
      ...(profile?.profile?.data?.characterIds || []),
      ...Object.keys(profile?.characters?.data || {})
    ].map(String).filter(Boolean);
  }

  function saleItemHashes(vendorResponse) {
    const sales = vendorResponse?.sales?.data || vendorResponse?.sales || {};
    return [...new Set(Object.values(sales).flatMap(sale => [
      sale?.itemHash,
      sale?.saleItemHash,
      sale?.item?.itemHash,
      sale?.item?.hash
    ]).filter(value => value !== undefined && value !== null).map(String))];
  }

  async function inventoryItemName(itemHash, cache, status) {
    const key = String(itemHash);
    const cached = cache.items[key];
    if (cached?.name) return cached.name;
    const definition = await bungieGet(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${encodeURIComponent(key)}/?lc=en`, status);
    const name = definition?.displayProperties?.name || definition?.item?.displayProperties?.name || "";
    cache.items[key] = { name, resolvedAt: new Date().toISOString() };
    saveItemDefCache(cache);
    return name;
  }

  async function recordDefinitionInfo(recordHash, cache, status) {
    const key = String(recordHash);
    const cached = cache.items[key];
    if (cached?.name || cached?.icon) return cached;
    const definition = await bungieGet(`/Destiny2/Manifest/DestinyRecordDefinition/${encodeURIComponent(key)}/?lc=en`, status);
    const info = {
      name: definition?.displayProperties?.name || "",
      icon: definition?.displayProperties?.icon || "",
      resolvedAt: new Date().toISOString()
    };
    cache.items[key] = info;
    saveRecordDefCache(cache);
    return info;
  }

  function matchCatalogByNames(names) {
    const wanted = new Set(names.map(normalize).filter(Boolean));
    return catalogItems().filter(item => wanted.has(normalize(item.name)));
  }

  async function fetchXurInventory(dump, status) {
    const checkedAt = new Date().toISOString();
    if (!xurWindowActive()) {
      return { ok: false, active: false, reason: "xur_inactive_window", checkedAt, itemIds: [], itemNames: [], saleItemHashes: [] };
    }

    const profileEntry = (dump.profiles || [])[0];
    const ids = characterIds(profileEntry?.profile);
    if (!profileEntry || !ids.length) {
      return { ok: false, active: true, reason: "no_character_for_xur_vendor", checkedAt, itemIds: [], itemNames: [], saleItemHashes: [] };
    }

    let vendorResponse = null;
    let lastError = "";
    for (const characterId of ids) {
      try {
        vendorResponse = await bungieGet(`/Destiny2/${profileEntry.membershipType}/Profile/${profileEntry.membershipId}/Character/${characterId}/Vendors/${XUR_VENDOR_HASH}/?components=${VENDOR_SALES_COMPONENT}`, status);
        if (saleItemHashes(vendorResponse).length) break;
      } catch (error) {
        lastError = error.message || String(error);
      }
    }

    if (!vendorResponse) {
      return { ok: false, active: true, reason: lastError || "xur_vendor_unavailable", checkedAt, itemIds: [], itemNames: [], saleItemHashes: [] };
    }

    const hashes = saleItemHashes(vendorResponse);
    const cache = readItemDefCache();
    const itemNames = [];
    for (const hash of hashes) {
      try {
        if (status) status.textContent = "Resolving Xur sale item names...";
        const name = await inventoryItemName(hash, cache, status);
        if (name) itemNames.push(name);
      } catch {}
    }

    const matched = matchCatalogByNames(itemNames);
    const matchedNames = new Set(matched.map(item => normalize(item.name)));
    return {
      ok: true,
      active: true,
      location: "Tower",
      checkedAt,
      saleItemHashes: hashes,
      itemIds: matched.map(item => item.id),
      itemNames: matched.map(item => item.name),
      unmatchedItems: itemNames.filter(name => !matchedNames.has(normalize(name))).map(name => ({ name }))
    };
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
    if (haystack.includes("fears")) return "chris";
    if (haystack.includes("4611686018470990353")) return "chris";
    if (haystack.includes("corey") || haystack.includes("ares")) return "corey";
    if (haystack.includes("matt") || haystack.includes("icee")) return "matt";
    if (haystack.includes("chris")) return "chris";
    return "";
  }

  async function buildLiveSyncPayload(dump, status) {
    const player = playerForDump(dump);
    const allOwnedHashes = new Set();
    const activeCatalystRecords = new Set();
    const completedCatalystRecords = new Set();
    const resourceCounts = { exoticCiphers: 0, exoticEngrams: 0 };
    (dump.profiles || []).forEach(profileEntry => {
      ownedCollectibleHashes(profileEntry.profile).forEach(hash => allOwnedHashes.add(hash));
      const catalystRecords = catalystRecordHashes(profileEntry.profile);
      catalystRecords.active.forEach(hash => activeCatalystRecords.add(hash));
      catalystRecords.complete.forEach(hash => completedCatalystRecords.add(hash));
      const profileResources = profileResourceCounts(profileEntry.profile);
      resourceCounts.exoticCiphers += profileResources.exoticCiphers;
      resourceCounts.exoticEngrams += profileResources.exoticEngrams;
    });

    if (!player) {
      return { ok: false, reason: "unknown_player", player: "", itemIds: [], itemNames: [], ownedCollectibleHashes: allOwnedHashes.size };
    }

    const mappings = await resolveCatalogMappings(status);
    const matched = mappings.filter(entry => (entry.collectibleHashes || []).some(hash => allOwnedHashes.has(String(hash))));
    const catalystActive = mappings.filter(entry =>
      entry.item.kind === "weapon" &&
      (STATIC_COLLECTIBLES.items?.[entry.item.id]?.catalystRecordHashes || []).some(hash => activeCatalystRecords.has(String(hash)))
    );
    const catalystComplete = mappings.filter(entry =>
      entry.item.kind === "weapon" &&
      (STATIC_COLLECTIBLES.items?.[entry.item.id]?.catalystRecordHashes || []).some(hash => completedCatalystRecords.has(String(hash)))
    );
    const catalystRecordHashesByItem = {};
    const completeRecordHashesByItem = {};
    const unlockCollectibleHashesByItem = {};
    mappings.forEach(entry => {
      if (entry.item.kind !== "weapon") return;
      const hashes = (STATIC_COLLECTIBLES.items?.[entry.item.id]?.catalystRecordHashes || []).map(String);
      const active = hashes.filter(hash => activeCatalystRecords.has(hash));
      const complete = hashes.filter(hash => completedCatalystRecords.has(hash));
      if (active.length) catalystRecordHashesByItem[entry.item.id] = active;
      if (complete.length) completeRecordHashesByItem[entry.item.id] = complete;
      const unlockCollectibles = (ITEM_UNLOCKS.items?.[entry.item.id]?.unlocks || [])
        .map(unlock => String(unlock.collectibleHash || ""))
        .filter(hash => hash && allOwnedHashes.has(hash));
      if (unlockCollectibles.length) unlockCollectibleHashesByItem[entry.item.id] = [...new Set(unlockCollectibles)];
    });
    const catalystDetails = {};
    const catalystDetailsByRecordHash = {};
    const recordCache = readRecordDefCache();
    const catalystDetailEntries = [...catalystActive, ...catalystComplete].flatMap(entry =>
      (STATIC_COLLECTIBLES.items?.[entry.item.id]?.catalystRecordHashes || [])
        .map(String)
        .filter(hash => activeCatalystRecords.has(hash) || completedCatalystRecords.has(hash))
        .map(recordHash => ({ entry, recordHash }))
    );
    for (const { entry, recordHash } of catalystDetailEntries) {
      if (!recordHash || catalystDetailsByRecordHash[recordHash]) continue;
      try {
        if (status) status.textContent = "Resolving catalyst record icons...";
        const info = await recordDefinitionInfo(recordHash, recordCache, status);
        const detail = {
          recordHash,
          name: info.name || `${entry.item.name} Catalyst`,
          icon: info.icon || ""
        };
        catalystDetailsByRecordHash[recordHash] = detail;
        if (!catalystDetails[entry.item.id]) catalystDetails[entry.item.id] = detail;
      } catch {
        const detail = { recordHash, name: `${entry.item.name} Catalyst`, icon: "" };
        catalystDetailsByRecordHash[recordHash] = detail;
        if (!catalystDetails[entry.item.id]) catalystDetails[entry.item.id] = detail;
      }
    }
    const unresolved = mappings.filter(entry => !(entry.collectibleHashes || []).length).map(entry => ({ id: entry.item.id, name: entry.item.name, kind: entry.item.kind, source: entry.source }));
    return {
      ok: true,
      player,
      matchedCatalogItems: matched.length,
      matchedCatalysts: catalystActive.length,
      matchedCatalystsComplete: catalystComplete.length,
      ownedCollectibleHashes: allOwnedHashes.size,
      activeCatalystRecords: activeCatalystRecords.size,
      completedCatalystRecords: completedCatalystRecords.size,
      resourceCounts,
      itemIds: matched.map(entry => entry.item.id),
      itemNames: matched.map(entry => entry.item.name),
      catalystItemIds: catalystActive.map(entry => entry.item.id),
      completeItemIds: catalystComplete.map(entry => entry.item.id),
      catalystRecordHashesByItem,
      completeRecordHashesByItem,
      unlockCollectibleHashesByItem,
      catalystDetails,
      catalystDetailsByRecordHash,
      unresolvedCatalogItems: unresolved.slice(0, 40),
      unresolvedCatalogItemCount: unresolved.length
    };
  }

  function compactProfiles(profiles) {
    return (profiles || []).map(profileEntry => ({
      membershipType: profileEntry.membershipType,
      membershipId: profileEntry.membershipId,
      displayName: profileEntry.displayName,
      bungieGlobalDisplayName: profileEntry.bungieGlobalDisplayName,
      collectionStats: profileEntry.collectionStats
    }));
  }

  function compactLiveSync(liveSync, applyResult) {
    if (!liveSync) return undefined;
    return {
      ...liveSync,
      unresolvedCatalogItems: (liveSync.unresolvedCatalogItems || []).slice(0, 20),
      applyResult
    };
  }

  function compactDumpForOutput(dump, liveSync, applyResult) {
    return {
      d2CollectionsApiDump: true,
      compactDump: true,
      generatedAt: dump.generatedAt,
      note: "Compact logged-in Bungie collection summary. Raw Bungie profile data is not printed because it can freeze the browser tab.",
      source: dump.source,
      expectedFullExoticItemTotal: dump.expectedFullExoticItemTotal,
      primaryMembershipId: dump.primaryMembershipId,
      membershipCount: dump.membershipCount,
      attemptedMembershipCount: dump.attemptedMembershipCount,
      profileErrors: dump.profileErrors,
      memberships: dump.memberships,
      profiles: compactProfiles(dump.profiles),
      liveSync: compactLiveSync(liveSync, applyResult)
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

  function orderedDestinyMemberships(memberships) {
    const list = memberships.destinyMemberships || [];
    const primary = list.find(item => item.membershipId === memberships.primaryMembershipId);
    return primary ? [primary, ...list.filter(item => item.membershipId !== primary.membershipId)] : list;
  }

  function membershipLabel(membership) {
    return `${membership.displayName || membership.membershipId || "unknown"} (${membership.membershipType || "?"}/${membership.membershipId || "?"})`;
  }

  async function buildCollectionDump(status) {
    const memberships = await bungieGet("/User/GetMembershipsForCurrentUser/", status);
    const allDestinyMemberships = memberships.destinyMemberships || [];
    const destinyMemberships = orderedDestinyMemberships(memberships);
    const profiles = [];
    const profileErrors = [];
    for (const membership of destinyMemberships) {
      const membershipType = membership.membershipType;
      const membershipId = membership.membershipId;
      if (!membershipType || !membershipId) continue;
      try {
        if (status) status.textContent = `Pulling collection/profile data for ${membership.displayName || membershipId}...`;
        const profile = await bungieGet(`/Destiny2/${membershipType}/Profile/${membershipId}/?components=100,102,103,200,201,800,900,1200`, status);
        profiles.push({
          membershipType,
          membershipId,
          displayName: membership.displayName || memberships.bungieNetUser?.displayName || "",
          bungieGlobalDisplayName: memberships.bungieNetUser?.uniqueName || memberships.bungieNetUser?.displayName || "",
          collectionStats: collectibleStats(profile),
          profile
        });
      } catch (error) {
        profileErrors.push({
          membershipType,
          membershipId,
          displayName: membership.displayName || "",
          error: error.message || String(error)
        });
      }
    }
    if (!profiles.length) {
      const details = profileErrors.map(item => `${membershipLabel(item)}: ${item.error}`).join(" | ");
      throw new Error(`No readable Destiny profile found for this Bungie login. ${details || "Bungie returned no usable Destiny memberships."}`);
    }
    return {
      d2CollectionsApiDump: true,
      generatedAt: new Date().toISOString(),
      note: "Logged-in Bungie account collection/profile dump. The site also attempts to live-apply owned catalog matches for Ares, Icee, or Fears.",
      source: "logged_in_bungie_account",
      expectedFullExoticItemTotal: EXPECTED_EXOTIC_TOTAL,
      primaryMembershipId: memberships.primaryMembershipId || "",
      membershipCount: allDestinyMemberships.length,
      attemptedMembershipCount: destinyMemberships.length,
      profileErrors,
      memberships: allDestinyMemberships.map(item => ({
        membershipType: item.membershipType,
        membershipId: item.membershipId,
        displayName: item.displayName,
        bungieGlobalDisplayName: memberships.bungieNetUser?.uniqueName || memberships.bungieNetUser?.displayName || ""
      })),
      profiles
    };
  }

  function init() {
    if (!autoExchangeStarted && authCode() && !tokenIsValid() && !refreshTokenIsValid()) {
      autoExchangeStarted = true;
      const status = document.querySelector("#apiHandoffStatus") || document.querySelector("#statusBox");
      if (status) status.textContent = "Securing Bungie login session...";
      ensureToken(status).then(() => {
        if (status) status.textContent = "Bungie login secured. Ready to sync.";
        window.D2_RENDER_COMPACT_AUTH?.();
        document.dispatchEvent(new CustomEvent("d2collections:auth-changed", { detail: { signedIn: true, persistent: Boolean(token().server_session_token) } }));
      }).catch(error => {
        if (status) status.textContent = error.message || String(error);
        document.dispatchEvent(new CustomEvent("d2collections:auth-changed", { detail: { signedIn: false, error: error.message || String(error) } }));
      });
    }

    const attach = () => {
      const panel = document.querySelector("#apiHandoffPanel");
      const actions = panel?.querySelector(".api-handoff-actions");
      const output = panel?.querySelector("#apiOutputBox");
      const status = panel?.querySelector("#apiHandoffStatus");
      if (!panel || !actions || !output || !status || panel.querySelector("#dumpLoggedInCollectionBtn")) return false;
      const setStatus = text => {
        status.textContent = text;
        window.D2_COLLECTIONS_SYNC_DEBUG?.setStatus?.(text);
      };
      const setOutput = value => {
        output.value = value;
        window.D2_COLLECTIONS_SYNC_DEBUG?.setPayload?.(value);
      };
      const button = document.createElement("button");
      button.id = "dumpLoggedInCollectionBtn";
      button.className = "button primary";
      button.type = "button";
      button.textContent = "Sync Bungie + cloud";
      actions.prepend(button);
      if (!storedApiKey() && !CONFIG.apiKey) {
        const hint = document.createElement("div");
        hint.className = "api-handoff-status";
        hint.textContent = "First dump will ask for your Bungie API key and save it locally in this browser.";
        actions.insertAdjacentElement("afterend", hint);
      }
      button.addEventListener("click", async () => {
        let syncOk = false;
        button.disabled = true;
        document.dispatchEvent(new CustomEvent("d2collections:sync-started", { detail: { source: "collection" } }));
        setStatus("Pulling logged-in Bungie collection/profile data...");
        try {
          const dump = await buildCollectionDump(status);
          setOutput(JSON.stringify(compactDumpForOutput(dump), null, 2));
          setStatus("Profile pulled. Resolving D2 Collections catalog matches...");
          const liveSync = await buildLiveSyncPayload(dump, status);
          let applyResult = { ok: false, reason: "app_hook_unavailable" };
          if (liveSync.ok && window.D2_COLLECTIONS_APP?.applyCollectionOwnership) {
            applyResult = window.D2_COLLECTIONS_APP.applyCollectionOwnership(liveSync);
          }
          let xurText = "";
          if (window.D2_COLLECTIONS_APP?.applyXurInventory) {
            try {
              setStatus("Checking Xur Tower stock...");
              const xurInventory = await fetchXurInventory(dump, status);
              window.D2_COLLECTIONS_APP.applyXurInventory(xurInventory);
              if (xurInventory.ok && xurInventory.active) {
                xurText = ` Xur Tower stock matched ${xurInventory.itemIds.length} catalog item(s).`;
              } else if (xurInventory.reason === "xur_inactive_window") {
                xurText = " Xur check skipped: outside Friday noon-Monday noon Central window.";
              } else {
                xurText = ` Xur check unavailable: ${xurInventory.reason || "no vendor data"}.`;
              }
            } catch (error) {
              xurText = ` Xur check failed: ${error.message || error}.`;
            }
          }
          const compactDump = compactDumpForOutput(dump, liveSync, applyResult);
          setOutput(JSON.stringify(compactDump, null, 2));
          if (liveSync.ok) {
            let cloudText = "";
            if (window.D2_COLLECTIONS_CLOUD_SYNC?.pushSnapshot) {
              try {
                const cloudResult = await window.D2_COLLECTIONS_CLOUD_SYNC.pushSnapshot(liveSync, applyResult, compactDump);
                cloudText = cloudResult?.ok ? " Cloud snapshot saved." : " Cloud snapshot skipped.";
              } catch (error) {
                cloudText = ` Cloud snapshot failed: ${error.message || error}.`;
              }
            }
            setStatus(`Synced ${applyResult.matchedItems || liveSync.matchedCatalogItems || 0} catalog item(s) for ${liveSync.player}. Newly marked: ${applyResult.weaponsChanged || 0} weapons, ${applyResult.armorChanged || 0} armor, ${applyResult.catalystsChanged || 0} catalysts, ${applyResult.completedChanged || 0} done.${xurText}${cloudText}`);
            syncOk = true;
          } else {
            setStatus(`Built sync debug payload, but could not live-sync because ${liveSync.reason}.`);
          }
        } catch (error) {
          setStatus(error.message || String(error));
        } finally {
          button.disabled = false;
          document.dispatchEvent(new CustomEvent("d2collections:sync-finished", { detail: { ok: syncOk, source: "collection", finishedAt: new Date().toISOString() } }));
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
