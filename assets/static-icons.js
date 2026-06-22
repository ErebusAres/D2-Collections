(() => {
  const CATALOG = window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: {} };
  const ICON_MAP = window.D2_COLLECTIONS_ICON_MAP || {};
  const items = [
    ...(CATALOG.weapons || []),
    ...Object.values(CATALOG.armor || {}).flatMap(list => Array.isArray(list) ? list : [])
  ];
  items.forEach(item => {
    if (!item || item.icon || item.iconUrl) return;
    const icon = ICON_MAP[item.id];
    if (icon) item.icon = icon;
  });
})();
