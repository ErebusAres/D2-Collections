// @vitest-environment jsdom

import type { GuardianLoadout, LoadoutsData } from "@guardian-nexus/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { api } from "../services/api/client";
import { LoadoutsPage } from "./LoadoutsPage";

vi.mock("../context/GuardianContext", () => ({ useGuardian: () => ({ session: { authenticated: true, roles: {} }, selectedCharacterId: "c1", autoRefresh: false }) }));
vi.mock("../services/api/client", () => ({ api: vi.fn(), mutationHeaders: vi.fn(() => ({})) }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Loadouts page", () => {
  it("shows equipped first, numbers only saved loadout jump targets, and minimizes to item icons", async () => {
    vi.mocked(api).mockResolvedValue(envelope());
    renderPage();

    expect(await screen.findByRole("heading", { name: "Equipped", level: 2 })).toBeTruthy();
    const jumpList = screen.getByRole("navigation", { name: "Loadout jump list" });
    expect([...jumpList.querySelectorAll("a")].map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Top", "#page-top"], ["1", "#loadout-0"]
    ]);
    expect(jumpList.querySelector('a[href="#loadout-equipped"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Minimize Alpha" }));
    const expand = screen.getByRole("button", { name: "Expand Alpha" });
    expect(expand.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByLabelText("Alpha item preview").querySelector('img[alt="Test Rifle"]')).toBeTruthy();
    expect(expand.closest("article")?.querySelector("[hidden]")).toBeTruthy();
  });

  it("caps the horizontal jump frame at 20 saved loadouts and reveals it when activated", async () => {
    vi.mocked(api).mockResolvedValue(envelope(22));
    renderPage();

    await screen.findByRole("heading", { name: "Equipped", level: 2 });
    const jumpList = screen.getByRole("navigation", { name: "Loadout jump list" });
    expect(screen.getAllByRole("link", { name: /Jump to loadout \d+:/ })).toHaveLength(20);
    expect(jumpList.querySelector('a[href="#loadout-19"]')).toBeTruthy();
    expect(jumpList.querySelector('a[href="#loadout-20"]')).toBeNull();

    const sentinel = screen.getByTestId("loadout-jump-sentinel");
    sentinel.getBoundingClientRect = vi.fn(() => ({ top: -1 } as DOMRect));
    fireEvent.scroll(window);
    const reveal = screen.getByRole("button", { name: "Show loadout jump list" });
    expect(reveal.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(reveal);
    expect(screen.getByRole("button", { name: "Hide loadout jump list" }).getAttribute("aria-expanded")).toBe("true");
  });
});

function renderPage() {
  return render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LoadoutsPage /></QueryClientProvider></MemoryRouter>);
}

function envelope(savedCount = 1) {
  const equipped = loadout(-1, "Equipped");
  const saved = Array.from({ length: savedCount }, (_, index) => loadout(index, index === 0 ? "Alpha" : `Loadout ${index + 1}`));
  const data: LoadoutsData = { manifestVersion: "test", characterId: "c1", characterClass: "Hunter", equipped, equippedState: "available", loadouts: saved, artifact: { mods: [], source: "saved-loadout-compatibility", limitation: "test" }, equipRestriction: "Orbit only" };
  return { data, freshness: { state: "fresh" as const, observedAt: "2026-08-05T12:00:00Z" }, warnings: [], requestId: "loadout-test" };
}

function loadout(index: number, name: string): GuardianLoadout {
  const item = { instanceId: `${index}-weapon`, itemHash: "20", name: "Test Rifle", icon: "/rifle.png", itemType: "Auto Rifle", rarity: "Legendary", equipmentSlot: "Kinetic Weapons", definitionAvailable: true, sockets: [] };
  return { index, name, icon: "", color: "", element: "Solar", items: [item], equipment: [item], artifactMods: [], isPrismatic: false, abilities: [], aspects: [], fragments: [], modifiers: [], unresolvedItemCount: 0 };
}
