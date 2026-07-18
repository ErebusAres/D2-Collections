import type { XurData, XurOffer } from "@guardian-nexus/contracts";
import { xurSchedule } from "@guardian-nexus/domain";
import { useQuery } from "@tanstack/react-query";
import { Clock3, Coins, MapPin, Shield, Sparkles, Swords } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api/client";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
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
    queryFn: () => api<XurData>(`/api/v1/me/xur?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    refetchInterval: autoRefresh ? 5 * 60_000 : false,
    refetchIntervalInBackground: false
  });
  const data = result.data?.data;
  const items = useMemo(() => data?.offers || [], [data]);
  const sections = useMemo(() => [
    { title: "Exotic weapons", icon: <Swords />, items: items.filter((entry) => entry.category === "exotic-weapon") },
    ...(["Titan", "Hunter", "Warlock"] as const).map((className) => ({ title: `${className} Exotic armor`, icon: <Shield />, items: items.filter((entry) => entry.category === "exotic-armor" && entry.className === className) })),
    { title: "Legendary weapons", icon: <Swords />, items: items.filter((entry) => entry.category === "legendary-weapon") },
    { title: "Legendary armor", icon: <Shield />, items: items.filter((entry) => entry.category === "legendary-armor") },
    { title: "Materials & other offers", icon: <Coins />, items: items.filter((entry) => entry.category === "other") }
  ], [items]);

  return <AuthGate>
    <PageHeader eyebrow="Agent of the Nine" title="Xûr" description="Track Xûr's Tower visit, complete live inventory, class-specific armor, and transparent roll guidance from one Guardian-specific view." actions={<Freshness observedAt={data?.checkedAt || result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />} />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(data)} onRetry={() => void result.refetch()} />
    {data && <>
      <section className={`${styles.xurHero} ${schedule.active ? styles.xurActive : ""}`}>
        <div className={styles.xurCountdown}><Coins /><span>{schedule.active ? "Xûr departs in" : "Xûr arrives in"}</span><strong>{countdown(schedule.target, now)}</strong><small>{new Date(schedule.target).toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}</small></div>
        <div><MapPin /><span>Current location</span><strong>Tower Bazaar</strong><small>Alley beside the Ramen Shop</small></div>
        <div><Clock3 /><span>Vendor signal</span><strong>{data.state === "available" ? "Inventory live" : data.state === "away" ? "Xûr is away" : "Signal unavailable"}</strong><small>{items.length} total offers returned</small></div>
      </section>

      {items.length > 0 ? sections.map((section) => <XurSection key={section.title} {...section} />) : <section className={styles.xurEmpty}><Sparkles /><h2>{schedule.active ? "Awaiting Xûr's inventory" : "Xûr is away"}</h2><p>{schedule.active ? "Bungie has not returned an enabled Xûr vendor inventory for this Guardian yet. Try another character or refresh after reset." : "Inventory will populate from Bungie's live vendor data when Xûr returns Friday at reset."}</p></section>}

      <section className={styles.xurRollNotice}><Sparkles /><div><span>Roll intelligence</span><h2>Explainable ratings, not invented god rolls</h2><p>Exotic weapons have fixed identities, while armor needs live vendor stat components before it can be graded responsibly. A future curated-wishlist pass will evaluate random Legendary perk combinations for PvE and PvP and show the exact matching perks behind every recommendation.</p></div></section>
    </>}
  </AuthGate>;
}

function XurSection({ title, icon, items }: { title: string; icon: React.ReactNode; items: XurOffer[] }) {
  if (!items.length) return null;
  return <section className={styles.xurSection}><header><div>{icon}<h2>{title}</h2></div><strong>{items.length}</strong></header><div>{items.map((item) => <article key={`${item.saleIndex}-${item.itemHash}`} className={styles.xurItem}>
    <div className={styles.xurItemArt}>{item.icon ? <img src={item.icon} alt="" /> : item.category.includes("weapon") ? <Swords /> : <Shield />}</div>
    <div><span>{item.className ? `${item.className} · ` : ""}{item.slot}</span><h3>{item.name}</h3><p>{item.rarity} · {item.itemType}</p></div>
    <aside><b>{item.className || item.rarity}</b><small>{item.quantity > 1 ? `Quantity ${item.quantity}` : item.category.includes("weapon") ? "Vendor weapon roll" : item.category.includes("armor") ? "Vendor armor roll" : "Vendor offer"}</small></aside>
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
