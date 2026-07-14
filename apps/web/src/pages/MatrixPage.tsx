import type { CatalystState, MatrixData, MatrixSnapshot } from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleHelp, GitCompareArrows, RefreshCcw, Search, ShieldX, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { api, mutationHeaders } from "../api/client";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/Page";
import { useGuardian } from "../state/GuardianContext";
import styles from "./Pages.module.css";

export function MatrixPage() {
  const { session } = useGuardian();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "difference" | "missing">("all");
  const result = useQuery({ queryKey: ["matrix"], queryFn: () => api<MatrixData>("/api/v1/matrix"), enabled: Boolean(session?.authenticated) });
  const sync = useMutation({ mutationFn: () => api("/api/v1/matrix/sync", { method: "POST", headers: mutationHeaders(session?.csrfToken) }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["matrix"] }) });
  const snapshots = result.data?.data.snapshots || [];
  const rows = useMemo(() => {
    const items = new Map<string, { itemHash: string; name: string; kind: string; states: Map<string, { owned: boolean; catalyst: CatalystState }> }>();
    snapshots.forEach((snapshot) => snapshot.entries.forEach((entry) => {
      const row = items.get(entry.itemHash) || { itemHash: entry.itemHash, name: entry.name, kind: entry.kind, states: new Map() };
      row.states.set(snapshot.membershipId, { owned: entry.owned, catalyst: entry.catalyst });
      items.set(entry.itemHash, row);
    }));
    return [...items.values()].filter((row) => {
      const matches = !search || `${row.name} ${row.kind}`.toLowerCase().includes(search.toLowerCase());
      const states = snapshots.map((snapshot) => row.states.get(snapshot.membershipId)?.owned);
      const differs = new Set(states).size > 1;
      const anyMissing = states.some((owned) => owned === false);
      return matches && (status === "all" || (status === "difference" && differs) || (status === "missing" && anyMissing));
    }).sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  }, [snapshots, search, status]);

  return <AuthGate>
    <PageHeader eyebrow="Three-Guardian comparison" title="Guardian Matrix" description="Compare the latest explicitly synced Exotic ownership and catalyst state for ErebusAres, IceeDedPple, and FearsRedemption." actions={<><Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />{result.data?.data.canSync && <button className={styles.primaryAction} onClick={() => sync.mutate()} disabled={sync.isPending}><RefreshCcw size={15} />{sync.isPending ? "Synchronizing…" : "Sync my Matrix"}</button>}</>} />
    <QueryState loading={result.isLoading} error={result.error as Error} onRetry={() => void result.refetch()} />
    {result.data && snapshots.length === 0 && <div className={styles.inlineEmpty}><GitCompareArrows /><h2>Matrix awaiting first sync</h2><p>Each approved Guardian must sign in and explicitly sync their own latest snapshot.</p></div>}
    {snapshots.length > 0 && <>
      <section className={styles.matrixGuardians}>{snapshots.map((snapshot) => <GuardianColumn key={snapshot.membershipId} snapshot={snapshot} />)}</section>
      <section className={styles.commandBar}><label className={styles.search}><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search compared Exotics…" /></label><div className={styles.questFilters}>{(["all", "difference", "missing"] as const).map((value) => <button key={value} className={status === value ? styles.activeFilter : ""} onClick={() => setStatus(value)}>{value === "all" ? "All items" : value === "difference" ? "Differences" : "Missing anywhere"}</button>)}</div><strong className={styles.resultCount}>{rows.length} rows</strong></section>
      <div className={styles.matrixWrap}><table className={styles.matrixTable}><thead><tr><th>Exotic</th>{snapshots.map((snapshot) => <th key={snapshot.membershipId}>{snapshot.displayName}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.itemHash}><th><span>{row.kind}</span><strong>{row.name}</strong></th>{snapshots.map((snapshot) => <td key={snapshot.membershipId}><MatrixCell state={row.states.get(snapshot.membershipId)} /></td>)}</tr>)}</tbody></table></div>
    </>}
  </AuthGate>;
}

function GuardianColumn({ snapshot }: { snapshot: MatrixSnapshot }) {
  const owned = snapshot.entries.filter((entry) => entry.owned).length;
  const complete = snapshot.entries.filter((entry) => entry.catalyst === "complete").length;
  const stale = Date.now() - Date.parse(snapshot.syncedAt) > 86_400_000;
  return <article><Sparkles /><div><span>{stale ? "Snapshot stale" : "Latest snapshot"}</span><h2>{snapshot.displayName}</h2><p>{owned}/{snapshot.entries.length} owned · {complete} catalysts complete</p></div><time>{new Date(snapshot.syncedAt).toLocaleString()}</time></article>;
}

function MatrixCell({ state }: { state?: { owned: boolean; catalyst: CatalystState } }) {
  if (!state) return <span className={`${styles.matrixCell} ${styles.unknown}`}><CircleHelp /> Unknown</span>;
  if (!state.owned) return <span className={`${styles.matrixCell} ${styles.matrixMissing}`}><ShieldX /> Missing</span>;
  return <span className={`${styles.matrixCell} ${state.catalyst === "complete" ? styles.matrixComplete : styles.matrixOwned}`}><Check />{state.catalyst === "complete" ? "Owned · Cat complete" : state.catalyst === "obtained" ? "Owned · Cat found" : "Owned"}</span>;
}
