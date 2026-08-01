import type { SiteLocale } from "@guardian-nexus/contracts";
import { useEffect, useState } from "react";

export type MessageKey =
  | "director" | "collection" | "xur" | "journey" | "gear" | "loadouts" | "builds"
  | "buildAdvisor" | "watchlists" | "snapshots" | "fireteam" | "alerts" | "plan" | "postmaster"
  | "options" | "settings" | "experience" | "autoRefresh" | "reduceMotion" | "highContrast"
  | "textSize" | "language" | "standard" | "large" | "largest";

export type MessageCatalog = Record<MessageKey, string>;

export const SUPPORTED_LOCALES: Array<{ value: SiteLocale; label: string }> = [
  { value: "en-US", label: "English (US)" },
  { value: "es-ES", label: "Español" },
  { value: "fr-FR", label: "Français" }
];

export function siteLocale(value: string | undefined): SiteLocale {
  return value === "es-ES" || value === "fr-FR" ? value : "en-US";
}

export async function loadMessages(locale: SiteLocale | string | undefined): Promise<MessageCatalog | undefined> {
  if (locale === "es-ES") return (await import("./es")).default;
  if (locale === "fr-FR") return (await import("./fr")).default;
  return undefined;
}

export function useMessages(locale: SiteLocale | string | undefined): MessageCatalog | undefined {
  const [catalog, setCatalog] = useState<MessageCatalog>();
  useEffect(() => {
    let active = true;
    setCatalog(undefined);
    void loadMessages(locale).then((next) => { if (active) setCatalog(next); });
    return () => { active = false; };
  }, [locale]);
  return catalog;
}
