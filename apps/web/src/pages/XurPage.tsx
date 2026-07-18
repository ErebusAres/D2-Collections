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
  const storefrontItems = useMemo(() => items.filter(isStorefrontItem), [items]);
  const sections = useMemo(() => [
    { title: "Exotic weapons", icon: <Swords />, items: items.filter((entry) => entry.category === "exotic-weapon") },
    { title: "Exotic catalysts", icon: <Sparkles />, items: items.filter((entry) => entry.category === "exotic-catalyst") },
    { title: "Exotic class items", icon: <Shield />, items: items.filter((entry) => entry.category === "exotic-class-item") },
    ...(["Titan", "Hunter", "Warlock"] as const).map((className) => ({ title: `${className} armor`, icon: <Shield />, items: items.filter((entry) => ["exotic-armor", "legendary-armor"].includes(entry.category) && entry.className === className) })),
    { title: "Other armor", icon: <Shield />, items: items.filter((entry) => ["exotic-armor", "legendary-armor"].includes(entry.category) && !entry.className) },
    { title: "Legendary weapons", icon: <Swords />, items: items.filter((entry) => entry.category === "legendary-weapon") },
    { title: "Strange gear offers", icon: <Coins />, items: items.filter((entry) => entry.category === "other" && /engram/i.test(`${entry.name} ${entry.itemType}`)) }
  ], [items]);

  return <AuthGate>
    <PageHeader eyebrow="Agent of the Nine" title="Xûr" description="Track Xûr's Tower visit and browse his live weapons, catalysts, Exotic class items, and class-specific armor without material clutter." actions={<Freshness observedAt={data?.checkedAt || result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />} />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(data)} onRetry={() => void result.refetch()} />
    {data && <>
      <section className={`${styles.xurHero} ${schedule.active ? styles.xurActive : ""}`}>
        <div className={styles.xurCountdown}><Coins /><span>{schedule.active ? "Xûr departs in" : "Xûr arrives in"}</span><strong>{countdown(schedule.target, now)}</strong><small>{new Date(schedule.target).toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}</small></div>
        <div><MapPin /><span>Current location</span><strong>Tower Bazaar</strong><small>Alley beside the Ramen Shop</small></div>
        <div><Clock3 /><span>Vendor signal</span><strong>{data.state === "available" ? "Inventory live" : data.state === "away" ? "Xûr is away" : "Signal unavailable"}</strong><small>{storefrontItems.length} relevant gear offers</small></div>
      </section>

      {storefrontItems.length > 0 ? sections.map((section) => <XurSection key={section.title} {...section} />) : <section className={styles.xurEmpty}><Sparkles /><h2>{schedule.active ? "Awaiting Xûr's inventory" : "Xûr is away"}</h2><p>{schedule.active ? "Bungie has not returned an enabled Xûr gear inventory for this Guardian yet. Try another character or refresh after reset." : "Inventory will populate from Bungie's live vendor data when Xûr returns Friday at reset."}</p></section>}
    </>}
  </AuthGate>;
}

function XurSection({ title, icon, items }: { title: string; icon: React.ReactNode; items: XurOffer[] }) {
  if (!items.length) return null;
  return <section className={styles.xurSection}><header><div>{icon}<h2>{title}</h2></div><strong>{items.length}</strong></header><div>{items.map((item) => <article key={`${item.saleIndex}-${item.itemHash}`} className={styles.xurItem}>
    <div className={styles.xurItemLead}>
      <div className={styles.xurItemArt}>{item.icon ? <img src={item.icon} alt="" /> : item.category.includes("weapon") ? <Swords /> : <Shield />}</div>
      <div><span>{item.className ? `${item.className} · ` : ""}{item.slot}</span><h3>{item.name}</h3><p>{item.rarity} · {item.itemType}</p></div>
      <aside><b>{item.statTotal !== undefined ? `${item.statTotal} total` : item.className || item.rarity}</b><small>{item.quantity > 1 ? `Quantity ${item.quantity}` : item.perks.length ? `${item.perks.length} live perks` : "Vendor offer"}</small></aside>
    </div>
    {item.stats.length > 0 && <div className={styles.xurStats} aria-label={`${item.name} armor stats`}>{item.stats.map((stat) => <span key={stat.statHash} title={stat.name}>{stat.icon && <img src={stat.icon} alt="" />}<small>{stat.name}</small><b>{stat.value}</b></span>)}</div>}
    {item.perks.length > 0 && <div className={styles.xurPerks} aria-label={`${item.name} vendor roll`}>{item.perks.map((perk) => <span key={perk.itemHash} title={perk.description || perk.name}>{perk.icon && <img src={perk.icon} alt="" />}<b>{perk.name}</b></span>)}</div>}
    {item.costs.length > 0 && <footer className={styles.xurCosts}><span>Cost</span>{item.costs.map((cost) => <b key={cost.itemHash}>{cost.icon && <img src={cost.icon} alt="" />}{cost.quantity.toLocaleString()} {cost.name}</b>)}</footer>}
  </article>)}</div></section>;
}

function isStorefrontItem(item: XurOffer): boolean {
  return item.category !== "other" || /engram/i.test(`${item.name} ${item.itemType}`);
}

function countdown(target: string, now: Date): string {
  const seconds = Math.max(0, Math.floor((Date.parse(target) - now.getTime()) / 1_000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;
  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(remainingSeconds).padStart(2, "0")}s`;
}
