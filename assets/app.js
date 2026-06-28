(() => {
  const CATALOG = window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: {} };
  const BASE = window.D2_COLLECTIONS_CHECKLIST || { users: {}, weapons: {}, armor: {} };
  const BUNGIE = window.D2_BUNGIE_CONFIG || {};
  const AUTH_STORAGE_KEY = "d2-collections-auth-v1";
  const LOCAL_OWNERSHIP_KEY = "d2-collections-local-ownership-v1";
  const RESOURCE_KEY = "d2-collections-player-resources-v1";
  const SESSION_KEY = "d2-collections-bungie-session-v2";
  const CLASS_FOCUS = { warlock: "corey", titan: "matt", hunter: "corey" };
  const CLASS_LABELS = { warlock: "Warlock", titan: "Titan", hunter: "Hunter" };
  const players = Object.keys(BASE.users || { corey: {}, matt: {} });
  const armorClasses = () => Object.keys(CATALOG.armor || {}).filter(className => Array.isArray(CATALOG.armor[className]));

  const blankWeapon = () => ({ owned: false, catalyst: false, complete: false });
  const blankArmor = () => ({ owned: false });
  const clone = value => JSON.parse(JSON.stringify(value || {}));

  let filters = { search: "", view: "all", player: "all" };
  let state = mergeState(clone(BASE));
  applyLocalOwnership(state);
  let resources = readResources();
  let authState = readAuthState();

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
    apiStatus: document.querySelector("#apiStatus"),
    loginBtn: document.querySelector("#loginBtn")
  };

  function readAuthState() {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      return { oauthCode: saved.oauthCode || "", lastSaved: saved.lastSaved || "" };
    } catch {
      return { oauthCode: "", lastSaved: "" };
    }
  }

  function saveAuthState(next = authState) {
    authState = next;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState));
    renderAuthPanel();
  }

  function mergeState(base) {
    const merged = base || {};
    merged.users = merged.users || { corey: { label: "Corey", short: "C" }, matt: { label: "Matt", short: "M" } };
    merged.weapons = merged.weapons || {};
    merged.armor = merged.armor || {};
    hydrateDefaults(merged);
    return merged;
  }

  function readSessionState() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function sessionIsUsable(saved = readSessionState()) {
    const now = Math.floor(Date.now() / 1000) + 60;
    return Boolean((saved.access_token && saved.expires_at > now) || (saved.refresh_token && (!saved.refresh_expires_at || saved.refresh_expires_at > now)));
  }

  function readLocalOwnership() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_OWNERSHIP_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function readResources() {
    try {
      return JSON.parse(localStorage.getItem(RESOURCE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveResources(next = resources) {
    resources = next || {};
    localStorage.setItem(RESOURCE_KEY, JSON.stringify(resources));
  }

  function applyLocalOwnership(next) {
    const saved = readLocalOwnership();
    Object.entries(saved.weapons || {}).forEach(([itemId, playersState]) => {
      Object.entries(playersState || {}).forEach(([player, row]) => {
        const target = next.weapons?.[itemId]?.[player];
        if (!target) return;
        if (row?.owned) target.owned = true;
        if (row?.catalyst) target.catalyst = true;
        if (row?.complete) target.complete = true;
      });
    });
    Object.entries(saved.armor || {}).forEach(([className, items]) => {
      Object.entries(items || {}).forEach(([itemId, playersState]) => {
        Object.entries(playersState || {}).forEach(([player, row]) => {
          if (row?.owned && next.armor?.[className]?.[itemId]?.[player]) next.armor[className][itemId][player].owned = true;
        });
      });
    });
  }

  function saveLocalOwnership() {
    const saved = { savedAt: new Date().toISOString(), weapons: {}, armor: {} };
    Object.entries(state.weapons || {}).forEach(([itemId, playersState]) => {
      Object.entries(playersState || {}).forEach(([player, row]) => {
        if (!row?.owned && !row?.catalyst && !row?.complete) return;
        saved.weapons[itemId] = saved.weapons[itemId] || {};
        saved.weapons[itemId][player] = {
          owned: Boolean(row.owned),
          catalyst: Boolean(row.catalyst),
          complete: Boolean(row.complete)
        };
      });
    });
    Object.entries(state.armor || {}).forEach(([className, items]) => {
      Object.entries(items || {}).forEach(([itemId, playersState]) => {
        Object.entries(playersState || {}).forEach(([player, row]) => {
          if (!row?.owned) return;
          saved.armor[className] = saved.armor[className] || {};
          saved.armor[className][itemId] = saved.armor[className][itemId] || {};
          saved.armor[className][itemId][player] = { owned: true };
        });
      });
    });
    localStorage.setItem(LOCAL_OWNERSHIP_KEY, JSON.stringify(saved));
  }

  function hydrateDefaults(next) {
    (CATALOG.weapons || []).forEach(item => {
      next.weapons[item.id] = next.weapons[item.id] || {};
      players.forEach(player => {
        next.weapons[item.id][player] = { ...blankWeapon(), ...(next.weapons[item.id][player] || {}) };
      });
    });
    armorClasses().forEach(className => {
      next.armor[className] = next.armor[className] || {};
      (CATALOG.armor[className] || []).forEach(item => {
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
    const player = CLASS_FOCUS[className] || players[0];
    const user = BASE.users?.[player]?.label || player;
    return `${user} ${CLASS_LABELS[className] || className}`;
  }

  function normalizeItemName(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
  }

  function matchesText(item) {
    const q = filters.search.trim().toLowerCase();
    if (!q) return true;
    const priority = item.priority || {};
    return [item.name, item.slot, item.type, item.element, item.bungieSource, item.source, priority.note, ...(priority.tags || []).map(tag => tag.label)].filter(Boolean).join(" ").toLowerCase().includes(q);
  }

  function matchesWeaponView(item) {
    const rows = playerList().map(player => state.weapons[item.id]?.[player] || blankWeapon());
    if (filters.view === "missing") return rows.some(row => !row.owned);
    if (filters.view === "catalysts") return rows.some(row => row.owned && (!row.catalyst || !row.complete));
    if (filters.view === "priority") return Boolean(item.priority?.mustHave);
    if (filters.view === "easy") return Boolean(item.priority?.easyWin);
    return true;
  }

  function matchesArmorView(className, item) {
    const rows = armorPlayersForClass(className).map(player => state.armor[className]?.[item.id]?.[player] || blankArmor());
    if (filters.view === "missing") return rows.some(row => !row.owned);
    if (filters.view === "catalysts") return false;
    if (filters.view === "priority") return Boolean(item.priority?.mustHave);
    if (filters.view === "easy") return Boolean(item.priority?.easyWin || rahoolReady(item, armorPlayersForClass(className)));
    return true;
  }

  function render() {
    renderSummary();
    renderWeapons();
    renderArmor("warlock", els.warlock);
    renderArmor("titan", els.titan);
    renderAuthPanel();
  }

  function renderSummary() {
    if (!els.summary) return;
    const weaponRows = flattenWeaponRows();
    const armorRows = flattenArmorRows();
    const priorityRows = [...weaponRows, ...armorRows].filter(row => row.item?.priority?.mustHave);
    els.summary.innerHTML = [
      metric("Weapons owned", weaponRows.filter(row => row.owned).length, weaponRows.length, "Ares + Icee"),
      metric("Catalysts owned", weaponRows.filter(row => row.catalyst).length, weaponRows.length, "Obtained catalysts"),
      metric("Catalysts complete", weaponRows.filter(row => row.complete).length, weaponRows.length, "Finished catalysts"),
      metric("Armor owned", armorRows.filter(row => row.owned).length, armorRows.length, "Configured classes"),
      metric("Priority missing", priorityRows.filter(row => !row.owned).length, priorityRows.length, "Must-have gaps")
    ].join("");
  }

  function metric(label, value, total, caption) {
    const pct = total ? Math.round((value / total) * 100) : 0;
    return `<article class="summary-card"><strong>${value}<small>/${total}</small></strong><span>${label} / ${caption}</span><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></article>`;
  }

  function flattenWeaponRows() {
    return (CATALOG.weapons || []).flatMap(item => playerList().map(player => ({ item, player, ...(state.weapons[item.id]?.[player] || blankWeapon()) })));
  }

  function flattenArmorRows() {
    return armorClasses().flatMap(className =>
      (CATALOG.armor[className] || []).flatMap(item => armorPlayersForClass(className).map(player => ({ className, item, player, ...(state.armor[className]?.[item.id]?.[player] || blankArmor()) })))
    );
  }

  function renderWeapons() {
    if (!els.weapons) return;
    const visible = (CATALOG.weapons || []).filter(item => matchesText(item) && matchesWeaponView(item));
    if (els.weaponCount) els.weaponCount.textContent = `${visible.length} / ${(CATALOG.weapons || []).length}`;
    els.weapons.innerHTML = visible.length ? visible.map(renderWeaponCard).join("") : emptyState("No weapons match this filter.");
  }

  function renderWeaponCard(item) {
    const visiblePlayers = playerList();
    const visibleStates = visiblePlayers.map(player => state.weapons[item.id]?.[player] || blankWeapon());
    const ownedCount = visibleStates.filter(row => row.owned).length;
    const cardClass = ownedCount === visibleStates.length ? "is-owned" : ownedCount ? "is-partial" : "is-missing";
    const source = item.bungieSource || item.source || "";
    const metaBadges = priorityBadges(item, visiblePlayers, visibleStates.every(row => row.owned));
    const playerRows = visiblePlayers.map(player => {
      const s = state.weapons[item.id]?.[player] || blankWeapon();
      return `<div class="status-grid status-row"><div class="player-label">${BASE.users[player]?.short || player}</div>${statusCell(s.owned, "Owned", "Not owned")}${statusCell(s.catalyst, "Catalyst obtained", "Catalyst missing", s.owned ? "" : "dim")}${statusCell(s.complete, "Catalyst complete", "Catalyst incomplete", s.owned ? "" : "dim")}</div>`;
    }).join("");

    return `<article class="weapon-card ${cardClass}" data-id="${item.id}"><div class="item-meta item-with-icon">${itemIconMarkup(item)}<div><div class="item-name"><h3>${item.name}</h3>${metaBadges}</div><div class="badge-row"><span class="badge ${(item.slot || "").toLowerCase()}">${item.slot || ""}</span><span class="badge slot">${item.type || ""}</span>${elementBadge(item.element)}<span class="badge source" title="${escapeAttr(source)}">${source}</span></div></div></div><div><div class="status-grid header"><span></span><span>Own</span><span>Cat</span><span>Done</span></div>${playerRows}</div></article>`;
  }

  function renderArmor(className, root) {
    if (!root || !CATALOG.armor?.[className]) return;
    const visible = (CATALOG.armor[className] || []).filter(item => matchesText(item) && matchesArmorView(className, item));
    const totalVisible = armorClasses().reduce((sum, klass) => sum + (CATALOG.armor[klass] || []).filter(item => matchesText(item) && matchesArmorView(klass, item)).length, 0);
    const total = armorClasses().reduce((sum, klass) => sum + (CATALOG.armor[klass] || []).length, 0);
    if (els.armorCount) els.armorCount.textContent = `${totalVisible} / ${total}`;
    root.innerHTML = visible.length ? visible.map(item => renderArmorCard(className, item)).join("") : emptyState(`No ${className} armor matches this filter.`);
  }

  function renderArmorCard(className, item) {
    const focusPlayer = CLASS_FOCUS[className] || players[0];
    const visiblePlayers = armorPlayersForClass(className);
    const visibleStates = visiblePlayers.map(player => state.armor[className]?.[item.id]?.[player] || blankArmor());
    const cardClass = visibleStates.some(row => row.owned) ? "is-owned" : "is-missing";
    const source = item.bungieSource || item.source || "";
    const metaBadges = priorityBadges(item, visiblePlayers, visibleStates.every(row => row.owned));
    const playerRows = visiblePlayers.map(player => {
      const s = state.armor[className]?.[item.id]?.[player] || blankArmor();
      const isFocus = player === focusPlayer;
      return `<div class="armor-status status-row"><div class="player-label ${isFocus ? "is-focus" : ""}">${BASE.users[player]?.short || player}</div>${statusCell(s.owned, "Owned", "Not owned")}</div>`;
    }).join("");

    return `<article class="armor-card is-focus-card ${cardClass}" data-id="${item.id}"><div class="item-meta item-with-icon">${itemIconMarkup(item)}<div><div class="item-name"><h3>${item.name}</h3>${metaBadges}</div><div class="badge-row"><span class="badge focus">${focusLabel(className)}</span><span class="badge slot">${item.slot || ""}</span><span class="badge source" title="${escapeAttr(source)}">${source}</span></div></div></div><div class="armor-status header"><span></span><span>Own</span></div>${playerRows}</article>`;
  }

  function hasRahoolMaterials(player) {
    const row = resources?.[player] || {};
    return Number(row.exoticCiphers || 0) >= 1 && Number(row.exoticEngrams || 0) >= 1;
  }

  function rahoolReady(item, visiblePlayers = playerList()) {
    return Boolean(item.priority?.rahool && visiblePlayers.some(player => hasRahoolMaterials(player)));
  }

  function priorityBadges(item, visiblePlayers, owned = false) {
    const tags = [...(item.priority?.tags || [])];
    if (!owned && rahoolReady(item, visiblePlayers)) {
      tags.unshift({ id: "buy", label: "Buy now", title: "Logged-in player has at least 1 Exotic Cipher and 1 Exotic Engram for Rahool focusing." });
    }
    if (!tags.length) return "";
    return `<span class="priority-tags">${tags.slice(0, 4).map(tag => `<span class="priority-chip ${escapeAttr(tag.id)}" title="${escapeAttr(tag.title || tag.label)}" aria-label="${escapeAttr(tag.title || tag.label)}">${tagSymbol(tag.id)}</span>`).join("")}</span>`;
  }

  function tagSymbol(id) {
    return ({ must: "⭐", easy: "✓", final: "✦", rahool: "◎", buy: "↗", confidence: "i" })[id] || "•";
  }

  function elementBadge(element) {
    const label = String(element || "").trim();
    if (!label) return "";
    const key = label.toLowerCase();
    const className = key.includes("/") ? "multi" :
      key.includes("solar") ? "solar" :
      key.includes("arc") ? "arc" :
      key.includes("void") ? "void" :
      key.includes("stasis") ? "stasis" :
      key.includes("strand") ? "strand" :
      key.includes("kinetic") ? "kinetic" :
      key.includes("variable") ? "variable" : "unknown";
    const mark = ({ solar: "☀", arc: "⚡", void: "◆", stasis: "❄", strand: "∞", kinetic: "◆", variable: "◇", multi: "◇" })[className] || "•";
    return `<span class="badge element ${className}" title="${escapeAttr(label)}"><span class="element-mark" aria-hidden="true">${mark}</span>${escapeAttr(label)}</span>`;
  }

  function statusCell(value, yesTitle, noTitle, extraClass = "") {
    const label = value ? yesTitle : noTitle;
    return `<div class="status-cell ${value ? "yes" : "no"} ${extraClass}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}"><span class="status-mark" aria-hidden="true"></span></div>`;
  }

  function itemIconMarkup(item) {
    const raw = item.icon || item.iconUrl || "";
    if (raw) {
      const src = raw.startsWith("/") ? `https://www.bungie.net${raw}` : raw;
      return `<img class="item-icon" src="${src}" alt="${item.name} icon" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'item-icon-fallback',textContent:'${escapeInitials(item.name)}'}))" />`;
    }
    return `<div class="item-icon-fallback" aria-hidden="true">${escapeInitials(item.name)}</div>`;
  }

  function escapeInitials(name) {
    return String(name || "?").split(/\s+|-/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() || "").join("") || "?";
  }

  function escapeAttr(value) {
    return String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function emptyState(text) {
    return `<div class="empty-state">${text}</div>`;
  }

  function exportState() {
    hydrateDefaults(state);
    const output = JSON.stringify(state, null, 2);
    if (els.exportBox) els.exportBox.value = output;
    navigator.clipboard?.writeText(output).catch(() => {});
  }

  function applyCollectionOwnership(payload = {}) {
    const player = payload.player;
    if (!player || !players.includes(player)) {
      return { ok: false, reason: "unknown_player", player, weaponsChanged: 0, armorChanged: 0, matchedItems: 0 };
    }

    hydrateDefaults(state);
    const itemIds = new Set([...(payload.itemIds || []), ...(payload.weaponIds || [])].map(String));
    const catalystItemIds = new Set([...(payload.catalystItemIds || [])].map(String));
    const completeItemIds = new Set([...(payload.completeItemIds || [])].map(String));
    const itemNames = new Set((payload.itemNames || []).map(normalizeItemName).filter(Boolean));
    let weaponsChanged = 0;
    let armorChanged = 0;
    let catalystsChanged = 0;
    let completedChanged = 0;
    let matchedItems = 0;

    if (payload.resourceCounts) {
      saveResources({
        ...resources,
        [player]: {
          ...(resources?.[player] || {}),
          ...payload.resourceCounts,
          updatedAt: new Date().toISOString()
        }
      });
    }

    (CATALOG.weapons || []).forEach(item => {
      const matched = itemIds.has(item.id) || itemNames.has(normalizeItemName(item.name));
      const row = state.weapons[item.id]?.[player];
      if (!row) return;
      if (matched) {
        matchedItems += 1;
        if (!row.owned) weaponsChanged += 1;
        row.owned = true;
      }
      if (catalystItemIds.has(item.id) && !row.catalyst) {
        catalystsChanged += 1;
        row.catalyst = true;
      }
      if (completeItemIds.has(item.id) && !row.complete) {
        completedChanged += 1;
        row.complete = true;
        if (!row.catalyst) {
          catalystsChanged += 1;
          row.catalyst = true;
        }
      }
    });

    armorClasses().forEach(className => {
      (CATALOG.armor[className] || []).forEach(item => {
        const matched = itemIds.has(item.id) || itemNames.has(normalizeItemName(item.name));
        if (!matched) return;
        const row = state.armor[className]?.[item.id]?.[player];
        if (!row) return;
        matchedItems += 1;
        if (!row.owned) armorChanged += 1;
        row.owned = true;
      });
    });

    if (weaponsChanged || armorChanged || catalystsChanged || completedChanged) saveLocalOwnership();
    render();
    const result = { ok: true, player, weaponsChanged, armorChanged, catalystsChanged, completedChanged, matchedItems, savedLocalOwnership: true };
    document.dispatchEvent(new CustomEvent("d2collections:ownership-applied", { detail: result }));
    return result;
  }

  function renderAuthPanel() {
    if (!els.apiStatus) return;
    const hasSession = sessionIsUsable();
    const hasCode = Boolean(authState.oauthCode);
    els.apiStatus.textContent = hasSession ? "Bungie linked" : hasCode ? "Login ready" : "Bungie offline";
    if (els.loginBtn) els.loginBtn.textContent = hasSession ? "Refresh Bungie login" : hasCode ? "Re-login with Bungie" : "Login with Bungie";
  }

  function buildAuthUrl() {
    const clientId = BUNGIE.clientId || "53180";
    const redirectUri = BUNGIE.redirectUri || "https://erebusares.github.io/D2-Collections/index.html";
    const state = crypto?.randomUUID?.() || String(Date.now());
    localStorage.setItem("d2-collections-oauth-state-v1", state);
    const params = new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: redirectUri, state });
    return `${BUNGIE.authUrl || "https://www.bungie.net/en/OAuth/Authorize"}?${params.toString()}`;
  }

  function captureOAuthCode() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (!code) return;
    const returnedState = url.searchParams.get("state") || "";
    const expectedState = localStorage.getItem("d2-collections-oauth-state-v1") || "";
    if (expectedState && returnedState !== expectedState) {
      console.warn("Bungie OAuth state mismatch.");
      return;
    }
    authState.oauthCode = code;
    authState.lastSaved = new Date().toISOString();
    saveAuthState(authState);
    localStorage.removeItem("d2-collections-oauth-state-v1");
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, document.title, url.toString());
  }

  window.D2_COLLECTIONS_APP = {
    applyCollectionOwnership,
    exportState,
    getState: () => clone(state),
    render
  };

  if (els.search) els.search.addEventListener("input", event => { filters.search = event.target.value; render(); });
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
  if (els.exportBtn) els.exportBtn.addEventListener("click", exportState);
  if (els.loginBtn) els.loginBtn.addEventListener("click", () => { window.location.href = buildAuthUrl(); });

  captureOAuthCode();
  render();
})();
