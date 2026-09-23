// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ItemAppearance } from "./ItemAppearance";
const mock = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../../context/GuardianContext", () => ({ useGuardian: () => ({ session: { guardian: { membershipId: "m" }, csrfToken: "csrf" } }) }));
vi.mock("../../services/api/client", () => ({ api: mock.api, mutationHeaders: (token: string) => ({ "X-CSRF-Token": token }) }));
afterEach(() => { cleanup(); mock.api.mockReset(); });
describe("appearance picker", () => {
  it("loads on demand, searches icons and requires explicit approval", async () => {
    mock.api.mockResolvedValue({ data: { itemId: "1", canApply: true, choices: [
      { hash: "20", name: "Default look", kind: "ornament", icon: "/default.png", socketIndex: 2, selected: true, enabled: true },
      { hash: "30", name: "Owned look", kind: "ornament", icon: "/skin.png", socketIndex: 2, selected: false, enabled: true }
    ] } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    render(<QueryClientProvider client={client}><ItemAppearance itemId="1" /></QueryClientProvider>);
    expect(mock.api).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Appearance/ }));
    await screen.findByRole("button", { name: "Owned look" });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Owned" } });
    expect(screen.queryByRole("button", { name: "Default look (applied)" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Owned look" }));
    expect(mock.api).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(mock.api).toHaveBeenCalledTimes(2));
    expect(JSON.parse(mock.api.mock.calls[1]![1].body)).toEqual({ itemId: "1", socketIndex: 2, hash: "30", expectedHash: "20" });
    await screen.findByText("Appearance applied.");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["gear"] });
    expect(screen.getByRole("button", { name: "Owned look (applied)" })).toBeTruthy();
  });
  it("keeps vault appearance changes disabled", async () => {
    mock.api.mockResolvedValue({ data: { itemId: "1", canApply: false, warning: "Pull this item to a character before changing its appearance.", choices: [{ hash: "30", name: "Owned look", kind: "ornament", socketIndex: 2, selected: false, enabled: true }] } });
    render(<QueryClientProvider client={new QueryClient()}><ItemAppearance itemId="1" /></QueryClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: /Appearance/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Owned look" }));
    expect((screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
