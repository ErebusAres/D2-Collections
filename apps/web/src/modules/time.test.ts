import { describe, expect, it } from "vitest";
import { formatUtcAndLocalTime } from "./time";

describe("formatUtcAndLocalTime", () => {
  it("shows the authoritative UTC reset beside the viewer's local time", () => {
    const label = formatUtcAndLocalTime("2026-07-29T19:00:00.000Z", "America/Chicago");
    expect(label).toContain("7:00 PM UTC");
    expect(label).toContain("2:00 PM CDT");
    expect(label).toContain(" / ");
  });

  it("does not repeat the value for viewers in UTC", () => {
    expect(formatUtcAndLocalTime("2026-07-29T19:00:00.000Z", "UTC")).toBe("7:00 PM UTC");
  });
});
