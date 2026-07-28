import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import styles from "./ProgressSummaryCard.module.css";

export interface ProgressSummaryStat {
  label: string;
  value: ReactNode;
}

export function ProgressSummaryCard({
  title,
  eyebrow,
  description,
  to,
  icon: Icon,
  progress,
  progressLabel,
  stats,
  children,
  tone = "cyan"
}: {
  title: string;
  eyebrow: string;
  description: string;
  to: string;
  icon: LucideIcon;
  progress?: number;
  progressLabel?: string;
  stats: ProgressSummaryStat[];
  children?: ReactNode;
  tone?: "cyan" | "gold" | "violet" | "green";
}) {
  const safeProgress = Math.max(0, Math.min(100, progress ?? 0));
  return <Link className={`${styles.card} ${styles[tone]}`} to={to}>
    <header>
      <span className={styles.icon}><Icon /></span>
      <div><small>{eyebrow}</small><h2>{title}</h2></div>
      <ArrowUpRight className={styles.open} />
    </header>
    <p>{description}</p>
    <div className={styles.stats}>{stats.map((stat) => <span key={stat.label}><small>{stat.label}</small><strong>{stat.value}</strong></span>)}</div>
    {progress !== undefined && <div className={styles.progress}>
      <span><small>{progressLabel || "Completion"}</small><strong>{safeProgress}%</strong></span>
      <i><span style={{ width: `${safeProgress}%` }} /></i>
    </div>}
    {children && <div className={styles.detail}>{children}</div>}
    <footer>Open tracker <ArrowUpRight /></footer>
  </Link>;
}
