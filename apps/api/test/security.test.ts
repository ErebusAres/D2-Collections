import { describe, expect, it } from "vitest";
import { decrypt, encrypt, redact } from "../src/security";

describe("security helpers", () => {
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
