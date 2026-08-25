// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ChallengesPage } from "./ChallengesPage";

const setPreference = vi.fn();
const saved = JSON.stringify({ schemaVersion: 1, challenges: [{ id: "night", title: "Build Night", mode: "fireteam", createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z", tasks: [{ id: "task", label: "Try a build", points: 2, state: "todo" }] }] });
vi.mock("../context/GuardianContext", () => ({ useGuardian: () => ({ session: { authenticated: true }, loading: false, preferences: { "challenges.v1": saved }, setPreference, signIn: vi.fn(), refresh: vi.fn() }) }));

describe("Community challenges page", () => {
  it("keeps progress player-recorded and can adapt a challenge into private Projects", () => {
    render(<MemoryRouter><ChallengesPage /></MemoryRouter>);
    expect(screen.getByText(/Players enter their own scores and completion/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cycle Try a build status" }));
    expect(setPreference).toHaveBeenCalledWith("challenges.v1", expect.stringContaining('"state":"done"'));
    fireEvent.click(screen.getByRole("button", { name: /Project/i }));
    expect(setPreference).toHaveBeenCalledWith("projects.v1", expect.stringContaining("Try a build (2 pts)"));
  });
});
