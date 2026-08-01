import type { GearData, WatchlistDocument, WatchlistEntry } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { evaluateWatchlist, parseWatchlist } from "./watchlists";

const entry = (overrides: Partial<WatchlistEntry> = {}): WatchlistEntry => ({ id: "watch-1", kind: "perk", label: "Voltshot", target: "Voltshot", enabled: true, notify: true, createdAt: "2026-08-01T00:00:00Z", ...overrides });
const document = (watch: WatchlistEntry): WatchlistDocument => ({ schemaVersion: 1, entries: [watch] });

describe("watchlist evaluation", () => {
  it("matches selectable perks without treating them as opaque roll scores", () => {
    const gear = { weapons: [{ name: "Test Weapon", perkColumns: [{ options: [{ name: "Voltshot" }] }] }] } as GearData;
    expect(evaluateWatchlist(document(entry()), { gear })[0]).toMatchObject({ state: "matched", source: "gear", summary: "Voltshot found on Test Weapon" });
  });

  it("uses explicit unknown states when a private source is unavailable", () => {
    expect(evaluateWatchlist(document(entry({ kind: "collection" })), {})[0]).toMatchObject({ state: "unknown", source: "collection" });
  });

  it("honors deadlines and Postmaster thresholds", () => {
    expect(evaluateWatchlist(document(entry({ expiresAt: "2026-07-31T00:00:00Z" })), {}, new Date("2026-08-01T00:00:00Z"))[0]?.state).toBe("expired");
    expect(evaluateWatchlist(document(entry({ kind: "postmaster", threshold: 18 })), { mailbox: { count: 19, capacity: 21, characters: [], manifestVersion: "test" } })[0]?.state).toBe("matched");
  });

  it("rejects malformed or future preference documents safely", () => {
    expect(parseWatchlist("not-json").entries).toEqual([]);
    expect(parseWatchlist(JSON.stringify({ schemaVersion: 2, entries: [entry()] })).entries).toEqual([]);
  });
});
