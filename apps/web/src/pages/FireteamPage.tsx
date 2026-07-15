import type { FireteamData, FireteamMember, FireteamSharingMode } from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, Crown, EyeOff, Link2, Radio, Repeat2, Share2, ShieldCheck, Timer, Users } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { api, mutationHeaders } from "../api/client";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/Page";
import { pinsKey, useGuardian } from "../state/GuardianContext";
import styles from "./Pages.module.css";

export function FireteamPage() {
  const { session, selectedCharacterId, autoRefresh } = useGuardian();
  const queryClient = useQueryClient();
  const result = useQuery({
    queryKey: ["fireteam", selectedCharacterId],
    queryFn: () => api<FireteamData>(`/api/v1/fireteam?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated),
    refetchInterval: autoRefresh ? 60_000 : false,
    refetchIntervalInBackground: false
  });
  const pinnedIds = useMemo(() => {
    if (!session?.guardian?.membershipId || !selectedCharacterId) return [];
    try { return JSON.parse(localStorage.getItem(pinsKey(session.guardian.membershipId, selectedCharacterId)) || "[]") as string[]; } catch { return []; }
  }, [session?.guardian?.membershipId, selectedCharacterId]);
  const share = useMutation({
    mutationFn: (mode: FireteamSharingMode) => api("/api/v1/fireteam/share", { method: "PUT", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ characterId: selectedCharacterId, sitePinnedQuestIds: pinnedIds, mode }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["fireteam"] })
  });
  const stop = useMutation({
    mutationFn: () => api("/api/v1/fireteam/share", { method: "DELETE", headers: mutationHeaders(session?.csrfToken) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["fireteam"] })
  });
  const sharingMode = result.data?.data.sharingMode;
  const renew = useCallback(() => {
    if (selectedCharacterId && sharingMode && sharingMode !== "off" && !share.isPending) share.mutate(sharingMode);
  }, [selectedCharacterId, sharingMode, share]);
  useEffect(() => {
    if (!result.data?.data.sharingEnabled || !autoRefresh) return;
    const timer = window.setInterval(renew, 60_000);
    return () => window.clearInterval(timer);
  }, [result.data?.data.sharingEnabled, autoRefresh, renew]);
  const data = result.data?.data;

  return <AuthGate>
    <PageHeader eyebrow="Cooperative intelligence" title="Fireteam" description="See current party presence and activity, then coordinate only the quest details each Guardian explicitly shares." actions={<>
      <Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />
      {data && !data.sharingEnabled && <>
        <button className={styles.primaryAction} onClick={() => share.mutate("temporary")} disabled={share.isPending}><Timer size={15} />Share 15 minutes</button>
        <button className={styles.primaryAction} onClick={() => share.mutate("persistent")} disabled={share.isPending}><Repeat2 size={15} />Always share</button>
      </>}
      {data?.sharingEnabled && <>
        {data.sharingMode === "temporary" && <button className={styles.primaryAction} onClick={() => share.mutate("persistent")} disabled={share.isPending}><Repeat2 size={15} />Make automatic</button>}
        <button className={`${styles.primaryAction} ${styles.sharing}`} onClick={() => stop.mutate()} disabled={stop.isPending}><Share2 size={15} />Stop sharing</button>
      </>}
    </>} />
    <QueryState loading={result.isLoading} error={result.error as Error} onRetry={() => void result.refetch()} />
    {data && <>
      <section className={styles.fireteamStatus}>
        <div><Radio /><span>Fireteam signal</span><strong>{data.members.length > 1 ? `${data.members.length} Guardians` : "Solo"}</strong></div>
        <div><Activity /><span>Current activity</span><strong>{data.activity || "Orbit / unavailable"}</strong></div>
        <div><ShieldCheck /><span>Your sharing</span><strong>{data.sharingMode === "persistent" ? "Always on / background refresh" : data.sharingMode === "temporary" ? "Temporary / 15 minutes" : "Private"}</strong></div>
      </section>
      <section className={styles.fireteamGrid}>{data.members.map((member) => <MemberCard key={member.membershipId} member={member} />)}</section>
      <section className={styles.transitoryNotice}><AlertTriangle /><div><strong>Best-effort live status</strong><p>Bungie describes party and current-activity data as transitory and non-authoritative. Guardian Nexus shows timestamps and privacy states instead of presenting it as guaranteed real time.</p></div></section>
    </>}
  </AuthGate>;
}

function MemberCard({ member }: { member: FireteamMember }) {
  return <article className={`${styles.memberCard} ${member.isSelf ? styles.selfMember : ""}`}>
    <header>{member.emblemPath ? <img src={member.emblemPath} alt="" /> : <span><Users /></span>}<div><small>IGN / {member.isSelf ? `You / ${member.presenceLabel}` : member.presenceLabel} / {member.syncState === "synced" ? member.sharingMode === "persistent" ? "Auto synced" : "Synced" : "Not synced"}</small><h2>{member.inGameName}</h2><p>{member.character ? `${member.character.className} / ${member.character.power} Power` : "Public Bungie fireteam profile"}</p></div><div className={styles.memberSignals}>{member.isLeader && <Crown aria-label="Fireteam leader" />}<i className={member.sharing ? styles.signalLive : ""} /></div></header>
    <div className={styles.memberActivity}><Activity size={15} /><span>{member.activitySource === "public" ? "Public activity" : member.activitySource === "shared" ? "Shared activity" : member.activitySource === "fireteam" ? "Fireteam activity" : "Activity"}</span><strong>{member.activity || "Orbit / unavailable"}</strong></div>
    {member.sharing ? <div className={styles.sharedQuests}><h3>{member.sharingMode === "persistent" ? "Automatically shared objectives" : "Shared objectives"}</h3>{member.quests.length ? member.quests.map((quest) => <div className={styles.sharedQuest} key={quest.instanceId}><span className={styles.sharedQuestIcon}>{quest.icon ? <img src={quest.icon} alt="" /> : <CheckCircle2 />}</span><div className={styles.sharedQuestDetails}><div className={styles.sharedQuestTitle}><b>{quest.name}</b>{quest.stepNumber && quest.stepCount ? <em>Step {quest.stepNumber} / {quest.stepCount}</em> : <em>Active step</em>}</div><small>{quest.currentStep}</small>{quest.objectives.length > 0 && <div className={styles.sharedObjectives}>{quest.objectives.map((objective) => <div key={objective.objectiveHash}><span>{objective.name}</span><strong>{objective.complete ? "Complete" : objective.completionValue > 0 ? `${objective.progress.toLocaleString()} / ${objective.completionValue.toLocaleString()}` : `${objective.percent}%`}</strong></div>)}</div>}<i className={styles.sharedQuestBar}><span style={{ width: `${quest.percent}%` }} /></i></div><strong className={styles.sharedQuestPercent}>{quest.percent}%</strong></div>) : <p>No site-pinned or in-game-tracked quests shared.</p>}</div> : <div className={styles.privateMember}><EyeOff /><strong>Quest details not shared</strong><p>This Guardian must opt into temporary or automatic sharing.</p></div>}
    {member.overlaps.length > 0 && <footer><Link2 size={13} /><span>Shared progress opportunity:</span><strong>{member.overlaps.join(", ")}</strong></footer>}
  </article>;
}
