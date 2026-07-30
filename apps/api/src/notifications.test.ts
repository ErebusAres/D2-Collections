import { describe, expect, it, vi } from "vitest";
import type { DistortionObservation } from "@guardian-nexus/contracts";
import type { StoredXurSnapshot } from "./xurSnapshot";
import type { Env } from "./types";
import { calculateDistortionPrediction, calculateDistortionStatistics, communityDistortionAt, materializeGeneratedNotifications, xurHappeningCard, xurShipmentNotification } from "./notifications";

function observation(destination: string, hour: number): DistortionObservation {
  const start = new Date(Date.UTC(2026, 6, 1, hour)).toISOString();
  return {
    id: `${destination}:${hour}`,
    destination,
    observedStartAt: start,
    observedEndAt: new Date(Date.parse(start) + 60 * 60_000).toISOString(),
    firstDetectedAt: start,
    lastConfirmedAt: start,
    source: "test fixture",
    confidence: "observed",
    complete: true
  };
}

describe("Distortion evidence handling", () => {
  it("resolves the community-confirmed hourly destination from the verified anchor", () => {
    expect(communityDistortionAt(new Date("2026-06-12T19:30:00.000Z"))).toMatchObject({
      destination: "Europa",
      observedStartAt: "2026-06-12T19:00:00.000Z",
      source: "Community-confirmed rotation",
      confidence: "observed"
    });
    expect(communityDistortionAt(new Date("2026-06-12T20:01:00.000Z")).destination).toBe("Nessus");
    expect(communityDistortionAt(new Date("2026-06-13T02:01:00.000Z")).destination).toBe("Europa");
  });

  it("does not predict a destination from a small sample", () => {
    const history = [observation("Europa", 1), observation("Moon", 2)];
    const prediction = calculateDistortionPrediction(history);
    expect(prediction).toMatchObject({
      state: "insufficient-data",
      sampleSize: 2
    });
    expect(prediction.expectedDestination).toBeUndefined();
  });

  it("confirms the next destination after four accurate complete loops", () => {
    const rotation = ["Cosmodrome", "EDZ", "Dreaming City", "Savathun's Throne World", "Moon", "Europa", "Nessus"];
    const history = Array.from({ length: 28 }, (_, index) => observation(rotation[index % rotation.length], index)).reverse();
    const prediction = calculateDistortionPrediction(history);
    expect(prediction).toMatchObject({
      state: "available",
      expectedDestination: "Cosmodrome",
      confidencePercent: 100,
      recentAccuracyPercent: 100,
      sampleSize: 28
    });
    expect(prediction.explanation).toContain("Four complete seven-destination loops");
  });

  it("calculates observed counts and intervals without inventing missing fields", () => {
    const history = [observation("Moon", 3), observation("Europa", 2), observation("Moon", 1)];
    const result = calculateDistortionStatistics(history);
    expect(result.observations).toBe(3);
    expect(result.mostCommonDestination).toBe("Moon");
    expect(result.averageIntervalMinutes).toBe(60);
    expect(result.destinationCounts.find((entry) => entry.destination === "Moon")?.count).toBe(2);
  });
});

describe("generated notification persistence", () => {
  it("keeps the feed available when D1 cannot materialize an occurrence", async () => {
    const bind = vi.fn(() => ({}));
    const env = {
      DB: {
        prepare: vi.fn(() => ({ bind })),
        batch: vi.fn().mockRejectedValue(new Error("UNIQUE constraint failed"))
      }
    } as unknown as Env;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(materializeGeneratedNotifications(env, [{
      id: "daily-reset:2026-07-30T19:00:00.000Z",
      eventKey: "daily-reset",
      type: "daily-reset",
      category: "system",
      scope: "global",
      priority: "low",
      status: "active",
      title: "Daily reset upcoming",
      createdAt: "2026-07-29T19:00:00.000Z",
      expiresAt: "2026-07-30T19:00:00.000Z",
      dismissible: true,
      autoDismiss: true
    }])).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith(
      "notification_materialization_failed",
      expect.objectContaining({ notificationIds: ["daily-reset:2026-07-30T19:00:00.000Z"] })
    );
    consoleError.mockRestore();
  });
});

describe("Xûr notification state", () => {
  const shipment = {
    capturedAt: "2026-07-18T17:05:00.000Z",
    offers: [{ itemHash: "1", name: "Test offer" }]
  } as StoredXurSnapshot;

  it("shows a purchasable shipment only during Xûr's visit", () => {
    const now = new Date("2026-07-18T20:00:00.000Z");
    expect(xurHappeningCard(shipment, now)).toMatchObject({
      state: "live",
      title: "Xûr’s current shipment",
      status: "1 storefront offer"
    });
    expect(xurShipmentNotification(shipment, now)).toMatchObject({
      title: "Xûr shipment available",
      expiresAt: "2026-07-21T19:00:00.000Z"
    });
  });

  it("labels retained inventory as the previous shipment after Xûr leaves", () => {
    const now = new Date("2026-07-22T20:00:00.000Z");
    expect(xurHappeningCard(shipment, now)).toMatchObject({
      state: "inactive",
      title: "Xûr’s previous shipment",
      status: "1 archived offer"
    });
    expect(xurShipmentNotification(shipment, now)).toBeUndefined();
  });
});
