import { Gift, MoveRight } from "lucide-react";
import type { CSSProperties } from "react";
import { NavLink } from "react-router-dom";
import { activeRewardCodes } from "../rewardCodes";
import { useRewardCodeStatus } from "../rewardCodeStatus";
import { useGuardian } from "../state/GuardianContext";
import styles from "./RewardCodeMarquee.module.css";

export function RewardCodeMarquee() {
  const { session, autoRefresh } = useGuardian();
  const { hidden } = useRewardCodeStatus(session?.guardian?.membershipId, Boolean(session?.authenticated), autoRefresh);
  const codes = activeRewardCodes().filter((entry) => !hidden.has(entry.code));
  if (!codes.length) return null;
  const repeatedCodes = [...codes, ...codes];
  const timing = { "--marquee-duration": `${Math.max(72, codes.length * 2.5)}s` } as CSSProperties;

  return <NavLink to="/codes" className={styles.marquee} aria-label={`${codes.length} active reward codes not already owned or marked used. Open the full code catalog.`}>
    <strong><Gift /> {codes.length} unredeemed codes</strong>
    <div><div style={timing}>{repeatedCodes.map((entry, index) => <span key={`${index}-${entry.code}`} aria-hidden={index >= codes.length}>
      <b>{entry.code}</b>{entry.reward}<small>{entry.kind}</small>
    </span>)}</div></div>
    <em>View all <MoveRight /></em>
  </NavLink>;
}
