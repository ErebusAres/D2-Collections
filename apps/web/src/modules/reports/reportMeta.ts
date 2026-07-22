import type { ReportCategory, ReportPriority, ReportStatus } from "@guardian-nexus/contracts";
import { Accessibility, Bug, DatabaseZap, Gauge, Lightbulb, MessageSquareText, ShieldAlert, Sparkles, type LucideIcon } from "lucide-react";

export const categoryOptions: Array<{ value: ReportCategory; label: string; short: string; description: string; icon: LucideIcon }> = [
  { value: "bug", label: "Bug report", short: "Something is broken", description: "Tell us what failed, where it happened, and how we can reproduce it.", icon: Bug },
  { value: "suggestion", label: "Suggestion", short: "A new idea", description: "Describe a feature or workflow that would make Guardian Nexus more useful.", icon: Lightbulb },
  { value: "feedback", label: "Feedback", short: "General thoughts", description: "Share what works well, what feels confusing, or what should be reconsidered.", icon: MessageSquareText },
  { value: "data", label: "Data issue", short: "Incorrect Destiny data", description: "Flag missing, stale, or incorrectly interpreted Bungie or manifest data.", icon: DatabaseZap },
  { value: "performance", label: "Performance", short: "Slow or unresponsive", description: "Report slow loading, excessive refreshes, or a page that becomes unresponsive.", icon: Gauge },
  { value: "accessibility", label: "Accessibility", short: "Hard to use or read", description: "Tell us about keyboard, motion, contrast, text, screen-reader, or other access barriers.", icon: Accessibility },
  { value: "account", label: "Account or sync", short: "Sign-in or Guardian data", description: "Report sign-in, character selection, save, sync, or account-specific problems.", icon: ShieldAlert },
  { value: "other", label: "Other", short: "Anything else", description: "Use this when none of the other report types fit.", icon: Sparkles }
];

export const reportStatuses: ReportStatus[] = ["open", "in_progress", "completed", "dismissed"];
export const reportPriorities: ReportPriority[] = ["low", "normal", "high", "urgent"];

export function categoryLabel(value: ReportCategory): string {
  return categoryOptions.find((option) => option.value === value)?.label || "Other";
}

export function statusLabel(value: ReportStatus): string {
  return ({ open: "Open", in_progress: "In progress", completed: "Completed", dismissed: "Dismissed" } as const)[value];
}

export function priorityLabel(value: ReportPriority): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function dateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
}
