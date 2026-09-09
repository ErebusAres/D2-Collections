export const INCIDENT_REPORT_DRAFT_KEY = "guardian-nexus:incident-report-draft";

export interface IncidentReportDraft {
  title: string;
  description: string;
  actualResult: string;
  pageUrl: string;
}

export function saveIncidentReportDraft(draft: IncidentReportDraft): void {
  try {
    sessionStorage.setItem(INCIDENT_REPORT_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // The Reports page still opens when browser storage is unavailable.
  }
}

export function takeIncidentReportDraft(): IncidentReportDraft | undefined {
  try {
    const raw = sessionStorage.getItem(INCIDENT_REPORT_DRAFT_KEY);
    sessionStorage.removeItem(INCIDENT_REPORT_DRAFT_KEY);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as Partial<IncidentReportDraft>;
    if (!value || typeof value !== "object") return undefined;
    return {
      title: typeof value.title === "string" ? value.title.slice(0, 140) : "",
      description: typeof value.description === "string" ? value.description.slice(0, 8_000) : "",
      actualResult: typeof value.actualResult === "string" ? value.actualResult.slice(0, 5_000) : "",
      pageUrl: typeof value.pageUrl === "string" ? value.pageUrl.slice(0, 500) : ""
    };
  } catch {
    return undefined;
  }
}
