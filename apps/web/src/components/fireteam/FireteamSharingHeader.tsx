import type { FireteamSharingMode } from "@guardian-nexus/contracts";
import { Repeat2, Share2, Timer } from "lucide-react";
import { Freshness, PageHeader } from "../common/Page";
import styles from "../../styles/fireteam/FireteamComponents.module.css";

export interface FireteamSharingHeaderProps {
  lastUpdatedAt?: string;
  statusWarning?: string;
  sharingEnabled?: boolean;
  sharingMode?: "off" | FireteamSharingMode;
  sharingUpdatePending: boolean;
  stopSharingPending: boolean;
  onShareTemporarily: () => void;
  onSharePersistently: () => void;
  onStopSharing: () => void;
}

export function FireteamSharingHeader({
  lastUpdatedAt,
  statusWarning,
  sharingEnabled,
  sharingMode,
  sharingUpdatePending,
  stopSharingPending,
  onShareTemporarily,
  onSharePersistently,
  onStopSharing
}: FireteamSharingHeaderProps) {
  return (
    <PageHeader
      eyebrow="Your current team"
      title="Fireteam"
      description="See who is in your fireteam, the goals they share, and your recent loot. Updates automatically every five minutes."
      actions={(
        <>
          <Freshness
            observedAt={lastUpdatedAt}
            label="Last updated"
            warning={statusWarning}
          />
          {sharingEnabled === false && (
            <>
              <button
                className={styles.primaryAction}
                onClick={onShareTemporarily}
                disabled={sharingUpdatePending}
              >
                <Timer size={15} />
                Share 15 minutes
              </button>
              <button
                className={styles.primaryAction}
                onClick={onSharePersistently}
                disabled={sharingUpdatePending}
              >
                <Repeat2 size={15} />
                Always share
              </button>
            </>
          )}
          {sharingEnabled === true && (
            <>
              {sharingMode === "temporary" && (
                <button
                  className={styles.primaryAction}
                  onClick={onSharePersistently}
                  disabled={sharingUpdatePending}
                >
                  <Repeat2 size={15} />
                  Make automatic
                </button>
              )}
              <button
                className={`${styles.primaryAction} ${styles.sharing}`}
                onClick={onStopSharing}
                disabled={stopSharingPending}
              >
                <Share2 size={15} />
                Stop sharing
              </button>
            </>
          )}
        </>
      )}
    />
  );
}
