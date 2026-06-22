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
  upsertWeapon({ id: "praxic-blade", name: "Praxic Blade", slot: "Power", type: "Sword", element: "Solar", source: "Renegades campaign / Praxic Temple" });
  upsertWeapon({ id: "new-malpais", name: "New Malpais", slot: "Kinetic", type: "Hand Cannon", element: "Kinetic", source: "Renegades / source pending manifest validation" });
})();
