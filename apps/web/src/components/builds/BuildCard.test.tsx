// @vitest-environment jsdom
import type { GuardianBuild } from "@guardian-nexus/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyBuildDocument } from "../../modules/builds/builds";
import { BuildCard } from "./BuildCard";

vi.mock("./BuildIcon", () => ({ ClassIcon: () => null, SubclassIcon: () => null }));
vi.mock("./BuildRating", () => ({ BuildRating: () => null }));

afterEach(cleanup);

describe("BuildCard equipment summary", () => {
  it("shows the selected Exotic weapon art in the Weapons field", () => {
    const build = makeBuild([{ name: "Sunshot", slot: "Energy", exotic: true, icon: "https://www.bungie.net/sunshot.png" }]);
    render(<MemoryRouter><BuildCard build={build} onRatingChange={() => undefined} /></MemoryRouter>);

    const weapons = screen.getByText("Weapons").closest("div");
    expect(weapons?.querySelector("img")?.getAttribute("src")).toBe("https://www.bungie.net/sunshot.png");
    expect(weapons?.querySelector("svg")).toBeNull();
  });

  it("keeps the generic weapon glyph when no Exotic weapon is selected", () => {
    const build = makeBuild([{ name: "Fatebringer", slot: "Kinetic", exotic: false }]);
    render(<MemoryRouter><BuildCard build={build} onRatingChange={() => undefined} /></MemoryRouter>);

    const weapons = screen.getByText("Weapons").closest("div");
    expect(weapons?.querySelector("img")).toBeNull();
    expect(weapons?.querySelector("svg")).not.toBeNull();
  });

  it("recognizes Exotic weapon art in older saved builds by rarity", () => {
    const build = makeBuild([{ name: "Graviton Lance", slot: "Energy", rarity: "Exotic", icon: "https://www.bungie.net/graviton.png" }]);
    render(<MemoryRouter><BuildCard build={build} onRatingChange={() => undefined} /></MemoryRouter>);

    expect(screen.getByText("Weapons").closest("div")?.querySelector("img")?.getAttribute("src")).toBe("https://www.bungie.net/graviton.png");
  });
});

function makeBuild(weapons: GuardianBuild["equipment"]["weapons"]): GuardianBuild {
  return {
    ...emptyBuildDocument(),
    id: "build-1",
    slug: "build-1",
    title: "Test build",
    authorMembershipId: "guardian",
    authorDisplayName: "Guardian",
    equipment: { weapons, armor: [], armorSets: [] },
    rating: { upvotes: 0, downvotes: 0, total: 0, score: 0 },
    canEdit: false,
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
  };
}
