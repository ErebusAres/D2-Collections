import type { MatrixGuardian, MatrixSnapshot } from "@guardian-nexus/contracts";

interface MatrixUser {
  membershipId: string;
  displayName: string;
}

export function matrixGuardianRoster(
  permittedMembershipIds: Set<string>,
  users: MatrixUser[],
  snapshots: MatrixSnapshot[],
  currentGuardian: MatrixUser
): MatrixGuardian[] {
  const names = new Map(users.map((user) => [user.membershipId, user.displayName]));
  const snapshotsByMembership = new Map(snapshots.map((snapshot) => [snapshot.membershipId, snapshot]));
  return [...permittedMembershipIds].map((membershipId) => {
    const snapshot = snapshotsByMembership.get(membershipId);
    return {
      membershipId,
      displayName: snapshot?.displayName || names.get(membershipId) || (membershipId === currentGuardian.membershipId ? currentGuardian.displayName : "Approved Guardian"),
      hasSnapshot: Boolean(snapshot),
      ...(snapshot?.syncedAt ? { syncedAt: snapshot.syncedAt } : {})
    };
  }).sort((left, right) => left.displayName.localeCompare(right.displayName));
}
