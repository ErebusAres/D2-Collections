(() => {
  const CATALOG = window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: {} };
  const CHECKLIST = window.D2_COLLECTIONS_CHECKLIST || { users: {}, weapons: {}, armor: {} };

  const css = `
    .api-handoff-grid{display:grid;grid-template-columns:1fr;gap:14px}.api-handoff-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.api-handoff-note{font-size:.86rem}.api-handoff-box{min-height:220px}.api-handoff-status{font-size:.82rem;color:var(--muted);margin-top:8px}.api-warning{border:1px solid rgba(70,217,141,.25);background:rgba(70,217,141,.07);border-radius:14px;padding:10px 12px;margin:10px 0;color:#cef8df}.manual-import{margin-top:12px;border-top:1px solid rgba(255,255,255,.08);padding-top:12px}.manual-import summary{cursor:pointer;color:var(--muted);font-weight:800}@media(max-width:900px){.api-handoff-grid{grid-template-columns:1fr}}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  function armorClasses() { return Object.keys(CATALOG.armor || {}); }

  function catalogSnapshot() {
    return {
      weapons: (CATALOG.weapons || []).map(item => ({ id: item.id, name: item.name, type: item.type, slot: item.slot, element: item.element, source: item.source })),
      armor: Object.fromEntries(armorClasses().map(className => [className, (CATALOG.armor[className] || []).map(item => ({ id: item.id, name: item.name, slot: item.slot, source: item.source }))]))
    };
  }

  function buildManualPayload(extra = {}) {
    const hasImported = Boolean(extra.importedCollectionData);
    return {
      d2CollectionsHandoff: true,
      generatedAt: new Date().toISOString(),
      note: "Manual fallback payload. Prefer the Dump logged-in collection button for accurate Bungie data.",
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
      <div class="panel-head"><div><p class="eyebrow">API handoff</p><h2>Logged-in Bungie collection dump</h2></div><span class="count-pill">Send dump to ChatGPT</span></div>
      <div class="api-warning"><strong>Use this flow:</strong> Login with Bungie, click <strong>Dump logged-in collection</strong>, copy the JSON from the box, then tell ChatGPT whether it belongs to Corey/Ares or Matt/Icee.</div>
      <p class="muted api-handoff-note">The dump button pulls the currently logged-in Bungie account only. It does not decide Corey vs Matt; you tell ChatGPT who the dump belongs to after copying it.</p>
      <div class="api-handoff-grid">
        <div><label class="field-label"><span>Collection dump output</span><textarea id="apiOutputBox" class="api-handoff-box" spellcheck="false" placeholder="Click Dump logged-in collection…"></textarea></label></div>
      </div>
      <div class="api-handoff-actions">
        <button id="copyHandoffBtn" class="button ghost" type="button">Copy payload</button>
        <button id="clearHandoffBtn" class="button danger" type="button">Clear output</button>
      </div>
      <details class="manual-import"><summary>Manual fallback: paste raw Bungie JSON / export repo snapshot</summary>
        <div class="api-handoff-grid" style="margin-top:10px">
          <div><label class="field-label"><span>Optional manual JSON input</span><textarea id="apiInputBox" class="api-handoff-box" spellcheck="false" placeholder="Manual fallback only. Paste JSON here or leave blank for repo snapshot."></textarea></label></div>
        </div>
        <div class="api-handoff-actions"><button id="buildHandoffBtn" class="button ghost" type="button">Build manual fallback payload</button></div>
      </details>
      <div id="apiHandoffStatus" class="api-handoff-status">Ready. Click Dump logged-in collection.</div>
    `;
    dataPanel.insertAdjacentElement("afterend", panel);

    const input = panel.querySelector("#apiInputBox");
    const output = panel.querySelector("#apiOutputBox");
    const status = panel.querySelector("#apiHandoffStatus");
    panel.querySelector("#buildHandoffBtn").addEventListener("click", () => {
      const parsed = input.value.trim() ? tryParseJson(input.value.trim()) : null;
      if (input.value.trim() && !parsed) {
        status.textContent = "Manual input is not valid JSON yet.";
        return;
      }
      const payload = buildManualPayload({ importedCollectionData: parsed });
      output.value = JSON.stringify(payload, null, 2);
      status.textContent = parsed ? "Built manual payload with pasted JSON." : "Built repo snapshot fallback. This is not Bungie API collection data.";
    });
    panel.querySelector("#copyHandoffBtn").addEventListener("click", () => {
      if (!output.value.trim()) output.value = JSON.stringify(buildManualPayload(), null, 2);
      navigator.clipboard?.writeText(output.value).then(() => { status.textContent = "Copied payload."; }).catch(() => { status.textContent = "Copy failed; select the box and copy manually."; });
    });
    panel.querySelector("#clearHandoffBtn").addEventListener("click", () => { if (input) input.value = ""; output.value = ""; status.textContent = "Cleared."; });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
