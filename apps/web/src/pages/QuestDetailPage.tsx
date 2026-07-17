import type { QuestData, QuestProgress, QuestStepProgress } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, CircleDashed, Crosshair, Gift, Lightbulb, ScrollText } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/api/client";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { pinsKey, useGuardian } from "../context/GuardianContext";
import { questProgressPresentation } from "../modules/quests/questProgress";
import styles from "./Pages.module.css";
import questStyles from "./QuestsPage.module.css";

export function QuestDetailPage() {
  const { questId = "" } = useParams();
  const { session, selectedCharacterId } = useGuardian();
  const membershipId = session?.guardian?.membershipId || "";
  let pinnedIds: string[] = [];
  try { pinnedIds = JSON.parse(localStorage.getItem(pinsKey(membershipId, selectedCharacterId)) || "[]") as string[]; } catch { pinnedIds = []; }
  const result = useQuery({
    queryKey: ["quests", selectedCharacterId, pinnedIds.join(",")],
    queryFn: () => api<QuestData>(`/api/v1/me/quests?characterId=${encodeURIComponent(selectedCharacterId)}&pinned=${encodeURIComponent(pinnedIds.join(","))}`),
    enabled: Boolean(session?.authenticated && selectedCharacterId)
  });
  const quest = result.data?.data.quests.find((entry) => entry.instanceId === questId);

  return <AuthGate>
    <PageHeader eyebrow="Quest detail" title={quest?.name || "Quest"} description={quest?.currentStep || "Loading the current Bungie quest step and route."} actions={<><Link className={styles.detailBack} to="/quests"><ArrowLeft size={14} />All quests</Link><Freshness observedAt={result.data?.freshness.observedAt} /></>} />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(quest)} onRetry={() => void result.refetch()} />
    {result.data && !quest && <div className={styles.inlineEmpty}><ScrollText /><h2>Quest not found</h2><p>It may have completed, expired, or moved off the selected character.</p></div>}
    {quest && <QuestReport quest={quest} />}
  </AuthGate>;
}

function QuestReport({ quest }: { quest: QuestProgress }) {
  const steps = quest.steps?.length ? quest.steps : [{ itemHash: quest.itemHash, stepNumber: quest.stepNumber || 1, name: quest.currentStep, description: quest.description, status: "current", objectives: quest.objectives, percent: quest.percent, progressKnown: quest.objectives.length > 0 } satisfies QuestStepProgress];
  const progress = questProgressPresentation(quest);
  return <>
    <section className={styles.questDetailHero}><div>{quest.icon ? <img src={quest.icon} alt="" /> : <Crosshair />}</div><main><span>{quest.itemType || quest.activityName || "Quest Step"}{quest.rarity ? ` · ${quest.rarity}` : ""}</span><h2>{quest.name}</h2><p>{quest.description}</p>{quest.flavorText && <blockquote className={questStyles.questDetailFlavor}>{quest.flavorText}</blockquote>}<div><b>{progress.progressKnown ? `${quest.percent}% current-step progress` : `${progress.heading}: ${progress.value}`}</b>{quest.stepNumber && quest.stepCount && progress.progressKnown && <b>Step {quest.stepNumber} of {quest.stepCount}</b>}{quest.inGameTracked && <b>Tracked in Destiny</b>}</div></main></section>
    <section className={styles.questDetailGrid}>
      <article className={styles.questRoute}><header><ScrollText /><div><span>Complete route</span><h2>{steps.length} quest steps</h2></div></header><div>{steps.map((step) => <div key={`${step.stepNumber}-${step.itemHash}`} className={styles.questDetailStep}><aside>{step.status === "completed" ? <CheckCircle2 /> : step.status === "current" ? <Crosshair /> : <CircleDashed />}<i /></aside><main><span>Step {step.stepNumber} · {step.status}</span><h3>{step.name}</h3><p>{step.description}</p>{step.objectives.map((objective) => <div key={objective.objectiveHash}><b>{objective.name}</b>{step.progressKnown ? <><i><span style={{ width: `${objective.percent}%` }} /></i><strong>{objective.percent}%</strong></> : <small>Requirement shown from the manifest · live progress is recorded in Destiny</small>}</div>)}</main></div>)}</div></article>
      <aside className={styles.questReportAside}>
        {quest.rewards.length > 0 && <section><header><Gift /><h2>Rewards</h2></header><div className={questStyles.questDetailRewards}>{quest.rewards.map((reward, index) => <article key={`${reward.itemHash}-${index}`}><div>{reward.definitionAvailable && reward.icon ? <img src={reward.icon} alt="" loading="lazy" /> : <span>Image unavailable</span>}</div><main><strong>{reward.name}</strong>{reward.quantity > 1 && <b>×{reward.quantity.toLocaleString()}</b>}{!reward.definitionAvailable && <small>Manifest definition unavailable</small>}</main></article>)}</div></section>}
        <section><header><Lightbulb /><h2>Progress advice</h2></header><ul>{quest.activityName && <li>Run {quest.activityName} while this quest is active.</li>}{progress.progressKnown ? progress.objectives.filter((objective) => !objective.complete).map((objective) => <li key={objective.objectiveHash}>Focus on {objective.name.toLocaleLowerCase()}; it is currently {objective.percent}% complete.</li>) : progress.objectives.length ? progress.objectives.map((objective) => <li key={objective.objectiveHash}>Complete the manifest requirement: {objective.name}. Destiny records this step without exposing a live counter.</li>) : <li>Follow the current instruction: {progress.instruction}. This step does not expose a numeric counter.</li>}</ul></section>
      </aside>
    </section>
  </>;
}
