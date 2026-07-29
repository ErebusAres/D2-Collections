import type { HappeningCard, JourneyProgressData, QuestData, WhatsHappeningData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock3, ExternalLink, Globe2, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, QueryState } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import { bountyCadence, questPercent } from "../modules/journey/progressSummary";
import { categoryFor } from "../modules/notifications/categoryConfig";
import { formatUtcAndLocalTime } from "../modules/time";
import { api } from "../services/api/client";
import styles from "./WorldState.module.css";

const sectionLabels: Record<HappeningCard["section"], string> = {
  live: "Live now",
  weekly: "Weekly activities",
  vendors: "Vendors",
  daily: "Daily changes",
  news: "News & updates",
  discoveries: "Discoveries",
  upcoming: "Upcoming",
  personal: "For your Guardian"
};
const sectionOrder: HappeningCard["section"][] = [
  "live", "personal", "weekly", "vendors", "daily", "discoveries", "news", "upcoming"
];

export function WhatsHappeningPage() {
  const { session, selectedCharacterId } = useGuardian();
  const accountEnabled = Boolean(session?.authenticated && selectedCharacterId);
  const result = useQuery({
    queryKey: ["whats-happening"],
    queryFn: () => api<WhatsHappeningData>("/api/v1/whats-happening"),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true
  });
  const journey = useQuery({
    queryKey: ["journey-progress", selectedCharacterId],
    queryFn: () => api<JourneyProgressData>(`/api/v1/me/journey?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: accountEnabled,
    staleTime: 60_000
  });
  const pursuits = useQuery({
    queryKey: ["quests", selectedCharacterId, ""],
    queryFn: () => api<QuestData>(`/api/v1/me/quests?characterId=${encodeURIComponent(selectedCharacterId)}&pinned=`),
    enabled: accountEnabled,
    staleTime: 60_000
  });
  const [now, setNow] = useState(() => Date.now());
  const [activeSection, setActiveSection] = useState<HappeningCard["section"] | "all">("all");
  const nextDailyResetAt = result.data?.data.nextDailyResetAt;
  const dashboardCards = useMemo(() => {
    const publicCards = result.data?.data.cards || [];
    const accountCards = accountActivityCards(journey.data?.data, pursuits.data?.data, result.data?.data.generatedAt)
      .filter((accountCard) => !publicCards.some((card) => card.category === accountCard.category && card.title === accountCard.title));
    return [...publicCards, ...accountCards];
  }, [journey.data?.data, pursuits.data?.data, result.data?.data]);

  useEffect(() => {
    const remaining = nextDailyResetAt ? Date.parse(nextDailyResetAt) - now : Number.POSITIVE_INFINITY;
    const delay = remaining <= 60 * 60_000
      ? 1_000
      : Math.min(30_000, Math.max(1_000, remaining - 60 * 60_000));
    const timer = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [nextDailyResetAt, now]);

  useEffect(() => {
    if (!nextDailyResetAt) return;
    const delay = Math.max(0, Date.parse(nextDailyResetAt) - Date.now()) + 1_000;
    const timer = window.setTimeout(() => void result.refetch(), delay);
    return () => window.clearTimeout(timer);
  }, [nextDailyResetAt, result.refetch]);

  const availableSections = useMemo(
    () => sectionOrder.filter((section) => dashboardCards.some((card) => card.section === section)),
    [dashboardCards]
  );
  const sections = useMemo(() => {
    const grouped = new Map<HappeningCard["section"], HappeningCard[]>();
    dashboardCards.forEach((card) => grouped.set(card.section, [...(grouped.get(card.section) || []), card]));
    return sectionOrder.flatMap((section) => grouped.has(section) && (activeSection === "all" || activeSection === section)
      ? [[section, grouped.get(section)!] as const]
      : []);
  }, [activeSection, dashboardCards]);

  return <>
    <PageHeader
      eyebrow="Guardian Matrix · Current intelligence"
      title="What’s Happening"
      description="The fastest read on live Destiny activity, limited-time opportunities, vendors, resets, discoveries, and changes since your last visit."
      actions={<div className={styles.dashboardActions}>
        <Link to="/activities/raids"><ArrowRight /> Raid rotations</Link>
        <button className={styles.refresh} onClick={() => void result.refetch()}><RefreshCcw /> Refresh world state</button>
      </div>}
    />
    <QueryState loading={result.isLoading} error={result.error as Error | null} hasData={Boolean(result.data)} onRetry={() => void result.refetch()} />
    {result.data && <>
      {result.data.warnings.length > 0 && <div className={styles.warning}>{result.data.warnings.join(" ")}</div>}
      <section className={styles.resetStrip} aria-label="Reset schedule">
        <Reset label="Daily reset" value={result.data.data.nextDailyResetAt} now={now} />
        <Reset label="Weekly reset" value={result.data.data.nextWeeklyResetAt} now={now} />
        <div>
          <Globe2 />
          <span>World state</span>
          <strong>{result.data.freshness.state}</strong>
          <small>Updated {new Date(result.data.data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
        </div>
      </section>
      {dashboardCards.length > 6 && <nav className={styles.sectionFilters} aria-label="Filter current Destiny information">
          <button className={activeSection === "all" ? styles.selectedFilter : undefined} onClick={() => setActiveSection("all")}>
            All <b>{dashboardCards.length}</b>
          </button>
          {availableSections.map((section) => <button
            className={activeSection === section ? styles.selectedFilter : undefined}
            key={section}
            onClick={() => setActiveSection(section)}
          >
            {sectionLabels[section]} <b>{dashboardCards.filter((card) => card.section === section).length}</b>
          </button>)}
        </nav>}
      <div className={styles.sectionsGrid}>
        {sections.map(([section, cards]) => <section className={styles.worldSection} key={section}>
          <header><span>{sectionLabels[section]}</span><b>{cards.length}</b></header>
          <div className={styles.cardGrid}>{cards.map((card) => <WorldCard card={card} compact now={now} key={card.id} />)}</div>
        </section>)}
      </div>
    </>}
  </>;
}

export function WorldCard({ card, compact = false, now }: { card: HappeningCard; compact?: boolean; now: number }) {
  const config = categoryFor(card.category);
  const Icon = config.icon;
  const content = <article
    className={`${styles.worldCard} ${compact ? styles.compactWorldCard : ""}`}
    data-state={card.state}
    style={{ "--card-color": config.primaryColor, "--card-accent": config.accentColor } as React.CSSProperties}
  >
    <header>
      <i>{card.icon ? <img src={card.icon} alt="" /> : <Icon />}</i>
      <span><small>{config.label}</small><strong>{card.title}</strong></span>
      <b>{card.state.replace("-", " ")}</b>
    </header>
    <div>
      <strong>{cardStatus(card, now)}</strong>
      {card.description && <p>{card.description}</p>}
      {card.imageUrl && !compact && <img className={styles.cardThumbnail} src={card.imageUrl} alt="" loading="lazy" />}
    </div>
    <footer>
      <span>{confidenceLabel(card.sourceConfidence)} · {card.sourceLabel}</span>
      {card.observedAt && <time dateTime={card.observedAt}>Updated {formatObservedAt(card.observedAt, now)}</time>}
    </footer>
    {(card.destinationUrl || card.externalUrl) && <ArrowRight className={styles.cardArrow} />}
  </article>;
  if (card.destinationUrl) return <Link className={styles.cardLink} to={card.destinationUrl}>{content}</Link>;
  if (card.externalUrl) return <a className={styles.cardLink} href={card.externalUrl} target="_blank" rel="noopener noreferrer">{content}<ExternalLink /></a>;
  return content;
}

function accountActivityCards(journey?: JourneyProgressData, quests?: QuestData, observedAt?: string): HappeningCard[] {
  const cards: HappeningCard[] = [];
  const hubObjectives = journey?.weeklyChallenges || [];
  const hubOrders = (quests?.quests || []).filter((quest) => quest.category === "order");
  const currentActivities = journey?.currentActivities || [];
  const ironBanner = currentActivities.find((activity) => /iron banner/i.test(`${activity.name} ${activity.description}`));
  const opsActivities = currentActivities.filter((activity) => /\b(ops|vanguard|nightfall|strike|crucible|gambit|alert|conquest)\b/i.test(`${activity.name} ${activity.description}`));
  const opsChallenges = hubObjectives.filter((challenge) => /\b(ops|vanguard|nightfall|strike|crucible|gambit|alert|conquest)\b/i.test(`${challenge.name} ${challenge.description}`));
  if (ironBanner) {
    cards.push({
      id: "account:iron-banner",
      section: "live",
      category: "iron-banner",
      priority: "high",
      state: "live",
      title: "Iron Banner",
      status: ironBanner.name,
      description: ironBanner.description || "Iron Banner is available for your selected Guardian this week.",
      icon: ironBanner.icon,
      destinationUrl: "/pvp",
      sourceLabel: "Bungie character activities",
      sourceConfidence: "live-api",
      observedAt
    });
  }
  if (hubObjectives.length || hubOrders.length) {
    const complete = hubObjectives.filter((challenge) => challenge.objective.complete).length;
    cards.push({
      id: "account:seasonal-hub",
      section: "weekly",
      category: "seasonal",
      priority: "normal",
      state: "live",
      title: "Seasonal Hub",
      status: hubObjectives.length
        ? `${complete}/${hubObjectives.length} current objectives complete`
        : `${hubOrders.length} active Hub orders`,
      description: "Your selected Guardian’s live Hub challenges, orders, and reward-track progress.",
      destinationUrl: "/journey/season",
      sourceLabel: "Bungie character activities",
      sourceConfidence: "live-api",
      observedAt
    });
  }
  if (opsActivities.length || opsChallenges.length) {
    cards.push({
      id: "account:ops",
      section: "weekly",
      category: "vanguard",
      priority: "normal",
      state: "live",
      title: "Ops objectives",
      status: opsChallenges.length
        ? `${opsChallenges.filter((challenge) => challenge.objective.complete).length}/${opsChallenges.length} objectives complete`
        : `${opsActivities.length} current activities`,
      description: summarizeActivityNames([
        ...opsActivities.map((activity) => activity.name),
        ...opsChallenges.map((challenge) => challenge.name)
      ]),
      destinationUrl: "/journey/season",
      sourceLabel: "Bungie character activities",
      sourceConfidence: "live-api",
      observedAt
    });
  }
  const daily = (quests?.quests || []).filter((quest) =>
    quest.category === "order" || (quest.category === "bounty" && bountyCadence(quest) === "daily"));
  if (daily.length) {
    cards.push({
      id: "account:daily-orders",
      section: "daily",
      category: "seasonal",
      priority: "normal",
      state: "live",
      title: "Daily & Hub orders",
      status: `${daily.length} active · ${questPercent(daily)}% average progress`,
      description: summarizeActivityNames(daily.map((quest) => quest.name)),
      destinationUrl: "/journey/bounties",
      sourceLabel: "Bungie character pursuits",
      sourceConfidence: "live-api",
      observedAt: daily.map((quest) => quest.updatedAt).sort().at(-1) || observedAt
    });
  }
  return cards;
}

function summarizeActivityNames(names: string[]): string {
  const unique = names.filter((name, index) => names.indexOf(name) === index);
  const visible = unique.slice(0, 4);
  return `${visible.join(", ")}${unique.length > visible.length ? `, and ${unique.length - visible.length} more` : ""}.`;
}

function Reset({ label, value, now }: { label: string; value: string; now: number }) {
  return <div><Clock3 /><span>{label} in</span><strong>{formatResetCountdown(value, now)}</strong><small>{formatUtcAndLocalTime(value)}</small></div>;
}

export function formatResetCountdown(value: string, now = Date.now()): string {
  const milliseconds = Math.max(0, Date.parse(value) - now);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor(milliseconds % 3_600_000 / 60_000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours >= 1) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  const seconds = Math.floor(milliseconds % 60_000 / 1_000);
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function cardStatus(card: HappeningCard, now: number): string {
  if (!looksLikeDate(card.status)) return card.status;
  const action = card.id.endsWith("-reset") ? "Resets" : card.state === "upcoming" ? "Starts" : "Ends";
  return `${action} in ${formatResetCountdown(card.status, now)}`;
}

function looksLikeDate(value: string): boolean {
  return Number.isFinite(Date.parse(value)) && value.includes("T");
}

function confidenceLabel(value: string): string {
  return value.replace("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatObservedAt(value: string, now: number): string {
  const milliseconds = now - Date.parse(value);
  if (milliseconds < 60_000) return "just now";
  if (milliseconds < 60 * 60_000) return `${Math.floor(milliseconds / 60_000)}m ago`;
  if (milliseconds < 24 * 60 * 60_000) return `${Math.floor(milliseconds / 3_600_000)}h ago`;
  return new Date(value).toLocaleDateString();
}
