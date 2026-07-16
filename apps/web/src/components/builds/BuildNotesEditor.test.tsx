// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyBuildDocument } from "../../modules/builds/builds";
import { BuildNotesEditor } from "./BuildNotesEditor";

afterEach(() => vi.unstubAllGlobals());

describe("BuildNotesEditor", () => {
  it("searches manifest-backed traits and inserts their official icon token into notes", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://guardian-nexus.pages.dev");
      if (url.pathname.endsWith("build-catalog.json")) return new Response(JSON.stringify({ version: "test", generatedAt: "2026-07-16T00:00:00.000Z", groups: { icon: "build-catalog-icon.json" }, statDefinitions: {} }), { status: 200 });
      return new Response(JSON.stringify({ version: "test", kind: "icon", entries: [{ hash: "123", kind: "icon", name: "Puppeteer's Control", icon: "https://www.bungie.net/trait.png", description: "Improves Drengr's Lash.", itemType: "Intrinsic", rarity: "", slot: "", damageType: "", exotic: false }] }), { status: 200 });
    }));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
    const onChange = vi.fn();
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BuildNotesEditor value={emptyBuildDocument()} onChange={onChange} /></QueryClientProvider>);

    const search = screen.getByPlaceholderText(/Search traits, perks/);
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "Puppeteer" } });
    fireEvent.click(await screen.findByRole("button", { name: /Puppeteer's Control/ }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ notes: expect.stringContaining("Puppeteer's%20Control") }));
  });
});
