(() => {
  const CATALOG = window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: { warlock: [], titan: [] } };
  const BASE = window.D2_COLLECTIONS_CHECKLIST || { users: {}, weapons: {}, armor: { warlock: {}, titan: {} } };
  const BUNGIE = window.D2_BUNGIE_CONFIG || {};
  const STORAGE_KEY = "d2-collections-checklist-v1";
  const API_STORAGE_KEY = "d2-collections-api-settings-v1";
  const CLASS_FOCUS = { warlock: "corey", titan: "matt" };
  const players = Object.keys(BASE.users || { corey: {}, matt: {} });

  const blankWeapon = () => ({ owned: false, catalyst: false, complete: false, equipped: false });
  const blankArmor = () => ({ owned: false, equipped: false });
  const clone = value => JSON.parse(JSON.stringify(value));

  let filters = { search: "", view: "all", player: "all" };
  let state = mergeState(clone(BASE), readLocal());
  let apiSettings = readApiSettings();

  const els = {
    summary: document.querySelector("#summary"),
    search: document.querySelector("#searchInput"),
    weapons: document.querySelector("#weaponsList"),
    warlock: document.querySelector("#warlockList"),
    titan: document.querySelector("#titanList"),
    weaponCount: document.querySelector("#weaponCount"),
    armorCount: document.querySelector("#armorCount"),
    exportBtn: document.querySelector("#exportBtn"),
    exportBox: document.querySelector("#exportBox"),
    importFile: document.querySelector("#importFile"),
    resetLocalBtn: document.querySelector("#resetLocalBtn"),
    apiStatus: document.querySelector("#apiStatus"),
    apiKeyInput: document.querySelector("#apiKeyInput"),
    clientIdInput: document.querySelector("#clientIdInput"),
    saveApiBtn: document.querySelector("#saveApiBtn"),
    loginBtn: document.querySelector("#loginBtn"),
    clearApiBtn: document.querySelector("#clearApiBtn"),
    oauthNote: document.querySelector("#oauthNote")
  };

  function readLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function readApiSettings() {
    try {
      const raw = localStorage.getItem(API_STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      return {
        apiKey: saved.apiKey || BUNGIE.apiKey || "",
        clientId: saved.clientId || BUNGIE.clientId || "53180",
        oauthCode: saved.oauthCode || "",
        lastSaved: saved.lastSaved || ""
      };
    } catch {
      return { apiKey: BUNGIE.apiKey || "", clientId: BUNGIE.clientId || "53180", oauthCode: "", lastSaved: "" };
    }
  }

  function saveApiSettings(next = apiSettings) {
    apiSettings = next;
    localStorage.setItem(API_STORAGE_KEY, JSON.stringify(apiSettings));
    renderApiPanel();
  }

  function mergeState(base, overlay) {
    const merged = base || {};
    merged.users = merged.users || { corey: { label: "Corey", short: "C" }, matt: { label: "Matt", short: "M" } };
    merged.weapons = merged.weapons || {};
    merged.armor = merged.armor || { warlock: {}, titan: {} };
    merged.armor.warlock = merged.armor.warlock || {};
    merged.armor.titan = merged.armor.titan || {};

    if (overlay) {
      deepMerge(merged, overlay);
    }
    hydrateDefaults(merged);
    return merged;
  }

  function deepMerge(target, source) {
    for (const [key, value] of Object.entries(source || {})) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        target[key] = target[key] && typeof target[key] === "object" ? target[key] : {};
        deepMerge(target[key], value);
      } else {
        target[key] = value;
      }
    }
  }

  function hydrateDefaults(next) {
    CATALOG.weapons.forEach(item => {
      next.weapons[item.id] = next.weapons[item.id] || {};
      players.forEach(player => {
        next.weapons[item.id][player] = { ...blankWeapon(), ...(next.weapons[item.id][player] || {}) };
      });
    });
    ["warlock", "titan"].forEach(className => {
      next.armor[className] = next.armor[className] || {};
      CATALOG.armor[className].forEach(item => {
        next.armor[className][item.id] = next.armor[className][item.id] || {};
        players.forEach(player => {
          next.armor[className][item.id][player] = { ...blankArmor(), ...(next.armor[className][item.id][player] || {}) };
        });
      });
    });
  }

  function playerList() {
    return filters.player === "all" ? players : [filters.player];
  }

  function armorPlayersForClass(className) {
    if (filters.player !== "all") return [filters.player];
    return [CLASS_FOCUS[className] || players[0]];
  }

  function focusLabel(className) {
    const player = CLASS_FOCUS[className];
    return `${BASE.users[player]?.label || player} ${className === "warlock" ? "Warlock" : "Titan"}`;
  }

  function matchesText(item) {
    const q = filters.search.trim().toLowerCase();
    if (!q) return true;
    return [item.name, item.slot, item.type, item.element, item.source].filter(Boolean).join(" ").toLowerCase().includes(q);
  }

  function matchesWeaponView(item) {
    const rows = playerList().map(player => state.weapons[item.id]?.[player] || blankWeapon());
    if (filters.view === "missing") return rows.some(row => !row.owned);
    if (filters.view === "catalysts") return rows.some(row => row.owned && (!row.catalyst || !row.complete));
    if (filters.view === "equipped") return rows.some(row => row.equipped);
    return true;
  }

  function matchesArmorView(className, item) {
    const rows = armorPlayersForClass(className).map(player => state.armor[className]?.[item.id]?.[player] || blankArmor());
    if (filters.view === "missing") return rows.some(row => !row.owned);
    if (filters.view === "catalysts") return false;
    if (filters.view === "equipped") return rows.some(row => row.equipped);
    return true;
  }

  function render() {
    renderSummary();
    renderWeapons();
    renderArmor("warlock", els.warlock);
    renderArmor("titan", els.titan);
    renderApiPanel();
  }

  function renderSummary() {
    const weaponRows = flattenWeaponRows();
    const armorRows = flattenArmorRows();
    const ownedWeapons = weaponRows.filter(row => row.owned).length;
    const catalystDone = weaponRows.filter(row => row.complete).length;
    const ownedArmor = armorRows.filter(row => row.owned).length;
    const equippedTotal = [...weaponRows, ...armorRows].filter(row => row.equipped).length;

    const cards = [
      metric("Weapons owned", ownedWeapons, weaponRows.length, "Corey + Matt weapon ownership"),
      metric("Catalysts complete", catalystDone, weaponRows.length, "Finished weapon catalysts"),
      metric("Armor owned", ownedArmor, armorRows.length, "Corey WL + Matt Titan"),
      metric("Equipped flags", equippedTotal, [...weaponRows, ...armorRows].length, "Marked in-use")
    ];
    els.summary.innerHTML = cards.join("");
  }

  function metric(label, value, total, caption) {
    const pct = total ? Math.round((value / total) * 100) : 0;
    return `<article class="summary-card"><strong>${value}<small>/${total}</small></strong><span>${label} · ${caption}</span><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></article>`;
  }

  function flattenWeaponRows() {
    return CATALOG.weapons.flatMap(item => playerList().map(player => ({ item, player, ...(state.weapons[item.id]?.[player] || blankWeapon()) })));
  }

  function flattenArmorRows() {
    return ["warlock", "titan"].flatMap(className =>
      CATALOG.armor[className].flatMap(item => armorPlayersForClass(className).map(player => ({ className, item, player, ...(state.armor[className]?.[item.id]?.[player] || blankArmor()) })))
    );
  }

  function renderWeapons() {
    const visible = CATALOG.weapons.filter(item => matchesText(item) && matchesWeaponView(item));
    els.weaponCount.textContent = `${visible.length} / ${CATALOG.weapons.length}`;
    els.weapons.innerHTML = visible.length ? visible.map(renderWeaponCard).join("") : emptyState("No weapons match this filter.");
  }

  function renderWeaponCard(item) {
    const playerRows = playerList().map(player => {
      const s = state.weapons[item.id]?.[player] || blankWeapon();
      return `<div class="status-grid">
        <div class="player-label">${BASE.users[player]?.short || player}</div>
        ${checkboxCell("weapon", item.id, player, "owned", s.owned, "Own")}
        ${checkboxCell("weapon", item.id, player, "catalyst", s.catalyst, "Cat")}
        ${checkboxCell("weapon", item.id, player, "complete", s.complete, "Done")}
        ${checkboxCell("weapon", item.id, player, "equipped", s.equipped, "Use", s.equipped ? "is-equipped" : "")}
      </div>`;
    }).join("");

    return `<article class="weapon-card" data-id="${item.id}">
      <div class="item-meta">
        <div class="item-name"><h3>${item.name}</h3></div>
        <div class="badge-row">
          <span class="badge ${item.slot.toLowerCase()}">${item.slot}</span>
          <span class="badge slot">${item.type}</span>
          <span class="badge">${item.element}</span>
          <span class="badge source">${item.source}</span>
        </div>
      </div>
      <div>
        <div class="status-grid header"><span></span><span>Own</span><span>Cat</span><span>Done</span><span>Use</span></div>
        ${playerRows}
      </div>
    </article>`;
  }

  function renderArmor(className, root) {
    const visible = CATALOG.armor[className].filter(item => matchesText(item) && matchesArmorView(className, item));
    const totalVisible = ["warlock", "titan"].reduce((sum, klass) => sum + CATALOG.armor[klass].filter(item => matchesText(item) && matchesArmorView(klass, item)).length, 0);
    const total = CATALOG.armor.warlock.length + CATALOG.armor.titan.length;
    els.armorCount.textContent = `${totalVisible} / ${total}`;
    root.innerHTML = visible.length
      ? visible.map(item => renderArmorCard(className, item)).join("")
      : emptyState(`No ${className} armor matches this filter.`);
  }

  function renderArmorCard(className, item) {
    const focusPlayer = CLASS_FOCUS[className];
    const playerRows = armorPlayersForClass(className).map(player => {
      const s = state.armor[className]?.[item.id]?.[player] || blankArmor();
      const isFocus = player === focusPlayer;
      return `<div class="armor-status">
        <div class="player-label ${isFocus ? "is-focus" : ""}">${BASE.users[player]?.short || player}</div>
        ${checkboxCell("armor", item.id, player, "owned", s.owned, "Own", "", className)}
        ${checkboxCell("armor", item.id, player, "equipped", s.equipped, "Eq", s.equipped ? "is-equipped" : "", className)}
      </div>`;
    }).join("");

    return `<article class="armor-card is-focus-card" data-id="${item.id}">
      <div class="item-meta">
        <div class="item-name"><h3>${item.name}</h3></div>
        <div class="badge-row">
          <span class="badge focus">${focusLabel(className)}</span>
          <span class="badge slot">${item.slot}</span>
          <span class="badge source">${item.source}</span>
        </div>
      </div>
      <div class="armor-status header"><span></span><span>Own</span><span>Equipped</span></div>
      ${playerRows}
    </article>`;
  }

  function checkboxCell(kind, id, player, field, checked, label, extraClass = "", className = "") {
    const onClass = checked ? "is-on" : "";
    return `<div class="check-cell ${onClass} ${extraClass}"><label title="${label}"><input type="checkbox" data-kind="${kind}" data-id="${id}" data-player="${player}" data-field="${field}" data-class="${className}" ${checked ? "checked" : ""} /></label></div>`;
  }

  function emptyState(text) {
    return `<div class="empty-state">${text}</div>`;
  }

  function handleCheck(event) {
    const input = event.target.closest("input[type='checkbox'][data-kind]");
    if (!input) return;
    const { kind, id, player, field } = input.dataset;
    if (kind === "weapon") {
      state.weapons[id] = state.weapons[id] || {};
      state.weapons[id][player] = { ...blankWeapon(), ...(state.weapons[id][player] || {}) };
      state.weapons[id][player][field] = input.checked;
      if (field === "complete" && input.checked) {
        state.weapons[id][player].owned = true;
        state.weapons[id][player].catalyst = true;
      }
      if (field === "catalyst" && input.checked) state.weapons[id][player].owned = true;
      if (field === "equipped" && input.checked) state.weapons[id][player].owned = true;
      if ((field === "catalyst" || field === "owned") && !input.checked) {
        if (field === "owned") Object.assign(state.weapons[id][player], blankWeapon());
        if (field === "catalyst") state.weapons[id][player].complete = false;
      }
    } else {
      const className = input.dataset.class;
      state.armor[className][id] = state.armor[className][id] || {};
      state.armor[className][id][player] = { ...blankArmor(), ...(state.armor[className][id][player] || {}) };
      state.armor[className][id][player][field] = input.checked;
      if (field === "equipped" && input.checked) state.armor[className][id][player].owned = true;
      if (field === "owned" && !input.checked) state.armor[className][id][player].equipped = false;
    }
    saveLocal();
    render();
  }

  function exportState() {
    hydrateDefaults(state);
    const output = JSON.stringify(state, null, 2);
    els.exportBox.value = output;
    navigator.clipboard?.writeText(output).catch(() => {});
  }

  function importState(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result || "{}"));
        state = mergeState(clone(BASE), imported);
        saveLocal();
        render();
        els.exportBox.value = JSON.stringify(state, null, 2);
      } catch (error) {
        els.exportBox.value = `Import failed: ${error.message}`;
      }
    };
    reader.readAsText(file);
  }

  function renderApiPanel() {
    if (!els.apiStatus) return;
    els.apiKeyInput.value = apiSettings.apiKey || "";
    els.clientIdInput.value = apiSettings.clientId || BUNGIE.clientId || "53180";
    const hasKey = Boolean(apiSettings.apiKey);
    const hasCode = Boolean(apiSettings.oauthCode);
    els.apiStatus.textContent = hasCode ? "OAuth code captured" : hasKey ? "API key saved locally" : "Not connected";
    if (hasCode) {
      els.oauthNote.textContent = "OAuth returned a code and saved it locally. Token exchange and collection import are scaffolded for the next API pass.";
    } else {
      els.oauthNote.textContent = "This does not replace manual checkmarks yet. It prepares the app for a later import/sync flow where you can log in, export collection data, and paste it back here for repo updates.";
    }
  }

  function buildAuthUrl() {
    const clientId = els.clientIdInput.value.trim() || BUNGIE.clientId || "53180";
    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    const params = new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: redirectUri });
    return `${BUNGIE.authUrl || "https://www.bungie.net/en/OAuth/Authorize"}?${params.toString()}`;
  }

  function captureOAuthCode() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (!code) return;
    apiSettings.oauthCode = code;
    apiSettings.lastSaved = new Date().toISOString();
    saveApiSettings(apiSettings);
    url.searchParams.delete("code");
    window.history.replaceState({}, document.title, url.toString());
  }

  document.body.addEventListener("change", handleCheck);
  els.search.addEventListener("input", event => { filters.search = event.target.value; render(); });
  document.querySelectorAll("[data-view]").forEach(btn => btn.addEventListener("click", () => {
    document.querySelectorAll("[data-view]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    filters.view = btn.dataset.view;
    render();
  }));
  document.querySelectorAll("[data-player]").forEach(btn => btn.addEventListener("click", () => {
    document.querySelectorAll("[data-player]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    filters.player = btn.dataset.player;
    render();
  }));
  els.exportBtn.addEventListener("click", exportState);
  els.importFile.addEventListener("change", event => importState(event.target.files?.[0]));
  els.resetLocalBtn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    state = mergeState(clone(BASE), null);
    els.exportBox.value = "Browser overrides reset. Reloading from data/checklist.js.";
    render();
  });
  els.saveApiBtn.addEventListener("click", () => {
    saveApiSettings({
      ...apiSettings,
      apiKey: els.apiKeyInput.value.trim(),
      clientId: els.clientIdInput.value.trim() || BUNGIE.clientId || "53180",
      lastSaved: new Date().toISOString()
    });
  });
  els.loginBtn.addEventListener("click", () => {
    saveApiSettings({
      ...apiSettings,
      apiKey: els.apiKeyInput.value.trim(),
      clientId: els.clientIdInput.value.trim() || BUNGIE.clientId || "53180",
      lastSaved: new Date().toISOString()
    });
    window.location.href = buildAuthUrl();
  });
  els.clearApiBtn.addEventListener("click", () => {
    localStorage.removeItem(API_STORAGE_KEY);
    apiSettings = readApiSettings();
    renderApiPanel();
  });

  captureOAuthCode();
  render();
})();
