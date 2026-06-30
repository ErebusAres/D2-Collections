(() => {
  const CATALOG = window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: {} };
  const BASE = window.D2_COLLECTIONS_CHECKLIST || { users: {}, weapons: {}, armor: {} };
  const BUNGIE = window.D2_BUNGIE_CONFIG || {};
  const ICON_MAP = window.D2_COLLECTIONS_ICON_MAP || {};
  const COLLECTIBLES = window.D2_COLLECTIONS_BUNGIE_COLLECTIBLES || { items: {} };
  const AUTH_STORAGE_KEY = "d2-collections-auth-v1";
  const LOCAL_OWNERSHIP_KEY = "d2-collections-local-ownership-v1";
  const RESOURCE_KEY = "d2-collections-player-resources-v1";
  const CLOUD_META_KEY = "d2-collections-cloud-meta-v1";
  const XUR_STOCK_KEY = "d2-collections-xur-stock-v1";
  const SESSION_KEY = "d2-collections-bungie-session-v2";
  const ACTIVE_PLAYER_KEY = "d2-collections-active-player-v1";
  const CLAIM_FEED_KEY = "d2-collections-claim-feed-v1";
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
  const RESOURCE_ICONS = {
    exoticCipher: "https://www.bungie.net/common/destiny2_content/icons/9970631fe1052642c268132dfc30e16b.jpg",
    exoticEngram: "https://www.bungie.net/common/destiny2_content/icons/3e6a698e1a8a5fb446fdcbf1e63c5269.png"
  };

  const blankWeapon = () => ({ owned: false, catalyst: false, complete: false });
  const blankArmor = () => ({ owned: false });
  const clone = value => JSON.parse(JSON.stringify(value || {}));

  let filters = { search: "", view: "all", player: "all", sort: "catalog" };
  let state = mergeState(clone(BASE));
  applyLocalOwnership(state);
  let resources = readResources();
  let cloudMeta = readCloudMeta();
  let xurStock = readXurStock();
  let authState = readAuthState();
  let claimFeed = readClaimFeed();

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
    iceeArmorCount: document.querySelector("#iceeArmorCount"),
    claimFeedList: document.querySelector("#claimFeedList"),
    claimFeedCount: document.querySelector("#claimFeedCount"),
    clearClaimFeedBtn: document.querySelector("#clearClaimFeedBtn")
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

  function readCloudMeta() {
    try {
      return JSON.parse(localStorage.getItem(CLOUD_META_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveCloudMeta(next = cloudMeta) {
    cloudMeta = next || {};
    localStorage.setItem(CLOUD_META_KEY, JSON.stringify(cloudMeta));
  }

  function readXurStock() {
    try {
      return JSON.parse(localStorage.getItem(XUR_STOCK_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveXurStock(next = xurStock) {
    xurStock = next || {};
    localStorage.setItem(XUR_STOCK_KEY, JSON.stringify(xurStock));
  }

  function readClaimFeed() {
    try {
      const saved = JSON.parse(localStorage.getItem(CLAIM_FEED_KEY) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  function saveClaimFeed(next = claimFeed) {
    claimFeed = Array.isArray(next) ? next.slice(0, 80) : [];
    localStorage.setItem(CLAIM_FEED_KEY, JSON.stringify(claimFeed));
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

  function armorClassVisible(className) {
    return filters.player === "all" || CLASS_FOCUS[className] === filters.player;
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
    return [item.name, item.slot, item.type, item.element, manifestSource(item), item.bungieSource, item.source, priority.note, ...(priority.tags || []).map(tag => tag.label)].filter(Boolean).join(" ").toLowerCase().includes(q);
  }

  function matchesWeaponView(item) {
    return matchesWeaponViewForPlayers(item, playerList());
  }

  function matchesWeaponViewForPlayers(item, visiblePlayers) {
    const rows = visiblePlayers.map(player => state.weapons[item.id]?.[player] || blankWeapon());
    if (filters.view === "needs") return needsWeaponAction(item, rows, visiblePlayers);
    if (filters.view === "missing") return rows.some(row => !row.owned);
    if (filters.view === "catalysts") return weaponHasCatalyst(item) && rows.some(row => row.owned && (!row.catalyst || !row.complete));
    if (filters.view === "priority") return Boolean(item.priority?.mustHave);
    if (filters.view === "easy") return Boolean(item.priority?.easyWin);
    return true;
  }

  function matchesArmorView(className, item) {
    const rows = armorPlayersForClass(className).map(player => state.armor[className]?.[item.id]?.[player] || blankArmor());
    if (filters.view === "needs") return needsArmorAction(item, rows, armorPlayersForClass(className));
    if (filters.view === "missing") return rows.some(row => !row.owned);
    if (filters.view === "catalysts") return false;
    if (filters.view === "priority") return Boolean(item.priority?.mustHave);
    if (filters.view === "easy") return Boolean(item.priority?.easyWin || rahoolReady(item, armorPlayersForClass(className)));
    return true;
  }

  function rowScore(rows, getter) {
    return rows.some(getter) ? 0 : 1;
  }

  function catalystGap(item, rows) {
    return weaponHasCatalyst(item) && rows.some(row => row.owned && (!row.catalyst || !row.complete));
  }

  function needsWeaponAction(item, rows, visiblePlayers = playerList()) {
    const missing = rows.some(row => !row.owned);
    return catalystGap(item, rows) ||
      (missing && Boolean(item.priority?.mustHave || item.priority?.easyWin || rahoolReady(item, visiblePlayers)));
  }

  function needsArmorAction(item, rows, visiblePlayers = playerList()) {
    const missing = rows.some(row => !row.owned);
    return missing && Boolean(item.priority?.mustHave || item.priority?.easyWin || rahoolReady(item, visiblePlayers));
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
    if (filters.sort === "needs") diff = (context.kind === "weapon"
      ? rowScore(rowsA, row => needsWeaponAction(a, rowsA, playersForSort)) - rowScore(rowsB, row => needsWeaponAction(b, rowsB, playersForSort))
      : rowScore(rowsA, row => needsArmorAction(a, rowsA, playersForSort)) - rowScore(rowsB, row => needsArmorAction(b, rowsB, playersForSort)));
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
    renderClaimFeed();
    renderWeapons();
    renderArmor("warlock", els.warlock, document.querySelector("#aresArmor"));
    renderArmor("titan", els.titan, document.querySelector("#iceeArmor"));
    renderAuthPanel();
  }

  let scheduledRender = 0;
  function scheduleRender() {
    if (scheduledRender) cancelAnimationFrame(scheduledRender);
    scheduledRender = requestAnimationFrame(() => {
      scheduledRender = 0;
      render();
    });
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
    const xurCount = xurStock?.active ? (xurStock.itemIds || []).length : "off";
    els.dataHealth.innerHTML = [
      ["Catalog", catalogItems],
      ["Weapons", weapons],
      ["Armor", armor],
      ["Icons", iconCount],
      ["Collectibles", collectibleCount],
      ["Missing icons", missingIcons],
      ["Xur stock", xurCount]
    ].map(([label, value]) => `<span><strong>${value}</strong>${label}</span>`).join("");
  }

  function renderClaimFeed() {
    if (els.claimFeedCount) els.claimFeedCount.textContent = claimFeed.length;
    if (!els.claimFeedList) return;
    els.claimFeedList.innerHTML = claimFeed.length
      ? claimFeed.slice(0, 24).map(renderClaimFeedItem).join("")
      : `<div class="claim-feed-empty">No recent claim activity yet.</div>`;
  }

  function renderClaimFeedItem(entry) {
    const title = claimFeedTitle(entry);
    const icon = entry.icon ? `<img src="${escapeAttr(entry.icon)}" alt="" width="38" height="38" loading="lazy" decoding="async" aria-hidden="true" />` : `<span class="claim-feed-fallback">${escapeInitials(entry.itemName)}</span>`;
    return `<article class="claim-feed-item ${escapeAttr(entry.kind || "item")}">
      ${icon}
      <div>
        <strong>${escapeAttr(entry.itemName || "Unknown item")}</strong>
        <span>${escapeAttr(title)}</span>
        <time title="${escapeAttr(formatFullDate(entry.at))}">${escapeAttr(formatRelativeTime(entry.at))}</time>
      </div>
      <button type="button" class="claim-feed-dismiss" data-feed-dismiss="${escapeAttr(entry.id)}" aria-label="Dismiss ${escapeAttr(entry.itemName || "feed item")}">&times;</button>
    </article>`;
  }

  function renderSummary() {
    if (!els.summary) return;
    const weaponRows = flattenWeaponRows();
    const catalystRows = weaponRows.filter(row => weaponHasCatalyst(row.item));
    const armorRows = flattenArmorRows();
    const priorityRows = [...weaponRows, ...armorRows].filter(row => row.item?.priority?.mustHave);
    const needsRows = [
      ...(CATALOG.weapons || []).filter(item => needsWeaponAction(item, playerList().map(player => state.weapons[item.id]?.[player] || blankWeapon()), playerList())),
      ...armorClasses().flatMap(className => (CATALOG.armor[className] || []).filter(item => needsArmorAction(item, armorPlayersForClass(className).map(player => state.armor[className]?.[item.id]?.[player] || blankArmor()), armorPlayersForClass(className))))
    ];
    els.summary.innerHTML = [
      metric("Weapons owned", weaponRows.filter(row => row.owned).length, weaponRows.length, "Ares + Icee"),
      metric("Catalysts owned", catalystRows.filter(row => row.catalyst).length, catalystRows.length, "Weapons with catalysts"),
      metric("Catalysts complete", catalystRows.filter(row => row.complete).length, catalystRows.length, "Finished catalysts"),
      metric("Armor owned", armorRows.filter(row => row.owned).length, armorRows.length, "Configured classes"),
      metric("Priority missing", priorityRows.filter(row => !row.owned).length, priorityRows.length, "Must-have gaps"),
      metric("Needs action", needsRows.length, (CATALOG.weapons || []).length + armorClasses().reduce((sum, className) => sum + (CATALOG.armor[className] || []).length, 0), "missing, buyable, catalyst gaps"),
      ...players.map(resourceMetric),
      ...players.map(cloudSyncMetric)
    ].join("");
  }

  function metric(label, value, total, caption) {
    const pct = total ? Math.round((value / total) * 100) : 0;
    return `<article class="summary-card"><strong>${value}<small>/${total}</small></strong><span>${label} / ${caption}</span><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></article>`;
  }

  function resourceMetric(player) {
    const row = resources?.[player] || {};
    const user = BASE.users?.[player]?.display || BASE.users?.[player]?.label || titleCase(player);
    const ciphers = Number(row.exoticCiphers || 0);
    const engrams = Number(row.exoticEngrams || 0);
    const synced = Boolean(row.updatedAt);
    const ready = ciphers >= 1 && engrams >= 1;
    const pct = !synced ? 0 : ready ? 100 : ciphers >= 1 || engrams >= 1 ? 50 : 0;
    const value = synced
      ? `<span class="resource-count"><img src="${RESOURCE_ICONS.exoticCipher}" alt="" title="Exotic Cipher" width="18" height="18" loading="lazy" decoding="async" aria-hidden="true" />${ciphers}<small>Cipher</small></span><span class="resource-count"><img src="${RESOURCE_ICONS.exoticEngram}" alt="" title="Exotic Engram" width="18" height="18" loading="lazy" decoding="async" aria-hidden="true" />${engrams}<small>Engram</small></span>`
      : `<small>not synced</small>`;
    const title = synced
      ? `${user}: ${ciphers} Exotic Cipher(s), ${engrams} Exotic Engram(s). ${ready ? "Rahool buy-now checks are active." : "Needs 1+ of each for Rahool buy-now checks."}`
      : `${user}: dump this player's Bungie data to show Exotic Cipher and Exotic Engram counts.`;
    return `<article class="summary-card resource-card ${ready ? "is-ready" : "is-waiting"}" title="${escapeAttr(title)}"><strong>${value}</strong><span>${user} Rahool materials</span><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></article>`;
  }

  function cloudSyncMetric(player) {
    const row = cloudMeta?.players?.[player] || {};
    const user = BASE.users?.[player]?.display || BASE.users?.[player]?.label || titleCase(player);
    const syncedAt = row.syncedAt || resources?.[player]?.cloudSyncedAt || "";
    const synced = Boolean(syncedAt);
    const stale = synced && Date.now() - Date.parse(syncedAt) > 7 * 24 * 60 * 60 * 1000;
    const itemCount = Number(row.itemCount || row.matchedCatalogItems || 0);
    const title = synced
      ? `${user}: last database snapshot saved ${formatFullDate(syncedAt)}${itemCount ? ` with ${itemCount} catalog item(s).` : "."}`
      : `${user}: no cloud database snapshot has been loaded yet.`;
    const value = synced ? `<small>${formatShortDate(syncedAt)}</small>` : `<small>No DB sync</small>`;
    return `<article class="summary-card cloud-card ${stale ? "is-stale" : synced ? "is-fresh" : "is-empty"}" title="${escapeAttr(title)}"><strong><img src="assets/dim-icons/dim_sync.svg" alt="" width="18" height="18" loading="lazy" decoding="async" aria-hidden="true" />${value}</strong><span>${user} DB last sync</span><div class="progress-track"><div class="progress-fill" style="width:${synced ? stale ? 55 : 100 : 0}%"></div></div></article>`;
  }

  function flattenWeaponRows() {
    return (CATALOG.weapons || []).flatMap(item => playerList().map(player => ({ item, player, ...(state.weapons[item.id]?.[player] || blankWeapon()) })));
  }

  function flattenArmorRows() {
    return armorClasses().flatMap(className =>
      armorClassVisible(className) ?
      (CATALOG.armor[className] || []).flatMap(item => armorPlayersForClass(className).map(player => ({ className, item, player, ...(state.armor[className]?.[item.id]?.[player] || blankArmor()) })))
      : []
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
    const metaBadges = priorityBadges(item, visiblePlayers, visibleStates.every(row => row.owned));
    const hasCat = weaponHasCatalyst(item);
    const playerRows = visiblePlayers.map(player => {
      const s = state.weapons[item.id]?.[player] || blankWeapon();
      return `<div class="status-grid status-row"><div class="player-label">${BASE.users[player]?.short || player}</div>${statusCell(s.owned, "Owned", "Not owned")}${hasCat ? statusCell(s.catalyst, "Catalyst obtained", "Catalyst missing", s.owned ? "" : "dim") : neutralStatusCell("No catalyst for this weapon")}${hasCat ? statusCell(s.complete, "Catalyst complete", "Catalyst incomplete", s.owned ? "" : "dim") : neutralStatusCell("No catalyst completion for this weapon")}</div>`;
    }).join("");

    const tileTitle = `${item.name} - ${item.slot || "Weapon"} ${item.type || ""}. ${ownedCount}/${visibleStates.length} selected player(s) own it. Click for more info.`;
    const actionAttrs = isSimpleMode() ? ` tabindex="0" role="button" aria-label="${escapeAttr(tileTitle)}"` : "";
    return `<article class="weapon-card ${cardClass}"${actionAttrs} data-id="${item.id}" data-help-id="${item.id}" title="${escapeAttr(tileTitle)}"><div class="item-meta item-with-icon">${itemIconMarkup(item, eagerIcon)}${simpleDamageIcons(item.element)}<div><div class="item-name"><h3>${item.name}</h3>${metaBadges}</div><div class="badge-row">${kindBadge("weapon")}${slotBadge(item.slot)}${weaponTypeBadge(item.type)}${elementBadge(item.element)}${sourceBadge(item)}</div></div></div><div><div class="status-grid header"><span></span><span>Own</span><span>Cat</span><span>Done</span></div>${playerRows}</div></article>`;
  }

  function renderArmor(className, root, section) {
    if (!root || !CATALOG.armor?.[className]) return;
    const visibleClass = armorClassVisible(className);
    if (section) section.hidden = !visibleClass;
    if (!visibleClass) {
      root.innerHTML = "";
      updateArmorSectionCount(className);
      return;
    }
    const visible = sortedItems((CATALOG.armor[className] || []).filter(item => matchesText(item) && matchesArmorView(className, item)), { kind: "armor", className, players: armorPlayersForClass(className) });
    updateArmorSectionCount(className);
    const visibleClasses = armorClasses().filter(armorClassVisible);
    const totalVisible = visibleClasses.reduce((sum, klass) => sum + (CATALOG.armor[klass] || []).filter(item => matchesText(item) && matchesArmorView(klass, item)).length, 0);
    const total = visibleClasses.reduce((sum, klass) => sum + (CATALOG.armor[klass] || []).length, 0);
    if (els.armorCount) els.armorCount.textContent = `${totalVisible} / ${total}`;
    root.innerHTML = visible.length ? visible.map((item, index) => renderArmorCard(className, item, index < 16)).join("") : emptyState(`No ${className} armor matches this filter.`);
  }

  function renderArmorCard(className, item, eagerIcon = false) {
    const focusPlayer = CLASS_FOCUS[className] || players[0];
    const visiblePlayers = armorPlayersForClass(className);
    const visibleStates = visiblePlayers.map(player => state.armor[className]?.[item.id]?.[player] || blankArmor());
    const cardClass = visibleStates.some(row => row.owned) ? "is-owned" : "is-missing";
    const metaBadges = priorityBadges(item, visiblePlayers, visibleStates.every(row => row.owned));
    const playerRows = visiblePlayers.map(player => {
      const s = state.armor[className]?.[item.id]?.[player] || blankArmor();
      const isFocus = player === focusPlayer;
      return `<div class="armor-status status-row"><div class="player-label ${isFocus ? "is-focus" : ""}">${BASE.users[player]?.short || player}</div>${statusCell(s.owned, "Owned", "Not owned")}</div>`;
    }).join("");

    const ownedCount = visibleStates.filter(row => row.owned).length;
    const tileTitle = `${item.name} - ${focusLabel(className)} ${item.slot || "armor"}. ${ownedCount}/${visibleStates.length} selected player(s) own it. Click for more info.`;
    const actionAttrs = isSimpleMode() ? ` tabindex="0" role="button" aria-label="${escapeAttr(tileTitle)}"` : "";
    return `<article class="armor-card is-focus-card ${cardClass}"${actionAttrs} data-id="${item.id}" data-help-id="${item.id}" title="${escapeAttr(tileTitle)}"><div class="item-meta item-with-icon">${itemIconMarkup(item, eagerIcon)}<div><div class="item-name"><h3>${item.name}</h3>${metaBadges}</div><div class="badge-row">${kindBadge("armor")}${armorClassBadge(className)}${slotBadge(item.slot)}${sourceBadge(item)}</div></div></div><div class="armor-status header"><span></span><span>Own</span></div>${playerRows}</article>`;
  }

  function updateArmorSectionCount(className) {
    const player = CLASS_FOCUS[className] || players[0];
    const total = (CATALOG.armor[className] || []).length;
    const owned = (CATALOG.armor[className] || []).filter(item => state.armor[className]?.[item.id]?.[player]?.owned).length;
    const target = className === "warlock" ? els.aresArmorCount : className === "titan" ? els.iceeArmorCount : null;
    if (target) target.textContent = armorClassVisible(className) ? `${owned}/${total} unlocked` : "";
  }

  function hasRahoolMaterials(player) {
    const row = resources?.[player] || {};
    return Number(row.exoticCiphers || 0) >= 1 && Number(row.exoticEngrams || 0) >= 1;
  }

  function rahoolReady(item, visiblePlayers = playerList()) {
    return Boolean(item.priority?.rahool && visiblePlayers.some(player => hasRahoolMaterials(player)));
  }

  function xurHasItem(itemId) {
    return Boolean(xurStock?.active && Array.isArray(xurStock.itemIds) && xurStock.itemIds.includes(itemId));
  }

  function priorityBadges(item, visiblePlayers, owned = false) {
    const xurAvailable = xurHasItem(item.id);
    const isArmor = !item.type && item.slot && !["kinetic", "energy", "power"].includes(String(item.slot).toLowerCase());
    const tags = [...(item.priority?.tags || [])].filter(tag => !(isArmor && xurAvailable && tag.id === "rahool"));
    if (xurAvailable) {
      const checkedAt = xurStock?.checkedAt ? ` Checked ${formatShortDate(xurStock.checkedAt)}.` : "";
      const title = isArmor
        ? `Xur has this armor at the Tower during the current weekend visit. This is preferred over Rahool because it is usually cheaper.${checkedAt}`
        : `Xur has this item at the Tower during the current weekend visit.${checkedAt}`;
      tags.unshift({ id: "xur", label: "Xur", title });
    }
    if (!owned && rahoolReady(item, visiblePlayers) && !(isArmor && xurAvailable)) {
      tags.unshift({ id: "buy", label: "Buy now", title: "Logged-in player has at least 1 Exotic Cipher and 1 Exotic Engram for Rahool focusing." });
    }
    if (!tags.length) return "";
    return `<span class="priority-tags">${tags.slice(0, 5).map(tag => `<span class="priority-chip ${escapeAttr(tag.id)}" title="${escapeAttr(tag.title || tag.label)}" aria-label="${escapeAttr(tag.title || tag.label)}">${tagIcon(tag.id)}</span>`).join("")}</span>`;
  }

  function manifestSource(item) {
    const sourceStrings = COLLECTIBLES.items?.[item.id]?.sourceStrings || [];
    return sourceStrings.length ? sourceStrings.join(" / ") : "";
  }

  function cleanSource(value) {
    return String(value || "").replace(/^Source:\s*/i, "").trim();
  }

  function sourceBadge(item) {
    const bungie = cleanSource(manifestSource(item) || item.bungieSource || "");
    const catalog = cleanSource(item.source || "");
    const label = bungie || catalog;
    if (!label) return "";
    const title = bungie && catalog && bungie.toLowerCase() !== catalog.toLowerCase()
      ? `Bungie: ${bungie} / Catalog: ${catalog}`
      : bungie
        ? `Bungie: ${bungie}`
        : `Catalog: ${catalog}`;
    return `<span class="badge source ${bungie ? "is-bungie" : "is-catalog"}" title="${escapeAttr(title)}">${escapeAttr(label)}</span>`;
  }

  function tagIcon(id) {
    const icons = {
      must: dimIcon("dim_thumb_up.svg", "Must-have priority"),
      easy: dimIcon("dim_check.svg", "Easy win"),
      final: dimIcon("dim_masterwork_hammer.svg", "Final update catalyst priority"),
      rahool: dimIcon("dim_engram.svg", "Rahool focusing source"),
      buy: dimIcon("dim_shopping_cart.svg", "Buy now"),
      xur: dimIcon("dim_star.svg", "Xur has this item"),
      "difficulty-easy": dimIcon("difficulty_easy.svg", "Easy difficulty"),
      "difficulty-normal": dimIcon("difficulty_normal.svg", "Normal difficulty"),
      "difficulty-difficult": dimIcon("difficulty_difficult.svg", "Difficult acquisition"),
      "difficulty-impossible": dimIcon("difficulty_impossible.svg", "Highest effort acquisition"),
      confidence: dimIcon("dim_exclamation_triangle.svg", "Lower confidence note")
    };
    return icons[id] || dimIcon("dim_bookmark.svg", "Tagged item");
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
    if (key.includes("warlock")) return dimIcon("class_warlock.png", "Warlock class");
    if (key.includes("titan")) return dimIcon("class_titan.png", "Titan class");
    if (key.includes("hunter")) return dimIcon("class_hunter.png", "Hunter class");
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 20 12 12 20 4 12 12 4Z"/></svg>`;
  }

  function slotIcon(slot) {
    const key = String(slot || "").toLowerCase();
    if (key.includes("kinetic")) return dimIcon("damage_kinetic.svg", "Kinetic weapon slot");
    if (key.includes("energy")) return dimIcon("energy_weapon.svg", "Energy weapon slot");
    if (key.includes("power")) return dimIcon("power_weapon.svg", "Power weapon slot");
    if (key.includes("helmet")) return dimIcon("armor_helmet.svg", "Helmet armor slot");
    if (key.includes("gauntlet") || key.includes("glove") || key.includes("arm")) return dimIcon("armor_gauntlets.svg", "Gauntlets armor slot");
    if (key.includes("chest")) return dimIcon("armor_chest.svg", "Chest armor slot");
    if (key.includes("leg") || key.includes("boot")) return dimIcon("armor_legs.svg", "Leg armor slot");
    if (key.includes("class") || key.includes("bond") || key.includes("cloak") || key.includes("mark")) return dimIcon("armor_class.svg", "Class item armor slot");
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 20 12 12 20 4 12 12 4Z"/></svg>`;
  }

  function weaponTypeIcon(type) {
    const key = typeKey(type);
    const icons = {
      "auto-rifle": "auto_rifle.svg",
      "combat-bow": "bow.svg",
      "fusion-rifle": "fusion_rifle.svg",
      "glaive": "glaive.svg",
      "grenade-launcher": "grenade_launcher.svg",
      "hand-cannon": "hand_cannon.svg",
      "linear-fusion-rifle": "fusion_rifle.svg",
      "machine-gun": "machinegun.svg",
      "pulse-rifle": "pulse_rifle.svg",
      "rocket-launcher": "rocket_launcher.svg",
      "scout-rifle": "scout_rifle.svg",
      "shotgun": "shotgun.svg",
      "sidearm": "sidearm.svg",
      "sniper-rifle": "sniper_rifle.svg",
      "smg": "smg.svg",
      "submachine-gun": "smg.svg",
      "sword": "sword_heavy.svg",
      "trace-rifle": "trace_rifle.svg",
      "weapon": "vault_weapons.svg"
    };
    return dimIcon(icons[key] || "vault_weapons.svg", `${titleCase(type)} weapon type`);
  }

  function typeKey(type) {
    return String(type || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function dimIcon(filename, label) {
    return `<img class="dim-icon" src="assets/dim-icons/${escapeAttr(filename)}" alt="" title="${escapeAttr(label)}" width="18" height="18" loading="lazy" decoding="async" aria-hidden="true" />`;
  }

  function titleCase(value) {
    return String(value || "").trim().toLowerCase().replace(/\b[a-z0-9]/g, char => char.toUpperCase());
  }

  function formatShortDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "unknown";
    return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function formatRelativeTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "recently";
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const abs = Math.abs(seconds);
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    if (abs < 60) return rtf.format(seconds, "second");
    const minutes = Math.round(seconds / 60);
    if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
    const days = Math.round(hours / 24);
    if (Math.abs(days) < 30) return rtf.format(days, "day");
    return formatShortDate(value);
  }

  function formatFullDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "unknown date";
    return date.toLocaleString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
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
    const icon = value ? dimIcon("dim_check.svg", label) : dimIcon("dim_times.svg", label);
    return `<div class="status-cell ${value ? "yes" : "no"} ${extraClass}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}"><span class="status-mark" aria-hidden="true">${icon}</span></div>`;
  }

  function neutralStatusCell(title) {
    return `<div class="status-cell idle" title="${escapeAttr(title)}" aria-label="${escapeAttr(title)}"><span class="status-mark" aria-hidden="true">${dimIcon("dim_times_circle.svg", title)}</span></div>`;
  }

  function feedIconForItem(item) {
    const raw = item?.icon || item?.iconUrl || ICON_MAP?.[item?.id] || "";
    return raw && raw.startsWith("/") ? `https://www.bungie.net${raw}` : raw;
  }

  function catalystFeedInfo(item, payload = {}) {
    const detail = payload.catalystDetails?.[item.id] || {};
    const raw = detail.icon || "";
    return {
      itemName: detail.name || `${item.name} Catalyst`,
      icon: raw && raw.startsWith("/") ? `https://www.bungie.net${raw}` : raw || feedIconForItem(item)
    };
  }

  function claimFeedTitle(entry) {
    const user = BASE.users?.[entry.player]?.display || BASE.users?.[entry.player]?.label || titleCase(entry.player);
    const action = entry.type === "catalyst"
      ? "catalyst obtained"
      : entry.type === "complete"
        ? "catalyst completed"
        : entry.kind === "armor"
          ? "armor claimed"
          : "weapon claimed";
    return `${user} ${action}`;
  }

  function addClaimFeedEvents(events = [], payload = {}) {
    if (!events.length) return;
    const at = payload.cloudSyncedAt || payload.syncedAt || new Date().toISOString();
    const next = events.map((event, index) => ({
      id: `${Date.now()}-${index}-${event.player}-${event.itemId}-${event.type}`,
      at,
      ...event
    }));
    saveClaimFeed([...next, ...claimFeed].slice(0, 80));
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
    if (!payload.preserveActivePlayer) saveActivePlayer(player);

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
    const feedEvents = [];

    if (payload.resourceCounts) {
      const resourceSyncedAt = payload.cloudSyncedAt || payload.syncedAt || new Date().toISOString();
      saveResources({
        ...resources,
        [player]: {
          ...(resources?.[player] || {}),
          ...payload.resourceCounts,
          updatedAt: resourceSyncedAt,
          cloudSyncedAt: payload.cloudSyncedAt || payload.syncedAt || resources?.[player]?.cloudSyncedAt || ""
        }
      });
    }

    (CATALOG.weapons || []).forEach(item => {
      const matched = itemIds.has(item.id) || itemNames.has(normalizeItemName(item.name));
      const row = state.weapons[item.id]?.[player];
      if (!row) return;
      if (matched) {
        matchedItems += 1;
        if (!row.owned) {
          weaponsChanged += 1;
          feedEvents.push({ player, kind: "weapon", type: "owned", itemId: item.id, itemName: item.name, icon: feedIconForItem(item) });
        }
        row.owned = true;
      }
      if (catalystItemIds.has(item.id) && !row.catalyst) {
        catalystsChanged += 1;
        const catalyst = catalystFeedInfo(item, payload);
        feedEvents.push({ player, kind: "weapon", type: "catalyst", itemId: item.id, itemName: catalyst.itemName, icon: catalyst.icon });
        row.catalyst = true;
      }
      if (completeItemIds.has(item.id) && !row.complete) {
        completedChanged += 1;
        const catalyst = catalystFeedInfo(item, payload);
        feedEvents.push({ player, kind: "weapon", type: "complete", itemId: item.id, itemName: catalyst.itemName, icon: catalyst.icon });
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
        if (!row.owned) {
          armorChanged += 1;
          feedEvents.push({ player, kind: "armor", type: "owned", className, itemId: item.id, itemName: item.name, icon: feedIconForItem(item) });
        }
        row.owned = true;
      });
    });

    if (weaponsChanged || armorChanged || catalystsChanged || completedChanged) saveLocalOwnership();
    addClaimFeedEvents(feedEvents, payload);
    const result = { ok: true, player, weaponsChanged, armorChanged, catalystsChanged, completedChanged, matchedItems, savedLocalOwnership: true };
    if (!payload.suppressRender) render();
    if (!payload.suppressEvent) document.dispatchEvent(new CustomEvent("d2collections:ownership-applied", { detail: result }));
    return result;
  }

  function recordCloudSnapshots(snapshots = [], options = {}) {
    const nextResources = { ...resources };
    const nextCloudMeta = { ...(cloudMeta || {}), players: { ...(cloudMeta?.players || {}) }, loadedAt: new Date().toISOString() };
    snapshots.forEach(snapshot => {
      const player = snapshot?.player || snapshot?.liveSync?.player;
      if (!player || !players.includes(player)) return;
      const syncedAt = snapshot.syncedAt || snapshot.liveSync?.syncedAt || "";
      const resourceCounts = snapshot.resourceCounts || snapshot.liveSync?.resourceCounts;
      nextCloudMeta.players[player] = {
        ...(nextCloudMeta.players[player] || {}),
        syncedAt,
        displayName: snapshot.displayName || snapshot.liveSync?.displayName || "",
        itemCount: snapshot.itemCount || snapshot.liveSync?.matchedCatalogItems || 0,
        matchedCatalogItems: snapshot.liveSync?.matchedCatalogItems || 0,
        source: "cloud"
      };
      if (resourceCounts) {
        nextResources[player] = {
          ...(nextResources[player] || {}),
          ...resourceCounts,
          updatedAt: syncedAt || new Date().toISOString(),
          cloudSyncedAt: syncedAt
        };
      }
    });
    saveResources(nextResources);
    saveCloudMeta(nextCloudMeta);
    if (!options.suppressRender) render();
  }

  function applyXurInventory(payload = {}) {
    const next = {
      active: Boolean(payload.active && payload.ok),
      location: payload.location || "Tower",
      checkedAt: payload.checkedAt || new Date().toISOString(),
      itemIds: [...new Set((payload.itemIds || []).map(String).filter(Boolean))],
      itemNames: [...new Set((payload.itemNames || []).map(String).filter(Boolean))],
      saleItemHashes: [...new Set((payload.saleItemHashes || []).map(String).filter(Boolean))],
      unmatchedItems: (payload.unmatchedItems || []).slice(0, 20),
      reason: payload.reason || ""
    };
    saveXurStock(next);
    render();
    document.dispatchEvent(new CustomEvent("d2collections:xur-updated", { detail: next }));
    return next;
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
    if (!els.search) return;
    const isFind = event.key.toLowerCase() === "f" && (event.ctrlKey || event.metaKey) && !event.altKey;
    const isSlash = event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey;
    if (!isFind && !isSlash) return;
    if (shouldKeepNativeFind(event)) return;
    event.preventDefault();
    els.search.focus({ preventScroll: true });
    els.search.select();
  }

  window.D2_COLLECTIONS_APP = {
    applyCollectionOwnership,
    recordCloudSnapshots,
    applyXurInventory,
    exportState,
    getState: () => clone(state),
    render
  };

  if (els.search) els.search.addEventListener("input", event => { filters.search = event.target.value; scheduleRender(); });
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
  if (els.clearClaimFeedBtn) els.clearClaimFeedBtn.addEventListener("click", () => {
    saveClaimFeed([]);
    renderClaimFeed();
  });
  if (els.claimFeedList) els.claimFeedList.addEventListener("click", event => {
    const button = event.target?.closest?.("[data-feed-dismiss]");
    if (!button) return;
    const id = button.dataset.feedDismiss;
    saveClaimFeed(claimFeed.filter(entry => entry.id !== id));
    renderClaimFeed();
  });
  if (els.loginBtn) els.loginBtn.addEventListener("click", () => { window.location.href = buildAuthUrl(); });
  document.addEventListener("keydown", focusSiteSearch);
  document.addEventListener("d2collections:layout-mode-changed", render);

  captureOAuthCode();
  render();
  setInterval(renderClaimFeed, 60000);
})();
