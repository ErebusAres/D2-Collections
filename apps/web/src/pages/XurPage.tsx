import type { CollectionData, ExoticCollectionEntry } from "@guardian-nexus/contracts";
import { xurSchedule } from "@guardian-nexus/domain";
import { useQuery } from "@tanstack/react-query";
import { Clock3, Coins, MapPin, Shield, Sparkles, Swords } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/Page";
import { useGuardian } from "../state/GuardianContext";
import styles from "./Pages.module.css";

export function XurPage() {
  const { selectedCharacterId, session, autoRefresh } = useGuardian();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const schedule = xurSchedule(now);
  const result = useQuery({
    queryKey: ["xur", selectedCharacterId],
    queryFn: () => api<CollectionData>(`/api/v1/me/collection?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    refetchInterval: autoRefresh ? 5 * 60_000 : false,
    refetchIntervalInBackground: false
  });
  const data = result.data?.data;
  const items = useMemo(() => (data?.entries || []).filter((entry) => entry.xurSelling), [data]);
  const weapons = items.filter((entry) => entry.kind === "weapon");
  const armor = items.filter((entry) => entry.kind === "armor");

  return <AuthGate>
    <PageHeader eyebrow="Agent of the Nine" title="Xûr" description="Track Xûr's Tower visit, live Exotic inventory, and transparent roll guidance from one Guardian-specific view." actions={<Freshness observedAt={data?.xur.checkedAt || result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />} />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(data)} onRetry={() => void result.refetch()} />
    {data && <>
      <section className={`${styles.xurHero} ${schedule.active ? styles.xurActive : ""}`}>
        <div className={styles.xurCountdown}><Coins /><span>{schedule.active ? "Xûr departs in" : "Xûr arrives in"}</span><strong>{countdown(schedule.target, now)}</strong><small>{new Date(schedule.target).toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}</small></div>
        <div><MapPin /><span>Current location</span><strong>Tower Bazaar</strong><small>Alley beside the Ramen Shop</small></div>
        <div><Clock3 /><span>Vendor signal</span><strong>{data.xur.state === "available" ? "Inventory live" : data.xur.state === "away" ? "Xûr is away" : "Signal unavailable"}</strong><small>{items.length} Exotic offers matched</small></div>
      </section>

      {items.length > 0 ? <>
        <XurSection title="Exotic weapons" icon={<Swords />} items={weapons} />
        <XurSection title="Exotic armor" icon={<Shield />} items={armor} />
      </> : <section className={styles.xurEmpty}><Sparkles /><h2>{schedule.active ? "Awaiting Xûr's inventory" : "Xûr is away"}</h2><p>{schedule.active ? "Bungie has not returned an enabled Xûr vendor inventory for this Guardian yet. Try another character or refresh after reset." : "Inventory will populate from Bungie's live vendor data when Xûr returns Friday at reset."}</p></section>}

      <section className={styles.xurRollNotice}><Sparkles /><div><span>Roll intelligence</span><h2>Explainable ratings, not invented god rolls</h2><p>Exotic weapons have fixed identities, while armor needs live vendor stat components before it can be graded responsibly. A future curated-wishlist pass will evaluate random Legendary perk combinations for PvE and PvP and show the exact matching perks behind every recommendation.</p></div></section>
    </>}
  </AuthGate>;
}

function XurSection({ title, icon, items }: { title: string; icon: React.ReactNode; items: ExoticCollectionEntry[] }) {
  if (!items.length) return null;
  return <section className={styles.xurSection}><header><div>{icon}<h2>{title}</h2></div><strong>{items.length}</strong></header><div>{items.map((item) => <article key={`${item.itemHash}-${item.className || "weapon"}`} className={styles.xurItem}>
    <div className={styles.xurItemArt}>{item.icon ? <img src={item.icon} alt="" /> : item.kind === "weapon" ? <Swords /> : <Shield />}</div>
    <div><span>{item.slot}</span><h3>{item.name}</h3><p>{item.itemType}</p></div>
    <aside><b>{item.owned ? "Owned" : "Priority pickup"}</b><small>{item.kind === "weapon" ? "Fixed Exotic roll" : "Armor stats pending"}</small></aside>
  </article>)}</div></section>;
}

function countdown(target: string, now: Date): string {
  const seconds = Math.max(0, Math.floor((Date.parse(target) - now.getTime()) / 1_000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;
  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(remainingSeconds).padStart(2, "0")}s`;
}
