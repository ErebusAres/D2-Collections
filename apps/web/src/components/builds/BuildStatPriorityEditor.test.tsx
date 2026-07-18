// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultBuildStatPriorities } from "../../modules/builds/buildStats";
import { BuildStatPriorityEditor } from "./BuildStatPriorityEditor";

describe("BuildStatPriorityEditor", () => {
  afterEach(cleanup);
  it("always presents the six fixed Destiny stats and renumbers them after a move", () => {
    const onChange = vi.fn();
    render(<BuildStatPriorityEditor values={[]} onChange={onChange} />);

    for (const stat of ["Grenade", "Super", "Class", "Weapons", "Melee", "Health"]) {
      expect(screen.getByText(stat)).toBeTruthy();
    }

    fireEvent.click(screen.getByRole("button", { name: "Move Grenade down" }));
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ stat: "Super", priority: 1 }),
      expect.objectContaining({ stat: "Grenade", priority: 2 })
    ]));
  });

  it("retains thresholds while normalizing priorities to one through six", () => {
    const values = defaultBuildStatPriorities();
    values[2] = { ...values[2]!, target: 200, minimum: 100 };
    const onChange = vi.fn();
    render(<BuildStatPriorityEditor values={values} onChange={onChange} />);

    const targetInputs = screen.getAllByText("target").map((label) => label.parentElement?.querySelector("input"));
    expect((targetInputs[2] as HTMLInputElement | undefined)?.value).toBe("200");
  });
});
