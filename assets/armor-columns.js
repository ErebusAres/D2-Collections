(() => {
  const CATALOG = window.D2_COLLECTIONS_CATALOG || { armor: {} };
  const CHECKLIST = window.D2_COLLECTIONS_CHECKLIST || { users: {}, armor: {} };
  const STORAGE_KEY = "d2-collections-armor-columns-v1";
  const DEFAULTS = {
    left: { player: "corey", className: "warlock" },
    right: { player: "matt", className: "titan" }
  };
  const CLASS_LABELS = { warlock: "Warlock", titan: "Titan", hunter: "Hunter" };
  const CLASS_MARKS = { warlock: "◆", titan: "◆", hunter: "◆" };
  const SLOT_ORDER = { Helmet: 1, Gauntlets: 2, Chest: 3, Legs: 4 };
  let config = readConfig();

  const css = `
    .armor-column-controls{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}.armor-control{border:1px solid var(--line);background:rgba(255,255,255,.045);border-radius:14px;padding:9px;display:grid;grid-template-columns:1fr 1fr;gap:8px}.armor-control label{display:grid;gap:4px;color:var(--muted);font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.armor-control select{width:100%;border:1px solid var(--line);border-radius:10px;background:rgba(0,0,0,.25);color:var(--text);padding:7px 8px;outline:none}.armor-card{grid-template-columns:minmax(0,1fr) auto;align-items:center;padding:7px 9px;min-height:54px}.armor-card .item-with-icon{grid-template-columns:34px minmax(0,1fr);gap:8px}.armor-card .item-icon,.armor-card .item-icon-fallback{width:34px;height:34px;border-radius:9px}.armor-card .badge.source,.armor-card .badge.focus{display:none}.armor-card h3{font-size:.88rem;margin-bottom:1px}.armor-card .badge.slot{font-size:.68rem;padding:2px 7px}.armor-card .armor-status.header{display:none}.armor-card .status-row{grid-column:2;grid-row:1;margin-top:0;align-self:center}.armor-card .player-label{display:none}.armor-card .status-cell{min-height:32px;min-width:44px;padding:0 8px;cursor:help}.armor-status{grid-template-columns:minmax(44px,58px);gap:0}.class-title.hunter span{color:var(--green)}@media(max-width:780px){.armor-column-controls{grid-template-columns:1fr}.armor-control{grid-template-columns:1fr 1fr}.armor-card{min-height:50px}.armor-status{grid-template-columns:minmax(42px,54px)}}
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

  function playerOptions(selected) {
    return Object.entries(CHECKLIST.users || { corey: { label: "Corey" }, matt: { label: "Matt" } })
      .map(([id, user]) => `<option value="${id}" ${id === selected ? "selected" : ""}>${user.label || id}</option>`).join("");
  }

  function classOptions(selected) {
    return Object.keys(CATALOG.armor || {})
      .map(id => `<option value="${id}" ${id === selected ? "selected" : ""}>${CLASS_LABELS[id] || id}</option>`).join("");
  }

  function ensureControls() {
    const armorPanel = document.querySelector(".armor-panel .panel-head");
    const columns = document.querySelector(".armor-columns");
    if (!armorPanel || !columns || document.querySelector(".armor-column-controls")) return;
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

  function normalize(text) { return String(text || "").toLowerCase(); }
  function statusCell(value, itemId) { return `<div class="status-cell ${value ? "yes" : "no"}" data-help-id="${itemId}" title="${value ? "Owned" : "Not owned"} — click for unlock help">${value ? "✅" : "⛔"}</div>`; }
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
    return Boolean(CHECKLIST.armor?.[className]?.[itemId]?.[player]?.owned);
  }

  function renderColumn(side, rootId, titleIndex) {
    const root = document.querySelector(rootId);
    const title = document.querySelectorAll(".class-title")[titleIndex];
    if (!root || !title) return 0;
    const { player, className } = config[side];
    const user = CHECKLIST.users?.[player]?.label || player;
    const klass = CLASS_LABELS[className] || className;
    title.className = `class-title ${className}`;
    title.innerHTML = `<span>${CLASS_MARKS[className] || "◆"}</span><strong>${user} · ${klass}</strong>`;
    const { search, view } = currentFilters();
    const items = [...(CATALOG.armor?.[className] || [])].sort((a,b) => (SLOT_ORDER[a.slot] || 99) - (SLOT_ORDER[b.slot] || 99) || a.name.localeCompare(b.name));
    const visible = items.filter(item => {
      const haystack = [item.name, item.slot, item.source].join(" ").toLowerCase();
      const owned = getOwned(className, item.id, player);
      if (search && !haystack.includes(search)) return false;
      if (view === "missing" && owned) return false;
      if (view === "catalysts") return false;
      return true;
    });
    root.innerHTML = visible.length ? visible.map(item => {
      const owned = getOwned(className, item.id, player);
      return `<article class="armor-card is-focus-card" data-id="${item.id}"><div class="item-meta item-with-icon">${iconMarkup(item)}<div><div class="item-name"><h3>${item.name}</h3><button class="item-help-btn" type="button" title="How to unlock" data-help-id="${item.id}">?</button></div><div class="badge-row"><span class="badge slot">${item.slot}</span><span class="badge source">${item.source}</span></div></div></div><div class="armor-status status-row"><div class="player-label">${CHECKLIST.users?.[player]?.short || player}</div>${statusCell(owned, item.id)}</div></article>`;
    }).join("") : `<div class="empty-state">No ${klass} armor matches this filter.</div>`;
    return visible.length;
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
  const observer = new MutationObserver(() => {
    if (!document.querySelector(".armor-column-controls")) renderArmorColumns();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(renderArmorColumns, 0);
})();
