import { describe, expect, it } from "vitest";
import type { DistortionObservation } from "@guardian-nexus/contracts";
import { calculateDistortionPrediction, calculateDistortionStatistics } from "./notifications";

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
