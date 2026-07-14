import type { ApiEnvelope, ApiError } from "@guardian-nexus/contracts";

export class ApiRequestError extends Error {
  status: number;
  code: string;
  retryAfterSeconds?: number;
  requestId?: string;

  constructor(status: number, body: Partial<ApiError>) {
    super(body.message || "Guardian Nexus request failed.");
    this.status = status;
    this.code = body.code || "request_failed";
    this.retryAfterSeconds = body.retryAfterSeconds;
    this.requestId = body.requestId;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiRequestError(response.status, body);
  return body as ApiEnvelope<T>;
}

export function mutationHeaders(csrfToken?: string): HeadersInit {
  return csrfToken ? { "X-CSRF-Token": csrfToken } : {};
}
