import type { CommunityChallenge, CommunityChallengeMode, CommunityChallengesDocument } from "@guardian-nexus/contracts";
import { ArchiveRestore, Check, Circle, Copy, Download, Flag, FolderKanban, Plus, ShieldCheck, SkipForward, Trash2, Upload, Users } from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AuthGate, PageHeader } from "../components/common/Page";
import { JourneyNav } from "../components/journey/JourneyNav";
import { useGuardian } from "../context/GuardianContext";
import templates from "../assets/data/challenge-templates.v1.json";
import { challengeScore, challengeToProject, importChallenge, parseChallenges, portableChallenge } from "../modules/challenges/challenges";
import { parseProjects } from "../modules/projects/projects";
import styles from "./ChallengesPage.module.css";

const newId = (prefix: string) => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function ChallengesPage() {
  const { preferences, setPreference } = useGuardian();
  const document = useMemo(() => parseChallenges(preferences["challenges.v1"]), [preferences]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<CommunityChallengeMode>("solo");
  const [tasks, setTasks] = useState("");
  const [view, setView] = useState<"active" | "history">("active");
  const [message, setMessage] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const shown = document.challenges.filter((challenge) => view === "history" ? Boolean(challenge.completedAt) : !challenge.completedAt);
  const save = (next: CommunityChallengesDocument) => setPreference("challenges.v1", JSON.stringify(next));
  const create = (event: FormEvent) => {
    event.preventDefault();
    const entries = taskLines(tasks);
    if (!title.trim() || !entries.length || document.challenges.length >= 20) return;
    add({ title: title.trim(), description: description.trim() || undefined, mode, tasks: entries });
    setTitle(""); setDescription(""); setTasks("");
  };
  const add = (input: Pick<CommunityChallenge, "title" | "description" | "mode" | "tasks">) => {
    if (document.challenges.length >= 20) { setMessage("Challenge storage is full. Complete and delete a challenge before adding another."); return; }
    const now = new Date().toISOString();
    const challenge: CommunityChallenge = { ...input, id: newId("challenge"), tasks: input.tasks.map((task) => ({ ...task, id: newId("task"), state: "todo" })), createdAt: now, updatedAt: now };
    save({ schemaVersion: 1, challenges: [challenge, ...document.challenges].slice(0, 20) }); setMessage(`Added ${challenge.title} as a private player-recorded challenge.`);
  };
  const patchChallenge = (id: string, patch: Partial<CommunityChallenge>) => save({ schemaVersion: 1, challenges: document.challenges.map((entry) => entry.id === id ? { ...entry, ...patch, updatedAt: new Date().toISOString() } : entry) });
  const setTask = (challenge: CommunityChallenge, taskId: string) => patchChallenge(challenge.id, { tasks: challenge.tasks.map((task) => task.id !== taskId ? task : { ...task, state: task.state === "todo" ? "done" : task.state === "done" ? "skipped" : "todo" }) });
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file || document.challenges.length >= 20) return;
    try { const challenge = importChallenge(await file.text()); save({ schemaVersion: 1, challenges: [challenge, ...document.challenges] }); setMessage(`Imported ${challenge.title} as a fresh private challenge with no completion claims.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Challenge import failed."); }
  };
  const exportFile = (challenge: CommunityChallenge) => {
    const href = URL.createObjectURL(new Blob([JSON.stringify(portableChallenge(challenge), null, 2)], { type: "application/json" }));
    const anchor = globalThis.document.createElement("a"); anchor.href = href; anchor.download = `${challenge.title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "guardian-challenge"}.json`; anchor.click(); URL.revokeObjectURL(href); setMessage("Exported a clean challenge template without player names, scores, or completion history.");
  };
  const copyInvite = async (challenge: CommunityChallenge) => {
    const body = [`# ${challenge.title}`, challenge.description || "", `Mode: ${challenge.mode}`, "", ...challenge.tasks.map((task) => `- ${task.label} (${task.points} pt${task.points === 1 ? "" : "s"})`), "", "Progress is player-recorded; import the JSON invite to start a fresh private copy."].filter(Boolean).join("\n");
    try { await navigator.clipboard.writeText(body); setMessage("Copied an invitation without player names or scores."); } catch { setMessage("Clipboard access is unavailable. Export the challenge instead."); }
  };
  const sendToProjects = (challenge: CommunityChallenge) => {
    const projects = parseProjects(preferences["projects.v1"]);
    if (projects.projects.length >= 20) { setMessage("Guardian Projects is full. Archive or delete a project before sending this challenge."); return; }
    const project = challengeToProject(challenge); setPreference("projects.v1", JSON.stringify({ schemaVersion: 1, projects: [project, ...projects.projects] })); setMessage(`Sent ${challenge.title} to your private Guardian Projects workspace.`);
  };

  return <AuthGate>
    <PageHeader eyebrow="Player-created goals" title="Community challenges" description="Create or join custom challenges and track progress with friends. Challenge progress is entered by players." />
    <JourneyNav />
    <section className={styles.privacy}><ShieldCheck /><div><strong>Private until you share it</strong><p>Players enter their own scores and completion. Nothing is shared with your fireteam or clan unless you copy or export an invitation.</p></div><span>Challenges reviewed {new Date(templates.reviewedAt).toLocaleDateString()}</span></section>
    <section className={styles.templates}><header><div><span>Evergreen starters</span><h2>Challenge templates</h2></div><strong>{templates.templates.length} available</strong></header><div>{templates.templates.map((template) => <article key={template.id}><Flag /><span><small>{template.mode}</small><strong>{template.title}</strong><p>{template.description}</p></span><button type="button" disabled={document.challenges.length >= 20} onClick={() => add({ title: template.title, description: template.description, mode: template.mode as CommunityChallengeMode, tasks: template.tasks.map((task, index) => ({ id: `template-${index}`, label: task.label, points: task.points, state: "todo" })) })}><Plus /> Add</button></article>)}</div></section>
    <section className={styles.layout}>
      <form className={styles.creator} onSubmit={create}><header><Users /><div><span>Custom challenge</span><h2>Set the rules</h2></div></header>
        <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => void importFile(event)} /><button type="button" onClick={() => importRef.current?.click()}><Upload /> Import challenge invitation</button>
        <label><span>Title</span><input required maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Clan build bingo" /></label>
        <label><span>Mode</span><select value={mode} onChange={(event) => setMode(event.target.value as CommunityChallengeMode)}><option value="solo">Solo</option><option value="fireteam">Fireteam</option><option value="clan">Clan</option></select></label>
        <label><span>Goals <small>One per line</small></span><textarea required rows={6} maxLength={3200} value={tasks} onChange={(event) => setTasks(event.target.value)} placeholder={"Try a new subclass | 2\nFinish a collection step | 3"} /><small>Use <b>| points</b>; values are capped from 1 to 100.</small></label>
        <label><span>Description <small>Optional</small></span><textarea rows={3} maxLength={600} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <button type="submit" disabled={document.challenges.length >= 20}><Plus /> Save private challenge</button><p>{document.challenges.length}/20 challenges · up to 24 goals each.</p>{message && <p role="status">{message}</p>}
      </form>
      <section className={styles.board}><header><div><span>Player-recorded board</span><h2>{view === "active" ? "Active challenges" : "Challenge history"}</h2></div><div><button type="button" aria-pressed={view === "active"} onClick={() => setView("active")}>Active</button><button type="button" aria-pressed={view === "history"} onClick={() => setView("history")}>History</button></div></header>
        {!shown.length && <div className={styles.empty}><Flag /><strong>No {view} challenges</strong><p>Add a template, make a custom challenge, or import an invitation.</p></div>}
        <div className={styles.cards}>{shown.map((challenge) => { const score = challengeScore(challenge); return <article key={challenge.id}><header><div><span>{challenge.mode}</span><h3>{challenge.title}</h3></div><b>{score.earned}/{score.total}</b></header>{challenge.description && <p>{challenge.description}</p>}<div className={styles.score}><i style={{ width: `${score.total ? Math.round(score.earned / score.total * 100) : 0}%` }} /><span>{score.total ? Math.round(score.earned / score.total * 100) : 0}% player-recorded</span></div><ul>{challenge.tasks.map((task) => <li key={task.id} data-state={task.state}><button type="button" aria-label={`Cycle ${task.label} status`} onClick={() => setTask(challenge, task.id)}>{task.state === "done" ? <Check /> : task.state === "skipped" ? <SkipForward /> : <Circle />}</button><span>{task.label}</span><b>{task.points}</b></li>)}</ul><footer><button type="button" onClick={() => void copyInvite(challenge)}><Copy /> Invite</button><button type="button" onClick={() => exportFile(challenge)}><Download /> JSON</button><button type="button" onClick={() => sendToProjects(challenge)}><FolderKanban /> Project</button><button type="button" onClick={() => patchChallenge(challenge.id, { completedAt: challenge.completedAt ? undefined : new Date().toISOString() })}><ArchiveRestore /> {challenge.completedAt ? "Restore" : "Complete"}</button><button type="button" aria-label={`Delete ${challenge.title}`} onClick={() => save({ schemaVersion: 1, challenges: document.challenges.filter((entry) => entry.id !== challenge.id) })}><Trash2 /></button></footer></article>; })}</div>
      </section>
    </section>
  </AuthGate>;
}

function taskLines(value: string) {
  return value.split("\n").map((line, index) => { const [label = "", rawPoints = "1"] = line.split("|"); const clean = label.trim().slice(0, 120); const points = Math.max(1, Math.min(100, Math.round(Number(rawPoints.trim()) || 1))); return clean ? { id: `draft-${index}`, label: clean, points, state: "todo" as const } : null; }).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)).slice(0, 24);
}
