import type { XurOffer } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { storefrontSections } from "./XurPage";

function offer(name: string, category: XurOffer["category"], overrides: Partial<XurOffer> = {}): XurOffer {
  return {
    saleIndex: name,
    itemHash: name,
    name,
    description: "",
    icon: "",
    rarity: category.startsWith("exotic") ? "Exotic" : "Legendary",
    itemType: "Vendor item",
    slot: "Miscellaneous",
    category,
    quantity: 1,
    costs: [],
    stats: [],
    perks: [],
    ...overrides
  };
}

describe("storefrontSections", () => {
  it("uses the storefront category order and excludes material offers", () => {
    const sections = storefrontSections([
      offer("Enhancement Core", "other", { itemType: "Material" }),
      offer("Stoicism", "exotic-class-item", { className: "Titan" }),
      offer("Cerberus+1", "exotic-weapon"),
      offer("Prometheus Catalyst", "exotic-catalyst"),
      offer("An Insurmountable Skullfort", "exotic-armor", { className: "Titan" }),
      offer("Code Duello", "legendary-weapon")
    ]);

    expect(sections.map((section) => section.title)).toEqual([
      "Exotic armor",
      "Exotic class items",
      "Exotic weapons",
      "Exotic catalysts",
      "Strange Gear offers"
    ]);
    expect(sections.flatMap((section) => section.items.map((item) => item.name))).not.toContain("Enhancement Core");
  });

  it("keeps Xenology with the Exotic weapon storefront", () => {
    const sections = storefrontSections([offer("Xenology", "other", { rarity: "Exotic", itemType: "Quest Step" })]);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.title).toBe("Exotic weapons");
    expect(sections[0]?.items[0]?.name).toBe("Xenology");
  });
});
