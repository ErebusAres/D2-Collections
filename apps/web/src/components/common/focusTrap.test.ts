// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { trapFocusWithin } from "./focusTrap";

describe("trapFocusWithin", () => {
  it("wraps forward and backward keyboard focus inside a drawer", () => {
    const container = document.createElement("section");
    const first = document.createElement("button");
    const last = document.createElement("button");
    container.append(first, last);
    document.body.append(container);

    last.focus();
    trapFocusWithin(new KeyboardEvent("keydown", { key: "Tab", cancelable: true }), container);
    expect(document.activeElement).toBe(first);

    first.focus();
    trapFocusWithin(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, cancelable: true }), container);
    expect(document.activeElement).toBe(last);
    container.remove();
  });
});
