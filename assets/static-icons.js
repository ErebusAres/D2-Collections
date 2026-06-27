(() => {
  const CATALOG = window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: {} };
  const ICON_MAP = window.D2_COLLECTIONS_ICON_MAP || {};
  const BUNGIE_MAP = window.D2_COLLECTIONS_BUNGIE_COLLECTIBLES || { items: {} };
  const items = [
    ...(CATALOG.weapons || []),
    ...Object.values(CATALOG.armor || {}).flatMap(list => Array.isArray(list) ? list : [])
  ];
  items.forEach(item => {
    if (!item) return;
    const icon = ICON_MAP[item.id];
    if (icon && !item.icon && !item.iconUrl) item.icon = icon;
    const sourceStrings = BUNGIE_MAP.items?.[item.id]?.sourceStrings || [];
    if (sourceStrings.length) item.bungieSource = sourceStrings.join(" / ");
  });
})();
