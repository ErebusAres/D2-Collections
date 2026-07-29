import { Bell, CheckCheck, ChevronRight, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { GuardianNotificationsController } from "../../modules/notifications/useGuardianNotifications";
import { categoryFor } from "../../modules/notifications/categoryConfig";
import { relativeTime } from "./GuardianFeed";
import styles from "./NotificationCenter.module.css";

export function NotificationCenter({ controller }: { controller: GuardianNotificationsController }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => controller.notifications.filter((entry) => !search || `${entry.title} ${entry.subtitle || ""} ${entry.description || ""}`.toLowerCase().includes(search.toLowerCase())).slice(0, 30), [controller.notifications, search]);
  const markAllRead = () => filtered.filter((entry) => !entry.readAt).forEach((entry) => controller.markRead(entry));
  return <>
    <button className={styles.trigger} onClick={() => setOpen(true)} aria-label={`Open notifications${controller.unreadCount ? `, ${controller.unreadCount} unread` : ""}`} aria-expanded={open}>
      <Bell />{controller.unreadCount > 0 && <b>{Math.min(99, controller.unreadCount)}</b>}
    </button>
    <button className={`${styles.scrim} ${open ? styles.open : ""}`} onClick={() => setOpen(false)} aria-label="Close notifications" tabIndex={open ? 0 : -1} />
    <aside className={`${styles.panel} ${open ? styles.open : ""}`} aria-hidden={!open} aria-label="Notification center">
      <header><div><span>Guardian Feed</span><h2>Notifications</h2></div><button onClick={() => setOpen(false)} aria-label="Close notification center"><X /></button></header>
      <div className={styles.tools}><label><Search /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search history" /></label><button onClick={markAllRead}><CheckCheck /> Mark all read</button></div>
      <div className={styles.list}>
        {filtered.map((notification) => {
          const config = categoryFor(notification.category);
          const Icon = config.icon;
          const destination = notification.destinationUrl || notification.externalUrl;
          const item = <><i style={{ color: config.accentColor }}><Icon /></i><span><small>{config.label} · {relativeTime(notification.updatedAt || notification.createdAt)}</small><strong>{notification.title}</strong>{notification.subtitle && <em>{notification.subtitle}</em>}</span>{destination && <ChevronRight />}</>;
          return <article key={notification.id} data-read={Boolean(notification.readAt)} style={{ borderLeftColor: config.primaryColor }}>
            {notification.destinationUrl ? <Link to={notification.destinationUrl} onClick={() => { controller.markRead(notification); setOpen(false); }}>{item}</Link>
              : notification.externalUrl ? <a href={notification.externalUrl} target="_blank" rel="noopener noreferrer" onClick={() => controller.markRead(notification)}>{item}</a>
                : <button onClick={() => controller.markRead(notification)}>{item}</button>}
            {notification.dismissible && !notification.dismissedAt && <button className={styles.dismiss} onClick={() => controller.dismiss(notification)} aria-label={`Dismiss ${notification.title}`}><X /></button>}
          </article>;
        })}
        {!filtered.length && <p>No notifications match this view.</p>}
      </div>
      <footer><Link to="/notifications" onClick={() => setOpen(false)}>Open notification history and settings <ChevronRight /></Link></footer>
    </aside>
  </>;
}
