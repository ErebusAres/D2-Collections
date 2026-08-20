import { AlertTriangle, Copy } from "lucide-react";
import type { ConnectionFailure } from "../../services/api/client";
import styles from "./Shell.module.css";

export function ServiceIncidentBanner({ failure, copied, onCopy }: { failure: ConnectionFailure; copied: boolean; onCopy: () => Promise<void> }) {
  const cause = failure.code === "worker_resource_limit"
    ? "The server reached its processing limit. Automatic requests are paused briefly before retrying."
    : failure.code === "network_error"
      ? "The browser could not reach the server. This request may not appear in backend logs."
      : "The server could not complete this request. The reference below identifies the matching backend log entry.";
  return <aside className={styles.serviceIncident} role="alert" aria-label="Guardian services incident">
    <AlertTriangle />
    <div className={styles.incidentSummary}><strong>Guardian services interrupted</strong><span>{cause}</span><small>{failure.message}</small></div>
    <dl><div><dt>Route</dt><dd>{failure.route}</dd></div><div><dt>Error</dt><dd>{failure.code}</dd></div><div><dt>Status</dt><dd>{failure.status || "No response"}</dd></div><div><dt>Reference</dt><dd>{failure.requestId || "Unavailable"}</dd></div><div><dt>Occurred</dt><dd>{new Date(failure.occurredAt).toLocaleTimeString()}</dd></div></dl>
    <button type="button" onClick={() => void onCopy()}><Copy />{copied ? "Incident copied" : "Copy incident details"}</button>
  </aside>;
}
