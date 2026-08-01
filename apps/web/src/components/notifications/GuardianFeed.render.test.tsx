// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GuardianNotification } from "@guardian-nexus/contracts";
import type { GuardianNotificationsController } from "../../modules/notifications/useGuardianNotifications";
import { GuardianFeed } from "./GuardianFeed";

vi.mock("../../services/completionAudio", () => ({ playCompletionChime: vi.fn() }));

const first = notification("first", "First alert");
const second = notification("second", "Second alert");

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Guardian Feed session handoff", () => {
  it("renders one banner at a time and hands off when display time expires", async () => {
    render(<MemoryRouter><GuardianFeed controller={controller([first, second])} /></MemoryRouter>);
    expect(screen.getAllByRole("region")).toHaveLength(1);
    expect(screen.getByText("First alert")).toBeTruthy();

    await act(() => vi.advanceTimersByTimeAsync(8_000));
    expect(screen.getAllByRole("region")).toHaveLength(1);
    expect(screen.queryByText("First alert")).toBeNull();
    expect(screen.getByText("Second alert")).toBeTruthy();

    await act(() => vi.advanceTimersByTimeAsync(8_000));
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("does not replay an auto-dismissed alert after the component remounts in the same session", async () => {
    const view = render(<MemoryRouter><GuardianFeed controller={controller([first])} /></MemoryRouter>);
    await act(() => vi.advanceTimersByTimeAsync(8_000));
    expect(screen.queryByRole("region")).toBeNull();
    view.unmount();

    render(<MemoryRouter><GuardianFeed controller={controller([first])} /></MemoryRouter>);
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("applies the configured entrance to the banner without mounting a page atmosphere", () => {
    const view = render(<MemoryRouter><GuardianFeed controller={controller([notification("distortion", "The sky is changing", "distortion")])} /></MemoryRouter>);
    expect(screen.getByRole("region").getAttribute("data-guardian-animation")).toBe("distortion");
    expect(view.container.querySelector("[data-notification-atmosphere]")).toBeNull();

    view.rerender(<MemoryRouter><GuardianFeed controller={controller([notification("iron-banner", "Iron Banner unfurls", "iron-banner")])} /></MemoryRouter>);
    expect(screen.getByRole("region").getAttribute("data-guardian-animation")).toBe("ironBanner");
    expect(view.container.querySelector("[data-notification-atmosphere]")).toBeNull();
  });

  it("uses distinct fanfare for Xûr and progression milestones", () => {
    const view = render(<MemoryRouter><GuardianFeed controller={controller([{ ...notification("xur", "Xûr has arrived", "exotic"), type: "xur-arrived" }])} /></MemoryRouter>);
    expect(screen.getByRole("region").getAttribute("data-guardian-animation")).toBe("xurArrival");

    view.rerender(<MemoryRouter><GuardianFeed controller={controller([{ ...notification("rank", "Guardian Rank 8 reached", "completion"), type: "guardian-rank-up" }])} /></MemoryRouter>);
    expect(screen.getByRole("region").getAttribute("data-guardian-animation")).toBe("guardianRank");
  });

  it("keeps a persistent notification static after its one-shot entrance", async () => {
    const persistent = { ...notification("persistent", "Persistent world event", "distortion"), autoDismiss: false, autoDismissMs: undefined };
    const view = render(<MemoryRouter><GuardianFeed controller={controller([persistent])} /></MemoryRouter>);
    const banner = screen.getByRole("region", { name: /Persistent world event/ });
    expect(banner.getAttribute("data-guardian-animation")).toBe("distortion");
    expect(view.container.querySelector("[data-notification-atmosphere]")).toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(60_000));

    expect(screen.getByRole("region", { name: /Persistent world event/ })).toBe(banner);
    expect(view.container.querySelector("[data-notification-atmosphere]")).toBeNull();
  });
});

function notification(id: string, title: string, category: GuardianNotification["category"] = "system"): GuardianNotification {
  return {
    id,
    type: "test",
    category,
    scope: "global",
    priority: "normal",
    status: "active",
    title,
    createdAt: "2026-07-30T00:00:00.000Z",
    dismissible: true,
    autoDismiss: true,
    autoDismissMs: 8_000
  };
}

function controller(feed: GuardianNotification[]): GuardianNotificationsController {
  return {
    notifications: feed,
    feed,
    unreadCount: feed.length,
    preferences: {
      enabledCategories: ["system"],
      globalNotifications: true,
      accountNotifications: true,
      bannerVisible: true,
      autoDismissMs: 8_000,
      reducedMotion: false,
      sound: false,
      lowPriorityInFeed: true,
      frequency: "all"
    },
    loading: false,
    dismiss: vi.fn(),
    restore: vi.fn(),
    markRead: vi.fn(),
    archive: vi.fn(),
    savePreferences: vi.fn(),
    refresh: vi.fn()
  };
}
