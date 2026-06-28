(() => {
  const CATALOG = window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: {} };
  const CHECKLIST = window.D2_COLLECTIONS_CHECKLIST || { users: {}, weapons: {}, armor: {} };
  const BUNGIE = window.D2_COLLECTIONS_BUNGIE_COLLECTIBLES || { items: {} };

  const css = `
    .weapon-card,.armor-card{position:relative}
    .weapon-card .status-cell,.armor-card .status-cell{cursor:help}
    .item-help-btn{flex:0 0 auto;border:1px solid rgba(216,177,91,.24);background:rgba(216,177,91,.07);color:var(--soft);border-radius:6px;width:24px;height:24px;display:inline-grid;place-items:center;font-size:.78rem;font-weight:900;line-height:1}
    .item-help-btn:hover,.item-help-btn:focus-visible{border-color:rgba(243,189,79,.45);color:var(--gold);outline:0}
    .item-name{min-width:0}
    .help-panel{position:fixed;z-index:70;right:16px;top:16px;width:min(430px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;border:1px solid var(--line-strong);border-radius:10px;background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.018)),#0d1119;box-shadow:0 24px 80px rgba(0,0,0,.55);padding:14px;transform:translateX(calc(100% + 24px));transition:transform .18s ease;outline:none}
    .help-panel.open{transform:translateX(0)}
    .help-panel-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px}
    .help-panel h2{font-size:1.05rem;line-height:1.2;margin:0}
    .help-close{border:1px solid var(--line);border-radius:7px;background:rgba(255,255,255,.06);color:var(--text);width:32px;height:32px;flex:0 0 auto}
    .help-grid{display:grid;gap:8px;margin:10px 0}
    .help-source{border:1px solid rgba(216,177,91,.24);background:rgba(216,177,91,.07);border-radius:8px;padding:9px 10px;color:var(--soft);font-size:.84rem;line-height:1.4}
    .help-source strong{display:block;color:var(--gold);font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px}
    .help-steps{margin:8px 0 0;padding-left:20px;color:var(--soft);font-size:.88rem;line-height:1.45}
    .help-steps li{margin:6px 0}
    .help-note{color:var(--muted);font-size:.78rem;line-height:1.45;margin-top:10px}
    .help-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .help-confidence{display:inline-flex;align-items:center;min-height:28px;border:1px solid rgba(202,209,221,.2);border-radius:6px;padding:5px 8px;color:var(--muted);background:rgba(202,209,221,.05);font-size:.74rem;font-weight:800;line-height:1;white-space:nowrap}
    .help-priority{border:1px solid rgba(216,177,91,.24);background:rgba(216,177,91,.055);border-radius:8px;padding:9px 10px;color:var(--soft);font-size:.84rem;line-height:1.45}
    .help-priority strong{display:block;color:var(--gold);font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px}
    .help-subhead{color:var(--gold);font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;font-weight:900;margin-top:12px}
    .help-details{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}
    .help-detail{border:1px solid rgba(222,232,255,.105);background:rgba(0,0,0,.18);border-radius:8px;padding:8px 9px;min-width:0}
    .help-detail span{display:block;color:var(--muted);font-size:.66rem;text-transform:uppercase;letter-spacing:.08em;font-weight:900;margin-bottom:2px}
    .help-detail strong{display:block;color:var(--soft);font-size:.84rem;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .help-status-list{display:grid;gap:6px;margin-top:8px}
    .help-status-row{display:grid;grid-template-columns:minmax(70px,.7fr) repeat(3,minmax(48px,1fr));gap:5px;align-items:center;color:var(--muted);font-size:.76rem}
    .help-status-row span{border:1px solid var(--line);border-radius:6px;padding:5px 6px;background:rgba(0,0,0,.18);text-align:center}
    .help-status-row .is-yes{color:#caffdf;border-color:rgba(88,214,154,.3);background:rgba(88,214,154,.08)}
    .help-status-row .is-no{color:#ffd7dc;border-color:rgba(224,111,120,.22);background:rgba(224,111,120,.06)}
    @media(max-width:780px){.help-panel{left:10px;right:10px;top:auto;bottom:10px;width:auto;max-height:72vh;border-radius:16px;transform:translateY(calc(100% + 24px))}.help-panel.open{transform:translateY(0)}}
    @media(max-width:780px){.help-details{grid-template-columns:1fr}.help-status-row{grid-template-columns:minmax(58px,.7fr) repeat(3,minmax(44px,1fr))}}
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

  function displaySource(item) {
    return manifestSource(item) || item.source || "Source pending manual verification";
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
    "new-malpais": ["Bungie maps this item in the manifest, but the catalog source is still pending validation.", "Treat this as a manual-check item until its final acquisition route is confirmed in game."],
    "wicked-sister-placeholder": ["Bungie does not expose a source string for this catalog entry yet.", "Use the local source tag as a lead, then verify in game before relying on this route."]
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
      steps.push("Check Xur while he is active from Friday reset through Tuesday reset.");
      steps.push("Inspect his direct exotic inventory and focusing/quest options for the item.");
    } else if (!steps.length && s.includes("season pass reward")) {
      steps.push("Bungie lists this as a Season Pass reward.");
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
    if (priority.mustHave) {
      blocks.push(`<div class="help-priority"><strong>Priority reason</strong>${escapeHtml(priority.note || "High-priority community PvE pickup after the final update.")}</div>`);
    }
    if (priority.finalUpdate) {
      blocks.push(`<div class="help-priority"><strong>Final update</strong>${escapeHtml(priority.finalUpdateLabel || "Post June 9 final update")} catalyst relevance. Track catalyst ownership and completion separately.</div>`);
    }
    if (priority.easyWin) {
      const easy = (priority.tags || []).find(tag => tag.id === "easy");
      blocks.push(`<div class="help-priority"><strong>Easy win</strong>${escapeHtml(easy?.title || "Deterministic or lower-RNG acquisition path compared with random drops.")}</div>`);
    }
    if (priority.rahool) {
      blocks.push(`<div class="help-priority"><strong>Rahool check</strong>If the logged-in player has 1+ Exotic Cipher and 1+ Exotic Engram, missing eligible armor shows a Buy now chip. The site does not yet verify per-item focusing unlock state.</div>`);
    }
    if (priority.confidence) {
      blocks.push(`<div class="help-priority"><strong>Confidence</strong>${escapeHtml(priority.confidence)} - ${escapeHtml(priority.confidenceNote || "Source confidence not specified.")}</div>`);
    }
    return blocks.join("");
  }

  function detailRows(item, info) {
    const map = BUNGIE.items?.[item.id] || {};
    const values = [
      ["Type", [item.kind, item.className, item.slot, item.type].filter(Boolean).join(" / ")],
      ["Element", item.element || "None listed"],
      ["Catalog ID", item.id],
      ["Collectible", (map.collectibleHashes || []).join(", ") || "Not mapped"],
      ["Catalyst records", (map.catalystRecordHashes || []).join(", ") || (item.kind === "weapon" ? "None mapped" : "Armor item")],
      ["Confidence", item.priority?.confidence || info.confidence]
    ];
    return `<div class="help-details">${values.map(([label, value]) => `<div class="help-detail"><span>${escapeHtml(label)}</span><strong title="${escapeHtml(value)}">${escapeHtml(value)}</strong></div>`).join("")}</div>`;
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
      const rows = userIds.map(player => {
        const row = state.weapons?.[item.id]?.[player] || {};
        const name = users[player]?.short || users[player]?.label || player;
        return `<div class="help-status-row"><span>${escapeHtml(name)}</span><span class="${statusClass(row.owned)}">Own</span><span class="${statusClass(row.catalyst)}">Cat</span><span class="${statusClass(row.complete)}">Done</span></div>`;
      }).join("");
      return `<div class="help-subhead">Collection state</div><div class="help-status-list">${rows}</div>`;
    }
    const className = item.className;
    const rows = userIds.map(player => {
      const row = state.armor?.[className]?.[item.id]?.[player] || {};
      const name = users[player]?.short || users[player]?.label || player;
      return `<div class="help-status-row"><span>${escapeHtml(name)}</span><span class="${statusClass(row.owned)}">Own</span><span></span><span></span></div>`;
    }).join("");
    return `<div class="help-subhead">Collection state</div><div class="help-status-list">${rows}</div>`;
  }

  function addHelpButtons() {
    document.querySelectorAll(".weapon-card,.armor-card").forEach(card => {
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

  function showHelp(id) {
    const item = itemMap.get(id);
    if (!item) return;
    lastHelpTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const info = routeFor(item);
    const meta = [item.kind, item.className, item.slot, item.type, item.element]
      .filter(Boolean)
      .map(v => `<span class="badge">${escapeHtml(v)}</span>`)
      .join("");
    const priorityMeta = item.priority?.confidence ? `<span class="help-confidence" title="${escapeHtml(item.priority.confidenceNote || "")}">${escapeHtml(item.priority.confidence)}</span>` : "";
    panel.querySelector("#helpTitle").textContent = item.name;
    panel.querySelector("#helpMeta").innerHTML = meta + priorityMeta;
    panel.querySelector("#helpBody").innerHTML = `
      <div class="help-grid">
        <div class="help-source"><strong>Bungie source</strong>${escapeHtml(info.source)}</div>
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

    const clickable = event.target.closest(".item-help-btn,.status-cell") ||
      (document.documentElement.classList.contains("layout-simple") ? event.target.closest(".weapon-card,.armor-card") : null);
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

  const observer = new MutationObserver(addHelpButtons);
  observer.observe(document.body, { childList: true, subtree: true });
  addHelpButtons();
})();
