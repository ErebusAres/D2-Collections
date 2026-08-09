// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { activityTooltipPosition, clampActivityWindowState, FireteamActivityFeed, parseActivityWindowState } from "./FireteamActivityFeed";

afterEach(() => { cleanup(); localStorage.clear(); });

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

  it("portals item details above the activity window instead of clipping them inside it", () => {
    render(<MemoryRouter><FireteamActivityFeed feed={feed} view="open" onViewChange={vi.fn()} onSend={vi.fn()} sending={false} onDisable={vi.fn()} onEnable={vi.fn()} /></MemoryRouter>);
    const panel = screen.getByText("Fireteam activity").closest("section")!;
    fireEvent.click(screen.getByRole("button", { name: /Exotic Engram/i }));
    const tooltip = screen.getByRole("tooltip");
    expect(panel.contains(tooltip)).toBe(false);
    expect(tooltip.parentElement?.parentElement).toBe(document.body);
  });

  it("offers a restore control after hiding", () => {
    const onViewChange = vi.fn();
    render(<FireteamActivityFeed feed={feed} view="hidden" onViewChange={onViewChange} onSend={vi.fn()} sending={false} onDisable={vi.fn()} onEnable={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Show/i }));
    expect(onViewChange).toHaveBeenCalledWith("open");
  });

  it("starts pinned, supports a movable pop-out, and remembers its geometry", () => {
    const props = { feed, view: "open" as const, storageKey: "activity-window-test", onViewChange: vi.fn(), onSend: vi.fn(), sending: false, onDisable: vi.fn(), onEnable: vi.fn() };
    const rendered = render(<FireteamActivityFeed {...props} />);
    const panel = screen.getByText("Fireteam activity").closest("section")!;
    expect(panel.getAttribute("data-window-mode")).toBe("pinned");

    fireEvent.click(screen.getByRole("button", { name: "Pop out Fireteam activity" }));
    expect(panel.getAttribute("data-window-mode")).toBe("popout");
    expect(JSON.parse(localStorage.getItem("activity-window-test") || "{}").mode).toBe("popout");

    const header = screen.getByText("Fireteam activity").closest("header")!;
    fireEvent.pointerDown(header, { button: 0, pointerId: 4, clientX: 700, clientY: 300 });
    fireEvent.pointerMove(header, { pointerId: 4, clientX: 620, clientY: 240 });
    fireEvent.pointerUp(header, { pointerId: 4, clientX: 620, clientY: 240 });
    const saved = JSON.parse(localStorage.getItem("activity-window-test") || "{}");
    expect(saved.x).toBeGreaterThanOrEqual(18);
    expect(saved.y).toBeGreaterThanOrEqual(18);

    rendered.unmount();
    render(<FireteamActivityFeed {...props} />);
    expect(screen.getByText("Fireteam activity").closest("section")!.getAttribute("data-window-mode")).toBe("popout");
    fireEvent.click(screen.getByRole("button", { name: "Pin Fireteam activity to bottom right" }));
    expect(JSON.parse(localStorage.getItem("activity-window-test") || "{}").mode).toBe("pinned");
  });

  it("rejects corrupt saved state and clamps remembered size and position into the viewport", () => {
    expect(parseActivityWindowState("not-json", 900, 700).mode).toBe("pinned");
    expect(clampActivityWindowState({ mode: "popout", x: -500, y: 900, width: 2_000, height: 2_000 }, 900, 700)).toEqual({ mode: "popout", x: 18, y: 18, width: 864, height: 664 });
  });

  it("places the activity tooltip beside its trigger while keeping it inside the viewport", () => {
    expect(activityTooltipPosition({ left: 800, right: 900, top: 650 }, { width: 410, height: 360 }, 1_000, 800)).toEqual({ left: 380, top: 428 });
    expect(activityTooltipPosition({ left: 20, right: 120, top: 5 }, { width: 410, height: 360 }, 500, 400)).toEqual({ left: 78, top: 12 });
  });
});
