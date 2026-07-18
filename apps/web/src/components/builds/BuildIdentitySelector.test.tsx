// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BuildDocument } from "@guardian-nexus/contracts";
import { emptyBuildDocument } from "../../modules/builds/builds";
import { BuildIdentitySelector } from "./BuildIdentitySelector";

afterEach(() => vi.unstubAllGlobals());

describe("BuildIdentitySelector", () => {
  it("automatically adds the class-specific official Transcendence icon to Prismatic builds", async () => {
    const groups = { class: "class.json", subclass: "subclass.json", transcendence: "transcendence.json" };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), "https://guardian-nexus.pages.dev").pathname;
      if (path.endsWith("build-catalog.json")) return response({ version: "test", generatedAt: "now", groups, statDefinitions: {} });
      if (path.endsWith("class.json")) return response({ version: "test", kind: "class", entries: [entry("1", "Hunter", "class", "https://www.bungie.net/hunter.png")] });
      if (path.endsWith("subclass.json")) return response({ version: "test", kind: "subclass", entries: [{ ...entry("2", "Prismatic Hunter", "subclass", "https://www.bungie.net/prismatic.png"), subclass: "prismatic" }] });
      return response({ version: "test", kind: "transcendence", entries: [{ ...entry("1190101211", "Transcendence", "transcendence", "https://www.bungie.net/transcendence.png"), subclass: "prismatic" }] });
    }));

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Harness /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByTestId("transcendence-icon").textContent).toBe("https://www.bungie.net/transcendence.png"));
  });
});

function Harness() {
  const [value, setValue] = useState<BuildDocument>(emptyBuildDocument());
  return <><BuildIdentitySelector value={value} onChange={setValue} /><output data-testid="transcendence-icon">{value.subclassConfig.transcendence?.icon}</output></>;
}

function entry(hash: string, name: string, kind: "class" | "subclass" | "transcendence", icon: string) {
  return { hash, name, kind, icon, description: "", itemType: "", rarity: "", slot: "", damageType: "", exotic: false, classType: "hunter" as const };
}

function response(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}
