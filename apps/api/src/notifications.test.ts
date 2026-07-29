import { describe, expect, it } from "vitest";
import type { DistortionObservation } from "@guardian-nexus/contracts";
import type { StoredXurSnapshot } from "./xurSnapshot";
import { calculateDistortionPrediction, calculateDistortionStatistics, communityDistortionAt, xurHappeningCard, xurShipmentNotification } from "./notifications";

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

  it("calculates observed counts and intervals without inventing missing fields", () => {
    const history = [observation("Moon", 3), observation("Europa", 2), observation("Moon", 1)];
    const result = calculateDistortionStatistics(history);
    expect(result.observations).toBe(3);
    expect(result.mostCommonDestination).toBe("Moon");
    expect(result.averageIntervalMinutes).toBe(60);
    expect(result.destinationCounts.find((entry) => entry.destination === "Moon")?.count).toBe(2);
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
