import { Check, CheckCircle2, Clock3, Copy, ExternalLink, Eye, EyeOff, Gift, Search, ShieldCheck, TimerOff } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "../components/Page";
import { activeRewardCodes, rewardCodes, type RewardCodeKind } from "../rewardCodes";
import { setRewardCodeRedeemed, useRedeemedRewardCodes } from "../rewardCodePreferences";
import { useGuardian } from "../state/GuardianContext";
import styles from "./RewardCodesPage.module.css";

const REDEEM_URL = "https://www.bungie.net/7/en/codes/redeem";

function formatCatalogDate(value: string): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: dateOnly ? "UTC" : undefined }).format(new Date(value));
}

export function RewardCodesPage() {
  const { session } = useGuardian();
  const membershipId = session?.guardian?.membershipId;
  const redeemed = useRedeemedRewardCodes(membershipId);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"All" | RewardCodeKind>("All");
  const [copied, setCopied] = useState("");
  const [hideRedeemed, setHideRedeemed] = useState(true);
  const active = activeRewardCodes();
  const unredeemedActive = active.filter((entry) => !redeemed.has(entry.code));
  const catalogRedeemedCount = rewardCodes.filter((entry) => redeemed.has(entry.code)).length;
  const filtered = useMemo(() => rewardCodes.filter((entry) => (!hideRedeemed || !redeemed.has(entry.code)) && (kind === "All" || entry.kind === kind) && `${entry.code} ${entry.reward}`.toLowerCase().includes(search.toLowerCase())).sort((left, right) => Number(Boolean(right.featured)) - Number(Boolean(left.featured)) || left.reward.localeCompare(right.reward)), [search, kind, hideRedeemed, redeemed]);
  const kinds = ["All", ...new Set(rewardCodes.map((entry) => entry.kind))] as const;
  const copy = async (code: string) => { try { await navigator.clipboard.writeText(code); setCopied(code); window.setTimeout(() => setCopied((value) => value === code ? "" : value), 1600); } catch { setCopied(""); } };

  return <>
    <PageHeader eyebrow="Universal rewards" title="Claimable Codes" description="A curated catalog of universal Bungie redemption codes with verification and expiration status—never generated or guessed." actions={<a className={styles.redeemTop} href={REDEEM_URL} target="_blank" rel="noreferrer"><ExternalLink /> Open Bungie redemption</a>} />
    <section className={styles.summary}><div><Gift /><span>Unredeemed active</span><strong>{unredeemedActive.length}</strong></div><div><CheckCircle2 /><span>Marked redeemed</span><strong>{catalogRedeemedCount}</strong></div><div><Clock3 /><span>Last catalog verification</span><strong>July 11, 2026</strong></div><div><ShieldCheck /><span>Redemption</span><strong>Official Bungie site</strong></div></section>
    <section className={styles.notice}><ShieldCheck /><p>“Active” means the code appeared in the current community-verified catalog on the date shown. Bungie does not publish a code-status API or expiration date for most universal rewards. Redeemed checkmarks are saved <b>for this Bungie membership in this browser</b>; newly added codes begin unchecked.</p></section>
    <section className={styles.filters}><label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reward or code" /></label><div>{kinds.map((value) => <button key={value} className={kind === value ? styles.activeFilter : ""} onClick={() => setKind(value)}>{value}</button>)}</div><button className={styles.redeemedFilter} onClick={() => setHideRedeemed((value) => !value)}>{hideRedeemed ? <Eye /> : <EyeOff />}{hideRedeemed ? `Show redeemed (${catalogRedeemedCount})` : "Hide redeemed"}</button><span>{filtered.length} shown</span></section>
    <section className={styles.codeGrid}>{filtered.map((entry) => {
      const expired = Boolean(entry.expiresAt && Date.parse(entry.expiresAt) <= Date.now());
      const isRedeemed = redeemed.has(entry.code);
      return <article key={entry.code} className={`${expired ? styles.expired : ""} ${entry.featured ? styles.featured : ""} ${isRedeemed ? styles.redeemed : ""}`}><header><span>{entry.kind}</span>{isRedeemed ? <b><CheckCircle2 /> Redeemed</b> : entry.featured && <b>Featured</b>}</header><main><h2>{entry.reward}</h2><code>{entry.code}</code><p>{expired ? <><TimerOff /> Expired {formatCatalogDate(entry.expiresAt!)}</> : <><Check /> Active · no published expiration</>}</p><small>Verified {formatCatalogDate(entry.verifiedAt)}</small></main><footer><button onClick={() => void copy(entry.code)}>{copied === entry.code ? <Check /> : <Copy />}{copied === entry.code ? "Copied" : "Copy code"}</button><button className={styles.redeemedAction} aria-pressed={isRedeemed} onClick={() => setRewardCodeRedeemed(membershipId, entry.code, !isRedeemed)}><CheckCircle2 />{isRedeemed ? "Unmark" : "Mark used"}</button><a href={REDEEM_URL} target="_blank" rel="noreferrer">Redeem <ExternalLink /></a><a href={entry.sourceUrl} target="_blank" rel="noreferrer" title="Open verification source"><ShieldCheck /></a></footer></article>;
    })}</section>
    {!filtered.length && <section className={styles.emptyCodes}><CheckCircle2 /><strong>No unredeemed codes match</strong><span>Show redeemed codes or clear the current filters to review the full catalog.</span></section>}
  </>;
}
