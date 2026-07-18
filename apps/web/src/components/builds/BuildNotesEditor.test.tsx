// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyBuildDocument } from "../../modules/builds/builds";
import { BuildNotesEditor } from "./BuildNotesEditor";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("BuildNotesEditor", () => {
  it("searches categorized build definitions and inserts official icon tokens", async () => {
    const entries = {
      weapon: [catalogEntry("2", "Fatebringer", "Hand Cannon", "weapon", "weapon")],
      weaponPerk: [catalogEntry("3", "Incandescent", "Weapon Trait", "perk", "weaponPerk")],
      armor: [catalogEntry("4", "Celestial Nighthawk", "Helmet", "armor", "armor")],
      exoticSpirit: [catalogEntry("5", "Spirit of the Gyrfalcon", "Exotic Intrinsic", "spirit", "exoticSpirit")]
    };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://guardian-nexus.pages.dev");
      if (url.pathname.endsWith("build-catalog.json")) return new Response(JSON.stringify({ version: "test", generatedAt: "2026-07-16T00:00:00.000Z", groups: Object.fromEntries(Object.keys(entries).map((kind) => [kind, `build-catalog-${kind}.json`])), statDefinitions: {} }), { status: 200 });
      const kind = Object.keys(entries).find((value) => url.pathname.endsWith(`build-catalog-${value}.json`)) as keyof typeof entries;
      const extra = kind === "exoticSpirit" ? { spiritHashesByClass: { hunter: { row1: [], row2: ["5"] } } } : {};
      return new Response(JSON.stringify({ version: "test", kind, entries: entries[kind] || [], ...extra }), { status: 200 });
    }));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
    const onChange = vi.fn();
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BuildNotesEditor value={emptyBuildDocument()} onChange={onChange} /></QueryClientProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Emoji and Destiny icons" }));
    fireEvent.change(screen.getByPlaceholderText("Search destiny symbols…"), { target: { value: "Solar" } });
    fireEvent.click(screen.getByRole("button", { name: "Insert :solar: Solar symbol" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ notes: ":solar:" }));
    for (const [category, entry] of [["Weapons", entries.weapon[0]!], ["Weapon perks", entries.weaponPerk[0]!], ["Armor", entries.armor[0]!], ["Spirits", entries.exoticSpirit[0]!] ] as const) {
      fireEvent.click(screen.getByRole("button", { name: category }));
      const search = screen.getByPlaceholderText(new RegExp(`Search ${category.toLocaleLowerCase()}`));
      fireEvent.change(search, { target: { value: entry.name } });
      fireEvent.click(await screen.findByRole("button", { name: new RegExp(entry.name) }));
    }

    for (const entry of Object.values(entries).flat()) expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ notes: expect.stringContaining(encodeURIComponent(entry.name)) }));
  });

  it("wraps selected text with safe forum formatting", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
    const onChange = vi.fn();
    const value = { ...emptyBuildDocument(), notes: "damage phase" };
    render(<QueryClientProvider client={new QueryClient()}><BuildNotesEditor value={value} onChange={onChange} /></QueryClientProvider>);
    const field = screen.getByRole("textbox", { name: /Main build notes/ }) as HTMLTextAreaElement;
    field.setSelectionRange(0, 6);
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ notes: "**damage** phase" }));
  });
});

function catalogEntry(hash: string, name: string, itemType: string, icon: string, kind: "weapon" | "weaponPerk" | "armor" | "exoticSpirit") {
  return { hash, kind, name, icon: `https://www.bungie.net/${icon}.png`, description: "", itemType, rarity: "", slot: "", damageType: name === "Solar" ? "Solar" : "", exotic: name === "Celestial Nighthawk", ...(["armor", "exoticSpirit"].includes(kind) ? { classType: "hunter" as const } : {}) };
}
