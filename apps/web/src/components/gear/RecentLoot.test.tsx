// @vitest-environment jsdom
import type { WeaponItem } from "@guardian-nexus/contracts";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CompactRecentLootBar, RecentItemRow, observedLootWithin, parseRecentLootDisplayLimit, recentLoot, recentLootPageSize } from "./RecentLoot";

const weapon = { instanceId: "1", itemHash: "2", name: "Recent Rifle", icon: "", itemType: "Auto Rifle", slot: "Energy", damageType: "Arc", rarity: "Legendary", power: 500, location: "vault", equipped: false, locked: false, masterworked: false, crafted: false, enhanced: false, perkColumns: [], originTraits: [], rollDataState: "unavailable", reviewState: "incomplete-data", reviewReasons: [], duplicateCount: 1, wishlisted: false, firstSeenAt: "2026-08-06T12:00:00Z", isNew: true } as WeaponItem;

describe("RecentItemRow", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it("orders new loot and applies a tag shortcut only to the active item", () => {
    const onTag = vi.fn();
    render(<RecentItemRow title="Recently acquired" items={recentLoot([], [weapon])} onTag={onTag} />);
    const card = screen.getByText("Recent Rifle").closest("article")!;
    fireEvent.mouseEnter(card);
    fireEvent.keyDown(window, { key: "2", shiftKey: true });
    expect(onTag).toHaveBeenCalledWith(expect.objectContaining({ instanceId: "1" }), "keep");
  });

  it("keeps the detail tooltip open when the inspection tile receives focus and a click", () => {
    render(<RecentItemRow title="Recently acquired" items={recentLoot([], [weapon])} onTag={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Inspect Recent Rifle" }));
    expect(screen.getByRole("tooltip").textContent).toContain("Recent Rifle");
  });

  it("keeps reviewed items in rolling history and excludes older observations", () => {
    const now = Date.parse("2026-08-06T12:00:00Z");
    const reviewed = { ...weapon, isNew: false, tag: "keep" as const };
    const old = { ...weapon, instanceId: "old", firstSeenAt: "2026-07-20T12:00:00Z" };

    expect(observedLootWithin([], [reviewed, old], 7, "all", now).map((item) => item.instanceId)).toEqual(["1"]);
  });

  it("shows a sourced quality tier, mode scores, confidence, and rating basis", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      schemaVersion: 4, reviewedAt: "2026-08-08", source: { name: "DIM Voltron" }, method: { columnWeights: [1, 1, 1, 1] },
      coverage: { manifestWeapons: 1, reviewedWeapons: 1, supportedTypes: 1, reviewedTypes: 1 }, types: {},
      items: { "2": {
        itemType: "Auto Rifle",
        pve: { recommendations: 1, columns: [["10"], ["11"], ["12"], ["13"]], traitPairs: ["12,13"] },
        pvp: { recommendations: 1, columns: [["20"], ["11"], ["22"], ["13"]], traitPairs: ["22,13"] }
      } }
    }) }));
    const rated = { ...weapon, rollDataState: "complete" as const, perkColumns: ["10", "11", "12", "13"].map((hash, socketIndex) => ({ socketIndex, ratingColumn: socketIndex as 0 | 1 | 2 | 3, active: { hash, name: `Perk ${hash}`, description: "" }, options: [] })) };
    render(<RecentItemRow title="Recently acquired" items={recentLoot([], [rated])} onTag={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Roll 75%")).toBeTruthy());
    expect(screen.getByText("Strong")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Inspect Recent Rifle" }));
    expect(screen.getByRole("tooltip").textContent).toContain("Exact weapon evidence");
    expect(screen.getByRole("tooltip").textContent).toContain("Confidencehigh");
    expect(screen.getByRole("tooltip").textContent).toContain("PvE100%");
    expect(screen.getByRole("tooltip").textContent).toContain("PvP50%");
    cleanup();
    render(<MemoryRouter><CompactRecentLootBar items={[{ ...rated, kind: "weapon" }]} onTag={vi.fn()} onHide={vi.fn()} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Roll 75%")).toBeTruthy());
  });

  it("keeps up to 24 entries by default while paging a single 12-card row", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const items = Array.from({ length: 30 }, (_, index) => ({ ...weapon, kind: "weapon" as const, instanceId: `loot-${index}`, name: `Recent Rifle ${index}`, firstSeenAt: `2026-08-06T11:${String(59 - index).padStart(2, "0")}:00Z` }));
    const onDisplayLimitChange = vi.fn();
    render(<MemoryRouter><CompactRecentLootBar items={items} catalysts={[]} displayLimit={24} onDisplayLimitChange={onDisplayLimitChange} onTag={vi.fn()} onHide={vi.fn()} /></MemoryRouter>);

    expect(screen.getAllByRole("button", { name: /Inspect Recent Rifle/ })).toHaveLength(12);
    expect(screen.getByText((_, element) => element?.tagName === "SMALL" && element.textContent === "Private · 24 of 30 first observed")).toBeTruthy();
    expect(screen.getByText("1 / 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next recent loot page" }));
    expect(screen.getByRole("button", { name: "Inspect Recent Rifle 12" })).toBeTruthy();
    expect(screen.getByText("2 / 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous recent loot page" }));
    expect(screen.getByRole("button", { name: "Inspect Recent Rifle 0" })).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Recent loot cards to keep" }), { target: { value: "48" } });
    expect(onDisplayLimitChange).toHaveBeenCalledWith(48);
    expect(Array.from(screen.getByRole("combobox", { name: "Recent loot cards to keep" }).querySelectorAll("option")).map((option) => option.textContent)).toEqual(["12", "24", "48"]);
  });

  it("renders catalyst observations as icon cards with progress details", () => {
    render(<MemoryRouter><CompactRecentLootBar items={[]} catalysts={[{ recordHash: "cat-1", name: "Sunshot Catalyst", icon: "/sunshot.jpg", state: "obtained", percent: 63, observedAt: "2026-08-06T12:00:00Z" }]} onTag={vi.fn()} onHide={vi.fn()} /></MemoryRouter>);

    const inspect = screen.getByRole("link", { name: "Inspect Sunshot Catalyst" });
    expect(inspect.querySelector("img")?.getAttribute("src")).toBe("/sunshot.jpg");
    expect(screen.getByText("63%")).toBeTruthy();
    fireEvent.mouseEnter(inspect.closest("article")!);
    expect(screen.getByRole("tooltip").textContent).toContain("Masterwork in progress");
    expect(screen.getByRole("tooltip").textContent).toContain("Open catalyst details");
  });

  it("uses a green 100% check without completion wording for finished catalysts", () => {
    render(<MemoryRouter><CompactRecentLootBar items={[]} catalysts={[{ recordHash: "cat-2", name: "Finished Catalyst", icon: "", state: "complete", percent: 100, observedAt: "2026-08-06T12:00:00Z" }]} onTag={vi.fn()} onHide={vi.fn()} /></MemoryRouter>);
    expect(screen.getByLabelText("100%")).toBeTruthy();
    expect(screen.queryByText(/complete/i)).toBeNull();
    fireEvent.mouseEnter(screen.getByRole("link", { name: "Inspect Finished Catalyst" }).closest("article")!);
    expect(screen.getByRole("tooltip").textContent).toContain("Masterworked");
    expect(screen.getByRole("tooltip").textContent).not.toMatch(/complete/i);
  });

  it("renders a newest-left event timeline and stacks material gains", () => {
    const events: any[] = [
      { id: "older", kind: "catalyst-completed", sourceKey: "catalyst:1", recordHash: "1", name: "Old Catalyst", icon: "", quantity: 1, percent: 100, observedAt: "2026-08-08T11:00:00Z", lastObservedAt: "2026-08-08T11:00:00Z" },
      { id: "newer", kind: "inventory-gained", sourceKey: "inventory:2", itemHash: "2", name: "Enhancement Core", icon: "/core.png", itemType: "Material", rarity: "Legendary", quantity: 4, observedAt: "2026-08-08T10:00:00Z", lastObservedAt: "2026-08-08T12:04:00Z" }
    ];
    render(<MemoryRouter><CompactRecentLootBar events={events} onTag={vi.fn()} onHide={vi.fn()} /></MemoryRouter>);
    const cards = screen.getAllByRole("button", { name: /Inspect/ });
    expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual(["Inspect Enhancement Core", "Inspect Old Catalyst"]);
    expect(screen.getByText("×4")).toBeTruthy();
    expect(screen.getByLabelText("100%")).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Recent loot cards to keep" })).toBeNull();
  });

  it("keeps the narrow label concise and places timeline context and service notes in dedicated rows", () => {
    render(<MemoryRouter><CompactRecentLootBar events={[]} retentionDays={30} observedAt="2026-08-08T22:59:41Z" warnings={["Showing saved Guardian data while live services reconnect."]} onTag={vi.fn()} onHide={vi.fn()} /></MemoryRouter>);
    const titleHeader = screen.getByText("Recent loot").closest("header")!;
    expect(titleHeader.textContent).toBe("Recent loot");
    expect(screen.getByText(/Private observed timeline/).closest("header")).not.toBe(titleHeader);
    expect(screen.getByText(/Checked/).closest("footer")).toBeTruthy();
    expect(screen.getByText(/Showing saved Guardian data/).closest("footer")).toBeTruthy();
  });

  it("distinguishes loading, baseline, and request errors instead of reporting each as empty history", () => {
    const { rerender } = render(<MemoryRouter><CompactRecentLootBar events={[]} loading onTag={vi.fn()} onHide={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText(/Checking your latest Bungie profile snapshot/)).toBeTruthy();
    const retry = vi.fn();
    rerender(<MemoryRouter><CompactRecentLootBar events={[]} error={new Error("Bungie profile refresh failed")} onRetry={retry} onTag={vi.fn()} onHide={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole("alert").textContent).toContain("Bungie profile refresh failed");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
    rerender(<MemoryRouter><CompactRecentLootBar events={[]} firstObservationEstablished onTag={vi.fn()} onHide={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText(/baseline established/i)).toBeTruthy();
  });

  it("parses only supported Fireteam display limits", () => {
    expect(parseRecentLootDisplayLimit("12")).toBe(12);
    expect(parseRecentLootDisplayLimit("48")).toBe(48);
    expect(parseRecentLootDisplayLimit("all")).toBe(24);
    expect(recentLootPageSize(1_068)).toBe(12);
    expect(recentLootPageSize(360)).toBe(4);
    expect(recentLootPageSize(0)).toBe(1);
  });
});
