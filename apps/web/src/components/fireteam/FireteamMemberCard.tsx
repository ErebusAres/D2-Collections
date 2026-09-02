import type { FireteamMember, FireteamTrackedItem } from "@guardian-nexus/contracts";
import {
  Activity,
  Crown,
  EyeOff,
  Link2,
  MessageSquare,
  UserMinus,
  Users
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { playCompletionChime } from "../../services/completionAudio";
import styles from "../../pages/Pages.module.css";
import { FireteamTrackedItem as FireteamTrackedItemComponent } from "./FireteamTrackedItem";
import {
  fireteamCompletionEventKey,
  fireteamMemberPresenceLocation,
  fireteamTrackedItemKey,
  FIRETEAM_TRACKED_ITEM_EXIT_MS,
  legacyQuestToFireteamTrackedItem,
  orderFireteamTrackedItems
} from "./fireteamTrackedItems";

export interface FireteamMemberCardProps {
  member: FireteamMember;
  canManageMember: boolean;
  copiedCommand: string;
  onCopyCommand: (commandIdentifier: string, command: string) => Promise<void>;
  onUntrackItem?: (trackedItem: FireteamTrackedItem) => void;
  trackedItemOrder?: string[];
  onReorderTrackedItem?: (sourceKey: string, targetKey: string) => void;
  untrackingItemKey?: string;
}

export function FireteamMemberCard({
  member,
  canManageMember,
  copiedCommand,
  onCopyCommand,
  onUntrackItem,
  trackedItemOrder,
  onReorderTrackedItem,
  untrackingItemKey
}: FireteamMemberCardProps) {
  const presenceLocation = fireteamMemberPresenceLocation(member);
  const trackedItems = Array.isArray(member.trackedItems)
    ? member.trackedItems
    : member.quests.map(legacyQuestToFireteamTrackedItem);
  const trackedItemKeys = trackedItems.map(fireteamTrackedItemKey);
  const trackedItemSignature = [...trackedItemKeys].sort().join("|");
  const previousTrackedItemKeys = useRef<Set<string> | null>(null);
  const previousTrackedItems = useRef<Map<string, FireteamTrackedItem>>(new Map());
  const entryTimers = useRef<Map<string, number>>(new Map());
  const removalTimers = useRef<Map<string, number>>(new Map());
  const [enteringItemKeys, setEnteringItemKeys] = useState<Set<string>>(() => new Set());
  const [removedItems, setRemovedItems] = useState<Map<string, FireteamTrackedItem>>(() => new Map());
  const completedItemKeys = new Set(
    (member.recentlyCompletedItems || []).map(fireteamTrackedItemKey)
  );

  useEffect(() => {
    const currentTrackedItemKeys = new Set(trackedItemKeys);
    const previousKeys = previousTrackedItemKeys.current;
    previousTrackedItemKeys.current = currentTrackedItemKeys;

    const currentTrackedItems = new Map(
      trackedItems.map((trackedItem) => [fireteamTrackedItemKey(trackedItem), trackedItem])
    );
    const priorTrackedItems = previousTrackedItems.current;
    previousTrackedItems.current = currentTrackedItems;
    if (!previousKeys) return;

    const addedItemKeys = [...currentTrackedItemKeys].filter(
      (trackedItemKey) => !previousKeys.has(trackedItemKey)
    );
    if (addedItemKeys.length) {
      setEnteringItemKeys((currentKeys) => new Set([...currentKeys, ...addedItemKeys]));
    }

    for (const trackedItemKey of addedItemKeys) {
      const existingTimer = entryTimers.current.get(trackedItemKey);
      if (existingTimer) window.clearTimeout(existingTimer);
      const entryTimer = window.setTimeout(() => {
        setEnteringItemKeys((currentKeys) => {
          const nextKeys = new Set(currentKeys);
          nextKeys.delete(trackedItemKey);
          return nextKeys;
        });
        entryTimers.current.delete(trackedItemKey);
      }, 1_400);
      entryTimers.current.set(trackedItemKey, entryTimer);
    }

    const newlyRemovedItems = [...previousKeys]
      .filter(
        (trackedItemKey) => !currentTrackedItemKeys.has(trackedItemKey)
          && !completedItemKeys.has(trackedItemKey)
      )
      .map((trackedItemKey) => [trackedItemKey, priorTrackedItems.get(trackedItemKey)] as const)
      .filter(
        (entry): entry is readonly [string, FireteamTrackedItem] => Boolean(entry[1])
      );

    if (newlyRemovedItems.length) {
      setRemovedItems((currentItems) => new Map([...currentItems, ...newlyRemovedItems]));
      for (const [trackedItemKey] of newlyRemovedItems) {
        const existingTimer = removalTimers.current.get(trackedItemKey);
        if (existingTimer) window.clearTimeout(existingTimer);
        const removalTimer = window.setTimeout(() => {
          setRemovedItems((currentItems) => {
            const nextItems = new Map(currentItems);
            nextItems.delete(trackedItemKey);
            return nextItems;
          });
          removalTimers.current.delete(trackedItemKey);
        }, FIRETEAM_TRACKED_ITEM_EXIT_MS);
        removalTimers.current.set(trackedItemKey, removalTimer);
      }
    }
  }, [trackedItemSignature, member.recentlyCompletedItems]);

  useEffect(() => () => {
    for (const entryTimer of entryTimers.current.values()) window.clearTimeout(entryTimer);
    entryTimers.current.clear();
    for (const removalTimer of removalTimers.current.values()) window.clearTimeout(removalTimer);
    removalTimers.current.clear();
  }, []);

  const recentlyCompletedItems = member.recentlyCompletedItems || [];
  const recentlyCompletedItemKeys = new Set(recentlyCompletedItems.map(fireteamTrackedItemKey));
  const completedItemSignature = [...recentlyCompletedItemKeys].sort().join("|");

  useEffect(() => {
    if (!recentlyCompletedItemKeys.size) return;
    setRemovedItems((currentItems) => {
      const nextItems = new Map(currentItems);
      let removedItemChanged = false;
      for (const trackedItemKey of recentlyCompletedItemKeys) {
        if (nextItems.delete(trackedItemKey)) removedItemChanged = true;
        const removalTimer = removalTimers.current.get(trackedItemKey);
        if (removalTimer) {
          window.clearTimeout(removalTimer);
          removalTimers.current.delete(trackedItemKey);
        }
      }
      return removedItemChanged ? nextItems : currentItems;
    });
  }, [completedItemSignature]);

  const [dismissedCompletionKeys, setDismissedCompletionKeys] = useState<Set<string>>(
    () => readDismissedCompletionEventKeys(member.membershipId)
  );
  const visibleCompletedItems = recentlyCompletedItems.filter(
    (trackedItem) => !dismissedCompletionKeys.has(fireteamCompletionEventKey(trackedItem))
  );
  const visibleCompletionKeys = visibleCompletedItems.map(fireteamCompletionEventKey).join("|");

  useEffect(() => {
    if (!visibleCompletionKeys) return;
    const completionKeys = visibleCompletionKeys.split("|");
    playCompletionChime();
    const dismissalTimer = window.setTimeout(() => {
      setDismissedCompletionKeys((currentKeys) => {
        const nextKeys = new Set([...currentKeys, ...completionKeys]);
        writeDismissedCompletionEventKeys(member.membershipId, nextKeys);
        return nextKeys;
      });
    }, 1_600);
    return () => window.clearTimeout(dismissalTimer);
  }, [member.membershipId, visibleCompletionKeys]);

  const completingItemKeys = new Set(visibleCompletedItems.map(fireteamTrackedItemKey));
  const orderedTrackedItems = orderFireteamTrackedItems(trackedItems, trackedItemOrder);
  const visibleRemovedItems = [...removedItems.values()].filter(
    (trackedItem) => !recentlyCompletedItemKeys.has(fireteamTrackedItemKey(trackedItem))
  );
  const displayedTrackedItems = [
    ...orderedTrackedItems.filter(
      (trackedItem) => !completingItemKeys.has(fireteamTrackedItemKey(trackedItem))
    ),
    ...visibleCompletedItems,
    ...visibleRemovedItems
  ];
  const activeTrackedItems = displayedTrackedItems.filter(
    (trackedItem) => !("completedAt" in trackedItem)
      && !removedItems.has(fireteamTrackedItemKey(trackedItem))
  );
  const [draggingItemKey, setDraggingItemKey] = useState("");
  const [dragTargetItemKey, setDragTargetItemKey] = useState("");

  const finishDrag = () => {
    setDraggingItemKey("");
    setDragTargetItemKey("");
  };

  const onlineLabel = member.onlineState === "unknown"
    ? ""
    : ` / ${member.onlineState === "online" ? "Online" : "Offline"}`;
  const synchronizationLabel = member.syncState === "synced"
    ? member.sharingMode === "persistent" ? "Auto synced" : "Synced"
    : member.syncState === "delayed" ? "Sync delayed" : "Not synced";
  const untrackingItemIsCompleting = Boolean(
    untrackingItemKey && recentlyCompletedItemKeys.has(untrackingItemKey)
  );
  const cardEvent = visibleCompletedItems.length
    ? "completed"
    : (!untrackingItemIsCompleting && untrackingItemKey) || visibleRemovedItems.length
      ? "removed"
      : enteringItemKeys.size
        ? "added"
        : "idle";

  return (
    <article
      className={`${styles.memberCard} ${member.isSelf ? styles.selfMember : ""} ${cardEvent === "completed" ? styles.memberCardCompleted : cardEvent === "removed" ? styles.memberCardRemoved : cardEvent === "added" ? styles.memberCardAdded : ""}`}
      data-tracking-event={cardEvent}
    >
      <header>
        {member.emblemPath ? <img src={member.emblemPath} alt="" /> : <span><Users /></span>}
        <div>
          <small>
            {member.isSelf ? `You · ${member.presenceLabel}` : member.presenceLabel}
            {onlineLabel} · {synchronizationLabel}
          </small>
          <h2>{member.inGameName}</h2>
          <p>
            {member.character
              ? `${member.character.className} · ${member.character.power} Power`
              : "Character details unavailable"}
          </p>
        </div>
        <div className={styles.memberSignals}>
          {member.isLeader && <Crown aria-label="Fireteam leader" />}
          <i className={member.sharing ? styles.signalLive : ""} />
        </div>
      </header>

      <div className={styles.memberActivity}>
        <Activity size={15} />
        <span>
          {member.onlineState === "offline"
            ? "Presence"
            : member.activitySource === "shared"
              ? "Shared activity"
              : "Location"}
        </span>
        <strong>{presenceLocation}</strong>
      </div>

      {member.sharing ? (
        <div className={styles.sharedQuests}>
          <h3>
            {member.sharingMode === "persistent"
              ? "Automatically shared tracked items"
              : "Shared tracked items"}
          </h3>
          {displayedTrackedItems.length ? displayedTrackedItems.map((trackedItem) => {
            const trackedItemKey = fireteamTrackedItemKey(trackedItem);
            const isTransient = "completedAt" in trackedItem || removedItems.has(trackedItemKey);
            const activeItemIndex = activeTrackedItems.findIndex(
              (activeItem) => fireteamTrackedItemKey(activeItem) === trackedItemKey
            );

            return (
              <FireteamTrackedItemComponent
                key={trackedItemKey}
                trackedItem={trackedItem}
                isEntering={enteringItemKeys.has(trackedItemKey)}
                isCompleting={"completedAt" in trackedItem}
                onUntrack={onUntrackItem}
                isUntracking={untrackingItemKey === trackedItemKey || removedItems.has(trackedItemKey)}
                isReorderable={Boolean(onReorderTrackedItem && !isTransient)}
                isDragging={draggingItemKey === trackedItemKey}
                isDragTarget={dragTargetItemKey === trackedItemKey && draggingItemKey !== trackedItemKey}
                onDragStart={() => setDraggingItemKey(trackedItemKey)}
                onDragOver={() => setDragTargetItemKey(trackedItemKey)}
                onDrop={() => {
                  if (draggingItemKey && draggingItemKey !== trackedItemKey) {
                    onReorderTrackedItem?.(draggingItemKey, trackedItemKey);
                  }
                  finishDrag();
                }}
                onDragEnd={finishDrag}
                onMove={(direction) => {
                  const targetItem = activeTrackedItems[activeItemIndex + direction];
                  if (targetItem) {
                    onReorderTrackedItem?.(
                      trackedItemKey,
                      fireteamTrackedItemKey(targetItem)
                    );
                  }
                }}
                onMoveToEdge={(edge) => {
                  const targetItem = edge === "top"
                    ? activeTrackedItems[0]
                    : activeTrackedItems[activeTrackedItems.length - 1];
                  if (targetItem && fireteamTrackedItemKey(targetItem) !== trackedItemKey) {
                    onReorderTrackedItem?.(
                      trackedItemKey,
                      fireteamTrackedItemKey(targetItem)
                    );
                  }
                }}
                isFirst={activeItemIndex === 0}
                isLast={activeItemIndex === activeTrackedItems.length - 1}
              />
            );
          }) : (
            <p>
              {member.syncState === "delayed"
                ? "Updating shared progress…"
                : "Nothing is currently tracked."}
            </p>
          )}
        </div>
      ) : (
        <div className={styles.privateMember}>
          <EyeOff />
          <strong>Tracked goals are private</strong>
          <p>This Guardian has not shared their tracked goals.</p>
        </div>
      )}

      {!member.isSelf && (
        <div className={styles.memberCommands}>
          <button
            onClick={() => void onCopyCommand(
              `whisper-${member.membershipId}`,
              `/whisper ${member.inGameName} `
            )}
            title="Copies a Destiny 2 text-chat command"
          >
            <MessageSquare size={13} />
            {copiedCommand === `whisper-${member.membershipId}` ? "Copied" : "Whisper"}
          </button>
          {canManageMember && (
            <button
              className={styles.managementCommand}
              onClick={() => void onCopyCommand(
                `kick-${member.membershipId}`,
                `/kick ${member.inGameName}`
              )}
              title="Copies a Destiny 2 text-chat command; Guardian Nexus cannot kick through the Bungie API"
            >
              <UserMinus size={13} />
              {copiedCommand === `kick-${member.membershipId}` ? "Copied" : "Kick command"}
            </button>
          )}
        </div>
      )}

      {member.overlaps.length > 0 && (
        <footer>
          <Link2 size={13} />
          <span>You can work on this together:</span>
          <strong>{member.overlaps.join(", ")}</strong>
        </footer>
      )}
    </article>
  );
}

function readDismissedCompletionEventKeys(membershipId: string): Set<string> {
  try {
    const storedEventKeys = sessionStorage.getItem(completionDismissalStorageKey(membershipId));
    const parsedEventKeys = JSON.parse(storedEventKeys || "[]");
    return new Set(
      Array.isArray(parsedEventKeys)
        ? parsedEventKeys
          .filter((eventKey): eventKey is string => typeof eventKey === "string" && Boolean(eventKey))
          .slice(-100)
        : []
    );
  } catch {
    return new Set();
  }
}

function writeDismissedCompletionEventKeys(
  membershipId: string,
  dismissedEventKeys: ReadonlySet<string>
): void {
  try {
    sessionStorage.setItem(
      completionDismissalStorageKey(membershipId),
      JSON.stringify([...dismissedEventKeys].slice(-100))
    );
  } catch {
    // The current card still dismisses the event when browser storage is unavailable.
  }
}

function completionDismissalStorageKey(membershipId: string): string {
  return `guardian-nexus:fireteam-completions:${membershipId}`;
}
