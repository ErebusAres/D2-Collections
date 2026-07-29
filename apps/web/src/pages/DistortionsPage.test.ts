import { describe, expect, it } from "vitest";
import { formatDistortionCountdown } from "./DistortionsPage";

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
