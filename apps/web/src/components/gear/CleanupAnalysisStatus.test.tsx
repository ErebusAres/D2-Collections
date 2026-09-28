// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CleanupAnalysisStatus } from "./CleanupAnalysisStatus";

const analysis = { coverage: { totalItems: 1200, processedItems: 400, unreadableItems: 2, page: 2, pages: 6, complete: false }, recommendations: [{ itemId: "1" }], insufficient: ["2"], dataIssues: [{ itemId: "2", name: "Unknown Rifle", reasons: ["Weapon stats unavailable"] }] } as any;

afterEach(cleanup);

describe("CleanupAnalysisStatus", () => {
  it("shows real batch progress, recommendation totals, and item-specific data failures", () => {
    render(<CleanupAnalysisStatus analysis={analysis} status="refreshing" />);
    expect(screen.getByText("400 of 1,200 items · batch 2 of 6")).toBeTruthy();
    expect(screen.getByText("33%")).toBeTruthy();
    expect(screen.getByText("1 recommendations found so far")).toBeTruthy();
    expect(screen.getByText("2 unreadable saved records")).toBeTruthy();
    expect(screen.getByText("Unknown Rifle")).toBeTruthy();
    expect(screen.getByText("Weapon stats unavailable")).toBeTruthy();
  });

  it("shows an honest initial loading state before results exist", () => {
    render(<CleanupAnalysisStatus status="refreshing" />);
    expect(screen.getByText("Preparing your gear analysis")).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });

  it("keeps complete saved results visible while a replacement pass starts", () => {
    render(<CleanupAnalysisStatus analysis={{ ...analysis, coverage: { ...analysis.coverage, processedItems: 1200, page: 6, complete: true } } as any} status="refreshing" />);
    expect(screen.getByText("Refreshing your inventory analysis")).toBeTruthy();
    expect(screen.getByText("Showing the previous complete results while the next safe pass starts.")).toBeTruthy();
    expect(screen.getByText("Updating")).toBeTruthy();
  });
});
