import type { DevProbeKey, DevProbeResult } from "@guardian-nexus/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Braces, Download, FlaskConical, Search, Send, ShieldAlert, TimerReset } from "lucide-react";
import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, mutationHeaders } from "../services/api/client";
import { AuthGate, PageHeader } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import styles from "./Pages.module.css";

const probes: { key: DevProbeKey; label: string; needsHash?: boolean; needsCharacter?: boolean }[] = [
  { key: "memberships", label: "Current memberships" }, { key: "profile", label: "Profile components" }, { key: "character", label: "Character components", needsCharacter: true }, { key: "item", label: "Inventory definition", needsHash: true }, { key: "collectible", label: "Collectible definition", needsHash: true }, { key: "public-milestones", label: "Public milestones" }, { key: "manifest", label: "Manifest metadata" }
];

export function DevPage() {
  const { session, selectedCharacterId } = useGuardian();
  const [probe, setProbe] = useState<DevProbeKey>("profile");
  const [hash, setHash] = useState("");
  const [components, setComponents] = useState("100,200,202,800,900,1000");
  const [search, setSearch] = useState("");
  const [previous, setPrevious] = useState<DevProbeResult | null>(null);
  const mutation = useMutation({
    mutationFn: () => api<DevProbeResult>("/api/v1/dev/probe", { method: "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ probe, hash: hash || undefined, characterId: selectedCharacterId || undefined, components: components.split(",").map(Number).filter(Number.isFinite) }) }),
    onMutate: () => { if (mutation.data?.data) setPrevious(mutation.data.data); }
  });
  const manifestSearch = useQuery({ queryKey: ["manifest-search", search], queryFn: () => api<{ query: string; manifestVersion: string; results: any[] }>(`/api/v1/dev/manifest/search?q=${encodeURIComponent(search)}`), enabled: search.length >= 2 });
  const selectedProbe = probes.find((entry) => entry.key === probe)!;
  const diff = useMemo(() => previous && mutation.data?.data ? { previousBytes: previous.responseSize, currentBytes: mutation.data.data.responseSize, durationDelta: mutation.data.data.durationMs - previous.durationMs } : null, [previous, mutation.data]);
  if (session?.authenticated && !session.roles.dev) return <Navigate to="/collection" replace />;

  return <AuthGate>
    <PageHeader eyebrow="Restricted diagnostics" title="API Lab" description="Allowlisted, read-only Bungie probes with sensitive-field redaction, timing, response comparison, and sanitized fixture export." />
    <section className={styles.devWarning}><ShieldAlert /><div><strong>Server-enforced developer access</strong><p>Requests are restricted by verified membership ID. Arbitrary URLs, methods, tokens, and unredacted exports are not supported.</p></div></section>
    <div className={styles.devLayout}>
      <section className={styles.probePanel}><header><FlaskConical /><div><span>Probe configuration</span><h2>Safe request</h2></div></header><label><span>Endpoint</span><select value={probe} onChange={(event) => setProbe(event.target.value as DevProbeKey)}>{probes.map((entry) => <option key={entry.key} value={entry.key}>{entry.label}</option>)}</select></label>{selectedProbe.needsHash && <label><span>Definition hash</span><input value={hash} onChange={(event) => setHash(event.target.value.replace(/\D/g, ""))} placeholder="Numeric Bungie hash" /></label>}{(probe === "profile" || probe === "character") && <label><span>Components</span><input value={components} onChange={(event) => setComponents(event.target.value)} /></label>}<button className={styles.primaryAction} onClick={() => mutation.mutate()} disabled={mutation.isPending || (selectedProbe.needsHash && !hash)}><Send size={15} />{mutation.isPending ? "Running…" : "Run read-only probe"}</button>
        <div className={styles.manifestSearch}><label><span>Compact manifest search</span><div><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search at least 2 characters" /></div></label>{manifestSearch.data?.data.results.slice(0, 8).map((entry) => <button key={entry.itemHash} onClick={() => { setProbe("item"); setHash(entry.itemHash); }}>{entry.name}<small>{entry.itemHash}</small></button>)}</div>
      </section>
      <section className={styles.responsePanel}><header><div><Braces /><span>Sanitized response</span></div>{mutation.data?.data && <button onClick={() => downloadFixture(mutation.data!.data)}><Download size={14} /> Export fixture</button>}</header>{mutation.error && <p className={styles.devError}>{(mutation.error as Error).message}</p>}{mutation.data?.data ? <><div className={styles.responseStats}><span>Status <b>{mutation.data.data.status}</b></span><span>Duration <b>{mutation.data.data.durationMs}ms</b></span><span>Size <b>{mutation.data.data.responseSize.toLocaleString()} B</b></span><span>Throttle <b>{mutation.data.data.throttleSeconds}s</b></span>{diff && <span><TimerReset size={12} /> Delta <b>{diff.durationDelta >= 0 ? "+" : ""}{diff.durationDelta}ms</b></span>}</div><pre>{JSON.stringify(mutation.data.data.body, null, 2)}</pre></> : <div className={styles.devPlaceholder}><Braces /><h2>No probe run yet</h2><p>Choose an allowlisted request to inspect its redacted response.</p></div>}</section>
    </div>
  </AuthGate>;
}

function downloadFixture(result: DevProbeResult) {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...result }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = `guardian-nexus-${result.probe}-fixture.json`; link.click(); URL.revokeObjectURL(url);
}
