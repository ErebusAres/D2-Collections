import type { CreateReportRequest, GuardianReport, ReportCategory, ReportListData } from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight, ClipboardList, Lightbulb, MessageSquareText, Send, ShieldCheck, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import { api, mutationHeaders } from "../services/api/client";
import { categoryLabel, categoryOptions, dateTime, statusLabel } from "../modules/reports/reportMeta";
import styles from "./ReportsPage.module.css";

interface ReportFormState {
  category: ReportCategory;
  title: string;
  description: string;
  reproductionSteps: string;
  expectedResult: string;
  actualResult: string;
  pageUrl: string;
}

export function ReportsPage() {
  const { session } = useGuardian();
  const [searchParams] = useSearchParams();
  const sourcePage = searchParams.get("from") || "";
  const [form, setForm] = useState<ReportFormState>(() => emptyForm(sourcePage));
  const [submittedReference, setSubmittedReference] = useState("");
  const queryClient = useQueryClient();
  const reports = useQuery({
    queryKey: ["reports", "mine"],
    queryFn: () => api<ReportListData>("/api/v1/me/reports"),
    enabled: Boolean(session?.authenticated),
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false
  });
  const create = useMutation({
    mutationFn: (input: CreateReportRequest) => api<GuardianReport>("/api/v1/me/reports", {
      method: "POST",
      headers: mutationHeaders(session?.csrfToken),
      body: JSON.stringify(input)
    }),
    onSuccess: (result) => {
      setSubmittedReference(result.data.reference);
      setForm(emptyForm(form.pageUrl));
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    }
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmittedReference("");
    create.mutate({
      category: form.category,
      title: form.title,
      description: form.description,
      ...(form.reproductionSteps ? { reproductionSteps: form.reproductionSteps } : {}),
      ...(form.expectedResult ? { expectedResult: form.expectedResult } : {}),
      ...(form.actualResult ? { actualResult: form.actualResult } : {}),
      ...(form.pageUrl ? { pageUrl: form.pageUrl } : {}),
      clientContext: {
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        appPath: form.pageUrl || window.location.pathname
      }
    });
  };
  const update = <Key extends keyof ReportFormState>(key: Key, value: ReportFormState[Key]) => setForm((current) => ({ ...current, [key]: value }));
  const ownReports = reports.data?.data.reports || [];

  return <AuthGate>
    <PageHeader
      eyebrow="Guardian Nexus feedback"
      title="Reports"
      description="Report a problem, suggest an improvement, or leave feedback directly for the Guardian Nexus maintainers."
      actions={<>{session?.roles.reportAdmin && <Link className={styles.adminLink} to="/reports/admin"><ShieldCheck /> Manage reports <ChevronRight /></Link>}<Freshness observedAt={reports.data?.freshness.observedAt} warning={reports.data?.warnings[0]} /></>}
    />

    <section className={styles.reportLayout}>
      <form className={styles.reportForm} onSubmit={submit}>
        <header><MessageSquareText /><div><span>Send an update request</span><h2>What should we know?</h2></div></header>
        <div className={styles.categoryGrid} role="radiogroup" aria-label="Report type">
          {categoryOptions.map((option) => <button key={option.value} type="button" role="radio" aria-checked={form.category === option.value} className={form.category === option.value ? styles.selectedCategory : ""} onClick={() => update("category", option.value)}><option.icon /><span><b>{option.label}</b><small>{option.short}</small></span></button>)}
        </div>
        <label><span>Short title</span><input value={form.title} onChange={(event) => update("title", event.target.value)} minLength={4} maxLength={140} required placeholder="What happened or what should change?" /></label>
        <label><span>Details</span><textarea value={form.description} onChange={(event) => update("description", event.target.value)} minLength={10} maxLength={8000} required rows={5} placeholder="Describe the problem, idea, or feedback with enough detail for us to act on it." /></label>
        <div className={styles.detailGrid}>
          <label><span>Steps to reproduce <small>Optional</small></span><textarea value={form.reproductionSteps} onChange={(event) => update("reproductionSteps", event.target.value)} maxLength={5000} rows={4} placeholder="1. Open…&#10;2. Select…&#10;3. Observe…" /></label>
          <label><span>Expected result <small>Optional</small></span><textarea value={form.expectedResult} onChange={(event) => update("expectedResult", event.target.value)} maxLength={5000} rows={4} placeholder="What did you expect Guardian Nexus to do?" /></label>
          <label><span>Actual result <small>Optional</small></span><textarea value={form.actualResult} onChange={(event) => update("actualResult", event.target.value)} maxLength={5000} rows={4} placeholder="What happened instead? Include exact error text if available." /></label>
        </div>
        <label><span>Related app page <small>Optional</small></span><input value={form.pageUrl} onChange={(event) => update("pageUrl", event.target.value)} maxLength={500} placeholder="/rewards, /gear, or another Guardian Nexus page" /></label>
        <div className={styles.privacyNote}><Sparkles /><p><b>Helpful diagnostics are attached automatically.</b><span>Browser type, viewport size, and the related Guardian Nexus page are stored with the report. IP addresses and unrelated browsing activity are not included.</span></p></div>
        {create.error && <p className={styles.formError} role="alert">{create.error.message}</p>}
        {submittedReference && <p className={styles.formSuccess} role="status"><CheckCircle2 /> Report {submittedReference} was saved. Its status will appear below.</p>}
        <button className={styles.submitButton} type="submit" disabled={create.isPending}><Send /> {create.isPending ? "Saving report…" : "Submit report"}</button>
      </form>

      <aside className={styles.reportGuide}>
        <Lightbulb />
        <h2>{categoryLabel(form.category)}</h2>
        <p>{categoryOptions.find((option) => option.value === form.category)?.description}</p>
        <ul><li>Use a specific title.</li><li>Include the page where it happened.</li><li>For bugs, list repeatable steps and exact errors.</li><li>Submit separate reports for unrelated requests.</li></ul>
      </aside>
    </section>

    <section className={styles.myReports}>
      <header><ClipboardList /><div><span>Your submissions</span><h2>My reports</h2></div><b>{ownReports.length}</b></header>
      <QueryState loading={reports.isLoading} error={reports.error as Error} hasData={Boolean(reports.data)} onRetry={() => void reports.refetch()} />
      {!reports.isLoading && !ownReports.length && <div className={styles.emptyReports}><MessageSquareText /><p><b>No reports yet.</b><span>Your submitted reports and maintainer resolutions will appear here.</span></p></div>}
      <div className={styles.reportCards}>{ownReports.map((report) => <article key={report.id} className={styles.reportCard}>
        <header><span className={`${styles.status} ${styles[`status_${report.status}`]}`}>{statusLabel(report.status)}</span><code>{report.reference}</code><time dateTime={report.updatedAt}>{dateTime(report.updatedAt)}</time></header>
        <small>{categoryLabel(report.category)} · {report.priority} priority</small>
        <h3>{report.title}</h3>
        <p>{report.description}</p>
        {report.assignedToDisplayName && <div className={styles.assignee}><ShieldCheck /> Being handled by {report.assignedToDisplayName}</div>}
        {report.resolution && <div className={styles.resolution}><CheckCircle2 /><p><b>Maintainer response</b><span>{report.resolution}</span></p></div>}
        <Link className={styles.ticketOpen} to={`/reports/${report.id}`}>Open full ticket <ChevronRight /></Link>
      </article>)}</div>
    </section>
  </AuthGate>;
}

function emptyForm(pageUrl: string): ReportFormState {
  return { category: "bug", title: "", description: "", reproductionSteps: "", expectedResult: "", actualResult: "", pageUrl };
}
