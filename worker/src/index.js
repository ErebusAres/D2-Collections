const BUNGIE_API_ROOT = "https://www.bungie.net/Platform";
const PLAYER_MATCHERS = {
  corey: ["erebusares", "corey", "ares", "4611686018470688010"],
  matt: ["iceededpple", "matt", "icee", "4611686018470677739"],
  chris: ["fears", "chris", "4611686018470990353"]
};

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/health" && request.method === "GET") {
        return json({ ok: true, service: "d2-collections-sync" }, cors);
      }
      if (url.pathname === "/api/snapshots" && request.method === "GET") {
        return json(await readSnapshots(env.DB), cors);
      }
      if (url.pathname === "/api/snapshots" && request.method === "POST") {
        return json(await writeSnapshot(request, env), cors);
      }
      // Fireteam snapshots are separate from exotic collection snapshots so quest/progress data can evolve independently.
      if (url.pathname === "/api/fireteam-snapshots" && request.method === "GET") {
        return json(await readFireteamSnapshots(env.DB), cors);
      }
      if (url.pathname === "/api/fireteam-snapshots" && request.method === "POST") {
        return json(await writeFireteamSnapshot(request, env), cors);
      }
      return json({ ok: false, reason: "not_found" }, cors, 404);
    } catch (error) {
      return json({ ok: false, reason: error.code || "server_error", message: error.message || String(error) }, cors, error.status || 500);
    }
  }
};

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGIN || "https://erebusares.github.io").split(",").map(item => item.trim()).filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Vary": "Origin"
  };
}

function json(data, cors, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...jsonHeaders, ...cors } });
}

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

async function verifyBungieToken(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) throw httpError(401, "missing_bungie_token", "Missing Bungie access token.");
  if (!env.BUNGIE_API_KEY) throw httpError(500, "missing_worker_api_key", "Worker secret BUNGIE_API_KEY is not configured.");

  const response = await fetch(`${BUNGIE_API_ROOT}/User/GetMembershipsForCurrentUser/`, {
    headers: {
      "Authorization": auth,
      "X-API-Key": env.BUNGIE_API_KEY
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ErrorCode > 1) {
    throw httpError(401, "bungie_token_invalid", body.Message || "Bungie token could not be verified.");
  }

  const names = identityStrings(body.Response || {});
  const player = playerFromIdentity(names);
  if (!player) throw httpError(403, "unknown_player", "This Bungie account is not mapped to Ares/Corey, Icee/Matt, or Fears/Chris.");
  return { player, memberships: body.Response || {}, names };
}

function identityStrings(memberships) {
  const values = [
    memberships.primaryMembershipId,
    memberships.bungieNetUser?.uniqueName,
    memberships.bungieNetUser?.displayName
  ];
  (memberships.destinyMemberships || []).forEach(item => {
    values.push(item.membershipId, item.displayName, item.bungieGlobalDisplayName);
  });
  return values.filter(Boolean).map(value => String(value).toLowerCase());
}

function playerFromIdentity(values) {
  const haystack = values.join(" ");
  return Object.entries(PLAYER_MATCHERS).find(([, needles]) => needles.some(needle => haystack.includes(needle)))?.[0] || "";
}

async function writeSnapshot(request, env) {
  const { player, memberships } = await verifyBungieToken(request, env);
  const body = await request.json().catch(() => null);
  const liveSync = body?.liveSync || body?.payload?.liveSync;
  if (!liveSync?.ok) throw httpError(400, "missing_live_sync", "Request must include a successful liveSync payload.");
  if (liveSync.player !== player) throw httpError(403, "player_mismatch", "Verified Bungie account does not match the posted liveSync player.");

  const syncedAt = new Date().toISOString();
  const displayName = displayNameFor(player, memberships, liveSync);
  const membershipId = String(liveSync.membershipId || memberships.primaryMembershipId || "");
  const snapshot = {
    player,
    syncedAt,
    membershipId,
    displayName,
    liveSync,
    applyResult: body.applyResult || null,
    compactDump: body.compactDump || null
  };

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO players (id, display_name, bungie_membership_id, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, bungie_membership_id = excluded.bungie_membership_id, updated_at = excluded.updated_at
    `).bind(player, displayName, membershipId, syncedAt),
    env.DB.prepare(`
      INSERT INTO snapshots (player_id, synced_at, membership_id, display_name, payload_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(player_id) DO UPDATE SET synced_at = excluded.synced_at, membership_id = excluded.membership_id, display_name = excluded.display_name, payload_json = excluded.payload_json
    `).bind(player, syncedAt, membershipId, displayName, JSON.stringify(snapshot)),
    env.DB.prepare(`
      INSERT INTO resources (player_id, exotic_ciphers, exotic_engrams, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(player_id) DO UPDATE SET exotic_ciphers = excluded.exotic_ciphers, exotic_engrams = excluded.exotic_engrams, updated_at = excluded.updated_at
    `).bind(player, Number(liveSync.resourceCounts?.exoticCiphers || 0), Number(liveSync.resourceCounts?.exoticEngrams || 0), syncedAt)
  ]);

  await upsertOwnership(env.DB, player, liveSync, syncedAt);
  return { ok: true, player, syncedAt, itemCount: uniqueIds(liveSync.itemIds, liveSync.weaponIds).length };
}

function displayNameFor(player, memberships, liveSync) {
  const fromMembership = (memberships.destinyMemberships || []).find(item => String(item.membershipId) === String(memberships.primaryMembershipId));
  return liveSync.displayName || fromMembership?.displayName || memberships.bungieNetUser?.uniqueName || player;
}

async function upsertOwnership(db, player, liveSync, syncedAt) {
  const owned = new Set(uniqueIds(liveSync.itemIds, liveSync.weaponIds));
  const catalysts = new Set(uniqueIds(liveSync.catalystItemIds));
  const complete = new Set(uniqueIds(liveSync.completeItemIds));
  const allIds = new Set([...owned, ...catalysts, ...complete]);
  const statements = [...allIds].map(itemId => db.prepare(`
    INSERT INTO ownership (player_id, item_id, owned, catalyst, complete, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(player_id, item_id) DO UPDATE SET
      owned = MAX(ownership.owned, excluded.owned),
      catalyst = MAX(ownership.catalyst, excluded.catalyst),
      complete = MAX(ownership.complete, excluded.complete),
      updated_at = excluded.updated_at
  `).bind(player, itemId, owned.has(itemId) ? 1 : 0, catalysts.has(itemId) ? 1 : 0, complete.has(itemId) ? 1 : 0, syncedAt));
  for (let i = 0; i < statements.length; i += 50) {
    await db.batch(statements.slice(i, i + 50));
  }
}

function uniqueIds(...lists) {
  return [...new Set(lists.flatMap(list => Array.isArray(list) ? list : []).map(String).filter(Boolean))];
}

async function readSnapshots(db) {
  const { results } = await db.prepare(`
    SELECT
      s.player_id,
      s.synced_at,
      s.display_name,
      s.payload_json,
      r.exotic_ciphers,
      r.exotic_engrams,
      COUNT(o.item_id) AS item_count
    FROM snapshots s
    LEFT JOIN resources r ON r.player_id = s.player_id
    LEFT JOIN ownership o ON o.player_id = s.player_id AND (o.owned = 1 OR o.catalyst = 1 OR o.complete = 1)
    GROUP BY s.player_id, s.synced_at, s.display_name, s.payload_json, r.exotic_ciphers, r.exotic_engrams
    ORDER BY s.player_id
  `).all();
  return {
    ok: true,
    snapshots: (results || []).map(row => {
      const payload = safeJson(row.payload_json);
      return {
        player: row.player_id,
        syncedAt: row.synced_at,
        displayName: row.display_name || payload.displayName || "",
        itemCount: Number(row.item_count || 0),
        resourceCounts: {
          exoticCiphers: Number(row.exotic_ciphers || 0),
          exoticEngrams: Number(row.exotic_engrams || 0)
        },
        liveSync: payload.liveSync || null,
        applyResult: payload.applyResult || null
      };
    })
  };
}

async function writeFireteamSnapshot(request, env) {
  const { player, memberships } = await verifyBungieToken(request, env);
  const body = await request.json().catch(() => null);
  const fireteamSnapshot = body?.fireteamSnapshot || body?.payload;
  if (!fireteamSnapshot?.ok || fireteamSnapshot.kind !== "fireteam") {
    throw httpError(400, "missing_fireteam_snapshot", "Request must include a successful fireteam snapshot payload.");
  }

  const syncedAt = new Date().toISOString();
  const displayName = fireteamSnapshot.playerDisplayName || memberships.bungieNetUser?.uniqueName || player;
  const membershipId = String(fireteamSnapshot.primaryMembershipId || memberships.primaryMembershipId || "");
  const snapshot = {
    ...fireteamSnapshot,
    player,
    syncedAt,
    updatedAt: fireteamSnapshot.updatedAt || syncedAt
  };

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO players (id, display_name, bungie_membership_id, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, bungie_membership_id = excluded.bungie_membership_id, updated_at = excluded.updated_at
    `).bind(player, displayName, membershipId, syncedAt),
    env.DB.prepare(`
      INSERT INTO fireteam_snapshots (player_id, synced_at, membership_id, display_name, payload_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(player_id) DO UPDATE SET synced_at = excluded.synced_at, membership_id = excluded.membership_id, display_name = excluded.display_name, payload_json = excluded.payload_json
    `).bind(player, syncedAt, membershipId, displayName, JSON.stringify(snapshot))
  ]);

  return {
    ok: true,
    player,
    syncedAt,
    displayName,
    questCount: Array.isArray(snapshot.trackedQuestProgress) ? snapshot.trackedQuestProgress.length : 0,
    characterCount: Array.isArray(snapshot.characterSummaries) ? snapshot.characterSummaries.length : 0
  };
}

async function readFireteamSnapshots(db) {
  const { results } = await db.prepare(`
    SELECT player_id, synced_at, membership_id, display_name, payload_json
    FROM fireteam_snapshots
    ORDER BY player_id
  `).all();
  return {
    ok: true,
    snapshots: (results || []).map(row => {
      const payload = safeJson(row.payload_json);
      return {
        player: row.player_id,
        syncedAt: row.synced_at,
        membershipId: row.membership_id || payload.primaryMembershipId || "",
        displayName: row.display_name || payload.playerDisplayName || "",
        updatedAt: payload.updatedAt || row.synced_at,
        characterSummaries: payload.characterSummaries || [],
        trackedQuestProgress: payload.trackedQuestProgress || [],
        suggestedActivities: payload.suggestedActivities || [],
        fireteamSnapshot: payload
      };
    })
  };
}

function safeJson(value) {
  try { return JSON.parse(value || "{}"); } catch { return {}; }
}
