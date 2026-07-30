// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GuardianNotificationsController } from "../../modules/notifications/useGuardianNotifications";
import { NotificationCenter } from "./NotificationCenter";

const controller: GuardianNotificationsController = {
  notifications: [],
  feed: [],
  unreadCount: 0,
  preferences: {
    enabledCategories: ["system"],
    globalNotifications: true,
    accountNotifications: true,
    bannerVisible: true,
    autoDismissMs: 10_000,
    reducedMotion: false,
    sound: false,
    lowPriorityInFeed: false,
    frequency: "all"
  },
  loading: false,
  dismiss: vi.fn(),
  markRead: vi.fn(),
  archive: vi.fn(),
  savePreferences: vi.fn(),
  refresh: vi.fn()
};

afterEach(cleanup);

describe("NotificationCenter", () => {
  it("removes the closed drawer from keyboard navigation", () => {
    render(<MemoryRouter><NotificationCenter controller={controller} /></MemoryRouter>);
    const panel = screen.getByLabelText("Notification center");

    expect(panel.getAttribute("aria-hidden")).toBe("true");
    expect(panel.hasAttribute("inert")).toBe(true);
  });

  it("closes when the user clicks outside the drawer", () => {
    render(<MemoryRouter><NotificationCenter controller={controller} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Open notifications" }));
    const panel = screen.getByLabelText("Notification center");
    expect(panel.getAttribute("aria-hidden")).toBe("false");
    expect(panel.hasAttribute("inert")).toBe(false);
    expect(screen.getByPlaceholderText("Search history")).toBe(document.activeElement);

    fireEvent.pointerDown(document.body);
    expect(screen.getByLabelText("Notification center").getAttribute("aria-hidden")).toBe("true");
  });

  it("closes with Escape and returns focus to the trigger", () => {
    render(<MemoryRouter><NotificationCenter controller={controller} /></MemoryRouter>);
    const trigger = screen.getByRole("button", { name: "Open notifications" });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByLabelText("Notification center").getAttribute("aria-hidden")).toBe("true");
    expect(document.activeElement).toBe(trigger);
  });

  it("toggles the scrolling banner directly from the pullout", () => {
    const savePreferences = vi.fn();
    render(<MemoryRouter><NotificationCenter controller={{ ...controller, preferences: { ...controller.preferences, bannerVisible: false }, savePreferences }} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Open notifications" }));
    fireEvent.click(screen.getByRole("button", { name: "Show banner" }));

    expect(savePreferences).toHaveBeenCalledWith(expect.objectContaining({ bannerVisible: true }));
  });
});
