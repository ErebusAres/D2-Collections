import type { NotificationCategory, NotificationPreferences } from "@guardian-nexus/contracts";
import { Archive, Check, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/common/Page";
import { categoryFor, notificationCategoryConfig } from "../modules/notifications/categoryConfig";
import { useGuardianNotifications } from "../modules/notifications/useGuardianNotifications";
import { relativeTime } from "../components/notifications/GuardianFeed";
import { primeCompletionAudio } from "../services/completionAudio";
import styles from "./WorldState.module.css";

type ScopeFilter = "all" | "global" | "account";

export function NotificationsPage() {
  const controller = useGuardianNotifications(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<NotificationCategory | "all">("all");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const filtered = useMemo(() => controller.notifications.filter((entry) =>
    (category === "all" || entry.category === category) &&
    (scope === "all" || entry.scope === scope) &&
    (!search || `${entry.title} ${entry.subtitle || ""} ${entry.description || ""}`.toLowerCase().includes(search.toLowerCase()))
  ), [category, controller.notifications, scope, search]);
  return <>
    <PageHeader eyebrow="Guardian Feed · Persistent record" title="Notification Center" description="Review world, account, discovery, vendor, and system updates even when the scrolling feed is disabled." />
    <section className={styles.notificationToolbar}>
      <label><Search /><input type="search" data-page-search aria-label="Search notification history" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notification history" /></label>
      <select value={category} onChange={(event) => setCategory(event.target.value as NotificationCategory | "all")}><option value="all">All categories</option>{Object.entries(notificationCategoryConfig).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}</select>
      <select value={scope} onChange={(event) => setScope(event.target.value as ScopeFilter)}><option value="all">Global + account</option><option value="global">Global</option><option value="account">Account</option></select>
      <strong>{filtered.length} records · {controller.unreadCount} unread</strong>
    </section>
    <div className={styles.notificationLayout}>
      <section className={styles.notificationHistory}>
        {filtered.map((entry) => {
          const config = categoryFor(entry.category); const Icon = config.icon;
          const content = <><i style={{ color: config.accentColor }}><Icon /></i><span><small>{config.label} · {entry.scope} · {relativeTime(entry.updatedAt || entry.createdAt)}</small><strong>{entry.title}</strong>{entry.subtitle && <em>{entry.subtitle}</em>}<b>{(entry.sourceConfidence || "unavailable").replace("-", " ")} · {entry.sourceLabel || "Source unavailable"}</b></span></>;
          return <article key={entry.id} data-read={Boolean(entry.readAt)} style={{ borderLeftColor: config.primaryColor }}>
            {entry.destinationUrl ? <Link to={entry.destinationUrl} onClick={() => controller.markRead(entry)}>{content}</Link> : <button onClick={() => controller.markRead(entry)}>{content}</button>}
            <nav><button onClick={() => controller.markRead(entry, !entry.readAt)} title={entry.readAt ? "Mark unread" : "Mark read"} aria-label={`${entry.readAt ? "Mark unread" : "Mark read"}: ${entry.title}`}><Check /></button><button onClick={() => controller.archive(entry)} title="Archive" aria-label={`Archive: ${entry.title}`}><Archive /></button></nav>
          </article>;
        })}
        {!filtered.length && <p className={styles.noNotifications}>No notification records match these filters.</p>}
      </section>
      <NotificationSettings preferences={controller.preferences} onSave={controller.savePreferences} />
    </div>
  </>;
}

function NotificationSettings({ preferences, onSave }: { preferences: NotificationPreferences; onSave: (value: NotificationPreferences) => void }) {
  const update = (patch: Partial<NotificationPreferences>) => onSave({ ...preferences, ...patch });
  const toggleCategory = (category: NotificationCategory, enabled: boolean) => update({
    enabledCategories: enabled
      ? [...new Set([...preferences.enabledCategories, category])]
      : preferences.enabledCategories.filter((entry) => entry !== category)
  });
  return <aside className={styles.notificationSettings}><header><SlidersHorizontal /><div><span>Delivery controls</span><h2>Feed settings</h2></div></header>
    <Toggle label="Scrolling banner" detail="History remains available when hidden." value={preferences.bannerVisible} set={(value) => update({ bannerVisible: value })} />
    <Toggle label="Global notifications" detail="World, vendor, activity, and news updates." value={preferences.globalNotifications} set={(value) => update({ globalNotifications: value })} />
    <Toggle label="Account notifications" detail="Private updates for only your membership." value={preferences.accountNotifications} set={(value) => update({ accountNotifications: value })} />
    <fieldset className={styles.categoryPreferences}>
      <legend>Enabled categories</legend>
      <p>Choose which categories appear in the feed and history.</p>
      <div>{Object.entries(notificationCategoryConfig).map(([value, config]) => {
        const category = value as NotificationCategory;
        const Icon = config.icon;
        return <label key={category} style={{ "--category-color": config.accentColor } as CSSProperties}>
          <input type="checkbox" checked={preferences.enabledCategories.includes(category)} onChange={(event) => toggleCategory(category, event.target.checked)} />
          <i><Icon /></i><span>{config.label}</span>
        </label>;
      })}</div>
    </fieldset>
    <Toggle label="Low-priority feed items" detail="Low-priority records always remain in history." value={preferences.lowPriorityInFeed} set={(value) => update({ lowPriorityInFeed: value })} />
    <Toggle label="Reduced notification motion" detail="Stops scrolling and decorative movement." value={preferences.reducedMotion} set={(value) => update({ reducedMotion: value })} />
    <Toggle label="Rank-up fanfare sound" detail="Off by default. Plays only for private Guardian Rank and Rewards Pass rank-up alerts." value={preferences.sound} set={(value) => {
      if (value) primeCompletionAudio();
      update({ sound: value });
    }} />
    <label className={styles.preferenceSelect}><span><b>Feed frequency</b><small>Control which priorities enter the banner.</small></span><select value={preferences.frequency} onChange={(event) => update({ frequency: event.target.value as NotificationPreferences["frequency"] })}><option value="all">All enabled</option><option value="important">Normal and above</option><option value="minimal">Critical and high only</option></select></label>
    <label className={styles.preferenceSelect}><span><b>Default display time</b><small>Individual urgent alerts may remain longer.</small></span><select value={preferences.autoDismissMs} onChange={(event) => update({ autoDismissMs: Number(event.target.value) })}><option value={8000}>8 seconds</option><option value={10000}>10 seconds</option><option value={12000}>12 seconds</option><option value={16000}>16 seconds</option></select></label>
  </aside>;
}

function Toggle({ label, detail, value, set, disabled = false }: { label: string; detail: string; value: boolean; set: (value: boolean) => void; disabled?: boolean }) {
  return <label className={styles.preferenceToggle}><span><b>{label}</b><small>{detail}</small></span><input type="checkbox" checked={value} disabled={disabled} onChange={(event) => set(event.target.checked)} /><i /></label>;
}
