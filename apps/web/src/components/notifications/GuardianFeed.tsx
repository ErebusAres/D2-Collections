import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { GuardianNotificationsController } from "../../modules/notifications/useGuardianNotifications";
import type { GuardianNotification, NotificationPreferences } from "@guardian-nexus/contracts";
import { categoryFor } from "../../modules/notifications/categoryConfig";
import styles from "./GuardianFeed.module.css";

export function GuardianFeed({ controller }: { controller: GuardianNotificationsController }) {
  const { feed, preferences } = controller;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [scrollDistance, setScrollDistance] = useState(0);
  const textRef = useRef<HTMLSpanElement>(null);
  const notification = feed[index % Math.max(1, feed.length)];

  useEffect(() => { if (index >= feed.length) setIndex(0); }, [feed.length, index]);
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
    if (!shouldRotateFeed(notification, paused, feed.length)) return;
    const duration = notificationDisplayDuration(notification, preferences);
    const timer = window.setTimeout(() => setIndex((value) => (value + 1) % feed.length), duration);
    return () => window.clearTimeout(timer);
  }, [feed.length, notification, paused, preferences.autoDismissMs]);

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
    <span className={styles.icon}><Icon aria-hidden="true" /></span>
    <span className={styles.label}>{config.label}</span>
    <span className={`${styles.copy} ${overflows ? styles.scrollable : ""}`} ref={textRef} style={{ "--scroll-distance": `${scrollDistance}px` } as CSSProperties}>
      <span><strong>{notification.title}</strong>{notification.subtitle && <small>{notification.subtitle}</small>}</span>
    </span>
    <time dateTime={notification.updatedAt || notification.createdAt}>{relativeTime(notification.updatedAt || notification.createdAt)}</time>
    {notification.badge && <b className={styles.badge}>{notification.badge}</b>}
    {notification.externalUrl && !notification.destinationUrl && <ExternalLink className={styles.external} aria-label="External link" />}
  </>;
  return (
    <section
      className={`${styles.feed} ${styles[notification.priority]} ${config.animation ? styles[config.animation] : ""}`}
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
      <span className={styles.position} aria-hidden="true">{index + 1}/{feed.length}</span>
      {notification.dismissible && <button type="button" onClick={() => { controller.dismiss(notification); setIndex((value) => value % Math.max(1, feed.length - 1)); }} aria-label={`Dismiss ${notification.title}`}><X /></button>}
    </section>
  );
}

export function shouldRotateFeed(
  notification: GuardianNotification | undefined,
  paused: boolean,
  feedLength: number
): notification is GuardianNotification {
  return Boolean(notification) && !paused && feedLength > 1;
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
