import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("assets/bungie-collection-dump.js", "utf8");
const AUTH_KEY = "d2-collections-auth-v1";
const SESSION_KEY = "d2-collections-bungie-session-v2";

function authHarness({ authCode = "", session = {}, response }) {
  const values = new Map([
    [AUTH_KEY, JSON.stringify({ oauthCode: authCode })],
    [SESSION_KEY, JSON.stringify(session)]
  ]);
  const requests = [];
  const localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
  const window = {
    D2_BUNGIE_CONFIG: { cloudSyncApi: "https://worker.example", clientId: "53180" },
    D2_COLLECTIONS_CATALOG: { weapons: [], armor: {} },
    D2_COLLECTIONS_BUNGIE_COLLECTIBLES: { items: {} },
    D2_COLLECTIONS_ITEM_UNLOCKS: { items: {} },
    location: { origin: "https://erebusares.github.io" },
    addEventListener() {},
    removeEventListener() {}
  };
  const context = {
    window,
    localStorage,
    navigator: { locks: { request: async (_key, _options, callback) => callback() } },
    document: { readyState: "loading", addEventListener() {} },
    fetch: async (url, options = {}) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => response(url),
        text: async () => JSON.stringify(response(url))
      };
    },
    URLSearchParams,
    Date,
    Math,
    JSON,
    Boolean,
    Number,
    String,
    Promise,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    CustomEvent: class {}
  };
  vm.runInNewContext(source, context, { filename: "bungie-collection-dump.js" });
  return { window, localStorage, requests };
}

const now = Math.floor(Date.now() / 1000);
const freshLogin = authHarness({
  authCode: "fresh-code",
  session: {
    access_token: "expired-access",
    expires_at: now - 1,
    server_session_token: "old-session",
    refresh_expires_at: now + 3600,
    auth_error: "old transient failure"
  },
  response: () => ({
    ok: true,
    sessionToken: "new-session",
    accessToken: "new-access",
    accessExpiresAt: now + 3600,
    refreshExpiresAt: now + 86400
  })
});

assert.equal(await freshLogin.window.D2_COLLECTIONS_AUTH.ensureAccessToken(), "new-access");
assert.match(freshLogin.requests[0].url, /\/api\/auth\/exchange$/, "Fresh login must exchange its authorization code.");
const freshSession = JSON.parse(freshLogin.localStorage.getItem(SESSION_KEY));
assert.equal(freshSession.server_session_token, "new-session");
assert.equal(freshSession.auth_error, "");
assert.equal(JSON.parse(freshLogin.localStorage.getItem(AUTH_KEY)).oauthCode, "");

const persistentRefresh = authHarness({
  session: {
    access_token: "expired-access",
    expires_at: now - 1,
    server_session_token: "persistent-session",
    refresh_expires_at: now + 3600,
    auth_error: "old transient failure"
  },
  response: () => ({
    ok: true,
    sessionToken: "persistent-session",
    accessToken: "refreshed-access",
    accessExpiresAt: now + 3600,
    refreshExpiresAt: now + 86400
  })
});

assert.equal(await persistentRefresh.window.D2_COLLECTIONS_AUTH.ensureAccessToken(), "refreshed-access");
assert.match(persistentRefresh.requests[0].url, /\/api\/auth\/refresh$/, "Worker session must refresh despite an old local error.");

console.log("auth session behavior passed");
