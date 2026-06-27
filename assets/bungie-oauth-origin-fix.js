(() => {
  const nativeFetch = window.fetch?.bind(window);
  if (!nativeFetch || window.D2_BUNGIE_OAUTH_ORIGIN_FIX_INSTALLED) return;

  window.D2_BUNGIE_OAUTH_ORIGIN_FIX_INSTALLED = true;

  window.fetch = (resource, init = {}) => {
    const url = typeof resource === "string" ? resource : resource?.url || "";
    if (!String(url).includes("/Platform/App/OAuth/Token/")) {
      return nativeFetch(resource, init);
    }

    const nextInit = { ...init };
    const sourceHeaders = init.headers || (typeof Request !== "undefined" && resource instanceof Request ? resource.headers : undefined);
    const headers = new Headers(sourceHeaders || {});
    headers.delete("X-API-Key");
    headers.delete("x-api-key");
    nextInit.headers = headers;

    return nativeFetch(resource, nextInit);
  };
})();
