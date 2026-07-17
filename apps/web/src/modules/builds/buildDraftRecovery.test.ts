import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyBuildDocument } from "./builds";
import { BUILD_RECOVERY_MAX_AGE_MS, buildRecoveryKey, readBuildRecovery, writeBuildRecovery } from "./buildDraftRecovery";

describe("build draft recovery", () => {
  beforeEach(() => { vi.stubGlobal("localStorage", new MapStorage()); });
  it("round-trips a membership-scoped recovery draft", () => {
    writeBuildRecovery("42", "new", { ...emptyBuildDocument(), title: "Recovered" }, "2026-07-16T00:00:00.000Z");
    expect(readBuildRecovery("42", "new", Date.parse("2026-07-17T00:00:00.000Z"))?.document.title).toBe("Recovered");
    expect(localStorage.getItem(buildRecoveryKey("42", "new"))).toBeTruthy();
  });
  it("deletes expired recovery data", () => {
    writeBuildRecovery("42", "build", emptyBuildDocument(), "2026-01-01T00:00:00.000Z");
    expect(readBuildRecovery("42", "build", Date.parse("2026-01-01T00:00:00.000Z") + BUILD_RECOVERY_MAX_AGE_MS + 1)).toBeUndefined();
  });
});

class MapStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
