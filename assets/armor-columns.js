(() => {
  const CATALOG = window.D2_COLLECTIONS_CATALOG || { armor: {} };
  const CHECKLIST = window.D2_COLLECTIONS_CHECKLIST || { users: {}, armor: {} };
  const STORAGE_KEY = "d2-collections-armor-columns-v1";
  const RESOURCE_KEY = "d2-collections-player-resources-v1";
  const DEFAULTS = {
    left: { player: "corey", className: "warlock" },
    right: { player: "matt", className: "titan" }
  };
  const CLASS_LABELS = { warlock: "Warlock", titan: "Titan", hunter: "Hunter" };
  const CLASS_MARKS = { warlock: "◆", titan: "◆", hunter: "◆" };
  const SLOT_ORDER = { Helmet: 1, Gauntlets: 2, Chest: 3, Legs: 4, "Class Item": 5 };
  let config = readConfig();

  const css = `
    .armor-column-controls{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}.armor-control{border:1px solid var(--line-strong);background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));border-radius:8px;padding:9px;display:grid;grid-template-columns:1fr 1fr;gap:8px}.armor-control label{display:grid;gap:4px;color:var(--muted);font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.armor-control select{width:100%;border:1px solid var(--line);border-radius:7px;background:rgba(0,0,0,.28);color:var(--text);padding:7px 8px;outline:none}.armor-card{grid-template-columns:minmax(0,1fr) auto;align-items:center;padding:7px 9px;min-height:54px}.armor-card .item-with-icon{grid-template-columns:34px minmax(0,1fr);gap:8px}.armor-card .item-icon,.armor-card .item-icon-fallback{width:34px;height:34px;border-radius:6px}.armor-card .badge.source,.armor-card .badge.focus{display:none}.armor-card .item-name{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;margin-bottom:3px}.armor-card h3{font-size:.88rem;margin-bottom:0}.armor-card .priority-tags{margin:2px 0 4px}.armor-card .badge.slot{font-size:.68rem;padding:2px 7px}.armor-card .armor-status.header{display:none}.armor-card .status-row{grid-column:2;grid-row:1;margin-top:0;align-self:center}.armor-card .player-label{display:none}.armor-card .status-cell{min-height:32px;min-width:44px;padding:0 8px;cursor:help}.armor-status{grid-template-columns:minmax(44px,58px);gap:0}.class-title.hunter span{color:var(--green)}@media(max-width:780px){.armor-column-controls{grid-template-columns:1fr}.armor-control{grid-template-columns:1fr 1fr}.armor-card{min-height:50px}.armor-status{grid-template-columns:minmax(42px,54px)}}
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
    return `<div class="status-cell ${value ? "yes" : "no"}" data-help-id="${itemId}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}"><span class="status-mark" aria-hidden="true"></span></div>`;
  }
  function initials(name) { return String(name || "?").split(/\s+|-/).filter(Boolean).slice(0,2).map(p => p[0]?.toUpperCase() || "").join("") || "?"; }
  function iconMarkup(item) {
    const raw = item.icon || item.iconUrl || "";
    if (!raw) return `<div class="item-icon-fallback" aria-hidden="true">${initials(item.name)}</div>`;
    const src = raw.startsWith("/") ? `https://www.bungie.net${raw}` : raw;
    return `<img class="item-icon" src="${src}" alt="${item.name} icon" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'item-icon-fallback',textContent:'${initials(item.name)}'}))" />`;
  }

  function currentFilters() {
    const search = document.querySelector("#searchInput")?.value?.trim().toLowerCase() || "";
    const view = document.querySelector("[data-view].active")?.dataset.view || "all";
    return { search, view };
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

  function priorityBadges(item, player, owned) {
    const tags = [...(item.priority?.tags || [])];
    if (!owned && item.priority?.rahool && hasRahoolMaterials(player)) {
      tags.unshift({ id: "buy", label: "Buy now", title: "Logged-in player has at least 1 Exotic Cipher and 1 Exotic Engram for Rahool focusing." });
    }
    if (!tags.length) return "";
    return `<span class="priority-tags">${tags.slice(0, 3).map(tag => `<span class="priority-chip ${escapeAttr(tag.id)}" title="${escapeAttr(tag.title || tag.label)}" aria-label="${escapeAttr(tag.title || tag.label)}">${tagSymbol(tag.id)}</span>`).join("")}</span>`;
  }

  function tagSymbol(id) {
    return ({ must: "⭐", easy: "✓", final: "✦", rahool: "◎", buy: "↗", confidence: "i" })[id] || "•";
  }

  function renderColumn(side, rootId, titleIndex) {
    const root = document.querySelector(rootId);
    const title = document.querySelectorAll(".class-title")[titleIndex];
    if (!root || !title) return 0;
    const { player, className } = config[side];
    const klass = CLASS_LABELS[className] || className;
    title.className = `class-title ${className}`;
    title.innerHTML = `<span>${CLASS_MARKS[className] || "◆"}</span><strong>${userName(player, "full")} / ${klass}</strong>`;
    const { search, view } = currentFilters();
    const items = [...(CATALOG.armor?.[className] || [])].sort((a,b) => (SLOT_ORDER[a.slot] || 99) - (SLOT_ORDER[b.slot] || 99) || a.name.localeCompare(b.name));
    const visible = items.filter(item => {
      const haystack = [item.name, item.slot, item.bungieSource, item.source, item.priority?.note, ...(item.priority?.tags || []).map(tag => tag.label)].join(" ").toLowerCase();
      const owned = getOwned(className, item.id, player);
      if (search && !haystack.includes(search)) return false;
      if (view === "missing" && owned) return false;
      if (view === "catalysts") return false;
      if (view === "priority" && !item.priority?.mustHave) return false;
      if (view === "easy" && !item.priority?.easyWin) return false;
      return true;
    });
    root.innerHTML = visible.length ? visible.map(item => {
      const owned = getOwned(className, item.id, player);
      const source = item.bungieSource || item.source || "";
      return `<article class="armor-card is-focus-card ${owned ? "is-owned" : "is-missing"}" data-id="${item.id}"><div class="item-meta item-with-icon">${iconMarkup(item)}<div><div class="item-name"><h3>${item.name}</h3><button class="item-help-btn" type="button" title="More info" data-help-id="${item.id}">i</button></div>${priorityBadges(item, player, owned)}<div class="badge-row"><span class="badge slot">${item.slot}</span><span class="badge source" title="${escapeAttr(source)}">${source}</span></div></div></div><div class="armor-status status-row"><div class="player-label">${userName(player, "short")}</div>${statusCell(owned, item.id)}</div></article>`;
    }).join("") : `<div class="empty-state">No ${klass} armor matches this filter.</div>`;
    return visible.length;
  }

  function escapeAttr(value) {
    return String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function renderArmorColumns() {
    ensureControls();
    const left = renderColumn("left", "#warlockList", 0);
    const right = renderColumn("right", "#titanList", 1);
    const total = (CATALOG.armor?.[config.left.className]?.length || 0) + (CATALOG.armor?.[config.right.className]?.length || 0);
    const count = document.querySelector("#armorCount");
    if (count) count.textContent = `${left + right} / ${total}`;
  }

  document.addEventListener("input", event => { if (event.target?.id === "searchInput") setTimeout(renderArmorColumns, 0); });
  document.addEventListener("click", event => { if (event.target.closest("[data-view],[data-player]")) setTimeout(renderArmorColumns, 0); });
  document.addEventListener("d2collections:ownership-applied", () => setTimeout(renderArmorColumns, 0));
  const observer = new MutationObserver(() => {
    if (!document.querySelector(".armor-column-controls")) renderArmorColumns();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(renderArmorColumns, 0);
})();
