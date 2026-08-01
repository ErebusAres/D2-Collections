import type { FireteamReadinessState, FireteamReadinessSummary, GuardianBuild } from "@guardian-nexus/contracts";
import { ExternalLink, ShieldCheck } from "lucide-react";
import type { FireteamReadinessDraft } from "../../modules/fireteam/readiness";
import styles from "./FireteamReadinessPanel.module.css";

const states: { value: FireteamReadinessState; label: string }[] = [
  { value: "not-checked", label: "Not checked" },
  { value: "needs-attention", label: "Needs attention" },
  { value: "ready", label: "Ready" }
];

export function FireteamReadinessPanel({ draft, builds, sharing, onChange }: { draft: FireteamReadinessDraft; builds: GuardianBuild[]; sharing: boolean; onChange: (draft: FireteamReadinessDraft) => void }) {
  const update = <K extends keyof FireteamReadinessDraft>(key: K, value: FireteamReadinessDraft[K]) => onChange({ ...draft, [key]: value });
  return <section className={styles.panel} aria-labelledby="readiness-title">
    <header><div><ShieldCheck /><span>Activity preparation</span><h2 id="readiness-title">Fireteam readiness</h2></div><a href="https://www.bungie.net/7/en/fireteamfinder?activityType=0&platform=0" target="_blank" rel="noreferrer">Open Bungie Fireteam Finder <ExternalLink /></a></header>
    <p>Prepare here, recruit through Bungie. This private draft shares only the summary below when you opt in—never inventory or Collections.</p>
    <div className={styles.fields}>
      <label><span>Activity</span><input value={draft.activityName} maxLength={80} placeholder="Grandmaster, raid encounter, dungeon…" onChange={(event) => update("activityName", event.target.value)} /></label>
      <label><span>Role</span><select value={draft.role} onChange={(event) => update("role", event.target.value as FireteamReadinessDraft["role"])}><option value="flex">Flexible</option><option value="damage">Damage</option><option value="support">Support</option><option value="control">Control</option></select></label>
      <label><span>Overall check</span><select value={draft.state} onChange={(event) => update("state", event.target.value as FireteamReadinessState)}>{states.map((state) => <option key={state.value} value={state.value}>{state.label}</option>)}</select></label>
      <label><span>Selected public build</span><select value={draft.buildId} onChange={(event) => update("buildId", event.target.value)}><option value="">No build summary</option>{builds.map((build) => <option key={build.id} value={build.id}>{build.title} · {build.subclass}</option>)}</select></label>
    </div>
    <div className={styles.checks}>{draft.prerequisites.map((check, index) => <label key={check.id}><span>{check.label}</span><select value={check.state} onChange={(event) => update("prerequisites", draft.prerequisites.map((entry, entryIndex) => entryIndex === index ? { ...entry, state: event.target.value as FireteamReadinessState } : entry))}>{states.map((state) => <option key={state.value} value={state.value}>{state.label}</option>)}</select></label>)}</div>
    <label className={styles.note}><span>Short note (optional)</span><input value={draft.note} maxLength={240} placeholder="Encounter assignment, loadout caveat, or help needed" onChange={(event) => update("note", event.target.value)} /></label>
    <label className={styles.consent}><input type="checkbox" checked={draft.enabled} onChange={(event) => update("enabled", event.target.checked)} /><span><b>Share this readiness summary</b><small>{sharing ? "Changes sync to your current Fireteam share." : "It will be included only when you start Fireteam sharing."}</small></span></label>
  </section>;
}

export function SharedReadiness({ summary }: { summary: FireteamReadinessSummary }) {
  return <section className={styles.shared} aria-label={`Readiness for ${summary.activityName}`}><header><span>{summary.activityName}</span><strong>{summary.state.replace("-", " ")}</strong></header><p>{summary.role} role{summary.build ? ` · ${summary.build.title}${summary.build.subclass ? ` · ${summary.build.subclass}` : ""}` : ""}</p><ul>{summary.prerequisites.map((check) => <li key={check.id} data-state={check.state}><i />{check.label}<b>{check.state.replace("-", " ")}</b></li>)}</ul>{summary.note && <small>{summary.note}</small>}</section>;
}
