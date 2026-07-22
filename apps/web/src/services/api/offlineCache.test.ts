import { describe, expect, it } from "vitest";
import { offlineCachePolicy } from "./offlineCache";

describe("offline cache policy", () => {
  it("allows normalized Guardian surfaces while rejecting sensitive session and diagnostic routes", () => {
    expect(offlineCachePolicy("/api/v1/me/collection?characterId=c1")?.scope).toBe("guardian");
    expect(offlineCachePolicy("/api/v1/me/quests?characterId=c1")?.maxAgeMs).toBe(24 * 60 * 60_000);
    expect(offlineCachePolicy("/api/v1/session")).toBeUndefined();
    expect(offlineCachePolicy("/api/v1/dev/probe")).toBeUndefined();
    expect(offlineCachePolicy("/api/v1/builds/123/working-draft")).toBeUndefined();
  });

  it("allows public Xur and build reads without a Guardian scope", () => {
    expect(offlineCachePolicy("/api/v1/xur")?.scope).toBe("public");
    expect(offlineCachePolicy("/api/v1/builds")?.scope).toBe("public");
    expect(offlineCachePolicy("/api/v1/builds/example-build")?.scope).toBe("public");
  });
});
