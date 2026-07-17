import type { ExoticCollectionEntry } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { collectionClassScope, groupCollectionEntries, scopeCollectionEntries } from "./collectionGroups";

const entry = (name: string, kind: "weapon" | "armor", className?: "Hunter" | "Titan" | "Warlock") => ({ name, kind, className }) as ExoticCollectionEntry;
const catalog = [
  entry("Shared weapon", "weapon"),
  entry("Hunter helm", "armor", "Hunter"),
  entry("Titan helm", "armor", "Titan"),
  entry("Warlock helm", "armor", "Warlock")
];

describe("Collection class grouping", () => {
  it("maps the selected Guardian class to the initial filter scope", () => {
    expect(collectionClassScope("Hunter")).toBe("hunter");
    expect(collectionClassScope("Unknown")).toBe("all");
  });

  it("keeps shared weapons and only the selected class armor", () => {
    const scoped = scopeCollectionEntries(catalog, "warlock");
    expect(scoped.map((item) => item.name)).toEqual(["Shared weapon", "Warlock helm"]);
    expect(groupCollectionEntries(scoped, "warlock").map((group) => group.title)).toEqual(["Exotic Weapons", "Warlock Exotic Armor"]);
  });

  it("splits the all view into weapons and one armor section per class", () => {
    expect(groupCollectionEntries(scopeCollectionEntries(catalog, "all"), "all").map((group) => [group.title, group.entries.length])).toEqual([
      ["Exotic Weapons", 1],
      ["Hunter Exotic Armor", 1],
      ["Titan Exotic Armor", 1],
      ["Warlock Exotic Armor", 1]
    ]);
  });
});
