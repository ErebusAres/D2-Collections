import type { AudienceDetailData, AudienceLoginRow } from "@guardian-nexus/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, LogIn, LogOut, ShieldCheck, TriangleAlert, UserMinus, Users } from "lucide-react";
import { useState } from "react";
import { AuthGate, PageHeader, QueryState } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import { api, mutationHeaders } from "../services/api/client";
import styles from "./AudiencePage.module.css";

export function AudiencePage() {
  const { session } = useGuardian();
  const [confirmingMembershipId, setConfirmingMembershipId] = useState("");
  const [removingMembershipId, setRemovingMembershipId] = useState("");
  const result = useQuery({ queryKey: ["audience-details"], queryFn: () => api<AudienceDetailData>("/api/v1/audience") });
  const forceSignOut = useMutation({
    mutationFn: (membershipId: string) => api<{ membershipId: string; invalidatedSessions: number }>("/api/v1/audience/sessions", { method: "DELETE", headers: { "Content-Type": "application/json", ...mutationHeaders(session?.csrfToken) }, body: JSON.stringify({ membershipId }) }),
    onSuccess: () => { setConfirmingMembershipId(""); void result.refetch(); }
  });
  const removeAccount = useMutation({
    mutationFn: (membershipId: string) => api<{ membershipId: string; removed: boolean; invalidatedSessions: number }>("/api/v1/audience/account", { method: "DELETE", headers: { "Content-Type": "application/json", ...mutationHeaders(session?.csrfToken) }, body: JSON.stringify({ membershipId }) }),
    onSuccess: () => { setRemovingMembershipId(""); void result.refetch(); }
  });
  const data = result.data?.data;
  return <AuthGate>
    <PageHeader eyebrow="Restricted site telemetry" title="Audience" description="Visitor and Bungie login activity for site maintainers." />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(result.data)} onRetry={() => void result.refetch()} />
    {data && <>
      <section className={styles.metrics}>
        <article><Eye /><span>Unique visitors</span><strong>{data.uniqueVisitors.toLocaleString()}</strong></article>
        <article><LogIn /><span>Unique Bungie logins</span><strong>{data.uniqueLogins.toLocaleString()}</strong></article>
        <p><ShieldCheck /> Visitor IDs are truncated and one-way; IP addresses and browsing history are not stored.</p>
      </section>
      <section className={styles.panel}>
        <header><Users /><div><span>Authenticated Guardians</span><strong>{data.logins.length} identities</strong></div></header>
        {forceSignOut.error && <div className={styles.actionError}><TriangleAlert />{forceSignOut.error instanceof Error ? forceSignOut.error.message : "Guardian Nexus could not force this sign-out."}</div>}
        {removeAccount.error && <div className={styles.actionError}><TriangleAlert />{removeAccount.error instanceof Error ? removeAccount.error.message : "Guardian Nexus could not remove this account from Audience."}</div>}
        <div className={styles.tableWrap}><table><thead><tr><th>Guardian</th><th>Membership ID</th><th>Class</th><th>Power</th><th>Rank / Pass</th><th>First login</th><th>Last login</th><th>Sessions</th><th>Admin action</th></tr></thead><tbody>
          {data.logins.map((row) => {
            const self = row.membershipId === session?.guardian?.membershipId;
            return <AudienceGuardianRow key={row.membershipId} row={row} self={self} confirming={confirmingMembershipId === row.membershipId} removing={removingMembershipId === row.membershipId} busy={forceSignOut.isPending || removeAccount.isPending} onForce={() => forceSignOut.mutate(row.membershipId)} onRemove={() => removeAccount.mutate(row.membershipId)} onConfirmForce={() => { setRemovingMembershipId(""); setConfirmingMembershipId(row.membershipId); }} onConfirmRemove={() => { setConfirmingMembershipId(""); setRemovingMembershipId(row.membershipId); }} onCancel={() => { setConfirmingMembershipId(""); setRemovingMembershipId(""); }} />;
          })}
        </tbody></table></div>
      </section>
      <section className={styles.panel}>
        <header><Eye /><div><span>Anonymous visitors</span><strong>Most recent {data.visitors.length}</strong></div></header>
        <div className={styles.visitors}>{data.visitors.map((row) => <span key={`${row.visitorId}-${row.firstSeenAt}`}><code>{row.visitorId}</code><time dateTime={row.firstSeenAt}>{dateTime(row.firstSeenAt)}</time></span>)}</div>
      </section>
    </>}
  </AuthGate>;
}

function AudienceGuardianRow({ row, self, confirming, removing, busy, onForce, onRemove, onConfirmForce, onConfirmRemove, onCancel }: { row: AudienceLoginRow; self: boolean; confirming: boolean; removing: boolean; busy: boolean; onForce: () => void; onRemove: () => void; onConfirmForce: () => void; onConfirmRemove: () => void; onCancel: () => void }) {
  return <tr><td><span className={styles.guardian}>{row.emblemPath ? <img src={row.emblemPath} alt="" /> : <i><Users /></i>}<b>{row.bungieName || row.displayName}</b><small>{row.displayName}</small></span></td><td><code>{row.membershipId}</code></td><td>{row.characterClass || "Not sampled"}</td><td className={styles.power}>{row.power?.toLocaleString() || "—"}</td><td>{row.guardianRank ?? "—"} / {row.rewardsPassRank ?? "—"}</td><td>{dateTime(row.firstLoginAt)}</td><td>{dateTime(row.lastLoginAt)}</td><td>{row.activeSessions}</td><td>{removing ? <span className={styles.confirmAction}><button onClick={onRemove} disabled={busy}>Confirm remove account</button><button onClick={onCancel} disabled={busy}>Cancel</button></span> : confirming ? <span className={styles.confirmAction}><button onClick={onForce} disabled={busy}>Confirm force sign out</button><button onClick={onCancel} disabled={busy}>Cancel</button></span> : <span className={styles.adminActions}><button className={styles.forceAction} onClick={onConfirmForce} disabled={self || row.activeSessions === 0 || busy} title={self ? "Use the normal sign-out control for your own account" : row.activeSessions === 0 ? "This Guardian has no active Guardian Nexus sessions" : `Invalidate ${row.activeSessions} active session${row.activeSessions === 1 ? "" : "s"}`}><LogOut />{self ? "Current admin" : row.activeSessions === 0 ? "Signed out" : "Force sign out"}</button><button className={styles.removeAction} onClick={onConfirmRemove} disabled={self || busy} title="Hide this failed account from Audience and invalidate all sessions"><UserMinus />Remove account</button></span>}</td></tr>;
}

function dateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
}
