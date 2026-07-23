import { Check, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { TrackedCompletionCandidate } from "../../modules/tracking/completionTracking";
import styles from "./CompletionPing.module.css";

export interface CompletionNotice extends TrackedCompletionCandidate {
  noticeId: string;
}

export function useCompletionPings() {
  const [notices, setNotices] = useState<CompletionNotice[]>([]);
  const announce = useCallback((completed: TrackedCompletionCandidate[]) => {
    if (!completed.length) return;
    setNotices((current) => {
      const known = new Set(current.map((notice) => notice.noticeId));
      const additions = completed
        .map((candidate) => ({ ...candidate, noticeId: `${candidate.kind}:${candidate.id}` }))
        .filter((notice) => !known.has(notice.noticeId));
      return [...current, ...additions];
    });
  }, []);
  const dismiss = useCallback(() => setNotices((current) => current.slice(1)), []);
  const clear = useCallback(() => setNotices([]), []);
  return { notice: notices[0], announce, dismiss, clear };
}

export function CompletionPing({ notice, onDismiss }: { notice?: CompletionNotice; onDismiss: () => void }) {
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(onDismiss, 4_800);
    return () => window.clearTimeout(timer);
  }, [notice, onDismiss]);
  if (!notice) return null;
  const label = notice.kind === "guardian-rank"
    ? "Guardian Rank objective complete"
    : notice.kind === "bounty"
      ? "Bounty complete"
      : notice.kind === "order"
        ? "Order complete"
        : "Quest complete";
  return <aside className={styles.ping} role="status" aria-live="polite" aria-atomic="true">
    <div className={styles.signal} aria-hidden="true"><Sparkles /><span><Check /></span></div>
    <div className={styles.copy}>
      <span>{label}</span>
      <strong>{notice.name}</strong>
      <small>{notice.trackedInGuardianNexus ? "Removed from Guardian Nexus tracking" : "Removed from Fireteam sharing"}</small>
    </div>
    <button type="button" onClick={onDismiss} aria-label="Dismiss completion notification"><X /></button>
    <i aria-hidden="true" />
  </aside>;
}
