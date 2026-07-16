import type { FireteamContact, FireteamData, FireteamMember, FireteamSharingMode } from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, Copy, Crown, EyeOff, Link2, LogIn, MessageSquare, Radio, Repeat2, Share2, ShieldCheck, Timer, UserMinus, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, mutationHeaders, queuedApi } from "../services/api/client";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { pinsKey, useGuardian } from "../context/GuardianContext";
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
    mutationFn: (mode: FireteamSharingMode) => queuedApi("/api/v1/fireteam/share", { method: "PUT", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ characterId: selectedCharacterId, sitePinnedQuestIds: pinnedIds, mode }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["fireteam"] })
  });
  const stop = useMutation({
    mutationFn: () => queuedApi("/api/v1/fireteam/share", { method: "DELETE", headers: mutationHeaders(session?.csrfToken) }),
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
  const self = data?.members.find((member) => member.isSelf);
  const [copied, setCopied] = useState("");
  const copyCommand = async (label: string, command: string) => {
    if (!navigator.clipboard?.writeText) return;
    try { await navigator.clipboard.writeText(command); } catch { return; }
    setCopied(label);
    window.setTimeout(() => setCopied((current) => current === label ? "" : current), 1800);
  };

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
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(data)} onRetry={() => void result.refetch()} />
    {data && <>
      <section className={styles.fireteamStatus}>
        <div><Radio /><span>Fireteam signal</span><strong>{data.members.length > 1 ? `${data.members.length} Guardians` : "Solo"}</strong></div>
        <div><Activity /><span>Current activity</span><strong>{self?.onlineState === "offline" ? "Offline" : data.activity || "Orbit / unavailable"}</strong></div>
        <div><ShieldCheck /><span>Your sharing</span><strong>{data.sharingMode === "persistent" ? "Always on / background refresh" : data.sharingMode === "temporary" ? "Temporary / 15 minutes" : "Private"}</strong></div>
      </section>
      <section className={styles.fireteamGrid}>{data.members.map((member) => <MemberCard key={member.membershipId} member={member} canManage={Boolean(self?.isLeader && !member.isSelf)} copied={copied} onCopy={copyCommand} />)}</section>
      <SocialRoster contacts={data.social?.contacts || []} state={data.social?.state || "unavailable"} warning={data.social?.warning} copied={copied} onCopy={copyCommand} />
      <section className={styles.transitoryNotice}><AlertTriangle /><div><strong>Best-effort live status</strong><p>Bungie describes party and current-activity data as transitory and non-authoritative. Guardian Nexus shows timestamps and privacy states instead of presenting it as guaranteed real time.</p></div></section>
    </>}
  </AuthGate>;
}

function MemberCard({ member, canManage, copied, onCopy }: { member: FireteamMember; canManage: boolean; copied: string; onCopy: (label: string, command: string) => Promise<void> }) {
  const activity = member.onlineState === "offline" ? "Offline" : member.activity || "Orbit / unavailable";
  const onlineLabel = member.onlineState === "unknown" ? "" : ` / ${member.onlineState === "online" ? "Online" : "Offline"}`;
  return <article className={`${styles.memberCard} ${member.isSelf ? styles.selfMember : ""}`}>
    <header>{member.emblemPath ? <img src={member.emblemPath} alt="" /> : <span><Users /></span>}<div><small>IGN / {member.isSelf ? `You / ${member.presenceLabel}` : member.presenceLabel}{onlineLabel} / {member.syncState === "synced" ? member.sharingMode === "persistent" ? "Auto synced" : "Synced" : "Not synced"}</small><h2>{member.inGameName}</h2><p>{member.character ? `${member.character.className} / ${member.character.power} Power` : "Public Bungie fireteam profile"}</p></div><div className={styles.memberSignals}>{member.isLeader && <Crown aria-label="Fireteam leader" />}<i className={member.sharing ? styles.signalLive : ""} /></div></header>
    <div className={styles.memberActivity}><Activity size={15} /><span>{member.onlineState === "offline" ? "Presence" : member.activitySource === "public" ? "Public activity" : member.activitySource === "shared" ? "Shared activity" : member.activitySource === "fireteam" ? "Fireteam activity" : "Activity"}</span><strong>{activity}</strong></div>
    {member.sharing ? <div className={styles.sharedQuests}><h3>{member.sharingMode === "persistent" ? "Automatically shared objectives" : "Shared objectives"}</h3>{member.quests.length ? member.quests.map((quest) => <div className={styles.sharedQuest} key={quest.instanceId}><span className={styles.sharedQuestIcon}>{quest.icon ? <img src={quest.icon} alt="" /> : <CheckCircle2 />}</span><div className={styles.sharedQuestDetails}><div className={styles.sharedQuestTitle}><b>{quest.name}</b>{quest.stepNumber && quest.stepCount ? <em>Step {quest.stepNumber} / {quest.stepCount}</em> : <em>Active step</em>}</div><small>{quest.currentStep}</small>{quest.objectives.length > 0 && <div className={styles.sharedObjectives}>{quest.objectives.map((objective) => <div key={objective.objectiveHash}><span>{objective.name}</span><strong>{objective.complete ? "Complete" : objective.completionValue > 0 ? `${objective.progress.toLocaleString()} / ${objective.completionValue.toLocaleString()}` : `${objective.percent}%`}</strong></div>)}</div>}<i className={styles.sharedQuestBar}><span style={{ width: `${quest.percent}%` }} /></i></div><strong className={styles.sharedQuestPercent}>{quest.percent}%</strong></div>) : <p>No site-pinned or in-game-tracked quests shared.</p>}</div> : <div className={styles.privateMember}><EyeOff /><strong>Quest details not shared</strong><p>This Guardian must opt into temporary or automatic sharing.</p></div>}
    {!member.isSelf && <div className={styles.memberCommands}><button onClick={() => void onCopy(`whisper-${member.membershipId}`, `/whisper ${member.inGameName} `)} title="Copies a Destiny 2 text-chat command"><MessageSquare size={13} />{copied === `whisper-${member.membershipId}` ? "Copied" : "Whisper"}</button>{canManage && <button className={styles.managementCommand} onClick={() => void onCopy(`kick-${member.membershipId}`, `/kick ${member.inGameName}`)} title="Copies a Destiny 2 text-chat command; Guardian Nexus cannot kick through the Bungie API"><UserMinus size={13} />{copied === `kick-${member.membershipId}` ? "Copied" : "Kick command"}</button>}</div>}
    {member.overlaps.length > 0 && <footer><Link2 size={13} /><span>Shared progress opportunity:</span><strong>{member.overlaps.join(", ")}</strong></footer>}
  </article>;
}

function SocialRoster({ contacts, state, warning, copied, onCopy }: { contacts: FireteamContact[]; state: "available" | "reauthorization-required" | "unavailable"; warning?: string; copied: string; onCopy: (label: string, command: string) => Promise<void> }) {
  return <section className={styles.socialRoster}>
    <header><div><Users /><span>Social roster</span><h2>Friends & clan</h2></div><p>Online presence from Bungie. Commands are copied for Destiny 2 text chat; the API cannot join or message for you.</p></header>
    {state === "reauthorization-required" ? <div className={styles.socialUnavailable}><AlertTriangle /><div><strong>Reconnect for Bungie friends</strong><p>{warning}</p></div><a href="/api/v1/auth/start?returnTo=%2Ffireteam">Reconnect Bungie</a></div>
      : state === "unavailable" ? <div className={styles.socialUnavailable}><AlertTriangle /><div><strong>Social roster unavailable</strong><p>{warning || "Bungie did not return friends or clan presence."}</p></div></div>
      : contacts.length ? <div className={styles.socialGrid}>{contacts.map((contact) => <SocialContact key={`${contact.membershipId}-${contact.displayName}`} contact={contact} copied={copied} onCopy={onCopy} />)}</div>
      : <div className={styles.socialUnavailable}><Users /><div><strong>No friends or clan members returned</strong><p>Your current fireteam remains visible above.</p></div></div>}
  </section>;
}

function SocialContact({ contact, copied, onCopy }: { contact: FireteamContact; copied: string; onCopy: (label: string, command: string) => Promise<void> }) {
  const id = contact.membershipId || contact.displayName;
  const online = contact.onlineState === "online";
  const canJoin = canJoinContact(contact);
  const joinTitle = !canJoin ? "This Guardian is currently offline" : contact.inDestiny2 ? "Copies /join for Destiny 2 text chat" : "Copies /join; Bungie shows this Guardian online but does not identify their current title";
  return <article className={styles.socialContact}><i className={online ? styles.socialOnline : ""} /><div><span>{contact.source === "friend-and-clan" ? "Friend · Clan" : contact.source}{contact.clanName ? ` · ${contact.clanName}` : ""}</span><strong>{contact.displayName}</strong><small>{online ? contact.inDestiny2 ? "Online in Destiny 2" : "Online · title unavailable" : contact.onlineState === "offline" ? "Offline" : "Presence unknown"}</small></div><div><button disabled={!canJoin} onClick={() => void onCopy(`join-${id}`, `/join ${contact.displayName}`)} title={joinTitle}><LogIn size={13} />{copied === `join-${id}` ? "Copied" : "Join Fireteam"}</button><button disabled={!online} onClick={() => void onCopy(`friend-whisper-${id}`, `/whisper ${contact.displayName} `)} title="Copies /whisper for Destiny 2 text chat"><MessageSquare size={13} />{copied === `friend-whisper-${id}` ? "Copied" : "Whisper"}</button><button onClick={() => void onCopy(`name-${id}`, contact.displayName)} title="Copy Bungie Name"><Copy size={13} /></button></div></article>;
}

export function canJoinContact(contact: Pick<FireteamContact, "onlineState">): boolean {
  return contact.onlineState === "online";
}
