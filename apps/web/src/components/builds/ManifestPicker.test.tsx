// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManifestMultiEditor } from "./ManifestPicker";

const entries = {
  bleak: catalogEntry("1", "Bleak Watcher", "https://www.bungie.net/bleak.png"),
  iceflare: catalogEntry("2", "Iceflare Bolts", "https://www.bungie.net/iceflare.png")
} as const;

afterEach(() => vi.unstubAllGlobals());

describe("ManifestMultiEditor", () => {
  it("keeps subsequent searches open after selecting the first result", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://guardian-nexus.pages.dev");
      if (url.pathname.endsWith("build-catalog.json")) return new Response(JSON.stringify({ version: "test", generatedAt: "2026-07-16T00:00:00.000Z", groups: { aspect: "build-catalog-aspect.json" }, statDefinitions: {} }), { status: 200 });
      return new Response(JSON.stringify({ version: "test", kind: "aspect", entries: Object.values(entries) }), { status: 200 });
    }));
    const values: { name: string; hash?: string; icon?: string }[] = [];
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <ManifestMultiEditor kind="aspect" label="Selected aspects" addLabel="Aspects" placeholder="Search official aspects…" values={values} max={2} onChange={(next) => {
          values.splice(0, values.length, ...next);
          rerender(<QueryClientProvider client={queryClient}><ManifestMultiEditor kind="aspect" label="Selected aspects" addLabel="Aspects" placeholder="Search official aspects…" values={values} max={2} onChange={() => undefined} /></QueryClientProvider>);
        }} />
      </QueryClientProvider>
    );

    const search = screen.getByPlaceholderText("Search official aspects…");
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "bleak" } });
    fireEvent.click(await screen.findByRole("button", { name: /Bleak Watcher/ }));
    fireEvent.change(search, { target: { value: "iceflare" } });

    expect(await screen.findByRole("button", { name: /Iceflare Bolts/ })).toBeTruthy();
  });
});

function catalogEntry(hash: string, name: string, icon: string) {
  return { hash, kind: "aspect", name, icon, description: `${name} description`, itemType: "Aspect", rarity: "", slot: "", damageType: "", exotic: false };
}
