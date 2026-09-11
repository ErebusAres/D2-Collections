import { describe, expect, it } from "vitest";
import { isVerifiedXurShipment, parseStoredXurSnapshot, xurCacheIsFresh, xurDataFromStoredShipment } from "./xurSnapshot";

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

  it("turns the global shipment into a safe account-neutral first response", () => {
    const data = xurDataFromStoredShipment({
      capturedAt: "2026-07-17T17:00:00.000Z",
      offers: [{ itemHash: "42", name: "The Last Word" } as any]
    }, "now");
    expect(data).toMatchObject({ state: "unavailable", inventoryStatus: "last-shipment", checkedAt: "now", offers: [{ itemHash: "42" }] });
    expect(data.strangeCoins).toBeUndefined();
  });

  it("expires the cache at Bungie's storefront refresh even when its TTL remains", () => {
    const now = Date.parse("2026-09-11T17:00:00.000Z");
    expect(xurCacheIsFresh("2026-09-11T17:05:00.000Z", "2026-09-11T16:59:59.000Z", now)).toBe(false);
    expect(xurCacheIsFresh("2026-09-11T17:05:00.000Z", "2026-09-11T18:00:00.000Z", now)).toBe(true);
  });

  it("only treats active live inventory as a verified shipment", () => {
    const offer = { itemHash: "42", name: "The Last Word" } as any;
    expect(isVerifiedXurShipment({ state: "available", inventoryStatus: "live", checkedAt: "now", offers: [offer] })).toBe(true);
    expect(isVerifiedXurShipment({ state: "away", inventoryStatus: "last-shipment", checkedAt: "now", offers: [offer] })).toBe(false);
  });
});
