(() => {
  const CATALOG = window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: { warlock: [], titan: [] } };

  const css = `
    .armor-card { grid-template-columns: minmax(0, 1fr) auto; align-items: center; padding: 7px 9px; min-height: 54px; }
    .armor-card .item-with-icon { grid-template-columns: 34px minmax(0, 1fr); gap: 8px; }
    .armor-card .item-icon, .armor-card .item-icon-fallback { width: 34px; height: 34px; border-radius: 9px; }
    .armor-card .badge.source, .armor-card .badge.focus { display: none; }
    .armor-card h3 { font-size: .88rem; margin-bottom: 1px; }
    .armor-card .badge.slot { font-size: .68rem; padding: 2px 7px; }
    .armor-card .armor-status.header { display: none; }
    .armor-card .status-row { grid-column: 2; grid-row: 1; margin-top: 0; align-self: center; }
    .armor-card .player-label { display: none; }
    .armor-card .status-cell { min-height: 32px; min-width: 44px; padding: 0 8px; cursor: help; }
    .status-grid { grid-template-columns: 72px repeat(3, minmax(62px, 1fr)); }
    .armor-status { grid-template-columns: minmax(44px, 58px); gap: 0; }
    .weapon-card .status-cell { cursor: help; }
    .item-help-btn { border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); color: var(--soft); border-radius: 999px; padding: 3px 7px; font-size: .72rem; margin-left: 7px; }
    .item-help-btn:hover { border-color: rgba(243,189,79,.45); color: var(--gold); }
    .item-name { min-width: 0; }
    .help-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.62); z-index: 50; display: none; align-items: center; justify-content: center; padding: 18px; }
    .help-backdrop.open { display: flex; }
    .help-modal { width: min(760px, 100%); max-height: min(780px, 92vh); overflow: auto; border: 1px solid var(--line); border-radius: 24px; background: #10151f; box-shadow: 0 28px 90px rgba(0,0,0,.55); padding: 18px; }
    .help-modal-head { display: flex; justify-content: space-between; gap: 12px; align-items: start; margin-bottom: 12px; }
    .help-modal h2 { font-size: 1.35rem; }
    .help-close { border: 1px solid var(--line); border-radius: 999px; background: rgba(255,255,255,.06); color: var(--text); width: 34px; height: 34px; }
    .help-steps { margin: 12px 0 0; padding-left: 22px; color: var(--soft); }
    .help-steps li { margin: 8px 0; }
    .help-note { border: 1px solid rgba(243,189,79,.2); background: rgba(243,189,79,.07); border-radius: 14px; padding: 10px 12px; color: var(--soft); margin-top: 12px; }
    .help-meta { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
    .help-subhead { color: var(--gold); font-weight: 800; margin: 14px 0 6px; }
    @media(max-width:780px){ .status-grid{grid-template-columns:62px repeat(3,minmax(52px,1fr));}.armor-card{min-height:50px}.armor-status{grid-template-columns:minmax(42px,54px);} }
  `;

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const modal = document.createElement("div");
  modal.className = "help-backdrop";
  modal.innerHTML = `<section class="help-modal" role="dialog" aria-modal="true" aria-labelledby="helpTitle"><div class="help-modal-head"><div><p class="eyebrow">Unlock help</p><h2 id="helpTitle"></h2><div id="helpMeta" class="help-meta"></div></div><button class="help-close" type="button" aria-label="Close">×</button></div><div id="helpBody"></div></section>`;
  document.body.appendChild(modal);

  function normalize(text) { return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function allItems() { return [...CATALOG.weapons.map(i => ({...i, kind:"weapon"})), ...CATALOG.armor.warlock.map(i => ({...i, kind:"armor", className:"warlock"})), ...CATALOG.armor.titan.map(i => ({...i, kind:"armor", className:"titan"}))]; }

  const itemMap = new Map(allItems().map(item => [item.id, item]));

  const specificRoutes = {
    "wish-ender": ["Start in the Dreaming City and complete the Shattered Throne-related Wish-Ender quest path.", "Bring help if needed; the old quest involves Shattered Throne objectives and token/boss steps.", "After the quest is complete, mark the weapon owned. Wish-Ender does not need normal random farming."],
    "xenophage": ["Start the Shadowkeep exotic quest path on the Moon.", "Complete the rune/puzzle steps, then enter Pit of Heresy for the quest boss section.", "Finish the quest encounter to claim Xenophage; this is deterministic, not a random drop."],
    "divinity": ["Own Shadowkeep and get the Divinity quest from the Moon/Garden setup path.", "Complete the Garden of Salvation raid with the Divinity puzzles in one run.", "Finish the final boss after all puzzles are complete to claim Divinity."],
    "gjallarhorn": ["Own the 30th Anniversary content and start the Gjallarhorn quest from Shaw Han/Xur path.", "Run Grasp of Avarice and complete the quest objectives tied to the dungeon.", "Return to the quest vendor steps and claim Gjallarhorn; then complete catalyst requirements separately."],
    "malfeasance": ["Pick up or continue the Gambit exotic quest path.", "Complete the Taken/Gambit objectives and required strike/mission steps.", "Finish the invasion/team-wipe style Gambit objective or have a teammate complete the eligible step if the quest allows it."],
    "outbreak-perfected": ["Launch Zero Hour when available.", "Complete the mission to unlock Outbreak Perfected.", "Rerun the mission on the required difficulty/weekly path for catalyst and intrinsic progress."],
    "whisper-of-the-worm": ["Launch The Whisper when available.", "Complete the mission to unlock Whisper of the Worm.", "Rerun for catalyst/intrinsics if needed."],
    "vexcalibur": ["Launch Avalon when available or continue the Vexcalibur quest path.", "Complete the mission to unlock Vexcalibur.", "Rerun for catalysts/intrinsics as required."],
    "euphony": ["Run Salvation's Edge and focus on the raid exotic drop path.", "Complete any triumphs that boost raid exotic drop chance.", "Farm only when the raid is eligible for repeat exotic chances; otherwise do weekly clears."],
    "whirling-ovation": ["Run Desert Perpetual and focus on the final encounter exotic drop path.", "Complete raid triumphs that increase exotic drop chance if available.", "Do weekly clears or featured-raid farming if Bungie enables repeat exotic chances."],
    "buried-bloodline": ["Run Warlord's Ruin and focus on the final encounter exotic drop path.", "Complete dungeon triumphs that boost the exotic drop chance.", "Farm during the featured dungeon week if repeat exotic drops are enabled."],
    "the-navigator": ["Run Ghosts of the Deep and focus on the final encounter exotic drop path.", "Complete triumphs that boost the exotic drop chance.", "Farm during the featured dungeon week if repeat exotic drops are enabled."],
    "hierarchy-of-needs": ["Run Spire of the Watcher and focus on the final encounter exotic drop path.", "Complete triumphs that boost the exotic drop chance.", "Farm during the featured dungeon week if repeat exotic drops are enabled."],
    "heartshadow": ["Run Duality and focus on the final encounter exotic drop path.", "Complete triumphs that boost the exotic drop chance.", "Farm during the featured dungeon week if repeat exotic drops are enabled."],
    "ice-breaker": ["Run Vesper's Host and focus on the dungeon exotic path.", "Complete any available triumphs or quest steps that improve/enable the drop.", "Farm during the featured dungeon week if repeat exotic drops are enabled."],
    "khvostov-7g-0x": ["Progress The Pale Heart post-campaign collectible/quest path.", "Collect the required regional items and complete the associated Pale Heart objectives.", "Finish the final quest step to claim Khvostov 7G-0X."],
    "final-warning": ["Complete the Lightfall campaign and unlock Strand systems on the character.", "Pick up the Final Warning exotic quest from Neomuna once available.", "Complete the quest objectives to claim the Strand sidearm."],
    "deterministic-chaos": ["Complete Lightfall campaign access requirements.", "Start the Unfinished Business exotic quest on Neomuna.", "Complete the quest chain and final mission to claim Deterministic Chaos."],
    "parasite": ["Complete The Witch Queen campaign access requirements.", "Start and complete the Of Queens and Worms exotic quest.", "Finish the final mission step to claim Parasite."],
    "the-lament": ["Complete Beyond Light campaign access requirements.", "Start the Lost Lament exotic quest on Europa.", "Complete the Exo/Bunker/Eurpoa quest chain to claim The Lament."],
    "salvation-s-grip": ["Complete Beyond Light campaign access requirements.", "Start the Stasis grenade launcher quest from the Exo Stranger/Europa path.", "Complete the quest chain to claim Salvation's Grip."],
    "deathbringer": ["Complete Shadowkeep campaign access requirements.", "Start the Memory of Sai Mota/Symphony of Death quest path on the Moon.", "Complete the quest chain to claim Deathbringer."]
  };

  function addHelpButtons() {
    document.querySelectorAll(".weapon-card,.armor-card").forEach(card => {
      if (card.querySelector(".item-help-btn")) return;
      const id = card.dataset.id;
      const title = card.querySelector(".item-name");
      if (!id || !title) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "item-help-btn";
      btn.textContent = "?";
      btn.title = "How to unlock";
      btn.dataset.helpId = id;
      title.appendChild(btn);
      card.querySelectorAll(".status-cell").forEach(cell => {
        cell.dataset.helpId = id;
        cell.title = `${cell.title || "Status"} — click for unlock help`;
      });
    });
  }

  function routeFor(item) {
    const s = normalize(item.source);
    const steps = [...(specificRoutes[item.id] || item.unlockSteps || [])];
    let note = item.unlockNote || "Sources can move when Bungie changes acquisition paths. If this says Monument, kiosk, Rahool, rotator, or a vendor, check that source first.";

    if (!steps.length && (s.includes("world") || s.includes("rahool"))) {
      steps.push("Open Master Rahool in the Tower and check focused exotic decoding first.");
      steps.push("If it is not focusable yet, earn Exotic Engrams from weekly ritual/pathfinder rewards, high-end activities, or rank resets.");
      steps.push("Use class-specific focusing when possible so armor drops land on the correct class.");
    } else if (!steps.length && (s.includes("monument") || s.includes("legacy") || s.includes("kiosk"))) {
      steps.push("Go to the Monument to Lost Lights kiosk in the Tower, between the Vault terminals.");
      steps.push("Check the listed expansion/legacy section for the item.");
      steps.push("Bring the required Exotic Cipher, Ascendant Shard, Glimmer, and any expansion material the kiosk asks for.");
    } else if (!steps.length && s.includes("xur")) {
      steps.push("Check Xur from Friday reset through Tuesday reset.");
      steps.push("Inspect his direct exotic inventory and any exotic weapon/armor focusing options available that weekend.");
      steps.push("If it is not sold, keep it on the missing list and check again next weekend.");
    } else if (!steps.length && (s.includes("raid") || s.includes("root") || s.includes("salvation") || s.includes("vow") || s.includes("vault") || s.includes("king") || s.includes("last wish") || s.includes("garden") || s.includes("deep stone") || s.includes("desert"))) {
      steps.push("Run the listed raid and prioritize the final boss or exotic-specific quest step tied to that raid.");
      steps.push("Complete triumphs that increase exotic drop chance if the raid offers a drop-rate boost.");
      steps.push("Farm when the raid is the weekly featured rotator, if that raid supports repeat farming.");
    } else if (!steps.length && (s.includes("dungeon") || s.includes("spire") || s.includes("warlord") || s.includes("ghosts") || s.includes("duality") || s.includes("vesper") || s.includes("grasp"))) {
      steps.push("Run the listed dungeon and prioritize the final encounter or exotic quest path.");
      steps.push("Complete triumphs that increase exotic drop chance if available.");
      steps.push("Farm during the weekly featured dungeon window when the exotic is farmable.");
    } else if (!steps.length && (s.includes("campaign") || s.includes("lightfall") || s.includes("witch queen") || s.includes("beyond light") || s.includes("shadowkeep") || s.includes("final shape") || s.includes("edge of fate") || s.includes("pale heart"))) {
      steps.push("Finish the related expansion campaign or unlock quest chain on the correct character.");
      steps.push("Check quest vendors and post-campaign quest markers for the exotic quest.");
      steps.push("For armor, complete the campaign/Legend option if it is offered, then use Rahool focusing for better rolls later.");
    } else if (!steps.length && (s.includes("exotic mission") || s.includes("zero hour") || s.includes("whisper") || s.includes("avalon") || s.includes("seraph") || s.includes("encore"))) {
      steps.push("Open the Exotic Mission rotator or the listed exotic mission node when available.");
      steps.push("Complete the mission once to unlock the weapon, then rerun on higher/weekly modes if catalysts or intrinsics are needed.");
      steps.push("Check the mission details before launching because the available exotic missions rotate.");
    } else if (!steps.length && s.includes("gambit")) {
      steps.push("Pick up or continue the Gambit-related exotic quest if available.");
      steps.push("Play Gambit and complete the specific quest objectives tied to the weapon.");
      steps.push("If the quest was vaulted, check Monument to Lost Lights or the quest archive.");
    } else if (!steps.length) {
      steps.push("Check the source tag on this card, then search the Director for that destination/activity/vendor first.");
      steps.push("If the item does not appear there, check Monument to Lost Lights, Rahool focusing, and the Quest Archive.");
      steps.push("Keep it marked missing until the exact source is confirmed from the current season/expansion path.");
      note = "This item needs a more specific source note in the catalog for exact step-by-step routing.";
    }

    if (item.kind === "weapon") {
      steps.push("After the weapon is owned, track catalyst obtained and catalyst complete separately on this checklist.");
    }

    return { steps, note };
  }

  function showHelp(id) {
    const item = itemMap.get(id);
    if (!item) return;
    const info = routeFor(item);
    modal.querySelector("#helpTitle").textContent = item.name;
    modal.querySelector("#helpMeta").innerHTML = [item.kind, item.className, item.slot, item.type, item.element, item.source].filter(Boolean).map(v => `<span class="badge">${v}</span>`).join("");
    modal.querySelector("#helpBody").innerHTML = `<div class="help-subhead">Most efficient route</div><ol class="help-steps">${info.steps.map(step => `<li>${step}</li>`).join("")}</ol><div class="help-note">${info.note}</div>`;
    modal.classList.add("open");
  }

  document.addEventListener("click", event => {
    const clickable = event.target.closest(".item-help-btn,.status-cell");
    if (clickable?.dataset.helpId) showHelp(clickable.dataset.helpId);
    if (event.target.closest(".help-close") || event.target === modal) modal.classList.remove("open");
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape") modal.classList.remove("open"); });

  const observer = new MutationObserver(addHelpButtons);
  observer.observe(document.body, { childList: true, subtree: true });
  addHelpButtons();
})();
