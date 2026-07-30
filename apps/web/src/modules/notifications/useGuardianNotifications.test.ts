import type { GuardianNotification } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { notificationStatusAt } from "./useGuardianNotifications";

const notification: GuardianNotification = {
  id: "expiring",
  type: "test",
  category: "system",
  scope: "global",
  priority: "normal",
  status: "active",
  title: "Expiring alert",
  createdAt: "2026-07-30T00:00:00.000Z",
  expiresAt: "2026-07-30T01:00:00.000Z",
  dismissible: true,
  autoDismiss: true
};

describe("notification temporal state", () => {
  it("removes an active alert at its expiration boundary without waiting for a refetch", () => {
    expect(notificationStatusAt(notification, undefined, Date.parse("2026-07-30T00:59:59.999Z"))).toBe("active");
    expect(notificationStatusAt(notification, undefined, Date.parse("2026-07-30T01:00:00.000Z"))).toBe("expired");
  });

  it("preserves explicit user dismissal over temporal state", () => {
    expect(notificationStatusAt(notification, { dismissedAt: "2026-07-30T00:30:00.000Z" }, Date.parse("2026-07-30T00:45:00.000Z"))).toBe("dismissed");
  });
});
