(() => {
  const CONFIG = window.D2_BUNGIE_CONFIG || {};
  const AUTH_KEY = "d2-collections-auth-v1";
  const SESSION_KEY = "d2-collections-bungie-session-v1";
  const API_ROOT = "https://www.bungie.net/Platform";

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function apiKey() {
    return CONFIG.apiKey || localStorage.getItem("d2-collections-bungie-api-key") || "";
  }

  function authCode() {
    return readJson(AUTH_KEY).oauthCode || "";
  }

  function session() {
    const saved = readJson(SESSION_KEY);
    if (!saved.bearer || !saved.expiresAt || Date.now() > saved.expiresAt) return {};
    return saved;
  }

  async function exchangeCodeForSession() {
    const code = authCode();
    if (!code) throw new Error("No Bungie login code captured. Click Login with Bungie first.");
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", code);
    if (CONFIG.clientId) body.set("client_id", CONFIG.clientId);
    const response = await fetch(CONFIG.tokenUrl || `${API_ROOT}/App/OAuth/Token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) {
      throw new Error(data.error_description || data.error || `Bungie token exchange failed (${response.status}).`);
    }
    const next = {
      bearer: data.access_token,
      expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 3600) - 60) * 1000,
      savedAt: new Date().toISOString()
    };
    writeJson(SESSION_KEY, next);
    return next;
  }

  async function getBearer() {
    return session().bearer || (await exchangeCodeForSession()).bearer;
  }

  async function bungieGet(path, bearer) {
    const key = apiKey();
    if (!key) throw new Error("No Bungie API key configured. Set window.D2_BUNGIE_CONFIG.apiKey or localStorage d2-collections-bungie-api-key.");
    const response = await fetch(`${API_ROOT}${path}`, {
      headers: {
        "X-API-Key": key,
        "Authorization": `Bearer ${bearer}`
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ErrorCode > 1) {
      throw new Error(data.Message || data.error || `Bungie request failed (${response.status}).`);
    }
    return data.Response || data;
  }

  async function buildCollectionDump() {
    const bearer = await getBearer();
    const memberships = await bungieGet("/User/GetMembershipsForCurrentUser/", bearer);
    const destinyMemberships = memberships.destinyMemberships || [];
    const profiles = [];
    for (const membership of destinyMemberships) {
      const membershipType = membership.membershipType;
      const membershipId = membership.membershipId;
      if (!membershipType || !membershipId) continue;
      const profile = await bungieGet(`/Destiny2/${membershipType}/Profile/${membershipId}/?components=100,200,800,900`, bearer);
      profiles.push({
        membershipType,
        membershipId,
        displayName: membership.displayName || memberships.bungieNetUser?.displayName || "",
        bungieGlobalDisplayName: memberships.bungieNetUser?.uniqueName || memberships.bungieNetUser?.displayName || "",
        profile
      });
    }
    return {
      d2CollectionsApiDump: true,
      generatedAt: new Date().toISOString(),
      note: "Logged-in Bungie account collection/profile dump. Tell ChatGPT whether this dump is for Corey/Ares or Matt/Icee.",
      source: "logged_in_bungie_account",
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
      button.addEventListener("click", async () => {
        button.disabled = true;
        status.textContent = "Pulling logged-in Bungie collection/profile data…";
        try {
          const dump = await buildCollectionDump();
          output.value = JSON.stringify(dump, null, 2);
          status.textContent = `Built logged-in collection dump for ${dump.membershipCount} Destiny membership(s). Send this here and tell me who it belongs to.`;
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
