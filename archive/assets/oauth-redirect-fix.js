(() => {
  const AUTH_KEY = "d2-collections-auth-v1";
  const STATE_KEY = "d2-collections-oauth-state-v1";
  const REDIRECT_URI = "https://erebusares.github.io/D2-Collections/index.html";

  function hasSavedCode() {
    try {
      return Boolean(JSON.parse(localStorage.getItem(AUTH_KEY) || "{}").oauthCode);
    } catch {
      return false;
    }
  }

  function hasUsableSession() {
    if (window.D2_COLLECTIONS_AUTH?.sessionIsUsable?.()) return true;
    try {
      const saved = JSON.parse(localStorage.getItem("d2-collections-bungie-session-v2") || "{}");
      const now = Math.floor(Date.now() / 1000) + 60;
      return Boolean(
        (saved.access_token && saved.expires_at > now) ||
        (saved.server_session_token && (!saved.refresh_expires_at || saved.refresh_expires_at > now)) ||
        (saved.refresh_token && (!saved.refresh_expires_at || saved.refresh_expires_at > now))
      );
    } catch {
      return false;
    }
  }

  document.addEventListener("click", event => {
    const button = event.target.closest?.("#loginBtn");
    if (!button || hasSavedCode() || hasUsableSession()) return;
    const config = window.D2_BUNGIE_CONFIG || {};
    const authUrl = config.authUrl || "https://www.bungie.net/en/OAuth/Authorize";
    const clientId = config.clientId || "53180";
    const state = crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(STATE_KEY, state);
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      state
    });
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign(`${authUrl}?${params.toString()}`);
  }, true);
})();
