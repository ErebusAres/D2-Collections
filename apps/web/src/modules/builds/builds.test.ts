import type { GuardianBuild } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { buildDiscordSummary, defaultBuildFilters, emptyBuildDocument, filterBuilds, prepareBuildDocument, splitTags } from "./builds";

function build(values: Partial<GuardianBuild>): GuardianBuild {
  return {
    ...emptyBuildDocument(),
    title: "Arc Loop",
    tags: ["add clear"],
    id: "1",
    slug: "arc-loop-1",
    authorMembershipId: "guardian",
    authorDisplayName: "ErebusAres",
    rating: { upvotes: 0, downvotes: 0, total: 0, score: 0 },
    canEdit: false,
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z",
    ...values
  };
}

describe("build catalog filters", () => {
  it("searches equipment and Artifact perk names", () => {
    const entries = [build({ artifacts: [{ name: "Tablet of Ruin", perks: [{ name: "Volatile Wake" }] }] })];
    expect(filterBuilds(entries, { ...defaultBuildFilters, search: "volatile" })).toHaveLength(1);
    expect(filterBuilds(entries, { ...defaultBuildFilters, search: "radiant" })).toHaveLength(0);
  });

  it("searches selected rolls, set bonuses, and armor mods", () => {
    const entries = [build({
      equipment: {
        weapons: [{ slot: "Energy", name: "No Hesitation", selectedPerks: [{ name: "Physic" }] }],
        armor: [],
        armorSets: [{ name: "Luminopotent · 2 + 4-piece", bonuses: [{ name: "Shock and Clear", description: "Creates Ionic Traces." }] }]
      },
      armorMods: { helmet: [{ name: "Dynamo", quantity: 2 }], arms: [], chest: [], legs: [], classItem: [] }
    })];
    expect(filterBuilds(entries, { ...defaultBuildFilters, search: "physic" })).toHaveLength(1);
    expect(filterBuilds(entries, { ...defaultBuildFilters, search: "ionic traces" })).toHaveLength(1);
    expect(filterBuilds(entries, { ...defaultBuildFilters, search: "dynamo" })).toHaveLength(1);
  });

  it("sorts rated builds above unrated builds", () => {
    const entries = [build({ id: "one" }), build({ id: "two", rating: { upvotes: 8, downvotes: 2, total: 10, score: 6, percentPositive: 80 } })];
    expect(filterBuilds(entries, { ...defaultBuildFilters, sort: "top" })[0]?.id).toBe("two");
  });

  it("normalizes comma, hashtag, and line-delimited tags", () => {
    expect(splitTags("GM, support\n#boss DPS, GM")).toEqual(["GM", "support", "boss DPS"]);
    expect(splitTags("#pve #gm #boss-dps")).toEqual(["pve", "gm", "boss-dps"]);
    expect(splitTags("grenade spam, support, solo")).toEqual(["grenade spam", "support", "solo"]);
  });

  it("converts a build into a Discord-friendly sharing summary", () => {
    const summary = buildDiscordSummary(build({ equipment: { weapons: [{ slot: "Energy", name: "No Hesitation" }], armor: [], armorSets: [] }, concepts: [{ name: "Radiant" }], championCounters: [{ name: "Anti-Barrier Hand Cannon" }], gameplayLoop: [{ text: "Keep the fireteam alive" }] }));
    expect(summary).toContain("**Arc Loop**");
    expect(summary).toContain("Energy: No Hesitation");
    expect(summary).toContain("Anti-Barrier Hand Cannon");
    expect(summary).toContain("Radiant");
    expect(summary).toContain("1. Keep the fireteam alive");
  });

  it("converts legacy cumulative set data into two explicit saved bonuses", () => {
    const value = emptyBuildDocument();
    value.title = "Set conversion";
    value.tags = ["pve"];
    value.equipment.armorSets = [{
      name: "Luminopotent · 2 + 4-piece",
      setName: "Luminopotent",
      requiredPieces: 4,
      bonuses: [{ name: "Ionic Overclock", requiredPieces: 2 }, { name: "Shock and Clear", requiredPieces: 4 }]
    }];
    expect(prepareBuildDocument(value).equipment.armorSets).toEqual([
      expect.objectContaining({ name: "Ionic Overclock", requiredPieces: 2 }),
      expect.objectContaining({ name: "Shock and Clear", requiredPieces: 4 })
    ]);
  });
});
