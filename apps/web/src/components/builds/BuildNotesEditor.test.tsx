// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyBuildDocument } from "../../modules/builds/builds";
import { BuildNotesEditor } from "./BuildNotesEditor";

afterEach(() => vi.unstubAllGlobals());

describe("BuildNotesEditor", () => {
  it("searches elements, weapons, perks, and armor and inserts their official icon tokens", async () => {
    const entries = [
      catalogEntry("1", "Solar", "Element / Damage Type", "solar"),
      catalogEntry("2", "Fatebringer", "Hand Cannon", "weapon"),
      catalogEntry("3", "Incandescent", "Weapon Trait", "perk"),
      catalogEntry("4", "Celestial Nighthawk", "Helmet", "armor")
    ];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://guardian-nexus.pages.dev");
      if (url.pathname.endsWith("build-catalog.json")) return new Response(JSON.stringify({ version: "test", generatedAt: "2026-07-16T00:00:00.000Z", groups: { noteIcon: "build-catalog-note-icon.json" }, statDefinitions: {} }), { status: 200 });
      return new Response(JSON.stringify({ version: "test", kind: "noteIcon", entries }), { status: 200 });
    }));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
    const onChange = vi.fn();
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BuildNotesEditor value={emptyBuildDocument()} onChange={onChange} /></QueryClientProvider>);

    const search = screen.getByPlaceholderText(/Search elements, weapons/);
    fireEvent.focus(search);
    for (const entry of entries) {
      fireEvent.change(search, { target: { value: entry.name } });
      fireEvent.click(await screen.findByRole("button", { name: new RegExp(entry.name) }));
    }

    for (const entry of entries) expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ notes: expect.stringContaining(encodeURIComponent(entry.name)) }));
  });
});

function catalogEntry(hash: string, name: string, itemType: string, icon: string) {
  return { hash, kind: "noteIcon", name, icon: `https://www.bungie.net/${icon}.png`, description: "", itemType, rarity: "", slot: "", damageType: name === "Solar" ? "Solar" : "", exotic: name === "Celestial Nighthawk" };
}
