import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { GuardianNotificationsController } from "../../modules/notifications/useGuardianNotifications";
import type { GuardianNotification, NotificationPreferences } from "@guardian-nexus/contracts";
import { categoryFor } from "../../modules/notifications/categoryConfig";
import { playCompletionChime } from "../../services/completionAudio";
import styles from "./GuardianFeed.module.css";

const GUARDIAN_FANFARE_CSS = String.raw`
[data-notification-atmosphere]{position:absolute;z-index:0;top:38px;right:0;left:0;height:130px;overflow:hidden;pointer-events:none;opacity:.66;mask-image:linear-gradient(#000 0 58%,transparent);animation:gn-sky-in 1.4s ease-out both}
[data-notification-atmosphere]::before{content:"";position:absolute;inset:-45% -8%;background:radial-gradient(ellipse at 15% 0,color-mix(in srgb,var(--notification-primary) 45%,transparent),transparent 42%);animation:gn-breathe 4.6s 1.3s ease-in-out infinite alternate}
[data-notification-atmosphere="distortion"]{background:repeating-conic-gradient(from 198deg at 12% -10%,transparent 0 7deg,rgba(232,64,91,.25) 8deg 9deg,transparent 10deg 18deg),radial-gradient(ellipse at 12% 0,rgba(154,24,54,.6),transparent 46%);animation:gn-infect 1.7s ease-out both,gn-drift 5s 1.7s ease-in-out infinite alternate}
[data-notification-atmosphere="ironBanner"]{transform-origin:top;background:repeating-linear-gradient(102deg,transparent 0 11%,rgba(190,139,63,.14) 12%,transparent 13% 22%),linear-gradient(90deg,transparent 5%,rgba(40,102,57,.28) 7% 45%,transparent 48%);animation:gn-standard 1.55s cubic-bezier(.12,.76,.16,1) both,gn-cloth 4s 1.55s ease-in-out infinite alternate}
[data-notification-atmosphere="trials"],[data-notification-atmosphere="exotic"],[data-notification-atmosphere="legendary"],[data-notification-atmosphere="completion"]{background:repeating-conic-gradient(from 0deg at 25% -80%,color-mix(in srgb,var(--notification-accent) 18%,transparent) 0 3deg,transparent 4deg 13deg);animation:gn-rays 1.6s ease-out both}
[data-notification-atmosphere="gambit"],[data-notification-atmosphere="seasonal"],[data-notification-atmosphere="system"]{background:radial-gradient(circle at 22% 0,transparent 0 34px,color-mix(in srgb,var(--notification-accent) 22%,transparent) 35px 36px,transparent 37px 68px);animation:gn-orbit 7s linear infinite}
[data-notification-atmosphere="warning"],[data-notification-atmosphere="outage"]{background:repeating-linear-gradient(120deg,transparent 0 32px,color-mix(in srgb,var(--notification-primary) 18%,transparent) 33px 37px,transparent 38px 68px);animation:gn-hazard 3.8s linear infinite}
.gn-rank-fanfare{box-shadow:inset 4px 0 0 #f2d887,0 0 22px rgba(242,216,135,.24)!important;animation:gn-rank .95s cubic-bezier(.16,.75,.2,1) both!important}.gn-rank-atmosphere{background:repeating-conic-gradient(from 0deg at 50% -90%,rgba(255,226,139,.17) 0 2deg,transparent 3deg 11deg)!important;animation:gn-rays 1.6s ease-out both!important}
@keyframes gn-sky-in{from{opacity:0;transform:translateY(-35px);filter:blur(6px)}}@keyframes gn-breathe{from{filter:brightness(.65);transform:translateX(-3%)}to{filter:brightness(1.15);transform:translateX(4%)}}@keyframes gn-infect{from{opacity:0;clip-path:polygon(0 0,0 0,0 100%,0 100%);filter:blur(8px)}to{clip-path:polygon(0 0,100% 0,76% 100%,0 74%)}}@keyframes gn-drift{to{transform:translateX(6%) scaleX(1.12);filter:saturate(1.4)}}@keyframes gn-standard{from{opacity:0;transform:scaleY(.03) skewX(-5deg)}to{transform:scaleY(1);clip-path:polygon(0 0,100% 0,94% 100%,4% 86%)}}@keyframes gn-cloth{from{transform:skewX(-1deg);filter:brightness(.7)}to{transform:skewX(1deg);filter:brightness(1.15)}}@keyframes gn-rays{from{opacity:0;transform:scaleX(.1);filter:brightness(2)}55%{opacity:.95}to{opacity:.42;transform:scaleX(1)}}@keyframes gn-orbit{to{transform:rotate(3deg) scale(1.04)}}@keyframes gn-hazard{to{background-position:137px 0}}@keyframes gn-rank{from{opacity:0;filter:brightness(2);clip-path:inset(0 50%)}65%{clip-path:inset(0)}to{filter:none}}
@media(prefers-reduced-motion:reduce){[data-notification-atmosphere], [data-notification-atmosphere]::before,.gn-rank-fanfare{animation:none}}[data-notification-reduced-motion=true] [data-notification-atmosphere],[data-notification-reduced-motion=true] [data-notification-atmosphere]::before,[data-notification-reduced-motion=true] .gn-rank-fanfare{animation:none}
`;
const SHOWN_NOTIFICATIONS_KEY = "guardian-nexus:notifications:shown";

export function GuardianFeed({ controller }: { controller: GuardianNotificationsController }) {
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
    <>
      <div
        key={`${notification.id}:atmosphere`}
        className={isRankUpNotification(notification) ? "gn-rank-atmosphere" : undefined}
        style={style}
        data-notification-atmosphere={config.animation || "system"}
        aria-hidden="true"
      />
      <section
        key={notification.id}
        className={`${styles.feed} ${styles[notification.priority]} ${config.animation ? styles[config.animation] : ""} ${isRankUpNotification(notification) ? "gn-rank-fanfare" : ""}`}
        data-guardian-animation={config.animation}
        style={style}
        aria-live={notification.priority === "critical" ? "assertive" : "polite"}
        aria-label={`${config.label}: ${notification.title}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <style>{GUARDIAN_FANFARE_CSS}</style>
        {destination
          ? notification.destinationUrl
            ? <Link to={notification.destinationUrl} onClick={() => controller.markRead(notification)}>{content}</Link>
            : <a href={notification.externalUrl} target="_blank" rel="noopener noreferrer" onClick={() => controller.markRead(notification)}>{content}</a>
          : <div>{content}</div>}
        <span className={styles.position} aria-hidden="true">{activeIndex + 1}/{eligibleFeed.length}</span>
        {notification.dismissible && <button type="button" onClick={() => { controller.dismiss(notification); setActiveId(eligibleFeed[(activeIndex + 1) % eligibleFeed.length]?.id); }} aria-label={`Dismiss ${notification.title}`}><X /></button>}
      </section>
    </>
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

export function isRankUpNotification(notification: GuardianNotification): boolean {
  return notification.type === "guardian-rank-up"
    || notification.type === "rewards-pass-up"
    || notification.metadata?.fanfare === "rank-up";
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
