import type { Env, SessionRow } from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function randomToken(bytes = 32): string {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return base64Url(value);
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function encryptionKey(secret: string): Promise<CryptoKey> {
  if (!secret || secret.length < 24) throw new Error("OAUTH_ENCRYPTION_KEY must be at least 24 characters.");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encrypt(value: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(secret), encoder.encode(value));
  return `${base64Url(iv)}.${base64Url(new Uint8Array(cipher))}`;
}

export async function decrypt(value: string, secret: string): Promise<string> {
  const [ivValue, cipherValue] = value.split(".");
  if (!ivValue || !cipherValue) throw new Error("Encrypted value is malformed.");
  const iv = fromBase64Url(ivValue);
  const cipher = fromBase64Url(cipherValue);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    await encryptionKey(secret),
    cipher.buffer as ArrayBuffer
  );
  return decoder.decode(plain);
}

export function parseCookies(request: Request): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of (request.headers.get("Cookie") || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return result;
}

export function cookie(name: string, value: string, options: { maxAge?: number; httpOnly?: boolean; secure?: boolean; path?: string } = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path || "/"}`, "SameSite=Lax"];
  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (options.secure !== false) parts.push("Secure");
  if (typeof options.maxAge === "number") parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  return parts.join("; ");
}

export function allowlist(value: string | undefined): Set<string> {
  return new Set((value || "").split(",").map((item) => item.trim()).filter(Boolean));
}

export async function csrfToken(sessionToken: string, env: Env): Promise<string> {
  return sha256(`${sessionToken}:guardian-nexus-csrf:${env.OAUTH_ENCRYPTION_KEY}`);
}

export async function requireCsrf(request: Request, sessionToken: string, env: Env): Promise<void> {
  const expected = await csrfToken(sessionToken, env);
  if (request.headers.get("X-CSRF-Token") !== expected) throw httpError(403, "csrf_invalid", "The request could not be verified.");
  const origin = request.headers.get("Origin");
  if (origin && origin !== env.WEB_ORIGIN && origin !== env.ALLOWED_ORIGIN) throw httpError(403, "origin_invalid", "The request origin is not allowed.");
}

export async function sessionFromRequest(request: Request, env: Env): Promise<{ token: string; row: SessionRow } | null> {
  const token = parseCookies(request).gn_session;
  if (!token) return null;
  const row = await env.DB.prepare(`
    SELECT s.session_hash, s.membership_id, u.membership_type, u.display_name, u.bungie_name,
      s.access_token_cipher, s.refresh_token_cipher, s.access_expires_at, s.refresh_expires_at
    FROM oauth_sessions s JOIN users u ON u.membership_id = s.membership_id
    WHERE s.session_hash = ?
  `).bind(await sha256(token)).first<SessionRow>();
  if (!row) return null;
  if (row.refresh_expires_at <= Math.floor(Date.now() / 1000)) {
    await env.DB.prepare("DELETE FROM oauth_sessions WHERE session_hash = ?").bind(row.session_hash).run();
    return null;
  }
  return { token, row };
}

export function httpError(status: number, code: string, message: string, retryAfterSeconds?: number): Error & { status: number; code: string; retryAfterSeconds?: number } {
  return Object.assign(new Error(message), { status, code, retryAfterSeconds });
}

const secretKey = /^(access[_-]?token|refresh[_-]?token|authorization|cookie|set-cookie|client[_-]?secret|oauth[_-]?code|session[_-]?(id|token)|encryption[_-]?key)$/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 12) return "[depth limit]";
  if (Array.isArray(value)) return value.slice(0, 500).map((item) => redact(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      secretKey.test(key) ? "[REDACTED]" : redact(item, depth + 1)
    ]));
  }
  if (typeof value === "string" && value.length > 20_000) return `${value.slice(0, 20_000)}…[truncated]`;
  return value;
}

function base64Url(value: Uint8Array): string {
  let binary = "";
  value.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
