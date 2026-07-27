// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { emptyBuildDocument } from "./builds";
import { readAdvisorBuildImport, removeAdvisorBuildImport, storeAdvisorBuildImport } from "./advisorBuildImport";

describe("Advisor Builder handoff", () => {
  it("stores a private draft that the existing Builder can read and remove", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
    const document = { ...emptyBuildDocument(), title: "Advisor Build", tags: ["Build Advisor"] };
    const token = storeAdvisorBuildImport({ sourceName: "Build Advisor · Advisor Build", document });
    const imported = readAdvisorBuildImport(token);
    expect(imported?.sourceName).toBe("Build Advisor · Advisor Build");
    expect(imported?.document.title).toBe("Advisor Build");
    expect(imported?.document.status).toBe("draft");
    expect(imported?.document.visibility).toBe("private");
    removeAdvisorBuildImport(token);
    expect(readAdvisorBuildImport(token)).toBeUndefined();
  });
});
