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
section[data-guardian-animation]{isolation:isolate;animation:gn-arrive .7s cubic-bezier(.16,.78,.2,1) both}
section[data-guardian-animation]::before,section[data-guardian-animation]::after{content:"";position:absolute;z-index:1;inset:0;pointer-events:none}
section[data-guardian-animation]::after{background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--notification-primary) 25%,transparent),transparent);animation:gn-afterglow 2s ease-out both}
section[data-guardian-animation] .gn-fanfare-icon{animation:gn-emblem 1.35s cubic-bezier(.12,.9,.2,1) both}
section[data-guardian-animation] .gn-fanfare-copy{animation:gn-copy 1s cubic-bezier(.16,.76,.24,1) .18s both}
section[data-guardian-animation="distortion"]{animation:gn-corrupt 2s cubic-bezier(.12,.72,.16,1) both}
section[data-guardian-animation="distortion"]::before{inset:-130% -8%;background:repeating-conic-gradient(from 255deg at 0 50%,transparent 0 8deg,color-mix(in srgb,var(--notification-primary) 60%,transparent) 9deg 11deg,transparent 12deg 18deg);transform-origin:left;animation:gn-corruption 2.5s cubic-bezier(.12,.7,.18,1) both}
section[data-guardian-animation="distortion"]::after{inset:-20%;background:radial-gradient(ellipse at 4% 50%,color-mix(in srgb,var(--notification-accent) 72%,transparent),transparent 18%),repeating-linear-gradient(102deg,transparent 0 19px,color-mix(in srgb,var(--notification-primary) 24%,transparent) 20px 22px,transparent 23px 39px);animation:gn-corrupt-sky 2.6s ease-out both}
section[data-guardian-animation="distortion"] .gn-fanfare-icon{animation:gn-glitch 1.8s steps(2,end) both}
section[data-guardian-animation="ironBanner"]{transform-origin:left center;animation:gn-unfurl 1.85s cubic-bezier(.12,.82,.18,1) both}
section[data-guardian-animation="ironBanner"]::before{inset:-35% -5%;background:linear-gradient(102deg,transparent 5%,color-mix(in srgb,var(--notification-accent) 14%,transparent) 34%,color-mix(in srgb,var(--notification-accent) 65%,transparent) 49%,color-mix(in srgb,var(--notification-primary) 18%,transparent) 63%,transparent 92%);animation:gn-cloth 2.2s cubic-bezier(.14,.68,.18,1) both}
section[data-guardian-animation="ironBanner"]::after{inset:0 66% 0 0;border-right:1px solid color-mix(in srgb,var(--notification-accent) 85%,transparent);background:linear-gradient(90deg,color-mix(in srgb,var(--notification-primary) 40%,transparent),transparent);transform-origin:left;animation:gn-crest-wave 2s ease-out both}
section[data-guardian-animation="ironBanner"] .gn-fanfare-icon{animation:gn-crest 1.7s cubic-bezier(.12,.88,.2,1) .12s both}
section[data-guardian-animation="trials"]::before{inset:-190% -10%;background:conic-gradient(from 0deg at 15% 50%,transparent 0 9deg,color-mix(in srgb,var(--notification-accent) 65%,transparent) 10deg 12deg,transparent 13deg 29deg);animation:gn-spin-burst 2s ease-out both}
section[data-guardian-animation="gambit"]::before{inset:-170% -8%;background:conic-gradient(from 20deg at 12% 50%,transparent,color-mix(in srgb,var(--notification-primary) 58%,transparent),transparent 24%,color-mix(in srgb,var(--notification-accent) 52%,transparent),transparent 51%);animation:gn-spin-burst 2s ease-out both}
section[data-guardian-animation="exotic"]::before,section[data-guardian-animation="legendary"]::before,section[data-guardian-animation="completion"]::before{inset:-180% -6%;background:conic-gradient(from 0deg at 13% 50%,transparent 0 7deg,color-mix(in srgb,var(--notification-accent) 76%,transparent) 8deg 10deg,transparent 11deg 25deg);animation:gn-spin-burst 1.9s ease-out both}
section[data-guardian-animation="seasonal"]::before{inset:-190% -5%;background:conic-gradient(from 0deg at 14% 50%,transparent 0 19%,color-mix(in srgb,var(--notification-accent) 62%,transparent) 20% 21%,transparent 22% 47%,color-mix(in srgb,var(--notification-primary) 52%,transparent) 48% 49%,transparent 50%);animation:gn-orbit 2.25s ease-out both}
section[data-guardian-animation="warning"]::before,section[data-guardian-animation="outage"]::before{background:repeating-linear-gradient(118deg,transparent 0 28px,color-mix(in srgb,var(--notification-primary) 50%,transparent) 29px 38px,transparent 39px 68px);animation:gn-charge 1.7s ease-out both}
section[data-guardian-animation="warning"]::after,section[data-guardian-animation="outage"]::after{box-shadow:inset 0 0 20px color-mix(in srgb,var(--notification-primary) 65%,transparent);animation:gn-alarm 2s ease-out both}
@keyframes gn-arrive{from{opacity:0;transform:translateY(-16px) scaleY(.65)}65%{transform:translateY(2px) scaleY(1.05)}}
@keyframes gn-afterglow{from{opacity:0;transform:scaleX(.1)}42%{opacity:.9}to{opacity:0;transform:scaleX(1)}}
@keyframes gn-emblem{from{opacity:0;transform:scale(.15) rotate(-40deg);filter:brightness(2.3)}58%{transform:scale(1.35) rotate(8deg)}78%{transform:scale(.92) rotate(-3deg)}}
@keyframes gn-copy{from{opacity:0;transform:translateX(-32px);filter:blur(5px)}}
@keyframes gn-corrupt{0%{opacity:0;filter:blur(13px) saturate(2);clip-path:inset(0 100% 0 0)}30%{opacity:.75;filter:blur(2px) saturate(1.8)}47%{transform:translateX(4px);filter:none}55%{transform:translateX(-3px)}100%{clip-path:inset(0);transform:none}}
@keyframes gn-corruption{0%{opacity:0;transform:scaleX(.01) rotate(-8deg)}40%{opacity:.95}100%{opacity:0;transform:scaleX(1.1)}}
@keyframes gn-corrupt-sky{0%{opacity:0;transform:translateX(-30%) scaleX(.12)}38%{opacity:1}70%{opacity:.4;filter:hue-rotate(20deg)}100%{opacity:0;transform:translateX(18%) scaleX(1)}}
@keyframes gn-glitch{0%{opacity:0;transform:scale(.15) skewX(-24deg)}35%{opacity:1;transform:scale(1.45) skewX(15deg);filter:brightness(2.4)}48%{transform:translateX(5px) scale(.9)}62%{transform:translateX(-4px) scale(1.12)}100%{transform:none}}
@keyframes gn-unfurl{0%{opacity:0;clip-path:polygon(0 0,0 0,0 100%,0 100%);transform:perspective(500px) rotateY(-55deg) skewY(-5deg)}52%{opacity:1;clip-path:polygon(0 0,108% 11%,94% 87%,0 100%);transform:perspective(500px) rotateY(8deg) skewY(1deg)}74%{clip-path:polygon(0 0,99% 3%,103% 96%,0 100%);transform:rotateY(-3deg)}100%{clip-path:inset(0);transform:none}}
@keyframes gn-cloth{0%{opacity:0;transform:translateX(-115%) skewX(-20deg)}42%{opacity:.95}72%{opacity:.4;transform:translateX(18%) skewX(9deg)}100%{opacity:0;transform:translateX(108%)}}
@keyframes gn-crest-wave{0%{opacity:0;transform:scaleX(.03)}32%{opacity:.95;transform:scaleX(1.4)}100%{opacity:0;transform:scaleX(3.4)}}
@keyframes gn-crest{0%{opacity:0;transform:translateX(-42px) scale(1.9) rotate(-20deg)}52%{opacity:1;transform:translateX(5px) scale(1.3) rotate(5deg);filter:brightness(2.3)}74%{transform:translateX(-2px) scale(.94)}100%{transform:none}}
@keyframes gn-spin-burst{0%{opacity:0;transform:rotate(-70deg) scale(.08)}45%{opacity:1}100%{opacity:0;transform:rotate(38deg) scale(1)}}
@keyframes gn-charge{0%{opacity:0;transform:translateX(-95%) skewX(-18deg)}44%{opacity:1}100%{opacity:0;transform:translateX(95%) skewX(-18deg)}}
@keyframes gn-orbit{0%{opacity:0;transform:rotate(-130deg) scale(.1)}50%{opacity:.95}100%{opacity:0;transform:rotate(80deg) scale(1)}}
@keyframes gn-alarm{0%,100%{opacity:0}25%,50%{opacity:1}38%,67%{opacity:.15}}
@media(prefers-reduced-motion:reduce){section[data-guardian-animation],section[data-guardian-animation]::before,section[data-guardian-animation]::after,section[data-guardian-animation] .gn-fanfare-icon,section[data-guardian-animation] .gn-fanfare-copy{animation:none}}
[data-notification-reduced-motion="true"] section[data-guardian-animation],[data-notification-reduced-motion="true"] section[data-guardian-animation]::before,[data-notification-reduced-motion="true"] section[data-guardian-animation]::after,[data-notification-reduced-motion="true"] section[data-guardian-animation] .gn-fanfare-icon,[data-notification-reduced-motion="true"] section[data-guardian-animation] .gn-fanfare-copy{animation:none}
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
  const atmosphereClass = config.animation ? styles[`${config.animation}Atmosphere`] : styles.systemAtmosphere;
  return (
    <>
      <div
        key={`${notification.id}:atmosphere`}
        className={`${styles.atmosphere} ${atmosphereClass || ""} ${isRankUpNotification(notification) ? styles.fanfareAtmosphere : ""}`}
        style={style}
        data-notification-atmosphere={config.animation || "system"}
        aria-hidden="true"
      />
      <section
        key={notification.id}
        className={`${styles.feed} ${styles[notification.priority]} ${config.animation ? styles[config.animation] : ""} ${isRankUpNotification(notification) ? styles.fanfare : ""}`}
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
