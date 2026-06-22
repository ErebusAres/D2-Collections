(() => {
  const CATALOG = window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: {} };
  const BUNGIE = window.D2_BUNGIE_CONFIG || {};
  const CACHE_KEY = "d2-collections-icon-cache-strict-v1";
  const OLD_KEYS = ["d2-collections-icon-cache-v1", "d2-collections-icon-cache-v2"];
  const CLASS_TYPES = { titan: 0, hunter: 1, warlock: 2 };
  const BUCKETS = {
    kinetic: 1498876634,
    energy: 2465295065,
    power: 953998645,
    helmet: 3448274439,
    gauntlets: 3551918588,
    chest: 14239492,
    legs: 20886954
  };

  function normalize(name) {
    return String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[+']/g, "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
  }

  function armorClasses() { return Object.keys(CATALOG.armor || {}); }
  function catalogItems() {
    return [
      ...(CATALOG.weapons || []).map(item => ({ ...item, kind: "weapon" })),
      ...armorClasses().flatMap(className => (CATALOG.armor[className] || []).map(item => ({ ...item, kind: "armor", className })))
    ];
  }

  function bucketHashFor(item) {
    if (item.kind === "weapon") return BUCKETS[normalize(item.slot)];
    return BUCKETS[normalize(item.slot)];
  }

  function isLikelyRealItem(def, item) {
    const display = def.displayProperties || {};
    if (!display.name || !display.icon) return false;
    if (normalize(display.name) !== normalize(item.name)) return false;
    if (display.hasIcon === false) return false;
    if (def.redacted) return false;
    if (def.collectibleHash && !def.inventory && !def.equippingBlock) return false;
    if (item.kind === "weapon" && def.itemType !== 3) return false;
    if (item.kind === "armor" && def.itemType !== 2) return false;
    return true;
  }

  function scoreDefinition(def, item) {
    let score = 0;
    const bucketHash = bucketHashFor(item);
    const bucket = def.inventory?.bucketTypeHash;
    const categories = def.itemCategoryHashes || [];
    if (bucketHash && bucket === bucketHash) score += 60;
    if (def.inventory?.tierType === 6) score += 35;
    if (def.inventory?.tierTypeName === "Exotic") score += 35;
    if (item.kind === "weapon") {
      if (def.itemType === 3) score += 40;
      if (def.equippingBlock) score += 10;
      if (def.itemSubTypeName && normalize(def.itemSubTypeName).includes(normalize(item.type))) score += 20;
      if (categories.includes(1)) score += 4;
    }
    if (item.kind === "armor") {
      if (def.itemType === 2) score += 40;
      if (def.classType === CLASS_TYPES[item.className]) score += 45;
      if (def.classType === 3) score -= 25;
      if (categories.includes(20)) score += 4;
    }
    if (def.screenshot) score += 2;
    if (def.displayProperties?.icon?.includes("icons")) score += 2;
    const icon = def.displayProperties?.icon || "";
    const lowerIcon = icon.toLowerCase();
    if (lowerIcon.includes("collectible") || lowerIcon.includes("record") || lowerIcon.includes("emblem")) score -= 80;
    return score;
  }

  function setRenderedIcons(iconMap) {
    catalogItems().forEach(item => {
      const icon = iconMap[item.id];
      if (icon) {
        const original = findOriginalItem(item);
        if (original) original.icon = icon;
      }
    });
    document.querySelectorAll("[data-id]").forEach(card => {
      const icon = iconMap[card.dataset.id];
      if (!icon) return;
      const src = icon.startsWith("/") ? `https://www.bungie.net${icon}` : icon;
      const current = card.querySelector(".item-icon, .item-icon-fallback");
      if (!current) return;
      if (current.tagName === "IMG") current.src = src;
      else {
        const img = document.createElement("img");
        img.className = "item-icon";
        img.src = src;
        img.alt = `${card.dataset.id} icon`;
        img.loading = "lazy";
        current.replaceWith(img);
      }
    });
  }

  function findOriginalItem(item) {
    if (item.kind === "weapon") return (CATALOG.weapons || []).find(x => x.id === item.id);
    return (CATALOG.armor?.[item.className] || []).find(x => x.id === item.id);
  }

  async function loadStrictIcons() {
    try {
      OLD_KEYS.forEach(key => localStorage.removeItem(key));
      const manifest = await (await fetch(`${BUNGIE.apiRoot || "https://www.bungie.net/Platform"}/Destiny2/Manifest/`)).json();
      const response = manifest.Response || manifest.response || manifest;
      const version = response.version || "unknown";
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached?.version === version && cached?.icons) {
        setRenderedIcons(cached.icons);
        return;
      }
      const paths = response.jsonWorldComponentContentPaths || response.jsonWorldContentPaths || {};
      const langPaths = paths.en || paths[Object.keys(paths)[0]] || {};
      const inventoryPath = langPaths.DestinyInventoryItemDefinition;
      if (!inventoryPath) return;
      const url = inventoryPath.startsWith("http") ? inventoryPath : `https://www.bungie.net${inventoryPath}`;
      const definitions = await (await fetch(url)).json();
      const defsByName = new Map();
      Object.values(definitions).forEach(def => {
        const key = normalize(def.displayProperties?.name);
        if (!key) return;
        if (!defsByName.has(key)) defsByName.set(key, []);
        defsByName.get(key).push(def);
      });

      const icons = {};
      const audit = [];
      catalogItems().forEach(item => {
        const candidates = (defsByName.get(normalize(item.name)) || []).filter(def => isLikelyRealItem(def, item));
        const ranked = candidates.map(def => ({ def, score: scoreDefinition(def, item) })).sort((a, b) => b.score - a.score);
        const best = ranked[0];
        if (best && best.score > 50) {
          icons[item.id] = best.def.displayProperties.icon;
          audit.push({ id: item.id, name: item.name, score: best.score, icon: best.def.displayProperties.icon });
        } else {
          audit.push({ id: item.id, name: item.name, missing: true, candidateCount: candidates.length });
        }
      });
      localStorage.setItem(CACHE_KEY, JSON.stringify({ version, icons, audit, savedAt: new Date().toISOString() }));
      window.D2_COLLECTIONS_ICON_AUDIT = audit;
      setRenderedIcons(icons);
      console.info("D2 Collections strict icon audit", audit);
    } catch (error) {
      console.warn("D2 Collections strict icon load failed", error);
    }
  }

  setTimeout(loadStrictIcons, 700);
})();
