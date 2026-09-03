import type { GearTag, LootWatcherConfig, RecentItemEvent } from "@guardian-nexus/contracts";
import {
  CompactRecentLootBar,
  type LootItem,
  type LootPull,
  type WeaponSocketChange
} from "../gear/RecentLoot";
import styles from "./FireteamComponents.module.css";

export interface FireteamRecentLootSectionProps {
  isVisible: boolean;
  recentLootEvents: RecentItemEvent[];
  isLoading: boolean;
  loadError?: Error | null;
  warnings?: string[];
  retentionDays?: number;
  observedAt?: string;
  firstObservationEstablished?: boolean;
  onRetry: () => void;
  onTagItem: (item: LootItem, tag?: GearTag) => void;
  onPullItem: LootPull;
  onChangeWeaponSocket: WeaponSocketChange;
  actionsPending: boolean;
  onHide: () => void;
  onShow: () => void;
  watchers: LootWatcherConfig;
  onWatcherChange: (watcher: keyof LootWatcherConfig, enabled: boolean) => void;
  watcherUpdatePending: boolean;
  watcherStatus?: string;
  actionError?: Error | null;
}

export function FireteamRecentLootSection({
  isVisible,
  recentLootEvents,
  isLoading,
  loadError,
  warnings,
  retentionDays,
  observedAt,
  firstObservationEstablished,
  onRetry,
  onTagItem,
  onPullItem,
  onChangeWeaponSocket,
  actionsPending,
  onHide,
  onShow,
  watchers,
  onWatcherChange,
  watcherUpdatePending,
  watcherStatus,
  actionError
}: FireteamRecentLootSectionProps) {
  return (
    <>
      {isVisible ? (
        <CompactRecentLootBar
          events={recentLootEvents}
          loading={isLoading}
          error={loadError}
          warnings={warnings}
          retentionDays={retentionDays}
          observedAt={observedAt}
          firstObservationEstablished={firstObservationEstablished}
          onRetry={onRetry}
          onTag={onTagItem}
          onPull={onPullItem}
          onSocketChange={onChangeWeaponSocket}
          busy={actionsPending}
          onHide={onHide}
          watchers={watchers}
          onWatcherChange={onWatcherChange}
          watcherBusy={watcherUpdatePending}
          watcherStatus={watcherStatus}
        />
      ) : (
        <section className={styles.fireteamLootControl}>
          <div>
            <strong>Recent Loot hidden</strong>
            <small>Loot tracking stays active while this section is hidden.</small>
          </div>
          <button onClick={onShow}>Show Recent Loot</button>
        </section>
      )}
      {actionError && <div className={styles.actionError}>{actionError.message}</div>}
    </>
  );
}
