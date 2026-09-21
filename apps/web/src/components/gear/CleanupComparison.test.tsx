// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CleanupRecommendation, WeaponItem } from "@guardian-nexus/contracts";
import { availableCleanupPlugs, CleanupComparison } from "./CleanupComparison";
import type { LootItem } from "./RecentLoot";

afterEach(cleanup);
const weapon = { kind: "weapon", instanceId: "candidate", name: "Test weapon", power: 500, location: "vault", perkColumns: [{ socketIndex: 0, kind: "barrel", selectablePlugHashes: ["a", "b"], active: { hash: "a", name: "Equipped barrel" }, options: [{ hash: "a", name: "Equipped barrel" }, { hash: "b", name: "Available barrel" }, { hash: "hypothetical", name: "Not owned" }] }] } as unknown as LootItem & WeaponItem;
const recommendation = { itemId: "candidate", keeperId: "keeper", confidence: 99, reason: "Identical selectable roll; keeping the higher-Power copy.", protections: [] } as unknown as CleanupRecommendation;
describe("cleanup comparison", () => {
  it("shows only actual selectable options, including unequipped attachments", () => {
    expect(availableCleanupPlugs(weapon, 0)).toEqual([{ hash: "a", name: "Equipped barrel", icon: undefined, equipped: true }, { hash: "b", name: "Available barrel", icon: undefined, equipped: false }]);
    expect(availableCleanupPlugs(weapon, 99)).toEqual([]);
  });
  it("compares both copies and explains the recommendation without enabling transfers", () => {
    const onClose = vi.fn();
    render(<CleanupComparison candidate={weapon} keeper={{ ...weapon, instanceId: "keeper", power: 510 }} recommendation={recommendation} sources={[]} onClose={onClose} />);
    expect(screen.getByRole("dialog").textContent).toContain(recommendation.reason);
    expect(screen.getByText("+10")).toBeTruthy();
    expect(screen.getAllByText("Available barrel")).toHaveLength(2);
    expect(screen.queryByText("Not owned")).toBeNull();
    const shortcut = vi.fn(); window.addEventListener("keydown", shortcut);
    fireEvent.keyDown(document, { key: "p" });
    expect(shortcut).not.toHaveBeenCalled();
    window.removeEventListener("keydown", shortcut);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
