// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { emptyBuildDocument } from "../../modules/builds/builds";
import { BuildEditorConfiguration } from "./BuildEditorConfiguration";

afterEach(cleanup);

describe("BuildEditorConfiguration", () => {
  it("uses manifest search controls without URL or per-field note inputs", () => {
    render(<QueryClientProvider client={new QueryClient()}><BuildEditorConfiguration value={emptyBuildDocument()} onChange={() => undefined} /></QueryClientProvider>);
    expect(screen.getByPlaceholderText("Search super definitions…")).toBeTruthy();
    expect(screen.getByText("Included automatically for Prismatic")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Search transcendence definitions…")).toBeNull();
    expect(screen.getByPlaceholderText("Search official weapon definitions…")).toBeTruthy();
    expect(screen.getByPlaceholderText("Search the seven current Artifact definitions…")).toBeTruthy();
    expect(screen.getByPlaceholderText("Search armor set bonuses…")).toBeTruthy();
    expect(screen.getByText("Drag the six fixed Destiny stats into priority order. Priority 1 is highest; priority 6 is lowest.")).toBeTruthy();
    expect(screen.queryByText(/Icon URL/i)).toBeNull();
    expect(screen.queryByText(/Selection notes|Why these choices|Fashion notes/i)).toBeNull();
  });

  it("matches Destiny's two equipped Aspect sockets", () => {
    const value = emptyBuildDocument();
    value.subclassConfig.aspects = [{ name: "Bleak Watcher" }, { name: "Iceflare Bolts" }];
    render(<QueryClientProvider client={new QueryClient()}><BuildEditorConfiguration value={value} onChange={() => undefined} /></QueryClientProvider>);
    expect(screen.getByText("Aspects complete · maximum 2")).toBeTruthy();
  });

  it("does not show Transcendence for a non-Prismatic subclass", () => {
    const value = emptyBuildDocument();
    value.subclass = "solar";
    value.subclassConfig.transcendence = { name: "Transcendence" };
    render(<QueryClientProvider client={new QueryClient()}><BuildEditorConfiguration value={value} onChange={() => undefined} /></QueryClientProvider>);
    expect(screen.queryByText("Included automatically for Prismatic")).toBeNull();
    expect(screen.queryByPlaceholderText("Search transcendence definitions…")).toBeNull();
  });
});
