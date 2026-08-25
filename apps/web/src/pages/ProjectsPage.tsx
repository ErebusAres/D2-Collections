import type { GuardianProject, GuardianProjectItemState, GuardianProjectKind, GuardianProjectsDocument } from "@guardian-nexus/contracts";
import { ArchiveRestore, CalendarClock, Check, Circle, Copy, Download, ExternalLink, FolderKanban, Plus, SkipForward, Trash2, Upload, Users } from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AuthGate, PageHeader } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import { parseProjects, PROJECT_KINDS, projectProgress } from "../modules/projects/projects";
import { importPortableProject, portableProject, projectBrief } from "../modules/projects/portableProject";
import styles from "./ProjectsPage.module.css";

const newId = (prefix: string) => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function ProjectsPage() {
  const { preferences, setPreference } = useGuardian();
  const document = useMemo(() => parseProjects(preferences["projects.v1"]), [preferences]);
  const [kind, setKind] = useState<GuardianProjectKind>("activity");
  const [title, setTitle] = useState("");
  const [activity, setActivity] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [note, setNote] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [checklist, setChecklist] = useState("");
  const [view, setView] = useState<"active" | "history">("active");
  const [adapterMessage, setAdapterMessage] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const projects = document.projects.filter((project) => view === "history" ? Boolean(project.completedAt) : !project.completedAt);
  const save = (next: GuardianProjectsDocument) => setPreference("projects.v1", JSON.stringify(next));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || document.projects.length >= 20) return;
    const now = new Date().toISOString();
    const items = checklist.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 24).map((line) => {
      const [label = "", assignee] = line.split("|").map((value) => value.trim());
      return { id: newId("item"), label: label.slice(0, 100), state: "todo" as const, assignee: assignee?.slice(0, 60) || undefined };
    }).filter((item) => item.label);
    const project: GuardianProject = {
      id: newId("project"), kind, title: title.trim().slice(0, 80), activity: activity.trim().slice(0, 80) || undefined,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined, note: note.trim().slice(0, 600) || undefined,
      sourceUrl: safeUrl(sourceUrl), items, createdAt: now, updatedAt: now
    };
    save({ schemaVersion: 1, projects: [project, ...document.projects] });
    setTitle(""); setActivity(""); setScheduledAt(""); setNote(""); setSourceUrl(""); setChecklist("");
  };
  const patchProject = (id: string, patch: Partial<GuardianProject>) => save({ schemaVersion: 1, projects: document.projects.map((project) => project.id === id ? { ...project, ...patch, updatedAt: new Date().toISOString() } : project) });
  const setItemState = (project: GuardianProject, itemId: string, state: GuardianProjectItemState) => patchProject(project.id, { items: project.items.map((item) => item.id === itemId ? { ...item, state } : item) });
  const remove = (id: string) => save({ schemaVersion: 1, projects: document.projects.filter((project) => project.id !== id) });
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file || document.projects.length >= 20) return;
    try { const project = importPortableProject(await file.text()); save({ schemaVersion: 1, projects: [project, ...document.projects] }); setAdapterMessage(`Imported ${project.title} as a private active project.`); }
    catch (error) { setAdapterMessage(error instanceof Error ? error.message : "Project import failed."); }
  };
  const exportFile = (project: GuardianProject) => {
    const blob = new Blob([JSON.stringify(portableProject(project), null, 2)], { type: "application/json" }); const href = URL.createObjectURL(blob);
    const anchor = globalThis.document.createElement("a"); anchor.href = href; anchor.download = `${project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "guardian-project"}.json`; anchor.click(); URL.revokeObjectURL(href);
    setAdapterMessage("Exported the project without player names. Use Copy brief if you want a version that includes the assignee labels you entered.");
  };
  const copyBrief = async (project: GuardianProject) => {
    try { if (!navigator.clipboard) throw new Error("Clipboard unavailable"); await navigator.clipboard.writeText(projectBrief(project)); setAdapterMessage("Copied the project brief with its assignee labels."); }
    catch { setAdapterMessage("Clipboard access is unavailable. Export JSON instead."); }
  };

  return <AuthGate>
    <PageHeader eyebrow="Private coordination" title="Guardian projects" description="Plan activities, prepare clan sessions, and keep reusable collection checklists in one account-private workspace." />
    <section className={styles.privacy}><Users /><div><strong>Only you can see this workspace</strong><p>Names are optional planning labels, not verified Bungie identities. Nothing here is published or sent to clan members.</p></div><span>Versioned account preference</span></section>
    <section className={styles.layout}>
      <form className={styles.creator} onSubmit={submit}>
        <header><FolderKanban /><div><span>New project</span><h2>Build a plan</h2></div></header>
        <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => void importFile(event)} /><button type="button" onClick={() => importRef.current?.click()}><Upload /> Import portable project</button>
        <label><span>Project type</span><select value={kind} onChange={(event) => setKind(event.target.value as GuardianProjectKind)}>{PROJECT_KINDS.map((entry) => <option key={entry.kind} value={entry.kind}>{entry.label}</option>)}</select><small>{PROJECT_KINDS.find((entry) => entry.kind === kind)?.hint}</small></label>
        <label><span>Title</span><input required maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Master Crota checklist" /></label>
        <label><span>Activity or goal <small>Optional</small></span><input maxLength={80} value={activity} onChange={(event) => setActivity(event.target.value)} placeholder="Crota's End" /></label>
        <label><span>Scheduled time <small>Optional</small></span><input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
        <label><span>Checklist <small>One task per line</small></span><textarea rows={6} maxLength={2600} value={checklist} onChange={(event) => setChecklist(event.target.value)} placeholder={"Bring anti-barrier\nAssign swords | Fireteam lead\nCollect final pattern"} /><small>Add <b>| name or role</b> to assign a private display label.</small></label>
        <label><span>Notes <small>Optional</small></span><textarea rows={3} maxLength={600} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <label><span>Reference link <small>Optional</small></span><input type="url" maxLength={500} value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://..." /></label>
        <button type="submit" disabled={document.projects.length >= 20}><Plus /> Save private project</button>
        <p>{document.projects.length}/20 projects · up to 24 checklist items each.</p>{adapterMessage && <p role="status">{adapterMessage}</p>}
      </form>
      <section className={styles.board}>
        <header><div><span>Workspace</span><h2>{view === "active" ? "Active plans" : "Player-recorded history"}</h2></div><div className={styles.tabs}><button type="button" aria-pressed={view === "active"} onClick={() => setView("active")}>Active</button><button type="button" aria-pressed={view === "history"} onClick={() => setView("history")}>History</button></div></header>
        {!projects.length && <div className={styles.empty}><FolderKanban /><h3>{view === "active" ? "No active projects" : "No completed projects"}</h3><p>{view === "active" ? "Create a plan on the left. It will sync privately with your Guardian Nexus account." : "Completed plans appear here as a player-maintained record, not Bungie activity history."}</p></div>}
        <div className={styles.cards}>{projects.map((project) => {
          const progress = projectProgress(project);
          return <article key={project.id}>
            <header><div><span>{PROJECT_KINDS.find((entry) => entry.kind === project.kind)?.label}</span><h3>{project.title}</h3></div><b>{progress.percent}%</b></header>
            {project.activity && <strong>{project.activity}</strong>}
            {project.scheduledAt && <p><CalendarClock /> {new Date(project.scheduledAt).toLocaleString()}</p>}
            <div className={styles.progress}><i style={{ width: `${progress.percent}%` }} /><span>{progress.done} of {progress.total} actionable steps</span></div>
            <ul>{project.items.map((item) => <li key={item.id} data-state={item.state}>
              <button type="button" aria-label={`Mark ${item.label} ${item.state === "todo" ? "done" : item.state === "done" ? "skipped" : "todo"}`} onClick={() => setItemState(project, item.id, item.state === "todo" ? "done" : item.state === "done" ? "skipped" : "todo")}>{item.state === "done" ? <Check /> : item.state === "skipped" ? <SkipForward /> : <Circle />}</button>
              <span>{item.label}{item.assignee && <small>{item.assignee}</small>}</span>
            </li>)}</ul>
            {project.note && <blockquote>{project.note}</blockquote>}
            <footer>{project.sourceUrl && <a href={project.sourceUrl} target="_blank" rel="noreferrer">Reference <ExternalLink /></a>}<button type="button" onClick={() => void copyBrief(project)}><Copy /> Copy brief</button><button type="button" onClick={() => exportFile(project)}><Download /> Export JSON</button><button type="button" onClick={() => patchProject(project.id, { completedAt: project.completedAt ? undefined : new Date().toISOString() })}><ArchiveRestore /> {project.completedAt ? "Restore" : "Complete"}</button><button type="button" className={styles.delete} aria-label={`Delete ${project.title}`} onClick={() => remove(project.id)}><Trash2 /></button></footer>
          </article>;
        })}</div>
      </section>
    </section>
  </AuthGate>;
}

function safeUrl(value: string) {
  const candidate = value.trim();
  if (!candidate) return undefined;
  try { const url = new URL(candidate); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined; }
  catch { return undefined; }
}
