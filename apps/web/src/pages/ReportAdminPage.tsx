import type { GuardianReport, ReportCategory, ReportListData, ReportPriority, ReportStatus, UpdateReportRequest } from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronLeft, CircleDot, Clock3, RefreshCcw, Save, Search, ShieldCheck, UserCheck, UserMinus, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import { categoryLabel, categoryOptions, dateTime, priorityLabel, reportPriorities, reportStatuses, statusLabel } from "../modules/reports/reportMeta";
import { api, ApiRequestError, mutationHeaders } from "../services/api/client";
import styles from "./ReportsPage.module.css";

interface Filters {
  status: ReportStatus | "";
  category: ReportCategory | "";
  priority: ReportPriority | "";
  search: string;
}

interface UpdateVariables {
  report: GuardianReport;
  changes: Omit<UpdateReportRequest, "expectedVersion">;
}

export function ReportAdminPage() {
  const { session } = useGuardian();
  const [filters, setFilters] = useState<Filters>({ status: "", category: "", priority: "", search: "" });
  const queryClient = useQueryClient();
  const queryString = new URLSearchParams(Object.entries(filters).filter(([, value]) => value).map(([key, value]) => [key, value])).toString();
  const reports = useQuery({
    queryKey: ["reports", "admin", filters],
    queryFn: () => api<ReportListData>(`/api/v1/admin/reports${queryString ? `?${queryString}` : ""}`),
    enabled: Boolean(session?.authenticated && session.roles.reportAdmin),
    staleTime: 0,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false
  });
  const update = useMutation({
    mutationFn: ({ report, changes }: UpdateVariables) => api<GuardianReport>(`/api/v1/admin/reports/${report.id}`, {
      method: "PATCH",
      headers: mutationHeaders(session?.csrfToken),
      body: JSON.stringify({ expectedVersion: report.version, ...changes })
    }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["reports"] }),
    onError: (error) => {
      if (error instanceof ApiRequestError && error.status === 409) void reports.refetch();
    }
  });
  const data = reports.data?.data;
  const updateFilter = <Key extends keyof Filters>(key: Key, value: Filters[Key]) => setFilters((current) => ({ ...current, [key]: value }));

  return <AuthGate>
    <PageHeader
      eyebrow="Restricted maintainer workflow"
      title="Report management"
      description="Claim, prioritize, resolve, and dismiss Guardian Nexus reports. The queue refreshes automatically every five seconds."
      actions={<><Link className={styles.backLink} to="/reports"><ChevronLeft /> Reporter view</Link><Freshness observedAt={reports.data?.freshness.observedAt} warning={reports.data?.warnings[0]} /></>}
    />
    {!session?.roles.reportAdmin ? <section className={styles.restricted}><ShieldCheck /><h2>Maintainer access required</h2><p>This queue is available only to the approved Guardian Nexus administrators.</p></section> : <>
      <section className={styles.adminSummary}>
        <article><CircleDot /><span>Open</span><strong>{data?.counts?.open || 0}</strong></article>
        <article><Clock3 /><span>In progress</span><strong>{data?.counts?.in_progress || 0}</strong></article>
        <article><CheckCircle2 /><span>Completed</span><strong>{data?.counts?.completed || 0}</strong></article>
        <article><XCircle /><span>Dismissed</span><strong>{data?.counts?.dismissed || 0}</strong></article>
        <p><RefreshCcw /> Changes from ErebusAres, IceeDedPple, and FearsRedemption appear automatically. Version checks prevent stale updates from replacing newer work.</p>
      </section>

      <section className={styles.adminFilters} aria-label="Report filters">
        <label className={styles.searchBox}><Search /><input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Search title, details, reporter, or GN number" /></label>
        <label><span>Status</span><select value={filters.status} onChange={(event) => updateFilter("status", event.target.value as Filters["status"])}><option value="">All statuses</option>{reportStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
        <label><span>Type</span><select value={filters.category} onChange={(event) => updateFilter("category", event.target.value as Filters["category"])}><option value="">All types</option>{categoryOptions.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
        <label><span>Priority</span><select value={filters.priority} onChange={(event) => updateFilter("priority", event.target.value as Filters["priority"])}><option value="">All priorities</option>{reportPriorities.map((priority) => <option key={priority} value={priority}>{priorityLabel(priority)}</option>)}</select></label>
      </section>

      {update.error && <p className={styles.adminError} role="alert"><AlertTriangle /> {update.error.message}</p>}
      <QueryState loading={reports.isLoading} error={reports.error as Error} hasData={Boolean(reports.data)} onRetry={() => void reports.refetch()} />
      {data && !data.reports.length && <section className={styles.emptyAdmin}><CheckCircle2 /><h2>No matching reports</h2><p>Adjust the filters or enjoy the quiet queue.</p></section>}
      <section className={styles.adminQueue}>{data?.reports.map((report) => <AdminReportCard
        key={report.id}
        report={report}
        currentMembershipId={session.guardian?.membershipId || ""}
        pending={update.isPending && update.variables?.report.id === report.id}
        onUpdate={(changes) => update.mutate({ report, changes })}
      />)}</section>
    </>}
  </AuthGate>;
}

function AdminReportCard({ report, currentMembershipId, pending, onUpdate }: { report: GuardianReport; currentMembershipId: string; pending: boolean; onUpdate: (changes: Omit<UpdateReportRequest, "expectedVersion">) => void }) {
  const [adminNotes, setAdminNotes] = useState(report.adminNotes || "");
  const [resolution, setResolution] = useState(report.resolution || "");
  useEffect(() => {
    setAdminNotes(report.adminNotes || "");
    setResolution(report.resolution || "");
  }, [report.id, report.version, report.adminNotes, report.resolution]);
  const assignedToMe = report.assignedToMembershipId === currentMembershipId;
  const assignedToOther = Boolean(report.assignedToMembershipId && !assignedToMe);
  const resolved = report.status === "completed" || report.status === "dismissed";
  const saveNotes = () => onUpdate({ adminNotes, resolution });

  return <article className={`${styles.adminReport} ${styles[`priority_${report.priority}`]}`}>
    <header>
      <div><code>{report.reference}</code><span className={`${styles.status} ${styles[`status_${report.status}`]}`}>{statusLabel(report.status)}</span><span className={styles.priority}>{priorityLabel(report.priority)}</span></div>
      <time dateTime={report.updatedAt}>Updated {dateTime(report.updatedAt)}</time>
    </header>
    <div className={styles.adminReportBody}>
      <section className={styles.reportContent}>
        <small>{categoryLabel(report.category)} · Submitted by {report.reporterDisplayName}</small>
        <h2>{report.title}</h2>
        <p>{report.description}</p>
        <div className={styles.reportDetails}>
          {report.reproductionSteps && <div><b>Steps to reproduce</b><p>{report.reproductionSteps}</p></div>}
          {report.expectedResult && <div><b>Expected</b><p>{report.expectedResult}</p></div>}
          {report.actualResult && <div><b>Actual</b><p>{report.actualResult}</p></div>}
        </div>
        <dl>
          {report.pageUrl && <><dt>Page</dt><dd><code>{report.pageUrl}</code></dd></>}
          {report.clientContext?.viewport && <><dt>Viewport</dt><dd>{report.clientContext.viewport}</dd></>}
          {report.clientContext?.userAgent && <><dt>Browser</dt><dd>{report.clientContext.userAgent}</dd></>}
          <dt>Created</dt><dd>{dateTime(report.createdAt)}</dd>
        </dl>
      </section>

      <aside className={styles.adminControls}>
        <label><span>Priority</span><select value={report.priority} disabled={pending || assignedToOther} onChange={(event) => onUpdate({ priority: event.target.value as ReportPriority })}>{reportPriorities.map((priority) => <option key={priority} value={priority}>{priorityLabel(priority)}</option>)}</select></label>
        <div className={styles.assignment}>
          {assignedToOther ? <span><UserCheck /> Claimed by {report.assignedToDisplayName}</span> : assignedToMe ? <button type="button" disabled={pending} onClick={() => onUpdate({ assignment: "release" })}><UserMinus /> Release report</button> : !resolved ? <button type="button" disabled={pending} onClick={() => onUpdate({ assignment: "claim" })}><UserCheck /> Claim for me</button> : <span><ShieldCheck /> Resolved by {report.assignedToDisplayName || "a maintainer"}</span>}
        </div>
        <label><span>Internal admin notes</span><textarea rows={4} value={adminNotes} disabled={assignedToOther} onChange={(event) => setAdminNotes(event.target.value)} placeholder="Coordination notes visible only to report administrators." /></label>
        <label><span>Reporter-visible resolution</span><textarea rows={4} value={resolution} disabled={assignedToOther} onChange={(event) => setResolution(event.target.value)} placeholder="Required before completing or dismissing. The reporter can read this response." /></label>
        <button className={styles.saveNotes} type="button" disabled={pending || assignedToOther || (adminNotes === (report.adminNotes || "") && resolution === (report.resolution || ""))} onClick={saveNotes}><Save /> Save notes</button>
        <div className={styles.statusActions}>
          {resolved ? <button type="button" disabled={pending || assignedToOther} onClick={() => onUpdate({ status: "open", resolution: "", assignment: "release" })}><RefreshCcw /> Reopen</button> : <>
            <button type="button" disabled={pending || assignedToOther || resolution.trim().length < 3} onClick={() => onUpdate({ status: "completed", adminNotes, resolution })}><CheckCircle2 /> Complete</button>
            <button type="button" disabled={pending || assignedToOther || resolution.trim().length < 3} onClick={() => onUpdate({ status: "dismissed", adminNotes, resolution })}><XCircle /> Dismiss</button>
          </>}
        </div>
        {pending && <small className={styles.saving}>Saving version {report.version + 1}…</small>}
      </aside>
    </div>
  </article>;
}
