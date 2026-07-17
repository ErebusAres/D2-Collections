// @vitest-environment jsdom
import type { GuardianBuild } from "@guardian-nexus/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { emptyBuildDocument } from "../../modules/builds/builds";
import { BuildCompactView } from "./BuildCompactView";
import { BuildRichNotes, destinyNoteToken } from "./BuildRichNotes";

function build(): GuardianBuild {
  return {
    ...emptyBuildDocument(),
    title: "Compact Titan",
    tags: ["pve"],
    notes: `Use ${destinyNoteToken({ name: "Radiant", hash: "1", icon: "https://www.bungie.net/radiant.png" })} before damage.`,
    subclassConfig: { aspects: [], fragments: [], super: { name: "Hammer of Sol", icon: "https://www.bungie.net/super.png" } },
    equipment: { weapons: [{ name: "Festival Flight", slot: "Kinetic", selectedPerks: [{ name: "Slice", itemType: "Enhanced Trait" }, { name: "Attrition Orbs", itemType: "Enhanced Trait" }] }], armor: [{ name: "Stoicism", slot: "Titan Mark", exotic: true, traits: [{ name: "Exotic Class Item" }], selectedSpirits: [{ name: "Spirit of the Abeyant", row: 1 }, { name: "Spirit of the Horn", row: 2 }] }], armorSets: [{ name: "Luminopotent · 2 + 4-piece", setName: "Luminopotent", requiredPieces: 4, bonuses: [{ name: "Ionic Overclock", requiredPieces: 2 }, { name: "Shock and Clear", requiredPieces: 4 }] }] },
    armorMods: { helmet: [{ name: "Dynamo", quantity: 2 }], arms: [], chest: [], legs: [], classItem: [] },
    statPriorities: [{ stat: "Grenade", priority: 1, minimum: 70, target: 100 }, { stat: "Melee", priority: 2, minimum: 40, maximum: 80 }],
    gameplayLoop: [{ text: "Cast Barricade" }],
    id: "compact", slug: "compact", authorMembershipId: "1", authorDisplayName: "Guardian", rating: { upvotes: 0, downvotes: 0, total: 0, score: 0 }, canEdit: false,
    createdAt: "2026-07-16T00:00:00.000Z", updatedAt: "2026-07-16T00:00:00.000Z"
  };
}

describe("BuildCompactView", () => {
  afterEach(cleanup);
  it("shows all major build groups as tooltip-backed icons and expands repeated mods", () => {
    render(<BuildCompactView build={build()} />);
    expect(screen.getByRole("heading", { name: "Subclass & abilities" })).toBeTruthy();
    expect(screen.getByLabelText("Titan Mark: Stoicism")).toBeTruthy();
    expect(screen.getAllByText("Inherent perks").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Enhanced Trait").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Slice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Exotic Spirits").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Spirit of the Abeyant").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Titan Mark: Stoicism").querySelector("b")).toBeNull();
    expect(screen.getByLabelText("Spirit row 1: Spirit of the Abeyant").querySelector("b")).toBeNull();
    expect(screen.getAllByLabelText(/Helmet socket .*: Dynamo/)).toHaveLength(2);
    expect(screen.getByLabelText("Grenade, highest priority, Min 70, Target 100")).toBeTruthy();
    expect(screen.getByLabelText("Grenade stat: Grenade")).toBeTruthy();
    expect(screen.getByText("Focus first")).toBeTruthy();
    expect(screen.getByText("Range 40–80")).toBeTruthy();
    expect(screen.queryByText(/priority 2 of/i)).toBeNull();
    expect(screen.getByLabelText("Luminopotent · 2-piece bonus: Ionic Overclock")).toBeTruthy();
    expect(screen.getByLabelText("Luminopotent · 4-piece bonus: Shock and Clear")).toBeTruthy();
    expect(screen.getByLabelText("Luminopotent · 2-piece bonus: Ionic Overclock").querySelector("b")).toBeNull();
    expect(screen.getByLabelText("Luminopotent · 4-piece bonus: Shock and Clear").querySelector("b")).toBeNull();
    expect(screen.queryByText("2+4")).toBeNull();
    expect(screen.getByText("Cast Barricade")).toBeTruthy();
  });

  it("renders an inserted Destiny note token inline with its official icon", () => {
    render(<BuildRichNotes value={build().notes} />);
    expect(screen.getByLabelText("Destiny reference: Radiant")).toBeTruthy();
  });
});
