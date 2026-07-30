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
[data-notification-atmosphere]{position:absolute;z-index:0;top:38px;right:0;left:0;height:130px;overflow:hidden;pointer-events:none;opacity:.7;mask-image:linear-gradient(#000 0 62%,transparent);animation:gn-in 1.2s ease-out both}
[data-notification-atmosphere]::before,[data-notification-atmosphere]::after{content:"";position:absolute;pointer-events:none}
[data-notification-atmosphere="distortion"]{background:radial-gradient(ellipse at 12% 0,rgba(154,24,54,.58),transparent 48%)}[data-notification-atmosphere="distortion"]::before{inset:-20% 30% 5% -8%;background:#b8465666;clip-path:polygon(0 0,62% 0,54% 18%,92% 24%,58% 37%,78% 50%,48% 58%,66% 76%,34% 67%,18% 100%,0 78%);animation:gn-corrupt 4.5s ease-in-out infinite alternate}[data-notification-atmosphere="distortion"]::after{inset:0;background:radial-gradient(circle,#ff667d99 0 1px,transparent 2px) 0 0/43px 29px;animation:gn-spores 6s linear infinite}
[data-notification-atmosphere="ironBanner"]{transform-origin:top;background:linear-gradient(100deg,transparent 4%,#28663a55 5% 48%,transparent 52%);clip-path:polygon(4% 0,54% 0,49% 88%,6% 100%);animation:gn-unfurl 1.5s cubic-bezier(.12,.76,.16,1) both,gn-cloth 4s 1.5s ease-in-out infinite alternate}[data-notification-atmosphere="ironBanner"]::before{top:-34px;left:22%;width:92px;height:92px;border:2px solid #9fe3a755;transform:rotate(45deg)}
[data-notification-atmosphere="crucible"]::before,[data-notification-atmosphere="crucible"]::after{top:44px;left:8%;width:58%;height:5px;background:linear-gradient(90deg,transparent,#ff7770,transparent);box-shadow:0 0 12px #d45252;transform:rotate(12deg);animation:gn-strike 2.8s ease-in-out infinite}[data-notification-atmosphere="crucible"]::after{transform:rotate(-12deg);animation-delay:-1.4s}
[data-notification-atmosphere="trials"]::before,[data-notification-atmosphere="gambit"]::before,[data-notification-atmosphere="exotic"]::before,[data-notification-atmosphere="legendary"]::before,[data-notification-atmosphere="seasonal"]::before,[data-notification-atmosphere="system"]::before,[data-notification-atmosphere="completion"]::before{top:-34px;left:16%;color:var(--notification-accent);font:100px/1 sans-serif;text-shadow:0 0 18px var(--notification-primary);animation:gn-symbol 3.8s ease-in-out infinite}
[data-notification-atmosphere="trials"]::before{content:"☼"}[data-notification-atmosphere="gambit"]::before{content:"●  ·  ●"}[data-notification-atmosphere="exotic"]::before{content:"✦"}[data-notification-atmosphere="legendary"]::before{content:"◆"}[data-notification-atmosphere="seasonal"]::before,[data-notification-atmosphere="system"]::before{content:"◎"}[data-notification-atmosphere="completion"]::before{content:"✓"}
[data-notification-atmosphere="outage"]{background:repeating-linear-gradient(0deg,transparent 0 6px,#b83e4938 7px 9px);animation:gn-outage 1.3s steps(5,end) infinite}[data-notification-atmosphere="outage"]::before{inset:12px 0 auto;width:100%;height:8px;background:#ff788255;box-shadow:0 42px #b83e4933;animation:gn-break 1.7s steps(4) infinite}
.gn-rank-fanfare{box-shadow:inset 4px 0 0 #f2d887,0 0 22px #f2d8873d!important;animation:gn-rank .95s ease-out both!important}.gn-rank-atmosphere::before{content:"◇"!important;color:#ffe28b!important;font-size:130px!important;animation:gn-symbol 2s ease-out both!important}
@keyframes gn-in{from{opacity:0;transform:translateY(-25px);filter:blur(5px)}}@keyframes gn-corrupt{to{transform:translateX(12%) scale(1.18);filter:saturate(1.5)}}@keyframes gn-spores{to{background-position:43px 29px}}@keyframes gn-unfurl{from{opacity:0;transform:scaleY(.03) skewX(-5deg)}}@keyframes gn-cloth{to{transform:skewX(2deg);filter:brightness(1.25)}}@keyframes gn-strike{50%{opacity:1;transform:translateX(18%) rotate(12deg) scaleX(1.25)}}@keyframes gn-symbol{50%{transform:scale(1.15) rotate(8deg);filter:brightness(1.5)}}@keyframes gn-outage{25%{opacity:.75;transform:translateX(4px)}55%{opacity:.2;transform:translateX(-5px)}}@keyframes gn-break{50%{transform:translate(8px,30px) scaleX(.7)}}@keyframes gn-rank{from{opacity:0;filter:brightness(2);clip-path:inset(0 50%)}to{clip-path:inset(0)}}
@media(prefers-reduced-motion:reduce){[data-notification-atmosphere], [data-notification-atmosphere]::before,[data-notification-atmosphere]::after,.gn-rank-fanfare{animation:none}}[data-notification-reduced-motion=true] [data-notification-atmosphere],[data-notification-reduced-motion=true] [data-notification-atmosphere]::before,[data-notification-reduced-motion=true] [data-notification-atmosphere]::after,[data-notification-reduced-motion=true] .gn-rank-fanfare{animation:none}
`;
const SHOWN_NOTIFICATIONS_KEY = "guardian-nexus:notifications:shown";

export function GuardianFeed({ controller }: { controller: GuardianNotificationsController }) {
  const { feed, preferences } = controller;
  const [shown, setShown] = useState<Set<string>>(readShownNotifications);
  const eligibleFeed = useMemo(() => feed.filter((entry) => !entry.autoDismiss || !shown.has(notificationVersion(entry))), [feed, shown]);
  const [activeId, setActiveId] = useState<string>();
  const [paused, setPaused] = useState(false);
  const [atmosphereVisible, setAtmosphereVisible] = useState(true);
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
  useEffect(() => {
    if (!notification) {
      setAtmosphereVisible(false);
      return;
    }
    setAtmosphereVisible(true);
    const timer = window.setTimeout(() => setAtmosphereVisible(false), 60_000);
    return () => window.clearTimeout(timer);
  }, [notificationId, notification?.updatedAt, notification?.createdAt]);

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
      {atmosphereVisible && <div
        key={`${notification.id}:atmosphere`}
        className={isRankUpNotification(notification) ? "gn-rank-atmosphere" : undefined}
        style={style}
        data-notification-atmosphere={config.animation || "system"}
        aria-hidden="true"
      />}
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
