// @vitest-environment jsdom
import type { GuardianBuild } from "@guardian-nexus/contracts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { emptyBuildDocument } from "../../modules/builds/builds";
import { BuildDetailSections } from "./BuildDetailSections";

const build: GuardianBuild = {
  ...emptyBuildDocument(),
  title: "Field-tested support",
  tags: ["support"],
  notes: "Keep Radiant active.",
  concepts: [{ name: "Radiant", hash: "1", icon: "https://www.bungie.net/radiant.png" }],
  links: [{ kind: "dim", label: "Open in DIM", url: "https://app.destinyitemmanager.com/example" }],
  subclassConfig: { aspects: [{ name: "Bleak Watcher" }], fragments: [], grenade: { name: "Healing Grenade" } },
  equipment: { weapons: [{ slot: "Energy", name: "No Hesitation", exotic: false }], armor: [{ slot: "Chest", name: "Speaker's Sight", exotic: true }], armorSets: [] },
  statPriorities: [{ stat: "Grenade", priority: 1, target: 200 }],
  armorMods: { helmet: [{ name: "Siphon" }], arms: [], chest: [], legs: [], classItem: [] },
  artifacts: [{ name: "Tablet of Ruin", perks: [{ name: "Volatile Wake" }] }],
  gameplayLoop: [{ text: "Heal the fireteam" }, { text: "Profit" }],
  cosmetics: { ornaments: [], shader: { name: "Photo Finish" } },
  changelog: [{ date: "2026-07-16T00:00:00.000Z", notes: "Initial field test" }],
  id: "build-1",
  slug: "field-tested-support",
  authorMembershipId: "guardian",
  authorDisplayName: "ErebusAres",
  rating: { upvotes: 3, downvotes: 1, total: 4, score: 2, percentPositive: 75 },
  canEdit: false,
  createdAt: "2026-07-16T00:00:00.000Z",
  updatedAt: "2026-07-16T00:00:00.000Z"
};

describe("BuildDetailSections", () => {
  it("renders the requested detail groups using real saved build fields", () => {
    render(<BuildDetailSections build={build} />);
    for (const heading of ["Media & external links", "Notes", "Subclass", "Equipment", "Stat priorities", "Armor mods", "Artifact", "Gameplay loop", "Cosmetics", "Version & changelog"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    }
    expect(screen.getByText("Volatile Wake")).toBeTruthy();
    expect(screen.queryByText("Anti-Barrier Hand Cannon")).toBeNull();
    expect(screen.getByText("Speaker's Sight")).toBeTruthy();
    expect(screen.getByText("Target 200")).toBeTruthy();
    expect(screen.queryByText(/\bMin(?:imum)?\b|\bRange\b/)).toBeNull();
  });
});
