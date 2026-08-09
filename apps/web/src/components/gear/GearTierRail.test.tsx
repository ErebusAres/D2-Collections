// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GearTierRail, normalizeGearTier } from "./GearTierRail";

afterEach(cleanup);

describe("GearTierRail", () => {
  it("accepts only Bungie's real 1-5 gear tiers", () => {
    expect([-1, 0, 1, 2, 3, 4, 5, 6, 2.8].map(normalizeGearTier)).toEqual([0, 0, 1, 2, 3, 4, 5, 0, 2]);
  });

  it("renders five Gear-style diamonds with only the real tier active", () => {
    const { container } = render(<GearTierRail tier={3} kind="Weapon" />);
    const rail = screen.getByLabelText("Weapon tier 3");
    expect(rail.querySelectorAll("span")).toHaveLength(5);
    expect(container.querySelectorAll("[class*='on']")).toHaveLength(3);
  });

  it("renders no tier marker when Bungie supplies no applicable tier", () => {
    const { container } = render(<GearTierRail tier={0} kind="Armor" />);
    expect(container.childElementCount).toBe(0);
  });
});
