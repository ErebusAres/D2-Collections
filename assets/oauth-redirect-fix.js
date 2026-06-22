(() => {
  const AUTH_KEY = "d2-collections-auth-v1";
  const REDIRECT_URI = "https://erebusares.github.io/D2-Collections/";

  function hasSavedCode() {
    try {
      return Boolean(JSON.parse(localStorage.getItem(AUTH_KEY) || "{}").oauthCode);
    } catch {
      return false;
    }
  }

  document.addEventListener("click", event => {
    const button = event.target.closest?.("#loginBtn");
    if (!button || hasSavedCode()) return;
    const config = window.D2_BUNGIE_CONFIG || {};
    const authUrl = config.authUrl || "https://www.bungie.net/en/OAuth/Authorize";
    const clientId = config.clientId || "53180";
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: REDIRECT_URI
    });
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign(`${authUrl}?${params.toString()}`);
  }, true);
})();
