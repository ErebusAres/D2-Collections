(() => {
  const catalog = window.D2_COLLECTIONS_CATALOG || (window.D2_COLLECTIONS_CATALOG = { weapons: [], armor: {} });
  catalog.weapons = catalog.weapons || [];

  function upsertWeapon(next) {
    const byId = catalog.weapons.find(item => item.id === next.id);
    if (byId) {
      Object.assign(byId, next);
      return;
    }
    const byName = catalog.weapons.find(item => String(item.name || "").toLowerCase() === String(next.name || "").toLowerCase());
    if (byName) {
      Object.assign(byName, next);
      return;
    }
    catalog.weapons.push(next);
  }

  function upsertArmor(className, next) {
    catalog.armor = catalog.armor || {};
    catalog.armor[className] = catalog.armor[className] || [];
    const list = catalog.armor[className];
    const byId = list.find(item => item.id === next.id);
    if (byId) {
      Object.assign(byId, next);
      return;
    }
    const byName = list.find(item => String(item.name || "").toLowerCase() === String(next.name || "").toLowerCase());
    if (byName) {
      Object.assign(byName, next);
      return;
    }
    list.push(next);
  }

  function sortCatalog() {
    const weaponSlotOrder = { Kinetic: 1, Energy: 2, Power: 3 };
    const armorSlotOrder = { Helmet: 1, Gauntlets: 2, Chest: 3, Legs: 4, "Class Item": 5 };
    catalog.weapons.sort((a, b) => (weaponSlotOrder[a.slot] || 99) - (weaponSlotOrder[b.slot] || 99) || a.name.localeCompare(b.name));
    Object.values(catalog.armor || {}).forEach(list => {
      if (!Array.isArray(list)) return;
      list.sort((a, b) => (armorSlotOrder[a.slot] || 99) - (armorSlotOrder[b.slot] || 99) || a.name.localeCompare(b.name));
    });
  }

  // Correct the Edge of Fate sniper naming. The older D1-style name slipped into the seed catalog.
  const oldLandBeyond = catalog.weapons.find(item => item.id === "no-land-beyond" || item.name === "No Land Beyond");
  if (oldLandBeyond) {
    Object.assign(oldLandBeyond, {
      id: "new-land-beyond",
      name: "New Land Beyond",
      slot: "Kinetic",
      type: "Sniper Rifle",
      element: "Kinetic",
      source: "Edge of Fate / Year of Prophecy"
    });
  } else {
    upsertWeapon({ id: "new-land-beyond", name: "New Land Beyond", slot: "Kinetic", type: "Sniper Rifle", element: "Kinetic", source: "Edge of Fate / Year of Prophecy" });
  }

  upsertWeapon({ id: "barrow-dyad", name: "Barrow-Dyad", slot: "Kinetic", type: "SMG", element: "Strand", source: "Episode: Heresy / The Taken Path / Derealize" });
  upsertWeapon({ id: "arbalest", name: "Arbalest", slot: "Kinetic", type: "Linear Fusion Rifle", element: "Kinetic", source: "World drop" });
  upsertWeapon({ id: "cryosthesia-77k", name: "Cryosthesia 77K", slot: "Kinetic", type: "Sidearm", element: "Stasis", source: "Exotic Archive" });
  upsertWeapon({ id: "cull-s-shadow", name: "Cull's Shadow", slot: "Kinetic", type: "Fusion Rifle", element: "Kinetic", source: "Monuments of Triumph exotic mission" });
  upsertWeapon({ id: "lumina", name: "Lumina", slot: "Kinetic", type: "Hand Cannon", element: "Kinetic", source: "Exotic Archive" });
  upsertWeapon({ id: "necrochasm", name: "Necrochasm", slot: "Kinetic", type: "Auto Rifle", element: "Kinetic", source: "Crota's End" });
  upsertWeapon({ id: "no-time-to-explain", name: "No Time to Explain", slot: "Kinetic", type: "Pulse Rifle", element: "Kinetic", source: "Beyond Light / deluxe bonus" });
  upsertWeapon({ id: "rat-king", name: "Rat King", slot: "Kinetic", type: "Sidearm", element: "Kinetic", source: "Exotic Archive" });
  upsertWeapon({ id: "suros-regime", name: "SUROS Regime", slot: "Kinetic", type: "Auto Rifle", element: "Kinetic", source: "World drop" });
  upsertWeapon({ id: "verglas-curve", name: "Verglas Curve", slot: "Kinetic", type: "Combat Bow", element: "Stasis", source: "Season Pass / Exotic Archive" });
  upsertWeapon({ id: "wish-keeper", name: "Wish-Keeper", slot: "Kinetic", type: "Combat Bow", element: "Strand", source: "Starcrossed" });
  upsertWeapon({ id: "borealis", name: "Borealis", slot: "Energy", type: "Sniper Rifle", element: "Variable", source: "World drop" });
  upsertWeapon({ id: "coldheart", name: "Coldheart", slot: "Energy", type: "Trace Rifle", element: "Arc", source: "World drop" });
  upsertWeapon({ id: "dead-messenger", name: "Dead Messenger", slot: "Energy", type: "Grenade Launcher", element: "Void", source: "Vox Obscura" });
  upsertWeapon({ id: "devil-s-ruin", name: "Devil's Ruin", slot: "Energy", type: "Sidearm", element: "Solar", source: "Exotic Archive" });
  upsertWeapon({ id: "duality", name: "Duality", slot: "Energy", type: "Shotgun", element: "Solar", source: "Exotic Archive" });
  upsertWeapon({ id: "edge-of-action", name: "Edge of Action", slot: "Energy", type: "Glaive", element: "Void", source: "Evidence Board" });
  upsertWeapon({ id: "edge-of-concurrence", name: "Edge of Concurrence", slot: "Energy", type: "Glaive", element: "Arc", source: "Evidence Board" });
  upsertWeapon({ id: "edge-of-intent", name: "Edge of Intent", slot: "Energy", type: "Glaive", element: "Solar", source: "Evidence Board" });
  upsertWeapon({ id: "ergo-sum", name: "Ergo Sum", slot: "Energy", type: "Sword", element: "Variable", source: "The Pale Heart" });
  upsertWeapon({ id: "heirloom", name: "Heirloom", slot: "Energy", type: "Combat Bow", element: "Solar", source: "Equilibrium" });
  upsertWeapon({ id: "lodestar", name: "Lodestar", slot: "Energy", type: "Trace Rifle", element: "Arc", source: "Season Pass" });
  upsertWeapon({ id: "slayer-s-fang", name: "Slayer's Fang", slot: "Energy", type: "Shotgun", element: "Void", source: "Revenant Fortress" });
  upsertWeapon({ id: "the-fourth-horseman", name: "The Fourth Horseman", slot: "Energy", type: "Shotgun", element: "Arc", source: "Exotic Archive" });
  upsertWeapon({ id: "trespasser", name: "Trespasser", slot: "Energy", type: "Sidearm", element: "Arc", source: "Season Pass / Exotic Archive" });
  upsertWeapon({ id: "turncoat", name: "Turncoat", slot: "Energy", type: "Hand Cannon", element: "Void", source: "Rewards Pass" });
  upsertWeapon({ id: "d-a-r-c-i", name: "D.A.R.C.I.", slot: "Power", type: "Sniper Rifle", element: "Arc", source: "World drop" });
  upsertWeapon({ id: "fafnir", name: "Fafnir", slot: "Power", type: "Linear Fusion Rifle", element: "Void", source: "Monument of Triumph" });
  upsertWeapon({ id: "finality-s-auger", name: "Finality's Auger", slot: "Power", type: "Linear Fusion Rifle", element: "Solar", source: "Sundered Doctrine" });
  upsertWeapon({ id: "praxic-blade", name: "Praxic Blade", slot: "Power", type: "Sword", element: "Solar", source: "Renegades campaign / Praxic Temple" });
  upsertWeapon({ id: "service-of-luzaku", name: "Service of Luzaku", slot: "Power", type: "Machine Gun", element: "Strand", source: "Rewards Pass" });
  upsertWeapon({ id: "new-malpais", name: "New Malpais", slot: "Kinetic", type: "Pulse Rifle", element: "Strand", source: "Rewards Pass" });

  upsertArmor("warlock", { id: "deimosuffusion", name: "Deimosuffusion", slot: "Helmet", source: "Exotic Armor Focusing" });
  upsertArmor("warlock", { id: "nezarec-s-sin", name: "Nezarec's Sin", slot: "Helmet", source: "World / Rahool" });
  upsertArmor("warlock", { id: "speaker-s-sight", name: "Speaker's Sight", slot: "Helmet", source: "Exotic Armor Focusing" });
  upsertArmor("warlock", { id: "ophidian-aspect", name: "Ophidian Aspect", slot: "Gauntlets", source: "World / Rahool" });
  upsertArmor("warlock", { id: "mataiodoxia", name: "Mataiodoxía", slot: "Chest", source: "Exotic Armor Focusing" });
  upsertArmor("warlock", { id: "solipsism", name: "Solipsism", slot: "Class Item", source: "The Pale Heart" });

  upsertArmor("titan", { id: "doom-fang-pauldrons", name: "Doom Fang Pauldron", slot: "Gauntlets", source: "World / Rahool" });
  upsertArmor("titan", { id: "wishful-ignorance", name: "Wishful Ignorance", slot: "Gauntlets", source: "Exotic Armor Focusing" });
  upsertArmor("titan", { id: "praxic-vestment", name: "Praxic Vestment", slot: "Chest", source: "Exotic Armor Focusing" });
  upsertArmor("titan", { id: "stoicism", name: "Stoicism", slot: "Class Item", source: "The Pale Heart" });

  upsertArmor("hunter", { id: "shards-of-galanor", name: "Shards of Galanor", slot: "Gauntlets", source: "World / Rahool" });
  upsertArmor("hunter", { id: "moirai", name: "Moirai", slot: "Chest", source: "Exotic Armor Focusing" });
  upsertArmor("hunter", { id: "raiden-flux", name: "Raiden Flux", slot: "Chest", source: "World / Rahool" });
  upsertArmor("hunter", { id: "fortune-s-favor", name: "Fortune's Favor", slot: "Legs", source: "Exotic Armor Focusing" });
  upsertArmor("hunter", { id: "relativism", name: "Relativism", slot: "Class Item", source: "The Pale Heart" });

  sortCatalog();
})();
