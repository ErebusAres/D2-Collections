// @vitest-environment jsdom

import type { ApiEnvelope, BuildAdvisorData, BuildAdvisorRecommendation, SessionData } from "@guardian-nexus/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyBuildDocument } from "../modules/builds/builds";
import { api } from "../services/api/client";
import { BuildAdvisorPage } from "./BuildAdvisorPage";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  refresh: vi.fn().mockResolvedValue(undefined),
  selectCharacter: vi.fn(),
  setPreference: vi.fn(),
  state: { authenticated: true }
}));

vi.mock("../context/GuardianContext", () => ({
  useGuardian: () => ({
    session: mocks.state.authenticated ? session() : { authenticated: false, roles: { dev: false, matrixWriter: false, buildEditor: false, reportAdmin: false } },
    loading: false,
    signIn: mocks.signIn,
    refresh: mocks.refresh,
    selectedCharacterId: "hunter",
    selectCharacter: mocks.selectCharacter,
    autoRefresh: false,
    preferences: {},
    setPreference: mocks.setPreference
  })
}));

vi.mock("../services/api/client", () => ({ api: vi.fn() }));

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  mocks.state.authenticated = true;
  mocks.signIn.mockReset();
  mocks.refresh.mockReset().mockResolvedValue(undefined);
  mocks.selectCharacter.mockReset();
  mocks.setPreference.mockReset();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("Build Advisor page", () => {
  it("uses the existing Bungie sign-in action when signed out", () => {
    mocks.state.authenticated = false;
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Sign in with Bungie" }));
    expect(mocks.signIn).toHaveBeenCalledOnce();
    expect(vi.mocked(api)).not.toHaveBeenCalled();
  });

  it("forces a Bungie inventory refresh and recalculates recommendations", async () => {
    vi.mocked(api)
      .mockResolvedValueOnce(envelope(advisorData("Initial Owned Build")))
      .mockResolvedValueOnce(envelope(advisorData("Refreshed Owned Build")));
    renderPage();
    expect((await screen.findAllByText("Initial Owned Build")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Refresh inventory" }));
    expect((await screen.findAllByText("Refreshed Owned Build")).length).toBeGreaterThan(0);
    expect(mocks.refresh).toHaveBeenCalled();
    expect(vi.mocked(api).mock.calls.some(([path]) => String(path).includes("refresh=1"))).toBe(true);
  });

  it("shows stale data warnings and hands a recommendation to Builder", async () => {
    const data = advisorData("Vault Gyrfalcon Build");
    data.state = "may-be-stale";
    data.analysis.warnings = ["Inventory may be older than the current Bungie profile."];
    vi.mocked(api).mockResolvedValue(envelope(data, ["Inventory may be older than the current Bungie profile."], "stale"));
    renderPage();
    expect((await screen.findAllByText("Inventory may be stale")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Inventory may be older than the current Bungie profile.").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Open in Builder/i }));
    expect((await screen.findByTestId("target-location")).textContent).toMatch(/\/builds\/new\?fromAdvisor=/);
    expect([...Array(sessionStorage.length)].map((_, index) => sessionStorage.key(index)).some((key) => key?.startsWith("guardian-nexus:advisor-build-import:"))).toBe(true);
  });

  it("shows acquisition steps and their data source for a missing item", async () => {
    const data = advisorData("Missing Core Build");
    data.recommendations[0]!.missingItems = ["Gyrfalcon's Hauberk"];
    data.recommendations[0]!.missingItemGuides = [{
      id: "item:gyrfalcon-s-hauberk",
      name: "Gyrfalcon's Hauberk",
      kind: "specific-item",
      itemHash: "1",
      itemType: "Chest Armor",
      acquisition: "Exotic Armor Focusing",
      source: "bungie-manifest",
      steps: [
        "Use the current Exotic Armor Focusing screen and select Gyrfalcon's Hauberk when its focusing requirements are met.",
        "Refresh Build Advisor after the item reaches a character inventory or the Vault."
      ]
    }];
    vi.mocked(api).mockResolvedValue(envelope(data));
    renderPage();
    expect(await screen.findByText("How to obtain")).toBeTruthy();
    expect(screen.getByText("Bungie manifest")).toBeTruthy();
    expect(screen.getByText("Exotic Armor Focusing")).toBeTruthy();
    expect(screen.getByText(/select Gyrfalcon's Hauberk/i)).toBeTruthy();
  });

  it("filters owned recommendations by subclass and gameplay focus", async () => {
    const data = advisorData("Void General Build");
    const solar = recommendation("Solar Boss Build");
    solar.subclass = "solar";
    solar.focuses = ["Balanced", "Boss Damage"];
    data.recommendations.push(solar);
    vi.mocked(api).mockResolvedValue(envelope(data));
    renderPage();
    expect((await screen.findAllByText("Void General Build")).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Subclass"), { target: { value: "solar" } });
    expect(screen.queryByText("Void General Build")).toBeNull();
    expect(screen.getAllByText("Solar Boss Build").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Focus"), { target: { value: "Boss Damage" } });
    expect(screen.getByText("of 2 builds shown").parentElement?.textContent).toBe("1 of 2 builds shown");
    fireEvent.click(screen.getByRole("button", { name: "Show all 2" }));
    expect(screen.getAllByText("Void General Build").length).toBeGreaterThan(0);
    expect(screen.getByText(/Build Advisor 2.0 · Template set v/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Solar" })).toBeTruthy();
  });

  it("separates template viability from the Guardian's inventory readiness", async () => {
    vi.mocked(api).mockResolvedValue(envelope(advisorData("Scored Build")));
    renderPage();
    expect(await screen.findByLabelText("Build viability 86 out of 100")).toBeTruthy();
    expect(screen.getAllByText("96% ready").length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "Build recommendation scores" }).textContent).toContain("Overall match91");
  });

  it("tracks the complete recommendation checklist for Fireteam sharing", async () => {
    vi.mocked(api).mockResolvedValue(envelope(advisorData("Tracked Build")));
    renderPage();
    await screen.findAllByText("Tracked Build");
    fireEvent.click(screen.getByRole("button", { name: "Track build on Fireteam" }));
    expect(mocks.setPreference).toHaveBeenCalledWith("buildAdvisor.trackedBuilds.v1", expect.any(String));
    const value = mocks.setPreference.mock.calls.find(([key]) => key === "buildAdvisor.trackedBuilds.v1")?.[1];
    expect(JSON.parse(String(value))).toEqual([expect.objectContaining({ kind: "build", name: "Tracked Build", trackedInDestiny: false })]);
  });

  it("confirms and submits a server-resolved build equip action", async () => {
    const data = advisorData("Ready Gear Build");
    data.recommendations[0]!.equipPlan = { state: "ready", canEquip: true, itemCount: 8, transferCount: 2, equippedCount: 1, blockers: [] };
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(api).mockImplementation(async (path, init) => {
      if (path === "/api/v1/me/build-advisor/equip" && init?.method === "POST") {
        return {
          data: { recommendationId: data.recommendations[0]!.id, characterId: "hunter", transferredItemIds: ["one", "two"], equippedItemIds: Array.from({ length: 8 }, (_, index) => String(index)), equipped: true },
          freshness: { state: "fresh", observedAt: "2026-07-26T12:00:00.000Z" },
          warnings: [],
          requestId: "equip"
        } as never;
      }
      return envelope(data) as never;
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Equip build gear" }));
    await waitFor(() => expect(vi.mocked(api).mock.calls.some(([path, init]) => path === "/api/v1/me/build-advisor/equip" && init?.method === "POST")).toBe(true));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/move 2 items/i));
  });
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/build-advisor"]}><Routes>
    <Route path="/build-advisor" element={<BuildAdvisorPage />} />
    <Route path="/builds/new" element={<LocationProbe />} />
  </Routes></MemoryRouter></QueryClientProvider>);
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="target-location">{location.pathname}{location.search}</div>;
}

function session(): SessionData {
  return {
    authenticated: true,
    csrfToken: "csrf",
    roles: { dev: false, matrixWriter: false, buildEditor: true, reportAdmin: false },
    guardian: {
      membershipId: "member",
      membershipType: 3,
      displayName: "Guardian",
      bungieName: "Guardian#0001",
      selectedCharacterId: "hunter",
      characters: [{ characterId: "hunter", className: "Hunter", raceName: "Human", emblemPath: "", emblemBackgroundPath: "", power: 500, dateLastPlayed: "", minutesPlayedThisSession: 0 }],
      stats: { power: 500, guardianRank: 7, rewardsPassRank: 1, rewardsPassProgress: { state: "unavailable", source: "bungie-profile-character-progressions", reason: "Test fixture" }, mailboxCount: 0 },
      isInGame: false
    }
  };
}

function advisorData(name: string): BuildAdvisorData {
  return {
    characterId: "hunter",
    characterClass: "Hunter",
    characterPower: 500,
    manifestVersion: "test",
    templateSetVersion: 1,
    templateReviewedAt: "2026-07-26",
    state: "current",
    recommendations: [recommendation(name)],
    analysis: {
      physicalItemCount: 3,
      savedLoadoutCount: 1,
      ownedExoticArmorByClass: {},
      ownedExoticWeapons: [],
      equippedExotics: [],
      vaultExotics: [],
      collectionOnlyExotics: [],
      relevantLegendaryRolls: [],
      missingHighImpactItems: [],
      syncTimestamp: "2026-07-26T12:00:00.000Z",
      warnings: []
    }
  };
}

function recommendation(name: string): BuildAdvisorRecommendation {
  return {
    id: `advisor:${name}`,
    templateId: "hunter-void-gyrfalcon",
    templateVersion: 1,
    reviewedAt: "2026-07-26",
    release: "Monument of Triumph",
    name,
    classType: "hunter",
    subclass: "void",
    score: 91,
    viabilityScore: 86,
    readinessScore: 96,
    status: "fully-assembleable",
    categories: ["Best Overall"],
    focuses: ["Balanced", "General PvE", "Solo / Survivability", "Add Clear", "Ability Uptime", "Power Progression"],
    coreExoticArmor: { itemHash: "1", name: "Gyrfalcon's Hauberk", icon: "", itemType: "Chest Armor", className: "Hunter" },
    weapons: [],
    armor: [
      { slot: "helmet", label: "Helmet", score: 0, quality: "missing", notes: [] },
      { slot: "arms", label: "Gauntlets", score: 0, quality: "missing", notes: [] },
      { slot: "chest", label: "Chest Armor", score: 0, quality: "missing", notes: [] },
      { slot: "legs", label: "Leg Armor", score: 0, quality: "missing", notes: [] },
      { slot: "classItem", label: "Class Item", score: 0, quality: "missing", notes: [] }
    ],
    ghostFocus: { mod: { name: "Reaver Armorer" }, primaryStat: "Class", secondaryStat: "Melee" },
    missingItems: [],
    missingItemGuides: [],
    substitutions: [],
    activities: ["General PvE"],
    style: "Mobile Void weapon pressure.",
    damageProfile: "high",
    survivability: "high",
    complexity: "medium",
    artifactDependency: "none",
    powerFriendly: true,
    reason: "All core pieces are owned.",
    gameplayLoop: ["Dodge, attack, and reset invisibility."],
    damageRotation: ["Weaken, fire heavy, then reset."],
    limitations: ["Damage depends on the owned heavy roll."],
    upgrades: ["Improve the heavy roll."],
    notes: ["The required exotic is in the Vault."],
    factors: [{ id: "core", label: "Core pieces", earned: 30, available: 30, assessment: "excellent", detail: "Owned." }],
    source: { kind: "curated-template", label: "Guardian Nexus reviewed template" },
    verification: {
      state: "verified-current",
      sandbox: "Monument of Triumph · Update 9.7.0",
      verifiedAt: "2026-07-27",
      sources: [{ label: "Bungie Update 9.7.0", url: "https://www.bungie.net/7/en/News/Article/destiny_update_9_7_0" }]
    },
    subclassValidation: { state: "validated", checkedCount: 11, message: "11 subclass selections matched Bungie's definitions." },
    equipPlan: { state: "partial", canEquip: false, itemCount: 0, transferCount: 0, equippedCount: 0, blockers: ["Missing physical gear."] },
    build: { ...emptyBuildDocument(), title: name, classType: "hunter", subclass: "void", tags: ["Build Advisor"] }
  };
}

function envelope(data: BuildAdvisorData, warnings: string[] = [], freshness: "fresh" | "stale" = "fresh"): ApiEnvelope<BuildAdvisorData> {
  return { data, freshness: { state: freshness, observedAt: "2026-07-26T12:00:00.000Z", sourceMintedAt: "2026-07-26T12:00:00.000Z" }, warnings, requestId: "test" };
}
