(() => {
  const AUTH_KEY = "d2-collections-auth-v1";
  const SESSION_KEY = "d2-collections-bungie-session-v2";
  const API_KEY_STORAGE = "d2-collections-bungie-api-key";

  const css = `
    .auth-chip{display:flex;align-items:center;gap:8px;position:relative;z-index:1}.auth-chip .count-pill{background:rgba(0,0,0,.28)}.auth-chip.is-signed-in .count-pill{color:var(--green);border-color:rgba(70,217,141,.3);background:rgba(70,217,141,.08)}.auth-chip.is-signed-in #loginBtn{color:var(--gold-bright);border-color:rgba(216,177,91,.34);background:rgba(216,177,91,.1);font-weight:800}@media(max-width:780px){.hero-actions{justify-content:flex-start}.auth-chip{width:100%;justify-content:space-between;flex-wrap:wrap}}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  function readAuth() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "{}"); }
    catch { return {}; }
  }

  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "{}"); }
    catch { return {}; }
  }

  function signedIn() {
    if (window.D2_COLLECTIONS_AUTH?.sessionIsUsable?.()) return true;
    const saved = readSession();
    const now = Math.floor(Date.now() / 1000) + 60;
    return Boolean(
      readAuth().oauthCode ||
      (saved.access_token && saved.expires_at > now) ||
      (saved.server_session_token && (!saved.refresh_expires_at || saved.refresh_expires_at > now)) ||
      (saved.refresh_token && (!saved.refresh_expires_at || saved.refresh_expires_at > now))
    );
  }

  function clearBungieSession() {
    window.D2_COLLECTIONS_AUTH?.clearSession?.();
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(API_KEY_STORAGE);
  }

  function render() {
    const chip = document.querySelector(".auth-chip");
    const status = document.querySelector("#apiStatus");
    const btn = document.querySelector("#loginBtn");
    if (!chip || !status || !btn) return;
    const hasAuth = signedIn();
    chip.classList.toggle("is-signed-in", hasAuth);
    if (status.textContent !== (hasAuth ? "Bungie linked" : "Bungie offline")) status.textContent = hasAuth ? "Bungie linked" : "Bungie offline";
    if (btn.textContent !== (hasAuth ? "Refresh Bungie login" : "Login with Bungie")) btn.textContent = hasAuth ? "Refresh Bungie login" : "Login with Bungie";
    btn.title = hasAuth ? "Refresh Bungie authorization. Alt-click to clear the saved session." : "Sign in with Bungie";
  }

  document.addEventListener("click", event => {
    const btn = event.target.closest("#loginBtn");
    if (!btn || !signedIn() || !event.altKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    clearBungieSession();
    render();
  }, true);

  window.addEventListener("storage", render);
  setTimeout(render, 0);
  setTimeout(render, 400);
  window.D2_RENDER_COMPACT_AUTH = render;
})();
