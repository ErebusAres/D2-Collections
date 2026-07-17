// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BuildIconTooltip } from "./BuildIconTooltip";

afterEach(cleanup);

describe("BuildIconTooltip", () => {
  it("opens immediately above the icon using the tooltip's measured height", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 768 });
    render(<BuildIconTooltip entry={{ name: "Spirit of Gyrfalcon", description: "A short tooltip." }} label="Spirit" />);
    const trigger = screen.getByLabelText("Spirit: Spirit of Gyrfalcon");
    const tooltip = screen.getByRole("tooltip");
    trigger.getBoundingClientRect = () => rect({ left: 600, right: 632, top: 700, bottom: 732, width: 32, height: 32 });
    tooltip.getBoundingClientRect = () => rect({ left: 0, right: 290, top: 0, bottom: 80, width: 290, height: 80 });

    fireEvent.mouseEnter(trigger);

    expect(tooltip.style.top).toBe("614px");
    expect(tooltip.style.visibility).toBe("visible");
  });
});

function rect(values: Partial<DOMRect>): DOMRect {
  return { x: values.left || 0, y: values.top || 0, left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}), ...values } as DOMRect;
}
