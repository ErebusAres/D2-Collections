window.D2_BUNGIE_CONFIG = {
  // Public GitHub Pages config. This key is bundled so the static site can call Bungie without prompting.
  apiKey: "939b3c127bfc4ab5aa4e68093becbf30",
  authUrl: "https://www.bungie.net/en/OAuth/Authorize",
  clientId: "53180",
  redirectUri: "https://erebusares.github.io/D2-Collections/index.html",
  tokenUrl: "https://www.bungie.net/Platform/App/OAuth/Token/",
  // Optional Cloudflare Worker URL. Leave blank until the D1 sync worker is deployed.
  cloudSyncApi: "",
  // Disabled for live page load. Runtime manifest scans were too heavy.
  // Use an offline/static icon map instead of fetching Bungie's full manifest in the browser.
  apiRoot: "."
};
