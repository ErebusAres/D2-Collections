// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GearTagBadge, GearTagFilter, GearTagPicker } from "./GearTagPicker";

describe("GearTagPicker", () => {
  it("uses an icon menu instead of a native tag select", () => {
    const onChange = vi.fn();
    const { container } = render(<GearTagPicker value="keep" onChange={onChange} />);

    expect(container.querySelector("select")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Junk" }));
    expect(onChange).toHaveBeenCalledWith("junk");
  });

  it("renders a visible item-art badge for a saved tag", () => {
    render(<GearTagBadge tag="favorite" />);
    expect(screen.getByLabelText("Favorite tag")).toBeTruthy();
  });
});

describe("GearTagFilter", () => {
  it("offers the same icon menu for filtering the Gear page", () => {
    const onChange = vi.fn();
    const { container } = render(<GearTagFilter value="all" onChange={onChange} />);

    expect(container.querySelector("select")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "All tags" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Infuse" }));
    expect(onChange).toHaveBeenCalledWith("infuse");
  });
});
