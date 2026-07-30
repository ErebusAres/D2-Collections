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

  it("renders the environmental treatment configured for the active category", () => {
    const view = render(<MemoryRouter><GuardianFeed controller={controller([notification("distortion", "The sky is changing", "distortion")])} /></MemoryRouter>);
    expect(view.container.querySelector('[data-notification-atmosphere="distortion"]')).toBeTruthy();

    view.rerender(<MemoryRouter><GuardianFeed controller={controller([notification("iron-banner", "Iron Banner unfurls", "iron-banner")])} /></MemoryRouter>);
    expect(view.container.querySelector('[data-notification-atmosphere="ironBanner"]')).toBeTruthy();
  });

  it("removes the large environmental fanfare after one minute but leaves the banner visible", async () => {
    const persistent = { ...notification("persistent", "Persistent world event", "distortion"), autoDismiss: false, autoDismissMs: undefined };
    const view = render(<MemoryRouter><GuardianFeed controller={controller([persistent])} /></MemoryRouter>);
    expect(view.container.querySelector('[data-notification-atmosphere="distortion"]')).toBeTruthy();

    await act(() => vi.advanceTimersByTimeAsync(60_000));

    expect(view.container.querySelector("[data-notification-atmosphere]")).toBeNull();
    expect(screen.getByRole("region", { name: /Persistent world event/ })).toBeTruthy();
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
