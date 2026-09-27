import { CheckCircle2, ShieldCheck, Tags } from "lucide-react";
import styles from "./CleanupWorkspace.module.css";

export function CleanupApprovalControl({ actionable, tagged, busy, stale, protections, onApprove }: {
  actionable: boolean;
  tagged: boolean;
  busy: boolean;
  stale: boolean;
  protections: string[];
  onApprove: () => void;
}) {
  if (tagged) return <div className={styles.approvalState} data-state="tagged"><CheckCircle2 size={14} /><span><strong>Approved and tagged</strong><small>Ready to verify in game.</small></span></div>;
  if (!actionable) return <div className={styles.approvalState} data-state="protected"><ShieldCheck size={14} /><span><strong>Approval unavailable</strong><small>{protections.length ? protections.join(", ") : "This item is protected by the cleanup rules."}</small></span></div>;
  if (stale) return <div className={styles.approvalState} data-state="stale"><ShieldCheck size={14} /><span><strong>Analyze again to approve</strong><small>The cleanup rules changed after this recommendation.</small></span></div>;
  return <button className={styles.approvalAction} type="button" disabled={busy} onClick={onApprove}><Tags size={14} />{busy ? "Tagging…" : "Approve & tag"}</button>;
}
