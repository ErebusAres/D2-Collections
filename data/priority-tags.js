(() => {
  const catalog = window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: {} };
  const bungie = window.D2_COLLECTIONS_BUNGIE_COLLECTIBLES || { items: {} };
  const FINAL_UPDATE_LABEL = "Post June 9 final update";

  const notes = {
    "riskrunner": "Final update catalyst adds Chain Reaction, making an already strong add-clear weapon a high-value pickup.",
    "skyburner-s-oath": "Final update catalyst adds Incandescent plus Burning Ambition, giving it much better Solar build utility.",
    "touch-of-malice": "Final update catalyst swaps into Precision Instrument for stronger sustained precision damage.",
    "one-thousand-voices": "Final update catalyst adds Taken detonations and Blights from explosions.",
    "conditional-finality": "Top-tier utility/damage shotgun with a final-update catalyst tied to Root of Nightmares.",
    "divinity": "Raid support staple; final update catalyst adds Jolting Feedback and Focused Fury.",
    "microcosm": "Reliable high-end damage and shield utility; final update catalyst adds Super and low-health utility.",
    "still-hunt": "Strong precision DPS option; final update catalyst improves precision ammo flow.",
    "witherhoard": "Low-effort area denial and passive damage staple.",
    "gjallarhorn": "Rocket-team staple for Wolfpack Rounds.",
    "tractor-cannon": "Simple, reliable weaken support for bosses and champions.",
    "arbalest": "Easy anti-barrier/shield answer from the kinetic slot.",
    "wish-ender": "Safe long-range anti-barrier utility and dungeon catalyst from the final update.",
    "sunshot": "Solar add-clear staple; final update catalyst adds Loose Change.",
    "graviton-lance": "Void add-clear staple that remains easy to build around.",
    "outbreak-perfected": "Reliable team primary DPS and precision add-clear.",
    "khvostov-7g-0x": "Strong general-purpose kinetic primary; final update catalyst adds Attrition Orbs.",
    "the-lament": "Accessible sword burst/sustain option; final update catalyst adds scorch.",
    "xenophage": "Simple high-impact heavy; final update catalyst adds Chain Reaction and Rampage.",
    "speaker-s-sight": "Premier Solar support Warlock exotic.",
    "rime-coat-raiment": "High-value Stasis turret control exotic.",
    "mataiodoxia": "Strong Strand/Prismatic Warlock suspend utility.",
    "cenotaph-mask": "Ammo economy staple for trace-rifle support.",
    "necrotic-grip": "Core poison-spread exotic for Strand/Thorn/Osteo style builds.",
    "getaway-artist": "Simple, powerful Arc/Prismatic buddy build enabler.",
    "synthoceps": "Titan melee damage staple and simple all-purpose pickup.",
    "pyrogale-gauntlets": "High-impact Solar Titan super damage exotic.",
    "hazardous-propulsion": "Top rocket-sidearm/rocket damage loop exotic.",
    "precious-scars": "Strong team sustain exotic with very low setup.",
    "wishful-ignorance": "High-value Strand melee Titan exotic.",
    "celestial-nighthawk": "Hunter boss damage staple.",
    "star-eater-scales": "Super damage staple across Hunter subclasses.",
    "gyrfalcon-s-hauberk": "Core Void Hunter volatile loop exotic.",
    "omnioculus": "Endgame invisibility/support staple.",
    "gifted-conviction": "Strong Arc/Prismatic survivability and jolting loop.",
    "renewal-grasps": "Stasis damage reduction/control staple.",
    "relativism": "Prismatic Hunter class item build enabler."
  };

  const mustHave = new Set([
    "riskrunner", "skyburner-s-oath", "touch-of-malice", "one-thousand-voices", "conditional-finality",
    "divinity", "microcosm", "still-hunt", "witherhoard", "gjallarhorn", "tractor-cannon", "arbalest",
    "wish-ender", "sunshot", "graviton-lance", "outbreak-perfected", "khvostov-7g-0x", "the-lament",
    "xenophage", "rufus-fury-placeholder", "ergo-sum", "buried-bloodline", "collective-obligation", "whisper-of-the-worm",
    "speaker-s-sight", "rime-coat-raiment", "mataiodoxia", "cenotaph-mask", "necrotic-grip",
    "getaway-artist", "osmiomancy-gloves", "sunbracers", "contraverse-hold", "solipsism",
    "synthoceps", "pyrogale-gauntlets", "hazardous-propulsion", "precious-scars", "wishful-ignorance",
    "abeyant-leap", "cuirass-of-the-falling-star", "stoicism",
    "celestial-nighthawk", "star-eater-scales", "gyrfalcon-s-hauberk", "omnioculus", "gifted-conviction",
    "renewal-grasps", "mothkeeper-s-wraps", "cyrtarachne-s-facade", "mask-of-fealty", "relativism"
  ]);

  const finalCatalyst = new Set([
    "anarchy", "bastion", "collective-obligation", "conditional-finality", "deterministic-chaos",
    "devil-s-ruin", "divinity", "edge-of-action", "edge-of-concurrence", "edge-of-intent", "rufus-fury-placeholder",
    "eyes-of-tomorrow", "khvostov-7g-0x", "the-last-word", "microcosm", "one-thousand-voices", "parasite",
    "still-hunt", "tarrabah", "the-chaperone", "the-lament", "truth", "wavesplitter", "winterbite",
    "wish-ender", "xenophage", "crimson", "coldheart", "merciless", "sunshot", "skyburner-s-oath",
    "riskrunner", "prospector", "hard-light", "touch-of-malice", "the-jade-rabbit", "vex-mythoclast",
    "heirloom"
  ]);

  function normalizeSource(item) {
    return [item.source, item.bungieSource, ...(bungie.items?.[item.id]?.sourceStrings || [])].filter(Boolean).join(" ").toLowerCase();
  }

  function hasBungieSource(item) {
    return Boolean((bungie.items?.[item.id]?.sourceStrings || []).length);
  }

  function trustedSourcePattern(source) {
    return /world drop|exotic engram|exotic archive|monument|rahool|focusing|quest|campaign|season pass|reward pass|rewards pass|episode|exotic mission|xur|dungeon|raid|lost sector|lost sectors|evidence board|starcrossed|vox obscura|pale heart|renegades|edge of fate|final shape|lightfall|witch queen|beyond light|shadowkeep|dares of eternity|empire hunts|zero hour|whisper|avalon|seraph|encore|deep dive|kiosk|guardian games|heliostat|ash & iron|desert perpetual|sundered doctrine|vesper|warlord|spire|ghosts of the deep|duality|grasp of avarice|crotas end|crota|garden of salvation|last wish|vault of glass|king'?s fall|deep stone crypt|vow of the disciple|root of nightmares|salvation'?s edge/.test(source);
  }

  function difficultyForSource(source) {
    if (/unavailable|retired|vaulted|not currently|no longer|pending validation|manual-check/.test(source)) {
      return {
        id: "difficulty-impossible",
        label: "Impossible",
        level: "impossible",
        title: "Currently unavailable, retired, or not reliably obtainable from the listed source."
      };
    }
    if (/raid|garden of salvation|last wish|root of nightmares|vault of glass|king'?s fall|crotas end|crota|deep stone crypt|vow of the disciple|salvation'?s edge|spire of stars|leviathan/.test(source)) {
      return {
        id: "difficulty-impossible",
        label: "Impossible",
        level: "impossible",
        title: "Raid or endgame RNG/quest source. Treat as the highest effort tier unless your group is already farming it."
      };
    }
    if (/dungeon|dual destiny|grandmaster|master|trials|competitive|gambit quest|pit of heresy|warlord|spire of the watcher|ghosts of the deep|duality|grasp of avarice|prophecy/.test(source)) {
      return {
        id: "difficulty-difficult",
        label: "Difficult",
        level: "difficult",
        title: "Requires harder activity completion, PvP/Gambit commitment, or a more involved exotic quest."
      };
    }
    if (/world drop|exotic engram|exotic mission|xur|random|drop/.test(source)) {
      return {
        id: "difficulty-normal",
        label: "Normal",
        level: "normal",
        title: "Obtainable but not fully deterministic, time-gated, or dependent on vendor/engram availability."
      };
    }
    if (/exotic archive|monument|rahool|focusing|quest|campaign|season pass|reward pass|evidence board|starcrossed|vox obscura|pale heart|renegades/.test(source)) {
      return {
        id: "difficulty-easy",
        label: "Easy",
        level: "easy",
        title: "Deterministic or guided source. Materials or quest progress may still be required."
      };
    }
    return {
      id: "difficulty-normal",
      label: "Normal",
      level: "normal",
      title: "Source needs normal manual follow-up; not marked as deterministic or endgame-only."
    };
  }

  function apply(item, kind) {
    if (!item) return;
    const source = normalizeSource(item);
    const tags = [];
    const difficulty = difficultyForSource(source);
    if (mustHave.has(item.id)) tags.push({ id: "must", label: "Must", title: notes[item.id] || "High-priority community PvE pickup after the final update." });
    if (finalCatalyst.has(item.id)) tags.push({ id: "final", label: "Final", title: FINAL_UPDATE_LABEL });
    tags.push({ id: difficulty.id, label: difficulty.label, title: difficulty.title });
    if (source.includes("exotic archive") || source.includes("monument")) {
      tags.push({ id: "easy", label: "Easy", title: "Deterministic pickup from the Exotic Archive/Monument when you have the materials." });
    } else if (source.includes("rahool") || source.includes("focusing")) {
      tags.push({ id: "rahool", label: "Rahool", title: "Deterministic armor pickup through Rahool focusing when requirements and materials are met." });
      tags.push({ id: "easy", label: "Easy", title: "Focusing is deterministic compared with random drops." });
    } else if (/quest|season pass|reward pass|campaign|evidence board|starcrossed|vox obscura|pale heart/.test(source)) {
      tags.push({ id: "easy", label: "Easy", title: "Direct source or quest path; less random than raid/dungeon drops." });
    }
    item.priority = {
      kind,
      mustHave: mustHave.has(item.id),
      finalUpdate: finalCatalyst.has(item.id),
      easyWin: tags.some(tag => tag.id === "easy"),
      rahool: tags.some(tag => tag.id === "rahool"),
      difficulty: difficulty.level,
      difficultyLabel: difficulty.label,
      difficultyTitle: difficulty.title,
      note: notes[item.id] || "",
      tags
    };
    if (hasBungieSource(item)) {
      item.priority.confidence = "Bungie";
      item.priority.confidenceNote = "Acquisition source is backed by Bungie collectible/source data bundled with the site.";
    } else if (source.includes("bungie source not listed")) {
      item.priority.confidence = "Manual";
      item.priority.confidenceNote = "Bungie resolves the item, but does not publish a collectible source string for it.";
    } else if (trustedSourcePattern(source)) {
      item.priority.confidence = "Manifest";
      item.priority.confidenceNote = "Acquisition route matches a known Destiny source pattern; no pending/unknown source remains in the catalog.";
    } else if (mustHave.has(item.id) || finalCatalyst.has(item.id)) {
      item.priority.confidence = "Community meta";
      item.priority.confidenceNote = "Priority tag is based on post-final-update community/buildcraft value and should be revisited after sandbox changes.";
    } else {
      item.priority.confidence = "Manual";
      item.priority.confidenceNote = "Fallback catalog/source judgement; verify in game if acquisition changed.";
    }
    item.priority.finalUpdateLabel = FINAL_UPDATE_LABEL;
  }

  (catalog.weapons || []).forEach(item => apply(item, "weapon"));
  Object.values(catalog.armor || {}).forEach(list => {
    if (Array.isArray(list)) list.forEach(item => apply(item, "armor"));
  });
})();
