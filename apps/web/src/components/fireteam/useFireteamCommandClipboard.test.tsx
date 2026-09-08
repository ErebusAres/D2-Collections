// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode, type ReactNode } from "react";
import {
  FIRETEAM_COMMAND_COPIED_MS,
  useFireteamCommandClipboard
} from "./useFireteamCommandClipboard";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: undefined
  });
});

describe("useFireteamCommandClipboard", () => {
  it("does nothing when clipboard access is unsupported", async () => {
    setClipboard(undefined);
    const { result } = renderHook(() => useFireteamCommandClipboard());

    await act(() => result.current.copyCommand("join", "/join Guardian#1234"));

    expect(result.current.copiedCommandIdentifier).toBe("");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not show a copied state when the clipboard write is rejected", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("permission denied"));
    setClipboard({ writeText });
    const { result } = renderHook(() => useFireteamCommandClipboard());

    await act(() => result.current.copyCommand("join", "/join Guardian#1234"));

    expect(writeText).toHaveBeenCalledWith("/join Guardian#1234");
    expect(result.current.copiedCommandIdentifier).toBe("");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("shows a successful command copy for the complete acknowledgement window", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    const { result } = renderHook(() => useFireteamCommandClipboard());

    await act(() => result.current.copyCommand("join", "/join Guardian#1234"));
    expect(result.current.copiedCommandIdentifier).toBe("join");

    act(() => vi.advanceTimersByTime(FIRETEAM_COMMAND_COPIED_MS - 1));
    expect(result.current.copiedCommandIdentifier).toBe("join");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.copiedCommandIdentifier).toBe("");
  });

  it("lets the newest copy own the identifier and full timer window", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    const { result } = renderHook(() => useFireteamCommandClipboard());

    await act(() => result.current.copyCommand("join", "/join Guardian#1234"));
    act(() => vi.advanceTimersByTime(600));
    await act(() => result.current.copyCommand("invite", "/invite Guardian#1234"));

    expect(result.current.copiedCommandIdentifier).toBe("invite");
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(FIRETEAM_COMMAND_COPIED_MS - 1));
    expect(result.current.copiedCommandIdentifier).toBe("invite");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.copiedCommandIdentifier).toBe("");
  });

  it("clears its pending timer when the owning component unmounts", async () => {
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    const { result, unmount } = renderHook(() => useFireteamCommandClipboard());
    await act(() => result.current.copyCommand("join", "/join Guardian#1234"));
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("remains active through development-mode effect cleanup and replay", async () => {
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    const { result } = renderHook(() => useFireteamCommandClipboard(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <StrictMode>{children}</StrictMode>
      )
    });

    await act(() => result.current.copyCommand("join", "/join Guardian#1234"));

    expect(result.current.copiedCommandIdentifier).toBe("join");
  });
});

function setClipboard(
  clipboard: { writeText: (text: string) => Promise<void> } | undefined
): void {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: clipboard
  });
}
