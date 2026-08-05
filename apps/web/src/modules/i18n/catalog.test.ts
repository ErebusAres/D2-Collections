import { describe, expect, it } from "vitest";
import { loadMessages, siteLocale, SUPPORTED_LOCALES, type MessageKey } from "./catalog";

describe("interface message catalogs", () => {
  it("keeps every translated locale complete and leaves English in the interface bundle", async () => {
    const keys: MessageKey[] = ["director", "collection", "xur", "journey", "gear", "loadouts", "builds", "buildAdvisor", "watchlists", "fireteam", "alerts", "plan", "postmaster", "options", "settings", "experience", "autoRefresh", "reduceMotion", "highContrast", "textSize", "language", "standard", "large", "largest"];
    for (const locale of SUPPORTED_LOCALES.filter((entry) => entry.value !== "en-US")) {
      const catalog = await loadMessages(locale.value);
      expect(catalog).toBeDefined();
      expect(Object.keys(catalog!)).toEqual(keys);
    }
    expect(siteLocale("unsupported")).toBe("en-US");
    expect((await loadMessages("es-ES"))?.collection).toBe("Colección");
    expect(await loadMessages("en-US")).toBeUndefined();
  });
});
