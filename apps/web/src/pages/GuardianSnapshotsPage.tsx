import type { BuildsData, GuardianSnapshot, GuardianSnapshotDocument, GuardianSnapshotsData } from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardCopy, EyeOff, IdCard, Link2, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
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
  const { session, selectedCharacterId } = useGuardian();
  const queryClient = useQueryClient();
  const guardian = session?.guardian;
  const character = guardian?.characters.find((entry) => entry.characterId === selectedCharacterId) || guardian?.characters[0];
  const result = useQuery({ queryKey: ["guardian-snapshots"], queryFn: () => api<GuardianSnapshotsData>("/api/v1/snapshots") });
  const builds = useQuery({ queryKey: ["builds"], queryFn: () => api<BuildsData>("/api/v1/builds"), staleTime: 5 * 60_000 });
  const [title, setTitle] = useState("Fireteam card");
  const [summary, setSummary] = useState("");
  const [visibility, setVisibility] = useState<"private" | "unlisted">("private");
  const [include, setInclude] = useState({ displayName: false, className: true, power: false, guardianRank: true });
  const [role, setRole] = useState("");
  const [buildId, setBuildId] = useState("");
  const [goals, setGoals] = useState("");
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState("");
  const selectedBuild = useMemo(() => builds.data?.data.builds.find((build) => build.id === buildId), [buildId, builds.data?.data.builds]);
  const create = useMutation({
    mutationFn: () => api<GuardianSnapshot>("/api/v1/snapshots", { method: "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ schemaVersion: 1, title, summary: summary || undefined, visibility, guardian: { displayName: include.displayName ? guardian?.displayName : undefined, className: include.className ? character?.className : undefined, power: include.power ? character?.power : undefined, guardianRank: include.guardianRank ? guardian?.stats.guardianRank : undefined }, role: role || undefined, selectedBuild: selectedBuild ? { title: selectedBuild.title, url: `${window.location.origin}/builds/${selectedBuild.slug}` } : undefined, goals: list(goals, 12), tags: list(tags, 12), note: note || undefined, source: "player-curated" } satisfies GuardianSnapshotDocument) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["guardian-snapshots"] })
  });
  const remove = useMutation({ mutationFn: (slug: string) => api(`/api/v1/snapshots/${encodeURIComponent(slug)}`, { method: "DELETE", headers: mutationHeaders(session?.csrfToken) }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["guardian-snapshots"] }) });
  const copy = async (snapshot: GuardianSnapshot) => { const url = `${window.location.origin}/snapshots/${snapshot.slug}`; await navigator.clipboard.writeText(url); setCopied(snapshot.slug); window.setTimeout(() => setCopied(""), 1_500); };
  return <>
    <PageHeader eyebrow="Player-curated sharing" title="Guardian snapshots" description="Choose each field deliberately. Inventory, Collections, membership IDs, and live presence are never supported in snapshots." />
    <section className={styles.editor}>
      <header><IdCard /><div><span>New private card</span><h2>Create snapshot</h2></div></header>
      <div className={styles.fields}><label><span>Title</span><input value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} /></label><label><span>Visibility</span><select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)}><option value="private">Private · only me</option><option value="unlisted">Unlisted · anyone with link</option></select></label><label className={styles.wide}><span>Summary</span><input value={summary} maxLength={300} onChange={(event) => setSummary(event.target.value)} /></label></div>
      <fieldset><legend>Include Guardian fields</legend>{Object.entries(include).map(([key, value]) => <label key={key}><input type="checkbox" checked={value} onChange={(event) => setInclude((current) => ({ ...current, [key]: event.target.checked }))} />{fieldLabel(key)}</label>)}</fieldset>
      <div className={styles.fields}><label><span>Role</span><input value={role} maxLength={60} onChange={(event) => setRole(event.target.value)} placeholder="Support, teacher, flex…" /></label><label><span>Public build</span><select value={buildId} onChange={(event) => setBuildId(event.target.value)}><option value="">No build</option>{(builds.data?.data.builds || []).map((build) => <option value={build.id} key={build.id}>{build.title}</option>)}</select></label><label><span>Goals (comma or line separated)</span><input value={goals} onChange={(event) => setGoals(event.target.value)} /></label><label><span>Tags</span><input value={tags} onChange={(event) => setTags(event.target.value)} /></label><label className={styles.wide}><span>Note</span><input value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} /></label></div>
      <footer><span><EyeOff /> Omitted fields remain private.</span><button className={styles.primary} disabled={!title.trim() || create.isPending} onClick={() => create.mutate()}><Plus /> Create snapshot</button></footer>
    </section>
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

function list(value: string, limit: number): string[] { return [...new Set(value.split(/[,\n]/).map((entry) => entry.trim()).filter(Boolean))].slice(0, limit); }
function fieldLabel(key: string): string { return key === "displayName" ? "Display name" : key === "className" ? "Class" : key === "guardianRank" ? "Guardian Rank" : "Power"; }
