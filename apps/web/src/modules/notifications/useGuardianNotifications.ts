import type {
  GuardianNotification, NotificationFeedData, NotificationPreferences,
  UpdateNotificationPreferencesRequest, UpdateNotificationStateRequest
} from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useGuardian } from "../../context/GuardianContext";
import { api, mutationHeaders, queuedApi } from "../../services/api/client";
import { activeRewardCodes } from "../reward-codes/rewardCodes";
import { useRewardCodeStatus } from "../reward-codes/rewardCodeStatus";

const ANONYMOUS_STATE_KEY = "guardian-nexus:notifications:anonymous-state";
const ANONYMOUS_PREFERENCES_KEY = "guardian-nexus:notifications:anonymous-preferences";

export interface GuardianNotificationsController {
  notifications: GuardianNotification[];
  feed: GuardianNotification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  loading: boolean;
  error?: Error | null;
  dismiss(notification: GuardianNotification): void;
  restore(notification: GuardianNotification): void;
  markRead(notification: GuardianNotification, read?: boolean): void;
  archive(notification: GuardianNotification): void;
  savePreferences(preferences: NotificationPreferences): void;
  refresh(): void;
}

const fallbackPreferences: NotificationPreferences = {
  enabledCategories: ["distortion", "crucible", "trials", "iron-banner", "gambit", "vanguard", "exotic", "legendary", "seasonal", "eververse", "bungie-news", "completion", "warning", "outage", "redemption-code", "system"],
  globalNotifications: true,
  accountNotifications: true,
  bannerVisible: true,
  autoDismissMs: 10_000,
  reducedMotion: false,
  sound: false,
  lowPriorityInFeed: false,
  frequency: "all"
};

export function useGuardianNotifications(history = false): GuardianNotificationsController {
  const { session, autoRefresh } = useGuardian();
  const queryClient = useQueryClient();
  const membershipId = session?.guardian?.membershipId;
  const rewardStatus = useRewardCodeStatus(membershipId, Boolean(session?.authenticated), autoRefresh);
  const [localState, setLocalState] = useState<Record<string, { readAt?: string; dismissedAt?: string; archivedAt?: string; restoredAt?: string }>>(() => readJson(ANONYMOUS_STATE_KEY, {}));
  const [localPreferences, setLocalPreferences] = useState<NotificationPreferences>(() => ({ ...fallbackPreferences, ...readJson(ANONYMOUS_PREFERENCES_KEY, {}) }));
  const [temporalNow, setTemporalNow] = useState(() => Date.now());
  const query = useQuery({
    queryKey: ["guardian-notifications", history, membershipId],
    queryFn: () => api<NotificationFeedData>(`/api/v1/notifications?${history ? "history=true&limit=100" : "limit=40"}`),
    staleTime: 60_000,
    refetchInterval: autoRefresh ? 60_000 : false,
    retry: 1
  });
  const stateMutation = useMutation({
    mutationFn: (input: UpdateNotificationStateRequest) => queuedApi("/api/v1/me/notifications/state", {
      method: "PUT", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify(input)
    }, { persist: true }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["guardian-notifications"] })
  });
  const preferencesMutation = useMutation({
    mutationFn: (input: UpdateNotificationPreferencesRequest) => queuedApi<NotificationPreferences>("/api/v1/me/notification-preferences", {
      method: "PUT", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify(input)
    }, { persist: true }),
    onSuccess: (result) => {
      queryClient.setQueriesData({ queryKey: ["guardian-notifications"] }, (old: any) => old ? { ...old, data: { ...old.data, preferences: result.data } } : old);
    }
  });
  const rewardNotifications = useMemo(() => activeRewardCodes().filter((entry) => !rewardStatus.hidden.has(entry.code)).map<GuardianNotification>((entry) => ({
    id: `reward-code:${entry.code}`,
    eventKey: `reward-code:${entry.code}`,
    type: "redemption-code",
    category: "redemption-code",
    scope: "global",
    priority: entry.featured ? "normal" : "low",
    status: entry.featured ? "active" : "read",
    title: `${entry.kind}: ${entry.reward}`,
    subtitle: entry.code,
    destinationUrl: "/codes",
    externalUrl: entry.sourceUrl,
    createdAt: entry.verifiedAt,
    expiresAt: entry.expiresAt,
    dismissible: true,
    autoDismiss: true,
    source: "reward-code-catalog",
    sourceLabel: "Verified reward code",
    sourceConfidence: "confirmed",
    readAt: entry.featured ? undefined : entry.verifiedAt,
    metadata: { code: entry.code }
  })), [rewardStatus.hidden]);
  const preferences = session?.authenticated ? query.data?.data.preferences || fallbackPreferences : localPreferences;
  const notifications = useMemo(() => {
    const byId = new Map<string, GuardianNotification>();
    [...(query.data?.data.notifications || []), ...rewardNotifications].forEach((entry) => {
      const local = localState[entry.id];
      byId.set(entry.id, {
        ...entry,
        ...local,
        status: notificationStatusAt(entry, local, temporalNow)
      });
    });
    return [...byId.values()].filter((entry) => preferences.enabledCategories.includes(entry.category))
      .filter((entry) => entry.scope === "global" ? preferences.globalNotifications : preferences.accountNotifications)
      .sort(compareNotifications);
  }, [localState, preferences, query.data?.data.notifications, rewardNotifications, temporalNow]);
  const feed = useMemo(() => notifications.filter((entry) => !entry.dismissedAt && entry.status === "active")
    .filter((entry) => preferences.lowPriorityInFeed || entry.priority !== "low")
    .filter((entry) => preferences.frequency === "all" || (preferences.frequency === "important" ? entry.priority !== "low" : entry.priority === "critical" || entry.priority === "high")),
  [notifications, preferences.frequency, preferences.lowPriorityInFeed]);

  useEffect(() => {
    document.documentElement.dataset.notificationReducedMotion = String(preferences.reducedMotion);
  }, [preferences.reducedMotion]);
  useEffect(() => {
    const boundaries = [...(query.data?.data.notifications || []), ...rewardNotifications]
      .flatMap((entry) => [entry.startsAt, entry.expiresAt])
      .filter((value): value is string => Boolean(value))
      .map(Date.parse)
      .filter((value) => Number.isFinite(value) && value > Date.now())
      .sort((a, b) => a - b);
    const nextBoundary = boundaries[0];
    if (!nextBoundary) return;
    const timer = window.setTimeout(() => setTemporalNow(Date.now()), Math.min(2_147_483_647, Math.max(0, nextBoundary - Date.now() + 25)));
    return () => window.clearTimeout(timer);
  }, [query.data?.data.notifications, rewardNotifications, temporalNow]);

  const updateLocalState = (notification: GuardianNotification, patch: Record<string, string | undefined>) => {
    setLocalState((current) => {
      const next = { ...current, [notification.id]: { ...current[notification.id], ...patch } };
      localStorage.setItem(ANONYMOUS_STATE_KEY, JSON.stringify(next));
      return next;
    });
  };
  const updateState = (notification: GuardianNotification, action: UpdateNotificationStateRequest["action"]) => {
    const now = new Date().toISOString();
    if (action === "dismiss") updateLocalState(notification, { dismissedAt: now });
    if (action === "read") updateLocalState(notification, { readAt: now });
    if (action === "unread") updateLocalState(notification, { readAt: undefined });
    if (action === "restore") updateLocalState(notification, { readAt: undefined, dismissedAt: undefined, archivedAt: undefined, restoredAt: now });
    if (action === "archive") updateLocalState(notification, { archivedAt: now });
    if (session?.authenticated && !notification.id.startsWith("reward-code:")) {
      stateMutation.mutate({ notificationId: notification.id, action });
    }
  };
  const savePreferences = (next: NotificationPreferences) => {
    const safe = { ...next };
    setLocalPreferences(safe);
    localStorage.setItem(ANONYMOUS_PREFERENCES_KEY, JSON.stringify(safe));
    if (session?.authenticated) preferencesMutation.mutate({ preferences: safe });
  };
  return {
    notifications,
    feed,
    unreadCount: notifications.filter((entry) => !entry.readAt && !entry.dismissedAt && entry.status !== "expired" && entry.status !== "archived").length,
    preferences,
    loading: query.isLoading,
    error: (query.error || stateMutation.error || preferencesMutation.error) as Error | null,
    dismiss: (notification) => updateState(notification, "dismiss"),
    restore: (notification) => updateState(notification, "restore"),
    markRead: (notification, read = true) => updateState(notification, read ? "read" : "unread"),
    archive: (notification) => updateState(notification, "archive"),
    savePreferences,
    refresh: () => void query.refetch()
  };
}

function compareNotifications(a: GuardianNotification, b: GuardianNotification): number {
  const priority = { critical: 0, high: 1, normal: 2, low: 3 };
  return priority[a.priority] - priority[b.priority] || Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt);
}

export function notificationStatusAt(
  notification: GuardianNotification,
  local: { readAt?: string; dismissedAt?: string; archivedAt?: string; restoredAt?: string } | undefined,
  now: number
): GuardianNotification["status"] {
  if (local?.dismissedAt) return "dismissed";
  if (local?.archivedAt) return "archived";
  if (notification.expiresAt && Date.parse(notification.expiresAt) <= now) return "expired";
  if (local?.restoredAt) return "active";
  if (local?.readAt) return "read";
  return notification.status;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
}
