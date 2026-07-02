(() => {
  window.D2_COLLECTIONS_ARMOR_COLUMNS_ACTIVE = true;
  const CATALOG = window.D2_COLLECTIONS_CATALOG || { armor: {} };
  const CHECKLIST = window.D2_COLLECTIONS_CHECKLIST || { users: {}, armor: {} };
  const COLLECTIBLES = window.D2_COLLECTIONS_BUNGIE_COLLECTIBLES || { items: {} };
  const UI_ICONS = window.D2_COLLECTIONS_UI_ICONS || { game: {}, dim: {} };
  const STORAGE_KEY = "d2-collections-armor-columns-v1";
  const RESOURCE_KEY = "d2-collections-player-resources-v1";
  const XUR_STOCK_KEY = "d2-collections-xur-stock-v1";
  const DEFAULTS = {
    left: { player: "corey", className: "warlock" },
    right: { player: "matt", className: "titan" }
  };
  const CLASS_LABELS = { warlock: "Warlock", titan: "Titan", hunter: "Hunter" };
  const SLOT_ORDER = { Helmet: 1, Gauntlets: 2, Chest: 3, Legs: 4, "Class Item": 5 };
  let config = readConfig();
  const sortedArmorCache = new Map();
  const itemSearchTextCache = new WeakMap();

  const css = `
    .armor-column-controls{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}.armor-column-controls.is-single-player{grid-template-columns:1fr}.armor-control{border:1px solid var(--line-strong);background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));border-radius:8px;padding:9px;display:grid;grid-template-columns:1fr 1fr;gap:8px}.armor-control[hidden]{display:none}.armor-control label{display:grid;gap:4px;color:var(--muted);font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.armor-control select{width:100%;border:1px solid var(--line);border-radius:7px;background:rgba(0,0,0,.28);color:var(--text);padding:7px 8px;outline:none}.armor-columns.is-single-player,html.layout-shelf .armor-columns.is-single-player,html.layout-simple .armor-columns.is-single-player{grid-template-columns:1fr}.armor-columns.is-single-player .armor-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:10px}.armor-card{grid-template-columns:minmax(0,1fr) auto;align-items:center;padding:7px 9px;min-height:54px}.armor-card .item-with-icon{grid-template-columns:34px minmax(0,1fr);gap:8px}.armor-card .item-icon,.armor-card .item-icon-fallback{width:34px;height:34px;border-radius:6px}.armor-card .badge.source,.armor-card .badge.focus{display:none}.armor-card .item-name{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;margin-bottom:3px}.armor-card h3{font-size:.88rem;margin-bottom:0}.armor-card .priority-tags{margin:2px 0 4px}.armor-card .badge.slot{font-size:.68rem;padding:2px 7px;display:inline-flex;align-items:center;gap:4px}.armor-card .badge.slot .dim-icon{width:14px;height:14px}.armor-card .armor-status.header{display:none}.armor-card .status-row{grid-column:2;grid-row:1;margin-top:0;align-self:center}.armor-card .player-label{display:none}.armor-card .status-cell{min-height:32px;min-width:44px;padding:0 8px;cursor:help}.armor-status{grid-template-columns:minmax(44px,58px);gap:0}.armor-columns.is-single-player .armor-card{grid-template-columns:minmax(0,1fr) minmax(58px,auto);min-height:64px;padding:9px 10px}.armor-columns.is-single-player .armor-card .item-with-icon{grid-template-columns:44px minmax(0,1fr);gap:10px}.armor-columns.is-single-player .armor-card .item-icon,.armor-columns.is-single-player .armor-card .item-icon-fallback{width:44px;height:44px}.armor-columns.is-single-player .armor-card h3{font-size:.95rem}.armor-columns.is-single-player .armor-card .badge.source{display:inline-flex;max-width:190px}.armor-columns.is-single-player .armor-card .badge-row{flex-wrap:nowrap;overflow:hidden}.class-title.hunter span{color:var(--green)}@media(max-width:1180px){.armor-columns.is-single-player .armor-list{grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}}@media(max-width:780px){.armor-column-controls{grid-template-columns:1fr}.armor-control{grid-template-columns:1fr 1fr}.armor-card{min-height:50px}.armor-status{grid-template-columns:minmax(42px,54px)}.armor-columns.is-single-player .armor-list{grid-template-columns:1fr}.armor-columns.is-single-player .armor-card{min-height:58px}.armor-columns.is-single-player .armor-card .badge.source{display:none}}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  function readConfig() {
    try {
      return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")) };
    } catch {
      return structuredClone(DEFAULTS);
    }
  }

  function saveConfig() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  function liveState() {
    return window.D2_COLLECTIONS_APP?.getState?.() || CHECKLIST;
  }

  function userName(id, mode = "label") {
    const user = CHECKLIST.users?.[id] || {};
    if (mode === "full") return user.full || `${user.label || id}${user.handle ? ` (${user.handle})` : ""}`;
    if (mode === "short") return user.short || user.label || id;
    return user.display || user.label || id;
  }

  function playerOptions(selected) {
    return Object.keys(CHECKLIST.users || { corey: {}, matt: {} })
      .map(id => `<option value="${id}" ${id === selected ? "selected" : ""}>${userName(id, "full")}</option>`).join("");
  }

  function classOptions(selected) {
    return Object.keys(CATALOG.armor || {})
      .map(id => `<option value="${id}" ${id === selected ? "selected" : ""}>${CLASS_LABELS[id] || id}</option>`).join("");
  }

  function ensureControls() {
    const columns = document.querySelector(".armor-columns");
    if (!columns || document.querySelector(".armor-column-controls")) return;
    const controls = document.createElement("div");
    controls.className = "armor-column-controls";
    controls.innerHTML = ["left", "right"].map(side => `<div class="armor-control" data-side="${side}"><label>${side} player<select data-field="player">${playerOptions(config[side].player)}</select></label><label>${side} class<select data-field="className">${classOptions(config[side].className)}</select></label></div>`).join("");
    columns.parentElement.insertBefore(controls, columns);
    controls.addEventListener("change", event => {
      const control = event.target.closest(".armor-control");
      if (!control) return;
      const side = control.dataset.side;
      const field = event.target.dataset.field;
      config[side][field] = event.target.value;
      saveConfig();
      renderArmorColumns();
    });
  }

  function statusCell(value, itemId) {
    const label = `${value ? "Owned" : "Not owned"} - click for unlock help`;
    const icon = value ? dimIcon("dim_check.svg", "Owned") : dimIcon("dim_times.svg", "Not owned");
    return `<div class="status-cell ${value ? "yes" : "no"}" data-help-id="${itemId}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}"><span class="status-mark" aria-hidden="true">${icon}</span></div>`;
  }
  function initials(name) { return String(name || "?").split(/\s+|-/).filter(Boolean).slice(0,2).map(p => p[0]?.toUpperCase() || "").join("") || "?"; }
  function iconMarkup(item) {
    const raw = item.icon || item.iconUrl || "";
    if (!raw) return `<div class="item-icon-fallback" aria-hidden="true">${initials(item.name)}</div>`;
    const src = raw.startsWith("/") ? `https://www.bungie.net${raw}` : raw;
    return `<img class="item-icon" src="${src}" alt="${item.name} icon" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'item-icon-fallback',textContent:'${initials(item.name)}'}))" />`;
  }

  function sortedArmorItems(className) {
    if (!sortedArmorCache.has(className)) {
      const sorted = [...(CATALOG.armor?.[className] || [])]
        .sort((a,b) => (SLOT_ORDER[a.slot] || 99) - (SLOT_ORDER[b.slot] || 99) || a.name.localeCompare(b.name));
      sortedArmorCache.set(className, sorted);
    }
    return sortedArmorCache.get(className);
  }

  function itemSearchText(item) {
    if (itemSearchTextCache.has(item)) return itemSearchTextCache.get(item);
    const text = [item.name, item.slot, manifestSource(item), item.bungieSource, item.source, item.priority?.note, ...(item.priority?.tags || []).map(tag => tag.label)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    itemSearchTextCache.set(item, text);
    return text;
  }

  function currentFilters() {
    const search = document.querySelector("#searchInput")?.value?.trim().toLowerCase() || "";
    const view = document.querySelector("[data-view].active")?.dataset.view || "all";
    const player = document.querySelector("[data-player].active")?.dataset.player || "all";
    return { search, view, player };
  }

  function getOwned(className, itemId, player) {
    return Boolean(liveState().armor?.[className]?.[itemId]?.[player]?.owned);
  }

  function readResources() {
    try {
      return JSON.parse(localStorage.getItem(RESOURCE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function hasRahoolMaterials(player) {
    const row = readResources()?.[player] || {};
    return Number(row.exoticCiphers || 0) >= 1 && Number(row.exoticEngrams || 0) >= 1;
  }

  function readXurStock() {
    try {
      return JSON.parse(localStorage.getItem(XUR_STOCK_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function xurHasItem(itemId) {
    const stock = readXurStock();
    return Boolean(stock?.active && Array.isArray(stock.itemIds) && stock.itemIds.includes(itemId));
  }

  function priorityBadges(item, player, owned) {
    const xurAvailable = xurHasItem(item.id);
    const tags = [...(item.priority?.tags || [])].filter(tag => !(xurAvailable && tag.id === "rahool"));
    if (xurAvailable) {
      tags.unshift({ id: "xur", label: "Xur", title: "Xur has this armor at the Tower during the current weekend visit. This is preferred over Rahool because it is usually cheaper." });
    }
    if (!owned && item.priority?.rahool && hasRahoolMaterials(player) && !xurAvailable) {
      tags.unshift({ id: "buy", label: "Buy now", title: "Logged-in player has at least 1 Exotic Cipher and 1 Exotic Engram for Rahool focusing." });
    }
    if (!tags.length) return "";
    return `<span class="priority-tags">${tags.slice(0, 4).map(tag => `<span class="priority-chip ${escapeAttr(tag.id)}" title="${escapeAttr(tag.title || tag.label)}" aria-label="${escapeAttr(tag.title || tag.label)}">${tagIcon(tag.id)}</span>`).join("")}</span>`;
  }

  function needsArmorAction(item, player, owned) {
    return !owned && Boolean(item.priority?.mustHave || item.priority?.easyWin || (item.priority?.rahool && hasRahoolMaterials(player)));
  }

  function tagIcon(id) {
    const icons = {
      must: uiGlyph(UI_ICONS.dim?.must, "Must-have priority"),
      easy: uiGlyph(UI_ICONS.dim?.easy, "Easy win"),
      final: uiGlyph(UI_ICONS.dim?.final, "Final update catalyst priority"),
      rahool: gameIcon(UI_ICONS.game?.exoticEngram, "Rahool exotic engram focusing source"),
      buy: gameIcon(UI_ICONS.game?.exoticCipher, "Buy now: Exotic Cipher and Exotic Engram ready"),
      xur: gameIcon(UI_ICONS.game?.strangeCoin, "Xur has this item"),
      "difficulty-easy": uiGlyph(UI_ICONS.dim?.difficultyEasy, "Easy difficulty"),
      "difficulty-normal": uiGlyph(UI_ICONS.dim?.difficultyNormal, "Normal difficulty"),
      "difficulty-difficult": uiGlyph(UI_ICONS.dim?.difficultyDifficult, "Difficult acquisition"),
      "difficulty-impossible": uiGlyph(UI_ICONS.dim?.difficultyImpossible, "Highest effort acquisition"),
      confidence: uiGlyph(UI_ICONS.dim?.confidence, "Lower confidence note")
    };
    return icons[id] || uiGlyph(UI_ICONS.dim?.fallback, "Tagged item");
  }

  function dimIcon(filename, label) {
    return uiGlyph(`assets/dim-icons/${filename}`, label);
  }

  function uiGlyph(src, label) {
    return `<img class="dim-icon ui-glyph" src="${escapeAttr(src || UI_ICONS.dim?.fallback || "assets/dim-icons/dim_bookmark.svg")}" alt="" title="${escapeAttr(label)}" width="18" height="18" loading="lazy" decoding="async" aria-hidden="true" />`;
  }

  function gameIcon(src, label) {
    return `<img class="game-icon real-icon" src="${escapeAttr(src || UI_ICONS.dim?.fallback || "assets/dim-icons/dim_bookmark.svg")}" alt="" title="${escapeAttr(label)}" width="18" height="18" loading="lazy" decoding="async" aria-hidden="true" />`;
  }

  function classIcon(className) {
    const icons = {
      warlock: "class_warlock.png",
      titan: "class_titan.png",
      hunter: "class_hunter.png"
    };
    const key = String(className || "").toLowerCase();
    const filename = icons[key];
    return filename ? dimIcon(filename, `${CLASS_LABELS[key] || className} class`) : "";
  }

  function slotIcon(slot) {
    const key = String(slot || "").toLowerCase();
    if (key.includes("helmet")) return dimIcon("armor_helmet.svg", "Helmet armor slot");
    if (key.includes("gauntlet") || key.includes("glove") || key.includes("arm")) return dimIcon("armor_gauntlets.svg", "Gauntlets armor slot");
    if (key.includes("chest")) return dimIcon("armor_chest.svg", "Chest armor slot");
    if (key.includes("leg") || key.includes("boot")) return dimIcon("armor_legs.svg", "Leg armor slot");
    if (key.includes("class") || key.includes("bond") || key.includes("cloak") || key.includes("mark")) return dimIcon("armor_class.svg", "Class item armor slot");
    return "";
  }
  function renderColumn(side, rootId, titleIndex) {
    const root = document.querySelector(rootId);
    const title = document.querySelectorAll(".class-title")[titleIndex];
    if (!root || !title) return 0;
    const { player, className } = config[side];
    const playerFilter = currentFilters().player;
    const section = root.closest("article");
    const visibleSide = playerFilter === "all" || playerFilter === player;
    if (section) section.hidden = !visibleSide;
    if (!visibleSide) {
      root.innerHTML = "";
      return 0;
    }
    const klass = CLASS_LABELS[className] || className;
    title.className = `class-title ${className}`;
    title.innerHTML = `<span class="class-title-icon">${classIcon(className)}</span><strong>${userName(player, "full")} / ${klass}</strong>`;
    const { search, view } = currentFilters();
    const items = sortedArmorItems(className);
    const visible = items.filter(item => {
      const owned = getOwned(className, item.id, player);
      if (search && !itemSearchText(item).includes(search)) return false;
      if (view === "needs" && !needsArmorAction(item, player, owned)) return false;
      if (view === "missing" && owned) return false;
      if (view === "catalysts") return false;
      if (view === "priority" && !item.priority?.mustHave) return false;
      if (view === "easy" && !item.priority?.easyWin) return false;
      return true;
    });
    root.innerHTML = visible.length ? visible.map(item => {
      const owned = getOwned(className, item.id, player);
      const tileTitle = `${item.name} - ${userName(player, "full")} ${klass} ${item.slot || "armor"}. ${owned ? "Owned" : "Not owned"}. Click for more info.`;
      return `<article class="armor-card is-focus-card ${owned ? "is-owned" : "is-missing"}" data-id="${item.id}" data-help-id="${item.id}" title="${escapeAttr(tileTitle)}"><div class="item-meta item-with-icon">${iconMarkup(item)}<div><div class="item-name"><h3>${item.name}</h3><button class="item-help-btn" type="button" title="More info" data-help-id="${item.id}">i</button></div>${priorityBadges(item, player, owned)}<div class="badge-row"><span class="badge slot">${slotIcon(item.slot)}${escapeAttr(item.slot)}</span>${sourceBadge(item)}</div></div></div><div class="armor-status status-row"><div class="player-label">${userName(player, "short")}</div>${statusCell(owned, item.id)}</div></article>`;
    }).join("") : `<div class="empty-state">No ${klass} armor matches this filter.</div>`;
    return visible.length;
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

  function escapeAttr(value) {
    return String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function renderArmorColumns() {
    ensureControls();
    const { player } = currentFilters();
    const singlePlayer = player !== "all";
    const columns = document.querySelector(".armor-columns");
    const controls = document.querySelector(".armor-column-controls");
    const heading = document.querySelector(".armor-panel .panel-head h2");
    columns?.classList.toggle("is-single-player", singlePlayer);
    controls?.classList.toggle("is-single-player", singlePlayer);
    controls?.querySelectorAll(".armor-control").forEach(control => {
      const side = control.dataset.side;
      control.hidden = singlePlayer && config[side]?.player !== player;
    });
    if (heading) {
      heading.textContent = singlePlayer ? `${CHECKLIST.users?.[player]?.label || player} armor checklist` : "Two-column class checklist";
    }
    const left = renderColumn("left", "#warlockList", 0);
    const right = renderColumn("right", "#titanList", 1);
    const total = ["left", "right"].reduce((sum, side) => {
      if (player !== "all" && config[side].player !== player) return sum;
      return sum + (CATALOG.armor?.[config[side].className]?.length || 0);
    }, 0);
    const count = document.querySelector("#armorCount");
    if (count) count.textContent = `${left + right} / ${total}`;
  }

  let scheduledRender = 0;
  let scheduledSearchRender = 0;
  function scheduleArmorRender() {
    if (scheduledRender) cancelAnimationFrame(scheduledRender);
    scheduledRender = requestAnimationFrame(() => {
      scheduledRender = 0;
      renderArmorColumns();
    });
  }

  function scheduleArmorSearchRender() {
    if (scheduledSearchRender) clearTimeout(scheduledSearchRender);
    scheduledSearchRender = setTimeout(() => {
      scheduledSearchRender = 0;
      renderArmorColumns();
    }, 140);
  }

  document.addEventListener("input", event => { if (event.target?.id === "searchInput") scheduleArmorSearchRender(); });
  document.addEventListener("click", event => { if (event.target.closest("[data-view],[data-player]")) scheduleArmorRender(); });
  document.addEventListener("d2collections:ownership-applied", scheduleArmorRender);
  scheduleArmorRender();
})();
