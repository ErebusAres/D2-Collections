import type { CreateReportCommentRequest, ReportActivity, ReportDetailData, ReportPriority, ReportStatus } from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, ClipboardList, Flag, LockKeyhole, MessageSquareText, RefreshCcw, Send, ShieldCheck, UserCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import { categoryLabel, dateTime, priorityLabel, statusLabel } from "../modules/reports/reportMeta";
import { api, mutationHeaders } from "../services/api/client";
import styles from "./ReportsPage.module.css";

export function ReportDetailPage() {
  const { reportId = "" } = useParams();
  const id = Number(reportId);
  const validId = Number.isInteger(id) && id > 0;
  const { session } = useGuardian();
  const [comment, setComment] = useState("");
  const queryClient = useQueryClient();
  const ticket = useQuery({
    queryKey: ["reports", "detail", id],
    queryFn: () => api<ReportDetailData>(`/api/v1/me/reports/${id}`),
    enabled: Boolean(session?.authenticated && validId),
    staleTime: 0,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false
  });
  const addComment = useMutation({
    mutationFn: (input: CreateReportCommentRequest) => api<ReportDetailData>(`/api/v1/me/reports/${id}/comments`, {
      method: "POST",
      headers: mutationHeaders(session?.csrfToken),
      body: JSON.stringify(input)
    }),
    onSuccess: (result) => {
      setComment("");
      queryClient.setQueryData(["reports", "detail", id], result);
      void queryClient.invalidateQueries({ queryKey: ["reports", "mine"] });
      void queryClient.invalidateQueries({ queryKey: ["reports", "admin"] });
    }
  });
  const submitComment = (event: FormEvent) => {
    event.preventDefault();
    if (comment.trim()) addComment.mutate({ body: comment });
  };
  const data = ticket.data?.data;
  const report = data?.report;

  return <AuthGate>
    <PageHeader
      eyebrow={report ? `${report.reference} · ${categoryLabel(report.category)}` : "Guardian Nexus ticket"}
      title={report?.title || "Ticket details"}
      description="Comments and status changes share one chronological history."
      actions={<><Link className={styles.backLink} to={data?.canManage ? "/reports/admin" : "/reports"}><ChevronLeft /> {data?.canManage ? "Admin queue" : "My reports"}</Link><Freshness observedAt={ticket.data?.freshness.observedAt} warning={ticket.data?.warnings[0]} /></>}
    />
    {!validId ? <section className={styles.restricted}><ClipboardList /><h2>Invalid ticket</h2><p>Choose a ticket from the reports page.</p></section> : <>
      <QueryState loading={ticket.isLoading} error={ticket.error as Error} hasData={Boolean(ticket.data)} onRetry={() => void ticket.refetch()} />
      {report && data && <section className={styles.ticketLayout}>
        <main className={styles.ticketMain}>
          <article className={styles.ticketDescription}>
            <header><span>Description</span><code>{report.reference}</code></header>
            <p>{report.description}</p>
            {(report.reproductionSteps || report.expectedResult || report.actualResult) && <div className={styles.ticketDetails}>
              {report.reproductionSteps && <section><h2>Steps to reproduce</h2><p>{report.reproductionSteps}</p></section>}
              {report.expectedResult && <section><h2>Expected result</h2><p>{report.expectedResult}</p></section>}
              {report.actualResult && <section><h2>Actual result</h2><p>{report.actualResult}</p></section>}
            </div>}
            {report.resolution && <section className={styles.ticketResolution}><CheckCircle2 /><div><h2>Resolution</h2><p>{report.resolution}</p></div></section>}
            {data.canManage && report.adminNotes && <section className={styles.ticketInternal}><LockKeyhole /><div><h2>Internal admin notes</h2><p>{report.adminNotes}</p></div></section>}
          </article>

          <section className={styles.activityPanel}>
            <header><MessageSquareText /><div><span>Comments and history</span><h2>Activity</h2></div><b>{data.activity.length}</b></header>
            <div className={styles.activityTimeline}>
              {data.activity.map((entry) => <ActivityEntry key={entry.id} entry={entry} />)}
            </div>
            {data.canComment && <form className={styles.commentForm} onSubmit={submitComment}>
              <label htmlFor="ticket-comment">Add a comment</label>
              <textarea id="ticket-comment" value={comment} onChange={(event) => setComment(event.target.value)} minLength={1} maxLength={5000} rows={4} required placeholder="Share an update, answer a question, or add information to this ticket…" />
              <div><small>Comments are visible to the reporter and all report administrators.</small><button type="submit" disabled={addComment.isPending || !comment.trim()}><Send /> {addComment.isPending ? "Posting…" : "Comment"}</button></div>
              {addComment.error && <p className={styles.formError} role="alert">{addComment.error.message}</p>}
            </form>}
          </section>
        </main>

        <aside className={styles.ticketSidebar}>
          <header><ClipboardList /><span>Ticket details</span></header>
          <TicketField label="Status"><span className={`${styles.status} ${styles[`status_${report.status}`]}`}>{statusLabel(report.status)}</span></TicketField>
          <TicketField label="Priority"><span className={styles.ticketPriority}><Flag /> {priorityLabel(report.priority)}</span></TicketField>
          <TicketField label="Type">{categoryLabel(report.category)}</TicketField>
          <TicketField label="Reporter">{report.reporterDisplayName}</TicketField>
          <TicketField label="Assignee">{report.assignedToDisplayName || "Unassigned"}</TicketField>
          <TicketField label="Created">{dateTime(report.createdAt)}</TicketField>
          <TicketField label="Updated">{dateTime(report.updatedAt)}</TicketField>
          {report.pageUrl && <TicketField label="App page"><code>{report.pageUrl}</code></TicketField>}
          {report.clientContext?.viewport && <TicketField label="Viewport">{report.clientContext.viewport}</TicketField>}
          {report.clientContext?.userAgent && <TicketField label="Browser">{report.clientContext.userAgent}</TicketField>}
          {data.canManage && <Link className={styles.manageTicket} to="/reports/admin"><ShieldCheck /> Manage status and priority</Link>}
        </aside>
      </section>}
    </>}
  </AuthGate>;
}

function ActivityEntry({ entry }: { entry: ReportActivity }) {
  const Icon = activityIcon(entry.type);
  const comment = entry.type === "comment";
  return <article className={`${styles.activityEntry} ${comment ? styles.activityComment : ""}`}>
    <i><Icon /></i>
    <div>
      <header><b>{entry.actorDisplayName}</b><span>{entry.actorRole === "admin" ? "Maintainer" : "Reporter"}</span>{entry.visibility === "admin" && <em><LockKeyhole /> Internal</em>}<time dateTime={entry.createdAt}>{dateTime(entry.createdAt)}</time></header>
      {comment ? <p>{entry.body}</p> : <p>{activityText(entry)}</p>}
    </div>
  </article>;
}

function activityIcon(type: ReportActivity["type"]) {
  if (type === "comment") return MessageSquareText;
  if (type === "status") return RefreshCcw;
  if (type === "priority") return Flag;
  if (type === "assignment") return UserCheck;
  if (type === "resolution") return CheckCircle2;
  if (type === "admin_note") return LockKeyhole;
  return ClipboardList;
}

function activityText(entry: ReportActivity): string {
  if (entry.type === "status" && entry.metadata?.from && entry.metadata.to) return `Changed status from ${statusLabel(entry.metadata.from as ReportStatus)} to ${statusLabel(entry.metadata.to as ReportStatus)}.`;
  if (entry.type === "priority" && entry.metadata?.from && entry.metadata.to) return `Changed priority from ${priorityLabel(entry.metadata.from as ReportPriority)} to ${priorityLabel(entry.metadata.to as ReportPriority)}.`;
  return entry.body || "Updated this ticket.";
}

function TicketField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className={styles.ticketField}><span>{label}</span><div>{children}</div></div>;
}
