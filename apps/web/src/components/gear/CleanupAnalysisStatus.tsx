import type { CleanupAnalysis, CleanupAnalyzeData } from "@guardian-nexus/contracts";
import { AlertTriangle, CheckCircle2, Database, LoaderCircle } from "lucide-react";
import styles from "./CleanupWorkspace.module.css";

export function CleanupAnalysisStatus({ analysis, status, error }: { analysis?: CleanupAnalysis; status?: CleanupAnalyzeData["status"]; error?: string }) {
  const coverage = analysis?.coverage;
  const processing = status === "refreshing" || coverage?.complete === false;
  const total = coverage?.totalItems || 0;
  const processed = Math.min(total, coverage?.processedItems || 0);
  const percent = total ? Math.round(processed / total * 100) : 0;
  const refreshingCompletedResult = status === "refreshing" && coverage?.complete === true;
  if (!analysis && processing) return <section className={styles.analysisStatus} data-state="processing" role="status"><LoaderCircle className={styles.spin} /><div><strong>Preparing your gear analysis</strong><span>Reading the saved inventory in safe batches. Results will appear here automatically.</span><progress aria-label="Cleanup analysis progress" /></div></section>;
  if (!analysis && error) return <section className={styles.analysisStatus} data-state="error" role="alert"><AlertTriangle /><div><strong>Analysis paused</strong><span>{error}</span></div></section>;
  if (!analysis) return null;
  return <section className={styles.analysisStatus} data-state={processing ? "processing" : "complete"} role="status">
    {processing ? <LoaderCircle className={styles.spin} /> : <CheckCircle2 />}
    <div className={styles.analysisStatusBody}>
      <header><span><strong>{refreshingCompletedResult ? "Refreshing your inventory analysis" : processing ? "Checking your saved gear" : "Inventory analysis ready"}</strong><small>{refreshingCompletedResult ? "Showing the previous complete results while the next safe pass starts." : coverage ? `${processed.toLocaleString()} of ${total.toLocaleString()} items · batch ${coverage.page} of ${coverage.pages}` : "Saved analysis"}</small></span><b>{refreshingCompletedResult ? "Updating" : coverage ? `${percent}%` : "Saved"}</b></header>
      {coverage && (refreshingCompletedResult ? <progress aria-label="Cleanup analysis progress" /> : <progress aria-label="Cleanup analysis progress" max={Math.max(1, total)} value={processed} />)}
      <div className={styles.analysisFacts}><span><Database />{analysis.recommendations.length} recommendations found so far</span><span><AlertTriangle />{analysis.dataIssues?.length || analysis.insufficient.length} need more Bungie data</span>{coverage?.unreadableItems ? <span><AlertTriangle />{coverage.unreadableItems} unreadable saved records</span> : null}</div>
      {error && <p>{error}</p>}
      {Boolean(analysis.dataIssues?.length) && <details className={styles.dataIssues}><summary>Why some items could not be compared</summary><div>{analysis.dataIssues!.slice(0, 30).map((issue) => <p key={issue.itemId}><strong>{issue.name}</strong><span>{issue.reasons.join(" · ")}</span></p>)}</div>{analysis.dataIssues!.length > 30 && <small>Showing 30 of {analysis.dataIssues!.length} items. These are retried after Gear syncs.</small>}</details>}
    </div>
  </section>;
}
