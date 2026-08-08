import type {
  ApiEnvelope,
  ActivityHistoryData,
  AudienceDetailData,
  BuildAdvisorData,
  CollectionData,
  DevProbeKey,
  DevProbeResult,
  FireteamData,
  FireteamMember,
  FireteamSharingMode,
  FireteamCompletedTrackedItem,
  FireteamTrackedItem,
  GearActionRequest,
  GearActionResult,
  GearData,
  GuardianRankData,
  JourneyProgressData,
  EquipBuildAdvisorRequest,
  EquipBuildAdvisorResult,
  EquipLoadoutRequest,
  EquipLoadoutResult,
  LoadoutsData,
  MailboxData,
  MailboxPullRequest,
  MailboxPullResult,
  MatrixData,
  MatrixSnapshot,
  PvpData,
  PowerData,
  QuestData,
  RewardCodeStatusData,
  RewardsPassData,
  RaidRotationsData,
  SessionData,
  UpdateUserPreferenceRequest,
  UpdateRewardCodePreferenceRequest,
  UserPreferencesData,
  XurData
} from "@guardian-nexus/contracts";
import { z } from "zod";
import { accessTokenFor, bungieGet, bungiePost, companionItemDefinitionsFor, destinyDisplayName, emblemPathFor, exchangeCode, loadActivityManifest, loadCompanionManifest, loadGearManifest, loadGuardianRankManifest, loadJourneyProgressManifest, loadManifest, loadQuestManifest, loadRewardCodeManifest, loadRewardsManifest, membershipsFor, mergeXurInventories, primaryMembership, profileFor, publicProfileFor, pvpHistoricalStatsFor, pvpRecentActivitiesFor, recentActivitiesFor, seasonPassProgress, socialRosterFor, xurInventoriesForCharacters } from "./bungie";
import { partyPresenceLabel } from "@guardian-nexus/domain";
import { activityName, addXurCollectionStates, charactersFromProfile, guardianLocation, guardianOnlineState, normalizeCollection, normalizeGuardian, normalizeQuests, selectedCharacter, xurStrangeCoinBalance } from "./normalize";
import { allowlist, cookie, csrfToken, decrypt, encrypt, httpError, parseCookies, randomToken, redact, requireCsrf, sessionFromRequest, sha256 } from "./security";
import type { Env, RequestContext, SessionRow } from "./types";
import { normalizeGear, type GearStateRow } from "./gear";
import { matrixGuardianRoster } from "./matrix";
import { normalizeRewardsPass } from "./rewards";
import { normalizeMailbox, postmasterItemsForCharacter } from "./mailbox";
import { normalizeLoadouts } from "./loadouts";
import { normalizeRewardCodeStatus } from "./rewardCodes";
import { buildsRoute, publishedBuildsForAdvisor } from "./builds";
import { canViewAudienceMetrics, readAudienceDetails, readAudienceMetrics, recordAudienceVisitor, rememberAudienceGuardian } from "./audience";
import { ironBannerHistoryResponse, normalizePvpData, normalizePvpProgressions } from "./pvp";
import { normalizeGuardianRanks } from "./guardianRank";
import { normalizeJourneyProgress, trackedItemsFromJourney } from "./journeyProgress";
import { normalizePower, powerItemHashes } from "./power";
import { normalizeActivityHistory } from "./activityHistory";
import { readLatestXurShipment, saveLatestXurShipment } from "./xurSnapshot";
import { isReportAdmin, reportsRoute } from "./reports";
import { applyTrackedItemVisibility, completedTrackedItemEvents, mergeTrackedItems, trackedItemKey, trackedItemsFromCollection, trackedItemsFromGuardianRanks, trackedItemsFromQuests } from "./fireteamTracking";
import { buildAdvisorRecommendationItems, normalizeBuildAdvisorData } from "./buildAdvisor";
import { buildAdvisorTemplatesFromPublishedBuilds } from "./buildAdvisorPublished";
import { BUILD_ADVISOR_TEMPLATES } from "./buildAdvisorTemplates";
import {
  maintainNotificationStorage,
  readDistortions,
  readNotificationFeed,
  readWhatsHappening,
  recordDistortionObservation,
  saveManualNotification,
  updateNotificationPreferences,
  updateNotificationState
} from "./notifications";
import { readRaidRotations } from "./worldState";
import { guardianSnapshotsRoute } from "./guardianSnapshots";
import { membershipDiagnosis, probeDestinyMemberships, selectBestMembership, type DiagnosticTest } from "./supportDiagnostics";

const fireteamReadinessSchema = z.object({
  schemaVersion: z.literal(1),
  activityName: z.string().trim().min(1).max(80),
  role: z.enum(["damage", "support", "control", "flex"]),
  state: z.enum(["ready", "needs-attention", "not-checked"]),
  build: z.object({ id: z.string().max(100).optional(), title: z.string().trim().min(1).max(100), subclass: z.string().trim().max(60).optional() }).optional(),
  prerequisites: z.array(z.object({ id: z.string().min(1).max(60), label: z.string().trim().min(1).max(100), state: z.enum(["ready", "needs-attention", "not-checked"]) })).max(12),
  note: z.string().trim().max(240).optional(),
  source: z.literal("player-confirmed"),
  updatedAt: z.string().datetime()
});
const fireteamTrackedBuildSchema = z.object({
  id: z.string().trim().min(1).max(100),
  definitionHash: z.string().trim().min(1).max(100),
  kind: z.literal("build"),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(300),
  icon: z.string().max(300),
  context: z.string().trim().max(120),
  trackedInDestiny: z.literal(false),
  trackedInGuardianNexus: z.literal(true),
  objectives: z.array(z.object({
    objectiveHash: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(120),
    progress: z.number().int().min(0).max(1),
    completionValue: z.literal(1),
    percent: z.number().int().min(0).max(100),
    complete: z.boolean(),
    progressAvailable: z.boolean()
  })).max(30),
  percent: z.number().int().min(0).max(100),
  updatedAt: z.string().datetime(),
  acquisitionGuide: z.object({ summary: z.string().trim().max(300), steps: z.array(z.string().trim().min(1).max(300)).max(8), prerequisites: z.array(z.string().trim().min(1).max(300)).max(8) }).optional()
});
const shareSchema = z.object({
  characterId: z.string().min(1),
  sitePinnedQuestIds: z.array(z.string()).max(40).default([]),
  siteTrackedGuardianRankIds: z.array(z.string()).max(200).optional(),
  siteTrackedJourneyIds: z.array(z.string()).max(500).optional(),
  siteTrackedCollectionIds: z.array(z.string()).max(200).optional(),
  siteTrackedBuilds: z.array(fireteamTrackedBuildSchema).max(8).optional(),
  hiddenTrackedItemKeys: z.array(z.string()).max(200).optional(),
  readiness: fireteamReadinessSchema.nullable().optional(),
  mode: z.enum(["temporary", "persistent"]).default("temporary")
});
const FIRETEAM_COMPLETION_RETENTION_MS = 3 * 60_000;

const probeSchema = z.object({
  probe: z.enum(["memberships", "profile", "character", "item", "collectible", "public-milestones", "manifest"]),
  characterId: z.string().optional(),
  hash: z.string().regex(/^\d+$/).optional(),
  components: z.array(z.number().int().nonnegative()).max(20).optional()
});

const gearStateSchema = z.object({ itemInstanceId: z.string().regex(/^\d+$/), tag: z.enum(["favorite", "keep", "junk", "infuse", "archive"]).nullable().optional(), dismissed: z.boolean().optional() });
const gearActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("transfer"), itemInstanceId: z.string().regex(/^\d+$/), target: z.enum(["vault", "character"]), targetCharacterId: z.string().regex(/^\d+$/).optional() }),
  z.object({ action: z.literal("equip"), itemInstanceId: z.string().regex(/^\d+$/), characterId: z.string().regex(/^\d+$/) }),
  z.object({ action: z.literal("setLock"), itemInstanceId: z.string().regex(/^\d+$/), locked: z.boolean(), characterId: z.string().regex(/^\d+$/).optional() }),
  z.object({ action: z.literal("groupPull"), itemInstanceIds: z.array(z.string().regex(/^\d+$/)).min(1).max(20), characterId: z.string().regex(/^\d+$/) })
]);
const mailboxPullSchema = z.object({ itemInstanceId: z.string().regex(/^\d+$/), characterId: z.string().regex(/^\d+$/), quantity: z.number().int().positive().max(999_999_999) });
const equipLoadoutSchema = z.object({ loadoutIndex: z.number().int().nonnegative().max(99), characterId: z.string().regex(/^\d+$/) });
const equipBuildAdvisorSchema = z.object({
  recommendationId: z.string().trim().min(1).max(160),
  characterId: z.string().regex(/^\d+$/)
}).strict();
const preferenceSchema = z.discriminatedUnion("key", [
  z.object({ key: z.literal("gear.sort"), value: z.enum(["analyzer", "base", "current", "rank", "tier", "power", "grouped", "untagged", "slot", "new", "name"]) }),
  z.object({ key: z.literal("collection.sort"), value: z.enum(["position", "type", "alpha", "missing", "owned", "source"]) }),
  z.object({ key: z.enum(["gear.filters", "weapons.filters", "weapons.wishlist", "collection.filters", "collection.tracked", "fireteam.trackedOrder", "fireteam.readinessDraft.v1", "quests.filters", "guardianRank.tracked", "journey.tracked", "rewardCodes.filters", "builds.filters", "watchlists.buildAcquisitions", "watchlists.v1", "buildAdvisor.trackedBuilds.v1"]), value: z.string().max(12_000) }),
  z.object({ key: z.literal("projects.v1"), value: z.string().max(40_000) }),
  z.object({ key: z.literal("fashion.looks.v1"), value: z.string().max(40_000) }),
  z.object({ key: z.literal("challenges.v1"), value: z.string().max(40_000) }),
  z.object({ key: z.literal("gear.workspace"), value: z.enum(["armor", "weapons", "loot", "vault"]) }),
  z.object({ key: z.literal("quests.layout"), value: z.enum(["grid", "list"]) }),
  z.object({ key: z.literal("build.detail.layout"), value: z.enum(["standard", "overview", "compact", "detailed"]) }),
  z.object({ key: z.literal("planner.duration"), value: z.enum(["30", "60", "120"]) }),
  z.object({ key: z.literal("planner.mode"), value: z.enum(["solo", "either", "fireteam"]) }),
  z.object({ key: z.literal("planner.focus"), value: z.enum(["any", "quest", "rank", "exotic"]) }),
  z.object({ key: z.enum(["site.autoRefresh", "site.reducedMotion", "site.highContrast"]), value: z.enum(["true", "false"]) }),
  z.object({ key: z.literal("site.textScale"), value: z.enum(["standard", "large", "largest"]) }),
  z.object({ key: z.literal("site.locale"), value: z.enum(["en-US", "es-ES", "fr-FR"]) }),
  z.object({ key: z.literal("site.character"), value: z.string().regex(/^\d+$/) })
]);
const rewardCodePreferenceSchema = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3}(?:-[A-Z0-9]{3}){2}$/), redeemed: z.boolean() }).strict();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const context: RequestContext = {
      requestId: crypto.randomUUID(),
      url: new URL(request.url),
      origin: request.headers.get("Origin") || ""
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(env, context.origin) });
    try {
      return await route(request, env, context);
    } catch (error: any) {
      const status = Number(error?.status || 500);
      if (status >= 500) {
        console.error("guardian_nexus_request_failed", redact({
          requestId: context.requestId,
          path: context.url.pathname,
          status,
          code: error?.code || "server_error",
          message: error instanceof Error ? error.message : "Unknown request failure",
          stack: error instanceof Error ? error.stack : undefined
        }));
      }
      return json({
        code: error?.code || "server_error",
        message: status >= 500 && !error?.code ? "Guardian Nexus could not complete the request." : error?.message || "Request failed.",
        ...(error?.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
        requestId: context.requestId
      }, status, env, context.origin, error?.retryAfterSeconds);
    }
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM fireteam_shares WHERE sharing_mode = 'temporary' AND expires_at <= ?").bind(now),
      env.DB.prepare("DELETE FROM oauth_sessions WHERE refresh_expires_at <= ?").bind(Math.floor(Date.now() / 1000))
    ]);
    await maintainNotificationStorage(env);
    await refreshPersistentShares(env);
  }
};

async function route(request: Request, env: Env, context: RequestContext): Promise<Response> {
  const path = context.url.pathname.replace(/\/$/, "") || "/";
  if (path === "/api/v1/health" && request.method === "GET") {
    return envelope({ service: "guardian-nexus-api", version: "0.1.0", commit: (env as any).BUILD_COMMIT || "unknown", deployedAt: (env as any).BUILD_TIMESTAMP || "unknown", oauth: Boolean(env.BUNGIE_CLIENT_SECRET), database: "guardian-nexus-v1" }, env, context);
  }
  if (path === "/api/v1/support/diagnostics" && request.method === "GET") return supportDiagnostics(request, env, context);
  if (path === "/api/v1/auth/start" && request.method === "GET") return startAuth(request, env, context);
  if (path === "/api/v1/auth/callback" && request.method === "GET") return finishAuth(request, env, context);
  if (path === "/api/v1/session" && request.method === "GET") return readSession(request, env, context);
  if (path === "/api/v1/session" && request.method === "DELETE") return deleteSession(request, env, context);
  if (path === "/api/v1/notifications" && request.method === "GET") return envelope(await readNotificationFeed(request, env), env, context);
  if (path === "/api/v1/distortions" && request.method === "GET") return envelope(await readDistortions(env, context.url.searchParams.get("range") || "7d"), env, context);
  if (path === "/api/v1/whats-happening" && request.method === "GET") {
    const optionalSession = await sessionFromRequest(request, env);
    return envelope(await readWhatsHappening(env, optionalSession?.row.membership_id), env, context);
  }
  if (path === "/api/v1/world/raids" && request.method === "GET") {
    return envelope<RaidRotationsData>(await readRaidRotations(env), env, context);
  }
  const buildsResponse = await buildsRoute(request, env, context);
  if (buildsResponse) return buildsResponse;
  const snapshotsResponse = await guardianSnapshotsRoute(request, env, context);
  if (snapshotsResponse) return snapshotsResponse;

  const session = await requireSession(request, env);
  const reportsResponse = await reportsRoute(request, env, context, session);
  if (reportsResponse) return reportsResponse;
  if (path === "/api/v1/me/overview" && request.method === "GET") return overview(session.row, env, context);
  if (path === "/api/v1/me/preferences" && request.method === "GET") return userPreferences(session.row, env, context);
  if (path === "/api/v1/me/preferences" && request.method === "PUT") { await requireCsrf(request, session.token, env); return updateUserPreference(request, session.row, env, context); }
  if (path === "/api/v1/me/collection" && request.method === "GET") return collection(session.row, env, context);
  if (path === "/api/v1/me/xur" && request.method === "GET") return xur(session.row, env, context);
  if (path === "/api/v1/me/quests" && request.method === "GET") return quests(session.row, env, context);
  if (path === "/api/v1/me/journey" && request.method === "GET") return journeyProgress(session.row, env, context);
  if (path === "/api/v1/me/guardian-rank" && request.method === "GET") return guardianRank(session.row, env, context);
  if (path === "/api/v1/me/power" && request.method === "GET") return power(session.row, env, context);
  if (path === "/api/v1/me/pvp" && request.method === "GET") return pvp(session.row, env, context);
  if (path === "/api/v1/me/activity-history" && request.method === "GET") return activityHistory(session.row, env, context);
  if (path === "/api/v1/me/rewards" && request.method === "GET") return rewards(session.row, env, context);
  if (path === "/api/v1/me/reward-code-status" && request.method === "GET") return rewardCodeStatus(session.row, env, context);
  if (path === "/api/v1/me/reward-code-status" && request.method === "PUT") { await requireCsrf(request, session.token, env); return updateRewardCodePreference(request, session.row, env, context); }
  if (path === "/api/v1/me/notifications/state" && request.method === "PUT") return envelope(await updateNotificationState(request, session, env), env, context);
  if (path === "/api/v1/me/notification-preferences" && request.method === "PUT") return envelope(await updateNotificationPreferences(request, session, env), env, context);
  if (path === "/api/v1/admin/notifications" && request.method === "PUT") {
    await requireCsrf(request, session.token, env);
    return envelope(await saveManualNotification(request, session.row, env), env, context);
  }
  if (path === "/api/v1/admin/distortions" && request.method === "PUT") {
    await requireCsrf(request, session.token, env);
    return envelope(await recordDistortionObservation(request, session.row, env), env, context);
  }
  if (path === "/api/v1/me/gear" && request.method === "GET") return gear(session.row, env, context);
  if (path === "/api/v1/me/gear/item-state" && request.method === "PUT") { await requireCsrf(request, session.token, env); return updateGearState(request, session.row, env, context); }
  if (path === "/api/v1/me/gear/action" && request.method === "POST") { await requireCsrf(request, session.token, env); return gearAction(request, session.row, env, context); }
  if (path === "/api/v1/me/mailbox" && request.method === "GET") return mailbox(session.row, env, context);
  if (path === "/api/v1/me/mailbox/pull" && request.method === "POST") { await requireCsrf(request, session.token, env); return pullMailboxItem(request, session.row, env, context); }
  if (path === "/api/v1/me/loadouts" && request.method === "GET") return loadouts(session.row, env, context);
  if (path === "/api/v1/me/loadouts/equip" && request.method === "POST") { await requireCsrf(request, session.token, env); return equipLoadout(request, session.row, env, context); }
  if (path === "/api/v1/me/build-advisor" && request.method === "GET") return buildAdvisor(session.row, env, context);
  if (path === "/api/v1/me/build-advisor/equip" && request.method === "POST") { await requireCsrf(request, session.token, env); return equipBuildAdvisor(request, session.row, env, context); }
  if (path === "/api/v1/fireteam" && request.method === "GET") return fireteam(session.row, env, context);
  if (path === "/api/v1/fireteam/share" && request.method === "PUT") {
    await requireCsrf(request, session.token, env);
    return upsertShare(request, session.row, env, context);
  }
  if (path === "/api/v1/fireteam/share" && request.method === "DELETE") {
    await requireCsrf(request, session.token, env);
    await env.DB.prepare("DELETE FROM fireteam_shares WHERE membership_id = ?").bind(session.row.membership_id).run();
    return envelope({ sharing: false }, env, context);
  }
  if (path === "/api/v1/matrix" && request.method === "GET") return matrix(session.row, env, context);
  if (path === "/api/v1/audience" && request.method === "GET") {
    if (!canViewAudienceMetrics(session.row.membership_id, env.DEV_MEMBERSHIP_IDS)) throw httpError(403, "audience_forbidden", "Audience details are restricted to approved site maintainers.");
    return envelope<AudienceDetailData>(await readAudienceDetails(env), env, context);
  }
  if (path === "/api/v1/matrix/sync" && request.method === "POST") {
    await requireCsrf(request, session.token, env);
    return syncMatrix(session.row, env, context);
  }
  if (path === "/api/v1/dev/probe" && request.method === "POST") {
    await requireCsrf(request, session.token, env);
    return devProbe(request, session.row, env, context);
  }
  if (path === "/api/v1/dev/manifest/search" && request.method === "GET") return manifestSearch(session.row, env, context);
  throw httpError(404, "not_found", "This Guardian Nexus endpoint does not exist.");
}

async function supportDiagnostics(request: Request, env: Env, context: RequestContext): Promise<Response> {
  const startedAt = new Date().toISOString();
  const tests: DiagnosticTest[] = [{ id: "request", name: "Diagnostic request received", status: "pass", durationMs: 0, explanation: "The browser reached the Guardian Nexus Worker and started a private, read-only diagnostic run." }];
  const sessionCookieReceived = Boolean(parseCookies(request).gn_session);
  let row: SessionRow | null = null;
  let databaseReachable = false;
  let schemaTables: string[] = [];
  let mappingSummary: Record<string, unknown> = {};
  const databaseStart = Date.now();
  try {
    schemaTables = ((await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users','oauth_sessions','gear_item_state','d1_migrations') ORDER BY name").all<{ name: string }>()).results || []).map((entry) => entry.name);
    databaseReachable = true;
    if (sessionCookieReceived) {
      const token = parseCookies(request).gn_session!;
      row = await env.DB.prepare(`SELECT s.session_hash, s.membership_id, u.membership_type, u.display_name, u.bungie_name, s.access_token_cipher, s.refresh_token_cipher, s.access_expires_at, s.refresh_expires_at FROM oauth_sessions s JOIN users u ON u.membership_id = s.membership_id WHERE s.session_hash = ?`).bind(await sha256(token)).first<SessionRow>();
      if (row) {
        const counts = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM users WHERE membership_id = ?) AS user_count, (SELECT COUNT(*) FROM oauth_sessions WHERE membership_id = ?) AS session_count").bind(row.membership_id, row.membership_id).first<{ user_count: number; session_count: number }>();
        mappingSummary = { currentUserMappingCount: Number(counts?.user_count || 0), sessionsForStoredMembership: Number(counts?.session_count || 0), duplicateUserMapping: Number(counts?.user_count || 0) > 1 };
      }
    }
    tests.push({ id: "database", name: "Guardian Nexus data store", status: schemaTables.includes("users") && schemaTables.includes("oauth_sessions") ? "pass" : "warning", durationMs: Date.now() - databaseStart, explanation: "D1 responded and the diagnostic checked only expected schema names and the current session mapping.", details: { reachable: true, requiredTablesPresent: schemaTables.includes("users") && schemaTables.includes("oauth_sessions"), schemaMarker: schemaTables.includes("d1_migrations") ? "d1_migrations-present" : "migration-table-not-exposed", ...mappingSummary } });
  } catch (error: any) {
    tests.push(diagnosticFailure("database", "Guardian Nexus data store", databaseStart, error, "The Worker could not read the D1 schema/session relationship."));
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const sessionValid = Boolean(row && row.refresh_expires_at > nowSeconds);
  tests.push({ id: "session", name: "Guardian Nexus server session", status: sessionValid ? "pass" : "fail", durationMs: 0, explanation: !sessionCookieReceived ? "No Guardian Nexus session cookie reached the Worker." : !row ? "A cookie was received, but no matching server-side session was found." : sessionValid ? "The current server-side session exists and its refresh window is valid." : "The server-side session has expired.", details: { cookieReceived: sessionCookieReceived, foundServerSide: Boolean(row), valid: sessionValid, expiresAt: row ? new Date(row.refresh_expires_at * 1000).toISOString() : undefined, bungieAccountAssociated: Boolean(row?.membership_id), oauthCredentialsAvailable: Boolean(row?.access_token_cipher && row?.refresh_token_cipher), tokenExpired: row ? row.access_expires_at <= nowSeconds : undefined } });

  let accessToken = "";
  const refreshAttempted = false;
  if (row && sessionValid) {
    const tokenStart = Date.now();
    const tokenExpired = row.access_expires_at <= nowSeconds + 60;
    if (tokenExpired) tests.push({ id: "oauth", name: "Bungie OAuth token", status: "fail", durationMs: Date.now() - tokenStart, explanation: "The stored access token is expired or near expiry. Read-only diagnostics did not rotate or delete session credentials; signing in again will test the normal refresh/login path safely.", details: { credentialsPresent: true, tokenValid: false, tokenExpired: true, refreshAttempted, refreshSucceeded: undefined, requiredScope: "ReadBasicUserProfile", scopeSufficientForMembershipsAndBasicProfile: "not-tested" } });
    else {
      try {
        accessToken = await decrypt(row.access_token_cipher, env.OAUTH_ENCRYPTION_KEY);
        tests.push({ id: "oauth", name: "Bungie OAuth token", status: "pass", durationMs: Date.now() - tokenStart, explanation: "The stored OAuth token is within its validity window; no refresh was necessary.", details: { credentialsPresent: true, tokenValid: true, tokenExpired: false, refreshAttempted, refreshSucceeded: undefined, requiredScope: "ReadBasicUserProfile", scopeSufficientForMembershipsAndBasicProfile: true } });
      } catch (error: any) {
        tests.push({ ...diagnosticFailure("oauth", "Bungie OAuth token", tokenStart, error, "Guardian Nexus could not decrypt the current OAuth token."), details: { credentialsPresent: true, tokenValid: false, tokenExpired: false, refreshAttempted, refreshSucceeded: undefined } });
      }
    }
  } else {
    tests.push({ id: "oauth", name: "Bungie OAuth token", status: "not-applicable", durationMs: 0, explanation: "OAuth could not be tested without a valid current Guardian Nexus session." });
  }

  let memberships: any;
  const membershipsStart = Date.now();
  if (accessToken) {
    try {
      memberships = await membershipsFor(accessToken, env);
      const entries = Array.isArray(memberships?.destinyMemberships) ? memberships.destinyMemberships : [];
      tests.push({ id: "memberships", name: "Bungie memberships", status: entries.length ? "pass" : "warning", durationMs: Date.now() - membershipsStart, httpStatus: 200, explanation: entries.length ? `Bungie authenticated the user and returned ${entries.length} linked Destiny membership${entries.length === 1 ? "" : "s"}.` : "Bungie authenticated the user but returned zero Destiny memberships.", details: { bungieNetUserReturned: Boolean(memberships?.bungieNetUser), bungieGlobalDisplayName: memberships?.bungieNetUser?.uniqueName || memberships?.bungieNetUser?.bungieGlobalDisplayName, primaryMembershipId: memberships?.primaryMembershipId, membershipCount: entries.length, memberships: entries.map((entry: any) => ({ membershipType: Number(entry.membershipType), membershipId: String(entry.membershipId), displayName: String(entry.displayName || ""), bungieGlobalDisplayName: entry.bungieGlobalDisplayName, bungieGlobalDisplayNameCode: entry.bungieGlobalDisplayNameCode, crossSaveOverride: Number(entry.crossSaveOverride || 0), applicableMembershipTypes: entry.applicableMembershipTypes || [], isPublic: entry.isPublic, isPrimary: String(entry.membershipId) === String(memberships?.primaryMembershipId) })) } });
    } catch (error: any) {
      tests.push(diagnosticFailure("memberships", "Bungie memberships", membershipsStart, error, "Bungie authentication or membership retrieval failed."));
    }
  } else tests.push({ id: "memberships", name: "Bungie memberships", status: "not-applicable", durationMs: 0, explanation: "Memberships could not be tested without a usable OAuth token." });

  const probeStart = Date.now();
  const probes = memberships && accessToken ? await probeDestinyMemberships(memberships, (membershipType, membershipId) => bungieGet(`/Destiny2/${membershipType}/Profile/${membershipId}/?components=100,200`, env, accessToken)) : [];
  if (memberships) tests.push({ id: "profiles", name: "Every linked Destiny profile", status: probes.some((probe) => probe.usable) ? "pass" : probes.some((probe) => probe.profileExists) ? "warning" : "fail", durationMs: Date.now() - probeStart, explanation: probes.some((probe) => probe.usable) ? "At least one linked membership returned a profile with usable characters." : probes.some((probe) => probe.profileExists) ? "A Destiny profile exists, but no usable characters were returned." : "No linked membership returned a usable Destiny 2 profile.", details: { probes } });
  else tests.push({ id: "profiles", name: "Every linked Destiny profile", status: "not-applicable", durationMs: 0, explanation: "Profile probes require a successful membership response." });

  const best = selectBestMembership(memberships, probes);
  const stored = probes.find((probe) => probe.membershipId === row?.membership_id);
  tests.push({ id: "selection", name: "Membership selection", status: best && row && best.membershipId !== row.membership_id && best.usable ? "fail" : best?.usable ? "pass" : "warning", durationMs: 0, explanation: best && row && best.membershipId !== row.membership_id && best.usable ? "The saved Guardian Nexus membership is not the best verified usable Destiny profile." : best?.usable ? "Guardian Nexus's verified selection resolves to a usable Destiny profile." : "Guardian Nexus could not verify a usable membership selection.", details: { storedMembership: row ? { membershipType: row.membership_type, membershipId: row.membership_id } : undefined, verifiedSelection: best ? { membershipType: best.membershipType, membershipId: best.membershipId, characterCount: best.characterCount } : undefined, storedMembershipUsable: stored?.usable } });

  const bootstrapStart = Date.now();
  let bootstrap: Record<string, unknown> = { stages: [] };
  if (row && accessToken) {
    const stages = ["request received", "session resolved", "OAuth token resolved", "memberships loaded", "membership selected"];
    let activeStage = "profile loaded";
    try {
      const { profile } = await profileFor(row, env, "session", true, accessToken); stages.push("profile loaded");
      activeStage = "characters loaded";
      const characters = charactersFromProfile(profile); stages.push("characters loaded");
      activeStage = "application account normalized";
      const manifest = await loadActivityManifest(env);
      const guardian = normalizeGuardian({ profile, membershipId: row.membership_id, membershipType: row.membership_type, displayName: row.display_name, bungieName: row.bungie_name, rewardsPass: { rank: 0, progress: { state: "unavailable", source: "bungie-profile-character-progressions" } }, manifest }); stages.push("application account normalized", "bootstrap response created");
      bootstrap = { stages, selectedMembershipId: row.membership_id, characterCount: characters.length, selectedCharacterId: guardian.selectedCharacterId, succeeded: true };
      tests.push({ id: "bootstrap", name: "Guardian Nexus account bootstrap", status: characters.length ? "pass" : "warning", durationMs: Date.now() - bootstrapStart, explanation: characters.length ? "The real profile loader and account normalizer completed successfully." : "The real profile loader completed, but the normalized account contains no characters.", details: bootstrap });
    } catch (error: any) {
      bootstrap = { stages, failedStage: activeStage, succeeded: false, exception: { name: String(error?.name || "Error"), message: String(error?.message || "Unknown bootstrap failure"), applicationCode: error?.code, stackLocation: safeStackLocation(error) } };
      tests.push({ ...diagnosticFailure("bootstrap", "Guardian Nexus account bootstrap", bootstrapStart, error, "The normal Guardian Nexus bootstrap path failed at the last completed stage."), details: bootstrap });
    }
  } else tests.push({ id: "bootstrap", name: "Guardian Nexus account bootstrap", status: "not-applicable", durationMs: 0, explanation: "The application bootstrap requires a valid current session and OAuth token." });

  const diagnosis = membershipDiagnosis(Boolean(memberships), probes, stored, row?.membership_id);
  return envelope({
    reportVersion: 1,
    timestamp: startedAt,
    guardianNexus: { build: "0.1.0", commit: (env as any).BUILD_COMMIT || "unknown", deployedAt: (env as any).BUILD_TIMESTAMP || "unknown", backendReachable: true, databaseReachable, schema: "guardian-nexus-v1" },
    session: { cookieReceived: sessionCookieReceived, found: Boolean(row), valid: sessionValid, oauthPresent: Boolean(row?.access_token_cipher), oauthValid: Boolean(accessToken), refreshAttempted },
    tests,
    profileTests: probes,
    applicationBootstrap: bootstrap,
    diagnosis
  }, env, context);
}

function diagnosticFailure(id: string, name: string, started: number, error: any, explanation: string): DiagnosticTest {
  return {
    id, name, status: "fail", durationMs: Date.now() - started, explanation,
    ...(Number.isFinite(Number(error?.httpStatus || error?.status)) ? { httpStatus: Number(error?.httpStatus || error?.status) } : {}),
    ...(error?.code ? { applicationCode: String(error.code) } : {}),
    ...(Number.isFinite(Number(error?.bungieErrorCode)) ? { bungieErrorCode: Number(error.bungieErrorCode) } : {}),
    ...(error?.bungieErrorStatus ? { bungieErrorStatus: String(error.bungieErrorStatus) } : {}),
    ...(error?.bungieMessage || error?.message ? { bungieMessage: String(error.bungieMessage || error.message) } : {}),
    ...(Number(error?.throttleSeconds || error?.retryAfterSeconds) ? { throttleSeconds: Number(error?.throttleSeconds || error?.retryAfterSeconds) } : {})
  };
}

function safeStackLocation(error: any): string | undefined {
  const line = String(error?.stack || "").split("\n").slice(1).find((entry) => /apps\/api\/src|worker/i.test(entry));
  return line ? line.trim().replace(/[A-Z]:\\[^:)]*/i, "[worker-source]") : undefined;
}

function corsHeaders(env: Env, origin: string): HeadersInit {
  const allowed = new Set([env.ALLOWED_ORIGIN, env.WEB_ORIGIN].flatMap((value) => (value || "").split(",")).map((value) => value.trim()).filter(Boolean));
  const accepted = allowed.has(origin) ? origin : env.WEB_ORIGIN;
  return {
    "Access-Control-Allow-Origin": accepted,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type,X-CSRF-Token",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    Vary: "Origin"
  };
}

function json(value: unknown, status: number, env: Env, origin: string, retryAfter?: number, extraHeaders?: HeadersInit): Response {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsHeaders(env, origin), ...extraHeaders });
  if (retryAfter) headers.set("Retry-After", String(retryAfter));
  return new Response(JSON.stringify(value), { status, headers });
}

function envelope<T>(data: T, env: Env, context: RequestContext, options: { warnings?: string[]; observedAt?: string; sourceMintedAt?: string; state?: ApiEnvelope<T>["freshness"]["state"] } = {}): Response {
  const observedAt = options.observedAt || new Date().toISOString();
  const sourceTime = options.sourceMintedAt ? Date.parse(options.sourceMintedAt) : Date.parse(observedAt);
  const ageSeconds = Math.max(0, Math.round((Date.now() - sourceTime) / 1000));
  const body: ApiEnvelope<T> = {
    data,
    freshness: {
      state: options.state || (ageSeconds > 180 ? "stale" : "fresh"),
      observedAt,
      sourceMintedAt: options.sourceMintedAt,
      ageSeconds
    },
    warnings: options.warnings || [],
    requestId: context.requestId
  };
  return json(body, 200, env, context.origin);
}

async function requireSession(request: Request, env: Env): Promise<{ token: string; row: SessionRow }> {
  const session = await sessionFromRequest(request, env);
  if (!session) throw httpError(401, "authentication_required", "Sign in with Bungie to continue.");
  return session;
}

function secureCookies(context: RequestContext): boolean {
  return context.url.protocol === "https:";
}

async function startAuth(_request: Request, env: Env, context: RequestContext): Promise<Response> {
  if (!env.BUNGIE_CLIENT_ID) throw httpError(503, "oauth_unconfigured", "Bungie OAuth is not configured.");
  const state = randomToken(24);
  const returnTo = sanitizeReturnTo(context.url.searchParams.get("returnTo"));
  const target = new URL("https://www.bungie.net/en/OAuth/Authorize");
  target.searchParams.set("client_id", env.BUNGIE_CLIENT_ID);
  target.searchParams.set("response_type", "code");
  target.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      "Set-Cookie": cookie("gn_oauth_state", `${state}.${base64Text(returnTo)}`, { maxAge: 600, secure: secureCookies(context) }),
      ...corsHeaders(env, context.origin)
    }
  });
}

async function finishAuth(request: Request, env: Env, context: RequestContext): Promise<Response> {
  const code = context.url.searchParams.get("code") || "";
  const state = context.url.searchParams.get("state") || "";
  const stateCookie = parseCookies(request).gn_oauth_state || "";
  const [expectedState, encodedReturn] = stateCookie.split(".");
  if (!code || !state || !expectedState || state !== expectedState) throw httpError(400, "oauth_state_invalid", "Bungie sign-in state could not be verified.");
  const token = await exchangeCode(code, env);
  if (!token.refresh_token) throw httpError(503, "refresh_token_missing", "The Bungie application must be configured as a confidential OAuth client.");
  const memberships = await membershipsFor(token.access_token, env);
  const membershipProbes = await probeDestinyMemberships(memberships, (membershipType, membershipId) => bungieGet(`/Destiny2/${membershipType}/Profile/${membershipId}/?components=100,200`, env, token.access_token));
  const membership = selectBestMembership(memberships, membershipProbes) || primaryMembership(memberships);
  if (!membership?.membershipId) throw httpError(400, "destiny_membership_missing", "This Bungie account has no Destiny membership.");
  const membershipId = String(membership.membershipId);
  const membershipType = Number(membership.membershipType);
  const displayName = membership.displayName || memberships?.bungieNetUser?.displayName || "Guardian";
  const bungieName = memberships?.bungieNetUser?.uniqueName || memberships?.bungieNetUser?.displayName || displayName;
  const now = Math.floor(Date.now() / 1000);
  const sessionToken = randomToken();
  const sessionHash = await sha256(sessionToken);
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO users (membership_id, membership_type, display_name, bungie_name, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(membership_id) DO UPDATE SET membership_type = excluded.membership_type, display_name = excluded.display_name, bungie_name = excluded.bungie_name, updated_at = excluded.updated_at
    `).bind(membershipId, membershipType, displayName, bungieName, new Date().toISOString()),
    env.DB.prepare(`
      INSERT INTO oauth_sessions (session_hash, membership_id, access_token_cipher, refresh_token_cipher, access_expires_at, refresh_expires_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      sessionHash,
      membershipId,
      await encrypt(token.access_token, env.OAUTH_ENCRYPTION_KEY),
      await encrypt(token.refresh_token, env.OAUTH_ENCRYPTION_KEY),
      now + Number(token.expires_in || 3600),
      now + Number(token.refresh_expires_in || 7_776_000),
      new Date().toISOString()
    )
  ]);
  const returnTo = sanitizeReturnTo(decodeText(encodedReturn || ""));
  return new Response(null, {
    status: 302,
    headers: {
      Location: new URL(returnTo, env.WEB_ORIGIN).toString(),
      "Set-Cookie": cookie("gn_session", sessionToken, { maxAge: Number(token.refresh_expires_in || 7_776_000), secure: secureCookies(context) }),
      ...corsHeaders(env, context.origin)
    }
  });
}

async function readSession(request: Request, env: Env, context: RequestContext): Promise<Response> {
  const visitorCookie = await recordAudienceVisitor(request, env, context);
  const session = await sessionFromRequest(request, env);
  if (!session) return withSetCookie(envelope<SessionData>({ authenticated: false, roles: { dev: false, matrixWriter: false, buildEditor: false, reportAdmin: false }, rolesState: "verified" }, env, context), visitorCookie);
  const { profile, accessToken } = await profileFor(session.row, env, "session");
  const [manifest, pvpManifest] = await Promise.all([loadActivityManifest(env), loadRewardsManifest(env)]);
  const requestedCharacterId = context.url.searchParams.get("characterId") || undefined;
  const selectedId = selectedCharacter(charactersFromProfile(profile), requestedCharacterId)?.characterId;
  const guardian = normalizeGuardian({
    profile,
    membershipId: session.row.membership_id,
    membershipType: session.row.membership_type,
    displayName: session.row.display_name,
    bungieName: session.row.bungie_name,
    requestedCharacterId,
    rewardsPass: await seasonPassProgress(profile, accessToken, env, requestedCharacterId),
    crucibleRank: normalizePvpProgressions(profile, pvpManifest, selectedId).find((entry) => entry.kind === "crucible"),
    manifest
  });
  await rememberAudienceGuardian(env, guardian);
  return withSetCookie(envelope<SessionData>({
    authenticated: true,
    guardian,
    csrfToken: await csrfToken(session.token, env),
    roles: {
      dev: allowlist(env.DEV_MEMBERSHIP_IDS).has(session.row.membership_id),
      matrixWriter: allowlist(env.MATRIX_MEMBERSHIP_IDS).has(session.row.membership_id),
      buildEditor: allowlist(env.MATRIX_MEMBERSHIP_IDS).has(session.row.membership_id),
      reportAdmin: isReportAdmin(session.row.membership_id, env)
    },
    rolesState: "verified"
  }, env, context, { sourceMintedAt: profile?.responseMintedTimestamp }), visitorCookie);
}

function withSetCookie(response: Response, value?: string): Response {
  if (!value) return response;
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function deleteSession(request: Request, env: Env, context: RequestContext): Promise<Response> {
  const session = await requireSession(request, env);
  await requireCsrf(request, session.token, env);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM fireteam_shares WHERE membership_id = ?").bind(session.row.membership_id),
    env.DB.prepare("DELETE FROM oauth_sessions WHERE session_hash = ?").bind(session.row.session_hash)
  ]);
  return json({ data: { authenticated: false }, freshness: { state: "fresh", observedAt: new Date().toISOString() }, warnings: [], requestId: context.requestId }, 200, env, context.origin, undefined, {
    "Set-Cookie": cookie("gn_session", "", { maxAge: 0, secure: secureCookies(context) })
  });
}

async function overview(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const { profile, accessToken } = await profileFor(row, env);
  const [manifest, pvpManifest] = await Promise.all([loadActivityManifest(env), loadRewardsManifest(env)]);
  const requestedCharacterId = context.url.searchParams.get("characterId") || undefined;
  const selectedId = selectedCharacter(charactersFromProfile(profile), requestedCharacterId)?.characterId;
  const guardian = normalizeGuardian({
    profile,
    membershipId: row.membership_id,
    membershipType: row.membership_type,
    displayName: row.display_name,
    bungieName: row.bungie_name,
    requestedCharacterId,
    rewardsPass: await seasonPassProgress(profile, accessToken, env, requestedCharacterId),
    crucibleRank: normalizePvpProgressions(profile, pvpManifest, selectedId).find((entry) => entry.kind === "crucible"),
    manifest
  });
  await rememberAudienceGuardian(env, guardian);
  return envelope(guardian, env, context, { sourceMintedAt: profile?.responseMintedTimestamp, warnings: transitoryWarning(profile) });
}

async function collection(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const { profile, accessToken } = await profileFor(row, env, "collection");
  const manifest = await loadManifest(env);
  const characters = uniqueXurCharacters(charactersFromProfile(profile), context.url.searchParams.get("characterId") || undefined);
  const xur = characters.length
    ? mergeXurInventories(await xurInventoriesForCharacters(row, characters.map((character) => character.characterId), env, accessToken))
    : { state: "unavailable" as const, itemHashes: [], checkedAt: new Date().toISOString(), warning: "Xûr inventory requires a selected character." };
  const data = normalizeCollection(profile, manifest, undefined, new Set(xur.itemHashes));
  data.xur = { state: xur.state, checkedAt: xur.checkedAt, nextRefreshAt: xur.nextRefreshAt };
  const warnings = [
    ...(manifest.version === "unavailable" ? ["Current manifest data is unavailable; run the manifest sync before production deployment."] : []),
    ...(xur.warning ? [xur.warning] : [])
  ];
  return envelope<CollectionData>(data, env, context, { sourceMintedAt: profile?.responseMintedTimestamp, warnings });
}

async function xur(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const [{ profile, accessToken }, manifest] = await Promise.all([profileFor(row, env, "collection"), loadManifest(env)]);
  const characters = uniqueXurCharacters(charactersFromProfile(profile), context.url.searchParams.get("characterId") || undefined);
  if (!characters.length) return envelope<XurData>({ state: "unavailable", checkedAt: new Date().toISOString(), strangeCoins: xurStrangeCoinBalance(profile), offers: [] }, env, context, { warnings: ["Xûr inventory requires a selected character."] });
  const inventory = mergeXurInventories(await xurInventoriesForCharacters(row, characters.map((character) => character.characterId), env, accessToken, true));
  const observedOffers = inventory.offers || [];
  if (observedOffers.length > 0) {
    const observedData: XurData = inventory.state === "available"
      ? { state: "available", inventoryStatus: "live", checkedAt: inventory.checkedAt, nextRefreshAt: inventory.nextRefreshAt, offers: observedOffers }
      : { state: inventory.state, inventoryStatus: "last-shipment", checkedAt: inventory.checkedAt, inventoryCapturedAt: inventory.checkedAt, nextRefreshAt: inventory.nextRefreshAt, offers: observedOffers };
    await saveLatestXurShipment(env, observedData);
    return envelope<XurData>({ ...observedData, strangeCoins: xurStrangeCoinBalance(profile, observedData.offers), offers: addXurCollectionStates(profile, manifest, observedData.offers) }, env, context, { warnings: inventory.warning ? [inventory.warning] : [] });
  }
  const previous = await readLatestXurShipment(env);
  const liveData: XurData = { state: inventory.state, checkedAt: inventory.checkedAt, nextRefreshAt: inventory.nextRefreshAt, offers: [] };
  const data: XurData = previous
    ? { state: inventory.state, inventoryStatus: "last-shipment", checkedAt: inventory.checkedAt, inventoryCapturedAt: previous.capturedAt, nextRefreshAt: inventory.nextRefreshAt, offers: previous.offers }
    : liveData;
  return envelope<XurData>({ ...data, strangeCoins: xurStrangeCoinBalance(profile, data.offers), offers: addXurCollectionStates(profile, manifest, data.offers) }, env, context, { warnings: inventory.warning ? [inventory.warning] : [] });
}

function uniqueXurCharacters(characters: ReturnType<typeof charactersFromProfile>, requestedCharacterId?: string) {
  const requested = selectedCharacter(characters, requestedCharacterId);
  const ordered = requested ? [requested, ...characters.filter((character) => character.characterId !== requested.characterId)] : characters;
  return ordered.filter((character, index, all) => all.findIndex((candidate) => candidate.className === character.className) === index);
}

async function quests(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const { profile } = await profileFor(row, env, "quests");
  const manifest = await loadQuestManifest(env);
  const character = selectedCharacter(charactersFromProfile(profile), context.url.searchParams.get("characterId") || undefined);
  if (!character) throw httpError(404, "character_missing", "No Destiny character is available.");
  const pinned = new Set((context.url.searchParams.get("pinned") || "").split(",").filter(Boolean));
  return envelope<QuestData>(normalizeQuests(profile, manifest, character.characterId, pinned), env, context, { sourceMintedAt: profile?.responseMintedTimestamp });
}

async function guardianRank(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const [{ profile }, manifest] = await Promise.all([profileFor(row, env, "guardian-rank"), loadGuardianRankManifest(env)]);
  const character = selectedCharacter(charactersFromProfile(profile), context.url.searchParams.get("characterId") || undefined);
  if (!character) throw httpError(404, "character_missing", "No Destiny character is available.");
  const data = normalizeGuardianRanks(profile, manifest, character.characterId);
  const warnings = manifest.version === "unavailable" ? ["Current Guardian Rank definitions are unavailable from the deployed Bungie manifest."] : [];
  return envelope<GuardianRankData>(data, env, context, { sourceMintedAt: profile?.secondaryComponentsMintedTimestamp || profile?.responseMintedTimestamp, warnings });
}

async function journeyProgress(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const [{ profile }, manifest, activities] = await Promise.all([
    profileFor(row, env, "journey"),
    loadJourneyProgressManifest(env),
    loadActivityManifest(env)
  ]);
  const character = selectedCharacter(charactersFromProfile(profile), context.url.searchParams.get("characterId") || undefined);
  if (!character) throw httpError(404, "character_missing", "No Destiny character is available.");
  const data = normalizeJourneyProgress(profile, manifest, activities, character.characterId);
  return envelope<JourneyProgressData>(data, env, context, {
    sourceMintedAt: profile?.secondaryComponentsMintedTimestamp || profile?.responseMintedTimestamp,
    warnings: manifest.version === "unavailable" ? ["Journey record definitions are unavailable until the Bungie manifest refresh completes."] : []
  });
}

async function power(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const { profile } = await profileFor(row, env, "power");
  const character = selectedCharacter(charactersFromProfile(profile), context.url.searchParams.get("characterId") || undefined);
  if (!character) throw httpError(404, "character_missing", "No Destiny character is available.");
  let definitions: Record<string, Record<string, unknown>> = {};
  let warning: string | undefined;
  try {
    definitions = await companionItemDefinitionsFor(env, powerItemHashes(profile));
  } catch {
    warning = "Current item definitions are unavailable, so Power slot ceilings cannot be identified.";
  }
  return envelope<PowerData>(normalizePower(profile, definitions, character.characterId), env, context, {
    sourceMintedAt: profile?.responseMintedTimestamp,
    warnings: warning ? [warning] : []
  });
}

async function pvp(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const { profile, accessToken } = await profileFor(row, env, "session");
  const characters = charactersFromProfile(profile);
  const character = selectedCharacter(characters, context.url.searchParams.get("characterId") || undefined);
  if (!character) throw httpError(404, "character_missing", "No Destiny character is available.");
  const [manifest, activityManifest, historical, recent] = await Promise.all([
    loadRewardsManifest(env),
    loadActivityManifest(env),
    pvpHistoricalStatsFor(row, env, accessToken),
    pvpRecentActivitiesFor(row, characters.map((entry) => entry.characterId), env, accessToken)
  ]);
  const data = normalizePvpData({
    profile,
    manifest,
    characterId: character.characterId,
    historicalStats: [...historical.responses, ironBannerHistoryResponse(recent.activities, activityManifest.activityDefinitions)]
  });
  const warnings = [
    ...(manifest.version === "unavailable" ? ["Current Crucible rank definitions are unavailable from the deployed Bungie manifest."] : []),
    ...(activityManifest.version === "unavailable" ? ["Current Crucible activity definitions are unavailable from the deployed Bungie manifest."] : []),
    ...historical.warnings,
    ...recent.warnings
  ];
  return envelope<PvpData>(data, env, context, { sourceMintedAt: profile?.responseMintedTimestamp, warnings });
}

async function activityHistory(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const { profile, accessToken } = await profileFor(row, env, "session");
  const characters = charactersFromProfile(profile);
  const [manifest, recent] = await Promise.all([
    loadActivityManifest(env),
    recentActivitiesFor(row, characters.map((entry) => entry.characterId), env, accessToken)
  ]);
  const data = normalizeActivityHistory({
    rows: recent.activities,
    characterClasses: Object.fromEntries(characters.map((entry) => [entry.characterId, entry.className])),
    activityDefinitions: manifest.activityDefinitions,
    manifestVersion: manifest.version,
    returnedCharacters: recent.returnedCharacters,
    totalCharacters: characters.length
  });
  const warnings = [
    ...(manifest.version === "unavailable" ? ["Current activity names are unavailable from the deployed Bungie manifest."] : []),
    ...recent.warnings
  ];
  return envelope<ActivityHistoryData>(data, env, context, { sourceMintedAt: profile?.responseMintedTimestamp, warnings });
}

async function rewards(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const { profile, accessToken } = await profileFor(row, env, "session");
  const requestedCharacterId = context.url.searchParams.get("characterId") || undefined;
  const character = selectedCharacter(charactersFromProfile(profile), requestedCharacterId);
  const snapshot = await seasonPassProgress(profile, accessToken, env, character?.characterId);
  const manifest = await loadRewardsManifest(env);
  const data = normalizeRewardsPass({ profile, manifest, rank: snapshot.rank, progress: snapshot.progress, characterId: character?.characterId });
  const warnings = [snapshot.progress.state !== "available" ? snapshot.progress.reason : undefined, data.rewardDataReason].filter((value): value is string => Boolean(value));
  return envelope<RewardsPassData>(data, env, context, { sourceMintedAt: profile?.responseMintedTimestamp, warnings });
}

async function rewardCodeStatus(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const { profile } = await profileFor(row, env, "collectibles");
  const manifest = await loadRewardCodeManifest(env);
  const data = normalizeRewardCodeStatus(profile, manifest);
  const manual = await manualRewardCodes(row.membership_id, env);
  data.manualCodes = manual.codes;
  data.manualCodesConfigured = manual.configured;
  const unavailable = data.statuses.filter((entry) => entry.state === "unavailable").length;
  const warnings = manifest.version === "unavailable"
    ? ["Reward-code collectible mappings are unavailable; automatic ownership detection is temporarily disabled."]
    : unavailable
      ? [`${unavailable} code rewards could not be mapped to an exact current Destiny collectible and remain manually controllable.`]
      : [];
  return envelope<RewardCodeStatusData>(data, env, context, {
    sourceMintedAt: profile?.responseMintedTimestamp,
    warnings
  });
}

async function updateRewardCodePreference(request: Request, row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const input = rewardCodePreferenceSchema.parse(await request.json()) as UpdateRewardCodePreferenceRequest;
  const codes = new Set((await manualRewardCodes(row.membership_id, env)).codes);
  if (input.redeemed) codes.add(input.code); else codes.delete(input.code);
  const values = [...codes].sort();
  await env.DB.prepare(`INSERT INTO user_preferences (membership_id, preference_key, preference_value, updated_at) VALUES (?, 'reward.codes', ?, ?)
    ON CONFLICT(membership_id, preference_key) DO UPDATE SET preference_value = excluded.preference_value, updated_at = excluded.updated_at`)
    .bind(row.membership_id, JSON.stringify(values), new Date().toISOString()).run();
  return envelope<{ manualCodes: string[] }>({ manualCodes: values }, env, context);
}

async function manualRewardCodes(membershipId: string, env: Env): Promise<{ codes: string[]; configured: boolean }> {
  const row = await env.DB.prepare("SELECT preference_value FROM user_preferences WHERE membership_id = ? AND preference_key = 'reward.codes'").bind(membershipId).first<{ preference_value: string }>();
  try {
    const parsed = JSON.parse(row?.preference_value || "[]");
    return { codes: Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string").slice(0, 500) : [], configured: Boolean(row) };
  } catch { return { codes: [], configured: Boolean(row) }; }
}

async function userPreferences(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const result = await env.DB.prepare("SELECT preference_key, preference_value FROM user_preferences WHERE membership_id = ?").bind(row.membership_id).all<{ preference_key: string; preference_value: string }>();
  const values = Object.fromEntries((result.results || []).map((entry) => [entry.preference_key, entry.preference_value])) as UserPreferencesData["values"];
  return envelope<UserPreferencesData>({ values }, env, context);
}

async function updateUserPreference(request: Request, row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const input = preferenceSchema.parse(await request.json()) as UpdateUserPreferenceRequest;
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO user_preferences (membership_id, preference_key, preference_value, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(membership_id, preference_key) DO UPDATE SET preference_value = excluded.preference_value, updated_at = excluded.updated_at`)
    .bind(row.membership_id, input.key, input.value, now).run();
  return envelope<UserPreferencesData>({ values: { [input.key]: input.value } }, env, context);
}

async function gear(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const { profile } = await profileFor(row, env, "gear");
  const manifest = await loadGearManifest(env);
  const character = selectedCharacter(charactersFromProfile(profile), context.url.searchParams.get("characterId") || undefined);
  if (!character) throw httpError(404, "character_missing", "No Destiny character is available.");
  const states = await gearStates(row.membership_id, env);
  const now = new Date().toISOString();
  const data = normalizeGear(profile, manifest, character.characterId, character.className, states, now);
  const missing = [...data.items, ...(data.weapons || [])].filter((item) => !states.has(item.instanceId));
  for (let offset = 0; offset < missing.length; offset += 80) {
    await env.DB.batch(missing.slice(offset, offset + 80).map((item) => env.DB.prepare("INSERT OR IGNORE INTO gear_item_state (membership_id, item_instance_id, first_seen_at, updated_at) VALUES (?, ?, ?, ?)").bind(row.membership_id, item.instanceId, now, now)));
  }
  return envelope<GearData>(data, env, context, { sourceMintedAt: profile?.responseMintedTimestamp, warnings: manifest.version !== "unavailable" ? [] : ["Gear manifest data is unavailable; refresh the deployment manifest before using Gear."] });
}

async function mailbox(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const { profile } = await profileFor(row, env, "mailbox");
  const manifest = await loadCompanionManifest(env);
  return envelope<MailboxData>(normalizeMailbox(profile, manifest), env, context, {
    sourceMintedAt: profile?.responseMintedTimestamp,
    warnings: manifest.version === "unavailable" ? ["Mailbox item definitions are unavailable. Item identities and capacity may be incomplete."] : []
  });
}

async function pullMailboxItem(request: Request, row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const input = mailboxPullSchema.parse(await request.json()) as MailboxPullRequest;
  const { profile, accessToken } = await profileFor(row, env, "mailbox");
  const character = charactersFromProfile(profile).find((entry) => entry.characterId === input.characterId);
  if (!character) throw httpError(403, "character_invalid", "That character does not belong to this Guardian.");
  const item = postmasterItemsForCharacter(profile, input.characterId).find((entry: any) => String(entry?.itemInstanceId || "") === input.itemInstanceId);
  if (!item) throw httpError(404, "postmaster_item_missing", "That item is no longer in this character's Postmaster.");
  const availableQuantity = Math.max(1, Number(item?.quantity || 1));
  if (input.quantity > availableQuantity) throw httpError(409, "postmaster_quantity_changed", `Only ${availableQuantity} of that item remains in the Postmaster.`);
  if (Number(item?.transferStatus || 0) !== 0) throw httpError(409, "postmaster_item_not_transferable", "Bungie has marked that Postmaster item as non-transferable.");
  await bungiePost("/Destiny2/Actions/Items/PullFromPostmaster/", {
    itemReferenceHash: Number(item.itemHash),
    stackSize: input.quantity,
    itemId: input.itemInstanceId,
    characterId: input.characterId,
    membershipType: row.membership_type
  }, env, accessToken);
  return envelope<MailboxPullResult>({ itemInstanceId: input.itemInstanceId, characterId: input.characterId, quantity: input.quantity, pulled: true }, env, context);
}

async function loadouts(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const { profile } = await profileFor(row, env, "loadouts");
  const manifest = await loadCompanionManifest(env);
  const character = selectedCharacter(charactersFromProfile(profile), context.url.searchParams.get("characterId") || undefined);
  if (!character) throw httpError(404, "character_missing", "No Destiny character is available.");
  return envelope<LoadoutsData>(normalizeLoadouts(profile, manifest, character), env, context, {
    sourceMintedAt: profile?.responseMintedTimestamp,
    warnings: manifest.version === "unavailable" ? ["Loadout item definitions are unavailable. Saved item and socket details may be incomplete."] : []
  });
}

async function buildAdvisor(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const force = context.url.searchParams.get("refresh") === "1";
  const { profile, data } = await buildAdvisorSnapshot(row, env, context.url.searchParams.get("characterId") || undefined, force);
  return envelope<BuildAdvisorData>(data, env, context, {
    sourceMintedAt: profile?.responseMintedTimestamp,
    warnings: data.analysis.warnings,
    state: data.state === "current" ? "fresh" : data.state === "may-be-stale" ? "stale" : "unavailable"
  });
}

async function buildAdvisorSnapshot(row: SessionRow, env: Env, characterId: string | undefined, force: boolean) {
  const published = publishedBuildsForAdvisor(env)
    .then((builds) => ({ builds, warning: undefined }))
    .catch(() => ({ builds: [], warning: "Published builds could not be checked during this refresh." }));
  const [{ profile, accessToken }, companionManifest, collectionManifest, gearManifest, publishedResult] = await Promise.all([
    profileFor(row, env, "build-advisor", force),
    loadCompanionManifest(env),
    loadManifest(env),
    loadGearManifest(env),
    published
  ]);
  const characters = charactersFromProfile(profile);
  const character = selectedCharacter(characters, characterId);
  if (!character) throw httpError(404, "character_missing", "No Destiny character is available.");
  const templates = [...BUILD_ADVISOR_TEMPLATES, ...buildAdvisorTemplatesFromPublishedBuilds(publishedResult.builds)];
  const data = normalizeBuildAdvisorData(profile, companionManifest, collectionManifest, characters, character, Date.now(), gearManifest, templates);
  if (publishedResult.warning) data.analysis.warnings.push(publishedResult.warning);
  return { profile, accessToken, characters, character, data };
}

async function equipBuildAdvisor(request: Request, row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const input = equipBuildAdvisorSchema.parse(await request.json()) as EquipBuildAdvisorRequest;
  const started = performance.now();
  const { accessToken, character, data } = await buildAdvisorSnapshot(row, env, input.characterId, true);
  if (character.characterId !== input.characterId) throw httpError(403, "character_invalid", "That character does not belong to this Guardian.");
  const recommendation = data.recommendations.find((entry) => entry.id === input.recommendationId);
  if (!recommendation) throw httpError(409, "recommendation_changed", "This recommendation changed after the last inventory refresh. Refresh Build Advisor and review it again.");
  if (recommendation.classType !== character.className.toLocaleLowerCase()) throw httpError(409, "build_class_mismatch", "This build does not match the selected character class.");
  if (!recommendation.equipPlan.canEquip && recommendation.equipPlan.state !== "already-equipped") {
    throw httpError(409, "build_not_equip_ready", recommendation.equipPlan.blockers[0] || "This build does not have eight equippable physical items yet.");
  }
  const items = buildAdvisorRecommendationItems(recommendation);
  if (items.length !== 8) throw httpError(409, "build_items_changed", "The recommended item set is no longer complete. Refresh Build Advisor before equipping it.");
  if (recommendation.equipPlan.state === "already-equipped") {
    return envelope<EquipBuildAdvisorResult>({
      recommendationId: recommendation.id,
      characterId: character.characterId,
      transferredItemIds: [],
      equippedItemIds: items.map((item) => item.instanceId),
      equipped: true
    }, env, context);
  }

  const transferredItemIds: string[] = [];
  for (const item of items) {
    const needsTransfer = item.location === "vault" || Boolean(item.ownerCharacterId && item.ownerCharacterId !== character.characterId);
    if (!needsTransfer) continue;
    try {
      await moveToCharacter(item, character.characterId, row, env, accessToken);
      transferredItemIds.push(item.instanceId);
      await auditGear(row, env, "buildAdvisorTransfer", item.instanceId, character.characterId, 200, undefined, performance.now() - started);
    } catch (error: any) {
      await auditGear(row, env, "buildAdvisorTransfer", item.instanceId, character.characterId, Number(error?.status || 500), String(error?.code || "action_failed"), performance.now() - started);
      throw error;
    }
  }
  await bungiePost("/Destiny2/Actions/Items/EquipItems/", {
    itemIds: items.map((item) => item.instanceId),
    characterId: character.characterId,
    membershipType: row.membership_type
  }, env, accessToken);
  for (const item of items) await auditGear(row, env, "buildAdvisorEquip", item.instanceId, character.characterId, 200, undefined, performance.now() - started);
  return envelope<EquipBuildAdvisorResult>({
    recommendationId: recommendation.id,
    characterId: character.characterId,
    transferredItemIds,
    equippedItemIds: items.map((item) => item.instanceId),
    equipped: true
  }, env, context);
}

async function equipLoadout(request: Request, row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const input = equipLoadoutSchema.parse(await request.json()) as EquipLoadoutRequest;
  const { profile, accessToken } = await profileFor(row, env, "loadouts");
  const character = charactersFromProfile(profile).find((entry) => entry.characterId === input.characterId);
  if (!character) throw httpError(403, "character_invalid", "That character does not belong to this Guardian.");
  const loadout = profile?.characterLoadouts?.data?.[input.characterId]?.loadouts?.[input.loadoutIndex];
  if (!loadout || !Array.isArray(loadout.items) || loadout.items.length === 0) throw httpError(404, "loadout_missing", "That saved loadout is no longer available on this character.");
  await bungiePost("/Destiny2/Actions/Loadouts/EquipLoadout/", {
    loadoutIndex: input.loadoutIndex,
    characterId: input.characterId,
    membershipType: row.membership_type
  }, env, accessToken);
  return envelope<EquipLoadoutResult>({ loadoutIndex: input.loadoutIndex, characterId: input.characterId, equipped: true }, env, context);
}

async function updateGearState(request: Request, row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const input = gearStateSchema.parse(await request.json());
  const { profile, accessToken } = await profileFor(row, env, "gear");
  const manifest = await loadGearManifest(env);
  const character = selectedCharacter(charactersFromProfile(profile));
  if (!character) throw httpError(404, "character_missing", "No Destiny character is available.");
  const states = await gearStates(row.membership_id, env);
  const gear = normalizeGear(profile, manifest, character.characterId, character.className, states, new Date().toISOString());
  const item = [...gear.items, ...(gear.weapons || [])].find((entry) => entry.instanceId === input.itemInstanceId);
  if (!item) throw httpError(404, "gear_item_missing", "That gear item does not belong to this Guardian.");
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO gear_item_state (membership_id, item_instance_id, tag, first_seen_at, dismissed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(membership_id, item_instance_id) DO UPDATE SET tag = excluded.tag, dismissed_at = excluded.dismissed_at, updated_at = excluded.updated_at`)
    .bind(row.membership_id, item.instanceId, input.tag ?? item.tag ?? null, item.firstSeenAt || now, input.dismissed ? now : item.dismissedAt || null, now).run();
  let warning: string | undefined;
  if ((input.tag === "favorite" || input.tag === "keep") && !item.locked) {
    try { await bungiePost("/Destiny2/Actions/Items/SetLockState/", { state: true, itemId: item.instanceId, characterId: item.ownerCharacterId || character.characterId, membershipType: row.membership_type }, env, accessToken); }
    catch (error: any) { warning = `Tag saved, but Bungie could not lock the item: ${error.message}`; }
  }
  return envelope({ itemInstanceId: item.instanceId, tag: input.tag, dismissed: Boolean(input.dismissed) }, env, context, { warnings: warning ? [warning] : [] });
}

async function gearAction(request: Request, row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const input = gearActionSchema.parse(await request.json()) as GearActionRequest;
  const started = performance.now();
  const { profile, accessToken } = await profileFor(row, env, "gear");
  const manifest = await loadGearManifest(env);
  const characters = charactersFromProfile(profile);
  const selected = selectedCharacter(characters, "characterId" in input ? input.characterId : "targetCharacterId" in input ? input.targetCharacterId : undefined) || characters[0];
  if (!selected) throw httpError(404, "character_missing", "No Destiny character is available.");
  const gear = normalizeGear(profile, manifest, selected.characterId, selected.className, await gearStates(row.membership_id, env), new Date().toISOString());
  const items = [...gear.items, ...(gear.weapons || [])];
  const byId = new Map(items.map((item) => [item.instanceId, item]));
  const requested = input.action === "groupPull" ? input.itemInstanceIds : [input.itemInstanceId];
  const result: GearActionResult = { action: input.action, succeeded: [], skipped: [], failed: [] };
  for (const instanceId of requested) {
    const item = byId.get(instanceId);
    const targetId = input.action === "equip" || input.action === "groupPull" ? input.characterId : input.action === "transfer" ? input.targetCharacterId : input.characterId;
    const target = targetId ? characters.find((character) => character.characterId === targetId) : undefined;
    if (!item) { result.failed.push({ itemInstanceId: instanceId, code: "ownership_invalid", message: "Item is not owned by this Guardian." }); continue; }
    if (targetId && !target) { result.failed.push({ itemInstanceId: instanceId, code: "character_invalid", message: "Target character is not owned by this Guardian." }); continue; }
    try {
      if (input.action === "setLock") {
        await bungiePost("/Destiny2/Actions/Items/SetLockState/", { state: input.locked, itemId: instanceId, characterId: input.characterId || item.ownerCharacterId || selected.characterId, membershipType: row.membership_type }, env, accessToken);
      } else if (input.action === "transfer") {
        if (input.target === "vault") {
          if (item.equipped) { result.skipped.push({ itemInstanceId: instanceId, reason: "Equip another item before vaulting this one." }); continue; }
          if (item.location === "vault") { result.skipped.push({ itemInstanceId: instanceId, reason: "Already in vault." }); continue; }
          await transfer(item, true, item.ownerCharacterId || selected.characterId, row, env, accessToken);
        } else {
          if (!target) throw httpError(400, "character_required", "Choose a target character.");
          await moveToCharacter(item, target.characterId, row, env, accessToken);
        }
      } else if (input.action === "groupPull") {
        if (item.location !== "vault") { result.skipped.push({ itemInstanceId: instanceId, reason: "Item is already outside the vault." }); continue; }
        await transfer(item, false, input.characterId, row, env, accessToken);
      } else if (input.action === "equip") {
        await moveToCharacter(item, input.characterId, row, env, accessToken);
        await bungiePost("/Destiny2/Actions/Items/EquipItem/", { itemId: instanceId, characterId: input.characterId, membershipType: row.membership_type }, env, accessToken);
      }
      result.succeeded.push(instanceId);
      await auditGear(row, env, input.action, instanceId, targetId, 200, undefined, performance.now() - started);
    } catch (error: any) {
      result.failed.push({ itemInstanceId: instanceId, code: String(error?.code || "action_failed"), message: String(error?.message || "Bungie action failed.") });
      await auditGear(row, env, input.action, instanceId, targetId, Number(error?.status || 500), String(error?.code || "action_failed"), performance.now() - started);
    }
  }
  return envelope(result, env, context, { warnings: result.failed.length ? ["One or more Gear actions failed. Inventory was refreshed from Bungie after the completed steps."] : [] });
}

async function gearStates(membershipId: string, env: Env): Promise<Map<string, GearStateRow>> {
  const { results = [] } = await env.DB.prepare("SELECT item_instance_id, tag, first_seen_at, dismissed_at FROM gear_item_state WHERE membership_id = ?").bind(membershipId).all<GearStateRow>();
  return new Map(results.map((row) => [String(row.item_instance_id), row]));
}

async function transfer(item: any, toVault: boolean, characterId: string, row: SessionRow, env: Env, accessToken: string): Promise<void> {
  await bungiePost("/Destiny2/Actions/Items/TransferItem/", { itemReferenceHash: Number(item.itemHash), stackSize: 1, transferToVault: toVault, itemId: item.instanceId, characterId, membershipType: row.membership_type }, env, accessToken);
}
async function moveToCharacter(item: any, characterId: string, row: SessionRow, env: Env, accessToken: string): Promise<void> {
  if (item.location === "vault") return transfer(item, false, characterId, row, env, accessToken);
  if (item.ownerCharacterId === characterId) return;
  if (item.equipped) throw httpError(409, "item_equipped", "Equip another item before moving this equipped gear item.");
  await transfer(item, true, item.ownerCharacterId, row, env, accessToken);
  await transfer(item, false, characterId, row, env, accessToken);
}
async function auditGear(row: SessionRow, env: Env, action: string, itemId: string, target: string | undefined, status: number, code: string | undefined, duration: number): Promise<void> {
  await env.DB.prepare("INSERT INTO gear_action_audit (membership_id, action, item_instance_id, target_character_id, status, error_code, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(row.membership_id, action, itemId, target || null, status, code || null, Math.round(duration)).run();
}

async function upsertShare(request: Request, row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const input = shareSchema.parse(await request.json());
  const result = await storeShare(row, env, input.characterId, input.sitePinnedQuestIds, input.mode, input.siteTrackedGuardianRankIds, input.hiddenTrackedItemKeys, input.siteTrackedJourneyIds, input.siteTrackedCollectionIds, input.readiness, input.siteTrackedBuilds);
  return envelope({
    sharing: true,
    mode: input.mode,
    expiresAt: input.mode === "temporary" ? result.expiresAt : undefined,
    sharedQuestCount: result.sharedQuestCount,
    sharedTrackedItemCount: result.sharedTrackedItemCount
  }, env, context, { sourceMintedAt: result.sourceMintedAt });
}

async function storeShare(
  row: SessionRow,
  env: Env,
  characterId: string,
  sitePinnedQuestIds: string[],
  mode: FireteamSharingMode,
  providedGuardianRankIds?: string[],
  providedHiddenTrackedItemKeys?: string[],
  providedJourneyIds?: string[],
  providedCollectionIds?: string[],
  providedReadiness?: import("@guardian-nexus/contracts").FireteamReadinessSummary | null,
  providedTrackedBuilds?: import("@guardian-nexus/contracts").FireteamTrackedItem[]
): Promise<{ expiresAt: string; sharedQuestCount: number; sharedTrackedItemCount: number; sourceMintedAt?: string }> {
  const [{ profile }, manifest, guardianRankManifest, journeyManifest, activityManifest, collectionManifest, previousShare] = await Promise.all([
    profileFor(row, env, "fireteam-share"),
    loadQuestManifest(env),
    loadGuardianRankManifest(env),
    loadJourneyProgressManifest(env),
    loadActivityManifest(env),
    loadManifest(env),
    env.DB.prepare("SELECT payload_json FROM fireteam_shares WHERE membership_id = ?").bind(row.membership_id).first<{ payload_json: string }>()
  ]);
  let previousPayload: any = null;
  try { previousPayload = previousShare?.payload_json ? JSON.parse(previousShare.payload_json) : null; } catch { previousPayload = null; }
  const previousTrackedItems = sharedTrackedItems(previousPayload);
  const previousTrackedKeys = new Set(previousTrackedItems.map(trackedItemKey));
  const character = selectedCharacter(charactersFromProfile(profile), characterId);
  if (!character || character.characterId !== characterId) throw httpError(400, "character_invalid", "The selected character does not belong to this Guardian.");
  const allQuests = normalizeQuests(profile, manifest, character.characterId, new Set(sitePinnedQuestIds));
  const allowedIds = new Set(allQuests.quests.map((quest) => quest.instanceId));
  const questsToShare = allQuests.quests.filter((quest) => quest.inGameTracked || (quest.sitePinned && allowedIds.has(quest.instanceId)));
  const activeTrackedQuests = trackedItemsFromQuests(questsToShare);
  const activeQuestIds = new Set(activeTrackedQuests.map((item) => item.id));
  const compactSharedQuests = questsToShare.filter((quest) => activeQuestIds.has(quest.instanceId)).map((quest) => ({ ...quest, steps: undefined }));
  const siteTrackedGuardianRanks = providedGuardianRankIds === undefined
    ? await guardianRankTrackedIds(row.membership_id, env)
    : new Set(providedGuardianRankIds);
  const guardianRanks = normalizeGuardianRanks(profile, guardianRankManifest, character.characterId);
  const journeyTrackedIds = providedJourneyIds === undefined
    ? await trackedPreferenceIds(row.membership_id, env, "journey.tracked")
    : new Set(providedJourneyIds);
  const journey = normalizeJourneyProgress(profile, journeyManifest, activityManifest, character.characterId);
  const collectionTrackedIds = providedCollectionIds === undefined
    ? await trackedPreferenceIds(row.membership_id, env, "collection.tracked")
    : new Set(providedCollectionIds);
  const collection = normalizeCollection(profile, collectionManifest);
  const trackedBuilds = providedTrackedBuilds === undefined ? sharedTrackedBuilds(previousPayload) : providedTrackedBuilds;
  const activeTrackedBuilds = trackedBuilds.filter((item) => item.percent < 100);
  const assembledTrackedItems = mergeTrackedItems(
    activeTrackedQuests,
    trackedItemsFromGuardianRanks(guardianRanks, siteTrackedGuardianRanks, profile?.responseMintedTimestamp || new Date().toISOString()),
    trackedItemsFromJourney(journey, journeyTrackedIds, profile?.responseMintedTimestamp || new Date().toISOString()),
    trackedItemsFromCollection(collection, collectionTrackedIds, profile?.responseMintedTimestamp || new Date().toISOString()),
    activeTrackedBuilds
  );
  const visibility = applyTrackedItemVisibility(
    assembledTrackedItems,
    providedHiddenTrackedItemKeys === undefined ? sharedHiddenTrackedItemKeys(previousPayload) : providedHiddenTrackedItemKeys
  );
  const trackedItems = visibility.items;
  const updatedAt = new Date().toISOString();
  const completedCandidates = mergeTrackedItems(
    trackedItemsFromQuests(allQuests.quests, true, previousTrackedKeys),
    trackedItemsFromGuardianRanks(guardianRanks, siteTrackedGuardianRanks, profile?.responseMintedTimestamp || updatedAt, true, previousTrackedKeys),
    trackedItemsFromJourney(journey, journeyTrackedIds, profile?.responseMintedTimestamp || updatedAt, true, previousTrackedKeys),
    trackedItemsFromCollection(collection, collectionTrackedIds, profile?.responseMintedTimestamp || updatedAt, true, previousTrackedKeys),
    trackedBuilds.filter((item) => item.percent >= 100)
  );
  const recentlyCompletedItems = completedTrackedItemEvents(
    previousTrackedItems,
    completedCandidates,
    sharedRecentlyCompletedItems(previousPayload),
    updatedAt,
    FIRETEAM_COMPLETION_RETENTION_MS
  );
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const readiness = providedReadiness === undefined ? sharedReadiness(previousPayload) : providedReadiness || undefined;
  const payload = { character, activity: allQuests.currentActivity, trackedItems, hiddenTrackedItemKeys: visibility.hiddenKeys, recentlyCompletedItems, quests: compactSharedQuests, readiness };
  await env.DB.prepare(`
    INSERT INTO fireteam_shares (membership_id, display_name, character_id, updated_at, expires_at, payload_json, sharing_mode, site_pinned_quest_ids_json, last_error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
    ON CONFLICT(membership_id) DO UPDATE SET display_name = excluded.display_name, character_id = excluded.character_id, updated_at = excluded.updated_at, expires_at = excluded.expires_at, payload_json = excluded.payload_json, sharing_mode = excluded.sharing_mode, site_pinned_quest_ids_json = excluded.site_pinned_quest_ids_json, last_error = NULL
  `).bind(row.membership_id, row.display_name, character.characterId, updatedAt, expiresAt, JSON.stringify(payload), mode, JSON.stringify(sitePinnedQuestIds)).run();
  return { expiresAt, sharedQuestCount: compactSharedQuests.length, sharedTrackedItemCount: trackedItems.length, sourceMintedAt: profile?.responseMintedTimestamp };
}

async function guardianRankTrackedIds(membershipId: string, env: Env): Promise<Set<string>> {
  return trackedPreferenceIds(membershipId, env, "guardianRank.tracked");
}

async function trackedPreferenceIds(membershipId: string, env: Env, key: string): Promise<Set<string>> {
  const row = await env.DB.prepare("SELECT preference_value FROM user_preferences WHERE membership_id = ? AND preference_key = ?").bind(membershipId, key).first<{ preference_value: string }>();
  try {
    const parsed = JSON.parse(row?.preference_value || "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string" && Boolean(value)).slice(0, 200) : []);
  } catch { return new Set(); }
}

async function refreshPersistentShares(env: Env): Promise<void> {
  const { results = [] } = await env.DB.prepare("SELECT membership_id, character_id, site_pinned_quest_ids_json FROM fireteam_shares WHERE sharing_mode = 'persistent'").all<any>();
  for (const share of results) {
    const row = await env.DB.prepare(`
      SELECT s.session_hash, s.membership_id, u.membership_type, u.display_name, u.bungie_name,
        s.access_token_cipher, s.refresh_token_cipher, s.access_expires_at, s.refresh_expires_at
      FROM oauth_sessions s JOIN users u ON u.membership_id = s.membership_id
      WHERE s.membership_id = ? AND s.refresh_expires_at > ?
      ORDER BY s.updated_at DESC LIMIT 1
    `).bind(String(share.membership_id), Math.floor(Date.now() / 1000)).first<SessionRow>();
    if (!row) {
      await env.DB.prepare("UPDATE fireteam_shares SET last_error = ? WHERE membership_id = ?").bind("Bungie authorization must be renewed.", String(share.membership_id)).run();
      continue;
    }
    let pinnedIds: string[] = [];
    try { pinnedIds = z.array(z.string()).max(40).parse(JSON.parse(String(share.site_pinned_quest_ids_json || "[]"))); } catch { pinnedIds = []; }
    try {
      await storeShare(row, env, String(share.character_id), pinnedIds, "persistent");
    } catch (error: any) {
      await env.DB.prepare("UPDATE fireteam_shares SET last_error = ? WHERE membership_id = ?").bind(String(error?.message || "Background refresh failed.").slice(0, 240), String(share.membership_id)).run();
    }
  }
}

async function fireteam(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const { profile, accessToken } = await profileFor(row, env, "fireteam");
  const manifest = await loadActivityManifest(env);
  const transitory = profile?.profileTransitoryData?.data || profile?.profileTransitory?.data || {};
  const now = new Date().toISOString();
  const { results = [] } = await env.DB.prepare("SELECT membership_id, display_name, updated_at, expires_at, payload_json, sharing_mode, last_error FROM fireteam_shares WHERE sharing_mode = 'persistent' OR expires_at > ?").bind(now).all<any>();
  const shares = new Map(results.map((result: any) => [String(result.membership_id), result]));
  const party = (transitory.partyMembers || []).map((member: any) => ({
    membershipId: String(member.membershipId || member.destinyMembershipId || ""),
    displayName: String(member.displayName || member.bungieGlobalDisplayName || "").trim(),
    emblemHash: String(member.emblemHash || ""),
    status: Number(member.status || 0),
    observedInParty: true
  })).filter((member: any) => member.membershipId);
  if (!party.some((member: any) => member.membershipId === row.membership_id)) party.unshift({ membershipId: row.membership_id, displayName: row.bungie_name || row.display_name, emblemHash: "", status: 1, observedInParty: false });
  const ownCharacter = selectedCharacter(charactersFromProfile(profile), context.url.searchParams.get("characterId") || undefined);
  const activeOwnCharacter = charactersFromProfile(profile).find((character) => character.minutesPlayedThisSession > 0) || ownCharacter;
  const ownOnlineState = guardianOnlineState(activeOwnCharacter, activityName(profile, manifest, activeOwnCharacter?.characterId), true, party.some((member: any) => member.membershipId === row.membership_id && member.observedInParty));
  const fireteamActivity = guardianLocation(profile, manifest, activeOwnCharacter?.characterId, ownOnlineState);
  const social = await socialRosterFor(row, accessToken, env);
  const socialByMembership = new Map((social.contacts || []).map((contact) => [contact.membershipId, contact]));
  const trackedItemCounts = new Map<string, number>();
  for (const member of party) {
    const share: any = shares.get(member.membershipId);
    const payload = share ? JSON.parse(share.payload_json) : null;
    for (const item of sharedTrackedItems(payload)) {
      const key = `${item.kind}:${item.definitionHash}`;
      trackedItemCounts.set(key, (trackedItemCounts.get(key) || 0) + 1);
    }
  }
  const members: FireteamMember[] = await Promise.all(party.map(async (member: any) => {
    const share: any = shares.get(member.membershipId);
    let payload: any = null;
    try { payload = share ? JSON.parse(share.payload_json) : null; } catch { payload = null; }
    const memberQuests = payload?.quests || [];
    const memberTrackedItems = sharedTrackedItems(payload);
    const isSelf = member.membershipId === row.membership_id;
    const socialContact = socialByMembership.get(member.membershipId);
    const publicProfile = !isSelf
      ? (await publicProfileFor(member.membershipId, socialContact?.membershipType || row.membership_type, env, accessToken)).profile
      : undefined;
    const publicCharacters = publicProfile ? charactersFromProfile(publicProfile) : [];
    const publicCharacter = publicCharacters.find((entry) => entry.minutesPlayedThisSession > 0) || publicCharacters[0];
    const character = payload?.character || publicCharacter || (isSelf ? ownCharacter : undefined);
    const directProfile = isSelf ? profile : publicProfile;
    const directCharacter = isSelf ? activeOwnCharacter : publicCharacter;
    const rawActivity = directProfile ? activityName(directProfile, manifest, directCharacter?.characterId) : undefined;
    const onlineState = guardianOnlineState(directCharacter || character, rawActivity || payload?.activity, isSelf || Boolean(publicProfile), Boolean(member.observedInParty));
    const publicLocation = directProfile ? guardianLocation(directProfile, manifest, directCharacter?.characterId, onlineState) : undefined;
    const activity = onlineState === "offline" ? undefined : publicLocation || payload?.activity || (onlineState === "online" ? "Online · location unavailable" : undefined);
    const publicName = destinyDisplayName(publicProfile?.profile?.data?.userInfo);
    const inGameName = member.displayName || publicName || (isSelf ? row.bungie_name || row.display_name : share?.display_name) || "Unknown Guardian";
    return {
      membershipId: member.membershipId,
      displayName: inGameName,
      inGameName,
      emblemPath: character?.emblemPath || await emblemPathFor(member.emblemHash, env),
      presenceLabel: partyPresenceLabel(member.status),
      onlineState,
      character,
      activity,
      activitySource: onlineState === "offline" ? "unavailable" : publicLocation ? "public" : payload?.activity ? "shared" : "unavailable",
      isSelf,
      isLeader: (member.status & 8) !== 0,
      syncState: share ? "synced" : "not-synced",
      sharing: Boolean(share),
      sharingMode: share?.sharing_mode,
      expiresAt: share?.sharing_mode === "temporary" ? share?.expires_at : undefined,
      trackedItems: memberTrackedItems,
      recentlyCompletedItems: sharedRecentlyCompletedItems(payload),
      readiness: sharedReadiness(payload),
      quests: memberQuests,
      overlaps: memberTrackedItems.filter((item) => (trackedItemCounts.get(`${item.kind}:${item.definitionHash}`) || 0) > 1).map((item) => item.name),
      freshness: {
        state: share && Date.now() - Date.parse(share.updated_at) > 15 * 60_000 ? "stale" : "fresh",
        observedAt: share?.updated_at || now,
        ageSeconds: share ? Math.max(0, Math.round((Date.now() - Date.parse(share.updated_at)) / 1000)) : 0
      }
    };
  }));
  const ownShare = shares.get(row.membership_id);
  let ownSharePayload: any = null;
  try { ownSharePayload = ownShare?.payload_json ? JSON.parse(ownShare.payload_json) : null; } catch { ownSharePayload = null; }
  const data: FireteamData = { sharingEnabled: Boolean(ownShare), sharingMode: ownShare?.sharing_mode || "off", sharingExpiresAt: ownShare?.sharing_mode === "temporary" ? ownShare.expires_at : undefined, hiddenTrackedItemKeys: sharedHiddenTrackedItemKeys(ownSharePayload), activity: fireteamActivity, members, social };
  return envelope(data, env, context, { sourceMintedAt: profile?.responseMintedTimestamp, warnings: ["Bungie marks party and current-activity data as non-authoritative and potentially stale.", ...(social.warning ? [social.warning] : []), ...(ownShare?.last_error ? [String(ownShare.last_error)] : [])] });
}

function sharedTrackedItems(payload: any): FireteamTrackedItem[] {
  return Array.isArray(payload?.trackedItems) ? payload.trackedItems : trackedItemsFromQuests(Array.isArray(payload?.quests) ? payload.quests : []);
}

function sharedRecentlyCompletedItems(payload: any): FireteamCompletedTrackedItem[] {
  const cutoff = Date.now() - FIRETEAM_COMPLETION_RETENTION_MS;
  return Array.isArray(payload?.recentlyCompletedItems)
    ? payload.recentlyCompletedItems.filter((item: FireteamCompletedTrackedItem) => Number.isFinite(Date.parse(item.completedAt)) && Date.parse(item.completedAt) >= cutoff)
    : [];
}

function sharedReadiness(payload: any): import("@guardian-nexus/contracts").FireteamReadinessSummary | undefined {
  const parsed = fireteamReadinessSchema.safeParse(payload?.readiness);
  return parsed.success ? parsed.data : undefined;
}

function sharedTrackedBuilds(payload: any): import("@guardian-nexus/contracts").FireteamTrackedItem[] {
  const parsed = z.array(fireteamTrackedBuildSchema).max(8).safeParse(payload?.trackedItems?.filter((item: any) => item?.kind === "build") || []);
  return parsed.success ? parsed.data : [];
}

function sharedHiddenTrackedItemKeys(payload: any): string[] {
  return Array.isArray(payload?.hiddenTrackedItemKeys)
    ? [...new Set((payload.hiddenTrackedItemKeys as unknown[]).filter((key): key is string => typeof key === "string" && Boolean(key)))].slice(0, 200)
    : [];
}

async function matrix(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const permittedMembershipIds = allowlist(env.MATRIX_MEMBERSHIP_IDS);
  const { results = [] } = await env.DB.prepare("SELECT membership_id, display_name, synced_at, manifest_version, payload_json FROM matrix_snapshots ORDER BY display_name").all<any>();
  const snapshots = results
    .filter((result: any) => permittedMembershipIds.has(String(result.membership_id)))
    .map((result: any) => ({ ...JSON.parse(result.payload_json), membershipId: result.membership_id, displayName: result.display_name, syncedAt: result.synced_at, manifestVersion: result.manifest_version }));
  const { results: users = [] } = await env.DB.prepare("SELECT membership_id, display_name FROM users ORDER BY display_name").all<any>();
  const guardians = matrixGuardianRoster(
    permittedMembershipIds,
    users.map((user: any) => ({ membershipId: String(user.membership_id), displayName: String(user.display_name) })),
    snapshots,
    { membershipId: row.membership_id, displayName: row.display_name }
  );
  const audience = canViewAudienceMetrics(row.membership_id, env.DEV_MEMBERSHIP_IDS) ? await readAudienceMetrics(env) : undefined;
  return envelope<MatrixData>({ guardians, snapshots, canSync: permittedMembershipIds.has(row.membership_id), ...(audience ? { audience } : {}) }, env, context, {
    warnings: snapshots.some((snapshot: MatrixSnapshot) => Date.now() - Date.parse(snapshot.syncedAt) > 86_400_000) ? ["One or more Guardian snapshots are older than 24 hours."] : []
  });
}

async function syncMatrix(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  if (!allowlist(env.MATRIX_MEMBERSHIP_IDS).has(row.membership_id)) throw httpError(403, "matrix_update_forbidden", "This Guardian may view but cannot update Guardian Matrix.");
  const { profile } = await profileFor(row, env, "collection");
  const manifest = await loadManifest(env);
  const characters = charactersFromProfile(profile);
  const classEntries = characters.flatMap((character) => normalizeCollection(profile, manifest, character.className).entries);
  const byHash = new Map(classEntries.map((entry) => [entry.itemHash, entry]));
  const syncedAt = new Date().toISOString();
  const snapshot: MatrixSnapshot = {
    membershipId: row.membership_id,
    displayName: row.display_name,
    syncedAt,
    manifestVersion: manifest.version,
    entries: [...byHash.values()].map(({ itemHash, name, kind, className: entryClass, owned, catalyst }) => ({ itemHash, name, kind, className: entryClass, owned, catalyst }))
  };
  await env.DB.prepare(`
    INSERT INTO matrix_snapshots (membership_id, display_name, synced_at, manifest_version, payload_json)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(membership_id) DO UPDATE SET display_name = excluded.display_name, synced_at = excluded.synced_at, manifest_version = excluded.manifest_version, payload_json = excluded.payload_json
  `).bind(row.membership_id, row.display_name, syncedAt, manifest.version, JSON.stringify(snapshot)).run();
  return envelope(snapshot, env, context, { sourceMintedAt: profile?.responseMintedTimestamp });
}

async function devProbe(request: Request, row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  requireDev(row, env);
  const input = probeSchema.parse(await request.json());
  const accessToken = await accessTokenFor(row, env);
  const components = (input.components || [100, 200]).join(",");
  const paths: Record<DevProbeKey, string> = {
    memberships: "/User/GetMembershipsForCurrentUser/",
    profile: `/Destiny2/${row.membership_type}/Profile/${row.membership_id}/?components=${components}`,
    character: `/Destiny2/${row.membership_type}/Profile/${row.membership_id}/Character/${required(input.characterId, "characterId")}/?components=${components}`,
    item: `/Destiny2/Manifest/DestinyInventoryItemDefinition/${required(input.hash, "hash")}/?lc=en`,
    collectible: `/Destiny2/Manifest/DestinyCollectibleDefinition/${required(input.hash, "hash")}/?lc=en`,
    "public-milestones": "/Destiny2/Milestones/",
    manifest: "/Destiny2/Manifest/"
  };
  const started = performance.now();
  let status = 200;
  let body: any;
  try {
    body = await bungieGet(paths[input.probe], env, accessToken);
  } catch (error: any) {
    status = Number(error.status || 500);
    body = { code: error.code, message: error.message, retryAfterSeconds: error.retryAfterSeconds };
  }
  const safeBody = redact(body);
  const durationMs = Math.round(performance.now() - started);
  const responseSize = new TextEncoder().encode(JSON.stringify(safeBody)).length;
  await env.DB.prepare("INSERT INTO dev_probe_audit (membership_id, endpoint_key, status, duration_ms, response_size) VALUES (?, ?, ?, ?, ?)").bind(row.membership_id, input.probe, status, durationMs, responseSize).run();
  const result: DevProbeResult = {
    probe: input.probe,
    status,
    durationMs,
    responseSize,
    throttleSeconds: Number(body?.ThrottleSeconds || body?.retryAfterSeconds || 0),
    mintedAt: body?.responseMintedTimestamp,
    body: safeBody
  };
  return envelope(result, env, context, { state: status === 429 ? "throttled" : status >= 400 ? "unavailable" : "fresh" });
}

async function manifestSearch(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  requireDev(row, env);
  const query = (context.url.searchParams.get("q") || "").trim().toLowerCase();
  if (query.length < 2) throw httpError(400, "search_too_short", "Manifest search requires at least two characters.");
  const manifest = await loadManifest(env);
  const results = manifest.items.filter((item) => `${item.name} ${item.itemType} ${item.source}`.toLowerCase().includes(query)).slice(0, 50);
  return envelope({ query, manifestVersion: manifest.version, results }, env, context);
}

function requireDev(row: SessionRow, env: Env): void {
  if (!allowlist(env.DEV_MEMBERSHIP_IDS).has(row.membership_id)) throw httpError(403, "dev_access_forbidden", "Developer diagnostics are restricted.");
}

function required(value: string | undefined, name: string): string {
  if (!value) throw httpError(400, `${name}_required`, `${name} is required for this probe.`);
  return encodeURIComponent(value);
}

function transitoryWarning(profile: any): string[] {
  const transitory = profile?.profileTransitoryData?.data || profile?.profileTransitory?.data;
  return transitory?.currentActivity ? ["Current activity is Bungie transitory data and may be stale."] : [];
}

function sanitizeReturnTo(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/collection";
}

function base64Text(value: string): string {
  return btoa(unescape(encodeURIComponent(value))).replace(/=+$/, "");
}

function decodeText(value: string): string {
  try { return decodeURIComponent(escape(atob(value.padEnd(Math.ceil(value.length / 4) * 4, "=")))); } catch { return "/collection"; }
}
