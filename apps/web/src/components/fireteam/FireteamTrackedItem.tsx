import type { FireteamTrackedItem as FireteamTrackedItemData } from "@guardian-nexus/contracts";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  BookmarkMinus,
  CheckCircle2,
  GripVertical
} from "lucide-react";
import { ObjectiveRequirementText } from "../quests/ObjectiveRequirementText";
import { fireteamTrackedItemKey } from "./fireteamTrackedItems";
import styles from "./FireteamComponents.module.css";

export interface FireteamTrackedItemProps {
  trackedItem: FireteamTrackedItemData;
  isEntering?: boolean;
  isCompleting?: boolean;
  onUntrack?: (trackedItem: FireteamTrackedItemData) => void;
  isUntracking?: boolean;
  isReorderable?: boolean;
  isDragging?: boolean;
  isDragTarget?: boolean;
  onDragStart?: () => void;
  onDragOver?: () => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
  onMove?: (direction: -1 | 1) => void;
  onMoveToEdge?: (edge: "top" | "bottom") => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export function FireteamTrackedItem({
  trackedItem,
  isEntering = false,
  isCompleting = false,
  onUntrack,
  isUntracking = false,
  isReorderable = false,
  isDragging = false,
  isDragTarget = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMove,
  onMoveToEdge,
  isFirst = false,
  isLast = false
}: FireteamTrackedItemProps) {
  const progressIsAvailable = trackedItem.objectives.length === 0
    || trackedItem.objectives.some((objective) => objective.progressAvailable);
  const canUntrack = Boolean(onUntrack && !isCompleting);
  const untrackTitle = trackedItem.trackedInDestiny
    ? trackedItem.trackedInGuardianNexus
      ? "Untrack in Guardian Nexus and hide while Destiny still tracks it"
      : "Hide from Fireteam sharing until Destiny stops tracking it"
    : "Untrack in Guardian Nexus";
  const trackingState = isCompleting ? "exiting" : isEntering ? "entering" : "active";
  const isRemoving = isUntracking && !isCompleting;

  return (
    <div
      className={`${styles.sharedQuest} ${canUntrack ? styles.sharedQuestManageable : ""} ${isReorderable ? styles.sharedQuestReorderable : ""} ${isDragging ? styles.sharedQuestDragging : ""} ${isDragTarget ? styles.sharedQuestDragOver : ""} ${isCompleting ? styles.sharedQuestCompleting : isRemoving ? styles.sharedQuestRemoving : isEntering ? styles.sharedQuestEntering : ""}`}
      data-completion-state={isCompleting ? "exiting" : "active"}
      data-tracking-state={isRemoving ? "removing" : trackingState}
      onDragOver={isReorderable ? (event) => {
        event.preventDefault();
        onDragOver?.();
      } : undefined}
      onDrop={isReorderable ? (event) => {
        event.preventDefault();
        onDrop?.();
      } : undefined}
    >
      {isReorderable && (
        <button
          type="button"
          draggable
          className={styles.sharedQuestDragHandle}
          aria-label={`Reorder ${trackedItem.name}`}
          title="Drag to reorder"
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", fireteamTrackedItemKey(trackedItem));
            onDragStart?.();
          }}
          onDragEnd={onDragEnd}
          onKeyDown={(event) => {
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
            event.preventDefault();
            onMove?.(event.key === "ArrowUp" ? -1 : 1);
          }}
        >
          <GripVertical />
        </button>
      )}

      {isCompleting && (
        <span className={styles.sharedQuestCompletionFx} aria-hidden="true">
          <i />
          <b>{Array.from({ length: 12 }, (_, index) => <span key={index} />)}</b>
          <em><CheckCircle2 /></em>
        </span>
      )}

      <span className={styles.sharedQuestIcon}>
        {trackedItem.icon ? <img src={trackedItem.icon} alt="" /> : <CheckCircle2 />}
      </span>

      <div className={styles.sharedQuestDetails}>
        <div className={styles.sharedQuestTitle}>
          <b>{trackedItem.name}</b>
          <em>{trackedItem.context}</em>
        </div>
        <small>{trackedItem.description}</small>
      </div>

      <strong className={styles.sharedQuestPercent}>
        {progressIsAvailable ? `${trackedItem.percent}%` : "—"}
      </strong>

      {canUntrack && (
        <div className={styles.sharedQuestActions}>
          {isReorderable && (
            <>
              <button
                type="button"
                className={styles.sharedQuestMoveEdge}
                onClick={() => onMoveToEdge?.("top")}
                disabled={isFirst || isUntracking}
                title="To top"
                aria-label={`Move ${trackedItem.name} to top`}
              >
                <ArrowUpToLine />
              </button>
              <button
                type="button"
                className={styles.sharedQuestMoveEdge}
                onClick={() => onMoveToEdge?.("bottom")}
                disabled={isLast || isUntracking}
                title="To bottom"
                aria-label={`Move ${trackedItem.name} to bottom`}
              >
                <ArrowDownToLine />
              </button>
            </>
          )}
          <button
            type="button"
            className={styles.sharedQuestUntrack}
            onClick={() => onUntrack?.(trackedItem)}
            disabled={isUntracking}
            title={untrackTitle}
            aria-label={`Untrack ${trackedItem.name} from Fireteam`}
          >
            <BookmarkMinus />
          </button>
        </div>
      )}

      <div className={styles.sharedQuestProgress}>
        {trackedItem.objectives.length > 0 && (
          <div className={styles.sharedObjectives}>
            {trackedItem.objectives.map((objective) => (
              <div key={objective.objectiveHash}>
                <span><ObjectiveRequirementText value={objective.name} /></span>
                <strong>
                  {objective.complete
                    ? "Complete"
                    : !objective.progressAvailable
                      ? "Unavailable"
                      : objective.completionValue > 0
                        ? `${objective.progress.toLocaleString()} / ${objective.completionValue.toLocaleString()}`
                        : `${objective.percent}%`}
                </strong>
              </div>
            ))}
          </div>
        )}

        {trackedItem.acquisitionGuide && (
          <div className={styles.sharedAcquisitionGuide}>
            <strong>How to get it</strong>
            <p>{trackedItem.acquisitionGuide.summary}</p>
            {trackedItem.acquisitionGuide.steps.length > 0 && (
              <ol>
                {trackedItem.acquisitionGuide.steps.map((step, index) => <li key={index}>{step}</li>)}
              </ol>
            )}
            {trackedItem.acquisitionGuide.prerequisites.length > 0 && (
              <>
                <strong>Prerequisites</strong>
                <ul>
                  {trackedItem.acquisitionGuide.prerequisites.map((step, index) => <li key={index}>{step}</li>)}
                </ul>
              </>
            )}
          </div>
        )}

        {trackedItem.questGuide && (
          <details className={styles.sharedQuestGuide}>
            <summary>
              Current-step guide
              <span>{trackedItem.questGuide.coverage === "curated" ? "Verified" : "Objective-specific"}</span>
            </summary>
            <p>{trackedItem.questGuide.summary}</p>
            {trackedItem.questGuide.steps.length > 0 && (
              <ol>{trackedItem.questGuide.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
            )}
            {trackedItem.questGuide.tips.length > 0 && (
              <>
                <strong>Tips</strong>
                <ul>{trackedItem.questGuide.tips.map((tip, index) => <li key={index}>{tip}</li>)}</ul>
              </>
            )}
            {trackedItem.questGuide.warnings.length > 0 && (
              <>
                <strong>Watch for</strong>
                <ul>{trackedItem.questGuide.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
              </>
            )}
          </details>
        )}

        <i className={styles.sharedQuestBar}>
          <span style={{ width: `${progressIsAvailable ? trackedItem.percent : 0}%` }} />
        </i>
      </div>
    </div>
  );
}
