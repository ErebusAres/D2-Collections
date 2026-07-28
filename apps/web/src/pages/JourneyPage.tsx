import type { GuardianRankData, JourneyProgressData, QuestData, RewardsPassData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { Badge, CalendarDays, CheckSquare2, Crown, ListTodo, ScrollText, Sparkles } from "lucide-react";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { JourneyNav } from "../components/journey/JourneyNav";
import { ProgressSummaryCard } from "../components/journey/ProgressSummaryCard";
import { useGuardian } from "../context/GuardianContext";
import { guardianRankPercent, questKind, questPercent, rewardsPercent } from "../modules/journey/progressSummary";
import { rewardLevelProgress } from "../modules/rewards/rewardsProgress";
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
  const rewards = useQuery({
    queryKey: ["rewards", selectedCharacterId],
    queryFn: () => api<RewardsPassData>(`/api/v1/me/rewards?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled,
    refetchInterval: autoRefresh ? 60_000 : false,
    refetchIntervalInBackground: false
  });
  const journey = useQuery({
    queryKey: ["journey-progress", selectedCharacterId],
    queryFn: () => api<JourneyProgressData>(`/api/v1/me/journey?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled,
    refetchInterval: autoRefresh ? LIVE_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false
  });
  const loading = quests.isLoading || ranks.isLoading || rewards.isLoading || journey.isLoading;
  const error = quests.error || ranks.error || rewards.error || journey.error;
  const hasData = Boolean(quests.data || ranks.data || rewards.data || journey.data);
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
  const rewardData = rewards.data?.data;
  const levelProgress = rewardLevelProgress(rewardData?.progress);
  const claimableRewards = rewardData?.rewards.filter((reward) => reward.state === "available").length || 0;
  const nearComplete = allPursuits.filter((quest) => quest.percent >= 75 && quest.percent < 100);
  const progressData = journey.data?.data;

  return <AuthGate>
    <PageHeader
      eyebrow="Progress hub"
      title="Journey"
      description="Your progression systems in one place, with the closest objectives surfaced first."
      actions={<Freshness observedAt={journey.data?.freshness.observedAt || quests.data?.freshness.observedAt || ranks.data?.freshness.observedAt || rewards.data?.freshness.observedAt} warning={journey.data?.warnings[0] || quests.data?.warnings[0] || ranks.data?.warnings[0] || rewards.data?.warnings[0]} />}
    />
    <JourneyNav />
    <QueryState loading={loading} error={error as Error} hasData={hasData} onRetry={() => { void quests.refetch(); void ranks.refetch(); void rewards.refetch(); void journey.refetch(); }} />
    {hasData && <>
      <section className={styles.hero}>
        <div><span>What should I work on next?</span><h2>{nextAction(activeQuests, bounties, rankRemaining, claimableRewards)}</h2><p>{nextActionDetail(activeQuests, bounties, rankRemaining, claimableRewards)}</p></div>
        <div className={styles.heroStats}>
          <span><small>Near completion</small><strong>{nearComplete.length}</strong></span>
          <span><small>Tracked in Destiny</small><strong>{allPursuits.filter((quest) => quest.inGameTracked).length}</strong></span>
          <span><small>Current activity</small><strong>{quests.data?.data.currentActivity || "Orbit"}</strong></span>
        </div>
      </section>
      <section className={styles.grid}>
        <ProgressSummaryCard title="Active Quests" eyebrow="Pursuits" description="Campaign, Exotic, and featured quest progress." to="/journey/quests" icon={ListTodo} progress={questPercent(activeQuests)} progressLabel="Average active progress" stats={[
          { label: "Active", value: activeQuests.length },
          { label: "Campaign", value: campaignCount },
          { label: "Exotic", value: exoticCount }
        ]}><span>{featuredCount} featured or tracked right now</span></ProgressSummaryCard>
        <ProgressSummaryCard title="Bounties" eyebrow="Short-term objectives" description="Daily, weekly, seasonal, and vendor pursuits." to="/journey/bounties" icon={CheckSquare2} progress={questPercent(bounties)} progressLabel="Average bounty progress" stats={[
          { label: "Active", value: bounties.length },
          { label: "Complete", value: completedBounties },
          { label: "Remaining", value: Math.max(0, bounties.length - completedBounties) }
        ]} tone="green" />
        <ProgressSummaryCard title="Seasonal Hub" eyebrow="Current progression" description="Rewards Pass progress and seasonal objectives." to="/journey/season" icon={Sparkles} progress={rewardsPercent(rewardData)} progressLabel={rewardData ? `Toward rank ${rewardData.rank + 1}` : "Season progress"} stats={[
          { label: "Pass rank", value: rewardData?.rank ?? "—" },
          { label: "XP", value: levelProgress ? `${levelProgress.percent}%` : "—" },
          { label: "Rewards", value: claimableRewards }
        ]} tone="violet" />
        <ProgressSummaryCard title="Guardian Rank" eyebrow="Journey objectives" description="Current objectives and the route to your next rank." to="/journey/guardian-rank" icon={Badge} progress={guardianRankPercent(rankData)} progressLabel={rankData ? `Rank ${rankData.currentRank} objectives` : "Rank progress"} stats={[
          { label: "Current", value: rankData?.currentRank ?? "—" },
          { label: "Remaining", value: rankRemaining },
          { label: "Maximum", value: rankData?.maximumRank ?? 12 }
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
        <ProgressSummaryCard title="Weekly Progress" eyebrow="Reset checklist" description="Weekly pursuits and reward opportunities in one view." to="/journey/weekly" icon={CalendarDays} progress={questPercent(bounties.filter((quest) => /weekly/i.test(quest.itemType || "")))} progressLabel="Known weekly pursuits" stats={[
          { label: "Known", value: progressData?.weeklyChallenges.length ?? bounties.filter((quest) => /weekly/i.test(quest.itemType || "")).length },
          { label: "Near", value: nearComplete.length },
          { label: "Reset", value: "Tuesday" }
        ]} tone="green" />
      </section>
    </>}
  </AuthGate>;
}

function nextAction(quests: QuestData["quests"], bounties: QuestData["quests"], rankRemaining: number, claimableRewards: number): string {
  const near = [...quests, ...bounties].filter((quest) => quest.percent >= 75 && quest.percent < 100).sort((left, right) => right.percent - left.percent)[0];
  if (near) return `Finish ${near.name}`;
  if (claimableRewards) return `Claim ${claimableRewards} Rewards Pass reward${claimableRewards === 1 ? "" : "s"}`;
  if (rankRemaining) return `Advance Guardian Rank`;
  return quests[0]?.name || bounties[0]?.name || "Choose a new goal";
}

function nextActionDetail(quests: QuestData["quests"], bounties: QuestData["quests"], rankRemaining: number, claimableRewards: number): string {
  const near = [...quests, ...bounties].filter((quest) => quest.percent >= 75 && quest.percent < 100).sort((left, right) => right.percent - left.percent)[0];
  if (near) return `${near.percent}% complete${near.currentStep ? ` · ${near.currentStep}` : ""}`;
  if (claimableRewards) return "Rewards are currently available on your pass.";
  if (rankRemaining) return `${rankRemaining} current-rank objective${rankRemaining === 1 ? "" : "s"} remaining.`;
  return "Open a tracker below to pick your next objective.";
}
