// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FireteamRecentLootSection,
  type FireteamRecentLootSectionProps
} from "./FireteamRecentLootSection";

afterEach(() => cleanup());

describe("FireteamRecentLootSection", () => {
  it("shows the persistent tracking explanation and restores the section", () => {
    const props = recentLootProps({ isVisible: false });
    renderRecentLootSection(props);

    expect(screen.getByText("Recent Loot hidden")).toBeTruthy();
    expect(screen.getByText("Loot tracking stays active while this section is hidden.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show Recent Loot" }));
    expect(props.onShow).toHaveBeenCalledOnce();
  });

  it("composes the visible timeline and forwards its hide action", () => {
    const props = recentLootProps({
      isVisible: true,
      firstObservationEstablished: true
    });
    renderRecentLootSection(props);

    expect(screen.getByText("Recent loot")).toBeTruthy();
    expect(screen.getByText("Private baseline established. New observed changes will appear here.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(props.onHide).toHaveBeenCalledOnce();
  });

  it("surfaces gear-action errors independently of timeline visibility", () => {
    renderRecentLootSection(recentLootProps({
      isVisible: false,
      actionError: new Error("Unable to move the selected item.")
    }));

    expect(screen.getByText("Unable to move the selected item.")).toBeTruthy();
  });
});

function renderRecentLootSection(props: FireteamRecentLootSectionProps): void {
  render(
    <MemoryRouter>
      <FireteamRecentLootSection {...props} />
    </MemoryRouter>
  );
}

function recentLootProps(
  overrides: Partial<FireteamRecentLootSectionProps> = {}
): FireteamRecentLootSectionProps {
  return {
    isVisible: true,
    recentLootEvents: [],
    isLoading: false,
    onRetry: vi.fn(),
    onTagItem: vi.fn(),
    onPullItem: vi.fn(),
    onChangeWeaponSocket: vi.fn(),
    actionsPending: false,
    onHide: vi.fn(),
    onShow: vi.fn(),
    watchers: {
      farmingMode: false,
      highestPowerLock: false,
      tier5FitLock: false,
      duplicateFitJunk: false
    },
    onWatcherChange: vi.fn(),
    watcherUpdatePending: false,
    ...overrides
  };
}
