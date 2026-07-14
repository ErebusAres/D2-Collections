(() => {
  const root = document.querySelector(".d2-site-shell");
  if (!root) return;

  const CONFIG = window.D2_BUNGIE_CONFIG || {};
  const API = String(CONFIG.cloudSyncApi || "").replace(/\/+$/, "");
  const SESSION_KEY = "d2-collections-bungie-session-v2";
  const ACTIVE_PLAYER_KEY = "d2-collections-active-player-v1";
  const GUARDIAN_PROFILE_KEY = "d2-collections-local-guardian-profile-v1";
  const PLAYER_KEYS = { ares: "corey", erebusares: "corey", corey: "corey", icee: "matt", iceededpple: "matt", matt: "matt", fears: "chris", chris: "chris" };
  const STAT_ICONS = {
    season: "assets/dim-icons/bt_season_rank.svg",
    rank: "assets/dim-icons/bt_guardian_rank.svg",
    power: "assets/dim-icons/bt_light_level.svg"
  };
  const CLASS_ICONS = {
    Warlock: "assets/dim-icons/class_warlock.png",
    Titan: "assets/dim-icons/class_titan.png",
    Hunter: "assets/dim-icons/class_hunter.png"
  };
  const els = {
    banner: root.querySelector("#shellBannerArt"),
    emblem: root.querySelector("#shellEmblem"),
    profileButton: root.querySelector("#shellProfileButton"),
    name: root.querySelector("#shellGuardianName"),
    stats: root.querySelector("#shellGuardianStats"),
    xp: root.querySelector("#shellXp"),
    characterMenu: root.querySelector("#shellCharacterMenu"),
    socialButton: root.querySelector("#shellSocialButton"),
    socialCount: root.querySelector("#shellSocialCount"),
    socialDrawer: document.querySelector("#collectionSocialDrawer"),
    socialClose: document.querySelector("#collectionSocialClose"),
    roster: document.querySelector("#collectionSocialList"),
    syncButton: root.querySelector("#shellSyncButton")
  };
  let snapshots = [];
  let selectedCharacterId = "";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
  }

  function sessionIsUsable() {
    const session = readJson(SESSION_KEY);
    const now = Math.floor(Date.now() / 1000) + 60;
    return Boolean(
      (session.access_token && Number(session.expires_at || 0) > now) ||
      (session.server_session_token && (!session.refresh_expires_at || Number(session.refresh_expires_at) > now)) ||
      (session.refresh_token && (!session.refresh_expires_at || Number(session.refresh_expires_at) > now))
    );
  }

  function payload(snapshot) {
    return snapshot?.fireteamSnapshot || snapshot || null;
  }

  function snapshotId(snapshot) {
    const row = payload(snapshot) || {};
    return String(row.primaryMembershipId || row.membershipId || snapshot?.membershipId || "");
  }

  function shortName(snapshot) {
    const row = payload(snapshot) || {};
    const raw = String(row.player || row.shortName || row.playerDisplayName || row.displayName || snapshot?.player || snapshot?.displayName || "Guardian");
    const normalized = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (/ares|corey/.test(normalized)) return "Ares";
    if (/icee|matt/.test(normalized)) return "Icee";
    if (/fears|chris/.test(normalized)) return "Fears";
    return raw.split("#")[0] || "Guardian";
  }

  function playerKey(snapshot) {
    return PLAYER_KEYS[shortName(snapshot).toLowerCase()] || "";
  }

  function iconUrl(path) {
    if (!path) return "";
    return path.startsWith("/") ? `https://www.bungie.net${path}` : path;
  }

  function signedInSnapshot() {
    const local = localGuardianProfile();
    if (sessionIsUsable() && local) return local;
    const session = readJson(SESSION_KEY);
    const ids = [session.primaryMembershipId, session.membershipId, session.destinyMembershipId, session.bungieMembershipId, session.membership_id].filter(Boolean).map(String);
    if (ids.length) return snapshots.find(snapshot => ids.includes(snapshotId(snapshot))) || null;
    const active = String(localStorage.getItem(ACTIVE_PLAYER_KEY) || "");
    return snapshots.find(snapshot => playerKey(snapshot) === active) || null;
  }

  function localGuardianProfile() {
    const saved = readJson(GUARDIAN_PROFILE_KEY);
    return saved?.characterSummaries?.length ? saved : null;
  }

  function accountName(snapshot) {
    const row = payload(snapshot) || {};
    return row.bungieGlobalDisplayName || row.playerDisplayName || row.displayName || shortName(snapshot);
  }

  function upsertLocalProfile(local) {
    if (!local) return;
    const id = snapshotId(local);
    const existing = snapshots.find(snapshot => id && snapshotId(snapshot) === id);
    const previous = payload(existing) || {};
    const previousCharacters = new Map((previous.characterSummaries || []).map(character => [String(character.characterId), character]));
    const merged = {
      ...previous,
      ...local,
      seasonProgress: previous.seasonProgress || local.seasonProgress,
      profileStats: { ...(previous.profileStats || {}), ...(local.profileStats || {}) },
      characterSummaries: (local.characterSummaries || previous.characterSummaries || []).map(character => ({
        ...(previousCharacters.get(String(character.characterId)) || {}),
        ...character
      }))
    };
    snapshots = [merged, ...snapshots.filter(snapshot => !id || snapshotId(snapshot) !== id)];
  }

  function statMarkup(icon, label, value, className = "") {
    if (!value && value !== 0) return "";
    return `<span class="d2-shell-stat ${escapeHtml(className)}" title="${escapeHtml(`${label}: ${value}`)}"><img src="${escapeHtml(icon)}" alt="" aria-hidden="true" /><strong>${escapeHtml(value)}</strong></span>`;
  }

  function selectedCharacter(snapshot) {
    const characters = payload(snapshot)?.characterSummaries || [];
    return characters.find(character => String(character.characterId) === selectedCharacterId) || characters[0] || null;
  }

  function renderIdentity(snapshot) {
    const row = payload(snapshot);
    if (!row) {
      const linked = sessionIsUsable();
      els.name.textContent = linked ? "Loading Guardian..." : "D2 Collections";
      els.stats.innerHTML = `<span class="d2-shell-stat">${linked ? "Syncing profile and characters" : "Sign in to load Guardian identity"}</span>`;
      els.emblem.src = "assets/d2-collections-mark.svg";
      els.banner?.style.removeProperty("background-image");
      els.xp?.style.setProperty("--d2-season-progress", "0%");
      els.characterMenu.innerHTML = "";
      return;
    }
    const character = selectedCharacter(snapshot);
    const season = row.seasonProgress || {};
    const guardianRank = Number(row.profileStats?.guardianRank || 0);
    const power = Number(character?.light || 0);
    const className = character?.className || "";
    els.name.textContent = accountName(snapshot);
    els.stats.innerHTML = [
      season.rank ? statMarkup(STAT_ICONS.season, "Rewards Pass Rank", season.rank) : "",
      guardianRank ? statMarkup(STAT_ICONS.rank, "Guardian Rank", guardianRank) : "",
      className && CLASS_ICONS[className] ? statMarkup(CLASS_ICONS[className], "Class", className, "is-class") : "",
      power ? statMarkup(STAT_ICONS.power, "Power", `+${power}`, "is-power") : ""
    ].filter(Boolean).join("");
    const emblem = character?.emblemPath || character?.emblemIconPath || "";
    els.emblem.src = emblem ? iconUrl(emblem) : "assets/d2-collections-mark.svg";
    const banner = character?.emblemBannerPath || character?.emblemBackgroundPath || row.characterSummaries?.find(item => item.emblemBannerPath || item.emblemBackgroundPath)?.emblemBannerPath || row.characterSummaries?.find(item => item.emblemBackgroundPath)?.emblemBackgroundPath || "";
    if (banner) els.banner.style.backgroundImage = `url("${iconUrl(banner)}")`;
    else els.banner.style.removeProperty("background-image");
    els.xp?.style.setProperty("--d2-season-progress", `${Math.max(0, Math.min(100, Number(season.pct || 0)))}%`);
    renderCharacters(snapshot);
  }

  function renderCharacters(snapshot) {
    const row = payload(snapshot) || {};
    const characters = row.characterSummaries || [];
    els.characterMenu.innerHTML = characters.map(character => {
      const active = String(character.characterId) === String(selectedCharacter(snapshot)?.characterId);
      const icon = character.emblemPath || CLASS_ICONS[character.className] || "assets/d2-collections-mark.svg";
      return `<button class="d2-shell-character-option ${active ? "active" : ""}" type="button" data-shell-character="${escapeHtml(character.characterId)}"><img src="${escapeHtml(iconUrl(icon))}" alt="" aria-hidden="true" /><span><strong>${escapeHtml(character.className || "Guardian")}</strong><small>${escapeHtml(character.raceName || "Character")}</small></span><b>+${escapeHtml(character.light || 0)}</b></button>`;
    }).join("");
  }

  function renderRoster() {
    if (els.socialCount) els.socialCount.textContent = String(snapshots.length);
    if (!els.roster) return;
    els.roster.innerHTML = snapshots.map(snapshot => {
      const row = payload(snapshot) || {};
      const character = row.characterSummaries?.[0] || {};
      const icon = character.emblemPath || CLASS_ICONS[character.className] || "assets/d2-collections-mark.svg";
      const syncedAt = snapshot.syncedAt || row.updatedAt || "";
      return `<button type="button" data-shell-player="${escapeHtml(playerKey(snapshot))}"><img src="${escapeHtml(iconUrl(icon))}" alt="" aria-hidden="true" /><span><strong>${escapeHtml(shortName(snapshot))}</strong><small>${escapeHtml(syncedAt ? new Date(syncedAt).toLocaleString() : "No sync time")}</small></span><b>${escapeHtml(character.light || "")}</b></button>`;
    }).join("") || `<p>No cloud Fireteam snapshots are available yet.</p>`;
  }

  function setMenu(open) {
    els.characterMenu.hidden = !open;
    els.profileButton.setAttribute("aria-expanded", String(open));
  }

  function setSocial(open) {
    if (!els.socialDrawer) return;
    els.socialDrawer.hidden = !open;
    els.socialButton.setAttribute("aria-expanded", String(open));
  }

  async function loadSnapshots() {
    if (!API) return renderIdentity(null);
    try {
      const response = await fetch(`${API}/api/fireteam-snapshots`, { headers: { Accept: "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.message || "Snapshot read failed");
      snapshots = data.snapshots || [];
      upsertLocalProfile(localGuardianProfile());
      renderRoster();
      renderIdentity(signedInSnapshot());
    } catch {
      renderIdentity(signedInSnapshot() || localGuardianProfile());
    }
  }

  els.profileButton?.addEventListener("click", event => {
    event.stopPropagation();
    if (!sessionIsUsable()) {
      document.querySelector("#loginBtn")?.click();
      return;
    }
    setMenu(els.characterMenu.hidden);
  });
  els.characterMenu?.addEventListener("click", event => {
    const button = event.target.closest("[data-shell-character]");
    if (!button) return;
    selectedCharacterId = button.dataset.shellCharacter || "";
    renderIdentity(signedInSnapshot());
    setMenu(false);
  });
  els.socialButton?.addEventListener("click", () => setSocial(els.socialDrawer?.hidden !== false));
  els.socialClose?.addEventListener("click", () => setSocial(false));
  els.roster?.addEventListener("click", event => {
    const button = event.target.closest("[data-shell-player]");
    if (!button?.dataset.shellPlayer) return;
    document.querySelector(`[data-player="${button.dataset.shellPlayer}"]`)?.click();
    setSocial(false);
  });
  els.syncButton?.addEventListener("click", () => {
    const popout = document.querySelector(".sync-popout");
    if (popout) popout.open = !popout.open;
  });
  document.addEventListener("click", event => {
    if (!event.target.closest("#shellProfileButton,#shellCharacterMenu")) setMenu(false);
  });
  window.addEventListener("storage", event => {
    if (event.key === GUARDIAN_PROFILE_KEY) {
      upsertLocalProfile(localGuardianProfile());
      renderRoster();
    }
    if (event.key === SESSION_KEY || event.key === ACTIVE_PLAYER_KEY || event.key === GUARDIAN_PROFILE_KEY) renderIdentity(signedInSnapshot());
  });
  document.addEventListener("d2collections:ownership-applied", () => renderIdentity(signedInSnapshot()));
  document.addEventListener("d2collections:guardian-profile", event => {
    upsertLocalProfile(event.detail || localGuardianProfile());
    renderRoster();
    renderIdentity(signedInSnapshot());
  });

  const initialProfile = localGuardianProfile();
  upsertLocalProfile(initialProfile);
  renderIdentity(signedInSnapshot());
  loadSnapshots();
})();
