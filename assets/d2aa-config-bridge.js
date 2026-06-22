(() => {
  const D2AA_CONFIG_KEY = "d2aa_bungie_public_config_v1";
  const COLLECTIONS_KEY = "d2-collections-bungie-api-key";
  try {
    const existing = localStorage.getItem(COLLECTIONS_KEY);
    if (existing) return;
    const d2aaConfig = JSON.parse(localStorage.getItem(D2AA_CONFIG_KEY) || "{}");
    if (d2aaConfig.apiKey) localStorage.setItem(COLLECTIONS_KEY, d2aaConfig.apiKey);
  } catch {}
})();
