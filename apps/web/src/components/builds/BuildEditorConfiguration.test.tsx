// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { emptyBuildDocument } from "../../modules/builds/builds";
import { BuildEditorConfiguration } from "./BuildEditorConfiguration";

describe("BuildEditorConfiguration", () => {
  it("uses manifest search controls without URL or per-field note inputs", () => {
    render(<QueryClientProvider client={new QueryClient()}><BuildEditorConfiguration value={emptyBuildDocument()} onChange={() => undefined} /></QueryClientProvider>);
    expect(screen.getByPlaceholderText("Search super definitions…")).toBeTruthy();
    expect(screen.getByPlaceholderText("Search official weapon definitions…")).toBeTruthy();
    expect(screen.getByPlaceholderText("Search official Artifact definitions…")).toBeTruthy();
    expect(screen.queryByText(/Icon URL/i)).toBeNull();
    expect(screen.queryByText(/Selection notes|Why these choices|Fashion notes/i)).toBeNull();
  });
});
