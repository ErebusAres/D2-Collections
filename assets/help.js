(() => {
  const CATALOG = window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: { warlock: [], titan: [] } };

  const css = `
    .armor-card { padding: 9px 10px; }
    .armor-card .item-with-icon { grid-template-columns: 38px minmax(0, 1fr); gap: 9px; }
    .armor-card .item-icon, .armor-card .item-icon-fallback { width: 38px; height: 38px; border-radius: 10px; }
    .armor-card .badge.source { display: none; }
    .armor-card h3 { font-size: .9rem; margin-bottom: 2px; }
    .armor-card .armor-status.header { display: none; }
    .armor-card .status-row { margin-top: 4px; }
    .armor-card .status-cell { min-height: 28px; }
    .status-grid { grid-template-columns: 72px repeat(3, minmax(62px, 1fr)); }
    .armor-status { grid-template-columns: 52px minmax(54px, 72px); }
    .item-help-btn { border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); color: var(--soft); border-radius: 999px; padding: 3px 7px; font-size: .72rem; margin-left: 7px; }
    .item-help-btn:hover { border-color: rgba(243,189,79,.45); color: var(--gold); }
    .item-name { min-width: 0; }
    .help-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.62); z-index: 50; display: none; align-items: center; justify-content: center; padding: 18px; }
    .help-backdrop.open { display: flex; }
    .help-modal { width: min(720px, 100%); max-height: min(760px, 92vh); overflow: auto; border: 1px solid var(--line); border-radius: 24px; background: #10151f; box-shadow: 0 28px 90px rgba(0,0,0,.55); padding: 18px; }
    .help-modal-head { display: flex; justify-content: space-between; gap: 12px; align-items: start; margin-bottom: 12px; }
    .help-modal h2 { font-size: 1.35rem; }
    .help-close { border: 1px solid var(--line); border-radius: 999px; background: rgba(255,255,255,.06); color: var(--text); width: 34px; height: 34px; }
    .help-steps { margin: 12px 0 0; padding-left: 22px; color: var(--soft); }
    .help-steps li { margin: 8px 0; }
    .help-note { border: 1px solid rgba(243,189,79,.2); background: rgba(243,189,79,.07); border-radius: 14px; padding: 10px 12px; color: var(--soft); margin-top: 12px; }
    .help-meta { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
    @media(max-width:780px){ .status-grid{grid-template-columns:62px repeat(3,minmax(52px,1fr));}.armor-status{grid-template-columns:44px minmax(54px,72px);} }
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
    });
  }

  function routeFor(item) {
    const s = normalize(item.source);
    const name = item.name;
    const steps = [];
    let note = "Sources can move when Bungie changes acquisition paths. If this says Monument, kiosk, Rahool, or rotator, check that vendor/activity first.";

    if (s.includes("world") || s.includes("rahool")) {
      steps.push("Open Master Rahool in the Tower and check focused exotic decoding first.");
      steps.push("If it is not focusable yet, earn Exotic Engrams from weekly ritual/pathfinder rewards, high-end activities, or rank resets.");
      steps.push("Use class-specific focusing when possible so armor drops land on the correct class.");
    } else if (s.includes("monument") || s.includes("legacy") || s.includes("kiosk")) {
      steps.push("Go to the Monument to Lost Lights kiosk in the Tower, between the Vault terminals.");
      steps.push("Check the listed expansion/legacy section for the item.");
      steps.push("Bring the required Exotic Cipher, Ascendant Shard, Glimmer, and any expansion material the kiosk asks for.");
    } else if (s.includes("xur")) {
      steps.push("Check Xur from Friday reset through Tuesday reset.");
      steps.push("Inspect his direct exotic inventory and any exotic weapon/armor focusing options available that weekend.");
      steps.push("If it is not sold, keep it on the missing list and check again next weekend.");
    } else if (s.includes("raid") || s.includes("root") || s.includes("salvation") || s.includes("vow") || s.includes("vault") || s.includes("king") || s.includes("last wish") || s.includes("garden") || s.includes("deep stone")) {
      steps.push("Run the listed raid and prioritize the final boss or exotic-specific quest step tied to that raid.");
      steps.push("Complete triumphs that increase exotic drop chance if the raid offers a drop-rate boost.");
      steps.push("Farm when the raid is the weekly featured rotator, if that raid supports repeat farming.");
    } else if (s.includes("dungeon") || s.includes("spire") || s.includes("warlord") || s.includes("ghosts") || s.includes("duality") || s.includes("vesper")) {
      steps.push("Run the listed dungeon and prioritize the final encounter or exotic quest path.");
      steps.push("Complete triumphs that increase exotic drop chance if available.");
      steps.push("Farm during the weekly featured dungeon window when the exotic is farmable.");
    } else if (s.includes("campaign") || s.includes("lightfall") || s.includes("witch queen") || s.includes("beyond light") || s.includes("shadowkeep") || s.includes("final shape") || s.includes("edge of fate")) {
      steps.push("Finish the related expansion campaign or unlock quest chain on the correct character.");
      steps.push("Check quest vendors and post-campaign quest markers for the exotic quest.");
      steps.push("For armor, complete the campaign/Legend option if it is offered, then use Rahool focusing for better rolls later.");
    } else if (s.includes("exotic mission") || s.includes("zero hour") || s.includes("whisper") || s.includes("avalon") || s.includes("seraph") || s.includes("encore")) {
      steps.push("Open the Exotic Mission rotator or the listed exotic mission node when available.");
      steps.push("Complete the mission once to unlock the weapon, then rerun on higher/weekly modes if catalysts or intrinsics are needed.");
      steps.push("Check the mission details before launching because the available exotic missions rotate.");
    } else if (s.includes("gambit")) {
      steps.push("Pick up or continue the Gambit-related exotic quest if available.");
      steps.push("Play Gambit and complete the specific quest objectives tied to the weapon.");
      steps.push("If the quest was vaulted, check Monument to Lost Lights or the quest archive.");
    } else {
      steps.push("Check the source tag on this card, then search the Director for that destination/activity/vendor first.");
      steps.push("If the item does not appear there, check Monument to Lost Lights, Rahool focusing, and the Quest Archive.");
      steps.push("Keep it marked missing until the exact source is confirmed from the current season/expansion path.");
      note = "This item needs a more specific source note in the catalog for exact step-by-step routing.";
    }

    if (item.kind === "weapon") {
      steps.push("After the weapon is owned, track catalyst obtained and catalyst complete separately on this checklist.");
    }

    return { steps, note, name };
  }

  function showHelp(id) {
    const item = itemMap.get(id);
    if (!item) return;
    const info = routeFor(item);
    modal.querySelector("#helpTitle").textContent = item.name;
    modal.querySelector("#helpMeta").innerHTML = [item.kind, item.className, item.slot, item.type, item.element, item.source].filter(Boolean).map(v => `<span class="badge">${v}</span>`).join("");
    modal.querySelector("#helpBody").innerHTML = `<ol class="help-steps">${info.steps.map(step => `<li>${step}</li>`).join("")}</ol><div class="help-note">${info.note}</div>`;
    modal.classList.add("open");
  }

  document.addEventListener("click", event => {
    const btn = event.target.closest(".item-help-btn");
    if (btn) showHelp(btn.dataset.helpId);
    if (event.target.closest(".help-close") || event.target === modal) modal.classList.remove("open");
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape") modal.classList.remove("open"); });

  const observer = new MutationObserver(addHelpButtons);
  observer.observe(document.body, { childList: true, subtree: true });
  addHelpButtons();
})();
