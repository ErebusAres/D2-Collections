// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManifestMultiEditor } from "./ManifestPicker";

const entries = {
  bleak: { hash: "1", kind: "aspect", name: "Bleak Watcher", icon: "https://www.bungie.net/bleak.png" },
  iceflare: { hash: "2", kind: "aspect", name: "Iceflare Bolts", icon: "https://www.bungie.net/iceflare.png" }
} as const;

afterEach(() => vi.unstubAllGlobals());

describe("ManifestMultiEditor", () => {
  it("keeps subsequent searches open after selecting the first result", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://guardian-nexus.pages.dev");
      const result = url.searchParams.get("q") === "iceflare" ? entries.iceflare : entries.bleak;
      return new Response(JSON.stringify({ data: { available: true, results: [result] } }), { status: 200 });
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
