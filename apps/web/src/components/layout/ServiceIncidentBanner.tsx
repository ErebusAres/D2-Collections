import { AlertTriangle, Copy, X } from "lucide-react";
import type { ConnectionFailure } from "../../services/api/client";
import styles from "../../styles/layout/Shell.module.css";

export function ServiceIncidentBanner({ failure, copied, onCopy, onDismiss }: { failure: ConnectionFailure; copied: boolean; onCopy: () => Promise<void>; onDismiss: () => void }) {
  const cause = failure.code === "worker_resource_limit"
    ? "The server reached its processing limit. Automatic requests are paused briefly before retrying."
    : failure.code === "network_error"
      ? "Guardian Nexus could not be reached. Check your connection and try again."
      : "Guardian Nexus could not finish this request. Copy the report if the problem continues.";
  return <aside className={styles.serviceIncident} role="alert" aria-label="Guardian services incident">
    <AlertTriangle />
    <div className={styles.incidentSummary}><strong>Guardian Nexus is having trouble</strong><span>{cause}</span><small>{failure.message}</small></div>
    <details className={styles.incidentDetails}>
      <summary>Details</summary>
      <dl><div><dt>Route</dt><dd>{failure.route}</dd></div><div><dt>Error</dt><dd>{failure.code}</dd></div><div><dt>Status</dt><dd>{failure.status || "No response"}</dd></div><div><dt>Reference</dt><dd>{failure.requestId || "Unavailable"}</dd></div><div><dt>Occurred</dt><dd>{new Date(failure.occurredAt).toLocaleTimeString()}</dd></div></dl>
    </details>
    <div className={styles.incidentActions}>
      <button type="button" onClick={() => void onCopy()}><Copy />{copied ? "Copied" : "Copy report"}</button>
      <button type="button" onClick={onDismiss} aria-label="Dismiss service incident" title="Dismiss this incident"><X /></button>
    </div>
  </aside>;
}
