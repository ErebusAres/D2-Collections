(() => {
  const CATALOG = window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: {} };
  const CHECKLIST = window.D2_COLLECTIONS_CHECKLIST || { users: {}, weapons: {}, armor: {} };

  const css = `
    .api-handoff-grid{display:grid;grid-template-columns:1fr;gap:10px}
    .api-handoff-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
    .api-handoff-box{min-height:180px}
    .api-handoff-status{font-size:.82rem;color:var(--soft);margin-top:8px;line-height:1.45}
    .sync-debug-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0}
    .sync-debug-card{display:grid;gap:2px;border:1px solid rgba(255,255,255,.075);border-radius:8px;background:rgba(0,0,0,.2);padding:8px;color:var(--muted);font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em}
    .sync-debug-card strong{color:var(--gold-bright);font-size:.92rem;letter-spacing:0;text-transform:none}
    .api-warning{border:1px solid rgba(111,168,220,.25);background:rgba(111,168,220,.08);border-radius:10px;padding:9px 10px;margin:10px 0;color:#dbeeff}
    .manual-import,.debug-details{margin-top:10px;border-top:1px solid rgba(255,255,255,.08);padding-top:10px}
    .manual-import summary,.debug-details summary{cursor:pointer;color:var(--muted);font-weight:800}
    .debug-log{display:grid;gap:6px;margin-top:8px}
    .debug-log code{display:block;white-space:normal;word-break:break-word;border:1px solid rgba(255,255,255,.075);border-radius:7px;background:rgba(0,0,0,.22);padding:7px;color:var(--soft);font-size:.72rem}
    @media(max-width:900px){.api-handoff-grid,.sync-debug-grid{grid-template-columns:1fr}}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  function armorClasses() {
    return Object.keys(CATALOG.armor || {});
  }

  function catalogSnapshot() {
    return {
      weapons: (CATALOG.weapons || []).map(item => ({ id: item.id, name: item.name, type: item.type, slot: item.slot, element: item.element, source: item.source })),
      armor: Object.fromEntries(armorClasses().map(className => [className, (CATALOG.armor[className] || []).map(item => ({ id: item.id, name: item.name, slot: item.slot, source: item.source }))]))
    };
  }

  function buildManualPayload(extra = {}) {
    const hasImported = Boolean(extra.importedCollectionData);
    return {
      d2CollectionsDebugPayload: true,
      generatedAt: new Date().toISOString(),
      note: "Manual fallback payload. Normal sync uses Bungie login plus cloud save; this is only for debugging.",
      apiImportStatus: {
        hasPastedCollectionData: hasImported,
        status: hasImported ? "manual_json_present" : "repo_snapshot_only"
      },
      users: CHECKLIST.users || {},
      currentChecklist: CHECKLIST,
      catalog: catalogSnapshot(),
      importedCollectionData: hasImported ? extra.importedCollectionData : null
    };
  }

  function tryParseJson(text) {
    try { return JSON.parse(text); } catch { return null; }
  }

  function init() {
    const dataPanel = document.querySelector(".data-panel");
    if (!dataPanel || document.querySelector("#apiHandoffPanel")) return;
    const panel = document.createElement("section");
    panel.id = "apiHandoffPanel";
    panel.className = "panel data-panel";
    panel.innerHTML = `
      <div class="panel-head"><div><p class="eyebrow">Live sync</p><h2>Sync logged-in Bungie account</h2></div><span class="count-pill">Cloud enabled</span></div>
      <div class="api-warning"><strong>Main flow:</strong> Login with Bungie, then sync. The site applies ownership locally, saves the cloud snapshot, refreshes Rahool material counts, and checks Xur stock when his weekend window is active.</div>
      <div class="sync-debug-grid" aria-label="Sync debug status">
        <div class="sync-debug-card"><strong id="debugBungieStatus">Waiting</strong><span>Bungie session</span></div>
        <div class="sync-debug-card"><strong id="debugCloudStatus">Waiting</strong><span>Cloud snapshot</span></div>
        <div class="sync-debug-card"><strong id="debugXurStatus">Waiting</strong><span>Xur check</span></div>
        <div class="sync-debug-card"><strong id="debugLastStatus">No sync yet</strong><span>Last result</span></div>
      </div>
      <div class="api-handoff-actions"></div>
      <div id="apiHandoffStatus" class="api-handoff-status">Ready. Sync after logging in with Bungie.</div>
      <details class="debug-details"><summary>Show raw sync debug JSON</summary>
        <div class="api-handoff-grid" style="margin-top:10px">
          <div><label class="field-label"><span>Latest sync payload</span><textarea id="apiOutputBox" class="api-handoff-box" spellcheck="false" placeholder="Sync debug JSON appears here after a sync..."></textarea></label></div>
        </div>
        <div class="api-handoff-actions">
          <button id="copyHandoffBtn" class="button ghost" type="button">Copy debug JSON</button>
          <button id="clearHandoffBtn" class="button danger" type="button">Clear debug</button>
        </div>
      </details>
      <details class="manual-import"><summary>Manual fallback tools</summary>
        <div class="api-handoff-grid" style="margin-top:10px">
          <div><label class="field-label"><span>Optional manual JSON input</span><textarea id="apiInputBox" class="api-handoff-box" spellcheck="false" placeholder="Manual fallback only. Paste JSON here or leave blank for repo snapshot."></textarea></label></div>
        </div>
        <div class="api-handoff-actions"><button id="buildHandoffBtn" class="button ghost" type="button">Build fallback debug payload</button></div>
      </details>
      <div class="debug-log" id="syncDebugLog" aria-label="Sync event log"></div>
    `;
    dataPanel.insertAdjacentElement("afterend", panel);

    const input = panel.querySelector("#apiInputBox");
    const output = panel.querySelector("#apiOutputBox");
    const status = panel.querySelector("#apiHandoffStatus");
    const debugBungie = panel.querySelector("#debugBungieStatus");
    const debugCloud = panel.querySelector("#debugCloudStatus");
    const debugXur = panel.querySelector("#debugXurStatus");
    const debugLast = panel.querySelector("#debugLastStatus");
    const debugLog = panel.querySelector("#syncDebugLog");
    const setDebug = (target, text) => { if (target) target.textContent = text; };
    const authSummary = () => {
      try {
        const auth = JSON.parse(localStorage.getItem("d2-collections-auth-v1") || "{}");
        const saved = JSON.parse(localStorage.getItem("d2-collections-bungie-session-v2") || "{}");
        const now = Math.floor(Date.now() / 1000) + 60;
        if (saved.refresh_token && (!saved.refresh_expires_at || saved.refresh_expires_at > now)) return "Refresh OK";
        if (saved.access_token && saved.expires_at > now) return "Access OK";
        if (auth.oauthCode) return "Login code";
      } catch {}
      return "Offline";
    };
    const renderAuthSummary = () => setDebug(debugBungie, authSummary());
    const pushLog = text => {
      if (!debugLog || !text) return;
      const entry = document.createElement("code");
      entry.textContent = `${new Date().toLocaleTimeString()} - ${text}`;
      debugLog.prepend(entry);
      [...debugLog.children].slice(6).forEach(node => node.remove());
    };

    window.D2_COLLECTIONS_SYNC_DEBUG = {
      setStatus(text = "") {
        if (status) status.textContent = text || "Ready.";
        setDebug(debugLast, text ? text.split(".")[0].slice(0, 48) : "Ready");
        if (/bungie linked|profile pulled|synced|pulling logged-in/i.test(text)) renderAuthSummary();
        if (/cloud snapshot saved|cloud sync saved/i.test(text)) setDebug(debugCloud, "Saved");
        if (/cloud snapshot failed|cloud sync read failed/i.test(text)) setDebug(debugCloud, "Error");
        if (/xur tower stock matched/i.test(text)) setDebug(debugXur, "Matched");
        if (/xur check skipped/i.test(text)) setDebug(debugXur, "Inactive");
        if (/xur check failed|xur check unavailable/i.test(text)) setDebug(debugXur, "Error");
        pushLog(text);
      },
      setPayload(value) {
        if (output) output.value = typeof value === "string" ? value : JSON.stringify(value, null, 2);
      }
    };
    renderAuthSummary();
    setInterval(renderAuthSummary, 30000);

    panel.querySelector("#buildHandoffBtn").addEventListener("click", () => {
      const parsed = input.value.trim() ? tryParseJson(input.value.trim()) : null;
      if (input.value.trim() && !parsed) {
        window.D2_COLLECTIONS_SYNC_DEBUG.setStatus("Manual input is not valid JSON yet.");
        return;
      }
      const payload = buildManualPayload({ importedCollectionData: parsed });
      output.value = JSON.stringify(payload, null, 2);
      window.D2_COLLECTIONS_SYNC_DEBUG.setStatus(parsed ? "Built manual debug payload with pasted JSON." : "Built repo snapshot fallback debug payload.");
    });
    panel.querySelector("#copyHandoffBtn").addEventListener("click", () => {
      if (!output.value.trim()) output.value = JSON.stringify(buildManualPayload(), null, 2);
      navigator.clipboard?.writeText(output.value)
        .then(() => { window.D2_COLLECTIONS_SYNC_DEBUG.setStatus("Copied debug JSON."); })
        .catch(() => { window.D2_COLLECTIONS_SYNC_DEBUG.setStatus("Copy failed; open raw sync debug JSON and copy manually."); });
    });
    panel.querySelector("#clearHandoffBtn").addEventListener("click", () => {
      if (input) input.value = "";
      output.value = "";
      if (debugLog) debugLog.innerHTML = "";
      window.D2_COLLECTIONS_SYNC_DEBUG.setStatus("Cleared debug output.");
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
