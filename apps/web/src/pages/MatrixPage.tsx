import type { CatalystState, MatrixData, MatrixGuardian, MatrixSnapshot } from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, CircleHelp, Eye, GitCompareArrows, LogIn, RefreshCcw, Search, ShieldX, UserRoundCheck, Users } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, mutationHeaders } from "../services/api/client";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import styles from "./Pages.module.css";

const MATRIX_PAGE_SIZE = 80;

export function MatrixPage() {
  const { session } = useGuardian();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "difference" | "missing">("all");
  const [selectedMembershipIds, setSelectedMembershipIds] = useState<string[]>([]);
  const [visibleRowCount, setVisibleRowCount] = useState(MATRIX_PAGE_SIZE);
  const deferredSearch = useDeferredValue(search);
  const result = useQuery({ queryKey: ["matrix"], queryFn: () => api<MatrixData>("/api/v1/matrix"), enabled: Boolean(session?.authenticated) });
  const sync = useMutation({ mutationFn: () => api("/api/v1/matrix/sync", { method: "POST", headers: mutationHeaders(session?.csrfToken) }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["matrix"] }) });
  const currentMembershipId = session?.guardian?.membershipId || "";
  const guardians = result.data?.data.guardians || [];
  const snapshots = result.data?.data.snapshots || [];
  const selectionKey = `guardian-nexus:${currentMembershipId || "observer"}:matrix-comparison-v2`;
  const guardianIds = guardians.map((guardian) => guardian.membershipId).join(",");

  useEffect(() => {
    if (!guardians.length) return;
    let stored: string[] = [];
    try { stored = JSON.parse(localStorage.getItem(selectionKey) || "[]"); } catch { stored = []; }
    setSelectedMembershipIds(defaultMatrixSelection(guardians, currentMembershipId, stored));
  }, [currentMembershipId, guardianIds, selectionKey]);

  const selectedGuardians = useMemo(() => {
    const selected = new Set(selectedMembershipIds);
    return guardians
      .filter((guardian) => selected.has(guardian.membershipId))
      .sort((left, right) => Number(right.membershipId === currentMembershipId) - Number(left.membershipId === currentMembershipId) || left.displayName.localeCompare(right.displayName));
  }, [guardians, selectedMembershipIds, currentMembershipId]);
  const selectedSnapshots = useMemo(() => {
    const selected = new Set(selectedMembershipIds);
    return snapshots.filter((snapshot) => selected.has(snapshot.membershipId));
  }, [snapshots, selectedMembershipIds]);
  const snapshotsByMembership = useMemo(() => new Map(snapshots.map((snapshot) => [snapshot.membershipId, snapshot])), [snapshots]);
  const rows = useMemo(() => {
    const items = new Map<string, { itemHash: string; name: string; kind: string; states: Map<string, { owned: boolean; catalyst: CatalystState }> }>();
    selectedSnapshots.forEach((snapshot) => snapshot.entries.forEach((entry) => {
      const row = items.get(entry.itemHash) || { itemHash: entry.itemHash, name: entry.name, kind: entry.kind, states: new Map() };
      row.states.set(snapshot.membershipId, { owned: entry.owned, catalyst: entry.catalyst });
      items.set(entry.itemHash, row);
    }));
    return [...items.values()].filter((row) => {
      const matches = !deferredSearch || `${row.name} ${row.kind}`.toLowerCase().includes(deferredSearch.toLowerCase());
      const states = selectedGuardians.map((guardian) => row.states.get(guardian.membershipId)?.owned);
      const differs = new Set(states).size > 1;
      const anyMissing = states.some((owned) => owned === false);
      return matches && (status === "all" || (status === "difference" && differs) || (status === "missing" && anyMissing));
    }).sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  }, [selectedSnapshots, selectedGuardians, deferredSearch, status]);
  const visibleRows = matrixRowsForPage(rows, visibleRowCount);

  useEffect(() => { setVisibleRowCount(MATRIX_PAGE_SIZE); }, [deferredSearch, status, selectedMembershipIds]);

  const selectGuardians = (membershipIds: string[]) => {
    const next = defaultMatrixSelection(guardians, currentMembershipId, membershipIds);
    setSelectedMembershipIds(next);
    localStorage.setItem(selectionKey, JSON.stringify(next));
  };
  const toggleGuardian = (membershipId: string) => {
    const selected = new Set(selectedMembershipIds);
    if (selected.has(membershipId)) selected.delete(membershipId); else selected.add(membershipId);
    if (!selected.size) return;
    selectGuardians([...selected]);
  };

  return <AuthGate>
    <PageHeader eyebrow="Guardian comparison" title="Guardian Matrix" description="Compare FearsRedemption, ErebusAres, and IceeDedPple side by side by default, then tailor the roster for your own Exotic and catalyst review." actions={<><Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />{result.data?.data.canSync && <button className={styles.primaryAction} onClick={() => sync.mutate()} disabled={sync.isPending}><RefreshCcw size={15} />{sync.isPending ? "Synchronizing…" : "Sync my Matrix"}</button>}</>} />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(result.data)} onRetry={() => void result.refetch()} />
    {result.data?.data.audience && <section className={styles.audiencePulse} aria-label="Private Guardian Nexus audience counters" title="Private to the three approved site maintainers. Visitors use an anonymous first-party browser identifier; no IP address or browsing history is stored.">
      <span><Eye /><small>Unique visitors</small><strong>{result.data.data.audience.uniqueVisitors.toLocaleString()}</strong></span>
      <span><LogIn /><small>Unique logins</small><strong>{result.data.data.audience.uniqueLogins.toLocaleString()}</strong></span>
      <time dateTime={result.data.data.audience.visitorsTrackingSince}>Visitors counted since {new Date(result.data.data.audience.visitorsTrackingSince).toLocaleDateString()}</time>
      <Link to="/audience">Details <ArrowRight /></Link>
    </section>}
    {guardians.length > 0 && <section className={styles.matrixRoster}>
      <header><div><Users /><span><strong>Choose your comparison</strong><small>Your selection is saved only in this browser.</small></span></div><nav><button type="button" onClick={() => selectGuardians(currentMembershipId && guardians.some((guardian) => guardian.membershipId === currentMembershipId) ? [currentMembershipId] : [guardians[0]!.membershipId])}>Just me</button><button type="button" onClick={() => selectGuardians(guardians.map((guardian) => guardian.membershipId))}>Compare all</button></nav></header>
      <div>{guardians.map((guardian) => {
        const selected = selectedMembershipIds.includes(guardian.membershipId);
        const isSelf = guardian.membershipId === currentMembershipId;
        return <button key={guardian.membershipId} type="button" className={selected ? styles.matrixGuardianSelected : ""} aria-pressed={selected} onClick={() => toggleGuardian(guardian.membershipId)}><i>{selected ? <Check /> : <CircleHelp />}</i><span>{isSelf ? "You" : guardian.hasSnapshot ? "Available to compare" : "Awaiting sync"}</span><strong>{guardian.displayName}</strong><small>{guardian.hasSnapshot && guardian.syncedAt ? `Synced ${new Date(guardian.syncedAt).toLocaleDateString()}` : "No Matrix snapshot yet"}</small></button>;
      })}</div>
    </section>}
    {result.data && guardians.length === 0 && <div className={styles.inlineEmpty}><GitCompareArrows /><h2>Matrix roster unavailable</h2><p>No approved Guardians are configured for comparison.</p></div>}
    {selectedGuardians.length > 0 && <>
      <section className={styles.matrixGuardians}>{selectedGuardians.map((guardian) => <GuardianColumn key={guardian.membershipId} guardian={guardian} snapshot={snapshotsByMembership.get(guardian.membershipId)} isSelf={guardian.membershipId === currentMembershipId} />)}</section>
      {selectedSnapshots.length === 0 ? <div className={styles.inlineEmpty}><GitCompareArrows /><h2>Selected Matrix awaiting sync</h2><p>Use “Sync my Matrix” to publish your snapshot. Each comparison Guardian keeps their own independent snapshot.</p></div> : <>
      <section className={styles.commandBar}><label className={styles.search}><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search compared Exotics…" /></label><div className={styles.questFilters}>{(["all", "difference", "missing"] as const).map((value) => <button key={value} className={status === value ? styles.activeFilter : ""} onClick={() => setStatus(value)}>{value === "all" ? "All items" : value === "difference" ? "Differences" : "Missing anywhere"}</button>)}</div><strong className={styles.resultCount}>{rows.length} rows</strong></section>
      <div className={styles.matrixWrap}><table className={styles.matrixTable}><thead><tr><th>Exotic</th>{selectedGuardians.map((guardian) => <th key={guardian.membershipId}>{guardian.displayName}</th>)}</tr></thead><tbody>{visibleRows.map((row) => <tr key={row.itemHash}><th><span>{row.kind}</span><strong>{row.name}</strong></th>{selectedGuardians.map((guardian) => <td key={guardian.membershipId}><MatrixCell state={row.states.get(guardian.membershipId)} /></td>)}</tr>)}</tbody></table></div>
      {visibleRows.length < rows.length && <button type="button" className={styles.matrixMore} onClick={() => setVisibleRowCount((count) => Math.min(rows.length, count + MATRIX_PAGE_SIZE))}>Show {Math.min(MATRIX_PAGE_SIZE, rows.length - visibleRows.length)} more <small>{visibleRows.length} of {rows.length} loaded</small></button>}
      </>}
    </>}
  </AuthGate>;
}

export function defaultMatrixSelection(guardians: MatrixGuardian[], _currentMembershipId: string, requested: string[]): string[] {
  const available = new Set(guardians.map((guardian) => guardian.membershipId));
  const valid = [...new Set(requested)].filter((membershipId) => available.has(membershipId));
  if (valid.length) return valid;
  return guardians.map((guardian) => guardian.membershipId);
}

export function matrixRowsForPage<T>(rows: T[], visibleRowCount: number): T[] {
  return rows.slice(0, Math.max(MATRIX_PAGE_SIZE, visibleRowCount));
}

function GuardianColumn({ guardian, snapshot, isSelf }: { guardian: MatrixGuardian; snapshot?: MatrixSnapshot; isSelf: boolean }) {
  if (!snapshot) return <article className={styles.matrixGuardianAwaiting}><CircleHelp /><div><span>{isSelf ? "Your snapshot" : "Comparison snapshot"}</span><h2>{guardian.displayName}</h2><p>Awaiting this Guardian's first Matrix sync</p></div><time>Not synced</time></article>;
  const owned = snapshot.entries.filter((entry) => entry.owned).length;
  const complete = snapshot.entries.filter((entry) => entry.catalyst === "complete").length;
  const stale = Date.now() - Date.parse(snapshot.syncedAt) > 86_400_000;
  return <article><UserRoundCheck /><div><span>{isSelf ? "Your Matrix" : stale ? "Snapshot stale" : "Comparison ready"}</span><h2>{snapshot.displayName}</h2><p>{owned}/{snapshot.entries.length} owned · {complete} catalysts complete</p></div><time>{new Date(snapshot.syncedAt).toLocaleString()}</time></article>;
}

function MatrixCell({ state }: { state?: { owned: boolean; catalyst: CatalystState } }) {
  if (!state) return <span className={`${styles.matrixCell} ${styles.unknown}`}><CircleHelp /> Unknown</span>;
  if (!state.owned) return <span className={`${styles.matrixCell} ${styles.matrixMissing}`}><ShieldX /> Missing</span>;
  return <span className={`${styles.matrixCell} ${state.catalyst === "complete" ? styles.matrixComplete : styles.matrixOwned}`}><Check />{state.catalyst === "complete" ? "Owned · Cat complete" : state.catalyst === "obtained" ? "Owned · Cat found" : "Owned"}</span>;
}
