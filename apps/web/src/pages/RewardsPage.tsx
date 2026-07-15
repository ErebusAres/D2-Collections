import { ExternalLink, LockKeyhole, Sparkles, Ticket } from "lucide-react";
import { AuthGate, PageHeader } from "../components/Page";
import { useGuardian } from "../state/GuardianContext";
import styles from "./Pages.module.css";

const OFFICIAL_REWARDS_URL = "https://www.bungie.net/7/en/Seasons/Progress";

export function RewardsPage() {
  const { session } = useGuardian();
  const stats = session?.guardian?.stats;
  const rank = stats?.rewardsPassRank || 0;
  const progress = stats?.rewardsPassProgress;
  const checkpoints = [1, 10, 25, 50, 75, 100];

  return <AuthGate>
    <PageHeader eyebrow="Account-wide progression" title="Rewards Pass" description="Track your current rank and XP here, then use Bungie's authenticated Rewards Pass page for reward details and claiming." />
    <section className={styles.rewardsHero}>
      <div className={styles.rewardsRank}><Ticket /><span>Current rank</span><strong>{rank || "—"}</strong></div>
      <div className={styles.rewardsProgress}><header><div><span>Next rank</span><strong>{rank + 1}</strong></div><b>{progress?.percent || 0}%</b></header><i><span style={{ width: `${progress?.percent || 0}%` }} /></i><p>{progress?.nextLevelAt ? `${progress.progress.toLocaleString()} / ${progress.nextLevelAt.toLocaleString()} XP` : "Bungie did not return the current XP counter."}</p></div>
      <a href={OFFICIAL_REWARDS_URL} target="_blank" rel="noreferrer"><ExternalLink /><span>Open official tracker</span><strong>View and claim rewards</strong></a>
    </section>
    <section className={styles.rewardsTrack}><header><div><Sparkles /><span>Rank milestones</span></div><p>The current API exposes progression, but not a supported third-party reward-claim action.</p></header><div>{checkpoints.map((checkpoint) => <article key={checkpoint} className={rank >= checkpoint ? styles.rewardReached : ""}><i>{rank >= checkpoint ? <Sparkles /> : <LockKeyhole />}</i><span>Rank</span><strong>{checkpoint}</strong><small>{rank >= checkpoint ? "Reached" : `${Math.max(0, checkpoint - rank)} ranks away`}</small></article>)}</div></section>
    <section className={styles.transitoryNotice}><LockKeyhole /><div><strong>Claiming stays with Bungie</strong><p>Guardian Nexus does not submit reward claims because Bungie's public third-party API does not expose that action. The official tracker above is the safe handoff.</p></div></section>
  </AuthGate>;
}
