(() => {
  const CATALOG = window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: {} };
  const BASE = window.D2_COLLECTIONS_CHECKLIST || { users: {}, weapons: {}, armor: {} };
  const BUNGIE = window.D2_BUNGIE_CONFIG || {};
  const ICON_MAP = window.D2_COLLECTIONS_ICON_MAP || {};
  const COLLECTIBLES = window.D2_COLLECTIONS_BUNGIE_COLLECTIBLES || { items: {} };
  const AUTH_STORAGE_KEY = "d2-collections-auth-v1";
  const LOCAL_OWNERSHIP_KEY = "d2-collections-local-ownership-v1";
  const RESOURCE_KEY = "d2-collections-player-resources-v1";
  const SESSION_KEY = "d2-collections-bungie-session-v2";
  const ACTIVE_PLAYER_KEY = "d2-collections-active-player-v1";
  const CLASS_FOCUS = { warlock: "corey", titan: "matt", hunter: "corey" };
  const CLASS_LABELS = { warlock: "Warlock", titan: "Titan", hunter: "Hunter" };
  const players = Object.keys(BASE.users || { corey: {}, matt: {} });
  const armorClasses = () => Object.keys(CATALOG.armor || {}).filter(className => Array.isArray(CATALOG.armor[className]));
  const DAMAGE_ICONS = {
    solar: "https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_2a1773e10968f2d088b97c22b22bba9e.png",
    arc: "https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_092d066688b879c807c3b460afdd61e6.png",
    void: "https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_ceb2f6197dccf3958bb31cc783eb97a0.png",
    stasis: "https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_530c4c3e7981dc2aefd24fd3293482bf.png",
    strand: "https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_b2fe51a94f3533f97079dfa0d27a4096.png",
    kinetic: "https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_3385a924fd3ccb92c343ade19f19a370.png"
  };

  const blankWeapon = () => ({ owned: false, catalyst: false, complete: false });
  const blankArmor = () => ({ owned: false });
  const clone = value => JSON.parse(JSON.stringify(value || {}));

  let filters = { search: "", view: "all", player: "all", sort: "catalog" };
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
    loginBtn: document.querySelector("#loginBtn"),
    sort: document.querySelector("#sortSelect"),
    activePlayer: document.querySelector("#activePlayerPill"),
    dataHealth: document.querySelector("#dataHealth"),
    aresArmorCount: document.querySelector("#aresArmorCount"),
    iceeArmorCount: document.querySelector("#iceeArmorCount")
  };

  const weaponOrder = new Map((CATALOG.weapons || []).map((item, index) => [item.id, index]));
  const armorOrder = new Map();
  armorClasses().forEach(className => (CATALOG.armor[className] || []).forEach((item, index) => armorOrder.set(`${className}:${item.id}`, index)));

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

  function isSimpleMode() {
    return document.documentElement.classList.contains("layout-simple");
  }

  function readActivePlayer() {
    try {
      const saved = localStorage.getItem(ACTIVE_PLAYER_KEY);
      return players.includes(saved) ? saved : "";
    } catch {
      return "";
    }
  }

  function saveActivePlayer(player) {
    if (!players.includes(player)) return;
    localStorage.setItem(ACTIVE_PLAYER_KEY, player);
  }

  function orderedPlayers() {
    const active = readActivePlayer();
    const visible = playerList();
    return active && visible.includes(active) ? [active, ...visible.filter(player => player !== active)] : visible;
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
    return matchesWeaponViewForPlayers(item, playerList());
  }

  function matchesWeaponViewForPlayers(item, visiblePlayers) {
    const rows = visiblePlayers.map(player => state.weapons[item.id]?.[player] || blankWeapon());
    if (filters.view === "missing") return rows.some(row => !row.owned);
    if (filters.view === "catalysts") return weaponHasCatalyst(item) && rows.some(row => row.owned && (!row.catalyst || !row.complete));
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

  function rowScore(rows, getter) {
    return rows.some(getter) ? 0 : 1;
  }

  function priorityScore(item) {
    if (item.priority?.mustHave) return 0;
    if (item.priority?.finalUpdate) return 1;
    if (item.priority?.easyWin || item.priority?.rahool) return 2;
    return 3;
  }

  function compareText(a, b) {
    return String(a || "").localeCompare(String(b || ""), undefined, { sensitivity: "base" });
  }

  function compareBySort(a, b, context) {
    const orderMap = context.kind === "armor" ? armorOrder : weaponOrder;
    const orderA = context.kind === "armor" ? orderMap.get(`${context.className}:${a.id}`) : orderMap.get(a.id);
    const orderB = context.kind === "armor" ? orderMap.get(`${context.className}:${b.id}`) : orderMap.get(b.id);
    const fallback = (orderA ?? 0) - (orderB ?? 0);
    if (filters.sort === "catalog") return fallback;

    const playersForSort = context.players || playerList();
    const rowsFor = item => playersForSort.map(player =>
      context.kind === "armor"
        ? state.armor[context.className]?.[item.id]?.[player] || blankArmor()
        : state.weapons[item.id]?.[player] || blankWeapon()
    );
    const rowsA = rowsFor(a);
    const rowsB = rowsFor(b);

    let diff = 0;
    if (filters.sort === "priority") diff = priorityScore(a) - priorityScore(b);
    if (filters.sort === "missing") diff = rowScore(rowsA, row => !row.owned) - rowScore(rowsB, row => !row.owned);
    if (filters.sort === "easy") diff = (a.priority?.easyWin ? 0 : 1) - (b.priority?.easyWin ? 0 : 1);
    if (filters.sort === "rahool") diff = (rahoolReady(a, playersForSort) ? 0 : 1) - (rahoolReady(b, playersForSort) ? 0 : 1);
    if (filters.sort === "catalyst") diff = context.kind === "weapon"
      ? rowScore(rowsA, row => weaponHasCatalyst(a) && row.owned && (!row.catalyst || !row.complete)) - rowScore(rowsB, row => weaponHasCatalyst(b) && row.owned && (!row.catalyst || !row.complete))
      : fallback;
    if (filters.sort === "type") diff = compareText(`${a.slot || ""} ${a.type || ""}`, `${b.slot || ""} ${b.type || ""}`);

    return diff || priorityScore(a) - priorityScore(b) || compareText(a.name, b.name) || fallback;
  }

  function sortedItems(items, context) {
    return [...items].sort((a, b) => compareBySort(a, b, context));
  }

  function render() {
    renderSummary();
    renderIdentity();
    renderDataHealth();
    renderWeapons();
    renderArmor("warlock", els.warlock);
    renderArmor("titan", els.titan);
    renderAuthPanel();
  }

  function renderIdentity() {
    if (!els.activePlayer) return;
    const active = readActivePlayer();
    const user = BASE.users?.[active];
    const label = user?.display || user?.label || "";
    const linked = sessionIsUsable();
    els.activePlayer.textContent = label
      ? `Viewing as: ${label}`
      : linked
        ? "Bungie linked - dump to identify"
        : authState.oauthCode
          ? "Login ready - dump to identify"
          : "Viewing as: not linked";
    els.activePlayer.classList.toggle("is-linked", Boolean(label || linked || authState.oauthCode));
  }

  function renderDataHealth() {
    if (!els.dataHealth) return;
    const weapons = (CATALOG.weapons || []).length;
    const armor = armorClasses().reduce((sum, className) => sum + (CATALOG.armor[className] || []).length, 0);
    const catalogItems = weapons + armor;
    const iconCount = Object.keys(ICON_MAP || {}).length;
    const collectibleCount = Object.values(COLLECTIBLES.items || {}).filter(item => (item.collectibleHashes || []).length).length;
    const missingIcons = [...(CATALOG.weapons || []), ...armorClasses().flatMap(className => CATALOG.armor[className] || [])].filter(item => !item.icon && !item.iconUrl && !ICON_MAP[item.id]).length;
    els.dataHealth.innerHTML = [
      ["Catalog", catalogItems],
      ["Weapons", weapons],
      ["Armor", armor],
      ["Icons", iconCount],
      ["Collectibles", collectibleCount],
      ["Missing icons", missingIcons]
    ].map(([label, value]) => `<span><strong>${value}</strong>${label}</span>`).join("");
  }

  function renderSummary() {
    if (!els.summary) return;
    const weaponRows = flattenWeaponRows();
    const catalystRows = weaponRows.filter(row => weaponHasCatalyst(row.item));
    const armorRows = flattenArmorRows();
    const priorityRows = [...weaponRows, ...armorRows].filter(row => row.item?.priority?.mustHave);
    els.summary.innerHTML = [
      metric("Weapons owned", weaponRows.filter(row => row.owned).length, weaponRows.length, "Ares + Icee"),
      metric("Catalysts owned", catalystRows.filter(row => row.catalyst).length, catalystRows.length, "Weapons with catalysts"),
      metric("Catalysts complete", catalystRows.filter(row => row.complete).length, catalystRows.length, "Finished catalysts"),
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
    const allWeapons = CATALOG.weapons || [];
    const visible = sortedItems(allWeapons.filter(item => matchesText(item) && matchesWeaponView(item)), { kind: "weapon", players: playerList() });
    if (els.weaponCount) els.weaponCount.textContent = `${visible.length} / ${(CATALOG.weapons || []).length}`;
    const splitSimpleWeapons = isSimpleMode() && filters.player === "all" && players.length > 1;
    els.weapons.classList.toggle("is-split", splitSimpleWeapons);
    if (splitSimpleWeapons) {
      els.weapons.innerHTML = orderedPlayers().map(player => renderWeaponPlayerSection(player, allWeapons)).join("");
      return;
    }
    const fallbackAnchors = `<span id="aresWeapons" class="jump-anchor"></span><span id="iceeWeapons" class="jump-anchor"></span>`;
    els.weapons.innerHTML = fallbackAnchors + (visible.length ? visible.map((item, index) => renderWeaponCard(item, playerList(), index < 24)).join("") : emptyState("No weapons match this filter."));
  }

  function renderWeaponPlayerSection(player, allWeapons) {
    const user = BASE.users[player] || {};
    const visible = sortedItems(allWeapons.filter(item => matchesText(item) && matchesWeaponViewForPlayers(item, [player])), { kind: "weapon", players: [player] });
    const owned = visible.filter(item => state.weapons[item.id]?.[player]?.owned).length;
    const label = user.label || player;
    const handle = user.handle || user.name || "";
    const title = handle ? `${label} (${handle})` : label;
    const anchor = player === "matt" ? "iceeWeapons" : "aresWeapons";
    return `<article id="${anchor}" class="simple-player-section weapon-player-section" data-player="${escapeAttr(player)}"><div class="class-title weapon-player-title"><span>${escapeAttr(user.short || label[0] || "?")}</span><strong>${escapeAttr(title)} / Weapons</strong><em>${owned}/${visible.length} unlocked</em></div><div class="weapon-list simple-player-list">${visible.length ? visible.map((item, index) => renderWeaponCard(item, [player], index < 24)).join("") : emptyState("No weapons match this filter.")}</div></article>`;
  }

  function renderWeaponCard(item, visiblePlayers = playerList(), eagerIcon = false) {
    const visibleStates = visiblePlayers.map(player => state.weapons[item.id]?.[player] || blankWeapon());
    const ownedCount = visibleStates.filter(row => row.owned).length;
    const cardClass = ownedCount === visibleStates.length ? "is-owned" : ownedCount ? "is-partial" : "is-missing";
    const source = item.bungieSource || item.source || "";
    const metaBadges = priorityBadges(item, visiblePlayers, visibleStates.every(row => row.owned));
    const hasCat = weaponHasCatalyst(item);
    const playerRows = visiblePlayers.map(player => {
      const s = state.weapons[item.id]?.[player] || blankWeapon();
      return `<div class="status-grid status-row"><div class="player-label">${BASE.users[player]?.short || player}</div>${statusCell(s.owned, "Owned", "Not owned")}${hasCat ? statusCell(s.catalyst, "Catalyst obtained", "Catalyst missing", s.owned ? "" : "dim") : neutralStatusCell("No catalyst for this weapon")}${hasCat ? statusCell(s.complete, "Catalyst complete", "Catalyst incomplete", s.owned ? "" : "dim") : neutralStatusCell("No catalyst completion for this weapon")}</div>`;
    }).join("");

    const tileTitle = `${item.name} - ${item.slot || "Weapon"} ${item.type || ""}. ${ownedCount}/${visibleStates.length} selected player(s) own it. Click for more info.`;
    const actionAttrs = isSimpleMode() ? ` tabindex="0" role="button" aria-label="${escapeAttr(tileTitle)}"` : "";
    return `<article class="weapon-card ${cardClass}"${actionAttrs} data-id="${item.id}" data-help-id="${item.id}" title="${escapeAttr(tileTitle)}"><div class="item-meta item-with-icon">${itemIconMarkup(item, eagerIcon)}${simpleDamageIcons(item.element)}<div><div class="item-name"><h3>${item.name}</h3>${metaBadges}</div><div class="badge-row">${kindBadge("weapon")}${slotBadge(item.slot)}${weaponTypeBadge(item.type)}${elementBadge(item.element)}<span class="badge source" title="${escapeAttr(source)}">${source}</span></div></div></div><div><div class="status-grid header"><span></span><span>Own</span><span>Cat</span><span>Done</span></div>${playerRows}</div></article>`;
  }

  function renderArmor(className, root) {
    if (!root || !CATALOG.armor?.[className]) return;
    const visible = sortedItems((CATALOG.armor[className] || []).filter(item => matchesText(item) && matchesArmorView(className, item)), { kind: "armor", className, players: armorPlayersForClass(className) });
    updateArmorSectionCount(className);
    const totalVisible = armorClasses().reduce((sum, klass) => sum + (CATALOG.armor[klass] || []).filter(item => matchesText(item) && matchesArmorView(klass, item)).length, 0);
    const total = armorClasses().reduce((sum, klass) => sum + (CATALOG.armor[klass] || []).length, 0);
    if (els.armorCount) els.armorCount.textContent = `${totalVisible} / ${total}`;
    root.innerHTML = visible.length ? visible.map((item, index) => renderArmorCard(className, item, index < 16)).join("") : emptyState(`No ${className} armor matches this filter.`);
  }

  function renderArmorCard(className, item, eagerIcon = false) {
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

    const ownedCount = visibleStates.filter(row => row.owned).length;
    const tileTitle = `${item.name} - ${focusLabel(className)} ${item.slot || "armor"}. ${ownedCount}/${visibleStates.length} selected player(s) own it. Click for more info.`;
    const actionAttrs = isSimpleMode() ? ` tabindex="0" role="button" aria-label="${escapeAttr(tileTitle)}"` : "";
    return `<article class="armor-card is-focus-card ${cardClass}"${actionAttrs} data-id="${item.id}" data-help-id="${item.id}" title="${escapeAttr(tileTitle)}"><div class="item-meta item-with-icon">${itemIconMarkup(item, eagerIcon)}<div><div class="item-name"><h3>${item.name}</h3>${metaBadges}</div><div class="badge-row">${kindBadge("armor")}${armorClassBadge(className)}${slotBadge(item.slot)}<span class="badge source" title="${escapeAttr(source)}">${source}</span></div></div></div><div class="armor-status header"><span></span><span>Own</span></div>${playerRows}</article>`;
  }

  function updateArmorSectionCount(className) {
    const player = CLASS_FOCUS[className] || players[0];
    const total = (CATALOG.armor[className] || []).length;
    const owned = (CATALOG.armor[className] || []).filter(item => state.armor[className]?.[item.id]?.[player]?.owned).length;
    const target = className === "warlock" ? els.aresArmorCount : className === "titan" ? els.iceeArmorCount : null;
    if (target) target.textContent = `${owned}/${total} unlocked`;
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
    return `<span class="priority-tags">${tags.slice(0, 4).map(tag => `<span class="priority-chip ${escapeAttr(tag.id)}" title="${escapeAttr(tag.title || tag.label)}" aria-label="${escapeAttr(tag.title || tag.label)}">${tagIcon(tag.id)}</span>`).join("")}</span>`;
  }

  function tagIcon(id) {
    const icons = {
      must: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 10.5v9H4v-9h3.5Zm2.5 9V10l4.2-6.2c.4-.6 1.3-.5 1.6.1.3.6.3 1.4 0 2L14.5 9h4.2c1.1 0 1.9 1 1.7 2l-1.1 6.2c-.2 1.3-1.3 2.3-2.7 2.3H10Z"/></svg>`,
      easy: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19.5 6.5"/></svg>`,
      final: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 14.2 10l6.3 2-6.3 2L12 20.5 9.8 14l-6.3-2 6.3-2L12 3.5Z"/></svg>`,
      rahool: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 20.5 12 12 20.5 3.5 12 12 3.5Z"/><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/></svg>`,
      buy: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7"/><path d="M9 7h8v8"/></svg>`,
      confidence: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 10v7"/><path d="M12 7h.01"/><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/></svg>`
    };
    return icons[id] || `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12h.01"/></svg>`;
  }

  function damageParts(element) {
    const label = String(element || "").trim();
    const key = label.toLowerCase();
    return ["solar", "arc", "void", "stasis", "strand", "kinetic"].filter(name => key.includes(name));
  }

  function weaponHasCatalyst(item) {
    return Boolean((COLLECTIBLES.items?.[item.id]?.catalystRecordHashes || []).length);
  }

  function kindBadge(kind) {
    const label = titleCase(kind === "armor" ? "Armor" : "Weapon");
    const icon = kind === "armor"
      ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5.5c0 4.2-2.6 7.5-7 9.5-4.4-2-7-5.3-7-9.5V6l7-3Z"/></svg>`
      : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h7l6-6 3 3-6 6v3h-3v-3H4v-3Z"/><path d="m15 6 3 3"/></svg>`;
    return `<span class="badge meta-chip kind ${escapeAttr(kind)}" title="${label}">${icon}${label}</span>`;
  }

  function slotBadge(slot) {
    const label = titleCase(slot);
    if (!label) return "";
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return `<span class="badge meta-chip slot-icon ${escapeAttr(key)}" title="${escapeAttr(label)}">${slotIcon(label)}${escapeAttr(label)}</span>`;
  }

  function weaponTypeBadge(type) {
    const label = titleCase(type);
    if (!label) return "";
    return `<span class="badge meta-chip type-icon ${escapeAttr(typeKey(label))}" title="${escapeAttr(label)}">${weaponTypeIcon(label)}${escapeAttr(label)}</span>`;
  }

  function armorClassBadge(className) {
    const label = titleCase(CLASS_LABELS[className] || className);
    return `<span class="badge meta-chip class-icon ${escapeAttr(className)}" title="${escapeAttr(label)}">${classIcon(className)}${escapeAttr(label)}</span>`;
  }

  function classIcon(className) {
    const key = String(className || "").toLowerCase();
    if (key.includes("warlock")) return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 9l8 12 8-12-8-6Z"/><path d="M12 7v10"/><path d="m8 10 4 7 4-7"/></svg>`;
    if (key.includes("titan")) return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v5l-7 9-7-9V5Z"/><path d="M8 8h8"/><path d="M9 11h6"/></svg>`;
    if (key.includes("hunter")) return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 8v8l-8 5-8-5V8l8-5Z"/><path d="m8 9 4 8 4-8"/><path d="M8 9h8"/></svg>`;
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 20 12 12 20 4 12 12 4Z"/></svg>`;
  }

  function slotIcon(slot) {
    const key = String(slot || "").toLowerCase();
    if (key.includes("kinetic")) return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 21 12 12 21 3 12 12 3Z"/><path d="M12 8v8M8 12h8"/></svg>`;
    if (key.includes("energy")) return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 5 13h6l-1 9 8-12h-6l1-8Z"/></svg>`;
    if (key.includes("power")) return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12l2 5-8 7-8-7 2-5Z"/><path d="M8.5 10h7"/><path d="M10 13h4"/></svg>`;
    if (key.includes("helmet")) return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 14c0-6 3-10 7-10s7 4 7 10v5H5v-5Z"/><path d="M8 14h8"/></svg>`;
    if (key.includes("gauntlet") || key.includes("glove")) return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12V5a2 2 0 0 1 4 0v6"/><path d="M11 11V4a2 2 0 0 1 4 0v8"/><path d="M15 12V7a2 2 0 0 1 4 0v7c0 4-2.5 7-6 7H9l-4-7"/></svg>`;
    if (key.includes("chest")) return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10l3 5-3 11H7L4 9l3-5Z"/><path d="M9 8h6"/></svg>`;
    if (key.includes("leg")) return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8l-1 8 2 10h-4l-1-7-1 7H7l2-10-1-8Z"/></svg>`;
    if (key.includes("class")) return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h10v5l-3 2 3 2v5H7v-5l3-2-3-2V5Z"/></svg>`;
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 20 12 12 20 4 12 12 4Z"/></svg>`;
  }

  function weaponTypeIcon(type) {
    const key = typeKey(type);
    const icons = {
      "auto-rifle": `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h9l4-4h3v4h-2l-3 3H4v-3Z"/><path d="M8 17v3"/><path d="M13 14l2 5"/></svg>`,
      "combat-bow": `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4c6 3 6 13 0 16"/><path d="M8 4v16"/><path d="M4 12h14"/><path d="m15 9 4 3-4 3"/></svg>`,
      "fusion-rifle": `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15h10l5-5h2"/><path d="M7 12h6"/><path d="M9 9h5"/><path d="M10 15v4"/></svg>`,
      "glaive": `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5"/><path d="m15 4 5 5"/><path d="m16 8-3-3"/><path d="M4 20l4-1"/></svg>`,
      "grenade-launcher": `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15h9l5-5h2v4h-3l-3 3H4v-2Z"/><path d="M7 12h5"/><path d="M10 17v3"/><circle cx="17" cy="7" r="2"/></svg>`,
      "hand-cannon": `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h10l3-3h3v3h-4l-3 3H4v-3Z"/><path d="M8 17v3"/><path d="M13 14v4"/></svg>`,
      "linear-fusion-rifle": `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 14h12l5-5h2"/><path d="M6 11h9"/><path d="M7 17h5"/><path d="m15 14 2 4"/></svg>`,
      "machine-gun": `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 14h10l4-4h4v4h-3l-3 3H3v-3Z"/><path d="M6 11h6"/><path d="M7 17v3"/><path d="M12 17v3"/></svg>`,
      "pulse-rifle": `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h9l4-4h3v4h-3l-3 3H4v-3Z"/><path d="M7 11h7"/><path d="M9 17v3"/><path d="M13 8h3"/></svg>`,
      "rocket-launcher": `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15h11l5-5v5l-5 3H4v-3Z"/><path d="M7 12h7"/><path d="M10 18v3"/></svg>`,
      "scout-rifle": `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h9l4-4h3v3h-3l-3 3H4v-2Z"/><path d="M7 11h5"/><path d="M9 16v4"/><circle cx="14" cy="9" r="1.5"/></svg>`,
      "shotgun": `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15h11l4-4h2v4h-4l-3 3H4v-3Z"/><path d="M6 12h8"/><path d="M8 18v3"/></svg>`,
      "sidearm": `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 14h8l3-3h4v3h-5l-2 3H5v-3Z"/><path d="M8 17v3"/></svg>`,
      "sniper-rifle": `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 14h11l5-5h3"/><path d="M6 11h7"/><path d="M8 17v3"/><circle cx="15" cy="9" r="2"/></svg>`,
      "smg": `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h8l4-3h4v3h-3l-3 3H4v-3Z"/><path d="M7 17v3"/><path d="M12 14v5"/></svg>`,
      "submachine-gun": `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h8l4-3h4v3h-3l-3 3H4v-3Z"/><path d="M7 17v3"/><path d="M12 14v5"/></svg>`,
      "sword": `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3 21 3 21 10 9 22 2 15 14 3Z"/><path d="m8 16-2 2"/><path d="m10 14 3 3"/></svg>`,
      "trace-rifle": `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h10l4-4h3"/><path d="M6 11h8"/><path d="M9 17v3"/><path d="M17 7h4"/><path d="M18 11h3"/></svg>`
    };
    return icons[key] || `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h10l5-5h2"/><path d="M8 17v3"/></svg>`;
  }

  function typeKey(type) {
    return String(type || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function titleCase(value) {
    return String(value || "").trim().toLowerCase().replace(/\b[a-z0-9]/g, char => char.toUpperCase());
  }

  function damageIconImg(name, label, className = "damage-icon") {
    const src = DAMAGE_ICONS[name];
    return src ? `<img class="${className} ${escapeAttr(name)}" src="${src}" alt="" title="${escapeAttr(label)}" width="17" height="17" loading="lazy" decoding="async" aria-hidden="true" />` : "";
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
    const parts = damageParts(label);
    const marks = (parts.length ? parts : [className]).slice(0, 2).map(name => damageIconImg(name, label)).join("");
    return `<span class="badge element ${className}" title="${escapeAttr(label)}"><span class="element-icons">${marks}</span>${escapeAttr(label)}</span>`;
  }

  function simpleDamageIcons(element) {
    const label = String(element || "").trim();
    if (!label) return "";
    const parts = damageParts(label).slice(0, 2);
    if (!parts.length) return "";
    return `<span class="simple-damage-icons">${parts.map(name => damageIconImg(name, label, "simple-damage-icon")).join("")}</span>`;
  }

  function statusCell(value, yesTitle, noTitle, extraClass = "") {
    const label = value ? yesTitle : noTitle;
    return `<div class="status-cell ${value ? "yes" : "no"} ${extraClass}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}"><span class="status-mark" aria-hidden="true"></span></div>`;
  }

  function neutralStatusCell(title) {
    return `<div class="status-cell idle" title="${escapeAttr(title)}" aria-label="${escapeAttr(title)}"><span class="status-mark" aria-hidden="true"></span></div>`;
  }

  function itemIconMarkup(item, eager = false) {
    const raw = item.icon || item.iconUrl || "";
    if (raw) {
      const src = raw.startsWith("/") ? `https://www.bungie.net${raw}` : raw;
      return `<img class="item-icon" src="${src}" alt="${item.name} icon" width="64" height="64" loading="${eager ? "eager" : "lazy"}" decoding="async" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'item-icon-fallback',textContent:'${escapeInitials(item.name)}'}))" />`;
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
    saveActivePlayer(player);

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

  function shouldKeepNativeFind(event) {
    const target = event.target;
    if (!target) return false;
    if (target === els.search) return false;
    const tag = target.tagName?.toLowerCase();
    return target.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";
  }

  function focusSiteSearch(event) {
    if (!els.search || event.key.toLowerCase() !== "f" || (!event.ctrlKey && !event.metaKey) || event.altKey) return;
    if (shouldKeepNativeFind(event)) return;
    event.preventDefault();
    els.search.focus({ preventScroll: true });
    els.search.select();
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
  if (els.sort) els.sort.addEventListener("change", event => { filters.sort = event.target.value || "catalog"; render(); });
  if (els.exportBtn) els.exportBtn.addEventListener("click", exportState);
  if (els.loginBtn) els.loginBtn.addEventListener("click", () => { window.location.href = buildAuthUrl(); });
  document.addEventListener("keydown", focusSiteSearch);
  document.addEventListener("d2collections:layout-mode-changed", render);

  captureOAuthCode();
  render();
})();
