import type { GuardianRankData, JourneyProgressData, QuestData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Badge, CalendarDays, CheckSquare2, Crown, ListTodo, ScrollText, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { JourneyNav } from "../components/journey/JourneyNav";
import { ProgressSummaryCard } from "../components/journey/ProgressSummaryCard";
import { useGuardian } from "../context/GuardianContext";
import { guardianRankPercent, questKind, questPercent } from "../modules/journey/progressSummary";
import { api } from "../services/api/client";
import { LIVE_REFRESH_INTERVAL_MS } from "../services/liveRefresh";
import styles from "./JourneyPage.module.css";

export function JourneyPage() {
  const { session, selectedCharacterId, autoRefresh } = useGuardian();
  const enabled = Boolean(session?.authenticated && selectedCharacterId);
  const quests = useQuery({
    queryKey: ["quests", selectedCharacterId, ""],
    queryFn: () => api<QuestData>(`/api/v1/me/quests?characterId=${encodeURIComponent(selectedCharacterId)}&pinned=`),
    enabled,
    refetchInterval: autoRefresh ? LIVE_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false
  });
  const ranks = useQuery({
    queryKey: ["guardian-rank", selectedCharacterId],
    queryFn: () => api<GuardianRankData>(`/api/v1/me/guardian-rank?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled,
    staleTime: LIVE_REFRESH_INTERVAL_MS,
    refetchInterval: autoRefresh ? LIVE_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false
  });
  const journey = useQuery({
    queryKey: ["journey-progress", selectedCharacterId],
    queryFn: () => api<JourneyProgressData>(`/api/v1/me/journey?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled,
    refetchInterval: autoRefresh ? LIVE_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false
  });
  const loading = quests.isLoading || ranks.isLoading || journey.isLoading;
  const error = quests.error || ranks.error || journey.error;
  const hasData = Boolean(quests.data || ranks.data || journey.data);
  const allPursuits = quests.data?.data.quests || [];
  const activeQuests = allPursuits.filter((quest) => !quest.category || quest.category === "quest");
  const bounties = allPursuits.filter((quest) => quest.category === "bounty" || quest.category === "order");
  const campaignCount = activeQuests.filter((quest) => questKind(quest) === "campaign").length;
  const exoticCount = activeQuests.filter((quest) => questKind(quest) === "exotic").length;
  const featuredCount = activeQuests.filter((quest) => questKind(quest) === "featured").length;
  const completedBounties = bounties.filter((quest) => quest.percent >= 100).length;
  const rankData = ranks.data?.data;
  const rankTier = rankData?.ranks.find((rank) => rank.rankNumber === rankData.currentRank);
  const rankRemaining = Math.max(0, (rankTier?.total || 0) - (rankTier?.completed || 0));
  const nearComplete = allPursuits.filter((quest) => quest.percent >= 75 && quest.percent < 100);
  const progressData = journey.data?.data;
  const seasonalChallenges = progressData?.seasonalChallenges || [];
  const seasonalProgress = seasonalChallenges.length ? Math.round(seasonalChallenges.reduce((sum, challenge) => sum + challenge.percent, 0) / seasonalChallenges.length) : 0;
  const recommendation = nextAction(activeQuests, bounties, rankRemaining);

  return <AuthGate>
    <PageHeader
      eyebrow="Progress hub"
      title="Journey"
      description="Your progression systems in one place, with the closest objectives surfaced first."
      actions={<Freshness observedAt={journey.data?.freshness.observedAt || quests.data?.freshness.observedAt || ranks.data?.freshness.observedAt} warning={journey.data?.warnings[0] || quests.data?.warnings[0] || ranks.data?.warnings[0]} />}
    />
    <JourneyNav />
    <QueryState loading={loading} error={error as Error} hasData={hasData} onRetry={() => { void quests.refetch(); void ranks.refetch(); void journey.refetch(); }} />
    {hasData && <>
      <section className={styles.hero}>
        <div><span>What should I work on next?</span><h2>{recommendation.title}</h2><p>{recommendation.detail}</p><Link to={recommendation.to}>Open objective <ArrowRight /></Link></div>
        <div className={styles.heroStats}>
          <span><small>Near completion</small><strong>{nearComplete.length}</strong></span>
          <span><small>Tracked in Destiny</small><strong>{allPursuits.filter((quest) => quest.inGameTracked).length}</strong></span>
          <span><small>Current activity</small><strong>{quests.data?.data.currentActivity || "Not reported"}</strong></span>
        </div>
      </section>
      <section className={styles.grid}>
        <ProgressSummaryCard title="Active Quests" eyebrow="Pursuits" description="Campaign, Exotic, and featured quest progress." to="/journey/quests" icon={ListTodo} stats={[
          { label: "Active", value: activeQuests.length },
          { label: "Campaign", value: campaignCount },
          { label: "Exotic", value: exoticCount }
        ]} progress={activeQuests.length ? questPercent(activeQuests) : undefined} progressLabel="Average active progress"><span>{featuredCount} featured or tracked right now</span></ProgressSummaryCard>
        <ProgressSummaryCard title="Bounties" eyebrow="Short-term objectives" description="Daily, weekly, seasonal, and vendor pursuits." to="/journey/bounties" icon={CheckSquare2} stats={[
          { label: "Active", value: bounties.length },
          { label: "Complete", value: completedBounties },
          { label: "Remaining", value: Math.max(0, bounties.length - completedBounties) }
        ]} progress={bounties.length ? questPercent(bounties) : undefined} progressLabel="Average pursuit progress" tone="green" />
        <ProgressSummaryCard title="Seasonal Hub" eyebrow="Current progression" description="Seasonal challenges, pursuits, and artifact progression." to="/journey/season" icon={Sparkles} stats={[
          { label: "Challenges", value: seasonalChallenges.length },
          { label: "Complete", value: seasonalChallenges.filter((challenge) => challenge.complete).length },
          { label: "Artifact", value: progressData?.artifact ? `+${progressData.artifact.powerBonus}` : "—" }
        ]} progress={seasonalChallenges.length ? seasonalProgress : undefined} progressLabel="Seasonal challenge progress" tone="violet" />
        <ProgressSummaryCard title="Guardian Rank" eyebrow="Journey objectives" description="Current objectives and the route to your next rank." to="/journey/guardian-rank" icon={Badge} progress={guardianRankPercent(rankData)} progressLabel={rankData ? `Rank ${rankData.currentRank} objectives` : "Rank progress"} stats={[
          { label: "Current", value: rankData?.currentRank ?? "—" },
          { label: "Remaining", value: rankRemaining },
          { label: "Maximum", value: rankData?.maximumRank ?? "—" }
        ]} tone="gold" />
        <ProgressSummaryCard title="Titles & Seals" eyebrow="Long-term goals" description="Equipped titles, unlocked seals, and active pursuits." to="/journey/titles" icon={Crown} stats={[
          { label: "Available", value: progressData?.titles.length ?? "—" },
          { label: "Unlocked", value: progressData?.titles.filter((title) => title.complete).length ?? "—" },
          { label: "Near", value: progressData?.titles.filter((title) => !title.complete && title.percent >= 75).length ?? "—" }
        ]} tone="gold"><span>{progressData?.titles.find((title) => !title.complete)?.title || "Open the seal tracker"}</span></ProgressSummaryCard>
        <ProgressSummaryCard title="Triumphs" eyebrow="Account accomplishments" description="Tracked, recent, and near-complete Triumphs." to="/journey/triumphs" icon={ScrollText} stats={[
          { label: "Score", value: progressData?.triumphScore.active.toLocaleString() ?? "—" },
          { label: "Tracked", value: progressData?.triumphs.filter((record) => record.tracked).length ?? "—" },
          { label: "Near", value: progressData?.triumphs.filter((record) => !record.complete && record.percent >= 75).length ?? "—" }
        ]}><span>{progressData?.triumphs.length || 0} records available</span></ProgressSummaryCard>
        <ProgressSummaryCard title="Weekly Progress" eyebrow="Reset checklist" description="Weekly activity challenges and time-limited pursuits." to="/journey/weekly" icon={CalendarDays} progress={progressData?.weeklyChallenges.length ? Math.round(progressData.weeklyChallenges.reduce((sum, challenge) => sum + challenge.objective.percent, 0) / progressData.weeklyChallenges.length) : undefined} progressLabel="Activity challenge progress" stats={[
          { label: "Known", value: progressData?.weeklyChallenges.length ?? bounties.filter((quest) => /weekly/i.test(quest.itemType || "")).length },
          { label: "Near", value: nearComplete.length },
          { label: "Reset", value: "Tuesday" }
        ]} tone="green" />
      </section>
    </>}
  </AuthGate>;
}

function nextAction(quests: QuestData["quests"], bounties: QuestData["quests"], rankRemaining: number): { title: string; detail: string; to: string } {
  const near = [...quests, ...bounties].filter((quest) => quest.percent >= 75 && quest.percent < 100).sort((left, right) => right.percent - left.percent)[0];
  if (near) return {
    title: `Finish ${near.name}`,
    detail: `${near.percent}% complete${near.currentStep ? ` · ${near.currentStep}` : ""}`,
    to: `/quests/${encodeURIComponent(near.instanceId)}`
  };
  if (rankRemaining) return {
    title: "Advance Guardian Rank",
    detail: `${rankRemaining} objective${rankRemaining === 1 ? "" : "s"} remain before the next rank.`,
    to: "/journey/guardian-rank"
  };
  const first = quests[0] || bounties[0];
  if (first) return { title: first.name, detail: first.currentStep || first.description, to: `/quests/${encodeURIComponent(first.instanceId)}` };
  return { title: "Choose a new goal", detail: "Open a tracker below to choose your next objective.", to: "/journey/quests" };
}
