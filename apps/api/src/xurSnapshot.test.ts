import { describe, expect, it } from "vitest";
import { parseStoredXurSnapshot } from "./xurSnapshot";

describe("stored Xur shipments", () => {
  it("restores a valid last verified shipment", () => {
    expect(parseStoredXurSnapshot({
      captured_at: "2026-07-17T17:00:00.000Z",
      next_refresh_at: "2026-07-21T17:00:00.000Z",
      offers_json: JSON.stringify([{ itemHash: "42", name: "The Last Word" }])
    })).toMatchObject({
      capturedAt: "2026-07-17T17:00:00.000Z",
      offers: [{ itemHash: "42", name: "The Last Word" }]
    });
  });

  it("rejects empty or malformed snapshots", () => {
    expect(parseStoredXurSnapshot({ captured_at: "invalid", offers_json: "[]" })).toBeUndefined();
    expect(parseStoredXurSnapshot({ captured_at: "2026-07-17T17:00:00.000Z", offers_json: "not-json" })).toBeUndefined();
    expect(parseStoredXurSnapshot({ captured_at: "2026-07-17T17:00:00.000Z", offers_json: "[]" })).toBeUndefined();
  });
});
