(() => {
  const CONFIG = window.D2_BUNGIE_CONFIG || {};
  const AUTH_KEY = "d2-collections-auth-v1";
  const SESSION_KEY = "d2-collections-bungie-session-v2";
  const API_KEY_STORAGE = "d2-collections-bungie-api-key";
  const API_ROOT = "https://www.bungie.net/Platform";
  const EXPECTED_EXOTIC_TOTAL = 1239;
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
    if (status) status.textContent = "Saved Bungie API key locally. Continuing collection dump…";
    return value;
  }

  function clientId() {
    return CONFIG.clientId || "53180";
  }

  function redirectUri() {
    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    return `${url.origin}${url.pathname}`;
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

  async function exchangeCodeForToken(status) {
    const code = authCode();
    const key = requireApiKey(status);
    if (!code) throw new Error("No Bungie login code captured. Click Login with Bungie first.");
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", code);
    body.set("client_id", clientId());
    body.set("redirect_uri", redirectUri());
    const response = await fetch(CONFIG.tokenUrl || `${API_ROOT}/App/OAuth/Token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-API-Key": key },
      body
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) {
      throw new Error(data.error_description || data.Message || data.error || `Bungie token exchange failed (${response.status}).`);
    }
    return saveToken(data);
  }

  async function refreshToken(status) {
    const key = requireApiKey(status);
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
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) {
      localStorage.removeItem(SESSION_KEY);
      throw new Error(data.error_description || data.Message || data.error || `Bungie token refresh failed (${response.status}).`);
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
      if (status) status.textContent = `Pulling collection/profile data for ${membership.displayName || membershipId}…`;
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
      note: "Logged-in Bungie account collection/profile dump. Tell ChatGPT whether this dump is for Corey/Ares or Matt/Icee.",
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
        status.textContent = "Pulling logged-in Bungie collection/profile data…";
        try {
          const dump = await buildCollectionDump(status);
          output.value = JSON.stringify(dump, null, 2);
          status.textContent = `Built logged-in collection dump for ${dump.membershipCount} Destiny membership(s). Expected exotic total target: ${dump.expectedFullExoticItemTotal}. Send this here and tell me who it belongs to.`;
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
