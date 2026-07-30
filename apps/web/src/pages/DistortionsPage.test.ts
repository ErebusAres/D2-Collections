import { describe, expect, it } from "vitest";
import {
  DISTORTION_DESTINATION_ROTATION,
  canonicalDistortionDestination,
  formatDistortionCountdown,
  rotateDistortionDestinations
} from "./DistortionsPage";

describe("Distortion countdown", () => {
  it("uses the server change time while accepting a live local clock", () => {
    const target = "2026-07-29T19:00:00.000Z";
    expect(formatDistortionCountdown(target, Date.parse("2026-07-29T18:58:54.000Z"))).toBe("1m 06s");
    expect(formatDistortionCountdown(target, Date.parse("2026-07-29T18:58:55.000Z"))).toBe("1m 05s");
  });

  it("stops at zero until the refreshed server target arrives", () => {
    expect(formatDistortionCountdown("2026-07-29T19:00:00.000Z", Date.parse("2026-07-29T19:00:01.000Z"))).toBe("0m 00s");
  });
});


describe("Distortion destination rotation", () => {
  it("keeps the fixed canonical cycle", () => {
    expect(DISTORTION_DESTINATION_ROTATION).toEqual([
      "EDZ",
      "Dreaming City",
      "Savathûn's Throne World",
      "Moon",
      "Europa",
      "Nessus",
      "Cosmodrome"
    ]);
  });

  it("moves the current destination to the far left and wraps the cycle", () => {
    expect(rotateDistortionDestinations("Moon")).toEqual([
      "Moon",
      "Europa",
      "Nessus",
      "Cosmodrome",
      "EDZ",
      "Dreaming City",
      "Savathûn's Throne World"
    ]);
  });

  it("normalizes destination aliases returned by providers", () => {
    expect(canonicalDistortionDestination("European Dead Zone")).toBe("EDZ");
    expect(canonicalDistortionDestination("Savathun's Throne World")).toBe("Savathûn's Throne World");
    expect(canonicalDistortionDestination("The Moon")).toBe("Moon");
  });

  it("uses the canonical order without falsely marking an unknown destination", () => {
    expect(canonicalDistortionDestination("Unknown field")).toBeUndefined();
    expect(rotateDistortionDestinations("Unknown field")).toEqual([...DISTORTION_DESTINATION_ROTATION]);
  });
});
