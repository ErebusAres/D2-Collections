import type { QuestObjective, QuestProgress } from "@guardian-nexus/contracts";
import { CheckCircle2, ChevronRight, CircleHelp, Crosshair, Gift, X } from "lucide-react";
import { Link } from "react-router-dom";
import { questProgressPresentation } from "../../modules/quests/questProgress";
import styles from "../../pages/QuestsPage.module.css";

const TOOLTIP_GAP = 10;
const TOOLTIP_MARGIN = 12;
const TOOLTIP_WIDTH = 390;

export type QuestTooltipPosition = { top: number; left: number; maxHeight: number };

export function getQuestTooltipPosition(
  anchor: Pick<DOMRect, "top" | "left" | "right">,
  board: Pick<DOMRect, "left" | "right">,
  viewportWidth: number,
  viewportHeight: number
): QuestTooltipPosition {
  const width = Math.max(280, Math.min(TOOLTIP_WIDTH, viewportWidth - TOOLTIP_MARGIN * 2));
  const minLeft = Math.max(TOOLTIP_MARGIN, board.left);
  const maxRight = Math.min(viewportWidth - TOOLTIP_MARGIN, board.right);
  const maxLeft = Math.max(minLeft, maxRight - width);
  const rightCandidate = anchor.right + TOOLTIP_GAP;
  const leftCandidate = anchor.left - TOOLTIP_GAP - width;
  const left = rightCandidate + width <= maxRight
    ? rightCandidate
    : leftCandidate >= minLeft
      ? leftCandidate
      : maxLeft;
  const minimumVisibleHeight = Math.min(420, viewportHeight - TOOLTIP_MARGIN * 2);
  const top = Math.max(TOOLTIP_MARGIN, Math.min(anchor.top, viewportHeight - TOOLTIP_MARGIN - minimumVisibleHeight));
  return { top, left, maxHeight: Math.max(220, viewportHeight - top - TOOLTIP_MARGIN) };
}

export function QuestInspectPanel({ quest, position, onClose, onPointerEnter, onPointerLeave }: { quest: QuestProgress; position?: QuestTooltipPosition; onClose: () => void; onPointerEnter?: () => void; onPointerLeave?: () => void }) {
  const progress = questProgressPresentation(quest);
  return <>
    <button className={styles.questInspectScrim} onClick={onClose} aria-label="Close quest details" />
    <aside className={styles.questInspectPanel} style={position} aria-label={`${quest.name} details`} data-quest-inspect onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onFocusCapture={onPointerEnter} onBlurCapture={onPointerLeave}>
      <header className={styles.questInspectHeader}>
        <div className={styles.questInspectIcon}>{quest.icon ? <img src={quest.icon} alt="" /> : <Crosshair />}</div>
        <div><span>{quest.itemType || "Quest Step"}{quest.rarity ? ` · ${quest.rarity}` : ""}</span><h2>{quest.name}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close quest details"><X /></button>
      </header>
      <div className={styles.questInspectBody}>
        <p className={styles.questInspectDescription}>{quest.description || quest.currentStep || "Bungie did not provide a description for this quest step."}</p>
        {quest.flavorText && <blockquote>{quest.flavorText}</blockquote>}
        <section className={styles.inspectObjectives}>
          <header><span>{progress.heading}</span><strong>{progress.progressKnown ? `${progress.objectives.filter((objective) => objective.complete).length}/${progress.objectives.length}` : progress.value}</strong></header>
          {progress.objectives.length ? <>{!progress.progressKnown && <div className={styles.inspectProgressNote}><CircleHelp /><span>Bungie does not expose a live counter for this step. These manifest requirements are still useful, while completion is recorded in Destiny.</span></div>}{progress.objectives.map((objective) => <InspectObjective key={objective.objectiveHash} objective={objective} progressKnown={progress.progressKnown} />)}</> : <div className={styles.inspectProgressNote}><CircleHelp /><span><b>No numeric counter for this step.</b> Follow the current instruction: {progress.instruction}</span></div>}
        </section>
        {quest.rewards.length > 0 && <section className={styles.inspectRewards}>
          <header><Gift /><span>Rewards</span></header>
          <div>{quest.rewards.map((reward, index) => <article key={`${reward.itemHash}-${index}`}>
            <div className={styles.inspectRewardArt}>{reward.definitionAvailable && reward.icon ? <img src={reward.icon} alt="" loading="lazy" /> : <span>Image unavailable</span>}</div>
            <main><strong>{reward.name}</strong>{reward.quantity > 1 && <b>×{reward.quantity.toLocaleString()}</b>}{!reward.definitionAvailable && <small>Manifest definition unavailable</small>}</main>
          </article>)}</div>
        </section>}
        <Link className={styles.questInspectLink} to={`/quests/${encodeURIComponent(quest.instanceId)}`}>Open full quest timeline <ChevronRight /></Link>
      </div>
    </aside>
  </>;
}

function InspectObjective({ objective, progressKnown }: { objective: QuestObjective; progressKnown: boolean }) {
  const value = objective.completionValue > 0 ? `${objective.progress.toLocaleString()} / ${objective.completionValue.toLocaleString()}` : objective.complete ? "Complete" : `${objective.percent}%`;
  return <article className={`${objective.complete ? styles.inspectObjectiveComplete : ""} ${!progressKnown ? styles.inspectObjectiveRequirement : ""}`}>
    <div><span>{objective.name}</span><strong>{progressKnown ? value : "Tracked in Destiny"}</strong>{objective.complete && <CheckCircle2 />}</div>
    {progressKnown && <i><span style={{ width: `${objective.percent}%` }} /></i>}
  </article>;
}
