import type { GuardianNotification, NotificationPreferences } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { isRankUpNotification, notificationDisplayDuration, notificationVersion, shouldRotateFeed } from "./GuardianFeed";

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

function notification(priority: GuardianNotification["priority"], autoDismissMs?: number, autoDismiss = true): GuardianNotification {
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
    autoDismiss,
    autoDismissMs
  };
}

describe("Guardian Feed timing", () => {
  it("rotates persistent alerts without removing them from the feed", () => {
    const persistent = notification("high", undefined, false);
    expect(shouldRotateFeed(persistent, false, 2)).toBe(true);
    expect(shouldRotateFeed(persistent, true, 2)).toBe(false);
    expect(shouldRotateFeed(persistent, false, 1)).toBe(false);
  });

  it("advances a single auto-dismiss alert so it cannot linger indefinitely", () => {
    expect(shouldRotateFeed(notification("normal"), false, 1)).toBe(true);
  });

  it("uses the user's display duration for routine notifications", () => {
    expect(notificationDisplayDuration(notification("normal"), preferences)).toBe(12_000);
  });

  it("keeps urgent alerts visible longer unless the notification specifies an exact duration", () => {
    expect(notificationDisplayDuration(notification("high"), preferences)).toBe(15_000);
    expect(notificationDisplayDuration(notification("critical"), preferences)).toBe(18_000);
    expect(notificationDisplayDuration(notification("critical", 9_000), preferences)).toBe(9_000);
  });

  it("treats a materially updated notification as a new session presentation", () => {
    const entry = notification("normal");
    expect(notificationVersion(entry)).toBe("normal:2026-07-29T00:00:00.000Z");
    expect(notificationVersion({ ...entry, updatedAt: "2026-07-30T00:00:00.000Z" })).toBe("normal:2026-07-30T00:00:00.000Z");
  });

  it("recognizes rank-up fanfare records", () => {
    expect(isRankUpNotification({ ...notification("high"), type: "guardian-rank-up" })).toBe(true);
    expect(isRankUpNotification({ ...notification("high"), type: "other", metadata: { fanfare: "rank-up" } })).toBe(true);
    expect(isRankUpNotification(notification("normal"))).toBe(false);
  });
});
