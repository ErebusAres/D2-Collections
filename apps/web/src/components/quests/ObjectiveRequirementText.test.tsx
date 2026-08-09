// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ObjectiveRequirementText } from "./ObjectiveRequirementText";

describe("ObjectiveRequirementText", () => {
  it("replaces Bungie weapon and combat markers with compact accessible icons", () => {
    const { container } = render(<ObjectiveRequirementText value="[Auto Rifle][Headshot] final blows" />);
    expect(screen.getByRole("img", { name: "Auto Rifle" }).getAttribute("title")).toBe("Auto Rifle");
    expect(screen.getByRole("img", { name: "Headshot" }).getAttribute("title")).toBe("Headshot");
    expect(container.textContent).toBe(" final blows");
  });

  it("uses official Bungie element art and preserves unknown markers as text", () => {
    const { container } = render(<ObjectiveRequirementText value="[Arc] [Unknown Requirement] final blows" />);
    expect(screen.getByRole("img", { name: "Arc" }).getAttribute("src")).toContain("bungie.net");
    expect(container.textContent).toContain("[Unknown Requirement]");
  });
});
