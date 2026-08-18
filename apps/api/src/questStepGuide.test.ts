import { describe, expect, it } from "vitest";
import { questStepGuide } from "./questStepGuide";

describe("questStepGuide", () => {
  it("turns a simple weapon objective into useful completion advice", () => {
    const guide = questStepGuide({ questName: "Field Test", stepName: "Calibration", description: "Defeat combatants with Auto Rifles.", objectives: [{ objectiveHash: "1", name: "Auto Rifle final blows", progress: 20, completionValue: 500, complete: false, percent: 4 }] });
    expect(guide).toMatchObject({ coverage: "objective-specific" });
    expect(guide?.steps.join(" ")).toContain("Auto Rifle final blows");
    expect(guide?.warnings.join(" ")).toContain("Assists");
  });

  it("does not invent a walkthrough for an unrecognized puzzle or secret", () => {
    expect(questStepGuide({ questName: "Hidden Path", stepName: "The Lock", description: "Uncover what lies beyond.", objectives: [] })).toBeUndefined();
  });
});
