// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { PowerData } from "@guardian-nexus/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../services/api/client";
import { PowerPage } from "./PowerPage";

vi.mock("../context/GuardianContext", () => ({ useGuardian: () => ({ session: { authenticated: true }, selectedCharacterId: "c1", autoRefresh: false }) }));
vi.mock("../services/api/client", () => ({ api: vi.fn() }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Power page", () => {
  it("shows the account ceiling and identifies the lowest equipment slot", async () => {
    vi.mocked(api).mockResolvedValue(envelope());
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PowerPage /></QueryClientProvider>);

    expect(await screen.findByRole("heading", { name: "Warlock" })).toBeTruthy();
    expect(screen.getAllByText("549").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Leg Armor").length).toBeGreaterThan(0);
    expect(screen.getAllByText("545").length).toBeGreaterThan(0);
    expect(screen.getByText("5 below best slot")).toBeTruthy();
    expect(screen.getByText("Vault best")).toBeTruthy();
  });
});

function envelope() {
  const slot = (kind: any, label: string, power: number, lowest = false) => ({ kind, label, power, deficit: 550 - power, lowest, item: { instanceId: kind, itemHash: kind, name: `${label} item`, icon: "", power, slot: kind, location: "equipped" as const, ownerCharacterId: "c1" }, ...(kind === "legs" ? { vaultBest: { instanceId: "vault-legs", itemHash: "legs", name: "Vault boots", icon: "", power: 544, slot: "legs" as const, location: "vault" as const } } : {}) });
  const data: PowerData = {
    selectedCharacterId: "c1", accountMaximumPower: 549, highestItemPower: 550, vaultHighestItemPower: 550,
    characters: [{ characterId: "c1", className: "Warlock", emblemPath: "", emblemBackgroundPath: "", currentPower: 548, maximumPower: 549, averagePower: 549.38, progressToNextPower: 3, lowestSlotPower: 545, slots: [slot("kinetic", "Kinetic Weapon", 550), slot("energy", "Energy Weapon", 550), slot("power", "Power Weapon", 550), slot("helmet", "Helmet", 550), slot("gauntlets", "Gauntlets", 550), slot("chest", "Chest Armor", 550), slot("legs", "Leg Armor", 545, true), slot("class-item", "Class Item", 550)] }],
    sources: { items: "Destiny2.GetProfile inventories, equipment, and item instances", definitions: "DestinyInventoryItemDefinition manifest data" }
  };
  return { data, freshness: { state: "fresh" as const, observedAt: "2026-07-21T12:00:00Z" }, warnings: [], requestId: "power-test" };
}
