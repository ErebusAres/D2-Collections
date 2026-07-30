import { describe, expect, it } from "vitest";
import destinationCss from "../styles/destination-atmospheres.css?raw";

describe("Fireteam destination theme boundaries", () => {
  it("keeps destination identity on rails, frames, and tracked-item borders", () => {
    expect(destinationCss).toContain("width: clamp(16px, 2.4vw, 38px)");
    expect(destinationCss).toContain("[data-location-theme]::before");
    expect(destinationCss).toContain("[data-location-theme] [data-tracking-state]");
  });

  it("does not create a page-wide destination scene or tint", () => {
    expect(destinationCss).not.toContain("--destination-scene");
    expect(destinationCss).not.toContain("--destination-card:");
    expect(destinationCss).not.toMatch(/background:\s*var\(--destination-scene/);
    expect(destinationCss).not.toMatch(/inset:\s*118px\s+0\s+0/);
  });
});
