import type { GuardianSnapshot, GuardianSnapshotsData } from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardCopy, IdCard, Link2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AuthGate, PageHeader, QueryState } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import { api, mutationHeaders } from "../services/api/client";
import styles from "./GuardianSnapshotsPage.module.css";

export function GuardianSnapshotsPage() {
  const { snapshotSlug } = useParams();
  return snapshotSlug ? <SnapshotView slug={snapshotSlug} /> : <AuthGate><SnapshotManager /></AuthGate>;
}

function SnapshotManager() {
  const { session } = useGuardian();
  const queryClient = useQueryClient();
  const result = useQuery({ queryKey: ["guardian-snapshots"], queryFn: () => api<GuardianSnapshotsData>("/api/v1/snapshots") });
  const [copied, setCopied] = useState("");
  const remove = useMutation({ mutationFn: (slug: string) => api(`/api/v1/snapshots/${encodeURIComponent(slug)}`, { method: "DELETE", headers: mutationHeaders(session?.csrfToken) }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["guardian-snapshots"] }) });
  const copy = async (snapshot: GuardianSnapshot) => { const url = `${window.location.origin}/snapshots/${snapshot.slug}`; await navigator.clipboard.writeText(url); setCopied(snapshot.slug); window.setTimeout(() => setCopied(""), 1_500); };
  return <>
    <PageHeader eyebrow="Legacy account data" title="Retired share cards" description="New cards can no longer be created. Existing cards remain here only so you can review, copy, or revoke them." actions={<><Link to="/builds">Share a build</Link><Link to="/fireteam">Fireteam</Link></>} />
    <section className={styles.explainer}><IdCard /><div><strong>This feature has been retired</strong><p>Share Cards duplicated public Builds and Fireteam sharing while requiring a manually maintained profile. Existing private data and unlisted links are preserved until you revoke them.</p></div></section>
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(result.data)} onRetry={() => void result.refetch()} />
    <section className={styles.grid}>{(result.data?.data.snapshots || []).map((snapshot) => <article key={snapshot.slug}><SnapshotContent snapshot={snapshot} /><footer>{snapshot.document.visibility === "unlisted" && <><Link to={`/snapshots/${snapshot.slug}`}><Link2 /> Open link</Link><button onClick={() => void copy(snapshot)}>{copied === snapshot.slug ? <Check /> : <ClipboardCopy />} {copied === snapshot.slug ? "Copied" : "Copy link"}</button></>}<button onClick={() => remove.mutate(snapshot.slug)}><Trash2 /> Revoke</button></footer></article>)}</section>
  </>;
}

function SnapshotView({ slug }: { slug: string }) {
  const result = useQuery({ queryKey: ["guardian-snapshot", slug], queryFn: () => api<GuardianSnapshot>(`/api/v1/snapshots/${encodeURIComponent(slug)}`) });
  return <><PageHeader eyebrow="Unlisted Guardian card" title={result.data?.data.document.title || "Guardian snapshot"} description="Player-curated snapshot · not live account verification" /><QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(result.data)} onRetry={() => void result.refetch()} />{result.data && <article className={styles.single}><SnapshotContent snapshot={result.data.data} /></article>}</>;
}

function SnapshotContent({ snapshot }: { snapshot: GuardianSnapshot }) {
  const { document } = snapshot;
  return <div className={styles.card}><header><span>{document.visibility} · player curated</span><h2>{document.title}</h2>{document.summary && <p>{document.summary}</p>}</header>{document.guardian && <dl>{document.guardian.displayName && <><dt>Guardian</dt><dd>{document.guardian.displayName}</dd></>}{document.guardian.className && <><dt>Class</dt><dd>{document.guardian.className}</dd></>}{document.guardian.power !== undefined && <><dt>Power</dt><dd>{document.guardian.power}</dd></>}{document.guardian.guardianRank !== undefined && <><dt>Guardian Rank</dt><dd>{document.guardian.guardianRank}</dd></>}</dl>}{document.role && <p><b>Role:</b> {document.role}</p>}{document.selectedBuild && <p><b>Build:</b> {document.selectedBuild.url ? <a href={document.selectedBuild.url}>{document.selectedBuild.title}</a> : document.selectedBuild.title}</p>}{document.goals.length > 0 && <div><b>Goals</b><ul>{document.goals.map((goal) => <li key={goal}>{goal}</li>)}</ul></div>}{document.tags.length > 0 && <aside>{document.tags.map((tag) => <span key={tag}>#{tag}</span>)}</aside>}{document.note && <small>{document.note}</small>}</div>;
}
