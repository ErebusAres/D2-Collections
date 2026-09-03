import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { GuardianNotificationsController } from "../../modules/notifications/useGuardianNotifications";
import type { GuardianNotification, NotificationPreferences } from "@guardian-nexus/contracts";
import { categoryFor } from "../../modules/notifications/categoryConfig";
import { playCompletionChime } from "../../services/completionAudio";
import guardianFanfareUrl from "../../styles/guardian-fanfare.css?url";
import { ensureStylesheet } from "../../styles/loadStylesheet";
import styles from "../../styles/notifications/GuardianFeed.module.css";

const SHOWN_NOTIFICATIONS_KEY = "guardian-nexus:notifications:shown";
const REPLAY_NOTIFICATION_EVENT = "guardian-nexus:notification-replay";

export function GuardianFeed({ controller }: { controller: GuardianNotificationsController }) {
  useEffect(() => {
    ensureStylesheet("notification-fanfare", guardianFanfareUrl);
  }, []);
  const { feed, preferences } = controller;
  const [shown, setShown] = useState<Set<string>>(readShownNotifications);
  const eligibleFeed = useMemo(() => feed.filter((entry) => !entry.autoDismiss || !shown.has(notificationVersion(entry))), [feed, shown]);
  const [activeId, setActiveId] = useState<string>();
  const [paused, setPaused] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [scrollDistance, setScrollDistance] = useState(0);
  const textRef = useRef<HTMLSpanElement>(null);
  const playedFanfare = useRef(new Set<string>());
  const previousVersions = useRef<Set<string>>(new Set());
  const activeIndex = Math.max(0, eligibleFeed.findIndex((entry) => entry.id === activeId));
  const notification = eligibleFeed[activeIndex];
  const notificationId = notification?.id;
  const rotationDuration = notification ? notificationDisplayDuration(notification, preferences) : 0;
  const canRotate = shouldRotateFeed(notification, paused, eligibleFeed.length);
  useEffect(() => {
    const replay = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; version: string }>).detail;
      if (!detail?.version) return;
      setShown((current) => {
        const updated = new Set(current);
        updated.delete(detail.version);
        writeShownNotifications(updated);
        return updated;
      });
      setActiveId(detail.id);
    };
    window.addEventListener(REPLAY_NOTIFICATION_EVENT, replay);
    return () => window.removeEventListener(REPLAY_NOTIFICATION_EVENT, replay);
  }, []);

  useEffect(() => {
    if (!eligibleFeed.length) {
      if (activeId) setActiveId(undefined);
      previousVersions.current = new Set();
      return;
    }
    const current = eligibleFeed.find((entry) => entry.id === activeId);
    const newEntry = eligibleFeed.find((entry) => !previousVersions.current.has(notificationVersion(entry)));
    if (!current) setActiveId(eligibleFeed[0]!.id);
    else if (newEntry && priorityValue(newEntry.priority) < priorityValue(current.priority)) setActiveId(newEntry.id);
    previousVersions.current = new Set(eligibleFeed.map(notificationVersion));
  }, [activeId, eligibleFeed]);
  useEffect(() => {
    const update = () => {
      const distance = textRef.current ? Math.max(0, textRef.current.scrollWidth - textRef.current.clientWidth) : 0;
      setScrollDistance(distance);
      setOverflows(distance > 4);
    };
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const observer = new ResizeObserver(update);
    if (textRef.current) observer.observe(textRef.current);
    return () => observer.disconnect();
  }, [notification?.id]);
  useEffect(() => {
    if (!canRotate) return;
    const timer = window.setTimeout(() => {
      const next = eligibleFeed[(activeIndex + 1) % eligibleFeed.length];
      if (notification.autoDismiss) {
        const version = notificationVersion(notification);
        setShown((current) => {
          const updated = new Set(current).add(version);
          writeShownNotifications(updated);
          return updated;
        });
      }
      setActiveId(next?.id === notification.id && notification.autoDismiss ? undefined : next?.id);
    }, rotationDuration);
    return () => window.clearTimeout(timer);
  }, [activeIndex, canRotate, eligibleFeed, notification, notificationId, rotationDuration]);
  useEffect(() => {
    if (!notification || !isRankUpNotification(notification) || !preferences.sound) return;
    const version = notificationVersion(notification);
    if (playedFanfare.current.has(version)) return;
    playedFanfare.current.add(version);
    playCompletionChime();
  }, [notification, notificationId, preferences.sound]);
  if (!preferences.bannerVisible || !notification) return null;
  const config = categoryFor(notification.category);
  const Icon = config.icon;
  const animation = notificationAnimation(notification, config.animation);
  const destination = notification.destinationUrl || notification.externalUrl;
  const style = {
    "--notification-primary": config.primaryColor,
    "--notification-accent": config.accentColor,
    "--notification-border": config.borderColor,
    "--notification-background": config.backgroundGradient
  } as CSSProperties;
  const content = <>
    <span className={`${styles.icon} gn-fanfare-icon`}><Icon aria-hidden="true" /></span>
    <span className={styles.label}>{config.label}</span>
    <span className={`${styles.copy} gn-fanfare-copy ${overflows ? styles.scrollable : ""}`} ref={textRef} style={{ "--scroll-distance": `${scrollDistance}px` } as CSSProperties}>
      <span><strong>{notification.title}</strong>{notification.subtitle && <small>{notification.subtitle}</small>}</span>
    </span>
    <time dateTime={notification.updatedAt || notification.createdAt}>{relativeTime(notification.updatedAt || notification.createdAt)}</time>
    {notification.badge && <b className={styles.badge}>{notification.badge}</b>}
    {notification.externalUrl && !notification.destinationUrl && <ExternalLink className={styles.external} aria-label="External link" />}
  </>;
  return (
      <section
        key={notificationVersion(notification)}
        className={`${styles.feed} ${styles[notification.priority]} ${isRankUpNotification(notification) ? "gn-rank-fanfare" : ""}`}
        data-guardian-animation={animation}
        style={style}
        aria-live={notification.priority === "critical" ? "assertive" : "polite"}
        aria-label={`${config.label}: ${notification.title}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        {destination
          ? notification.destinationUrl
            ? <Link to={notification.destinationUrl} onClick={() => controller.markRead(notification)}>{content}</Link>
            : <a href={notification.externalUrl} target="_blank" rel="noopener noreferrer" onClick={() => controller.markRead(notification)}>{content}</a>
          : <div>{content}</div>}
        <span className={styles.position} aria-hidden="true">{activeIndex + 1}/{eligibleFeed.length}</span>
        {notification.dismissible && <button type="button" onClick={() => { controller.dismiss(notification); setActiveId(eligibleFeed[(activeIndex + 1) % eligibleFeed.length]?.id); }} aria-label={`Dismiss ${notification.title}`}><X /></button>}
      </section>
  );
}

export function shouldRotateFeed(
  notification: GuardianNotification | undefined,
  paused: boolean,
  feedLength: number
): notification is GuardianNotification {
  return notification !== undefined && !paused && (notification.autoDismiss || feedLength > 1);
}

export function notificationDisplayDuration(notification: GuardianNotification, preferences: NotificationPreferences): number {
  if (notification.autoDismissMs) return notification.autoDismissMs;
  const base = preferences.autoDismissMs || categoryFor(notification.category).defaultAutoDismissMs;
  if (notification.priority === "critical") return Math.round(base * 1.5);
  if (notification.priority === "high") return Math.round(base * 1.25);
  return base;
}

export function relativeTime(value: string): string {
  const seconds = Math.round((Date.parse(value) - Date.now()) / 1_000);
  const absolute = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (absolute < 60) return formatter.format(seconds, "second");
  if (absolute < 3_600) return formatter.format(Math.round(seconds / 60), "minute");
  if (absolute < 86_400) return formatter.format(Math.round(seconds / 3_600), "hour");
  return formatter.format(Math.round(seconds / 86_400), "day");
}

export function notificationVersion(notification: GuardianNotification): string {
  return `${notification.id}:${notification.updatedAt || notification.createdAt}`;
}

export function replayNotificationInBanner(notification: GuardianNotification): void {
  const version = notificationVersion(notification);
  const shown = readShownNotifications();
  shown.delete(version);
  writeShownNotifications(shown);
  window.dispatchEvent(new CustomEvent(REPLAY_NOTIFICATION_EVENT, { detail: { id: notification.id, version } }));
}

export function isRankUpNotification(notification: GuardianNotification): boolean {
  return notification.type === "guardian-rank-up"
    || notification.type === "rewards-pass-up"
    || notification.metadata?.fanfare === "rank-up";
}

export function notificationAnimation(notification: GuardianNotification, categoryAnimation?: string): string | undefined {
  if (notification.type === "xur-arrived" || notification.metadata?.fanfare === "xur-arrival") return "xurArrival";
  if (notification.type === "xur-departed" || notification.metadata?.fanfare === "xur-departure") return "xurDeparture";
  if (notification.type === "guardian-rank-up") return "guardianRank";
  if (notification.type === "rewards-pass-up") return "rewardsRank";
  if (notification.metadata?.fanfare === "rank-up") return "guardianRank";
  return categoryAnimation;
}

function readShownNotifications(): Set<string> {
  if (typeof sessionStorage === "undefined") return new Set();
  try {
    const value = JSON.parse(sessionStorage.getItem(SHOWN_NOTIFICATIONS_KEY) || "[]");
    return new Set(Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string").slice(-200) : []);
  } catch {
    return new Set();
  }
}

function writeShownNotifications(value: Set<string>): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(SHOWN_NOTIFICATIONS_KEY, JSON.stringify([...value].slice(-200)));
}

function priorityValue(priority: GuardianNotification["priority"]): number {
  return { critical: 0, high: 1, normal: 2, low: 3 }[priority];
}
