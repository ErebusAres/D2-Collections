// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { BuildTagInput } from "./BuildTagInput";

describe("BuildTagInput", () => {
  it("keeps pasted hashtags and comma-separated phrases editable while producing tag chips", () => {
    function Harness() {
      const [values, setValues] = useState<string[]>([]);
      return <BuildTagInput label="Tags" values={values} onChange={setValues} placeholder="tags" />;
    }
    render(<Harness />);
    const input = screen.getByPlaceholderText("tags");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "#pve #gm #boss-dps, grenade spam" } });
    expect((input as HTMLInputElement).value).toBe("#pve #gm #boss-dps, grenade spam");
    for (const tag of ["#pve", "#gm", "#boss-dps", "#grenade spam"]) expect(screen.getByRole("button", { name: tag })).toBeTruthy();
  });
});
