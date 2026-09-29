// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CleanupApprovalControl } from "./CleanupApprovalControl";

afterEach(cleanup);

describe("CleanupApprovalControl", () => {
  it("explains why protected candidates cannot be approved", () => {
    render(<CleanupApprovalControl actionable={false} tagged={false} busy={false} stale={false} protections={["Locked", "Saved build"]} onApprove={vi.fn()} />);
    expect(screen.getByText("Approval unavailable")).toBeTruthy();
    expect(screen.getByText("Locked, Saved build")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
  });

  it("uses a direct approval action for eligible candidates", () => {
    const onApprove = vi.fn();
    render(<CleanupApprovalControl actionable tagged={false} busy={false} stale={false} protections={[]} onApprove={onApprove} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve for cleanup" }));
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it("shows the resulting tag state instead of a dead checkbox", () => {
    render(<CleanupApprovalControl actionable tagged busy={false} stale={false} protections={[]} onApprove={vi.fn()} />);
    expect(screen.getByText("Approved for cleanup")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
  });
});
