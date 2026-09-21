// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CleanupSelect } from "./CleanupSelect";
afterEach(cleanup);
it("searches styles, selects a choice, and restores focus", () => {
  const onChange = vi.fn();
  render(<CleanupSelect value="" onChange={onChange}><option value="">Unchanged</option>{["AION", "Lustrous"].map((name) => <option value={name} key={name}>{name} · 5/5</option>)}</CleanupSelect>);
  fireEvent.click(screen.getByRole("button", { name: "Unchanged" }));
  fireEvent.change(screen.getByLabelText("Search choices"), { target: { value: "lust" } });
  expect(screen.queryByRole("button", { name: "AION · 5/5" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Lustrous · 5/5" }));
  expect(onChange).toHaveBeenCalledWith({ target: { value: "Lustrous" } });
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Unchanged" }));
});
