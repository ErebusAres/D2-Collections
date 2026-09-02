// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FireteamSharingHeader,
  type FireteamSharingHeaderProps
} from "./FireteamSharingHeader";

afterEach(() => cleanup());

describe("FireteamSharingHeader", () => {
  it("shows freshness without sharing controls before Fireteam data loads", () => {
    render(<FireteamSharingHeader {...headerProps()} />);

    expect(screen.getByRole("heading", { name: "Fireteam" })).toBeTruthy();
    expect(screen.getByText("Awaiting sync")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers temporary and persistent sharing when sharing is disabled", () => {
    const props = headerProps({ sharingEnabled: false });
    render(<FireteamSharingHeader {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Share 15 minutes" }));
    fireEvent.click(screen.getByRole("button", { name: "Always share" }));

    expect(props.onShareTemporarily).toHaveBeenCalledOnce();
    expect(props.onSharePersistently).toHaveBeenCalledOnce();
    expect(props.onStopSharing).not.toHaveBeenCalled();
  });

  it("offers automatic conversion and stop controls for temporary sharing", () => {
    const props = headerProps({
      sharingEnabled: true,
      sharingMode: "temporary"
    });
    render(<FireteamSharingHeader {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Make automatic" }));
    fireEvent.click(screen.getByRole("button", { name: "Stop sharing" }));

    expect(props.onSharePersistently).toHaveBeenCalledOnce();
    expect(props.onStopSharing).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Share 15 minutes" })).toBeNull();
  });
});

function headerProps(
  overrides: Partial<FireteamSharingHeaderProps> = {}
): FireteamSharingHeaderProps {
  return {
    sharingUpdatePending: false,
    stopSharingPending: false,
    onShareTemporarily: vi.fn(),
    onSharePersistently: vi.fn(),
    onStopSharing: vi.fn(),
    ...overrides
  };
}
