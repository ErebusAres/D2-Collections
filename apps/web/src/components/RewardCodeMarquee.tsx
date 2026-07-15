import { Gift, MoveRight } from "lucide-react";
import type { CSSProperties } from "react";
import { NavLink } from "react-router-dom";
import { activeRewardCodes } from "../rewardCodes";
import { useRedeemedRewardCodes } from "../rewardCodePreferences";
import { useGuardian } from "../state/GuardianContext";
import styles from "./RewardCodeMarquee.module.css";

export function RewardCodeMarquee() {
  const { session } = useGuardian();
  const redeemed = useRedeemedRewardCodes(session?.guardian?.membershipId);
  const codes = activeRewardCodes().filter((entry) => !redeemed.has(entry.code));
  if (!codes.length) return <NavLink to="/codes" className={`${styles.marquee} ${styles.complete}`} aria-label="All current reward codes are marked redeemed. Open the code catalog.">
    <strong><Gift /> Reward codes</strong><div><b>All current active codes are marked redeemed.</b></div><em>Review <MoveRight /></em>
  </NavLink>;
  const repeatedCodes = [...codes, ...codes];
  const timing = { "--marquee-duration": `${Math.max(72, codes.length * 2.5)}s` } as CSSProperties;

  return <NavLink to="/codes" className={styles.marquee} aria-label={`${codes.length} active reward codes not marked redeemed. Open the full code catalog.`}>
    <strong><Gift /> {codes.length} unredeemed codes</strong>
    <div><div style={timing}>{repeatedCodes.map((entry, index) => <span key={`${index}-${entry.code}`} aria-hidden={index >= codes.length}>
      <b>{entry.code}</b>{entry.reward}<small>{entry.kind}</small>
    </span>)}</div></div>
    <em>View all <MoveRight /></em>
  </NavLink>;
}
