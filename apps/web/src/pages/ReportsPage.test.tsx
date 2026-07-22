// @vitest-environment jsdom

import type { GuardianReport, ReportDetailData, ReportListData } from "@guardian-nexus/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../services/api/client";
import { ReportAdminPage } from "./ReportAdminPage";
import { ReportDetailPage } from "./ReportDetailPage";
import { ReportsPage } from "./ReportsPage";

vi.mock("../context/GuardianContext", () => ({
  useGuardian: () => ({
    session: {
      authenticated: true,
      csrfToken: "csrf",
      guardian: { membershipId: "admin-1" },
      roles: { dev: true, matrixWriter: true, buildEditor: true, reportAdmin: true }
    },
    loading: false,
    signIn: vi.fn(),
    refresh: vi.fn()
  })
}));
vi.mock("../services/api/client", async () => {
  const actual = await vi.importActual<typeof import("../services/api/client")>("../services/api/client");
  return { ...actual, api: vi.fn(), mutationHeaders: () => ({ "X-CSRF-Token": "csrf" }) };
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Reports page", () => {
  it("submits structured feedback with the originating app page", async () => {
    vi.mocked(api).mockImplementation(async (_path, init) => init?.method === "POST" ? envelope(report()) : envelope<ReportListData>({ reports: [], canManage: true }));
    renderPage(<ReportsPage />, "/reports?from=%2Fgear");

    expect(await screen.findByRole("heading", { name: "What should we know?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Suggestion/ }));
    fireEvent.change(screen.getByLabelText("Short title"), { target: { value: "Add comparison export" } });
    fireEvent.change(screen.getByLabelText("Details"), { target: { value: "Let Guardians export their current comparison as a shareable summary." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));

    await waitFor(() => expect(vi.mocked(api).mock.calls.some(([path, init]) => path === "/api/v1/me/reports" && init?.method === "POST")).toBe(true));
    const call = vi.mocked(api).mock.calls.find(([path, init]) => path === "/api/v1/me/reports" && init?.method === "POST");
    const body = JSON.parse(String(call?.[1]?.body));
    expect(body).toMatchObject({ category: "suggestion", title: "Add comparison export", pageUrl: "/gear", clientContext: { appPath: "/gear" } });
    expect(screen.getByRole("link", { name: /Manage reports/ }).getAttribute("href")).toBe("/reports/admin");
  });
});

describe("Report administration", () => {
  it("claims the current report with its optimistic version", async () => {
    vi.mocked(api).mockImplementation(async (_path, init) => init?.method === "PATCH" ? envelope({ ...report(), status: "in_progress" as const, version: 6 }) : envelope<ReportListData>({ reports: [report()], canManage: true, counts: { open: 1, in_progress: 0, completed: 0, dismissed: 0 } }));
    renderPage(<ReportAdminPage />, "/reports/admin");

    expect(await screen.findByRole("heading", { name: "Rewards progress does not refresh" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Claim for me" }));

    await waitFor(() => expect(vi.mocked(api).mock.calls.some(([path, init]) => path === "/api/v1/admin/reports/42" && init?.method === "PATCH")).toBe(true));
    const call = vi.mocked(api).mock.calls.find(([path, init]) => path === "/api/v1/admin/reports/42" && init?.method === "PATCH");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ expectedVersion: 5, assignment: "claim" });
  });

  it("keeps another administrator's claimed report read-only", async () => {
    const claimed = report({
      status: "in_progress",
      assignedToMembershipId: "admin-2",
      assignedToDisplayName: "IceeDedPple",
      resolution: "Investigating the underlying data."
    });
    vi.mocked(api).mockImplementation(async () => envelope<ReportListData>({ reports: [claimed], canManage: true, counts: { open: 0, in_progress: 1, completed: 0, dismissed: 0 } }));
    renderPage(<ReportAdminPage />, "/reports/admin");

    expect(await screen.findByText("Claimed by IceeDedPple")).toBeTruthy();
    expect((screen.getAllByLabelText("Priority")[1] as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText("Internal admin notes") as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Complete" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Ticket details", () => {
  it("shows the complete activity history and posts a comment", async () => {
    const detail: ReportDetailData = {
      report: report(),
      activity: [
        { id: 1, type: "created", actorDisplayName: "Guardian#1234", actorRole: "reporter", body: "Created this ticket.", visibility: "public", createdAt: "2026-07-22T12:00:00.000Z" },
        { id: 2, type: "priority", actorDisplayName: "ErebusAres", actorRole: "admin", body: "Changed priority.", metadata: { from: "normal", to: "high" }, visibility: "public", createdAt: "2026-07-22T12:05:00.000Z" }
      ],
      canManage: true,
      canComment: true
    };
    vi.mocked(api).mockImplementation(async (_path, init) => envelope(init?.method === "POST" ? { ...detail, activity: [...detail.activity, { id: 3, type: "comment" as const, actorDisplayName: "ErebusAres", actorRole: "admin" as const, body: "I am checking this now.", visibility: "public" as const, createdAt: "2026-07-22T12:10:00.000Z" }] } : detail));
    renderPage(<ReportDetailPage />, "/reports/42", "/reports/:reportId");

    expect(await screen.findByRole("heading", { name: "Rewards progress does not refresh" })).toBeTruthy();
    expect(screen.getByText("Changed priority from Normal to High.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Add a comment"), { target: { value: "I am checking this now." } });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));

    await waitFor(() => expect(vi.mocked(api).mock.calls.some(([path, init]) => path === "/api/v1/me/reports/42/comments" && init?.method === "POST")).toBe(true));
    const call = vi.mocked(api).mock.calls.find(([path, init]) => path === "/api/v1/me/reports/42/comments" && init?.method === "POST");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ body: "I am checking this now." });
  });
});

function renderPage(page: React.ReactNode, route: string, path?: string) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[route]}>{path ? <Routes><Route path={path} element={page} /></Routes> : page}</MemoryRouter></QueryClientProvider>);
}

function report(overrides: Partial<GuardianReport> = {}): GuardianReport {
  return {
    id: 42,
    reference: "GN-00042",
    reporterMembershipId: "reporter-1",
    reporterDisplayName: "Guardian#1234",
    category: "bug",
    title: "Rewards progress does not refresh",
    description: "The progress bar remains stale after earning activity XP.",
    pageUrl: "/rewards",
    clientContext: { viewport: "1920x1080", userAgent: "Test browser" },
    status: "open",
    priority: "normal",
    createdAt: "2026-07-22T12:00:00.000Z",
    updatedAt: "2026-07-22T12:00:00.000Z",
    version: 5,
    ...overrides
  };
}

function envelope<T>(data: T) {
  return Promise.resolve({ data, freshness: { state: "fresh" as const, observedAt: "2026-07-22T12:00:00.000Z" }, warnings: [], requestId: "report-test" });
}
