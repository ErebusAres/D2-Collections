// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyReadinessDraft } from "../../modules/fireteam/readiness";
import { FireteamReadinessPanel, SharedReadiness } from "./FireteamReadinessPanel";

afterEach(cleanup);

describe("FireteamReadinessPanel", () => {
  it("keeps readiness private until the player opts in and routes recruitment to Bungie", () => {
    const onChange = vi.fn();
    render(<FireteamReadinessPanel draft={emptyReadinessDraft()} builds={[]} sharing={false} onChange={onChange} />);
    const finder = screen.getByRole("link", { name: /Open Bungie Fireteam Finder/i });
    expect(finder.getAttribute("href")).toBe("https://www.bungie.net/7/en/fireteamfinder?activityType=0&platform=0");
    fireEvent.click(screen.getByRole("checkbox", { name: /Share this readiness summary/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
  });

  it("renders only the scoped, player-confirmed summary", () => {
    render(<SharedReadiness summary={{ schemaVersion: 1, activityName: "Grandmaster Nightfall", role: "support", state: "ready", prerequisites: [{ id: "access", label: "Activity access unlocked", state: "ready" }], source: "player-confirmed", updatedAt: "2026-08-01T20:00:00.000Z" }} />);
    expect(screen.getByLabelText("Readiness for Grandmaster Nightfall")).toBeTruthy();
    expect(screen.getByText("Activity access unlocked")).toBeTruthy();
  });
});
