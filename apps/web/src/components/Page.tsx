import { AlertTriangle, LoaderCircle, LogIn, RefreshCcw } from "lucide-react";
import type { ReactNode } from "react";
import { useGuardian } from "../state/GuardianContext";
import styles from "./Page.module.css";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <header className={styles.pageHeader}><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{actions && <div className={styles.actions}>{actions}</div>}</header>;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading, signIn } = useGuardian();
  if (loading) return <StatePanel icon={<LoaderCircle className={styles.spin} />} title="Contacting the Guardian network" text="Checking your secure Bungie session…" />;
  if (!session?.authenticated) return <StatePanel icon={<LogIn />} title="Link your Guardian" text="Sign in through Bungie to load your characters, collection, quests, and fireteam status." action={<button onClick={signIn}>Sign in with Bungie</button>} />;
  return <>{children}</>;
}

export function QueryState({ loading, error, empty, onRetry }: { loading: boolean; error?: Error | null; empty?: boolean; onRetry?: () => void }) {
  if (loading) return <StatePanel icon={<LoaderCircle className={styles.spin} />} title="Synchronizing" text="Reading fresh Guardian data…" />;
  if (error) return <StatePanel icon={<AlertTriangle />} title="Signal interrupted" text={error.message} action={onRetry && <button onClick={onRetry}><RefreshCcw size={16} /> Try again</button>} />;
  if (empty) return <StatePanel icon={<AlertTriangle />} title="No data returned" text="The current Bungie response did not include data for this view." />;
  return null;
}

export function StatePanel({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return <section className={styles.state}><div>{icon}</div><span>Guardian Nexus</span><h2>{title}</h2><p>{text}</p>{action}</section>;
}

export function Freshness({ observedAt, warning }: { observedAt?: string; warning?: string }) {
  return <div className={styles.freshness}><i /><span>{observedAt ? `Updated ${new Date(observedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Awaiting sync"}</span>{warning && <em>{warning}</em>}</div>;
}
