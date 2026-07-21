import { Gift, MoveRight } from "lucide-react";
import { NavLink } from "react-router-dom";
import { activeRewardCodes } from "../../modules/reward-codes/rewardCodes";
import { useRewardCodeStatus } from "../../modules/reward-codes/rewardCodeStatus";
import { useGuardian } from "../../context/GuardianContext";
import styles from "./RewardCodeMarquee.module.css";

export function RewardCodeMarquee() {
  const { session, autoRefresh } = useGuardian();
  const { hidden } = useRewardCodeStatus(session?.guardian?.membershipId, Boolean(session?.authenticated), autoRefresh);
  const codes = activeRewardCodes().filter((entry) => !hidden.has(entry.code));
  if (!codes.length) return null;
  const preview = codes.slice(0, 3);
  const remaining = Math.max(0, codes.length - preview.length);

  return <NavLink to="/codes" className={styles.marquee} aria-label={`${codes.length} active reward codes not already owned or marked used. Open the full code catalog.`}>
    <strong><Gift /> {codes.length} unredeemed codes</strong>
    <div className={styles.preview} aria-hidden="true">
        {preview.map((entry) => <span key={entry.code}>
          <b>{entry.code}</b>{entry.reward}<small>{entry.kind}</small>
        </span>)}
        {remaining > 0 && <span className={styles.remaining}>+{remaining} more</span>}
    </div>
    <em>View all <MoveRight /></em>
  </NavLink>;
}
