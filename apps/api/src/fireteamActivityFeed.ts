import type { FireteamActivityFeed, FireteamActivityFeedEntry, RecentItemEvent } from "@guardian-nexus/contracts";
import { recentItemEventFromRow } from "./recentItems";
import { sha256 } from "./security";
import type { Env } from "./types";

export const FIRETEAM_FEED_HISTORY_LIMIT = 60;
export const FIRETEAM_FEED_RETENTION_DAYS = 7;
export const FIRETEAM_MESSAGE_MAX_LENGTH = 240;
const SHARED_LOOT_KINDS = ["weapon-found", "armor-found", "catalyst-found", "exotic-engram-found"] as const;

export function sharedActivityFeedEnabled(payload: any): boolean {
  if (payload?.activityFeedPreferenceSet !== true) return true;
  return payload?.activityFeedEnabled !== false;
}

export function configuredFireteamActivityFeedEnabled(settingsJson: string | undefined, payload: any): boolean {
  try {
    const settings = JSON.parse(settingsJson || "{}");
    if (typeof settings?.activityFeedEnabled === "boolean") return settings.activityFeedEnabled;
  } catch { /* Fall back to the committed snapshot's compatibility marker. */ }
  return sharedActivityFeedEnabled(payload);
}

export function normalizeFireteamMessage(value: unknown): string {
  const printable = [...String(value ?? "")].map((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? " " : character;
  }).join("");
  return printable.replace(/\s+/g, " ").trim().slice(0, FIRETEAM_MESSAGE_MAX_LENGTH);
}

export async function fireteamChannelKey(membershipIds: string[]): Promise<string> {
  return sha256([...new Set(membershipIds.filter(Boolean))].sort().join("|"));
}

export function sanitizeSharedRecentEvent(event: RecentItemEvent): RecentItemEvent {
  if (!event.gear) return event;
  const gear: any = { ...event.gear };
  delete gear.tag;
  delete gear.dismissedAt;
  delete gear.ownerCharacterId;
  return { ...event, gear: gear as RecentItemEvent["gear"] };
}

export function sharedRecentEventFromRow(row: any): RecentItemEvent {
  let event = recentItemEventFromRow(row);
  try {
    const observation = JSON.parse(String(row.observation_metadata_json || "{}"));
    if (observation?.gear) event = { ...event, gear: observation.gear };
  } catch { /* Legacy malformed observation metadata must not hide the saved event. */ }
  return sanitizeSharedRecentEvent(event);
}

export function combineFireteamActivityEntries(entries: FireteamActivityFeedEntry[], limit = FIRETEAM_FEED_HISTORY_LIMIT): FireteamActivityFeedEntry[] {
  return [...entries].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.id.localeCompare(left.id)).slice(0, limit);
}

export async function readFireteamActivityFeed(input: {
  env: Env;
  viewerMembershipId: string;
  partyMembershipIds: string[];
  enabledMembershipIds: string[];
  displayNames: Map<string, string>;
  enabled: boolean;
  now?: string;
}): Promise<FireteamActivityFeed> {
  const enabledIds = [...new Set(input.enabledMembershipIds.filter((id) => input.partyMembershipIds.includes(id)))];
  const channelAvailable = input.enabled && enabledIds.some((id) => id !== input.viewerMembershipId);
  const base = { enabled: input.enabled, channelAvailable, entries: [], historyLimit: FIRETEAM_FEED_HISTORY_LIMIT, retentionDays: FIRETEAM_FEED_RETENTION_DAYS, messageMaxLength: FIRETEAM_MESSAGE_MAX_LENGTH } satisfies FireteamActivityFeed;
  if (!input.enabled || !enabledIds.includes(input.viewerMembershipId)) return base;
  const now = input.now || new Date().toISOString();
  const cutoff = new Date(Date.parse(now) - FIRETEAM_FEED_RETENTION_DAYS * 86_400_000).toISOString();
  const placeholders = enabledIds.map(() => "?").join(",");
  const loot = await input.env.DB.prepare(`SELECT events.*, observations.metadata_json AS observation_metadata_json
    FROM recent_item_events events
    LEFT JOIN recent_item_observations observations
      ON observations.membership_id = events.membership_id AND observations.observation_key = events.source_key
    WHERE events.membership_id IN (${placeholders}) AND events.event_kind IN (${SHARED_LOOT_KINDS.map(() => "?").join(",")})
      AND events.last_observed_at >= ? ORDER BY events.last_observed_at DESC LIMIT ?`)
    .bind(...enabledIds, ...SHARED_LOOT_KINDS, cutoff, FIRETEAM_FEED_HISTORY_LIMIT).all<any>();
  const channelKey = await fireteamChannelKey(input.partyMembershipIds);
  const messages = await input.env.DB.prepare("SELECT id, membership_id, display_name, body, created_at FROM fireteam_messages WHERE channel_key = ? AND created_at >= ? ORDER BY created_at DESC LIMIT ?")
    .bind(channelKey, cutoff, FIRETEAM_FEED_HISTORY_LIMIT).all<any>();
  const enabledSet = new Set(enabledIds);
  const lootEntries: FireteamActivityFeedEntry[] = (loot.results || []).map((row: any) => ({
    type: "loot", id: String(row.id), membershipId: String(row.membership_id), displayName: input.displayNames.get(String(row.membership_id)) || "Unknown Guardian", createdAt: String(row.last_observed_at), event: sharedRecentEventFromRow(row)
  }));
  const messageEntries: FireteamActivityFeedEntry[] = (messages.results || []).filter((row: any) => enabledSet.has(String(row.membership_id))).map((row: any) => ({
    type: "message", id: String(row.id), membershipId: String(row.membership_id), displayName: input.displayNames.get(String(row.membership_id)) || String(row.display_name || "Unknown Guardian"), createdAt: String(row.created_at), body: String(row.body)
  }));
  return { ...base, entries: combineFireteamActivityEntries([...lootEntries, ...messageEntries]) };
}
