(() => {
  const CATALOG = window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: { warlock: [], titan: [] } };
  const BASE = window.D2_COLLECTIONS_CHECKLIST || { users: {}, weapons: {}, armor: { warlock: {}, titan: {} } };
  const BUNGIE = window.D2_BUNGIE_CONFIG || {};
  const AUTH_STORAGE_KEY = "d2-collections-auth-v1";
  const ICON_CACHE_KEY = "d2-collections-icon-cache-v1";
  const CLASS_FOCUS = { warlock: "corey", titan: "matt" };
  const players = Object.keys(BASE.users || { corey: {}, matt: {} });

  const blankWeapon = () => ({ owned: false, catalyst: false, complete: false });
  const blankArmor = () => ({ owned: false });
  const clone = value => JSON.parse(JSON.stringify(value));

  let filters = { search: "", view: "all", player: "all" };
  let state = mergeState(clone(BASE));
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
    clearApiBtn: document.querySelector("#clearApiBtn"),
    oauthNote: document.querySelector("#oauthNote")
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
    merged.armor = merged.armor || { warlock: {}, titan: {} };
    merged.armor.warlock = merged.armor.warlock || {};
    merged.armor.titan = merged.armor.titan || {};
    hydrateDefaults(merged);
    return merged;
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

  function allCatalogItems() {
    return [...CATALOG.weapons, ...CATALOG.armor.warlock, ...CATALOG.armor.titan];
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
    return true;
  }

  function matchesArmorView(className, item) {
    const rows = armorPlayersForClass(className).map(player => state.armor[className]?.[item.id]?.[player] || blankArmor());
    if (filters.view === "missing") return rows.some(row => !row.owned);
    if (filters.view === "catalysts") return false;
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
    const weaponRows = flattenWeaponRows();
    const armorRows = flattenArmorRows();
    const ownedWeapons = weaponRows.filter(row => row.owned).length;
    const catalystOwned = weaponRows.filter(row => row.catalyst).length;
    const catalystDone = weaponRows.filter(row => row.complete).length;
    const ownedArmor = armorRows.filter(row => row.owned).length;

    els.summary.innerHTML = [
      metric("Weapons owned", ownedWeapons, weaponRows.length, "Corey + Matt"),
      metric("Catalysts owned", catalystOwned, weaponRows.length, "Obtained catalysts"),
      metric("Catalysts complete", catalystDone, weaponRows.length, "Finished catalysts"),
      metric("Armor owned", ownedArmor, armorRows.length, "Corey WL + Matt Titan")
    ].join("");
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
      return `<div class="status-grid status-row">
        <div class="player-label">${BASE.users[player]?.short || player}</div>
        ${statusCell(s.owned, "Owned", "Not owned")}
        ${statusCell(s.catalyst, "Catalyst obtained", "Catalyst missing", s.owned ? "" : "dim")}
        ${statusCell(s.complete, "Catalyst complete", "Catalyst incomplete", s.owned ? "" : "dim")}
      </div>`;
    }).join("");

    return `<article class="weapon-card" data-id="${item.id}">
      <div class="item-meta item-with-icon">
        ${itemIconMarkup(item)}
        <div>
          <div class="item-name"><h3>${item.name}</h3></div>
          <div class="badge-row">
            <span class="badge ${item.slot.toLowerCase()}">${item.slot}</span>
            <span class="badge slot">${item.type}</span>
            <span class="badge">${item.element}</span>
            <span class="badge source">${item.source}</span>
          </div>
        </div>
      </div>
      <div>
        <div class="status-grid header"><span></span><span>Own</span><span>Cat</span><span>Done</span></div>
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
      return `<div class="armor-status status-row">
        <div class="player-label ${isFocus ? "is-focus" : ""}">${BASE.users[player]?.short || player}</div>
        ${statusCell(s.owned, "Owned", "Not owned")}
      </div>`;
    }).join("");

    return `<article class="armor-card is-focus-card" data-id="${item.id}">
      <div class="item-meta item-with-icon">
        ${itemIconMarkup(item)}
        <div>
          <div class="item-name"><h3>${item.name}</h3></div>
          <div class="badge-row">
            <span class="badge focus">${focusLabel(className)}</span>
            <span class="badge slot">${item.slot}</span>
            <span class="badge source">${item.source}</span>
          </div>
        </div>
      </div>
      <div class="armor-status header"><span></span><span>Own</span></div>
      ${playerRows}
    </article>`;
  }

  function statusCell(value, yesTitle, noTitle, extraClass = "") {
    return `<div class="status-cell ${value ? "yes" : "no"} ${extraClass}" title="${value ? yesTitle : noTitle}">${value ? "✅" : "⛔"}</div>`;
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

  function normalizeName(name) {
    return String(name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/gi, " ")
      .trim()
      .toLowerCase();
  }

  function applyIconMap(iconMap) {
    allCatalogItems().forEach(item => {
      const icon = iconMap[item.id] || iconMap[normalizeName(item.name)];
      if (icon) item.icon = icon;
    });
  }

  function applyCachedIcons() {
    try {
      const raw = localStorage.getItem(ICON_CACHE_KEY);
      const cached = raw ? JSON.parse(raw) : null;
      if (cached?.icons) applyIconMap(cached.icons);
    } catch {}
  }

  async function loadManifestIcons() {
    try {
      const manifestResponse = await fetch(`${BUNGIE.apiRoot || "https://www.bungie.net/Platform"}/Destiny2/Manifest/`);
      const manifestJson = await manifestResponse.json();
      const response = manifestJson.Response || manifestJson.response || manifestJson;
      const version = response.version || "unknown";
      const cachedRaw = localStorage.getItem(ICON_CACHE_KEY);
      const cached = cachedRaw ? JSON.parse(cachedRaw) : null;
      if (cached?.version === version && cached?.icons) return;

      const paths = response.jsonWorldComponentContentPaths || response.jsonWorldContentPaths || {};
      const langPaths = paths.en || paths[Object.keys(paths)[0]] || {};
      const inventoryPath = langPaths.DestinyInventoryItemDefinition;
      if (!inventoryPath) return;

      const definitionUrl = inventoryPath.startsWith("http") ? inventoryPath : `https://www.bungie.net${inventoryPath}`;
      const definitions = await (await fetch(definitionUrl)).json();
      const wantedByName = new Map(allCatalogItems().map(item => [normalizeName(item.name), item]));
      const icons = {};

      Object.values(definitions).forEach(def => {
        const display = def.displayProperties || {};
        if (!display.name || !display.icon) return;
        const match = wantedByName.get(normalizeName(display.name));
        if (!match || icons[match.id]) return;
        icons[match.id] = display.icon;
      });

      if (Object.keys(icons).length) {
        localStorage.setItem(ICON_CACHE_KEY, JSON.stringify({ version, icons, savedAt: new Date().toISOString() }));
        applyIconMap(icons);
        render();
      }
    } catch (error) {
      console.warn("D2 Collections icon manifest load failed", error);
    }
  }

  function emptyState(text) {
    return `<div class="empty-state">${text}</div>`;
  }

  function exportState() {
    hydrateDefaults(state);
    const output = JSON.stringify(state, null, 2);
    els.exportBox.value = output;
    navigator.clipboard?.writeText(output).catch(() => {});
  }

  function renderAuthPanel() {
    if (!els.apiStatus) return;
    const hasCode = Boolean(authState.oauthCode);
    els.apiStatus.textContent = hasCode ? "Signed in code captured" : "Not signed in";
    if (els.oauthNote) {
      els.oauthNote.textContent = hasCode
        ? "Sign-in returned a code and saved it locally. Collection import is the next pass."
        : "No setup needed here. Use the sign-in button; the collection board remains repo-backed.";
    }
  }

  function buildAuthUrl() {
    const clientId = BUNGIE.clientId || "53180";
    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    const params = new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: redirectUri });
    return `${BUNGIE.authUrl || "https://www.bungie.net/en/OAuth/Authorize"}?${params.toString()}`;
  }

  function captureOAuthCode() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (!code) return;
    authState.oauthCode = code;
    authState.lastSaved = new Date().toISOString();
    saveAuthState(authState);
    url.searchParams.delete("code");
    window.history.replaceState({}, document.title, url.toString());
  }

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
  if (els.loginBtn) els.loginBtn.addEventListener("click", () => { window.location.href = buildAuthUrl(); });
  if (els.clearApiBtn) els.clearApiBtn.addEventListener("click", () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    authState = readAuthState();
    renderAuthPanel();
  });

  applyCachedIcons();
  captureOAuthCode();
  render();
  loadManifestIcons();
})();
