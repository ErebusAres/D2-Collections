import type { FireteamMember, FireteamTrackedItem } from "@guardian-nexus/contracts";
import styles from "../../styles/fireteam/FireteamComponents.module.css";
import { FireteamMemberCard } from "./FireteamMemberCard";

export interface FireteamRosterProps {
  members: FireteamMember[];
  currentGuardianIsLeader: boolean;
  copiedCommandIdentifier: string;
  onCopyCommand: (commandIdentifier: string, command: string) => Promise<void>;
  onUntrackCurrentGuardianItem: (trackedItem: FireteamTrackedItem) => void;
  currentGuardianTrackedItemOrder: string[];
  onReorderCurrentGuardianTrackedItem: (sourceKey: string, targetKey: string) => void;
  currentGuardianUntrackingItemKey?: string;
}

export function FireteamRoster({
  members,
  currentGuardianIsLeader,
  copiedCommandIdentifier,
  onCopyCommand,
  onUntrackCurrentGuardianItem,
  currentGuardianTrackedItemOrder,
  onReorderCurrentGuardianTrackedItem,
  currentGuardianUntrackingItemKey
}: FireteamRosterProps) {
  return <section className={styles.roster} aria-label="Fireteam roster">
    {members.map((member) => (
      <FireteamMemberCard
        key={member.membershipId}
        member={member}
        canManageMember={currentGuardianIsLeader && !member.isSelf}
        copiedCommand={copiedCommandIdentifier}
        onCopyCommand={onCopyCommand}
        onUntrackItem={member.isSelf ? onUntrackCurrentGuardianItem : undefined}
        trackedItemOrder={member.isSelf ? currentGuardianTrackedItemOrder : undefined}
        onReorderTrackedItem={member.isSelf ? onReorderCurrentGuardianTrackedItem : undefined}
        untrackingItemKey={member.isSelf ? currentGuardianUntrackingItemKey : undefined}
      />
    ))}
  </section>;
}
