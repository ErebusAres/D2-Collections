import { useCallback, useEffect, useRef, useState } from "react";

export const FIRETEAM_COMMAND_COPIED_MS = 1_800;

interface FireteamCommandClipboard {
  copiedCommandIdentifier: string;
  copyCommand: (commandIdentifier: string, command: string) => Promise<void>;
}

export function useFireteamCommandClipboard(): FireteamCommandClipboard {
  const [copiedCommandIdentifier, setCopiedCommandIdentifier] = useState("");
  const clearCopiedCommandTimer = useRef<number | undefined>(undefined);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (clearCopiedCommandTimer.current !== undefined) {
        window.clearTimeout(clearCopiedCommandTimer.current);
      }
    };
  }, []);

  const copyCommand = useCallback(async (
    commandIdentifier: string,
    command: string
  ): Promise<void> => {
    const clipboard = navigator.clipboard;
    if (!clipboard?.writeText) return;

    try {
      await clipboard.writeText(command);
    } catch {
      return;
    }
    if (!mounted.current) return;

    setCopiedCommandIdentifier(commandIdentifier);
    if (clearCopiedCommandTimer.current !== undefined) {
      window.clearTimeout(clearCopiedCommandTimer.current);
    }
    clearCopiedCommandTimer.current = window.setTimeout(() => {
      setCopiedCommandIdentifier("");
      clearCopiedCommandTimer.current = undefined;
    }, FIRETEAM_COMMAND_COPIED_MS);
  }, []);

  return { copiedCommandIdentifier, copyCommand };
}
