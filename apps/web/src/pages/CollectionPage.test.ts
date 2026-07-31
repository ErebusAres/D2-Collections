import type { CatalystState, CollectionCatalyst, ExoticCollectionEntry } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { catalystCollectionItems, filterCatalystCollectionItems } from "./CollectionPage";

function weapon(name: string, state: CatalystState, overrides: Partial<ExoticCollectionEntry> = {}, catalysts?: CollectionCatalyst[]): ExoticCollectionEntry {
  return {
    itemHash: name,
    name,
    description: "",
    icon: `/${name}.png`,
    kind: "weapon",
    slot: "Energy Weapons",
    itemType: "Trace Rifle",
    source: "Quest",
    owned: state !== "missing",
    catalyst: state,
    catalysts,
    xurSelling: false,
    guide: {
      itemHash: name,
      acquisition: "Quest",
      steps: [],
      prerequisites: [],
      confidence: "verified",
      sources: []
    },
    ...overrides
  };
}

describe("catalyst collection", () => {
  it("shows each catalyst record and excludes weapons without catalysts", () => {
    const items = catalystCollectionItems([
      weapon("Multi", "obtained", {}, [
        { recordHash: "one", name: "First Catalyst", description: "First", icon: "/one.png", state: "complete" },
        { recordHash: "two", name: "Second Catalyst", description: "Second", icon: "/two.png", state: "obtained" }
      ]),
      weapon("No Catalyst", "unavailable"),
      weapon("Legacy", "missing")
    ]);

    expect(items.map((item) => [item.name, item.state])).toEqual([
      ["First Catalyst", "complete"],
      ["Second Catalyst", "obtained"],
      ["Legacy Catalyst", "missing"]
    ]);
  });

  it("filters by status, slot, type, and weapon or catalyst search text", () => {
    const items = catalystCollectionItems([
      weapon("Coldheart", "obtained", { slot: "Energy Weapons", itemType: "Trace Rifle" }),
      weapon("Thunderlord", "complete", { slot: "Power Weapons", itemType: "Machine Gun" }),
      weapon("Riskrunner", "missing", { slot: "Energy Weapons", itemType: "Submachine Gun" })
    ]);

    expect(filterCatalystCollectionItems(items, { query: "thunder", state: "complete", slot: "Power Weapons", itemType: "Machine Gun", sort: "alpha" }).map((item) => item.weapon.name)).toEqual(["Thunderlord"]);
    expect(filterCatalystCollectionItems(items, { query: "", state: "all", slot: "all", itemType: "all", sort: "status" }).map((item) => item.state)).toEqual(["obtained", "missing", "complete"]);
  });
});
