import { describe, expect, it, vi } from "vitest";
import { decrypt, encrypt, redact, sessionFromRequest } from "../src/security";
import type { Env } from "../src/types";

describe("security helpers", () => {
  it("records account use on ordinary authenticated requests, throttles repeats, and ignores expired sessions", async () => {
    const row = { membership_id: "guardian", session_hash: "hash", refresh_expires_at: Math.floor(Date.now() / 1000) + 600, last_seen_at: undefined as string | undefined };
    const run = vi.fn().mockResolvedValue({});
    const bind = vi.fn().mockReturnValue({ first: async () => row, run });
    const prepare = vi.fn().mockReturnValue({ bind });
    const env = { DB: { prepare } } as unknown as Env;
    const request = new Request("https://example.com/api/v1/me/gear", { headers: { Cookie: "gn_session=test-session" } });
    await sessionFromRequest(request, env);
    expect(prepare.mock.calls.some(([sql]) => sql.includes("UPDATE users SET last_seen_at"))).toBe(true);
    prepare.mockClear();
    row.last_seen_at = new Date().toISOString();
    await sessionFromRequest(request, env);
    expect(prepare).toHaveBeenCalledTimes(1);
    prepare.mockClear();
    row.last_seen_at = undefined;
    row.refresh_expires_at = 0;
    expect(await sessionFromRequest(request, env)).toBeNull();
    expect(prepare.mock.calls.some(([sql]) => sql.includes("UPDATE users SET last_seen_at"))).toBe(false);
  });
  it("encrypts token material with authenticated encryption", async () => {
    const secret = "this-is-a-long-development-encryption-secret";
    const cipher = await encrypt("refresh-token", secret);
    expect(cipher).not.toContain("refresh-token");
    expect(await decrypt(cipher, secret)).toBe("refresh-token");
  });

  it("redacts sensitive keys without hiding Bungie error codes", () => {
    expect(redact({ access_token: "x", nested: { Authorization: "y" }, ErrorCode: 1 })).toEqual({
      access_token: "[REDACTED]",
      nested: { Authorization: "[REDACTED]" },
      ErrorCode: 1
    });
  });
});
