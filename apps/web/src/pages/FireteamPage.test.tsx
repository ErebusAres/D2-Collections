// @vitest-environment jsdom

import type { FireteamData } from "@guardian-nexus/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, queuedApi } from "../services/api/client";
import { playCompletionChime } from "../services/completionAudio";
import { FireteamPage } from "./FireteamPage";
import styles from "./Pages.module.css";

const setPreference = vi.fn();
const trackedBuild = { id: "hunter-void-test", definitionHash: "hunter-void-test", kind: "build" as const, name: "Test Void Build", description: "Tracked build", icon: "", context: "Build Advisor · void", trackedInDestiny: false as const, trackedInGuardianNexus: true as const, objectives: [{ objectiveHash: "armor", name: "Required armor", progress: 0, completionValue: 1 as const, percent: 0, complete: false, progressAvailable: true }], percent: 50, updatedAt: "2026-08-02T00:00:00.000Z", acquisitionGuide: { summary: "Missing: Required armor", steps: ["Focus the Exotic armor."], prerequisites: [] } };

vi.mock("../context/GuardianContext", () => ({
  pinsKey: (membershipId: string, characterId: string) => `pins:${membershipId}:${characterId}`,
  useGuardian: () => ({
    session: { authenticated: true, csrfToken: "csrf", guardian: { membershipId: "member-1" } },
    selectedCharacterId: "c1",
    autoRefresh: false,
    preferences: { "guardianRank.tracked": JSON.stringify(["rank-record"]), "collection.tracked": JSON.stringify(["catalyst:catalyst-record"]), "buildAdvisor.trackedBuilds.v1": JSON.stringify([trackedBuild]) },
    setPreference
  })
}));
vi.mock("../services/api/client", () => ({ api: vi.fn(), queuedApi: vi.fn(), mutationHeaders: vi.fn(() => ({})) }));
vi.mock("../services/completionAudio", () => ({ playCompletionChime: vi.fn(), primeCompletionAudio: vi.fn() }));

beforeEach(() => {
  localStorage.setItem("pins:member-1:c1", JSON.stringify(["quest-instance"]));
  vi.mocked(api).mockResolvedValue(envelope());
  vi.mocked(queuedApi).mockResolvedValue({ data: { sharing: true }, freshness: { state: "fresh", observedAt: "now" }, warnings: [], requestId: "share" });
});

afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); vi.useRealTimers(); vi.clearAllMocks(); });

describe("Fireteam tracked items", () => {
  it("keeps recent tagged loot interactive between readiness and the tracked-item segment", async () => {
    vi.mocked(api).mockImplementation(async (path) => {
      if (String(path).startsWith("/api/v1/me/gear")) return gearEnvelope() as never;
      return envelope() as never;
    });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FireteamPage /></QueryClientProvider>);

    const readiness = (await screen.findByRole("heading", { name: "Fireteam readiness" })).closest("section")!;
    const recent = (await screen.findByText("Recent loot")).closest("section")!;
    const tracked = (await screen.findByText("Shared tracked items")).closest("section")!;
    expect(readiness.compareDocumentPosition(recent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(recent.compareDocumentPosition(tracked) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "Recent loot cards to keep" }) as HTMLSelectElement).value).toBe("24");
    fireEvent.change(screen.getByRole("combobox", { name: "Recent loot cards to keep" }), { target: { value: "48" } });
    expect(setPreference).toHaveBeenCalledWith("fireteam.recentLootLimit.v1", "48");

    fireEvent.click(screen.getByRole("button", { name: "Inspect Recent Rifle" }));
    expect((await screen.findByRole("tooltip")).textContent).toContain("Recent Rifle");
    await waitFor(() => expect(vi.mocked(queuedApi)).toHaveBeenCalled());
    vi.mocked(queuedApi).mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Favorite" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Keep" }));
    await waitFor(() => expect(vi.mocked(queuedApi).mock.calls.some(([path]) => path === "/api/v1/me/gear/item-state")).toBe(true));
    const [, init] = vi.mocked(queuedApi).mock.calls.find(([path]) => path === "/api/v1/me/gear/item-state")!;
    expect(JSON.parse(String(init?.body))).toEqual({ itemInstanceId: "loot-1", tag: "keep" });
  });

  it("shows quest-like and Guardian Rank tracking and refreshes the active share with both site lists", async () => {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FireteamPage /></QueryClientProvider>);

    expect(await screen.findByText("Shared tracked items")).toBeTruthy();
    expect(screen.getByText("Weekly order")).toBeTruthy();
    expect(screen.getByText("Order · Vanguard")).toBeTruthy();
    expect(screen.getByText("Rank service")).toBeTruthy();
    expect(screen.getByText("Guardian Rank · Journey · Progress to rank 8")).toBeTruthy();

    await waitFor(() => expect(vi.mocked(queuedApi)).toHaveBeenCalled());
    const [, init] = vi.mocked(queuedApi).mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toMatchObject({
      characterId: "c1",
      sitePinnedQuestIds: ["quest-instance"],
      siteTrackedGuardianRankIds: ["rank-record"],
      siteTrackedBuilds: [expect.objectContaining({ id: "hunter-void-test", kind: "build", percent: 50 })],
      mode: "temporary"
    });
  });

  it("marks confirmed completion events for the objective-complete exit effect", async () => {
    const completed = envelope();
    completed.data.members[0]!.recentlyCompletedItems = [{
      ...completed.data.members[0]!.trackedItems[0]!,
      percent: 100,
      objectives: [{ objectiveHash: "q", name: "Activities", progress: 5, completionValue: 5, percent: 100, complete: true, progressAvailable: true }],
      completedAt: "2026-07-22T12:01:00.000Z"
    }];
    completed.data.members[0]!.trackedItems = completed.data.members[0]!.trackedItems.slice(1);
    vi.mocked(api).mockResolvedValue(completed);

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FireteamPage /></QueryClientProvider>);

    const item = (await screen.findByText("Weekly order")).closest("[data-completion-state]");
    expect(item?.getAttribute("data-completion-state")).toBe("exiting");
    expect(item?.querySelectorAll(`.${styles.sharedQuestCompletionFx} b span`)).toHaveLength(12);
    expect(item?.closest("[data-tracking-event]")?.getAttribute("data-tracking-event")).toBe("completed");
  });

  it("uses the gold entry effect only when a tracked item is newly added", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><FireteamPage /></QueryClientProvider>);

    const initialItem = (await screen.findByText("Weekly order")).closest("[data-tracking-state]");
    expect(initialItem?.getAttribute("data-tracking-state")).toBe("active");

    const updated = envelope();
    updated.data.members[0]!.trackedItems.push({
      ...updated.data.members[0]!.trackedItems[1]!,
      id: "new-record",
      definitionHash: "new-record",
      name: "New rank objective"
    });
    act(() => client.setQueryData(["fireteam", "c1"], updated));

    const enteringItem = (await screen.findByText("New rank objective")).closest("[data-tracking-state]");
    expect(enteringItem?.getAttribute("data-tracking-state")).toBe("entering");
    expect(enteringItem?.closest("[data-tracking-event]")?.getAttribute("data-tracking-event")).toBe("added");
    const existingItem = screen.getByText("Weekly order").closest("[data-tracking-state]");
    expect(enteringItem).not.toBeNull();
    expect(existingItem).not.toBeNull();
    expect(enteringItem!.compareDocumentPosition(existingItem!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(setPreference).toHaveBeenCalledWith("fireteam.trackedOrder", JSON.stringify(["guardian-rank:new-record", "order:quest-instance", "guardian-rank:rank-record"]));
    await act(async () => { vi.advanceTimersByTime(1_400); });
    expect(enteringItem?.getAttribute("data-tracking-state")).toBe("active");
  });

  it("keeps an item that disappeared during refresh visible for the removal animation", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><FireteamPage /></QueryClientProvider>);

    await screen.findByText("Weekly order");
    const updated = envelope();
    updated.data.members[0]!.trackedItems = updated.data.members[0]!.trackedItems.slice(1);
    act(() => client.setQueryData(["fireteam", "c1"], updated));

    await waitFor(() => expect(screen.getByText("Weekly order").closest("[data-tracking-state]")?.getAttribute("data-tracking-state")).toBe("removing"));
    const removingItem = screen.getByText("Weekly order").closest("[data-tracking-state]");
    expect(removingItem?.closest("[data-tracking-event]")?.getAttribute("data-tracking-event")).toBe("removed");
    expect(playCompletionChime).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1_600); });
    expect(screen.queryByText("Weekly order")).toBeNull();
  });

  it("replaces a pending red removal with the green completion state when confirmation arrives", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><FireteamPage /></QueryClientProvider>);

    await screen.findByText("Weekly order");
    const missing = envelope();
    missing.data.members[0]!.trackedItems = missing.data.members[0]!.trackedItems.slice(1);
    act(() => client.setQueryData(["fireteam", "c1"], missing));
    await waitFor(() => expect(screen.getByText("Weekly order").closest("[data-tracking-state]")?.getAttribute("data-tracking-state")).toBe("removing"));

    const completed = envelope();
    const completedItem = completed.data.members[0]!.trackedItems[0]!;
    completed.data.members[0]!.trackedItems = completed.data.members[0]!.trackedItems.slice(1);
    completed.data.members[0]!.recentlyCompletedItems = [{
      ...completedItem,
      percent: 100,
      objectives: completedItem.objectives.map((objective) => ({ ...objective, progress: objective.completionValue, percent: 100, complete: true })),
      completedAt: "2026-07-22T12:01:00.000Z"
    }];
    act(() => client.setQueryData(["fireteam", "c1"], completed));

    await waitFor(() => {
      const items = screen.getAllByText("Weekly order");
      expect(items).toHaveLength(1);
      expect(items[0]!.closest("[data-tracking-state]")?.getAttribute("data-tracking-state")).toBe("exiting");
      expect(items[0]!.closest("[data-tracking-event]")?.getAttribute("data-tracking-event")).toBe("completed");
    });
    expect(playCompletionChime).toHaveBeenCalledTimes(1);
  });

  it("lets confirmed completion override an in-flight manual untrack state", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><FireteamPage /></QueryClientProvider>);
    await screen.findByText("Weekly order");

    fireEvent.click(screen.getByRole("button", { name: "Untrack Weekly order from Fireteam" }));
    expect(screen.getByText("Weekly order").closest("[data-tracking-state]")?.getAttribute("data-tracking-state")).toBe("removing");

    const completed = envelope();
    const completedItem = completed.data.members[0]!.trackedItems[0]!;
    completed.data.members[0]!.trackedItems = completed.data.members[0]!.trackedItems.slice(1);
    completed.data.members[0]!.recentlyCompletedItems = [{
      ...completedItem,
      percent: 100,
      objectives: completedItem.objectives.map((objective) => ({ ...objective, progress: objective.completionValue, percent: 100, complete: true })),
      completedAt: "2026-07-22T12:02:00.000Z"
    }];
    act(() => client.setQueryData(["fireteam", "c1"], completed));

    await waitFor(() => {
      const item = screen.getByText("Weekly order").closest("[data-tracking-state]");
      expect(item?.getAttribute("data-tracking-state")).toBe("exiting");
      expect(item?.closest("[data-tracking-event]")?.getAttribute("data-tracking-event")).toBe("completed");
    });
  });

  it("removes a known completion after the exit and does not replay it after a remount", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const completed = envelope();
    completed.data.members[0]!.recentlyCompletedItems = [{
      ...completed.data.members[0]!.trackedItems[0]!,
      percent: 100,
      objectives: [{ objectiveHash: "q", name: "Activities", progress: 5, completionValue: 5, percent: 100, complete: true, progressAvailable: true }],
      completedAt: "2026-07-22T12:01:00.000Z"
    }];
    completed.data.members[0]!.trackedItems = completed.data.members[0]!.trackedItems.slice(1);
    vi.mocked(api).mockResolvedValue(completed);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(<QueryClientProvider client={client}><FireteamPage /></QueryClientProvider>);

    expect(await screen.findByText("Weekly order")).toBeTruthy();
    expect(playCompletionChime).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(1_600); });
    expect(screen.queryByText("Weekly order")).toBeNull();

    view.unmount();
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FireteamPage /></QueryClientProvider>);
    expect(await screen.findByText("Rank service")).toBeTruthy();
    expect(screen.queryByText("Weekly order")).toBeNull();
  });

  it("untracks a Guardian Nexus pursuit from the self card and syncs the reduced pin list", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FireteamPage /></QueryClientProvider>);
    await screen.findByText("Weekly order");
    await waitFor(() => expect(vi.mocked(queuedApi)).toHaveBeenCalled());
    vi.mocked(queuedApi).mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Untrack Weekly order from Fireteam" }));

    expect(screen.getByText("Weekly order").closest("[data-tracking-state]")?.getAttribute("data-tracking-state")).toBe("removing");
    expect(screen.getByText("Weekly order").closest("[data-tracking-event]")?.getAttribute("data-tracking-event")).toBe("removed");
    await act(async () => { vi.advanceTimersByTime(1_600); });
    await waitFor(() => expect(vi.mocked(queuedApi)).toHaveBeenCalled());
    const [, init] = vi.mocked(queuedApi).mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toMatchObject({
      sitePinnedQuestIds: [],
      siteTrackedGuardianRankIds: ["rank-record"],
      hiddenTrackedItemKeys: []
    });
    expect(localStorage.getItem("pins:member-1:c1")).toBe("[]");
  });

  it("untracks a Guardian Rank objective and hides it while Destiny still tracks it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FireteamPage /></QueryClientProvider>);
    await screen.findByText("Rank service");
    await waitFor(() => expect(vi.mocked(queuedApi)).toHaveBeenCalled());
    vi.mocked(queuedApi).mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Untrack Rank service from Fireteam" }));

    expect(setPreference).toHaveBeenCalledWith("guardianRank.tracked", "[]");
    await act(async () => { vi.advanceTimersByTime(1_600); });
    await waitFor(() => expect(vi.mocked(queuedApi)).toHaveBeenCalled());
    const [, init] = vi.mocked(queuedApi).mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toMatchObject({
      sitePinnedQuestIds: ["quest-instance"],
      siteTrackedGuardianRankIds: [],
      hiddenTrackedItemKeys: ["guardian-rank:rank-record"]
    });
  });

  it("shows catalyst kill progress and removes its prefixed Collection tracking id", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const tracked = envelope();
    tracked.data.members[0]!.trackedItems.push({
      id: "catalyst-record", definitionHash: "catalyst-record", kind: "catalyst", name: "ABC Catalyst", description: "Defeat enemies using ABC.", icon: "", context: "Catalyst · ABC",
      trackedInDestiny: false, trackedInGuardianNexus: true, objectives: [{ objectiveHash: "kills", name: "Kill enemies", progress: 23, completionValue: 50, percent: 46, complete: false, progressAvailable: true }], percent: 46, updatedAt: "now"
    });
    vi.mocked(api).mockResolvedValue(tracked);
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FireteamPage /></QueryClientProvider>);

    await screen.findByText("ABC Catalyst");
    expect(screen.getByText("23 / 50")).toBeTruthy();
    await waitFor(() => expect(vi.mocked(queuedApi)).toHaveBeenCalled());
    vi.mocked(queuedApi).mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Untrack ABC Catalyst from Fireteam" }));

    expect(setPreference).toHaveBeenCalledWith("collection.tracked", "[]");
    await act(async () => { vi.advanceTimersByTime(1_600); });
    await waitFor(() => expect(vi.mocked(queuedApi)).toHaveBeenCalled());
    const [, init] = vi.mocked(queuedApi).mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toMatchObject({ siteTrackedCollectionIds: [] });
  });

  it("shows a tracked Build Advisor checklist and removes it from the private preference", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const tracked = envelope();
    tracked.data.members[0]!.trackedItems.push(trackedBuild);
    vi.mocked(api).mockResolvedValue(tracked);
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FireteamPage /></QueryClientProvider>);

    await screen.findByText("Test Void Build");
    expect(screen.getByText("Focus the Exotic armor.")).toBeTruthy();
    await waitFor(() => expect(vi.mocked(queuedApi)).toHaveBeenCalled());
    vi.mocked(queuedApi).mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Untrack Test Void Build from Fireteam" }));
    expect(setPreference).toHaveBeenCalledWith("buildAdvisor.trackedBuilds.v1", "[]");
    await act(async () => { vi.advanceTimersByTime(1_600); });
    await waitFor(() => expect(vi.mocked(queuedApi)).toHaveBeenCalled());
    const [, init] = vi.mocked(queuedApi).mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toMatchObject({ siteTrackedBuilds: [] });
  });

  it("does not expose tracking controls on another Guardian's card", async () => {
    const mixed = envelope();
    mixed.data.members.push({
      ...mixed.data.members[0]!,
      membershipId: "member-2",
      displayName: "Other Guardian",
      inGameName: "OtherGuardian#5678",
      isSelf: false,
      trackedItems: mixed.data.members[0]!.trackedItems.map((item) => ({ ...item }))
    });
    vi.mocked(api).mockResolvedValue(mixed);

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FireteamPage /></QueryClientProvider>);

    await screen.findByText("OtherGuardian#5678");
    expect(screen.getAllByRole("button", { name: "Untrack Weekly order from Fireteam" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Untrack Rank service from Fireteam" })).toHaveLength(1);
  });

  it("persists a reordered self-card list without changing the Fireteam share payload", async () => {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FireteamPage /></QueryClientProvider>);
    await screen.findByText("Weekly order");
    await waitFor(() => expect(vi.mocked(queuedApi)).toHaveBeenCalled());
    vi.mocked(queuedApi).mockClear();

    const source = screen.getByRole("button", { name: "Reorder Weekly order" });
    const target = screen.getByText("Rank service").closest("[data-tracking-state]")!;
    fireEvent.dragStart(source, { dataTransfer: { effectAllowed: "", setData: vi.fn() } });
    fireEvent.dragOver(target);
    fireEvent.drop(target);

    expect(setPreference).toHaveBeenCalledWith("fireteam.trackedOrder", JSON.stringify(["guardian-rank:rank-record", "order:quest-instance"]));
    expect(queuedApi).not.toHaveBeenCalled();
  });

  it("moves tracked items directly to the top or bottom from controls left of Dismiss", async () => {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FireteamPage /></QueryClientProvider>);
    await screen.findByText("Weekly order");
    await waitFor(() => expect(vi.mocked(queuedApi)).toHaveBeenCalled());
    vi.mocked(queuedApi).mockClear();

    const toTop = screen.getByRole("button", { name: "Move Weekly order to top" }) as HTMLButtonElement;
    const toBottom = screen.getByRole("button", { name: "Move Weekly order to bottom" }) as HTMLButtonElement;
    const dismiss = screen.getByRole("button", { name: "Untrack Weekly order from Fireteam" });
    const actions = dismiss.parentElement!;

    expect([...actions.querySelectorAll("button")].map((button) => button.getAttribute("aria-label"))).toEqual([
      "Move Weekly order to top",
      "Move Weekly order to bottom",
      "Untrack Weekly order from Fireteam"
    ]);
    expect(toTop.disabled).toBe(true);
    expect(toBottom.disabled).toBe(false);

    fireEvent.click(toBottom);
    expect(setPreference).toHaveBeenCalledWith("fireteam.trackedOrder", JSON.stringify(["guardian-rank:rank-record", "order:quest-instance"]));
    await waitFor(() => expect((screen.getByRole("button", { name: "Move Weekly order to bottom" }) as HTMLButtonElement).disabled).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: "Move Weekly order to top" }));
    expect(setPreference).toHaveBeenCalledWith("fireteam.trackedOrder", JSON.stringify(["order:quest-instance", "guardian-rank:rank-record"]));
    expect(queuedApi).not.toHaveBeenCalled();
  });
});

function envelope() {
  const data: FireteamData = {
    sharingEnabled: true,
    sharingMode: "temporary",
    hiddenTrackedItemKeys: [],
    activity: "The Tower",
    members: [{
      membershipId: "member-1",
      displayName: "Guardian",
      inGameName: "Guardian#1234",
      presenceLabel: "Fireteam member",
      onlineState: "online",
      activity: "The Tower",
      activitySource: "shared",
      isSelf: true,
      isLeader: false,
      syncState: "synced",
      sharing: true,
      sharingMode: "temporary",
      trackedItems: [
        {
          id: "quest-instance", definitionHash: "quest-hash", kind: "order", name: "Weekly order", description: "Complete activities.", icon: "", context: "Order · Vanguard",
          trackedInDestiny: false, trackedInGuardianNexus: true, objectives: [{ objectiveHash: "q", name: "Activities", progress: 2, completionValue: 5, percent: 40, complete: false, progressAvailable: true }], percent: 40, updatedAt: "now"
        },
        {
          id: "rank-record", definitionHash: "rank-record", kind: "guardian-rank", name: "Rank service", description: "Earn commendations.", icon: "", context: "Guardian Rank · Journey · Progress to rank 8",
          trackedInDestiny: true, trackedInGuardianNexus: true, objectives: [{ objectiveHash: "r", name: "Commendations", progress: 4, completionValue: 10, percent: 40, complete: false, progressAvailable: true }], percent: 40, updatedAt: "now"
        }
      ],
      quests: [],
      overlaps: [],
      freshness: { state: "fresh", observedAt: "now", ageSeconds: 0 }
    }],
    social: { state: "available", friendsState: "available", clanState: "available", contacts: [] }
  };
  return { data, freshness: { state: "fresh" as const, observedAt: "now" }, warnings: [], requestId: "fireteam" };
}

function gearEnvelope() {
  return {
    data: {
      items: [],
      weapons: [{
        instanceId: "loot-1", itemHash: "2", name: "Recent Rifle", icon: "", itemType: "Auto Rifle", slot: "Energy", damageType: "Arc", rarity: "Legendary", power: 550,
        location: "vault", equipped: false, locked: false, masterworked: false, crafted: false, enhanced: false, perkColumns: [], originTraits: [], rollDataState: "unavailable",
        reviewState: "incomplete-data", reviewReasons: [], duplicateCount: 1, wishlisted: false, firstSeenAt: "2026-08-08T00:00:00.000Z", isNew: false, tag: "favorite"
      }]
    },
    freshness: { state: "fresh" as const, observedAt: "now" }, warnings: [], requestId: "gear"
  };
}
