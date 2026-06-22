(() => {
  const CATALOG = window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: {} };
  const CHECKLIST = window.D2_COLLECTIONS_CHECKLIST || { users: {}, weapons: {}, armor: {} };
  const AUTH_KEY = "d2-collections-auth-v1";

  const css = `
    .api-handoff-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.api-handoff-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.api-handoff-note{font-size:.86rem}.api-handoff-box{min-height:180px}.api-handoff-status{font-size:.82rem;color:var(--muted);margin-top:8px}.api-warning{border:1px solid rgba(255,190,90,.28);background:rgba(255,190,90,.08);border-radius:14px;padding:10px 12px;margin:10px 0;color:#ffe2aa}@media(max-width:900px){.api-handoff-grid{grid-template-columns:1fr}}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  function armorClasses() { return Object.keys(CATALOG.armor || {}); }
  function authSummary() {
    try {
      const auth = JSON.parse(localStorage.getItem(AUTH_KEY) || "{}");
      return { signedInCodeCaptured: Boolean(auth.oauthCode), lastSaved: auth.lastSaved || "" };
    } catch {
      return { signedInCodeCaptured: false, lastSaved: "" };
    }
  }

  function catalogSnapshot() {
    return {
      weapons: (CATALOG.weapons || []).map(item => ({ id: item.id, name: item.name, type: item.type, slot: item.slot, element: item.element, source: item.source })),
      armor: Object.fromEntries(armorClasses().map(className => [className, (CATALOG.armor[className] || []).map(item => ({ id: item.id, name: item.name, slot: item.slot, source: item.source }))]))
    };
  }

  function buildHandoffPayload(extra = {}) {
    const hasImported = Boolean(extra.importedCollectionData);
    return {
      d2CollectionsHandoff: true,
      generatedAt: new Date().toISOString(),
      note: "Paste this into ChatGPT so it can update data/checklist.js. Do not include private sign-in credentials.",
      apiImportStatus: {
        hasPastedCollectionData: hasImported,
        status: hasImported ? "pasted_collection_json_present" : "no_collection_api_data_present",
        explanation: hasImported
          ? "This payload includes user-pasted collection/profile JSON in importedCollectionData."
          : "This payload only includes the current repo checklist/catalog snapshot. Bungie sign-in captured a login code only; no profile or collection API response was imported."
      },
      auth: authSummary(),
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
      <div class="panel-head"><div><p class="eyebrow">API handoff</p><h2>Manual Bungie data bridge</h2></div><span class="count-pill">Manual import only</span></div>
      <div class="api-warning"><strong>Important:</strong> Bungie sign-in currently only captures a login code. It does not pull your collection yet. To update from Bungie data, paste an actual Bungie collection/profile API JSON response into the left box first.</div>
      <p class="muted api-handoff-note">Blank input exports only the current repo checklist/catalog. Pasted JSON is copied into the safe handoff payload. Do not paste private sign-in credentials.</p>
      <div class="api-handoff-grid">
        <div><label class="field-label"><span>Paste actual Bungie collection / profile API JSON here</span><textarea id="apiInputBox" class="api-handoff-box" spellcheck="false" placeholder="Paste Bungie API response JSON here. Leave blank to export repo state only."></textarea></label></div>
        <div><label class="field-label"><span>Safe payload to send to ChatGPT</span><textarea id="apiOutputBox" class="api-handoff-box" spellcheck="false" placeholder="Click Build handoff payload…"></textarea></label></div>
      </div>
      <div class="api-handoff-actions">
        <button id="buildHandoffBtn" class="button primary" type="button">Build handoff payload</button>
        <button id="copyHandoffBtn" class="button ghost" type="button">Copy payload</button>
        <button id="clearHandoffBtn" class="button danger" type="button">Clear boxes</button>
      </div>
      <div id="apiHandoffStatus" class="api-handoff-status">No collection API data imported yet.</div>
    `;
    dataPanel.insertAdjacentElement("afterend", panel);

    const input = panel.querySelector("#apiInputBox");
    const output = panel.querySelector("#apiOutputBox");
    const status = panel.querySelector("#apiHandoffStatus");
    panel.querySelector("#buildHandoffBtn").addEventListener("click", () => {
      const parsed = input.value.trim() ? tryParseJson(input.value.trim()) : null;
      if (input.value.trim() && !parsed) {
        status.textContent = "Input is not valid JSON yet. Fix the paste or leave it blank to export the current repo checklist/catalog only.";
        return;
      }
      const payload = buildHandoffPayload({ importedCollectionData: parsed });
      output.value = JSON.stringify(payload, null, 2);
      status.textContent = parsed
        ? "Built payload with pasted collection/profile JSON."
        : "Built repo-only payload. No Bungie collection API data was included.";
    });
    panel.querySelector("#copyHandoffBtn").addEventListener("click", () => {
      if (!output.value.trim()) output.value = JSON.stringify(buildHandoffPayload(), null, 2);
      navigator.clipboard?.writeText(output.value).then(() => { status.textContent = "Copied handoff payload."; }).catch(() => { status.textContent = "Copy failed; select the box and copy manually."; });
    });
    panel.querySelector("#clearHandoffBtn").addEventListener("click", () => { input.value = ""; output.value = ""; status.textContent = "Cleared."; });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
