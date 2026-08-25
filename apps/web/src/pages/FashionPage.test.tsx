// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FashionPage } from "./FashionPage";

const setPreference = vi.fn();
vi.mock("../context/GuardianContext", () => ({ useGuardian: () => ({
  session: { authenticated: true, guardian: { characters: [{ characterId: "warlock", className: "Warlock" }] } },
  selectedCharacterId: "warlock", loading: false, preferences: {}, setPreference, signIn: vi.fn(), refresh: vi.fn()
}) }));
vi.mock("../components/builds/ManifestPicker", () => ({ ManifestSingleEditor: ({ label }: { label: string }) => <div>{label}</div> }));

describe("Fashion workspace", () => {
  it("labels ownership honestly and saves a five-slot private look", () => {
    render(<FashionPage />);
    expect(screen.getByText("Preview only")).toBeTruthy();
    expect(screen.getAllByText("Armor ornament")).toHaveLength(5);
    fireEvent.change(screen.getByLabelText("Look name"), { target: { value: "Void Regent" } });
    fireEvent.click(screen.getByRole("button", { name: "Save private look" }));
    expect(setPreference).toHaveBeenCalledWith("fashion.looks.v1", expect.stringContaining("Void Regent"));
    expect(setPreference.mock.calls[0]![1]).toContain('"classType":"warlock"');
  });
});
