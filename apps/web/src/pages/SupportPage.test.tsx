// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupportPage } from "./SupportPage";

vi.mock("../services/api/client", () => ({ getClientReliabilityDiagnostics: vi.fn(() => undefined), api: vi.fn(async () => ({ data: {
  reportVersion: 1,
  timestamp: "2026-08-07T00:00:00Z",
  guardianNexus: { build: "0.1.0", commit: "abc" },
  session: { valid: true },
  tests: [{ id: "memberships", name: "Bungie memberships", status: "pass", durationMs: 12, explanation: "Returned one membership." }],
  profileTests: [],
  applicationBootstrap: { succeeded: true },
  diagnosis: { code: "BUNGIE_PROFILE_VALID", summary: "The profile is valid.", nextSteps: ["Review later stages."] }
}, freshness: {}, warnings: [], requestId: "r" })) }));

describe("SupportPage", () => {
  afterEach(cleanup);
  it("runs without Guardian context and renders the stage-level diagnosis", async () => {
    render(<SupportPage />);
    fireEvent.click(screen.getByRole("button", { name: "Run Diagnostics" }));
    await waitFor(() => expect(screen.getByText("The profile is valid.")).toBeTruthy());
    expect(screen.getByText("Bungie memberships")).toBeTruthy();
    expect(screen.getByText(/12 ms/)).toBeTruthy();
  });

  it("requires explicit confirmation before clearing a broken sign-in", () => {
    render(<SupportPage />);
    fireEvent.click(screen.getByRole("button", { name: "Cannot sign out?" }));
    expect(screen.getByText("Clear Guardian Nexus sign-in on every browser?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm clear & reconnect" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });
});
