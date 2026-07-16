// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArmorModEditor } from "./BuildFormControls";

describe("ArmorModEditor", () => {
  afterEach(cleanup);
  it("stacks a selected armor mod to three copies and never past the piece cap", () => {
    const onChange = vi.fn();
    render(<QueryClientProvider client={new QueryClient()}><ArmorModEditor
      slot="helmet"
      label="Helmet mods"
      values={[{ name: "Dynamo", hash: "3632726237", quantity: 2, icon: "https://www.bungie.net/dynamo.png" }]}
      onChange={onChange}
    /></QueryClientProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Add one Dynamo" }));
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ name: "Dynamo", quantity: 3 })]);
  });

  it("disables adding another copy when all three mod sockets are used", () => {
    render(<QueryClientProvider client={new QueryClient()}><ArmorModEditor
      slot="arms"
      label="Arms mods"
      values={[{ name: "Radiant Light", quantity: 1 }, { name: "Dynamo", quantity: 2 }]}
      onChange={() => undefined}
    /></QueryClientProvider>);

    expect(screen.getByText("Arms mods complete · 3/3 mod sockets")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Add one Dynamo" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
