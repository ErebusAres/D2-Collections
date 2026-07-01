(() => {
  const CATALOG = window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: {} };
  const CHECKLIST = window.D2_COLLECTIONS_CHECKLIST || { users: {}, weapons: {}, armor: {} };
  const BUNGIE = window.D2_COLLECTIONS_BUNGIE_COLLECTIBLES || { items: {} };
  const ITEM_UNLOCKS = window.D2_COLLECTIONS_ITEM_UNLOCKS || { items: {} };
  const UI_ICONS = window.D2_COLLECTIONS_UI_ICONS || { game: {}, dim: {} };
  const DAMAGE_ICONS = {
    solar: "https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_2a1773e10968f2d088b97c22b22bba9e.png",
    arc: "https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_092d066688b879c807c3b460afdd61e6.png",
    void: "https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_ceb2f6197dccf3958bb31cc783eb97a0.png",
    stasis: "https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_530c4c3e7981dc2aefd24fd3293482bf.png",
    strand: "https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_b2fe51a94f3533f97079dfa0d27a4096.png",
    kinetic: "https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_3385a924fd3ccb92c343ade19f19a370.png"
  };

  const css = `
    .weapon-card,.armor-card{position:relative}
    .weapon-card .status-cell,.armor-card .status-cell{cursor:help}
    .item-help-btn{flex:0 0 auto;border:1px solid rgba(216,177,91,.24);background:rgba(216,177,91,.07);color:var(--soft);border-radius:6px;width:24px;height:24px;display:inline-grid;place-items:center;font-size:.78rem;font-weight:900;line-height:1}
    .item-help-btn:hover,.item-help-btn:focus-visible{border-color:rgba(243,189,79,.45);color:var(--gold);outline:0}
    .item-name{min-width:0}
    .help-panel{position:fixed;z-index:70;right:16px;top:16px;width:min(480px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;border:1px solid var(--line-strong);border-radius:10px;background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.018)),#0d1119;box-shadow:0 24px 80px rgba(0,0,0,.55);padding:14px;transform:translateX(calc(100% + 24px));transition:transform .18s ease;outline:none}
    .help-panel.open{transform:translateX(0)}
    .help-panel-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px}
    .help-panel h2{font-size:1.05rem;line-height:1.2;margin:0}
    .help-close{border:1px solid var(--line);border-radius:7px;background:rgba(255,255,255,.06);color:var(--text);width:32px;height:32px;flex:0 0 auto}
    .help-hero{display:grid;grid-template-columns:74px minmax(0,1fr);gap:12px;align-items:center;border:1px solid rgba(216,177,91,.22);border-radius:10px;padding:10px;background:linear-gradient(90deg,rgba(216,177,91,.1),transparent 40%),rgba(0,0,0,.18);margin-bottom:10px}
    .help-item-icon,.help-item-fallback{width:74px;height:74px;border-radius:7px;border:1px solid rgba(216,177,91,.5);background:#080b10;object-fit:cover;box-shadow:inset 0 0 0 1px rgba(255,255,255,.055)}
    .help-item-fallback{display:grid;place-items:center;color:var(--gold);font-weight:900;font-size:1.1rem}
    .help-hero-title{min-width:0}
    .help-hero-title h3{margin:0 0 6px;font-size:1.12rem;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .help-hero-title p{margin:0;color:var(--muted);font-size:.8rem;line-height:1.35}
    .help-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
    .help-action{display:inline-flex;align-items:center;min-height:28px;border:1px solid rgba(216,177,91,.22);border-radius:7px;padding:5px 8px;color:var(--soft);background:rgba(0,0,0,.22);font-size:.72rem;font-weight:800;text-decoration:none}
    .help-action:hover{color:var(--gold-bright);border-color:rgba(216,177,91,.38)}
    .help-grid{display:grid;gap:8px;margin:10px 0}
    .help-source{border:1px solid rgba(216,177,91,.24);background:rgba(216,177,91,.07);border-radius:8px;padding:9px 10px;color:var(--soft);font-size:.84rem;line-height:1.4}
    .help-source strong{display:block;color:var(--gold);font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px}
    .help-steps{margin:8px 0 0;padding-left:20px;color:var(--soft);font-size:.88rem;line-height:1.45}
    .help-steps li{margin:6px 0}
    .help-note{color:var(--muted);font-size:.78rem;line-height:1.45;margin-top:10px}
    .help-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .help-icon-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid rgba(222,232,255,.105);border-radius:6px;padding:4px 7px;color:var(--muted);background:rgba(0,0,0,.16);font-size:.72rem;font-weight:800;line-height:1}
    .help-icon-chip svg,.help-icon-chip img{width:16px;height:16px;flex:0 0 16px}
    .help-icon-chip svg{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .help-icon-chip img{display:block;object-fit:contain;filter:brightness(0) saturate(100%) invert(84%) sepia(12%) saturate(386%) hue-rotate(180deg) brightness(100%) contrast(93%) drop-shadow(0 1px 2px rgba(0,0,0,.72))}
    .help-icon-chip strong{display:inline-grid;place-items:center;min-width:18px;height:16px;border-radius:4px;padding:0 3px;color:#090b0f;background:var(--soft);font-size:.58rem;letter-spacing:0}
    .help-icon-chip.kind{color:var(--soft)}
    .help-icon-chip.armor{color:var(--gold-bright)}
    .help-icon-chip.kinetic{color:#d7deea}
    .help-icon-chip.energy{color:var(--blue)}
    .help-icon-chip.power{color:var(--gold-bright)}
    .help-icon-chip.warlock{color:var(--purple)}
    .help-icon-chip.titan{color:var(--red)}
    .help-icon-chip.hunter{color:var(--green)}
    .help-icon-chip.type{color:var(--soft)}
    .help-icon-chip.type.sword,.help-icon-chip.type.glaive{color:var(--gold-bright)}
    .help-icon-chip.type.sword img,.help-icon-chip.type.glaive img,.help-icon-chip.power img{filter:brightness(0) saturate(100%) invert(84%) sepia(58%) saturate(508%) hue-rotate(358deg) brightness(101%) contrast(88%) drop-shadow(0 1px 2px rgba(0,0,0,.72))}
    .help-icon-chip.type.rocket-launcher,.help-icon-chip.type.grenade-launcher,.help-icon-chip.type.machine-gun,.help-icon-chip.type.linear-fusion-rifle{color:var(--blue)}
    .help-icon-chip.type.rocket-launcher img,.help-icon-chip.type.grenade-launcher img,.help-icon-chip.type.machine-gun img,.help-icon-chip.type.linear-fusion-rifle img,.help-icon-chip.energy img{filter:brightness(0) saturate(100%) invert(65%) sepia(42%) saturate(772%) hue-rotate(176deg) brightness(91%) contrast(89%) drop-shadow(0 1px 2px rgba(0,0,0,.72))}
    .help-icon-chip.element{color:var(--soft)}
    .help-icon-chip .damage-icon{width:16px;height:16px}
    .help-confidence{display:inline-flex;align-items:center;min-height:28px;border:1px solid rgba(202,209,221,.2);border-radius:6px;padding:5px 8px;color:var(--muted);background:rgba(202,209,221,.05);font-size:.74rem;font-weight:800;line-height:1;white-space:nowrap}
    .help-priority{border:1px solid rgba(216,177,91,.24);background:rgba(216,177,91,.055);border-radius:8px;padding:9px 10px;color:var(--soft);font-size:.84rem;line-height:1.45}
    .help-priority-head{display:flex;align-items:center;gap:7px;color:var(--gold);font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;font-weight:900;margin-bottom:4px}
    .help-priority-symbol{display:inline-grid;place-items:center;width:20px;height:20px;color:var(--gold-bright)}
    .help-priority-symbol svg,.help-priority-symbol img{width:18px;height:18px;display:block}
    .help-priority-symbol img{object-fit:contain;filter:brightness(0) saturate(100%) invert(82%) sepia(88%) saturate(790%) hue-rotate(344deg) brightness(104%) contrast(101%) drop-shadow(0 1px 2px rgba(0,0,0,.72))}
    .help-priority-symbol svg{fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
    .help-priority-symbol.must svg,.help-priority-symbol.final svg,.help-priority-symbol.rahool svg{fill:currentColor;stroke:none}
    .help-priority-symbol.must{color:#ffcf5a}
    .help-priority-symbol.must img{filter:brightness(0) saturate(100%) invert(82%) sepia(88%) saturate(790%) hue-rotate(344deg) brightness(104%) contrast(101%) drop-shadow(0 1px 2px rgba(0,0,0,.72))}
    .help-priority-symbol.easy{color:#52e39c}
    .help-priority-symbol.easy img{filter:brightness(0) saturate(100%) invert(75%) sepia(75%) saturate(425%) hue-rotate(92deg) brightness(97%) contrast(91%) drop-shadow(0 1px 2px rgba(0,0,0,.72))}
    .help-priority-symbol.final{color:#c8a8ff}
    .help-priority-symbol.final img{filter:brightness(0) saturate(100%) invert(73%) sepia(37%) saturate(1123%) hue-rotate(218deg) brightness(99%) contrast(94%) drop-shadow(0 1px 2px rgba(0,0,0,.72))}
    .help-priority-symbol.rahool{color:#66b7ff}
    .help-priority-symbol.rahool img{filter:brightness(0) saturate(100%) invert(68%) sepia(88%) saturate(967%) hue-rotate(178deg) brightness(101%) contrast(101%) drop-shadow(0 1px 2px rgba(0,0,0,.72))}
    .help-priority-symbol.xur{color:#ff8a3d}
    .help-priority-symbol.xur img{filter:brightness(0) saturate(100%) invert(67%) sepia(83%) saturate(1750%) hue-rotate(333deg) brightness(103%) contrast(101%) drop-shadow(0 1px 2px rgba(0,0,0,.72))}
    .help-priority-symbol.buy{color:#35f0e0;background:transparent;border-radius:5px}
    .help-priority-symbol.buy img{filter:brightness(0) saturate(100%) invert(83%) sepia(80%) saturate(953%) hue-rotate(119deg) brightness(101%) contrast(96%) drop-shadow(0 1px 2px rgba(0,0,0,.72))}
    .help-priority-symbol.difficulty-easy{color:var(--difficulty-easy,#cad1dd)}
    .help-priority-symbol.difficulty-easy img{filter:brightness(0) saturate(100%) invert(90%) sepia(10%) saturate(323%) hue-rotate(180deg) brightness(95%) contrast(93%) drop-shadow(0 1px 2px rgba(0,0,0,.72))}
    .help-priority-symbol.difficulty-normal{color:var(--difficulty-normal,#7fffb6)}
    .help-priority-symbol.difficulty-normal img{filter:brightness(0) saturate(100%) invert(87%) sepia(59%) saturate(519%) hue-rotate(78deg) brightness(104%) contrast(103%) drop-shadow(0 1px 2px rgba(0,0,0,.72))}
    .help-priority-symbol.difficulty-difficult{color:var(--difficulty-difficult,#d99b4a)}
    .help-priority-symbol.difficulty-difficult img{filter:brightness(0) saturate(100%) invert(67%) sepia(72%) saturate(529%) hue-rotate(354deg) brightness(95%) contrast(92%) drop-shadow(0 1px 2px rgba(0,0,0,.72))}
    .help-priority-symbol.difficulty-impossible{color:var(--difficulty-impossible,#ff5d72)}
    .help-priority-symbol.difficulty-impossible img{filter:brightness(0) saturate(100%) invert(51%) sepia(77%) saturate(1634%) hue-rotate(315deg) brightness(103%) contrast(103%) drop-shadow(0 1px 2px rgba(0,0,0,.72))}
    .help-priority-symbol.confidence{color:var(--muted)}
    .help-subhead{color:var(--gold);font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;font-weight:900;margin-top:12px}
    .help-details{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}
    .help-detail{border:1px solid rgba(222,232,255,.105);background:rgba(0,0,0,.18);border-radius:8px;padding:8px 9px;min-width:0}
    .help-detail span{display:block;color:var(--muted);font-size:.66rem;text-transform:uppercase;letter-spacing:.08em;font-weight:900;margin-bottom:2px}
    .help-detail strong{display:block;color:var(--soft);font-size:.84rem;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .help-unlock-note{margin:7px 0 0;color:var(--muted);font-size:.76rem;line-height:1.45}
    .help-unlock-list{display:grid;gap:6px;margin-top:8px}
    .help-unlock-row{display:grid;grid-template-columns:minmax(120px,.75fr) minmax(0,1.25fr);gap:6px;align-items:center;border:1px solid rgba(222,232,255,.105);background:rgba(0,0,0,.18);border-radius:7px;padding:7px 8px}
    .help-unlock-row span{color:var(--soft);font-size:.8rem;font-weight:900}
    .help-unlock-row strong{color:var(--muted);font-size:.72rem;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .help-status-list{display:grid;gap:6px;margin-top:8px}
    .help-status-row{display:grid;grid-template-columns:minmax(58px,.7fr) repeat(4,minmax(48px,1fr));gap:5px;align-items:center;color:var(--muted);font-size:.76rem}
    .help-status-row span{border:1px solid var(--line);border-radius:6px;padding:5px 6px;background:rgba(0,0,0,.18);text-align:center}
    .help-status-row .is-yes{color:#caffdf;border-color:rgba(88,214,154,.3);background:rgba(88,214,154,.08)}
    .help-status-row .is-no{color:#ffd7dc;border-color:rgba(224,111,120,.22);background:rgba(224,111,120,.06)}
    .help-status-row .is-neutral{color:var(--muted);border-color:rgba(202,209,221,.16);background:rgba(202,209,221,.06)}
    .help-state-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:8px}
    .help-state-summary span{border:1px solid var(--line);border-radius:7px;background:rgba(0,0,0,.2);padding:7px;color:var(--muted);font-size:.68rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em}
    .help-state-summary strong{display:block;color:var(--soft);font-size:1rem;letter-spacing:0;text-transform:none}
    @media(max-width:780px){.help-panel{left:10px;right:10px;top:auto;bottom:10px;width:auto;max-height:72vh;border-radius:16px;transform:translateY(calc(100% + 24px))}.help-panel.open{transform:translateY(0)}}
    @media(max-width:780px){.help-details{grid-template-columns:1fr}.help-status-row{grid-template-columns:minmax(58px,.7fr) repeat(4,minmax(40px,1fr));font-size:.68rem}.help-unlock-row{grid-template-columns:1fr}.help-hero{grid-template-columns:58px minmax(0,1fr)}.help-item-icon,.help-item-fallback{width:58px;height:58px}.help-state-summary{grid-template-columns:1fr 1fr}}
  `;

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const panel = document.createElement("aside");
  panel.className = "help-panel";
  panel.setAttribute("aria-live", "polite");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-labelledby", "helpTitle");
  panel.tabIndex = -1;
  panel.innerHTML = `
    <div class="help-panel-head">
      <div>
        <p class="eyebrow">Unlock help</p>
        <h2 id="helpTitle"></h2>
        <div id="helpMeta" class="help-meta"></div>
      </div>
      <button class="help-close" type="button" aria-label="Close">x</button>
    </div>
    <div id="helpBody"></div>
  `;
  document.body.appendChild(panel);
  let lastHelpTrigger = null;

  function normalize(text) {
    return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function allItems() {
    return [
      ...(CATALOG.weapons || []).map(item => ({ ...item, kind: "weapon" })),
      ...Object.entries(CATALOG.armor || {}).flatMap(([className, list]) =>
        (Array.isArray(list) ? list : []).map(item => ({ ...item, kind: "armor", className }))
      )
    ];
  }

  const itemMap = new Map(allItems().map(item => [item.id, item]));

  function manifestSource(item) {
    const sourceStrings = BUNGIE.items?.[item.id]?.sourceStrings || [];
    return sourceStrings.length ? sourceStrings.join(" / ") : "";
  }

  function cleanSource(value) {
    return String(value || "").replace(/^Source:\s*/i, "").trim();
  }

  function displaySource(item) {
    return cleanSource(manifestSource(item) || item.source || "Source pending manual verification");
  }

  function sourceHeading(item) {
    if (manifestSource(item)) return "Bungie source";
    if (item.priority?.confidence === "External") return "External source";
    return "Catalog source";
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

  function kindIcon(kind) {
    return kind === "armor"
      ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5.5c0 4.2-2.6 7.5-7 9.5-4.4-2-7-5.3-7-9.5V6l7-3Z"/></svg>`
      : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h7l6-6 3 3-6 6v3h-3v-3H4v-3Z"/><path d="m15 6 3 3"/></svg>`;
  }

  function classIcon(className) {
    const key = String(className || "").toLowerCase();
    if (key.includes("warlock")) return dimIcon("class_warlock.png", "Warlock class");
    if (key.includes("titan")) return dimIcon("class_titan.png", "Titan class");
    if (key.includes("hunter")) return dimIcon("class_hunter.png", "Hunter class");
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 20 12 12 20 4 12 12 4Z"/></svg>`;
  }

  function damageParts(element) {
    const key = String(element || "").toLowerCase();
    return ["solar", "arc", "void", "stasis", "strand", "kinetic"].filter(name => key.includes(name));
  }

  function damageIcon(name, label) {
    const src = DAMAGE_ICONS[name];
    return src ? `<img class="damage-icon ${escapeHtml(name)}" src="${src}" alt="" title="${escapeHtml(label)}" width="16" height="16" loading="lazy" decoding="async" aria-hidden="true" />` : "";
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
    return uiGlyph(`assets/dim-icons/${filename}`, label);
  }

  function uiGlyph(src, label) {
    return `<img class="dim-icon ui-glyph" src="${escapeHtml(src || UI_ICONS.dim?.fallback || "assets/dim-icons/dim_bookmark.svg")}" alt="" title="${escapeHtml(label)}" width="18" height="18" loading="lazy" decoding="async" aria-hidden="true" />`;
  }

  function gameIcon(src, label) {
    return `<img class="game-icon real-icon" src="${escapeHtml(src || UI_ICONS.dim?.fallback || "assets/dim-icons/dim_bookmark.svg")}" alt="" title="${escapeHtml(label)}" width="18" height="18" loading="lazy" decoding="async" aria-hidden="true" />`;
  }

  function itemIcon(item) {
    const raw = item.icon || item.iconUrl || "";
    const src = raw && raw.startsWith("/") ? `https://www.bungie.net${raw}` : raw;
    if (src) return `<img class="help-item-icon" src="${escapeHtml(src)}" alt="${escapeHtml(item.name)} icon" width="74" height="74" loading="lazy" decoding="async" />`;
    const initials = String(item.name || "?").split(/\s+|-/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() || "").join("") || "?";
    return `<div class="help-item-fallback" aria-hidden="true">${escapeHtml(initials)}</div>`;
  }

  function titleCase(value) {
    return String(value || "").trim().toLowerCase().replace(/\b[a-z0-9]/g, char => char.toUpperCase());
  }

  function helpChip(className, icon, label, title = label) {
    return `<span class="help-icon-chip ${escapeHtml(className)}" title="${escapeHtml(title)}">${icon}<span>${escapeHtml(label)}</span></span>`;
  }

  function metaChips(item) {
    const chips = [];
    chips.push(helpChip(`kind ${item.kind}`, kindIcon(item.kind), item.kind === "armor" ? "Armor" : "Weapon"));
    if (item.className) chips.push(helpChip(item.className, classIcon(item.className), titleCase(item.className)));
    if (item.slot) chips.push(helpChip(item.slot.toLowerCase().replace(/[^a-z0-9]+/g, "-"), slotIcon(item.slot), titleCase(item.slot)));
    if (item.type) chips.push(helpChip(`type ${typeKey(item.type)}`, weaponTypeIcon(item.type), titleCase(item.type), `Weapon type: ${titleCase(item.type)}`));
    if (item.element) {
      const parts = damageParts(item.element);
      const icons = parts.length ? parts.map(name => damageIcon(name, item.element)).join("") : `<strong>EL</strong>`;
      chips.push(helpChip("element", icons, titleCase(item.element), `Damage element: ${titleCase(item.element)}`));
    }
    return chips.join("");
  }

  function priorityBlock(id, title, body) {
    return `<div class="help-priority"><div class="help-priority-head"><span class="help-priority-symbol ${escapeHtml(id)}">${tagIcon(id)}</span><span>${escapeHtml(title)}</span></div>${escapeHtml(body)}</div>`;
  }

  function readXurStock() {
    try {
      return JSON.parse(localStorage.getItem("d2-collections-xur-stock-v1") || "{}");
    } catch {
      return {};
    }
  }

  function xurHasItem(itemId) {
    const stock = readXurStock();
    return Boolean(stock?.active && Array.isArray(stock.itemIds) && stock.itemIds.includes(itemId));
  }

  function weaponHasCatalyst(item) {
    return Boolean(catalystTracks(item).length);
  }

  function catalystTracks(item) {
    return unlockTracks(item).filter(track => track.kind === "catalyst");
  }

  function unlockTracks(item) {
    const manual = ITEM_UNLOCKS.items?.[item.id]?.unlocks || [];
    const manualByRecord = new Map(manual.filter(track => track.recordHash).map(track => [String(track.recordHash), track]));
    const manifestCatalysts = (BUNGIE.items?.[item.id]?.catalystRecordHashes || []).map((hash, index) => {
      const key = String(hash);
      const override = manualByRecord.get(key) || {};
      return {
        id: override.id || key,
        kind: "catalyst",
        label: override.label || `Catalyst ${index + 1}`,
        recordHash: key,
        source: override.source || "Bungie record",
        manual: Boolean(override.manual)
      };
    });
    const manifestIds = new Set(manifestCatalysts.map(track => track.id));
    const extras = manual.filter(track => !manifestIds.has(track.id) && !(track.recordHash && manifestCatalysts.some(base => base.recordHash === String(track.recordHash))));
    return [...manifestCatalysts, ...extras].map((track, index) => ({
      id: String(track.id || track.recordHash || `${item.id}-unlock-${index + 1}`),
      kind: track.kind || "unlock",
      label: track.label || `Unlock ${index + 1}`,
      recordHash: track.recordHash ? String(track.recordHash) : "",
      collectibleHash: track.collectibleHash ? String(track.collectibleHash) : "",
      source: track.source || "",
      manual: Boolean(track.manual)
    }));
  }

  function unlockSummary(row, item) {
    const tracks = unlockTracks(item);
    const catalystCount = tracks.filter(track => track.kind === "catalyst").length;
    const owned = tracks.filter(track => {
      const saved = row.unlocks?.[track.id];
      if (saved?.owned || saved?.complete) return true;
      return track.kind === "catalyst" && catalystCount <= 1 && row.catalyst;
    }).length;
    const complete = tracks.filter(track => {
      const saved = row.unlocks?.[track.id];
      if (saved?.complete) return true;
      return track.kind === "catalyst" && catalystCount <= 1 && row.complete;
    }).length;
    return { tracks, owned, complete };
  }

  function unlockDetails(item) {
    const tracks = unlockTracks(item);
    if (!tracks.length) return "";
    const note = ITEM_UNLOCKS.items?.[item.id]?.note
      ? `<p class="help-unlock-note">${escapeHtml(ITEM_UNLOCKS.items[item.id].note)}</p>`
      : "";
    const rows = tracks.map(track => {
      const meta = [track.kind, track.recordHash ? `Record ${track.recordHash}` : "", track.collectibleHash ? `Collectible ${track.collectibleHash}` : "", track.source, track.manual ? "manual" : ""].filter(Boolean).join(" / ");
      return `<div class="help-unlock-row"><span>${escapeHtml(track.label)}</span><strong>${escapeHtml(meta)}</strong></div>`;
    }).join("");
    return `<div class="help-subhead">Tracked unlocks</div>${note}<div class="help-unlock-list">${rows}</div>`;
  }

  const specificRoutes = {
    "divinity": ["Start the Divinity quest path, then complete Garden of Salvation with the raid puzzle chain in the same run.", "Claim it after the final boss once every puzzle step has been completed."],
    "gjallarhorn": ["Start the Gjallarhorn quest path tied to Grasp of Avarice.", "Complete the dungeon and the follow-up quest steps to claim the weapon."],
    "malfeasance": ["Continue the Gambit exotic quest path.", "Finish the Taken, strike, and Gambit objectives tied to the quest."],
    "outbreak-perfected": ["Launch Zero Hour when it is available.", "Complete the mission to unlock the weapon, then rerun for catalyst or intrinsic progress."],
    "whisper-of-the-worm": ["Launch The Whisper when it is available.", "Complete the mission to unlock the weapon, then rerun for catalyst or intrinsic progress."],
    "vexcalibur": ["Launch Avalon when it is available or continue the Vexcalibur quest path.", "Complete the mission to unlock the weapon, then rerun for catalysts or intrinsics."],
    "wish-ender": ["Follow the Wish-Ender exotic quest path tied to the Dreaming City and Shattered Throne.", "Complete the quest objectives to claim the bow."],
    "xenophage": ["Follow the Shadowkeep Moon quest path into Pit of Heresy.", "Complete the quest encounter to claim Xenophage."],
    "khvostov-7g-0x": ["Progress The Pale Heart collectible and quest path.", "Collect the required regional items and finish the final quest step."],
    "barrow-dyad": ["Follow The Taken Path and Derealize questline from Episode: Heresy.", "Finish the quest chain to unlock Barrow-Dyad."],
    "praxic-blade": ["Progress the Renegades campaign/source path listed by Bungie.", "Check the Renegades destination or quest vendor if it is not already claimable."],
    "cull-s-shadow": ["Complete the Monuments of Triumph exotic mission path.", "Bungie resolves the item but does not publish a collectible source string, so the site marks this as externally verified."],
    "new-malpais": ["Bungie lists this as a Rewards Pass item.", "Check the current Rewards Pass track first; if the pass has rotated, verify the current legacy path in game."],
    "wicked-sister-placeholder": ["Bungie resolves this item but does not publish a collectible source string.", "The local catalog lists Heliostat / Ash & Iron as the lead, but this is not externally verified yet."]
  };

  function routeFor(item) {
    const source = displaySource(item);
    const localSource = item.source || "";
    const s = normalize(`${source} ${localSource}`);
    const steps = [...(specificRoutes[item.id] || [])];
    let confidence = manifestSource(item) ? "Manifest source verified" : "Needs manual source verification";

    if (!steps.length && (s.includes("exotic archive") || s.includes("monument"))) {
      steps.push("Go to the Exotic Archive kiosk at the Tower.");
      steps.push("Open the matching legacy/expansion section and buy the item with the listed kiosk materials.");
    } else if (!steps.length && s.includes("xur")) {
      steps.push("Check Xur while the site treats him as active from Friday 12 PM through Monday 12 PM Central.");
      steps.push("Inspect his direct exotic inventory and focusing/quest options for the item.");
    } else if (!steps.length && s.includes("rewards pass")) {
      steps.push("Bungie lists this as a Rewards Pass item.");
      steps.push("Check the current Rewards Pass track first; if the pass has rotated, verify the current legacy path in game.");
    } else if (!steps.length && (s.includes("season pass reward") || s.includes("season pass"))) {
      steps.push("Bungie lists this as an older Season Pass reward.");
      steps.push("If that season is no longer active, check the Exotic Archive or current legacy acquisition path.");
    } else if (!steps.length && (s.includes("exotic armor focusing") || s.includes("rahool"))) {
      steps.push("Go to Master Rahool in the Tower.");
      steps.push("Use exotic armor focusing on the correct class and slot, if your account has unlocked the required focusing tier.");
    } else if (!steps.length && s.includes("solo expert and master lost sectors")) {
      steps.push("Run Solo Expert or Master Lost Sectors on the correct armor-slot day.");
      steps.push("Use the correct class and keep the item on the list until it is unlocked, then use focusing for better rolls later.");
    } else if (!steps.length && (s.includes("pre order") || s.includes("preorder"))) {
      steps.push("Bungie lists this as a pre-order bonus.");
      steps.push("Check the relevant expansion rewards, special deliveries, or platform entitlement path.");
    } else if (!steps.length && s.includes("quest")) {
      steps.push("Follow the named exotic quest or challenge listed by Bungie.");
      steps.push("Check the Quest Archive, destination vendor, or activity node if the quest is not in your inventory.");
    } else if (!steps.length && (s.includes("raid") || s.includes("salvation") || s.includes("root") || s.includes("vow") || s.includes("vault") || s.includes("king") || s.includes("last wish") || s.includes("garden") || s.includes("deep stone") || s.includes("desert perpetual"))) {
      steps.push("Run the listed raid and focus the final boss or exotic-specific quest/drop path.");
      steps.push("Complete triumphs that increase the exotic drop chance if that raid offers boosts.");
    } else if (!steps.length && (s.includes("dungeon") || s.includes("spire") || s.includes("warlord") || s.includes("ghosts") || s.includes("duality") || s.includes("vesper") || s.includes("grasp"))) {
      steps.push("Run the listed dungeon and focus the final encounter or exotic quest path.");
      steps.push("Complete triumphs that increase the exotic drop chance if available.");
    } else if (!steps.length && (s.includes("campaign") || s.includes("final shape") || s.includes("lightfall") || s.includes("witch queen") || s.includes("beyond light") || s.includes("shadowkeep") || s.includes("edge of fate") || s.includes("renegades"))) {
      steps.push("Progress the listed expansion, campaign, or destination path.");
      steps.push("Check post-campaign vendors, quests, and reward tracks tied to that expansion.");
    } else if (!steps.length && (s.includes("zero hour") || s.includes("whisper") || s.includes("avalon") || s.includes("seraph") || s.includes("encore") || s.includes("exotic mission"))) {
      steps.push("Open the listed exotic mission or the Exotic Mission rotator when it is available.");
      steps.push("Complete the mission once for the weapon, then rerun for catalysts or intrinsics if needed.");
    } else if (!steps.length && (s.includes("world") || s.includes("exotic engram"))) {
      steps.push("Earn Exotic Engrams from ritual rewards, rank resets, or high-end activities.");
      steps.push("Use Rahool focusing when the item is eligible; otherwise treat it as a world/exotic-engram unlock.");
    } else if (!steps.length) {
      steps.push("Use the Bungie source shown above as the current acquisition lead.");
      steps.push("Check the matching vendor, activity, destination, or Quest Archive in game.");
      confidence = "Generic route; needs manual in-game confirmation";
    }

    if (item.kind === "weapon") {
      steps.push("Track catalyst obtained and catalyst complete separately from weapon ownership.");
    }

    return { source, localSource, steps, confidence };
  }

  function priorityBlocks(item) {
    const priority = item.priority || {};
    const blocks = [];
    const xurAvailable = xurHasItem(item.id);
    const xurPreferredArmor = xurAvailable && item.kind === "armor";
    if (priority.mustHave) {
      blocks.push(priorityBlock("must", "Must have", priority.note || "High-priority community PvE pickup after the final update."));
    }
    if (priority.finalUpdate) {
      blocks.push(priorityBlock("final", "Final update", `${priority.finalUpdateLabel || "Post June 9 final update"} catalyst relevance. Track catalyst ownership and completion separately.`));
    }
    if (priority.easyWin) {
      const easy = (priority.tags || []).find(tag => tag.id === "easy");
      blocks.push(priorityBlock("easy", "Easy win", easy?.title || "Deterministic or lower-RNG acquisition path compared with random drops."));
    }
    if (priority.rahool && !xurPreferredArmor) {
      blocks.push(priorityBlock("rahool", "Rahool check", "If the logged-in player has 1+ Exotic Cipher and 1+ Exotic Engram, missing eligible armor shows a Buy now chip. The site does not yet verify per-item focusing unlock state."));
    }
    if (xurAvailable) {
      const body = xurPreferredArmor
        ? "The latest logged-in Bungie vendor check matched this armor in Xur's Tower inventory. Prefer Xur over Rahool when available because it is usually the cheaper, simpler pickup."
        : "The latest logged-in Bungie vendor check matched this item in Xur's Tower inventory during the current Friday noon-Monday noon Central window.";
      blocks.push(priorityBlock("xur", "Xur has it", body));
    }
    if (priority.difficulty) {
      blocks.push(priorityBlock(`difficulty-${priority.difficulty}`, `${priority.difficultyLabel || priority.difficulty} difficulty`, priority.difficultyTitle || "Estimated acquisition difficulty based on the listed source."));
    }
    if (priority.confidence) {
      blocks.push(priorityBlock("confidence", "Confidence", `${priority.confidence} - ${priority.confidenceNote || "Source confidence not specified."}`));
    }
    return blocks.join("");
  }

  function detailRows(item, info) {
    const map = BUNGIE.items?.[item.id] || {};
    const values = [
      ["Type", [item.kind, item.className, item.slot, item.type].filter(Boolean).join(" / ")],
      ["Element", item.element || "None listed"],
      ["Difficulty", item.priority?.difficultyLabel || "Normal"],
      ["Catalog ID", item.id],
      ["Collectible", (map.collectibleHashes || []).join(", ") || "Not mapped"],
      ["Catalyst records", catalystTracks(item).map(track => track.recordHash || track.id).join(", ") || (item.kind === "weapon" ? "No catalyst mapped for this weapon" : "Armor item")],
      ["Confidence", item.priority?.confidence || info.confidence]
    ];
    return `<div class="help-details">${values.map(([label, value]) => `<div class="help-detail"><span>${escapeHtml(label)}</span><strong title="${escapeHtml(value)}">${escapeHtml(value)}</strong></div>`).join("")}</div>${unlockDetails(item)}`;
  }

  function statusClass(value) {
    return value ? "is-yes" : "is-no";
  }

  function collectionStatus(item) {
    const state = window.D2_COLLECTIONS_APP?.getState?.() || CHECKLIST;
    const users = CHECKLIST.users || {};
    const userIds = Object.keys(users);
    if (!userIds.length) return "";
    if (item.kind === "weapon") {
      const hasCat = weaponHasCatalyst(item);
      const tracks = unlockTracks(item);
      const ownedCount = userIds.filter(player => state.weapons?.[item.id]?.[player]?.owned).length;
      const catCount = hasCat ? userIds.filter(player => state.weapons?.[item.id]?.[player]?.catalyst).length : 0;
      const doneCount = hasCat ? userIds.filter(player => state.weapons?.[item.id]?.[player]?.complete).length : 0;
      const rows = userIds.map(player => {
        const row = state.weapons?.[item.id]?.[player] || {};
        const name = users[player]?.short || users[player]?.label || player;
        const summary = unlockSummary(row, item);
        const extra = tracks.length ? `${summary.owned}/${tracks.length} unlocks` : "No extras";
        return `<div class="help-status-row"><span>${escapeHtml(name)}</span><span class="${statusClass(row.owned)}">Own</span><span class="${hasCat ? statusClass(row.catalyst) : "is-neutral"}">${hasCat ? "Cat" : "No cat"}</span><span class="${hasCat ? statusClass(row.complete) : "is-neutral"}">${hasCat ? "Done" : "None"}</span><span class="${tracks.length ? statusClass(summary.owned === tracks.length) : "is-neutral"}">${escapeHtml(extra)}</span></div>`;
      }).join("");
      const unlockText = tracks.length ? `${tracks.length} tracked` : "none";
      return `<div class="help-subhead">Collection state</div><div class="help-state-summary"><span><strong>${ownedCount}/${userIds.length}</strong>Owned</span><span><strong>${hasCat ? `${catCount}/${userIds.length}` : "none"}</strong>Catalyst</span><span><strong>${hasCat ? `${doneCount}/${userIds.length}` : "none"}</strong>Complete</span><span><strong>${unlockText}</strong>Unlocks</span></div><div class="help-status-list">${rows}</div>`;
    }
    const className = item.className;
    const ownedCount = userIds.filter(player => state.armor?.[className]?.[item.id]?.[player]?.owned).length;
    const rows = userIds.map(player => {
      const row = state.armor?.[className]?.[item.id]?.[player] || {};
      const name = users[player]?.short || users[player]?.label || player;
      return `<div class="help-status-row"><span>${escapeHtml(name)}</span><span class="${statusClass(row.owned)}">Own</span><span></span><span></span></div>`;
    }).join("");
    return `<div class="help-subhead">Collection state</div><div class="help-state-summary"><span><strong>${ownedCount}/${userIds.length}</strong>Owned</span><span><strong>${titleCase(className)}</strong>Class</span><span><strong>${titleCase(item.slot)}</strong>Slot</span></div><div class="help-status-list">${rows}</div>`;
  }

  function heroSubtitle(item) {
    return [item.kind === "armor" ? titleCase(item.className) : "", item.slot, item.type, item.element].filter(Boolean).map(titleCase).join(" / ");
  }

  function searchUrl(item) {
    return `https://www.google.com/search?q=${encodeURIComponent(`site:light.gg Destiny 2 ${item.name}`)}`;
  }

  function addHelpButtons(root = document) {
    root.querySelectorAll(".weapon-card,.armor-card").forEach(card => {
      const id = card.dataset.id;
      const title = card.querySelector(".item-name");
      if (!id || !title) return;
      if (!card.querySelector(".item-help-btn")) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "item-help-btn";
        btn.textContent = "i";
        btn.title = "More info";
        btn.dataset.helpId = id;
        title.appendChild(btn);
      }
      card.querySelectorAll(".status-cell").forEach(cell => {
        cell.dataset.helpId = id;
        const base = cell.title || "Status";
        if (!base.includes("more info")) cell.title = `${base} - click for more info`;
      });
    });
  }

  let helpScanFrame = 0;
  const pendingHelpRoots = new Set();
  function scheduleHelpScan(root = document) {
    pendingHelpRoots.add(root);
    if (helpScanFrame) cancelAnimationFrame(helpScanFrame);
    helpScanFrame = requestAnimationFrame(() => {
      helpScanFrame = 0;
      const roots = [...pendingHelpRoots];
      pendingHelpRoots.clear();
      roots.forEach(scanRoot => addHelpButtons(scanRoot));
    });
  }

  function showHelp(id) {
    const item = itemMap.get(id);
    if (!item) return;
    lastHelpTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const info = routeFor(item);
    const meta = metaChips(item);
    const priorityMeta = item.priority?.confidence ? `<span class="help-confidence" title="${escapeHtml(item.priority.confidenceNote || "")}">${escapeHtml(item.priority.confidence)}</span>` : "";
    panel.querySelector("#helpTitle").textContent = item.name;
    panel.querySelector("#helpMeta").innerHTML = meta + priorityMeta;
    panel.querySelector("#helpBody").innerHTML = `
      <div class="help-hero">
        ${itemIcon(item)}
        <div class="help-hero-title">
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(heroSubtitle(item) || "Destiny 2 exotic")}</p>
          <div class="help-actions">
            <a class="help-action" href="${escapeHtml(searchUrl(item))}" target="_blank" rel="noreferrer">Item page search</a>
            <span class="help-action" title="${escapeHtml(item.id)}">ID: ${escapeHtml(item.id)}</span>
          </div>
        </div>
      </div>
      <div class="help-grid">
        <div class="help-source"><strong>${escapeHtml(sourceHeading(item))}</strong>${escapeHtml(info.source)}</div>
        ${info.localSource && info.localSource !== info.source ? `<div class="help-source"><strong>Catalog tag</strong>${escapeHtml(info.localSource)}</div>` : ""}
        ${priorityBlocks(item)}
      </div>
      <div class="help-subhead">Item details</div>
      ${detailRows(item, info)}
      ${collectionStatus(item)}
      <div class="help-subhead">Route</div>
      <ol class="help-steps">${info.steps.map(step => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      <div class="help-note">${escapeHtml(info.confidence)}. Bungie can move acquisition paths; this panel uses the latest static manifest data bundled with the site.</div>
    `;
    panel.classList.add("open");
    panel.focus({ preventScroll: true });
  }

  function closeHelp(returnFocus = false) {
    const wasOpen = panel.classList.contains("open");
    panel.classList.remove("open");
    if (returnFocus && wasOpen && lastHelpTrigger?.isConnected) lastHelpTrigger.focus({ preventScroll: true });
  }

  document.addEventListener("click", event => {
    if (event.target.closest(".help-close")) {
      closeHelp(true);
      return;
    }

    if (event.target.closest(".help-panel")) return;

    const clickable = event.target.closest(".item-help-btn,.status-cell,.weapon-card,.armor-card");
    if (clickable?.dataset.helpId) {
      showHelp(clickable.dataset.helpId);
      return;
    }

    closeHelp(false);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeHelp(true);
    if ((event.key === "Enter" || event.key === " ") && event.target.closest?.(".weapon-card,.armor-card")) {
      const card = event.target.closest(".weapon-card,.armor-card");
      if (!card?.dataset.helpId) return;
      event.preventDefault();
      showHelp(card.dataset.helpId);
    }
  });

  const observer = new MutationObserver(mutations => {
    const roots = new Set();
    mutations.forEach(mutation => {
      if (mutation.target instanceof Element) roots.add(mutation.target);
    });
    if (!roots.size) {
      scheduleHelpScan();
      return;
    }
    roots.forEach(root => scheduleHelpScan(root));
  });
  ["#weaponsList", "#warlockList", "#titanList"].forEach(selector => {
    const root = document.querySelector(selector);
    if (root) observer.observe(root, { childList: true, subtree: true });
  });
  addHelpButtons();
})();
