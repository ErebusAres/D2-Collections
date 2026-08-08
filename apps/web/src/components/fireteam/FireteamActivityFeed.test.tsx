// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FireteamActivityFeed, lootTier } from "./FireteamActivityFeed";

afterEach(cleanup);

const feed: any = {
  enabled: true,
  channelAvailable: true,
  historyLimit: 60,
  retentionDays: 7,
  messageMaxLength: 240,
  entries: [
    { type: "loot", id: "loot", membershipId: "1", displayName: "ErebusAres#1234", createdAt: "2026-08-08T12:00:00Z", event: { id: "loot", kind: "exotic-engram-found", sourceKey: "inventory:1", name: "Exotic Engram", icon: "/engram.png", rarity: "Exotic", quantity: 1, observedAt: "2026-08-08T12:00:00Z", lastObservedAt: "2026-08-08T12:00:00Z" } },
    { type: "message", id: "message", membershipId: "2", displayName: "Guardian#5678", createdAt: "2026-08-08T12:01:00Z", body: "Ready when you are." }
  ]
};

describe("FireteamActivityFeed", () => {
  it("renders rarity-colored finds and sends short messages", () => {
    const onSend = vi.fn();
    render(<FireteamActivityFeed feed={feed} view="open" onViewChange={vi.fn()} onSend={onSend} sending={false} onDisable={vi.fn()} onEnable={vi.fn()} />);
    expect(screen.getByText("Exotic Engram").getAttribute("data-rarity")).toBe("Exotic");
    expect(screen.getByLabelText("Tier 6 Exotic").textContent).toBe("6");
    expect(screen.getByRole("button", { name: /Exotic Engram/i }).querySelector("img")?.getAttribute("src")).toBe("/engram.png");
    expect(screen.getByText("Ready when you are.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Message your Fireteam"), { target: { value: "Need ammo" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).toHaveBeenCalledWith("Need ammo");
  });

  it("maps Destiny display rarities to their manifest tier numbers", () => {
    expect(["Exotic", "Legendary", "Rare", "Common", "Uncommon", "Currency", "Unknown"].map(lootTier)).toEqual([6, 5, 4, 3, 2, 1, 0]);
  });

  it("offers a restore control after hiding", () => {
    const onViewChange = vi.fn();
    render(<FireteamActivityFeed feed={feed} view="hidden" onViewChange={onViewChange} onSend={vi.fn()} sending={false} onDisable={vi.fn()} onEnable={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Show/i }));
    expect(onViewChange).toHaveBeenCalledWith("open");
  });
});
