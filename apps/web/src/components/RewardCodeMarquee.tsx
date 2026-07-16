import { Gift, MoveRight } from "lucide-react";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { activeRewardCodes } from "../rewardCodes";
import { useRewardCodeStatus } from "../rewardCodeStatus";
import { useGuardian } from "../state/GuardianContext";
import styles from "./RewardCodeMarquee.module.css";

export function RewardCodeMarquee() {
  const { session, autoRefresh } = useGuardian();
  const { hidden } = useRewardCodeStatus(session?.guardian?.membershipId, Boolean(session?.authenticated), autoRefresh);
  const codes = activeRewardCodes().filter((entry) => !hidden.has(entry.code));
  const viewportRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const codeKey = codes.map((entry) => entry.code).join("|");

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const measure = measureRef.current;
    if (!viewport || !measure) return;

    const updateOverflow = () => {
      setShouldScroll(measure.scrollWidth > viewport.clientWidth + 1);
    };

    updateOverflow();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateOverflow);
      return () => window.removeEventListener("resize", updateOverflow);
    }

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(viewport);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [codeKey]);

  if (!codes.length) return null;
  const repeatedCodes = [...codes, ...codes];
  const timing = { "--marquee-duration": `${Math.max(72, codes.length * 2.5)}s` } as CSSProperties;

  return <NavLink to="/codes" className={styles.marquee} aria-label={`${codes.length} active reward codes not already owned or marked used. Open the full code catalog.`}>
    <strong><Gift /> {codes.length} unredeemed codes</strong>
    <div className={styles.viewport} ref={viewportRef}>
      <div className={styles.measure} ref={measureRef} aria-hidden="true">
        {codes.map((entry) => <span key={entry.code}>
          <b>{entry.code}</b>{entry.reward}<small>{entry.kind}</small>
        </span>)}
      </div>
      <div className={`${styles.track} ${shouldScroll ? styles.scrolling : styles.static}`} style={timing}>
        {(shouldScroll ? repeatedCodes : codes).map((entry, index) => <span key={`${index}-${entry.code}`} aria-hidden={shouldScroll && index >= codes.length}>
          <b>{entry.code}</b>{entry.reward}<small>{entry.kind}</small>
        </span>)}
      </div>
    </div>
    <em>View all <MoveRight /></em>
  </NavLink>;
}
