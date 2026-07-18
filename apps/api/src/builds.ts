import type {
  ApiEnvelope,
  BuildCatalogData,
  BuildData,
  BuildDocument,
  BuildRating,
  BuildWorkingDraftData,
  BuildsData,
  BuildVoteResult,
  BuildVoteValue,
  GuardianBuild
} from "@guardian-nexus/contracts";
import { normalizeArmorSetSelections } from "@guardian-nexus/domain";
import { z } from "zod";
import { loadBuildCatalog } from "./buildCatalog";
import { allowlist, httpError, requireCsrf, sessionFromRequest } from "./security";
import type { Env, RequestContext, SessionRow } from "./types";

const optionalText = z.string().trim().max(5_000).optional();
const httpsUrl = z.string().trim().url().max(2_000).refine((value) => value.startsWith("https://"), "Build links must use HTTPS.");
const optionalUrl = httpsUrl.optional();
const namedEntryBaseSchema = z.object({
  name: z.string().trim().min(1).max(160),
  hash: z.string().trim().regex(/^\d+$/).optional(),
  icon: optionalUrl,
  itemType: z.string().trim().max(120).optional(),
  rarity: z.string().trim().max(80).optional(),
  damageType: z.string().trim().max(80).optional(),
  description: optionalText,
  notes: optionalText,
  required: z.boolean().optional(),
  quantity: z.number().int().min(1).max(3).optional(),
  setName: z.string().trim().max(160).optional(),
  requiredPieces: z.number().int().min(1).max(5).optional(),
  row: z.union([z.literal(1), z.literal(2)]).optional(),
  artifactTier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional()
});
const namedEntrySchema = namedEntryBaseSchema.extend({ bonuses: z.array(namedEntryBaseSchema).max(4).optional() });
const equipmentEntrySchema = namedEntrySchema.extend({
  slot: z.string().trim().min(1).max(80),
  perks: optionalText,
  selectedPerks: z.array(namedEntrySchema).max(10).optional(),
  traits: z.array(namedEntrySchema).max(8).optional(),
  selectedSpirits: z.array(namedEntrySchema).max(2).optional(),
  exotic: z.boolean().optional()
});
const armorModEntriesSchema = z.array(namedEntrySchema).max(3).refine(
  (entries) => entries.reduce((total, entry) => total + (entry.quantity || 1), 0) <= 3,
  "Armor pieces support at most three selected mod copies."
);
const armorSetEntriesSchema = z.array(namedEntrySchema).max(2).refine((entries) => {
  if (entries.length === 0) return true;
  const [primary, secondary] = entries;
  if (primary?.requiredPieces !== 2) return false;
  if (!secondary) return true;
  const primarySet = (primary.setName || "").toLocaleLowerCase();
  const secondarySet = (secondary.setName || "").toLocaleLowerCase();
  return secondary.requiredPieces === 4
    ? Boolean(primarySet && primarySet === secondarySet)
    : secondary.requiredPieces === 2 && Boolean(primarySet && secondarySet && primarySet !== secondarySet);
}, "Armor sets must be either two different 2-piece bonuses or matching 2-piece and 4-piece bonuses.");
const linkSchema = z.object({
  kind: z.enum(["dim", "mobalytics", "youtube", "twitch", "source", "other"]),
  label: z.string().trim().min(1).max(80),
  url: httpsUrl
});

export const buildDocumentSchema = z.object({
  title: z.string().trim().min(3).max(120),
  originalCreatorName: z.string().trim().max(120).optional(),
  classType: z.enum(["hunter", "titan", "warlock"]),
  classIcon: optionalUrl,
  subclass: z.enum(["prismatic", "arc", "solar", "void", "strand", "stasis"]),
  subclassIcon: optionalUrl,
  tags: z.array(z.string().trim().min(1).max(40)).min(1).max(20),
  activityTags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  summary: z.string().trim().max(600).default(""),
  notes: z.string().trim().max(20_000).default(""),
  concepts: z.array(namedEntrySchema).max(30).default([]),
  championCounters: z.array(namedEntrySchema).max(20).default([]),
  links: z.array(linkSchema).max(20).default([]),
  subclassConfig: z.object({
    super: namedEntrySchema.optional(),
    classAbility: namedEntrySchema.optional(),
    movement: namedEntrySchema.optional(),
    melee: namedEntrySchema.optional(),
    grenade: namedEntrySchema.optional(),
    transcendence: namedEntrySchema.optional(),
    aspects: z.array(namedEntrySchema).max(2).default([]),
    fragments: z.array(namedEntrySchema).max(10).default([]),
    notes: optionalText
  }),
  equipment: z.object({
    weapons: z.array(equipmentEntrySchema).max(12).default([]),
    armor: z.array(equipmentEntrySchema).max(12).default([]),
    armorSets: armorSetEntriesSchema.default([])
  }),
  statPriorities: z.array(z.object({
    stat: z.enum(["Health", "Melee", "Grenade", "Super", "Class", "Weapons"]),
    icon: optionalUrl,
    target: z.number().int().min(0).max(999).optional(),
    minimum: z.number().int().min(0).max(999).optional(),
    maximum: z.number().int().min(0).max(999).optional(),
    priority: z.number().int().min(1).max(6),
    notes: optionalText
  })).max(7).default([]),
  armorMods: z.object({
    helmet: armorModEntriesSchema.default([]),
    arms: armorModEntriesSchema.default([]),
    chest: armorModEntriesSchema.default([]),
    legs: armorModEntriesSchema.default([]),
    classItem: armorModEntriesSchema.default([])
  }),
  artifacts: z.array(namedEntrySchema.extend({
    perks: z.array(namedEntrySchema).max(7).default([]),
    tier: z.string().trim().max(80).optional()
  })).max(6).default([]),
  gameplayLoop: z.array(z.object({
    text: z.string().trim().min(1).max(600),
    icon: optionalUrl
  })).max(30).default([]),
  cosmetics: z.object({
    shader: namedEntrySchema.optional(),
    ornaments: z.array(namedEntrySchema).max(20).default([]),
    ghost: namedEntrySchema.optional(),
    sparrow: namedEntrySchema.optional(),
    ship: namedEntrySchema.optional(),
    notes: optionalText
  }),
  patch: z.string().trim().max(80).optional(),
  outdated: z.boolean().default(false),
  changelog: z.array(z.object({
    version: z.string().trim().max(80).optional(),
    notes: z.string().trim().min(1).max(2_000),
    date: z.string().datetime()
  })).max(50).default([]),
  status: z.enum(["draft", "published"]),
  visibility: z.enum(["private", "public"])
}).strict();

const storedBuildDocumentSchema = buildDocumentSchema.extend({
  equipment: buildDocumentSchema.shape.equipment.extend({
    armorSets: z.array(namedEntrySchema).max(12).default([])
  }),
  artifacts: z.array(namedEntrySchema.extend({
    perks: z.array(namedEntrySchema).max(30).default([]),
    tier: z.string().trim().max(80).optional()
  })).max(7).default([])
});

export const buildVoteSchema = z.object({ vote: z.enum(["up", "down"]).nullable() }).strict();
const workingDraftSchema = z.object({ document: buildDocumentSchema, baseUpdatedAt: z.string().datetime() }).strict();

interface BuildRow {
  id: string;
  slug: string;
  author_membership_id: string;
  author_display_name: string;
  build_json: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  upvotes: number;
  downvotes: number;
  viewer_vote: number | null;
}

export async function buildsRoute(request: Request, env: Env, context: RequestContext): Promise<Response | null> {
  const path = context.url.pathname.replace(/\/$/, "");
  if (!path.startsWith("/api/v1/builds")) return null;
  const session = await sessionFromRequest(request, env);
  const editor = Boolean(session && isBuildEditor(session.row, env));

  if (path === "/api/v1/builds/catalog" && request.method === "GET") {
    if (!session) throw httpError(401, "authentication_required", "Sign in with Bungie to search the build catalog.");
    requireBuildEditor(session.row, env);
    return buildEnvelope<BuildCatalogData>(await loadBuildCatalog(context.url, env), env, context);
  }

  if (path === "/api/v1/builds" && request.method === "GET") return listBuilds(session?.row, editor, env, context);
  if (path === "/api/v1/builds" && request.method === "POST") {
    if (!session) throw httpError(401, "authentication_required", "Sign in with Bungie to create a build.");
    requireBuildEditor(session.row, env);
    await requireCsrf(request, session.token, env);
    return createBuild(request, session.row, env, context);
  }

  const match = path.match(/^\/api\/v1\/builds\/([^/]+)(\/(?:vote|working-draft))?$/);
  if (!match) return null;
  const identifier = decodeURIComponent(match[1] || "");
  if (match[2] === "/vote" && request.method === "POST") {
    if (!session) throw httpError(401, "authentication_required", "Sign in with Bungie to rate a build.");
    await requireCsrf(request, session.token, env);
    return voteOnBuild(request, identifier, session.row, env, context);
  }
  if (match[2] === "/working-draft") {
    if (!session) throw httpError(401, "authentication_required", "Sign in with Bungie to manage build drafts.");
    requireBuildEditor(session.row, env);
    if (request.method === "GET") return readWorkingDraft(identifier, session.row, env, context);
    await requireCsrf(request, session.token, env);
    if (request.method === "PUT") return saveWorkingDraft(request, identifier, session.row, env, context);
    if (request.method === "DELETE") return deleteWorkingDraft(identifier, session.row, env, context);
  }
  if (!match[2] && request.method === "GET") return readBuild(identifier, session?.row, editor, env, context);
  if (!match[2] && request.method === "PUT") {
    if (!session) throw httpError(401, "authentication_required", "Sign in with Bungie to edit a build.");
    requireBuildEditor(session.row, env);
    await requireCsrf(request, session.token, env);
    return updateBuild(request, identifier, session.row, env, context);
  }
  return null;
}

async function listBuilds(viewer: SessionRow | undefined, editor: boolean, env: Env, context: RequestContext): Promise<Response> {
  const where = editor ? "b.status != 'archived'" : "b.status = 'published' AND b.visibility = 'public'";
  const rows = await env.DB.prepare(`${buildSelect()} WHERE ${where} GROUP BY b.id ORDER BY b.updated_at DESC`)
    .bind(viewer?.membership_id || "")
    .all<BuildRow>();
  const builds: GuardianBuild[] = [];
  let invalidCount = 0;
  for (const row of rows.results || []) {
    try { builds.push(buildFromRow(row, editor)); }
    catch (error) { invalidCount += 1; logStoredBuildIssue(row, error); }
  }
  return buildEnvelope<BuildsData>({ builds, canCreate: editor }, env, context, invalidCount
    ? [`${invalidCount} saved build${invalidCount === 1 ? " was" : "s were"} omitted because stored data could not be normalized safely.`]
    : []);
}

interface WorkingDraftRow { build_id: string; build_json: string; base_updated_at: string; saved_at: string }

async function readBuild(identifier: string, viewer: SessionRow | undefined, editor: boolean, env: Env, context: RequestContext): Promise<Response> {
  const row = await findBuild(identifier, viewer?.membership_id || "", env);
  if (!row || (!editor && !isPublic(row))) throw httpError(404, "build_not_found", "This build is unavailable or has not been published.");
  try { return buildEnvelope<BuildData>({ build: buildFromRow(row, editor) }, env, context); }
  catch (error) {
    logStoredBuildIssue(row, error);
    throw httpError(500, "build_data_invalid", "A saved build could not be read safely.");
  }
}

async function createBuild(request: Request, row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const document = normalizePublication(buildDocumentSchema.parse(await request.json()));
  const id = crypto.randomUUID();
  const slug = `${slugifyBuildTitle(document.title)}-${id.slice(0, 8)}`;
  const now = new Date().toISOString();
  const publishedAt = document.status === "published" ? now : null;
  await env.DB.prepare(`INSERT INTO builds
    (id, slug, author_membership_id, author_display_name, title, class_type, subclass, summary, status, visibility, build_json, created_at, updated_at, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, slug, row.membership_id, row.display_name, document.title, document.classType, document.subclass, document.summary, document.status, document.visibility, JSON.stringify(document), now, now, publishedAt)
    .run();
  const created = await findBuild(id, row.membership_id, env);
  if (!created) throw httpError(500, "build_create_failed", "The build was saved but could not be read back.");
  return buildEnvelope<BuildData>({ build: buildFromRow(created, true) }, env, context);
}

async function updateBuild(request: Request, identifier: string, editorRow: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const existing = await findBuild(identifier, editorRow.membership_id, env);
  if (!existing) throw httpError(404, "build_not_found", "This build could not be found.");
  const document = normalizePublication(buildDocumentSchema.parse(await request.json()));
  const now = new Date().toISOString();
  const previous = parseDocument(existing.build_json);
  const publishedAt = document.status === "published" ? existing.published_at || now : null;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO build_revisions (build_id, editor_membership_id, build_json, created_at) VALUES (?, ?, ?, ?)")
      .bind(existing.id, editorRow.membership_id, JSON.stringify(previous), now),
    env.DB.prepare(`UPDATE builds SET title = ?, class_type = ?, subclass = ?, summary = ?, status = ?, visibility = ?, build_json = ?, updated_at = ?, published_at = ? WHERE id = ?`)
      .bind(document.title, document.classType, document.subclass, document.summary, document.status, document.visibility, JSON.stringify(document), now, publishedAt, existing.id),
    env.DB.prepare("DELETE FROM build_working_drafts WHERE build_id = ? AND editor_membership_id = ?")
      .bind(existing.id, editorRow.membership_id)
  ]);
  const updated = await findBuild(existing.id, editorRow.membership_id, env);
  if (!updated) throw httpError(500, "build_update_failed", "The build was saved but could not be read back.");
  return buildEnvelope<BuildData>({ build: buildFromRow(updated, true) }, env, context);
}

async function readWorkingDraft(identifier: string, editorRow: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const build = await findBuild(identifier, editorRow.membership_id, env);
  if (!build) throw httpError(404, "build_not_found", "This build could not be found.");
  const row = await env.DB.prepare("SELECT build_id, build_json, base_updated_at, saved_at FROM build_working_drafts WHERE build_id = ? AND editor_membership_id = ?")
    .bind(build.id, editorRow.membership_id).first<WorkingDraftRow>();
  return buildEnvelope<BuildWorkingDraftData>({ draft: row ? { buildId: row.build_id, document: parseStoredBuildDocument(row.build_json), baseUpdatedAt: row.base_updated_at, savedAt: row.saved_at } : undefined }, env, context);
}

async function saveWorkingDraft(request: Request, identifier: string, editorRow: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const build = await findBuild(identifier, editorRow.membership_id, env);
  if (!build) throw httpError(404, "build_not_found", "This build could not be found.");
  const input = workingDraftSchema.parse(await request.json());
  if (build.updated_at !== input.baseUpdatedAt) throw httpError(409, "build_draft_conflict", "The published build changed after this editing session began. Reload before replacing it.");
  const now = new Date().toISOString();
  const document = normalizePublication({ ...input.document, status: "draft", visibility: "private" });
  await env.DB.prepare(`INSERT INTO build_working_drafts (build_id, editor_membership_id, build_json, base_updated_at, saved_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(build_id, editor_membership_id) DO UPDATE SET build_json = excluded.build_json, base_updated_at = excluded.base_updated_at, saved_at = excluded.saved_at`)
    .bind(build.id, editorRow.membership_id, JSON.stringify(document), input.baseUpdatedAt, now).run();
  return buildEnvelope<BuildWorkingDraftData>({ draft: { buildId: build.id, document, baseUpdatedAt: input.baseUpdatedAt, savedAt: now } }, env, context);
}

async function deleteWorkingDraft(identifier: string, editorRow: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const build = await findBuild(identifier, editorRow.membership_id, env);
  if (!build) throw httpError(404, "build_not_found", "This build could not be found.");
  await env.DB.prepare("DELETE FROM build_working_drafts WHERE build_id = ? AND editor_membership_id = ?").bind(build.id, editorRow.membership_id).run();
  return buildEnvelope<BuildWorkingDraftData>({}, env, context);
}

async function voteOnBuild(request: Request, identifier: string, row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const input = buildVoteSchema.parse(await request.json());
  const build = await findBuild(identifier, row.membership_id, env);
  if (!build || !isPublic(build)) throw httpError(404, "build_not_found", "Only published builds can be rated.");
  const now = new Date().toISOString();
  if (input.vote === null) {
    await env.DB.prepare("DELETE FROM build_votes WHERE build_id = ? AND membership_id = ?")
      .bind(build.id, row.membership_id)
      .run();
  } else {
    const value = input.vote === "up" ? 1 : -1;
    await env.DB.prepare(`INSERT INTO build_votes (build_id, membership_id, vote, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(build_id, membership_id) DO UPDATE SET vote = excluded.vote, updated_at = excluded.updated_at`)
      .bind(build.id, row.membership_id, value, now, now)
      .run();
  }
  const updated = await findBuild(build.id, row.membership_id, env);
  if (!updated) throw httpError(500, "build_vote_failed", "The rating was saved but could not be read back.");
  return buildEnvelope<BuildVoteResult>({ rating: ratingFromCounts(updated.upvotes, updated.downvotes), viewerVote: input.vote }, env, context);
}

function buildSelect(): string {
  return `SELECT b.id, b.slug, b.author_membership_id, b.author_display_name, b.build_json, b.created_at, b.updated_at, b.published_at,
    COALESCE(SUM(CASE WHEN v.vote = 1 THEN 1 ELSE 0 END), 0) AS upvotes,
    COALESCE(SUM(CASE WHEN v.vote = -1 THEN 1 ELSE 0 END), 0) AS downvotes,
    MAX(CASE WHEN v.membership_id = ? THEN v.vote ELSE NULL END) AS viewer_vote
    FROM builds b LEFT JOIN build_votes v ON v.build_id = b.id`;
}

async function findBuild(identifier: string, viewerMembershipId: string, env: Env): Promise<BuildRow | null> {
  return env.DB.prepare(`${buildSelect()} WHERE b.id = ? OR b.slug = ? GROUP BY b.id LIMIT 1`)
    .bind(viewerMembershipId, identifier, identifier)
    .first<BuildRow>();
}

function buildFromRow(row: BuildRow, canEdit: boolean): GuardianBuild {
  const document = parseDocument(row.build_json);
  return {
    ...document,
    id: row.id,
    slug: row.slug,
    authorMembershipId: row.author_membership_id,
    authorDisplayName: row.author_display_name,
    rating: ratingFromCounts(Number(row.upvotes), Number(row.downvotes)),
    viewerVote: voteValue(row.viewer_vote),
    canEdit,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at || undefined
  };
}

export function parseStoredBuildDocument(value: string): BuildDocument {
  const stored = storedBuildDocumentSchema.parse(JSON.parse(value));
  return buildDocumentSchema.parse({
    ...stored,
    equipment: {
      ...stored.equipment,
      armorSets: normalizeArmorSetSelections(stored.equipment.armorSets)
    },
    artifacts: stored.artifacts.map((artifact) => ({ ...artifact, perks: artifact.perks.slice(0, 7) }))
  });
}

function parseDocument(value: string): BuildDocument {
  return parseStoredBuildDocument(value);
}

function logStoredBuildIssue(row: Pick<BuildRow, "id">, error: unknown): void {
  const issues = error instanceof z.ZodError
    ? error.issues.map((issue) => ({ path: issue.path.join("."), code: issue.code }))
    : [{ path: "document", code: error instanceof SyntaxError ? "invalid_json" : "unknown" }];
  console.error("Stored build data could not be normalized.", { buildId: row.id, issues });
}

function normalizePublication(document: z.infer<typeof buildDocumentSchema>): BuildDocument {
  return {
    ...document,
    tags: unique(document.tags),
    activityTags: unique(document.activityTags),
    visibility: document.status === "published" ? "public" : "private"
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function voteValue(value: number | null): BuildVoteValue | undefined {
  return value === 1 ? "up" : value === -1 ? "down" : undefined;
}

function isPublic(row: BuildRow): boolean {
  const document = parseDocument(row.build_json);
  return document.status === "published" && document.visibility === "public";
}

function isBuildEditor(row: SessionRow, env: Env): boolean {
  return allowlist(env.MATRIX_MEMBERSHIP_IDS).has(row.membership_id);
}

function requireBuildEditor(row: SessionRow, env: Env): void {
  if (!isBuildEditor(row, env)) throw httpError(403, "build_edit_forbidden", "This Guardian may browse builds but cannot create or edit them.");
}

export function ratingFromCounts(upvotes: number, downvotes: number): BuildRating {
  const total = upvotes + downvotes;
  return {
    upvotes,
    downvotes,
    total,
    score: upvotes - downvotes,
    percentPositive: total ? Math.round((upvotes / total) * 100) : undefined
  };
}

export function slugifyBuildTitle(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72) || "guardian-build";
}

function buildEnvelope<T>(data: T, env: Env, context: RequestContext, warnings: string[] = []): Response {
  const observedAt = new Date().toISOString();
  const body: ApiEnvelope<T> = {
    data,
    freshness: { state: "fresh", observedAt, ageSeconds: 0 },
    warnings,
    requestId: context.requestId
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": context.origin === env.ALLOWED_ORIGIN ? context.origin : env.WEB_ORIGIN,
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin"
    }
  });
}
