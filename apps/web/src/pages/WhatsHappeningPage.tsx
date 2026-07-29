import type { HappeningCard, WhatsHappeningData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock3, ExternalLink, Globe2, RefreshCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, QueryState } from "../components/common/Page";
import { categoryFor } from "../modules/notifications/categoryConfig";
import { api } from "../services/api/client";
import styles from "./WorldState.module.css";

const sectionLabels: Record<HappeningCard["section"], string> = {
  live: "Live now", weekly: "Weekly activities", vendors: "Vendors", daily: "Daily changes",
  news: "News & updates", discoveries: "Discoveries", upcoming: "Upcoming", personal: "For your Guardian"
};

export function WhatsHappeningPage() {
  const result = useQuery({
    queryKey: ["whats-happening"],
    queryFn: () => api<WhatsHappeningData>("/api/v1/whats-happening"),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true
  });
  const [, tick] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => tick((value) => value + 1), 30_000); return () => window.clearInterval(timer); }, []);
  const sections = useMemo(() => {
    const grouped = new Map<HappeningCard["section"], HappeningCard[]>();
    (result.data?.data.cards || []).forEach((card) => grouped.set(card.section, [...(grouped.get(card.section) || []), card]));
    const order: HappeningCard["section"][] = ["live", "personal", "weekly", "vendors", "daily", "discoveries", "news", "upcoming"];
    return order.flatMap((section) => grouped.has(section) ? [[section, grouped.get(section)!] as const] : []);
  }, [result.data?.data.cards]);
  return <>
    <PageHeader
      eyebrow="Guardian Matrix · Current intelligence"
      title="What’s Happening"
      description="The fastest read on live Destiny activity, limited-time opportunities, vendors, resets, discoveries, and changes since your last visit."
      actions={<button className={styles.refresh} onClick={() => void result.refetch()}><RefreshCcw /> Refresh world state</button>}
    />
    <QueryState loading={result.isLoading} error={result.error as Error | null} hasData={Boolean(result.data)} onRetry={() => void result.refetch()} />
    {result.data && <>
      {result.data.warnings.length > 0 && <div className={styles.warning}>{result.data.warnings.join(" ")}</div>}
      <section className={styles.resetStrip} aria-label="Reset schedule">
        <Reset label="Daily reset" value={result.data.data.nextDailyResetAt} />
        <Reset label="Weekly reset" value={result.data.data.nextWeeklyResetAt} />
        <div><Globe2 /><span>World state</span><strong>{result.data.freshness.state}</strong><small>Updated {new Date(result.data.data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div>
      </section>
      <div className={styles.sectionsGrid}>{sections.map(([section, cards]) => <section className={styles.worldSection} key={section}>
          <header><span>{sectionLabels[section]}</span><b>{cards.length}</b></header>
          <div className={styles.cardGrid}>{cards.map((card) => <WorldCard card={card} key={card.id} />)}</div>
        </section>)}</div>
    </>}
  </>;
}

function WorldCard({ card }: { card: HappeningCard }) {
  const config = categoryFor(card.category);
  const Icon = config.icon;
  const content = <article className={styles.worldCard} data-state={card.state} style={{ "--card-color": config.primaryColor, "--card-accent": config.accentColor } as React.CSSProperties}>
    <header><i><Icon /></i><span><small>{config.label}</small><strong>{card.title}</strong></span><b>{card.state.replace("-", " ")}</b></header>
    <div><strong>{looksLikeDate(card.status) ? countdown(card.status) : card.status}</strong>{card.description && <p>{card.description}</p>}</div>
    <footer><span>{confidenceLabel(card.sourceConfidence)} · {card.sourceLabel}</span>{card.observedAt && <time dateTime={card.observedAt}>Updated {new Date(card.observedAt).toLocaleString()}</time>}</footer>
    {(card.destinationUrl || card.externalUrl) && <ArrowRight className={styles.cardArrow} />}
  </article>;
  if (card.destinationUrl) return <Link className={styles.cardLink} to={card.destinationUrl}>{content}</Link>;
  if (card.externalUrl) return <a className={styles.cardLink} href={card.externalUrl} target="_blank" rel="noopener noreferrer">{content}<ExternalLink /></a>;
  return content;
}

function Reset({ label, value }: { label: string; value: string }) {
  return <div><Clock3 /><span>{label}</span><strong>{countdown(value)}</strong><small>{new Date(value).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</small></div>;
}

function countdown(value: string): string {
  const milliseconds = Math.max(0, Date.parse(value) - Date.now());
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor(milliseconds % 3_600_000 / 60_000);
  return hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function looksLikeDate(value: string): boolean { return Number.isFinite(Date.parse(value)) && value.includes("T"); }
function confidenceLabel(value: string): string { return value.replace("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
