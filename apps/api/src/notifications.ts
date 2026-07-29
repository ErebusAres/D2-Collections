import type {
  DistortionData,
  DistortionObservation,
  GuardianNotification,
  HappeningCard,
  NotificationCategory,
  NotificationFeedData,
  NotificationPreferences,
  NotificationPriority,
  NotificationSourceConfidence,
  UpdateNotificationPreferencesRequest,
  UpdateNotificationStateRequest,
  WhatsHappeningData
} from "@guardian-nexus/contracts";
import { z } from "zod";
import { allowlist, httpError, requireCsrf, sessionFromRequest } from "./security";
import type { Env, SessionRow } from "./types";
import { readLatestXurShipment } from "./xurSnapshot";

const ALL_CATEGORIES: NotificationCategory[] = [
  "distortion", "crucible", "trials", "iron-banner", "gambit", "vanguard", "exotic", "legendary",
  "seasonal", "eververse", "bungie-news", "completion", "warning", "outage", "redemption-code", "system"
];

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabledCategories: ALL_CATEGORIES,
  globalNotifications: true,
  accountNotifications: true,
  bannerVisible: true,
  autoDismissMs: 10_000,
  reducedMotion: false,
  sound: false,
  lowPriorityInFeed: false,
  frequency: "all"
};

const stateSchema = z.object({
  notificationId: z.string().min(1).max(180),
  action: z.enum(["read", "unread", "dismiss", "archive", "delete"])
}).strict();

const preferencesSchema = z.object({
  preferences: z.object({
    enabledCategories: z.array(z.enum(ALL_CATEGORIES as [NotificationCategory, ...NotificationCategory[]])).max(ALL_CATEGORIES.length),
    globalNotifications: z.boolean(),
    accountNotifications: z.boolean(),
    bannerVisible: z.boolean(),
    autoDismissMs: z.number().int().min(4_000).max(60_000),
    reducedMotion: z.boolean(),
    sound: z.literal(false),
    lowPriorityInFeed: z.boolean(),
    frequency: z.enum(["all", "important", "minimal"])
  }).strict()
}).strict();

const manualNotificationSchema = z.object({
  id: z.string().trim().min(3).max(180).regex(/^[a-zA-Z0-9:_-]+$/),
  eventKey: z.string().trim().min(1).max(180).optional(),
  type: z.string().trim().min(1).max(80),
  category: z.enum(ALL_CATEGORIES as [NotificationCategory, ...NotificationCategory[]]),
  priority: z.enum(["critical", "high", "normal", "low"]),
  title: z.string().trim().min(1).max(180),
  subtitle: z.string().trim().max(240).optional(),
  description: z.string().trim().max(2_000).optional(),
  icon: z.string().trim().max(500).optional(),
  imageUrl: z.string().trim().url().max(1_000).optional(),
  destinationUrl: z.string().trim().max(1_000).optional(),
  externalUrl: z.string().trim().url().max(1_000).optional(),
  startsAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  dismissible: z.boolean().default(true),
  autoDismiss: z.boolean().default(true),
  autoDismissMs: z.number().int().min(4_000).max(60_000).optional(),
  sourceLabel: z.string().trim().max(120).default("Guardian Nexus"),
  sourceConfidence: z.enum(["confirmed", "live-api", "observed", "community-reported", "estimated", "predicted", "unavailable"]).default("confirmed")
}).strict();

const distortionObservationSchema = z.object({
  destination: z.string().trim().min(1).max(100),
  destinationIcon: z.string().trim().max(500).optional(),
  destinationImage: z.string().trim().max(1_000).optional(),
  observedStartAt: z.string().datetime(),
  observedEndAt: z.string().datetime().optional(),
  source: z.string().trim().min(1).max(160),
  confidence: z.enum(["confirmed", "live-api", "observed", "community-reported", "estimated"]).default("observed")
}).strict();

type NotificationRow = Record<string, unknown>;

export async function readNotificationFeed(request: Request, env: Env): Promise<NotificationFeedData> {
  const session = await sessionFromRequest(request, env);
  const membershipId = session?.row.membership_id;
  const url = new URL(request.url);
  const history = url.searchParams.get("history") === "true";
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || (history ? 50 : 24))));
  const cursor = url.searchParams.get("cursor");
  const now = new Date().toISOString();
  const rows = membershipId
    ? await env.DB.prepare(`
        SELECT n.*, s.read_at, s.dismissed_at, s.archived_at, s.deleted_at
        FROM guardian_notifications n
        LEFT JOIN notification_user_state s ON s.notification_id = n.id AND s.membership_id = ?
        WHERE (n.scope = 'global' OR n.account_membership_id = ?)
          AND (? = 1 OR ((n.starts_at IS NULL OR n.starts_at <= ?) AND (n.expires_at IS NULL OR n.expires_at > ?)))
          AND (? IS NULL OR n.created_at < ?)
          AND s.deleted_at IS NULL
        ORDER BY CASE n.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, n.created_at DESC
        LIMIT ?
      `).bind(membershipId, membershipId, history ? 1 : 0, now, now, cursor, cursor, limit + 1).all<NotificationRow>()
    : await env.DB.prepare(`
        SELECT n.*
        FROM guardian_notifications n
        WHERE n.scope = 'global'
          AND (? = 1 OR ((n.starts_at IS NULL OR n.starts_at <= ?) AND (n.expires_at IS NULL OR n.expires_at > ?)))
          AND (? IS NULL OR n.created_at < ?)
        ORDER BY CASE n.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, n.created_at DESC
        LIMIT ?
      `).bind(history ? 1 : 0, now, now, cursor, cursor, limit + 1).all<NotificationRow>();
  const stored = (rows.results || []).slice(0, limit).map(notificationFromRow);
  const generated = history || cursor ? [] : await generatedWorldNotifications(env);
  const missingGenerated = generated.filter((entry) => !stored.some((storedEntry) => storedEntry.id === entry.id));
  if (missingGenerated.length) await materializeGeneratedNotifications(env, missingGenerated);
  const notifications = deduplicateNotifications([...stored, ...generated]);
  const preferences = membershipId ? await readNotificationPreferences(env, membershipId) : DEFAULT_NOTIFICATION_PREFERENCES;
  return {
    notifications,
    unreadCount: notifications.filter((entry) => !entry.readAt && !entry.dismissedAt && entry.status === "active").length,
    ...((rows.results || []).length > limit ? { nextCursor: String((rows.results || [])[limit - 1]?.created_at || "") } : {}),
    preferences
  };
}

export async function updateNotificationState(request: Request, session: { token: string; row: SessionRow }, env: Env): Promise<{ updated: true }> {
  await requireCsrf(request, session.token, env);
  const input = stateSchema.parse(await request.json()) as UpdateNotificationStateRequest;
  const notification = await env.DB.prepare(`
    SELECT id FROM guardian_notifications
    WHERE id = ? AND (scope = 'global' OR account_membership_id = ?)
  `).bind(input.notificationId, session.row.membership_id).first<{ id: string }>();
  if (!notification) throw httpError(404, "notification_not_found", "That notification is no longer available.");
  const now = new Date().toISOString();
  const fields = {
    read: ["read_at", now],
    unread: ["read_at", null],
    dismiss: ["dismissed_at", now],
    archive: ["archived_at", now],
    delete: ["deleted_at", now]
  } as const;
  const [column, value] = fields[input.action];
  await env.DB.prepare(`
    INSERT INTO notification_user_state (membership_id, notification_id, ${column}, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(membership_id, notification_id) DO UPDATE SET ${column} = excluded.${column}, updated_at = excluded.updated_at
  `).bind(session.row.membership_id, input.notificationId, value, now).run();
  return { updated: true };
}

export async function updateNotificationPreferences(request: Request, session: { token: string; row: SessionRow }, env: Env): Promise<NotificationPreferences> {
  await requireCsrf(request, session.token, env);
  const input = preferencesSchema.parse(await request.json()) as UpdateNotificationPreferencesRequest;
  const preferences = normalizePreferences(input.preferences);
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO notification_preferences (membership_id, preferences_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(membership_id) DO UPDATE SET preferences_json = excluded.preferences_json, updated_at = excluded.updated_at
  `).bind(session.row.membership_id, JSON.stringify(preferences), now).run();
  return preferences;
}

export async function saveManualNotification(request: Request, actor: SessionRow, env: Env): Promise<GuardianNotification> {
  requireNotificationAdmin(actor, env);
  const input = manualNotificationSchema.parse(await request.json());
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO guardian_notifications (
      id, event_key, type, category, scope, priority, title, subtitle, description, icon, image_url,
      destination_url, external_url, created_at, updated_at, starts_at, expires_at, dismissible,
      auto_dismiss, auto_dismiss_ms, source, source_label, source_confidence, created_by_membership_id,
      modified_by_membership_id
    ) VALUES (?, ?, ?, ?, 'global', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET event_key = excluded.event_key, type = excluded.type,
      category = excluded.category, priority = excluded.priority, title = excluded.title,
      subtitle = excluded.subtitle, description = excluded.description, icon = excluded.icon,
      image_url = excluded.image_url, destination_url = excluded.destination_url,
      external_url = excluded.external_url, updated_at = excluded.updated_at, starts_at = excluded.starts_at,
      expires_at = excluded.expires_at, dismissible = excluded.dismissible,
      auto_dismiss = excluded.auto_dismiss, auto_dismiss_ms = excluded.auto_dismiss_ms,
      source_label = excluded.source_label, source_confidence = excluded.source_confidence,
      modified_by_membership_id = excluded.modified_by_membership_id
  `).bind(
    input.id, input.eventKey || null, input.type, input.category, input.priority, input.title,
    input.subtitle || null, input.description || null, input.icon || null, input.imageUrl || null,
    input.destinationUrl || null, input.externalUrl || null, now, now, input.startsAt || null,
    input.expiresAt || null, input.dismissible ? 1 : 0, input.autoDismiss ? 1 : 0,
    input.autoDismissMs || null, input.sourceLabel, input.sourceConfidence,
    actor.membership_id, actor.membership_id
  ).run();
  return {
    id: input.id,
    eventKey: input.eventKey,
    type: input.type,
    category: input.category,
    scope: "global",
    priority: input.priority,
    status: "active",
    title: input.title,
    subtitle: input.subtitle,
    description: input.description,
    icon: input.icon,
    imageUrl: input.imageUrl,
    destinationUrl: input.destinationUrl,
    externalUrl: input.externalUrl,
    createdAt: now,
    updatedAt: now,
    startsAt: input.startsAt,
    expiresAt: input.expiresAt,
    dismissible: input.dismissible,
    autoDismiss: input.autoDismiss,
    autoDismissMs: input.autoDismissMs,
    source: "manual",
    sourceLabel: input.sourceLabel,
    sourceConfidence: input.sourceConfidence
  };
}

export async function recordDistortionObservation(request: Request, actor: SessionRow, env: Env): Promise<DistortionObservation> {
  requireNotificationAdmin(actor, env);
  const input = distortionObservationSchema.parse(await request.json());
  const now = new Date().toISOString();
  const current = await env.DB.prepare(`
    SELECT * FROM distortion_observations WHERE observed_end_at IS NULL ORDER BY observed_start_at DESC LIMIT 1
  `).first<Record<string, unknown>>();
  if (current && String(current.destination) === input.destination) {
    await env.DB.prepare("UPDATE distortion_observations SET last_confirmed_at = ?, confidence = ? WHERE id = ?")
      .bind(now, input.confidence, String(current.id)).run();
    return distortionFromRow({ ...current, last_confirmed_at: now, confidence: input.confidence });
  }
  if (current) {
    await env.DB.prepare("UPDATE distortion_observations SET observed_end_at = ?, complete = 1 WHERE id = ?")
      .bind(input.observedStartAt, String(current.id)).run();
  }
  const id = `distortion:${input.observedStartAt}:${slug(input.destination)}`;
  await env.DB.prepare(`
    INSERT INTO distortion_observations (
      id, destination, destination_icon, destination_image, observed_start_at, observed_end_at,
      first_detected_at, last_confirmed_at, source, confidence, complete
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, input.destination, input.destinationIcon || null, input.destinationImage || null,
    input.observedStartAt, input.observedEndAt || null, now, now, input.source, input.confidence,
    input.observedEndAt ? 1 : 0
  ).run();
  await upsertDistortionNotification(env, id, input.destination, input.observedStartAt);
  return {
    id,
    destination: input.destination,
    destinationIcon: input.destinationIcon,
    destinationImage: input.destinationImage,
    observedStartAt: input.observedStartAt,
    observedEndAt: input.observedEndAt,
    firstDetectedAt: now,
    lastConfirmedAt: now,
    source: input.source,
    confidence: input.confidence,
    complete: Boolean(input.observedEndAt)
  };
}

export async function readDistortions(env: Env, range = "7d"): Promise<DistortionData> {
  const days = range === "24h" ? 1 : range === "30d" ? 30 : range === "all" ? 3650 : 7;
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const result = await env.DB.prepare(`
    SELECT * FROM distortion_observations WHERE observed_start_at >= ? ORDER BY observed_start_at DESC LIMIT 1000
  `).bind(cutoff).all<Record<string, unknown>>();
  const history = (result.results || []).map(distortionFromRow);
  const latest = history[0];
  const age = latest ? Date.now() - Date.parse(latest.lastConfirmedAt) : Number.POSITIVE_INFINITY;
  const current = latest && !latest.observedEndAt && age <= 75 * 60_000 ? latest : undefined;
  const provider = await env.DB.prepare("SELECT * FROM world_provider_status WHERE provider_key = 'distortion'").first<Record<string, unknown>>();
  return {
    state: current ? (current.source === "manual" ? "manually-reported" : age > 20 * 60_000 ? "stale" : "live") : "unavailable",
    current,
    nextHourlyChangeAt: nextUtcHour(),
    history,
    statistics: calculateDistortionStatistics(history),
    prediction: calculateDistortionPrediction(history),
    sourceLabel: current?.source || "No verified provider",
    sourceConfidence: current?.confidence || "unavailable",
    lastSuccessfulUpdateAt: typeof provider?.last_success_at === "string" ? provider.last_success_at : current?.lastConfirmedAt
  };
}

export async function readWhatsHappening(env: Env, membershipId?: string): Promise<WhatsHappeningData> {
  const now = new Date();
  const distortion = await readDistortions(env, "24h");
  const xur = await readLatestXurShipment(env);
  const cards: HappeningCard[] = [];
  if (distortion.current) {
    cards.push({
      id: "distortion-current",
      section: "live",
      category: "distortion",
      priority: "high",
      state: distortion.state === "stale" ? "stale" : "live",
      title: `${distortion.current.destination} is distorted`,
      status: `Changes at ${new Date(distortion.nextHourlyChangeAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })} UTC`,
      description: "Enemies are empowered and destination rewards may be affected.",
      destinationUrl: "/distortions",
      sourceLabel: distortion.sourceLabel,
      sourceConfidence: distortion.sourceConfidence,
      observedAt: distortion.current.lastConfirmedAt
    });
  } else {
    cards.push({
      id: "distortion-unavailable",
      section: "live",
      category: "distortion",
      priority: "normal",
      state: "unavailable",
      title: "Distortion location unavailable",
      status: "Awaiting a verified observation",
      destinationUrl: "/distortions",
      sourceLabel: "Guardian Nexus",
      sourceConfidence: "unavailable",
      observedAt: distortion.lastSuccessfulUpdateAt
    });
  }
  if (xur) {
    cards.push({
      id: "xur-shipment",
      section: "vendors",
      category: "exotic",
      priority: "normal",
      state: "stale",
      title: "Xûr’s latest shipment",
      status: `${xur.offers.length} tracked offers`,
      description: "The last successfully captured inventory remains available between visits.",
      destinationUrl: "/xur",
      sourceLabel: "Bungie vendor API",
      sourceConfidence: "live-api",
      observedAt: xur.capturedAt
    });
  }
  cards.push(
    resetCard("daily-reset", "daily", "Daily reset", nextDailyReset(now), "/whats-happening"),
    resetCard("weekly-reset", "weekly", "Weekly reset", nextWeeklyReset(now), "/whats-happening")
  );
  if (membershipId) {
    const accountResult = await env.DB.prepare(`
      SELECT * FROM guardian_notifications
      WHERE scope = 'account' AND account_membership_id = ?
        AND (starts_at IS NULL OR starts_at <= ?) AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY created_at DESC LIMIT 8
    `).bind(membershipId, now.toISOString(), now.toISOString()).all<NotificationRow>();
    cards.push(...(accountResult.results || []).map((row) => {
      const notification = notificationFromRow(row);
      return {
        id: `personal:${notification.id}`,
        section: "personal" as const,
        category: notification.category,
        priority: notification.priority,
        state: "live" as const,
        title: notification.title,
        status: notification.subtitle || "Account update",
        description: notification.description,
        destinationUrl: notification.destinationUrl,
        externalUrl: notification.externalUrl,
        sourceLabel: notification.sourceLabel || "Guardian Nexus",
        sourceConfidence: notification.sourceConfidence || "observed",
        observedAt: notification.updatedAt || notification.createdAt
      };
    }));
  }
  return {
    cards: cards.sort((a, b) => relevance(a) - relevance(b)),
    generatedAt: now.toISOString(),
    nextDailyResetAt: nextDailyReset(now).toISOString(),
    nextWeeklyResetAt: nextWeeklyReset(now).toISOString()
  };
}

export async function maintainNotificationStorage(env: Env): Promise<void> {
  const now = new Date().toISOString();
  const retention = new Date(Date.now() - 180 * 86_400_000).toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM notification_user_state WHERE updated_at < ?").bind(retention),
    env.DB.prepare("DELETE FROM guardian_notifications WHERE expires_at IS NOT NULL AND expires_at < ? AND created_at < ?").bind(now, retention),
    env.DB.prepare(`
      INSERT INTO world_provider_status (provider_key, state, last_attempt_at, error_code, error_message)
      VALUES ('distortion', 'unavailable', ?, 'provider_unverified', 'No verified first-party active-destination provider is configured.')
      ON CONFLICT(provider_key) DO UPDATE SET state = excluded.state, last_attempt_at = excluded.last_attempt_at,
        error_code = excluded.error_code, error_message = excluded.error_message
    `).bind(now)
  ]);
}

async function readNotificationPreferences(env: Env, membershipId: string): Promise<NotificationPreferences> {
  const row = await env.DB.prepare("SELECT preferences_json FROM notification_preferences WHERE membership_id = ?")
    .bind(membershipId).first<{ preferences_json: string }>();
  if (!row) return DEFAULT_NOTIFICATION_PREFERENCES;
  try { return normalizePreferences(JSON.parse(row.preferences_json)); } catch { return DEFAULT_NOTIFICATION_PREFERENCES; }
}

function normalizePreferences(value: Partial<NotificationPreferences> | undefined): NotificationPreferences {
  const enabled = Array.isArray(value?.enabledCategories)
    ? [...new Set(value.enabledCategories.filter((entry): entry is NotificationCategory => ALL_CATEGORIES.includes(entry as NotificationCategory)))]
    : ALL_CATEGORIES;
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...value,
    enabledCategories: enabled,
    autoDismissMs: Math.min(60_000, Math.max(4_000, Number(value?.autoDismissMs || DEFAULT_NOTIFICATION_PREFERENCES.autoDismissMs))),
    sound: false
  };
}

async function generatedWorldNotifications(env: Env): Promise<GuardianNotification[]> {
  const now = new Date();
  const generated: GuardianNotification[] = [
    notificationForReset("daily", nextDailyReset(now)),
    notificationForReset("weekly", nextWeeklyReset(now))
  ];
  const xur = await readLatestXurShipment(env);
  if (xur) {
    generated.push({
      id: `xur-shipment:${xur.capturedAt}`,
      eventKey: "xur-shipment",
      type: "xur-shipment",
      category: "exotic",
      scope: "global",
      priority: "normal",
      status: "active",
      title: "Xûr shipment available",
      subtitle: `${xur.offers.length} offers in the latest captured inventory`,
      destinationUrl: "/xur",
      createdAt: xur.capturedAt,
      expiresAt: xur.nextRefreshAt,
      dismissible: true,
      autoDismiss: true,
      source: "bungie-vendor-api",
      sourceLabel: "Bungie vendor API",
      sourceConfidence: "live-api"
    });
  }
  const distortion = await readDistortions(env, "24h");
  if (distortion.current) {
    generated.push({
      id: `distortion-active:${distortion.current.id}`,
      eventKey: "distortion-active",
      type: "distortion-active",
      category: "distortion",
      scope: "global",
      priority: "high",
      status: "active",
      title: `${distortion.current.destination} is distorted`,
      subtitle: "The active destination changes on the hour",
      destinationUrl: "/distortions",
      createdAt: distortion.current.firstDetectedAt,
      expiresAt: distortion.current.observedEndAt || distortion.nextHourlyChangeAt,
      dismissible: true,
      autoDismiss: false,
      source: distortion.current.source,
      sourceLabel: distortion.sourceLabel,
      sourceConfidence: distortion.sourceConfidence
    });
  }
  return generated;
}

async function materializeGeneratedNotifications(env: Env, notifications: GuardianNotification[]): Promise<void> {
  await env.DB.batch(notifications.map((entry) => env.DB.prepare(`
    INSERT INTO guardian_notifications (
      id, event_key, type, category, scope, priority, title, subtitle, description, icon, image_url,
      badge, destination_url, external_url, created_at, updated_at, starts_at, expires_at,
      dismissible, auto_dismiss, auto_dismiss_ms, repeatable, source, source_label,
      source_confidence, metadata_json
    ) VALUES (?, ?, ?, ?, 'global', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, title = excluded.title,
      subtitle = excluded.subtitle, expires_at = excluded.expires_at, metadata_json = excluded.metadata_json
  `).bind(
    entry.id, entry.eventKey || null, entry.type, entry.category, entry.priority, entry.title,
    entry.subtitle || null, entry.description || null, entry.icon || null, entry.imageUrl || null,
    entry.badge || null, entry.destinationUrl || null, entry.externalUrl || null, entry.createdAt,
    entry.updatedAt || entry.createdAt, entry.startsAt || null, entry.expiresAt || null,
    entry.dismissible ? 1 : 0, entry.autoDismiss ? 1 : 0, entry.autoDismissMs || null,
    entry.repeatable ? 1 : 0, entry.source || null, entry.sourceLabel || null,
    entry.sourceConfidence || null, entry.metadata ? JSON.stringify(entry.metadata) : null
  )));
}

function notificationFromRow(row: NotificationRow): GuardianNotification {
  const now = Date.now();
  const expiresAt = text(row.expires_at);
  const startsAt = text(row.starts_at);
  const readAt = text(row.read_at);
  const dismissedAt = text(row.dismissed_at);
  const archivedAt = text(row.archived_at);
  let metadata: Record<string, unknown> | undefined;
  try { metadata = row.metadata_json ? JSON.parse(String(row.metadata_json)) : undefined; } catch { metadata = undefined; }
  return {
    id: String(row.id),
    eventKey: text(row.event_key),
    type: String(row.type),
    category: String(row.category) as NotificationCategory,
    scope: String(row.scope) as "global" | "account",
    priority: String(row.priority) as NotificationPriority,
    status: dismissedAt ? "dismissed" : archivedAt ? "archived" : expiresAt && Date.parse(expiresAt) <= now ? "expired" : readAt ? "read" : "active",
    title: String(row.title),
    subtitle: text(row.subtitle),
    description: text(row.description),
    icon: text(row.icon),
    imageUrl: text(row.image_url),
    badge: text(row.badge),
    destinationUrl: text(row.destination_url),
    externalUrl: text(row.external_url),
    createdAt: String(row.created_at),
    updatedAt: text(row.updated_at),
    startsAt,
    expiresAt,
    dismissible: Boolean(row.dismissible),
    autoDismiss: Boolean(row.auto_dismiss),
    autoDismissMs: number(row.auto_dismiss_ms),
    repeatable: Boolean(row.repeatable),
    source: text(row.source),
    sourceLabel: text(row.source_label),
    sourceConfidence: text(row.source_confidence) as NotificationSourceConfidence | undefined,
    readAt,
    dismissedAt,
    metadata
  };
}

function distortionFromRow(row: Record<string, unknown>): DistortionObservation {
  return {
    id: String(row.id),
    destination: String(row.destination),
    destinationIcon: text(row.destination_icon),
    destinationImage: text(row.destination_image),
    observedStartAt: String(row.observed_start_at),
    observedEndAt: text(row.observed_end_at),
    firstDetectedAt: String(row.first_detected_at),
    lastConfirmedAt: String(row.last_confirmed_at),
    source: String(row.source),
    confidence: String(row.confidence) as NotificationSourceConfidence,
    complete: Boolean(row.complete)
  };
}

export function calculateDistortionStatistics(history: DistortionObservation[]): DistortionData["statistics"] {
  const counts = new Map<string, { count: number; lastSeenAt: string }>();
  let repeats = 0;
  const intervals: number[] = [];
  [...history].reverse().forEach((entry, index, ordered) => {
    const current = counts.get(entry.destination);
    counts.set(entry.destination, {
      count: (current?.count || 0) + 1,
      lastSeenAt: !current || Date.parse(entry.observedStartAt) > Date.parse(current.lastSeenAt) ? entry.observedStartAt : current.lastSeenAt
    });
    const previous = ordered[index - 1];
    if (previous) {
      const minutes = Math.round((Date.parse(entry.observedStartAt) - Date.parse(previous.observedStartAt)) / 60_000);
      if (minutes > 0) intervals.push(minutes);
      if (previous.destination === entry.destination) repeats += 1;
    }
  });
  const destinationCounts = [...counts.entries()].map(([destination, value]) => ({
    destination,
    count: value.count,
    percentage: history.length ? Math.round(value.count / history.length * 1000) / 10 : 0,
    lastSeenAt: value.lastSeenAt
  })).sort((a, b) => b.count - a.count || a.destination.localeCompare(b.destination));
  return {
    observations: history.length,
    destinationCounts,
    mostCommonDestination: destinationCounts[0]?.destination,
    leastCommonDestination: destinationCounts.at(-1)?.destination,
    averageIntervalMinutes: intervals.length ? Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length) : undefined,
    shortestIntervalMinutes: intervals.length ? Math.min(...intervals) : undefined,
    longestIntervalMinutes: intervals.length ? Math.max(...intervals) : undefined,
    consecutiveRepeats: repeats
  };
}

export function calculateDistortionPrediction(history: DistortionObservation[]): DistortionData["prediction"] {
  const calculatedAt = new Date().toISOString();
  if (history.length < 48) return {
    state: "insufficient-data",
    sampleSize: history.length,
    calculatedAt,
    explanation: "Guardian Nexus is collecting observed Distortion history to determine whether a reliable rotation or pattern exists."
  };
  return {
    state: "no-reliable-pattern",
    sampleSize: history.length,
    calculatedAt,
    explanation: "Enough observations exist for analysis, but no prediction is shown until a pattern also passes the accuracy threshold."
  };
}

function notificationForReset(kind: "daily" | "weekly", at: Date): GuardianNotification {
  return {
    id: `${kind}-reset:${at.toISOString()}`,
    eventKey: `${kind}-reset`,
    type: `${kind}-reset`,
    category: "system",
    scope: "global",
    priority: "low",
    status: "active",
    title: `${kind === "daily" ? "Daily" : "Weekly"} reset upcoming`,
    subtitle: at.toISOString(),
    destinationUrl: "/whats-happening",
    createdAt: new Date(at.getTime() - (kind === "daily" ? 24 : 7 * 24) * 60 * 60_000).toISOString(),
    expiresAt: at.toISOString(),
    dismissible: true,
    autoDismiss: true,
    source: "calendar",
    sourceLabel: "Destiny reset schedule",
    sourceConfidence: "confirmed",
    metadata: { countdownAt: at.toISOString() }
  };
}

function resetCard(id: string, section: "daily" | "weekly", title: string, at: Date, destinationUrl: string): HappeningCard {
  return {
    id,
    section,
    category: "system",
    priority: "normal",
    state: "upcoming",
    title,
    status: at.toISOString(),
    endsAt: at.toISOString(),
    destinationUrl,
    sourceLabel: "Destiny reset schedule",
    sourceConfidence: "confirmed"
  };
}

function nextDailyReset(now = new Date()): Date {
  const value = new Date(now);
  value.setUTCHours(17, 0, 0, 0);
  if (value <= now) value.setUTCDate(value.getUTCDate() + 1);
  return value;
}

function nextWeeklyReset(now = new Date()): Date {
  const value = nextDailyReset(now);
  const daysUntilTuesday = (2 - value.getUTCDay() + 7) % 7;
  value.setUTCDate(value.getUTCDate() + daysUntilTuesday);
  return value;
}

function nextUtcHour(): string {
  const value = new Date();
  value.setUTCMinutes(0, 0, 0);
  value.setUTCHours(value.getUTCHours() + 1);
  return value.toISOString();
}

async function upsertDistortionNotification(env: Env, observationId: string, destination: string, startsAt: string): Promise<void> {
  const id = `distortion-active:${observationId}`;
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO guardian_notifications (
      id, event_key, type, category, scope, priority, title, subtitle, destination_url,
      created_at, updated_at, starts_at, dismissible, auto_dismiss, source, source_label, source_confidence
    ) VALUES (?, 'distortion-active', 'distortion-active', 'distortion', 'global', 'high', ?, ?, '/distortions', ?, ?, ?, 1, 0, 'observation', 'Guardian Nexus observation', 'observed')
    ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, title = excluded.title
  `).bind(id, `${destination} is distorted`, "The active destination changes on the hour.", now, now, startsAt).run();
}

function requireNotificationAdmin(actor: SessionRow, env: Env): void {
  if (!allowlist(env.REPORT_ADMIN_MEMBERSHIP_IDS).has(actor.membership_id)) {
    throw httpError(403, "notification_admin_forbidden", "Notification administration is restricted.");
  }
}

function deduplicateNotifications(entries: GuardianNotification[]): GuardianNotification[] {
  const byId = new Map<string, GuardianNotification>();
  entries.forEach((entry) => { if (!byId.has(entry.id)) byId.set(entry.id, entry); });
  const priority: Record<NotificationPriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };
  return [...byId.values()].sort((a, b) => priority[a.priority] - priority[b.priority] || Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function relevance(card: HappeningCard): number {
  const priority = { critical: 0, high: 10, normal: 20, low: 30 }[card.priority];
  const state = { "ending-soon": 0, live: 1, upcoming: 2, stale: 3, unavailable: 4, inactive: 5 }[card.state];
  return priority + state;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function number(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
