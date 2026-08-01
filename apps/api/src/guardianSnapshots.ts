import type { ApiEnvelope, GuardianSnapshot, GuardianSnapshotDocument, GuardianSnapshotsData } from "@guardian-nexus/contracts";
import { z } from "zod";
import { httpError, requireCsrf, sessionFromRequest } from "./security";
import type { Env, RequestContext, SessionRow } from "./types";

export const guardianSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string().trim().min(1).max(100),
  summary: z.string().trim().max(300).optional(),
  visibility: z.enum(["private", "unlisted"]),
  guardian: z.object({ displayName: z.string().trim().max(100).optional(), className: z.string().trim().max(40).optional(), power: z.number().int().min(0).max(10_000).optional(), guardianRank: z.number().int().min(0).max(100).optional() }).strict().optional(),
  role: z.string().trim().max(60).optional(),
  selectedBuild: z.object({ title: z.string().trim().min(1).max(100), url: z.string().trim().url().max(500).refine((value) => /^https?:\/\//i.test(value), "Build links must use HTTP or HTTPS.").optional() }).strict().optional(),
  goals: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  note: z.string().trim().max(500).optional(),
  source: z.literal("player-curated")
}).strict();

interface SnapshotRow { slug: string; owner_membership_id: string; visibility: "private" | "unlisted"; document_json: string; created_at: string; updated_at: string }

export async function guardianSnapshotsRoute(request: Request, env: Env, context: RequestContext): Promise<Response | null> {
  const path = context.url.pathname.replace(/\/$/, "");
  if (!path.startsWith("/api/v1/snapshots")) return null;
  const session = await sessionFromRequest(request, env);
  if (path === "/api/v1/snapshots" && request.method === "GET") {
    if (!session) throw httpError(401, "authentication_required", "Sign in to manage Guardian snapshots.");
    const rows = await env.DB.prepare("SELECT slug, owner_membership_id, visibility, document_json, created_at, updated_at FROM guardian_snapshots WHERE owner_membership_id = ? ORDER BY updated_at DESC").bind(session.row.membership_id).all<SnapshotRow>();
    return response<GuardianSnapshotsData>({ snapshots: (rows.results || []).flatMap((row) => { const snapshot = safeSnapshot(row, session.row); return snapshot ? [snapshot] : []; }) }, env, context);
  }
  if (path === "/api/v1/snapshots" && request.method === "POST") {
    if (!session) throw httpError(401, "authentication_required", "Sign in to create a Guardian snapshot.");
    await requireCsrf(request, session.token, env);
    const parsed = guardianSnapshotSchema.safeParse(await request.json());
    if (!parsed.success) throw httpError(400, "snapshot_validation_failed", parsed.error.issues[0]?.message || "Review the snapshot fields.");
    return createSnapshot(parsed.data, session.row, env, context);
  }
  const match = path.match(/^\/api\/v1\/snapshots\/([a-z0-9-]+)$/i);
  if (!match) return null;
  const slug = match[1]!;
  const row = await env.DB.prepare("SELECT slug, owner_membership_id, visibility, document_json, created_at, updated_at FROM guardian_snapshots WHERE slug = ?").bind(slug).first<SnapshotRow>();
  if (!row) throw httpError(404, "snapshot_not_found", "This Guardian snapshot is unavailable.");
  const owner = session?.row.membership_id === row.owner_membership_id;
  if (request.method === "GET") {
    if (row.visibility !== "unlisted" && !owner) throw httpError(404, "snapshot_not_found", "This Guardian snapshot is unavailable.");
    const snapshot = safeSnapshot(row, session?.row);
    if (!snapshot) throw httpError(500, "snapshot_data_invalid", "This Guardian snapshot could not be read safely.");
    return response(snapshot, env, context);
  }
  if (request.method === "DELETE") {
    if (!session || !owner) throw httpError(404, "snapshot_not_found", "This Guardian snapshot is unavailable.");
    await requireCsrf(request, session.token, env);
    await env.DB.prepare("DELETE FROM guardian_snapshots WHERE slug = ? AND owner_membership_id = ?").bind(slug, session.row.membership_id).run();
    return response({ deleted: true }, env, context);
  }
  return null;
}

async function createSnapshot(document: GuardianSnapshotDocument, owner: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const now = new Date().toISOString();
  const slug = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO guardian_snapshots (id, slug, owner_membership_id, visibility, document_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), slug, owner.membership_id, document.visibility, JSON.stringify(document), now, now).run();
  return response<GuardianSnapshot>({ slug, document, createdAt: now, updatedAt: now, canEdit: true }, env, context);
}

function safeSnapshot(row: SnapshotRow, viewer?: SessionRow): GuardianSnapshot | undefined {
  try {
    const parsed = guardianSnapshotSchema.safeParse(JSON.parse(row.document_json));
    return parsed.success ? { slug: row.slug, document: parsed.data, createdAt: row.created_at, updatedAt: row.updated_at, canEdit: viewer?.membership_id === row.owner_membership_id } : undefined;
  } catch { return undefined; }
}

function response<T>(data: T, env: Env, context: RequestContext): Response {
  const observedAt = new Date().toISOString();
  const body: ApiEnvelope<T> = { data, freshness: { state: "fresh", observedAt, ageSeconds: 0 }, warnings: [], requestId: context.requestId };
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": context.origin === env.ALLOWED_ORIGIN ? context.origin : env.WEB_ORIGIN, "Access-Control-Allow-Credentials": "true", Vary: "Origin" } });
}
