import { Check, CheckCircle2, Clock3, Copy, ExternalLink, Eye, EyeOff, Gift, Search, ShieldCheck, TimerOff } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "../components/common/Page";
import { activeRewardCodes, rewardCodeRedemptionUrl, rewardCodes, type RewardCodeKind } from "../modules/reward-codes/rewardCodes";
import { rewardCodeManifestItems, useRewardCodeManifest } from "../modules/reward-codes/rewardCodeManifest";
import { setRewardCodeRedeemed } from "../modules/reward-codes/rewardCodePreferences";
import { useRewardCodeStatus } from "../modules/reward-codes/rewardCodeStatus";
import { useGuardian } from "../context/GuardianContext";
import styles from "./RewardCodesPage.module.css";

function formatCatalogDate(value: string): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: dateOnly ? "UTC" : undefined }).format(new Date(value));
}

export function RewardCodesPage() {
  const { session, autoRefresh } = useGuardian();
  const membershipId = session?.guardian?.membershipId;
  const { manual, detected, hidden, data: accountStatus, warnings, loading: accountStatusLoading, error: accountStatusError } = useRewardCodeStatus(membershipId, Boolean(session?.authenticated), autoRefresh);
  const rewardManifest = useRewardCodeManifest();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"All" | RewardCodeKind>("All");
  const [copied, setCopied] = useState("");
  const [hideRedeemed, setHideRedeemed] = useState(true);
  const active = activeRewardCodes();
  const unredeemedActive = active.filter((entry) => !hidden.has(entry.code));
  const catalogHiddenCount = rewardCodes.filter((entry) => hidden.has(entry.code)).length;
  const catalogDetectedCount = rewardCodes.filter((entry) => detected.has(entry.code)).length;
  const catalogManualCount = rewardCodes.filter((entry) => manual.has(entry.code)).length;
  const lastCatalogVerification = rewardCodes.reduce((latest, entry) => entry.verifiedAt > latest ? entry.verifiedAt : latest, "");
  const filtered = useMemo(() => rewardCodes.filter((entry) => (!hideRedeemed || !hidden.has(entry.code)) && (kind === "All" || entry.kind === kind) && `${entry.code} ${entry.reward}`.toLowerCase().includes(search.toLowerCase())).sort((left, right) => Number(Boolean(right.featured)) - Number(Boolean(left.featured)) || left.reward.localeCompare(right.reward)), [search, kind, hideRedeemed, hidden]);
  const kinds = ["All", ...new Set(rewardCodes.map((entry) => entry.kind))] as const;
  const copy = async (code: string) => { try { await navigator.clipboard.writeText(code); setCopied(code); window.setTimeout(() => setCopied((value) => value === code ? "" : value), 1600); } catch { setCopied(""); } };

  return <>
    <PageHeader eyebrow="Universal rewards" title="Claimable Codes" description="A curated catalog of universal Bungie redemption codes with verification and expiration status—never generated or guessed." actions={<a className={styles.redeemTop} href={rewardCodeRedemptionUrl()} target="_blank" rel="noreferrer"><ExternalLink /> Open Bungie redemption</a>} />
    <section className={styles.summary}><div><Gift /><span>Unredeemed active</span><strong>{unredeemedActive.length}</strong></div><div><ShieldCheck /><span>Detected in Collections</span><strong>{catalogDetectedCount}</strong></div><div><CheckCircle2 /><span>Manually marked</span><strong>{catalogManualCount}</strong></div><div><Clock3 /><span>Last catalog verification</span><strong>{lastCatalogVerification ? formatCatalogDate(lastCatalogVerification) : "Unavailable"}</strong></div></section>
    <section className={styles.notice}><ShieldCheck /><p>Bungie does not expose universal code-redemption history. Guardian Nexus automatically hides a code only when its <b>exact reward is already acquired in your Destiny Collections</b>. Unmapped rewards remain manually controllable, and browser checkmarks stay scoped to this Bungie membership. Redemption links pass the code through Bungie’s redemption URL and copy it as a fallback.{warnings.length ? ` ${warnings.join(" ")}` : accountStatus ? " Collection ownership is refreshed periodically and when this tab regains focus." : accountStatusLoading ? " Checking your Collection ownership now." : accountStatusError ? " Collection ownership detection is temporarily unavailable; manual checkmarks still work." : " Sign in to enable Collection ownership detection."}</p></section>
    <section className={styles.filters}><label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reward or code" /></label><div>{kinds.map((value) => <button key={value} className={kind === value ? styles.activeFilter : ""} onClick={() => setKind(value)}>{value}</button>)}</div><button className={styles.redeemedFilter} onClick={() => setHideRedeemed((value) => !value)}>{hideRedeemed ? <Eye /> : <EyeOff />}{hideRedeemed ? `Show hidden (${catalogHiddenCount})` : "Hide used / owned"}</button><span>{filtered.length} shown</span></section>
    <section className={styles.codeGrid}>{filtered.map((entry) => {
      const expired = Boolean(entry.expiresAt && Date.parse(entry.expiresAt) <= Date.now());
      const isHidden = hidden.has(entry.code);
      const isDetected = detected.has(entry.code);
      const isManual = manual.has(entry.code);
      const rewardItems = rewardCodeManifestItems(rewardManifest.data, entry.code);
      return <article key={entry.code} className={`${expired ? styles.expired : ""} ${entry.featured ? styles.featured : ""} ${isHidden ? styles.redeemed : ""}`}>
        <header><span>{entry.kind}</span>{isDetected ? <b><ShieldCheck /> In Collections</b> : isManual ? <b><CheckCircle2 /> Marked used</b> : entry.featured && <b>Featured</b>}</header>
        <main>
          <h2>{entry.reward}</h2>
          <p>{expired ? <><TimerOff /> Expired {formatCatalogDate(entry.expiresAt!)}</> : <><Check /> Active · no published expiration</>}</p>
          <code>{entry.code}</code>
          <section className={styles.rewardExamples} aria-label={`Rewards for ${entry.code}`}>
            <strong>Redeems for</strong>
            {rewardItems.length ? <ul>{rewardItems.map((item) => <li key={`${item.itemHash}-${item.collectibleHash}`}><img src={item.icon} alt="" loading="lazy" /><span><b>{item.name}</b><small>{item.itemType || "Destiny reward"}</small></span></li>)}</ul>
              : <span>{rewardManifest.isLoading ? "Loading verified reward preview…" : rewardManifest.isError ? "Reward preview is temporarily unavailable." : "No exact Bungie item preview is available for this reward."}</span>}
          </section>
          <small>Verified {formatCatalogDate(entry.verifiedAt)}</small>
        </main>
        <footer><button onClick={() => void copy(entry.code)}>{copied === entry.code ? <Check /> : <Copy />}{copied === entry.code ? "Copied" : "Copy code"}</button><button className={styles.redeemedAction} aria-pressed={isHidden} disabled={isDetected} title={isDetected ? "This exact reward is already acquired in Destiny Collections." : undefined} onClick={() => setRewardCodeRedeemed(membershipId, entry.code, !isManual)}><CheckCircle2 />{isDetected ? "Owned" : isManual ? "Unmark" : "Mark used"}</button><a href={rewardCodeRedemptionUrl(entry.code)} target="_blank" rel="noreferrer" onClick={() => void copy(entry.code)}>Copy & redeem <ExternalLink /></a><a href={entry.sourceUrl} target="_blank" rel="noreferrer" title="Open verification source"><ShieldCheck /></a></footer>
      </article>;
    })}</section>
    {!filtered.length && <section className={styles.emptyCodes}><CheckCircle2 /><strong>No unredeemed codes match</strong><span>Show hidden codes or clear the current filters to review the full catalog.</span></section>}
  </>;
}
