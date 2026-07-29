import type { GuardianNotification, NotificationPreferences } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { notificationDisplayDuration } from "./GuardianFeed";

const preferences: NotificationPreferences = {
  enabledCategories: ["system"],
  globalNotifications: true,
  accountNotifications: true,
  bannerVisible: true,
  autoDismissMs: 12_000,
  reducedMotion: false,
  sound: false,
  lowPriorityInFeed: false,
  frequency: "all"
};

function notification(priority: GuardianNotification["priority"], autoDismissMs?: number): GuardianNotification {
  return {
    id: priority,
    type: "test",
    category: "system",
    scope: "global",
    priority,
    status: "active",
    title: "Test notification",
    createdAt: "2026-07-29T00:00:00.000Z",
    dismissible: true,
    autoDismiss: true,
    autoDismissMs
  };
}

describe("Guardian Feed timing", () => {
  it("uses the user's display duration for routine notifications", () => {
    expect(notificationDisplayDuration(notification("normal"), preferences)).toBe(12_000);
  });

  it("keeps urgent alerts visible longer unless the notification specifies an exact duration", () => {
    expect(notificationDisplayDuration(notification("high"), preferences)).toBe(15_000);
    expect(notificationDisplayDuration(notification("critical"), preferences)).toBe(18_000);
    expect(notificationDisplayDuration(notification("critical", 9_000), preferences)).toBe(9_000);
  });
});
