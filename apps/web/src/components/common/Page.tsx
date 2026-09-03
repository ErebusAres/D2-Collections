import { AlertTriangle, LoaderCircle, LogIn, RefreshCcw } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import { useGuardian } from "../../context/GuardianContext";
import styles from "../../styles/common/Page.module.css";
import { describeApiError } from "../../services/api/client";

const PageHeaderTrailingActionsContext = createContext<ReactNode>(null);

export function PageHeaderTrailingActions({ children, actions }: { children: ReactNode; actions: ReactNode }) {
  return <PageHeaderTrailingActionsContext.Provider value={actions}>{children}</PageHeaderTrailingActionsContext.Provider>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  const trailingActions = useContext(PageHeaderTrailingActionsContext);
  return <header className={styles.pageHeader}><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{(actions || trailingActions) && <div className={styles.actions}>{actions}{trailingActions}</div>}</header>;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading, error, signIn, refresh } = useGuardian();
  if (loading && !session) return <StatePanel icon={<LoaderCircle className={styles.spin} />} title="Contacting the Guardian network" text="Checking your secure Bungie session…" />;
  if (error && !session?.authenticated) return <StatePanel icon={<AlertTriangle />} title="Guardian link interrupted" text={`${describeApiError(error)} Your Bungie link is still saved; you do not need to sign in again.`} action={<button onClick={() => void refresh()}><RefreshCcw size={16} /> Try again</button>} />;
  if (!session?.authenticated) return <StatePanel icon={<LogIn />} title="Link your Guardian" text="Sign in through Bungie to load your characters, collection, quests, and fireteam status." action={<button onClick={signIn}>Sign in with Bungie</button>} />;
  return <>{children}</>;
}

export function QueryState({ loading, error, empty, hasData = false, onRetry }: { loading: boolean; error?: Error | null; empty?: boolean; hasData?: boolean; onRetry?: () => void }) {
  if (loading) return <StatePanel loading icon={<LoaderCircle className={styles.spin} />} title="Synchronizing" text="Reading fresh Guardian data…" />;
  if (error && !hasData) return <StatePanel icon={<AlertTriangle />} title="Signal interrupted" text={describeApiError(error)} action={onRetry && <button onClick={onRetry}><RefreshCcw size={16} /> Try again</button>} />;
  if (empty) return <StatePanel icon={<AlertTriangle />} title="Data unavailable" text="Refresh to try again." />;
  return null;
}

function StatePanel({ icon, title, text, action, loading = false }: { icon: ReactNode; title: string; text: string; action?: ReactNode; loading?: boolean }) {
  return <section className={`${styles.state} ${loading ? styles.stateLoading : ""}`} aria-busy={loading || undefined}><div>{icon}</div><span>Guardian Nexus</span><h2>{title}</h2><p>{text}</p>{loading && <i className={styles.loadingRail} aria-hidden="true"><b /><b /><b /></i>}{action}</section>;
}

export function Freshness({ observedAt, warning, label = "Updated" }: { observedAt?: string; warning?: string; label?: string }) {
  return <div className={styles.freshness}><i /><span>{observedAt ? `${label} ${new Date(observedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Awaiting sync"}</span>{warning && <em>{warning}</em>}</div>;
}
