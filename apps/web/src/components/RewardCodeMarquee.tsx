import { Gift, MoveRight } from "lucide-react";
import { NavLink } from "react-router-dom";
import { featuredRewardCodes } from "../rewardCodes";
import styles from "./RewardCodeMarquee.module.css";

export function RewardCodeMarquee() {
  const codes = featuredRewardCodes();
  if (!codes.length) return null;
  const repeatedCodes = [...codes, ...codes];

  return <NavLink to="/codes" className={styles.marquee} aria-label={`${codes.length} currently active featured reward codes. Open the full code catalog.`}>
    <strong><Gift /> Active reward codes</strong>
    <div><div>{repeatedCodes.map((entry, index) => <span key={`${index}-${entry.code}`} aria-hidden={index >= codes.length}>
      <b>{entry.code}</b>{entry.reward}<small>{entry.kind}</small>
    </span>)}</div></div>
    <em>View all <MoveRight /></em>
  </NavLink>;
}
