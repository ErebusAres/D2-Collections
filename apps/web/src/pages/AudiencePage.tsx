import type { AudienceDetailData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { Eye, LogIn, ShieldCheck, Users } from "lucide-react";
import { AuthGate, PageHeader, QueryState } from "../components/common/Page";
import { api } from "../services/api/client";
import styles from "./AudiencePage.module.css";

export function AudiencePage() {
  const result = useQuery({ queryKey: ["audience-details"], queryFn: () => api<AudienceDetailData>("/api/v1/audience") });
  const data = result.data?.data;
  return <AuthGate>
    <PageHeader eyebrow="Restricted site telemetry" title="Audience" description="Private first-party visitor and Bungie login records for approved Guardian Nexus maintainers." />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(result.data)} onRetry={() => void result.refetch()} />
    {data && <>
      <section className={styles.metrics}>
        <article><Eye /><span>Unique visitors</span><strong>{data.uniqueVisitors.toLocaleString()}</strong></article>
        <article><LogIn /><span>Unique Bungie logins</span><strong>{data.uniqueLogins.toLocaleString()}</strong></article>
        <p><ShieldCheck /> Anonymous visitors use a truncated, one-way identifier. Guardian Nexus does not store their IP address or browsing history.</p>
      </section>
      <section className={styles.panel}>
        <header><Users /><div><span>Authenticated Guardians</span><strong>{data.logins.length} identities</strong></div></header>
        <div className={styles.tableWrap}><table><thead><tr><th>Guardian</th><th>Membership ID</th><th>Class</th><th>Power</th><th>Rank / Pass</th><th>First login</th><th>Last login</th></tr></thead><tbody>
          {data.logins.map((row) => <tr key={row.membershipId}><td><span className={styles.guardian}>{row.emblemPath ? <img src={row.emblemPath} alt="" /> : <i><Users /></i>}<b>{row.bungieName || row.displayName}</b><small>{row.displayName}</small></span></td><td><code>{row.membershipId}</code></td><td>{row.characterClass || "Not sampled"}</td><td className={styles.power}>{row.power?.toLocaleString() || "—"}</td><td>{row.guardianRank ?? "—"} / {row.rewardsPassRank ?? "—"}</td><td>{dateTime(row.firstLoginAt)}</td><td>{dateTime(row.lastLoginAt)}</td></tr>)}
        </tbody></table></div>
      </section>
      <section className={styles.panel}>
        <header><Eye /><div><span>Anonymous visitors</span><strong>Most recent {data.visitors.length}</strong></div></header>
        <div className={styles.visitors}>{data.visitors.map((row) => <span key={`${row.visitorId}-${row.firstSeenAt}`}><code>{row.visitorId}</code><time dateTime={row.firstSeenAt}>{dateTime(row.firstSeenAt)}</time></span>)}</div>
      </section>
    </>}
  </AuthGate>;
}

function dateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
}
