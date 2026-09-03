// @vitest-environment jsdom

import type { FireteamMember, FireteamTrackedItem } from "@guardian-nexus/contracts";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FireteamRoster, type FireteamRosterProps } from "./FireteamRoster";

afterEach(() => cleanup());

describe("FireteamRoster", () => {
  it("composes every member and grants leader controls only for other Guardians", () => {
    const props = rosterProps();
    render(<FireteamRoster {...props} />);

    expect(screen.getByRole("region", { name: "Fireteam roster" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Current Guardian#0001" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Teammate#0002" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Whisper" }));
    fireEvent.click(screen.getByRole("button", { name: "Kick command" }));

    expect(props.onCopyCommand).toHaveBeenNthCalledWith(
      1,
      "whisper-teammate",
      "/whisper Teammate#0002 "
    );
    expect(props.onCopyCommand).toHaveBeenNthCalledWith(
      2,
      "kick-teammate",
      "/kick Teammate#0002"
    );
  });

  it("routes tracking controls and removal state only to the current Guardian", () => {
    const props = rosterProps();
    const { rerender } = render(<FireteamRoster {...props} />);

    const currentGuardianCard = screen
      .getByRole("heading", { name: "Current Guardian#0001" })
      .closest("article")!;
    const teammateCard = screen
      .getByRole("heading", { name: "Teammate#0002" })
      .closest("article")!;

    fireEvent.click(within(currentGuardianCard).getByRole("button", {
      name: "Move Shared goal to bottom"
    }));
    expect(props.onReorderCurrentGuardianTrackedItem).toHaveBeenCalledWith(
      "quest:shared-goal",
      "quest:second-goal"
    );

    rerender(<FireteamRoster
      {...props}
      currentGuardianUntrackingItemKey="quest:shared-goal"
    />);
    const currentGuardianUntrack = within(currentGuardianCard).getByRole("button", {
      name: "Untrack Shared goal from Fireteam"
    }) as HTMLButtonElement;

    expect(currentGuardianUntrack.disabled).toBe(true);
    expect(within(teammateCard).queryByRole("button", {
      name: "Untrack Shared goal from Fireteam"
    })).toBeNull();
    expect(currentGuardianCard.querySelector('[data-tracking-state="removing"]')).toBeTruthy();
    expect(teammateCard.querySelector('[data-tracking-state="removing"]')).toBeNull();
  });
});

function rosterProps(
  overrides: Partial<FireteamRosterProps> = {}
): FireteamRosterProps {
  return {
    members: [
      fireteamMember("current", "Current Guardian#0001", true),
      fireteamMember("teammate", "Teammate#0002", false)
    ],
    currentGuardianIsLeader: true,
    copiedCommandIdentifier: "",
    onCopyCommand: vi.fn(async () => undefined),
    onUntrackCurrentGuardianItem: vi.fn(),
    currentGuardianTrackedItemOrder: ["quest:shared-goal", "quest:second-goal"],
    onReorderCurrentGuardianTrackedItem: vi.fn(),
    ...overrides
  };
}

function fireteamMember(
  membershipId: string,
  inGameName: string,
  isSelf: boolean
): FireteamMember {
  return {
    membershipId,
    displayName: inGameName,
    inGameName,
    presenceLabel: "Fireteam member",
    onlineState: "online",
    activity: "Orbit",
    activitySource: "shared",
    isSelf,
    isLeader: isSelf,
    syncState: "synced",
    sharing: true,
    sharingMode: "persistent",
    trackedItems: isSelf
      ? [trackedItem("shared-goal", "Shared goal"), trackedItem("second-goal", "Second goal")]
      : [trackedItem("shared-goal", "Shared goal")],
    quests: [],
    overlaps: [],
    freshness: {
      state: "fresh",
      observedAt: "2026-09-03T00:00:00.000Z",
      ageSeconds: 0
    }
  };
}

function trackedItem(id: string, name: string): FireteamTrackedItem {
  return {
    id,
    definitionHash: `definition-${id}`,
    kind: "quest",
    name,
    description: "Complete the objective.",
    icon: "",
    context: "Quest",
    trackedInDestiny: true,
    trackedInGuardianNexus: true,
    objectives: [],
    percent: 0,
    updatedAt: "2026-09-03T00:00:00.000Z"
  };
}
