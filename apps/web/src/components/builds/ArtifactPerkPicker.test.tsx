// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArtifactPerkPicker } from "./ArtifactPerkPicker";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ArtifactPerkPicker", () => {
  it("shows seven slots and filters choices by each slot's maximum tier", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.startsWith("/data/build-catalog.json")
        ? { version: "test", generatedAt: "now", groups: { artifactPerk: "artifact-perks.json" }, statDefinitions: {} }
        : {
          version: "test",
          kind: "artifactPerk",
          entries: [1, 2, 3].map((tier) => ({ hash: String(tier), name: `Tier ${tier}`, description: `Tier ${tier} perk`, icon: `/tier-${tier}.png`, itemType: "Artifact Perk", rarity: "", slot: "", damageType: "", kind: "artifactPerk", exotic: false })),
          artifactPerkPools: { "100": { tiers: { "1": ["1"], "2": ["2"], "3": ["3"] }, slots: { "1": 2, "2": 3, "3": 2 } } }
        };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
    }));
    const onChange = vi.fn();
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ArtifactPerkPicker artifactHash="100" artifactName="Test Artifact" values={[]} onChange={onChange} /></QueryClientProvider>);

    expect(screen.getByLabelText("Seven equipped Artifact perk slots").querySelectorAll("button")).toHaveLength(7);
    expect(await screen.findByRole("button", { name: /Tier 1 Tier 1 perk/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Tier 2 Tier 2 perk/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /6 Tier 3 or lower Empty slot/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Tier 3 Tier 3 perk/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ hash: "3", artifactTier: 3, artifactSlot: 6 })]));
  });
});
