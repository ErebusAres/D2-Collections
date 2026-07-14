(() => {
  const SESSION_KEY = "d2-collections-bungie-session-v2";
  const AUTH_KEY = "d2-collections-auth-v1";
  const ACTIVE_PLAYER_KEY = "d2-collections-active-player-v1";
  const CLOUD_META_KEY = "d2-collections-cloud-meta-v1";
  const LAST_SYNC_KEY = "d2-collections-last-background-sync-v1";
  const SYNC_LOCK = "d2-collections-bungie-data-sync";
  const STALE_MS = 30 * 60 * 1000;
  const CHECK_MS = 5 * 60 * 1000;
  const RETRY_MS = 60 * 1000;
  const IDLE_MS = 8 * 1000;
  const EVENT_TIMEOUT_MS = 3 * 60 * 1000;

  let lastInteractionAt = Date.now();
  let timer = 0;
  let running = false;
  let forceNextSync = false;

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
  }

  function sessionUsable() {
    if (window.D2_COLLECTIONS_AUTH?.sessionIsUsable?.()) return true;
    const saved = readJson(SESSION_KEY);
    const now = Math.floor(Date.now() / 1000) + 60;
    return Boolean(
      (saved.access_token && saved.expires_at > now) ||
      (saved.server_session_token && (!saved.refresh_expires_at || saved.refresh_expires_at > now)) ||
      (!saved.auth_error && saved.refresh_token && (!saved.refresh_expires_at || saved.refresh_expires_at > now))
    );
  }

  function latestSyncTime() {
    const local = Date.parse(readJson(LAST_SYNC_KEY).finishedAt || "") || 0;
    const meta = readJson(CLOUD_META_KEY);
    const active = String(localStorage.getItem(ACTIVE_PLAYER_KEY) || "");
    const activeCloud = Date.parse(meta?.players?.[active]?.syncedAt || "") || 0;
    const newestCloud = Math.max(0, ...Object.values(meta?.players || {}).map(row => Date.parse(row?.syncedAt || "") || 0));
    return Math.max(local, activeCloud, active ? 0 : newestCloud);
  }

  function stale() {
    const syncedAt = latestSyncTime();
    return !syncedAt || Date.now() - syncedAt >= STALE_MS;
  }

  function userIsBusy() {
    const active = document.activeElement;
    const editing = active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName);
    return editing || Date.now() - lastInteractionAt < IDLE_MS;
  }

  function waitForSyncResult() {
    return new Promise(resolve => {
      let timeout = 0;
      const finish = event => {
        document.removeEventListener("d2collections:sync-finished", finish);
        clearTimeout(timeout);
        resolve(Boolean(event?.detail?.ok));
      };
      document.addEventListener("d2collections:sync-finished", finish, { once: true });
      timeout = setTimeout(() => finish(null), EVENT_TIMEOUT_MS);
    });
  }

  async function performSync() {
    const button = document.querySelector("#dumpLoggedInCollectionBtn");
    if (!button || button.disabled) return false;
    const result = waitForSyncResult();
    button.click();
    return result;
  }

  async function withSyncLock(callback) {
    if (!navigator.locks?.request) return callback();
    return navigator.locks.request(SYNC_LOCK, { ifAvailable: true }, lock => lock ? callback() : false);
  }

  async function check({ initial = false, force = false } = {}) {
    clearTimeout(timer);
    timer = 0;
    force = force || forceNextSync;
    forceNextSync = false;
    if (running || document.hidden || !navigator.onLine || !sessionUsable() || (!force && (!stale() || userIsBusy()))) {
      schedule(initial ? 15 * 1000 : CHECK_MS);
      return;
    }
    running = true;
    try {
      const ok = await withSyncLock(performSync);
      if (ok) localStorage.setItem(LAST_SYNC_KEY, JSON.stringify({ finishedAt: new Date().toISOString() }));
      if (!ok) {
        schedule(RETRY_MS);
        return;
      }
    } finally {
      running = false;
      if (!timer) schedule(CHECK_MS);
    }
  }

  function schedule(delay = CHECK_MS, { force = false } = {}) {
    clearTimeout(timer);
    if (force) forceNextSync = true;
    timer = setTimeout(() => check(), delay);
  }

  function noteInteraction() {
    lastInteractionAt = Date.now();
  }

  ["pointerdown", "keydown", "touchstart", "wheel"].forEach(type => {
    document.addEventListener(type, noteInteraction, { passive: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearTimeout(timer);
    else schedule(3 * 1000);
  });
  window.addEventListener("online", () => schedule(3 * 1000));
  window.addEventListener("storage", event => {
    if (event.key === SESSION_KEY || event.key === AUTH_KEY || event.key === CLOUD_META_KEY) schedule(3 * 1000);
  });
  document.addEventListener("d2collections:auth-changed", event => {
    schedule(event.detail?.signedIn ? 500 : 3 * 1000, { force: Boolean(event.detail?.signedIn) });
  });
  document.addEventListener("d2collections:sync-finished", event => {
    if (event.detail?.ok) localStorage.setItem(LAST_SYNC_KEY, JSON.stringify({ finishedAt: event.detail.finishedAt || new Date().toISOString() }));
  });

  schedule(8 * 1000);
})();
