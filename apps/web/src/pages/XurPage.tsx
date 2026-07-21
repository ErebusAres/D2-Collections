import type { XurData, XurOffer } from "@guardian-nexus/contracts";
import { xurSchedule } from "@guardian-nexus/domain";
import { useQuery } from "@tanstack/react-query";
import { Clock3, Coins, MapPin, Shield, Sparkles, Swords } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import { api } from "../services/api/client";
import styles from "./Pages.module.css";

type StoreSection = {
  title: string;
  icon: React.ReactNode;
  items: XurOffer[];
};

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
  const sections = useMemo(() => storefrontSections(items), [items]);
  const storefrontCount = sections.reduce((total, section) => total + section.items.length, 0);
  const presentation = data ? xurInventoryPresentation(data, schedule.active) : undefined;

  return <AuthGate>
    <PageHeader eyebrow="Agent of the Nine" title="Xûr" description="A complete storefront: Exotic armor and class items, weapons, catalysts, the weekly quest, and Strange Gear—without materials clutter." actions={<Freshness observedAt={data?.inventoryCapturedAt || data?.checkedAt || result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />} />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(data)} onRetry={() => void result.refetch()} />
    {data && presentation && <>
      <section className={`${styles.xurHero} ${schedule.active && !presentation.lastShipment ? styles.xurActive : ""}`}>
        <div className={styles.xurCountdown}><Coins /><span>{schedule.active ? "Xûr departs in" : "Xûr arrives in"}</span><strong>{countdown(schedule.target, now)}</strong><small>{new Date(schedule.target).toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}</small></div>
        <div><MapPin /><span>{presentation.locationLabel}</span><strong>Tower Bazaar</strong><small>Alley beside the Ramen Shop</small></div>
        <div><Clock3 /><span>Vendor signal</span><strong>{presentation.signalLabel}</strong><small>{storefrontCount} storefront offers{presentation.lastShipment && data.inventoryCapturedAt ? ` · verified ${new Date(data.inventoryCapturedAt).toLocaleString()}` : " across your classes"}</small></div>
      </section>

      {presentation.lastShipment && <section className={styles.xurShipmentNotice}><Clock3 /><div><strong>Last verified shipment</strong><p>{schedule.active ? "Bungie's current vendor signal is unavailable, so these are the most recent verified offers. They may not match the live storefront." : "Xûr has departed. These offers are preserved from his most recent verified visit and are no longer available to purchase."}</p></div></section>}
      {storefrontCount > 0
        ? sections.map((section) => <XurSection key={section.title} {...section} historical={presentation.lastShipment} />)
        : <section className={styles.xurEmpty}><Sparkles /><h2>{schedule.active ? "Awaiting Xûr's inventory" : "Xûr is away"}</h2><p>{schedule.active ? "Bungie has not returned an enabled Xûr gear inventory for this account yet. Refresh after reset to check again." : "Inventory will populate from Bungie's live vendor data when Xûr returns Friday at reset."}</p></section>}
    </>}
  </AuthGate>;
}

export function storefrontSections(items: XurOffer[]): StoreSection[] {
  const exoticQuests = items.filter(isExoticQuest);
  return [
    { title: "Exotic armor", icon: <Shield />, items: sortOffers(items.filter((item) => item.category === "exotic-armor")) },
    { title: "Exotic class items", icon: <Shield />, items: sortOffers(items.filter((item) => item.category === "exotic-class-item")) },
    { title: "Exotic weapons", icon: <Swords />, items: sortOffers([...items.filter((item) => item.category === "exotic-weapon"), ...exoticQuests]) },
    { title: "Exotic catalysts", icon: <Sparkles />, items: sortOffers(items.filter((item) => item.category === "exotic-catalyst")) },
    { title: "Strange Gear offers", icon: <Coins />, items: sortOffers(items.filter((item) => item.category === "legendary-weapon" || item.category === "legendary-armor")) }
  ].filter((section) => section.items.length > 0);
}

function XurSection({ title, icon, items, historical = false }: StoreSection & { historical?: boolean }) {
  return <section className={styles.xurSection}>
    <header><div>{icon}<h2>{title}</h2></div><strong>{items.length} {items.length === 1 ? "offer" : "offers"}</strong></header>
    <div className={styles.xurStoreGrid}>{items.map((item) => <XurCard key={`${item.saleIndex}-${item.itemHash}-${item.className || "any"}`} item={item} historical={historical} />)}</div>
  </section>;
}

function XurCard({ item, historical }: { item: XurOffer; historical: boolean }) {
  const quest = isExoticQuest(item);
  const detailLabel = quest ? "Weekly quest" : item.slot && item.slot !== "Miscellaneous" ? item.slot : item.itemType;
  return <article className={styles.xurCard} data-rarity={item.rarity.toLowerCase()} data-class={item.className?.toLowerCase()}>
    <div className={styles.xurCardArt}>{item.icon ? <img src={item.icon} alt="" /> : item.category.includes("weapon") ? <Swords /> : <Shield />}</div>
    <div className={styles.xurCardBody}>
      <span>{detailLabel}</span>
      <h3>{item.name}</h3>
      <div className={styles.xurCardBadges}>
        {item.className && <b>{item.className}</b>}
        {quest && <b>Exotic quest</b>}
        {item.statTotal !== undefined && <b>{item.statTotal} total</b>}
      </div>
      {item.perks.length > 0 && <div className={styles.xurCardPerks} aria-label={`${item.name} ${historical ? "last shipment" : "live"} roll`}>{item.perks.slice(0, 5).map((perk) => <img key={perk.itemHash} src={perk.icon} alt={perk.name} title={`${perk.name}${perk.description ? ` — ${perk.description}` : ""}`} />)}</div>}
      {item.stats.length > 0 && <div className={styles.xurCardStats} aria-label={`${item.name} armor stats`}>{item.stats.map((stat) => <span key={stat.statHash} title={stat.name}>{stat.icon && <img src={stat.icon} alt="" />}<b>{stat.value}</b></span>)}</div>}
    </div>
    {item.costs.length > 0 && <footer>{item.costs.map((cost) => <span key={cost.itemHash}>{cost.icon && <img src={cost.icon} alt="" />}{cost.quantity.toLocaleString()} {cost.name}</span>)}</footer>}
  </article>;
}

export function xurInventoryPresentation(data: Pick<XurData, "state" | "inventoryStatus" | "offers">, scheduleActive: boolean) {
  const lastShipment = data.inventoryStatus === "last-shipment" || (data.state !== "available" && data.offers.length > 0);
  return {
    lastShipment,
    locationLabel: lastShipment ? "Last known location" : "Current location",
    signalLabel: lastShipment ? "Last shipment" : data.state === "available" ? "Inventory live" : data.state === "away" ? "Xûr is away" : scheduleActive ? "Signal unavailable" : "Xûr is away"
  };
}

function isExoticQuest(item: XurOffer): boolean {
  return item.category === "other" && item.rarity.toLowerCase() === "exotic" && (/quest/i.test(item.itemType) || /xenology/i.test(item.name));
}

function sortOffers(items: XurOffer[]): XurOffer[] {
  const classOrder = { Titan: 0, Hunter: 1, Warlock: 2, Unknown: 3 } as const;
  return [...items].sort((left, right) => {
    const classDifference = (left.className ? classOrder[left.className] : 3) - (right.className ? classOrder[right.className] : 3);
    return classDifference || left.name.localeCompare(right.name);
  });
}

function countdown(target: string, now: Date): string {
  const seconds = Math.max(0, Math.floor((Date.parse(target) - now.getTime()) / 1_000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;
  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(remainingSeconds).padStart(2, "0")}s`;
}
