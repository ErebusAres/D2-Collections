import { useMemo, useSyncExternalStore } from "react";

const CHANGE_EVENT = "guardian-nexus:reward-code-preferences";

export function redeemedCodesStorageKey(membershipId?: string): string {
  return `guardian-nexus:${membershipId || "anonymous"}:redeemed-codes`;
}

export function parseRedeemedCodes(value: string | null): Set<string> {
  try {
    const entries = JSON.parse(value || "[]");
    return new Set(Array.isArray(entries) ? entries.filter((entry): entry is string => typeof entry === "string") : []);
  } catch {
    return new Set();
  }
}

function snapshot(membershipId?: string): string {
  if (typeof window === "undefined") return "[]";
  return window.localStorage.getItem(redeemedCodesStorageKey(membershipId)) || "[]";
}

function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function setRewardCodeRedeemed(membershipId: string | undefined, code: string, redeemed: boolean): void {
  const entries = parseRedeemedCodes(snapshot(membershipId));
  if (redeemed) entries.add(code);
  else entries.delete(code);
  window.localStorage.setItem(redeemedCodesStorageKey(membershipId), JSON.stringify([...entries].sort()));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useRedeemedRewardCodes(membershipId?: string): Set<string> {
  const raw = useSyncExternalStore(subscribe, () => snapshot(membershipId), () => "[]");
  return useMemo(() => parseRedeemedCodes(raw), [raw]);
}
