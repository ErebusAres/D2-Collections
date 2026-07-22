import type {
  ApiEnvelope,
  CreateReportRequest,
  GuardianReport,
  ReportCategory,
  ReportClientContext,
  ReportListData,
  ReportPriority,
  ReportStatus,
  UpdateReportRequest
} from "@guardian-nexus/contracts";
import { z } from "zod";
import { allowlist, httpError, requireCsrf } from "./security";
import type { Env, RequestContext, SessionRow } from "./types";

const categories = ["bug", "suggestion", "feedback", "data", "performance", "accessibility", "account", "other"] as const;
const statuses = ["open", "in_progress", "completed", "dismissed"] as const;
const priorities = ["low", "normal", "high", "urgent"] as const;
const optionalDetail = z.string().trim().max(5_000).optional();

export const createReportSchema = z.object({
  category: z.enum(categories),
  title: z.string().trim().min(4).max(140),
  description: z.string().trim().min(10).max(8_000),
  reproductionSteps: optionalDetail,
  expectedResult: optionalDetail,
  actualResult: optionalDetail,
  pageUrl: z.string().trim().max(500).optional(),
  clientContext: z.object({
    userAgent: z.string().trim().max(500).optional(),
    viewport: z.string().trim().max(80).optional(),
    appPath: z.string().trim().max(500).optional()
  }).strict().optional()
}).strict();

export const updateReportSchema = z.object({
  expectedVersion: z.number().int().positive(),
  status: z.enum(statuses).optional(),
  priority: z.enum(priorities).optional(),
  assignment: z.enum(["claim", "release"]).optional(),
  adminNotes: z.string().trim().max(5_000).optional(),
  resolution: z.string().trim().max(5_000).optional()
}).strict().refine((value) => Object.keys(value).some((key) => key !== "expectedVersion"), "Choose at least one report change.");

interface ReportRow {
  id: number;
  reporter_membership_id: string;
  reporter_display_name: string;
  category: ReportCategory;
  title: string;
  description: string;
  reproduction_steps: string;
  expected_result: string;
  actual_result: string;
  page_url: string;
  client_context_json: string;
  status: ReportStatus;
  priority: ReportPriority;
  assigned_to_membership_id: string | null;
  assigned_to_display_name: string | null;
  admin_notes: string;
  resolution: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  version: number;
}

interface AuthenticatedSession {
  token: string;
  row: SessionRow;
}

export async function reportsRoute(request: Request, env: Env, context: RequestContext, session: AuthenticatedSession): Promise<Response | undefined> {
  const path = context.url.pathname.replace(/\/$/, "");
  if (path === "/api/v1/me/reports" && request.method === "GET") return listOwnReports(session.row, env, context);
  if (path === "/api/v1/me/reports" && request.method === "POST") {
    await requireCsrf(request, session.token, env);
    return createReport(request, session.row, env, context);
  }
  if (path === "/api/v1/admin/reports" && request.method === "GET") {
    requireReportAdmin(session.row, env);
    return listAdminReports(env, context);
  }
  const reportId = path.match(/^\/api\/v1\/admin\/reports\/(\d+)$/)?.[1];
  if (reportId && request.method === "PATCH") {
    requireReportAdmin(session.row, env);
    await requireCsrf(request, session.token, env);
    return updateReport(Number(reportId), request, session.row, env, context);
  }
  return undefined;
}

export function isReportAdmin(membershipId: string, env: Pick<Env, "REPORT_ADMIN_MEMBERSHIP_IDS">): boolean {
  return allowlist(env.REPORT_ADMIN_MEMBERSHIP_IDS).has(membershipId);
}

function requireReportAdmin(row: SessionRow, env: Env): void {
  if (!isReportAdmin(row.membership_id, env)) throw httpError(403, "report_admin_forbidden", "Report management is restricted to approved Guardian Nexus maintainers.");
}

async function listOwnReports(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const { results = [] } = await env.DB.prepare("SELECT * FROM reports WHERE reporter_membership_id = ? ORDER BY created_at DESC LIMIT 100").bind(row.membership_id).all<ReportRow>();
  return reportEnvelope<ReportListData>({ reports: results.map((report) => publicReport(report, false)), canManage: isReportAdmin(row.membership_id, env) }, env, context);
}

async function createReport(request: Request, row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const input = parseCreateReport(await request.json().catch(() => undefined));
  const recent = await env.DB.prepare("SELECT COUNT(*) AS count FROM reports WHERE reporter_membership_id = ? AND created_at >= datetime('now', '-1 hour')").bind(row.membership_id).first<{ count: number }>();
  if (Number(recent?.count || 0) >= 20) throw httpError(429, "report_rate_limited", "You have submitted several reports recently. Please wait before sending another.");
  const now = new Date().toISOString();
  const clientContext: ReportClientContext = {
    ...input.clientContext,
    userAgent: input.clientContext?.userAgent || request.headers.get("User-Agent")?.slice(0, 500) || undefined
  };
  const result = await env.DB.prepare(`
    INSERT INTO reports (
      reporter_membership_id, reporter_display_name, category, title, description,
      reproduction_steps, expected_result, actual_result, page_url, client_context_json,
      status, priority, created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 'normal', ?, ?, 1)
  `).bind(
    row.membership_id,
    row.bungie_name || row.display_name,
    input.category,
    input.title,
    input.description,
    input.reproductionSteps || "",
    input.expectedResult || "",
    input.actualResult || "",
    input.pageUrl || "",
    JSON.stringify(clientContext),
    now,
    now
  ).run();
  const id = Number(result.meta.last_row_id);
  const created = await findReport(id, env);
  if (!created) throw httpError(500, "report_create_failed", "The report was saved but could not be reloaded.");
  return reportEnvelope(publicReport(created, false), env, context, 201);
}

async function listAdminReports(env: Env, context: RequestContext): Promise<Response> {
  const status = readEnum(context.url.searchParams.get("status"), statuses);
  const category = readEnum(context.url.searchParams.get("category"), categories);
  const priority = readEnum(context.url.searchParams.get("priority"), priorities);
  const search = (context.url.searchParams.get("search") || "").trim().slice(0, 120).toLocaleLowerCase();
  const clauses: string[] = [];
  const bindings: unknown[] = [];
  if (status) { clauses.push("status = ?"); bindings.push(status); }
  if (category) { clauses.push("category = ?"); bindings.push(category); }
  if (priority) { clauses.push("priority = ?"); bindings.push(priority); }
  if (search) {
    clauses.push("(LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(reporter_display_name) LIKE ? OR CAST(id AS TEXT) = ?)");
    bindings.push(`%${search}%`, `%${search}%`, `%${search}%`, search.replace(/^gn-?0*/, ""));
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const reportsQuery = env.DB.prepare(`
    SELECT * FROM reports ${where}
    ORDER BY
      CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END,
      CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
      updated_at DESC
    LIMIT 250
  `).bind(...bindings);
  const [reportsResult, countsResult] = await Promise.all([
    reportsQuery.all<ReportRow>(),
    env.DB.prepare("SELECT status, COUNT(*) AS count FROM reports GROUP BY status").all<{ status: ReportStatus; count: number }>()
  ]);
  const counts: Record<ReportStatus, number> = { open: 0, in_progress: 0, completed: 0, dismissed: 0 };
  for (const row of countsResult.results || []) counts[row.status] = Number(row.count || 0);
  return reportEnvelope<ReportListData>({ reports: (reportsResult.results || []).map((report) => publicReport(report, true)), canManage: true, counts }, env, context);
}

async function updateReport(id: number, request: Request, admin: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const input = parseUpdateReport(await request.json().catch(() => undefined));
  const current = await findReport(id, env);
  if (!current) throw httpError(404, "report_not_found", "This report no longer exists.");
  if (current.version !== input.expectedVersion) throw httpError(409, "report_update_conflict", "Another administrator updated this report. The newest version has been loaded; review it before trying again.");
  if (current.assigned_to_membership_id && current.assigned_to_membership_id !== admin.membership_id) {
    throw httpError(409, "report_already_claimed", `${current.assigned_to_display_name || "Another administrator"} already claimed this report.`);
  }

  const now = new Date().toISOString();
  let status = input.status || current.status;
  let assignedMembershipId = current.assigned_to_membership_id;
  let assignedDisplayName = current.assigned_to_display_name;
  if (input.assignment === "claim") {
    assignedMembershipId = admin.membership_id;
    assignedDisplayName = admin.bungie_name || admin.display_name;
    if (status === "open") status = "in_progress";
  } else if (input.assignment === "release") {
    assignedMembershipId = null;
    assignedDisplayName = null;
    if (status === "in_progress") status = "open";
  }
  if (status === "in_progress" && !assignedMembershipId) {
    assignedMembershipId = admin.membership_id;
    assignedDisplayName = admin.bungie_name || admin.display_name;
  }
  if (status === "open") {
    assignedMembershipId = null;
    assignedDisplayName = null;
  }
  const resolution = input.resolution ?? current.resolution;
  const resolved = status === "completed" || status === "dismissed";
  if (resolved && resolution.trim().length < 3) throw httpError(400, "report_resolution_required", "Add a short resolution before completing or dismissing a report.");
  if (resolved && !assignedMembershipId) {
    assignedMembershipId = admin.membership_id;
    assignedDisplayName = admin.bungie_name || admin.display_name;
  }
  const result = await env.DB.prepare(`
    UPDATE reports SET
      status = ?, priority = ?, assigned_to_membership_id = ?, assigned_to_display_name = ?,
      admin_notes = ?, resolution = ?, updated_at = ?, resolved_at = ?, version = version + 1
    WHERE id = ? AND version = ?
  `).bind(
    status,
    input.priority || current.priority,
    assignedMembershipId,
    assignedDisplayName,
    input.adminNotes ?? current.admin_notes,
    resolution,
    now,
    resolved ? current.resolved_at || now : null,
    id,
    input.expectedVersion
  ).run();
  if (Number(result.meta.changes || 0) !== 1) throw httpError(409, "report_update_conflict", "Another administrator updated this report. Reload the queue before trying again.");
  const updated = await findReport(id, env);
  if (!updated) throw httpError(500, "report_reload_failed", "The report was updated but could not be reloaded.");
  return reportEnvelope(publicReport(updated, true), env, context);
}

async function findReport(id: number, env: Env): Promise<ReportRow | null> {
  return env.DB.prepare("SELECT * FROM reports WHERE id = ?").bind(id).first<ReportRow>();
}

function parseCreateReport(value: unknown): CreateReportRequest {
  const result = createReportSchema.safeParse(value);
  if (result.success) return result.data;
  throw validationError(result.error.issues[0]?.message);
}

function parseUpdateReport(value: unknown): UpdateReportRequest {
  const result = updateReportSchema.safeParse(value);
  if (result.success) return result.data;
  throw validationError(result.error.issues[0]?.message);
}

function validationError(message?: string): Error {
  return httpError(400, "report_validation_failed", `The report could not be saved. ${message || "Review the required fields."}`);
}

function publicReport(row: ReportRow, admin: boolean): GuardianReport {
  let clientContext: ReportClientContext | undefined;
  try { clientContext = JSON.parse(row.client_context_json || "{}"); } catch { clientContext = undefined; }
  return {
    id: Number(row.id),
    reference: `GN-${String(row.id).padStart(5, "0")}`,
    ...(admin ? { reporterMembershipId: row.reporter_membership_id } : {}),
    reporterDisplayName: row.reporter_display_name,
    category: row.category,
    title: row.title,
    description: row.description,
    ...(row.reproduction_steps ? { reproductionSteps: row.reproduction_steps } : {}),
    ...(row.expected_result ? { expectedResult: row.expected_result } : {}),
    ...(row.actual_result ? { actualResult: row.actual_result } : {}),
    ...(row.page_url ? { pageUrl: row.page_url } : {}),
    ...(clientContext && Object.keys(clientContext).length ? { clientContext } : {}),
    status: row.status,
    priority: row.priority,
    ...(admin && row.assigned_to_membership_id ? { assignedToMembershipId: row.assigned_to_membership_id } : {}),
    ...(row.assigned_to_display_name ? { assignedToDisplayName: row.assigned_to_display_name } : {}),
    ...(admin && row.admin_notes ? { adminNotes: row.admin_notes } : {}),
    ...(row.resolution ? { resolution: row.resolution } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.resolved_at ? { resolvedAt: row.resolved_at } : {}),
    version: Number(row.version)
  };
}

function readEnum<const Values extends readonly string[]>(value: string | null, values: Values): Values[number] | undefined {
  return value && values.includes(value) ? value as Values[number] : undefined;
}

function reportEnvelope<T>(data: T, env: Env, context: RequestContext, status = 200): Response {
  const observedAt = new Date().toISOString();
  const body: ApiEnvelope<T> = { data, freshness: { state: "fresh", observedAt, ageSeconds: 0 }, warnings: [], requestId: context.requestId };
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": context.origin === env.ALLOWED_ORIGIN ? context.origin : env.WEB_ORIGIN,
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin"
    }
  });
}
