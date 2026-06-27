(() => {
  const CATALOG = window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: {} };
  const BUNGIE = window.D2_COLLECTIONS_BUNGIE_COLLECTIBLES || { items: {} };

  const css = `
    .weapon-card,.armor-card{position:relative}
    .weapon-card .status-cell,.armor-card .status-cell{cursor:help}
    .item-help-btn{flex:0 0 auto;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:var(--soft);border-radius:999px;width:24px;height:24px;display:inline-grid;place-items:center;font-size:.78rem;font-weight:900;line-height:1}
    .item-help-btn:hover,.item-help-btn:focus-visible{border-color:rgba(243,189,79,.45);color:var(--gold);outline:0}
    .item-name{min-width:0}
    .help-panel{position:fixed;z-index:70;right:16px;top:16px;width:min(430px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;border:1px solid var(--line);border-radius:18px;background:#10151f;box-shadow:0 24px 80px rgba(0,0,0,.55);padding:14px;transform:translateX(calc(100% + 24px));transition:transform .18s ease}
    .help-panel.open{transform:translateX(0)}
    .help-panel-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px}
    .help-panel h2{font-size:1.05rem;line-height:1.2;margin:0}
    .help-close{border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.06);color:var(--text);width:32px;height:32px;flex:0 0 auto}
    .help-grid{display:grid;gap:8px;margin:10px 0}
    .help-source{border:1px solid rgba(243,189,79,.2);background:rgba(243,189,79,.07);border-radius:12px;padding:9px 10px;color:var(--soft);font-size:.84rem;line-height:1.4}
    .help-source strong{display:block;color:var(--gold);font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px}
    .help-steps{margin:8px 0 0;padding-left:20px;color:var(--soft);font-size:.88rem;line-height:1.45}
    .help-steps li{margin:6px 0}
    .help-note{color:var(--muted);font-size:.78rem;line-height:1.45;margin-top:10px}
    .help-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .help-subhead{color:var(--gold);font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;font-weight:900;margin-top:12px}
    @media(max-width:780px){.help-panel{left:10px;right:10px;top:auto;bottom:10px;width:auto;max-height:72vh;border-radius:16px;transform:translateY(calc(100% + 24px))}.help-panel.open{transform:translateY(0)}}
  `;

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const panel = document.createElement("aside");
  panel.className = "help-panel";
  panel.setAttribute("aria-live", "polite");
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
    const info = routeFor(item);
    const meta = [item.kind, item.className, item.slot, item.type, item.element]
      .filter(Boolean)
      .map(v => `<span class="badge">${escapeHtml(v)}</span>`)
      .join("");
    panel.querySelector("#helpTitle").textContent = item.name;
    panel.querySelector("#helpMeta").innerHTML = meta;
    panel.querySelector("#helpBody").innerHTML = `
      <div class="help-grid">
        <div class="help-source"><strong>Bungie source</strong>${escapeHtml(info.source)}</div>
        ${info.localSource && info.localSource !== info.source ? `<div class="help-source"><strong>Catalog tag</strong>${escapeHtml(info.localSource)}</div>` : ""}
      </div>
      <div class="help-subhead">Route</div>
      <ol class="help-steps">${info.steps.map(step => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      <div class="help-note">${escapeHtml(info.confidence)}. Bungie can move acquisition paths; this panel uses the latest static manifest data bundled with the site.</div>
    `;
    panel.classList.add("open");
  }

  document.addEventListener("click", event => {
    const clickable = event.target.closest(".item-help-btn,.status-cell");
    if (clickable?.dataset.helpId) showHelp(clickable.dataset.helpId);
    if (event.target.closest(".help-close")) panel.classList.remove("open");
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") panel.classList.remove("open");
  });

  const observer = new MutationObserver(addHelpButtons);
  observer.observe(document.body, { childList: true, subtree: true });
  addHelpButtons();
})();
