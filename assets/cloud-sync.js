(() => {
  const CONFIG = window.D2_BUNGIE_CONFIG || {};
  const API = String(CONFIG.cloudSyncApi || "").replace(/\/+$/, "");
  const SESSION_KEY = "d2-collections-bungie-session-v2";
  const STATUS_ID = "cloudSyncStatus";

  if (!API) return;

  function statusEl() {
    let el = document.getElementById(STATUS_ID);
    if (el) return el;
    const target = document.querySelector("#apiHandoffStatus") || document.querySelector("#dataHealth");
    if (!target) return null;
    el = document.createElement("div");
    el.id = STATUS_ID;
    el.className = "api-handoff-status cloud-sync-status";
    el.textContent = "Cloud sync ready.";
    target.insertAdjacentElement("afterend", el);
    return el;
  }

  function setStatus(text) {
    const el = statusEl();
    if (el) el.textContent = text;
    window.D2_COLLECTIONS_SYNC_DEBUG?.setStatus?.(text);
  }

  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "{}"); } catch { return {}; }
  }

  function usableAccessToken() {
    const saved = readSession();
    const now = Math.floor(Date.now() / 1000) + 60;
    return saved.access_token && saved.expires_at > now ? saved.access_token : "";
  }

  async function accessTokenForWrite() {
    const existing = usableAccessToken();
    if (existing) return existing;
    if (window.D2_COLLECTIONS_AUTH?.ensureAccessToken) {
      return window.D2_COLLECTIONS_AUTH.ensureAccessToken(statusEl());
    }
    return "";
  }

  async function fetchSnapshots() {
    const response = await fetch(`${API}/api/snapshots`, { headers: { "Accept": "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.message || "Cloud snapshot read failed.");
    return data.snapshots || [];
  }

  async function pullSnapshots() {
    try {
      const snapshots = await fetchSnapshots();
      window.D2_COLLECTIONS_APP?.recordCloudSnapshots?.(snapshots, { suppressRender: true });
      let applied = 0;
      snapshots.forEach(snapshot => {
        if (!snapshot.liveSync?.ok || !window.D2_COLLECTIONS_APP?.applyCollectionOwnership) return;
        const result = window.D2_COLLECTIONS_APP.applyCollectionOwnership({
          ...snapshot.liveSync,
          syncedAt: snapshot.syncedAt,
          cloudSyncedAt: snapshot.syncedAt,
          preserveActivePlayer: true,
          suppressRender: true,
          suppressEvent: true
        });
        if (result?.ok) applied += 1;
      });
      window.D2_COLLECTIONS_APP?.render?.();
      document.dispatchEvent(new CustomEvent("d2collections:ownership-applied", { detail: { ok: true, source: "cloud", applied } }));
      setStatus(applied ? `Cloud sync loaded ${applied} saved player snapshot(s).` : "Cloud sync has no saved snapshots yet.");
      return snapshots;
    } catch (error) {
      setStatus(`Cloud sync read failed: ${error.message || error}`);
      return [];
    }
  }

  async function pushSnapshot(liveSync, applyResult, compactDump) {
    if (!liveSync?.ok) return { ok: false, reason: "missing_live_sync" };
    const token = await accessTokenForWrite();
    if (!token) return { ok: false, reason: "missing_access_token" };
    const response = await fetch(`${API}/api/snapshots`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ liveSync, applyResult, compactDump })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.message || data.reason || "Cloud snapshot write failed.");
    window.D2_COLLECTIONS_APP?.recordCloudSnapshots?.([{
      player: data.player,
      syncedAt: data.syncedAt,
      itemCount: data.itemCount,
      liveSync,
      resourceCounts: liveSync.resourceCounts
    }]);
    setStatus(`Cloud sync saved ${data.player} snapshot at ${new Date(data.syncedAt).toLocaleString()}.`);
    return data;
  }

  window.D2_COLLECTIONS_CLOUD_SYNC = { pullSnapshots, pushSnapshot };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", pullSnapshots);
  } else {
    pullSnapshots();
  }
})();
