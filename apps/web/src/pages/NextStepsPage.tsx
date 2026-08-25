import type { CollectionData, ExoticCollectionEntry, GuardianRankData, GuardianRankQuest, QuestData, QuestProgress } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, CheckCircle2, ChevronRight, Clock3, Compass, Crosshair, MapPin, Send, Shield, Sparkles, Swords, Timer } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthGate, PageHeader, QueryState } from "../components/common/Page";
import { pinsKey, useGuardian } from "../context/GuardianContext";
import { api } from "../services/api/client";
import styles from "./NextStepsPage.module.css";
import { ProjectsPage } from "./ProjectsPage";

export interface SuggestedGoal {
  id: string;
  title: string;
  detail: string;
  context: string;
  percent: number;
  to: string;
  quest?: QuestProgress;
  effortMinutes: 30 | 60 | 120;
  group: "solo" | "either" | "fireteam";
  kind: "quest" | "rank" | "exotic";
  reasons: string[];
  effortConfidence: "high" | "medium" | "low";
  effortReason: string;
  overlapKeys: string[];
  deadlineAt?: string;
  trackKind: "quest" | "guardian-rank" | "collection";
  trackId: string;
}

type SessionLength = 30 | 60 | 120;
type SessionMode = "solo" | "either" | "fireteam";
type SessionFocus = "any" | SuggestedGoal["kind"];

export function NextStepsPage() {
  const location = useLocation();
  return location.pathname.endsWith("/projects") ? <ProjectsPage /> : <SessionPlannerPage />;
}

function SessionPlannerPage() {
  const { session, selectedCharacterId, preferences, setPreference } = useGuardian();
  const membershipId = session?.guardian?.membershipId || "";
  const [tracked, setTracked] = useState<string[]>(() => readPins(membershipId, selectedCharacterId));
  const [routeSent, setRouteSent] = useState(false);
  const quests = useQuery({ queryKey: ["next-quests", selectedCharacterId], queryFn: () => api<QuestData>(`/api/v1/me/quests?characterId=${encodeURIComponent(selectedCharacterId)}&pinned=${encodeURIComponent(tracked.join(","))}`), enabled: Boolean(selectedCharacterId) });
  const ranks = useQuery({ queryKey: ["next-ranks", selectedCharacterId], queryFn: () => api<GuardianRankData>(`/api/v1/me/guardian-rank?characterId=${encodeURIComponent(selectedCharacterId)}`), enabled: Boolean(selectedCharacterId) });
  const collection = useQuery({ queryKey: ["next-collection", selectedCharacterId], queryFn: () => api<CollectionData>(`/api/v1/me/collection?characterId=${encodeURIComponent(selectedCharacterId)}`), enabled: Boolean(selectedCharacterId) });
  const loading = quests.isLoading || ranks.isLoading || collection.isLoading;
  const error = quests.error || ranks.error || collection.error;
  const hasData = Boolean(quests.data || ranks.data || collection.data);
  const sessionLength = sessionLengthPreference(preferences["planner.duration"]);
  const sessionMode = sessionModePreference(preferences["planner.mode"]);
  const sessionFocus = sessionFocusPreference(preferences["planner.focus"]);
  const recommendationPool = useMemo(() => gameSuggestions(quests.data?.data, ranks.data?.data, collection.data?.data), [quests.data, ranks.data, collection.data]);
  const recommendations = useMemo(() => planSession(recommendationPool, sessionLength, sessionMode, sessionFocus), [recommendationPool, sessionLength, sessionMode, sessionFocus]);
  const easyWeapons = useMemo(() => easyExotics(collection.data?.data, "weapon"), [collection.data]);
  const className = session?.guardian?.characters.find((entry) => entry.characterId === selectedCharacterId)?.className;
  const easyArmor = useMemo(() => easyExotics(collection.data?.data, "armor", className), [className, collection.data]);
  const trackQuest = (quest: QuestProgress) => {
    const next = tracked.includes(quest.instanceId) ? tracked.filter((id) => id !== quest.instanceId) : [...tracked, quest.instanceId];
    setTracked(next);
    try { localStorage.setItem(pinsKey(membershipId, selectedCharacterId), JSON.stringify(next)); } catch { /* Keep the current-page state. */ }
  };
  const sendRouteToFireteam = () => {
    const { questIds, rankIds, collectionIds } = fireteamRouteTargets(recommendations);
    const nextPins = [...new Set([...tracked, ...questIds])];
    setTracked(nextPins);
    try { localStorage.setItem(pinsKey(membershipId, selectedCharacterId), JSON.stringify(nextPins)); } catch { /* Keep the current-page state. */ }
    if (rankIds.length) setPreference("guardianRank.tracked", JSON.stringify([...new Set([...readStringPreference(preferences["guardianRank.tracked"]), ...rankIds])]));
    if (collectionIds.length) setPreference("collection.tracked", JSON.stringify([...new Set([...readStringPreference(preferences["collection.tracked"]), ...collectionIds])]));
    setRouteSent(true);
  };

  return <AuthGate>
    <PageHeader eyebrow="Recommended goals" title="Next Steps" description="Choose what to work on next from your active quests, Journey progress, weekly goals, and missing Exotics." actions={<Link to="/next/projects" style={{ minHeight: 36, display: "inline-flex", alignItems: "center", gap: 6, padding: "0 10px", border: "1px solid var(--line)", color: "var(--ink)", textDecoration: "none" }}><Compass size={16} /> Guardian projects</Link>} />
    <QueryState loading={loading} error={error as Error} hasData={hasData} onRetry={() => void Promise.all([quests.refetch(), ranks.refetch(), collection.refetch()])} />
    {hasData && <>
      <section className={styles.hero}><Compass /><div><span>Not sure what to do?</span><h2>Pick a route and keep Fireteam open</h2><p>Tracking a live pursuit adds it to the same shared Fireteam feed used by Destiny-tracked quests, Orders, and Guardian Rank objectives.</p></div></section>
      <section className={styles.planner} aria-label="Session planner">
        <header><Timer /><div><span>Plan my session</span><h2>{sessionLength} minute route</h2></div><strong>{recommendations.reduce((total, goal) => total + goal.effortMinutes, 0)} min planned</strong></header>
        <div>
          <label><span>Available time</span><select value={sessionLength} onChange={(event) => setPreference("planner.duration", event.target.value)}><option value="30">30 minutes</option><option value="60">60 minutes</option><option value="120">120 minutes</option></select></label>
          <label><span>Group preference</span><select value={sessionMode} onChange={(event) => setPreference("planner.mode", event.target.value)}><option value="solo">Solo friendly</option><option value="either">Solo or Fireteam</option><option value="fireteam">Fireteam activities</option></select></label>
          <label><span>Main goal</span><select value={sessionFocus} onChange={(event) => setPreference("planner.focus", event.target.value)}><option value="any">Best overlap</option><option value="quest">Quest progress</option><option value="rank">Guardian Rank</option><option value="exotic">Missing Exotics</option></select></label>
        </div>
        <footer><span><b>{overlapCount(recommendations)} overlapping objective{overlapCount(recommendations) === 1 ? "" : "s"}</b><small>{nextDeadline(recommendations) || "No known deadline in this route"}</small></span><button type="button" disabled={!recommendations.length} onClick={sendRouteToFireteam}><Send /> {routeSent ? "Route added" : "Send route to Fireteam"}</button>{routeSent && <Link to="/fireteam">Open Fireteam <ChevronRight /></Link>}</footer>
      </section>
      <section className={styles.section}>
        <header><Crosshair /><div><span>Recommended next</span><h2>{recommendations.length} game objectives</h2></div></header>
        <div className={styles.goalGrid}>{recommendations.length === 0 && <EmptySuggestion title="You're caught up" detail="No unfinished quests, rank objectives, or easy Exotic goals are available right now." />}{recommendations.map((goal) => <article className={styles.goal} key={goal.id}>
          <header><span>{goal.context} · {goal.effortMinutes} min ({goal.effortConfidence}) · {goal.group}</span><strong>{goal.percent}%</strong></header><h3>{goal.title}</h3><p>{goal.detail}</p><div className={styles.goalReasons}>{goal.reasons.map((reason) => <span key={reason}>{reason}</span>)}{sharedOverlapLabels(goal, recommendations).map((label) => <span key={`overlap-${label}`}>Overlaps: {label}</span>)}{goal.deadlineAt && <span><Clock3 /> {deadlineLabel(goal.deadlineAt)}</span>}</div><small className={styles.effortReason}>{goal.effortReason}</small><i><span style={{ width: `${goal.percent}%` }} /></i>
          <footer>{goal.quest && <button type="button" data-active={tracked.includes(goal.quest.instanceId)} onClick={() => trackQuest(goal.quest!)}><Bookmark />{tracked.includes(goal.quest.instanceId) ? "Tracked for Fireteam" : "Track this quest"}</button>}<Link to={goal.to}>Open details <ChevronRight /></Link></footer>
        </article>)}</div>
      </section>
      <ExoticSection title="Easy Exotic weapons" icon={<Swords />} entries={easyWeapons} quests={quests.data?.data.quests || []} tracked={tracked} onTrack={trackQuest} />
      <ExoticSection title={`Easy Exotic armor${className ? ` · ${className}` : ""}`} icon={<Shield />} entries={easyArmor} quests={quests.data?.data.quests || []} tracked={tracked} onTrack={trackQuest} />
    </>}
  </AuthGate>;
}

function ExoticSection({ title, icon, entries, quests, tracked, onTrack }: { title: string; icon: React.ReactNode; entries: ExoticCollectionEntry[]; quests: QuestProgress[]; tracked: string[]; onTrack: (quest: QuestProgress) => void }) {
  return <section className={styles.section}><header>{icon}<div><span>Collection expansion</span><h2>{title}</h2></div></header><div className={styles.exoticGrid}>{entries.length === 0 && <EmptySuggestion title="Collection complete here" detail={`You already own every ${title.toLocaleLowerCase()} currently eligible for an easy acquisition route.`} />}{entries.map((entry) => {
    const prerequisiteQuest = matchingQuest(entry, quests);
    return <article className={styles.exotic} key={entry.itemHash}>
      <header>{entry.icon ? <img src={entry.icon} alt="" /> : <Sparkles />}<div><span>{entry.itemType}</span><h3>{entry.name}</h3></div><b>{difficulty(entry)}</b></header>
      <p><MapPin /> {entry.guide.acquisition || entry.source || "Open Collections in Destiny to confirm the current source."}</p>
      {entry.guide.prerequisites.length > 0 && <div className={styles.prerequisites}><strong>Before you start</strong>{entry.guide.prerequisites.map((step) => <span key={step}>{step}</span>)}</div>}
      <ol>{entry.guide.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      <footer>{prerequisiteQuest ? <button type="button" data-active={tracked.includes(prerequisiteQuest.instanceId)} onClick={() => onTrack(prerequisiteQuest)}><Bookmark />{tracked.includes(prerequisiteQuest.instanceId) ? "Prerequisite tracked" : `Track ${prerequisiteQuest.name}`}</button> : <span><Timer /> Follow the route in Destiny</span>}<Link to="/collection">Collection details <ChevronRight /></Link></footer>
    </article>;
  })}</div></section>;
}

function EmptySuggestion({ title, detail }: { title: string; detail: string }) {
  return <div className={styles.emptySuggestion}><CheckCircle2 /><div><strong>{title}</strong><span>{detail}</span></div></div>;
}

function gameSuggestions(questData?: QuestData, rankData?: GuardianRankData, collectionData?: CollectionData): SuggestedGoal[] {
  const questGoals = (questData?.recommendations.map((entry) => entry.quest) || questData?.quests || [])
    .filter((quest, index, all) => quest.percent < 100 && all.findIndex((candidate) => candidate.instanceId === quest.instanceId) === index)
    .sort((left, right) => Number(right.inGameTracked) - Number(left.inGameTracked) || right.percent - left.percent)
    .slice(0, 6)
    .map((quest): SuggestedGoal => {
      const effort = effortForProgress(quest.percent, quest.objectives.length > 0);
      const text = `${quest.activityName || ""} ${quest.name} ${quest.currentStep || ""} ${quest.objectives.map((objective) => objective.name).join(" ")}`;
      return { id: `quest:${quest.instanceId}`, title: quest.name, detail: quest.currentStep || quest.description, context: quest.category === "order" ? "Vanguard Order" : quest.isExoticUnlock ? "Exotic quest" : "Quest", percent: quest.percent, to: `/quests/${encodeURIComponent(quest.instanceId)}`, quest, effortMinutes: effort.minutes, effortConfidence: effort.confidence, effortReason: effort.reason, overlapKeys: objectiveOverlapKeys(text), deadlineAt: quest.expiresAt, trackKind: "quest", trackId: quest.instanceId, group: activityGroup(text), kind: "quest", reasons: [quest.inGameTracked ? "Tracked in Destiny" : quest.sitePinned ? "Pinned in Guardian Nexus" : quest.percent >= 75 ? "Near completion" : quest.isExoticUnlock ? "Unlocks an Exotic" : "Active pursuit"] };
    });
  const rankGoals = currentRankQuests(rankData).slice(0, 2).map((quest): SuggestedGoal => ({
    id: `rank:${quest.recordHash}`, title: quest.name, detail: quest.description, context: "Guardian Rank", percent: objectivePercent(quest), to: "/journey/guardian-rank", ...rankEffort(quest), overlapKeys: objectiveOverlapKeys(`${quest.name} ${quest.description} ${quest.objectives.map((objective) => objective.name).join(" ")}`), trackKind: "guardian-rank", trackId: quest.recordHash, group: activityGroup(`${quest.name} ${quest.description}`), kind: "rank", reasons: ["Advances Guardian Rank"]
  }));
  const exoticGoals = easyExotics(collectionData, "weapon").slice(0, 2).map((entry): SuggestedGoal => ({
    id: `exotic:${entry.itemHash}`, title: `Obtain ${entry.name}`, detail: entry.guide.steps[0] || entry.guide.acquisition, context: "Missing Exotic", percent: 0, to: "/collection", ...exoticEffort(entry), overlapKeys: objectiveOverlapKeys(`${entry.guide.acquisition} ${entry.guide.steps.join(" ")}`), deadlineAt: entry.xurSelling ? collectionData?.xur.nextRefreshAt : undefined, trackKind: "collection", trackId: entry.itemHash, group: activityGroup(`${entry.guide.acquisition} ${entry.guide.steps.join(" ")}`), kind: "exotic", reasons: [entry.xurSelling ? "Available from Xûr now" : "Expands your collection"]
  }));
  return [...questGoals, ...rankGoals, ...exoticGoals].slice(0, 10);
}

export function planSession(goals: SuggestedGoal[], duration: SessionLength, mode: SessionMode, focus: SessionFocus): SuggestedGoal[] {
  const compatible = goals
    .filter((goal) => mode === "either" || (mode === "solo" ? goal.group !== "fireteam" : goal.group !== "solo"))
    .filter((goal) => focus === "any" || goal.kind === focus);
  const selected: SuggestedGoal[] = [];
  const remainingGoals = [...compatible];
  let remaining = duration;
  while (remainingGoals.length && selected.length < 6 && remaining > 0) {
    remainingGoals.sort((left, right) => sessionGoalScore(right, focus, selected) - sessionGoalScore(left, focus, selected) || left.effortMinutes - right.effortMinutes || left.title.localeCompare(right.title));
    const fittingIndex = remainingGoals.findIndex((goal) => goal.effortMinutes <= remaining || !selected.length);
    if (fittingIndex < 0) break;
    const goal = remainingGoals.splice(fittingIndex, 1)[0]!;
    selected.push(goal);
    remaining -= Math.min(remaining, goal.effortMinutes);
  }
  return selected.length ? selected : compatible.slice(0, 1);
}

export function fireteamRouteTargets(route: SuggestedGoal[]): { questIds: string[]; rankIds: string[]; collectionIds: string[] } {
  return {
    questIds: [...new Set(route.filter((goal) => goal.trackKind === "quest").map((goal) => goal.trackId))],
    rankIds: [...new Set(route.filter((goal) => goal.trackKind === "guardian-rank").map((goal) => goal.trackId))],
    collectionIds: [...new Set(route.filter((goal) => goal.trackKind === "collection").map((goal) => goal.trackId))]
  };
}

function sessionGoalScore(goal: SuggestedGoal, focus: SessionFocus, selected: SuggestedGoal[]): number {
  const overlap = new Set(selected.flatMap((entry) => entry.overlapKeys));
  const overlapBonus = goal.overlapKeys.filter((key) => overlap.has(key)).length * 180;
  const deadlineBonus = goal.deadlineAt ? deadlineUrgency(goal.deadlineAt) : 0;
  const confidenceBonus = goal.effortConfidence === "high" ? 40 : goal.effortConfidence === "medium" ? 20 : 0;
  return Number(focus !== "any" && goal.kind === focus) * 500 + Number(Boolean(goal.quest?.inGameTracked)) * 500 + Number(Boolean(goal.quest?.sitePinned)) * 250 + goal.percent * 2 + Number(goal.percent >= 75) * 200 + Number(goal.kind === "exotic") * 80 + overlapBonus + deadlineBonus + confidenceBonus - goal.effortMinutes;
}

function effortForProgress(percent: number, progressKnown: boolean): { minutes: 30 | 60 | 120; confidence: "medium" | "low"; reason: string } {
  const remaining = 100 - percent;
  const minutes = remaining <= 25 ? 30 : remaining <= 60 ? 60 : 120;
  return { minutes, confidence: progressKnown ? "medium" : "low", reason: progressKnown ? "Estimated from Bungie's remaining objective progress; activity time can vary." : "Coarse estimate because Bungie did not return objective-level progress." };
}

function rankEffort(quest: GuardianRankQuest): Pick<SuggestedGoal, "effortMinutes" | "effortConfidence" | "effortReason"> {
  const estimate = effortForProgress(objectivePercent(quest), quest.objectives.length > 0);
  return { effortMinutes: estimate.minutes, effortConfidence: estimate.confidence, effortReason: estimate.reason };
}

function exoticEffort(entry: ExoticCollectionEntry): Pick<SuggestedGoal, "effortMinutes" | "effortConfidence" | "effortReason"> {
  const effortMinutes = entry.xurSelling || entry.guide.steps.length <= 2 ? 30 : entry.guide.steps.length <= 4 ? 60 : 120;
  const deterministic = entry.xurSelling || /archive|collections|vendor|focusing|monument/i.test(`${entry.guide.acquisition} ${entry.source}`);
  return {
    effortMinutes,
    effortConfidence: deterministic && entry.guide.confidence === "verified" ? "high" : entry.guide.confidence === "pending" ? "low" : "medium",
    effortReason: deterministic ? "Estimate uses a documented deterministic acquisition route." : "Route length is estimated from guide steps; matchmaking and drop timing can vary."
  };
}

const OVERLAP_TERMS: Array<[RegExp, string]> = [
  [/vanguard|strike|nightfall/i, "Vanguard"], [/crucible|pvp|iron banner|trials/i, "Crucible"], [/gambit/i, "Gambit"],
  [/raid/i, "Raid"], [/dungeon/i, "Dungeon"], [/lost sector/i, "Lost Sector"], [/patrol|public event/i, "Destination"],
  [/solar/i, "Solar"], [/arc/i, "Arc"], [/void/i, "Void"], [/stasis/i, "Stasis"], [/strand/i, "Strand"],
  [/auto rifle/i, "Auto Rifle"], [/pulse rifle/i, "Pulse Rifle"], [/scout rifle/i, "Scout Rifle"], [/hand cannon/i, "Hand Cannon"],
  [/submachine|\bsmg\b/i, "SMG"], [/sidearm/i, "Sidearm"], [/bow/i, "Bow"], [/shotgun/i, "Shotgun"], [/sniper/i, "Sniper Rifle"],
  [/combatant|enemy|defeat|kill/i, "Combatants"], [/precision/i, "Precision"], [/ability|grenade|melee|super/i, "Abilities"]
];

function objectiveOverlapKeys(value: string): string[] {
  return OVERLAP_TERMS.filter(([pattern]) => pattern.test(value)).map(([, label]) => label);
}

function deadlineUrgency(deadlineAt: string, now = Date.now()): number {
  const remaining = Date.parse(deadlineAt) - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return -500;
  if (remaining <= 24 * 60 * 60_000) return 400;
  if (remaining <= 3 * 24 * 60 * 60_000) return 250;
  if (remaining <= 7 * 24 * 60 * 60_000) return 100;
  return 0;
}

function sharedOverlapLabels(goal: SuggestedGoal, route: SuggestedGoal[]): string[] {
  return goal.overlapKeys.filter((key) => route.some((candidate) => candidate.id !== goal.id && candidate.overlapKeys.includes(key)));
}

function overlapCount(route: SuggestedGoal[]): number {
  return route.filter((goal) => sharedOverlapLabels(goal, route).length > 0).length;
}

function deadlineLabel(deadlineAt: string): string {
  const remaining = Date.parse(deadlineAt) - Date.now();
  if (remaining <= 0) return "deadline passed";
  const hours = Math.ceil(remaining / 60 / 60_000);
  return hours <= 48 ? `${hours}h left` : `${Math.ceil(hours / 24)}d left`;
}

function nextDeadline(route: SuggestedGoal[]): string | undefined {
  const next = route.map((goal) => goal.deadlineAt).filter((value): value is string => typeof value === "string" && Date.parse(value) > Date.now()).sort((left, right) => Date.parse(left) - Date.parse(right))[0];
  return next ? `Next known deadline: ${deadlineLabel(next)}` : undefined;
}

function activityGroup(value: string): SuggestedGoal["group"] {
  if (/raid|dungeon|grandmaster|trials|fireteam|cooperative|expert/i.test(value)) return "fireteam";
  if (/lost sector|patrol|solo|campaign|collections|archive|vendor|xûr/i.test(value)) return "solo";
  return "either";
}

function sessionLengthPreference(value?: string): SessionLength { return value === "30" || value === "120" ? Number(value) as SessionLength : 60; }
function sessionModePreference(value?: string): SessionMode { return value === "solo" || value === "fireteam" ? value : "either"; }
function sessionFocusPreference(value?: string): SessionFocus { return value === "quest" || value === "rank" || value === "exotic" ? value : "any"; }

function easyExotics(data: CollectionData | undefined, kind: "weapon" | "armor", className?: string): ExoticCollectionEntry[] {
  return (data?.entries || []).filter((entry) => !entry.owned && entry.kind === kind && (!className || kind === "weapon" || !entry.className || entry.className === className))
    .filter((entry) => !/raid|dungeon|random drop|grandmaster|trials/i.test(`${entry.guide.acquisition} ${entry.source}`))
    .sort((left, right) => easyScore(right) - easyScore(left) || left.name.localeCompare(right.name))
    .slice(0, 8);
}

function easyScore(entry: ExoticCollectionEntry): number {
  const source = `${entry.guide.acquisition} ${entry.source}`;
  return Number(entry.xurSelling) * 100 + Number(entry.guide.confidence === "verified") * 20
    + Number(/archive|monument|quest|campaign|collections|focusing|vendor/i.test(source)) * 25
    + Math.max(0, 12 - entry.guide.steps.length * 2);
}

function difficulty(entry: ExoticCollectionEntry): string {
  if (entry.xurSelling) return "Available now";
  if (/archive|collections|vendor|focusing/i.test(`${entry.guide.acquisition} ${entry.source}`)) return "Quick";
  return entry.guide.steps.length <= 4 ? "Short route" : "Guided route";
}

function currentRankQuests(data?: GuardianRankData): GuardianRankQuest[] {
  const tier = data?.ranks.find((rank) => rank.rankNumber === data.suggestedRank) || data?.ranks.find((rank) => rank.state === "current" || rank.state === "next");
  return tier?.categories.flatMap((category) => category.quests).filter((quest) => quest.state !== "completed") || [];
}

function objectivePercent(quest: GuardianRankQuest): number {
  return quest.objectives.length ? Math.round(quest.objectives.reduce((sum, objective) => sum + objective.percent, 0) / quest.objectives.length) : 0;
}

function matchingQuest(entry: ExoticCollectionEntry, quests: QuestProgress[]): QuestProgress | undefined {
  const route = [...entry.guide.prerequisites, ...entry.guide.steps].join(" ").toLocaleLowerCase();
  return quests.find((quest) => route.includes(quest.name.toLocaleLowerCase()) || quest.rewards.some((reward) => reward.name === entry.name));
}

function readPins(membershipId: string, characterId: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(pinsKey(membershipId, characterId)) || "[]");
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch { return []; }
}

function readStringPreference(value?: string): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch { return []; }
}
