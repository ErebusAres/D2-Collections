import {
  AlertTriangle, BadgeCheck, CircleAlert, CircleX, Coins, Crosshair, Diamond, Gift, Globe2,
  Newspaper, Orbit, Shield, Sparkles, Swords, Trophy, type LucideIcon, Waves, Zap
} from "lucide-react";
import type { NotificationCategory, NotificationPriority } from "@guardian-nexus/contracts";

export interface NotificationCategoryConfig {
  label: string;
  icon: LucideIcon;
  primaryColor: string;
  accentColor: string;
  borderColor: string;
  backgroundGradient: string;
  defaultPriority: NotificationPriority;
  defaultAutoDismissMs: number;
  animation?: string;
}

export const notificationCategoryConfig: Record<NotificationCategory, NotificationCategoryConfig> = {
  distortion: config("Distortion / IX", Waves, "#b84656", "#e86a78", "rgba(184,70,86,.62)", "linear-gradient(90deg,rgba(97,22,35,.30),rgba(8,18,25,.96))", "high", 14_000, "distortion"),
  crucible: config("Crucible", Crosshair, "#d45252", "#ff7770", "rgba(212,82,82,.58)", "linear-gradient(90deg,rgba(103,25,29,.28),rgba(8,18,25,.96))", "normal", 10_000),
  trials: config("Trials", Trophy, "#d4b45f", "#ffe099", "rgba(212,180,95,.6)", "linear-gradient(90deg,rgba(100,78,25,.27),rgba(12,16,19,.96))", "high", 12_000),
  "iron-banner": config("Iron Banner", Shield, "#6aae77", "#9fe3a7", "rgba(106,174,119,.58)", "linear-gradient(90deg,rgba(28,72,42,.28),rgba(10,18,22,.96))", "high", 12_000),
  gambit: config("Gambit", Diamond, "#39c879", "#7ff0aa", "rgba(57,200,121,.56)", "linear-gradient(90deg,rgba(18,89,51,.26),rgba(8,18,22,.96))", "normal", 10_000),
  vanguard: config("Vanguard", Swords, "#477ab4", "#87b9ef", "rgba(71,122,180,.6)", "linear-gradient(90deg,rgba(22,55,94,.28),rgba(8,18,25,.96))", "normal", 10_000),
  exotic: config("Exotic", Sparkles, "#ceae63", "#f2d887", "rgba(206,174,99,.62)", "linear-gradient(90deg,rgba(100,76,20,.28),rgba(12,17,20,.96))", "normal", 11_000),
  legendary: config("Legendary gear", Zap, "#8067b3", "#bd9df2", "rgba(128,103,179,.62)", "linear-gradient(90deg,rgba(63,42,103,.28),rgba(10,17,23,.96))", "normal", 10_000),
  seasonal: config("Seasonal", Orbit, "#3ca9ae", "#83e1df", "rgba(60,169,174,.58)", "linear-gradient(90deg,rgba(19,78,83,.28),rgba(8,18,24,.96))", "normal", 10_000),
  eververse: config("Eververse", Coins, "#a8c8d0", "#e5fbff", "rgba(168,200,208,.54)", "linear-gradient(90deg,rgba(67,94,104,.24),rgba(9,18,24,.96))", "normal", 10_000),
  "bungie-news": config("Bungie news", Newspaper, "#62a7dc", "#a8d9ff", "rgba(98,167,220,.58)", "linear-gradient(90deg,rgba(25,70,106,.28),rgba(8,18,25,.96))", "normal", 11_000),
  completion: config("Completion", BadgeCheck, "#64d99b", "#a3f5c8", "rgba(100,217,155,.58)", "linear-gradient(90deg,rgba(24,91,58,.26),rgba(8,18,23,.96))", "normal", 12_000),
  warning: config("Warning", AlertTriangle, "#d8a84f", "#ffd17d", "rgba(216,168,79,.62)", "linear-gradient(90deg,rgba(102,69,17,.28),rgba(12,17,20,.96))", "high", 14_000),
  outage: config("Service alert", CircleX, "#b83e49", "#ff7882", "rgba(184,62,73,.68)", "linear-gradient(90deg,rgba(100,20,28,.34),rgba(13,15,19,.98))", "critical", 18_000),
  "redemption-code": config("Reward code", Gift, "#6f91c9", "#a9c8ff", "rgba(111,145,201,.56)", "linear-gradient(90deg,rgba(39,65,109,.26),rgba(8,18,25,.96))", "normal", 11_000),
  system: config("World state", Globe2, "#7da5b3", "#bde9ef", "rgba(125,165,179,.5)", "linear-gradient(90deg,rgba(45,75,86,.23),rgba(8,18,25,.96))", "low", 9_000)
};

function config(
  label: string,
  icon: LucideIcon,
  primaryColor: string,
  accentColor: string,
  borderColor: string,
  backgroundGradient: string,
  defaultPriority: NotificationPriority,
  defaultAutoDismissMs: number,
  animation?: string
): NotificationCategoryConfig {
  return { label, icon, primaryColor, accentColor, borderColor, backgroundGradient, defaultPriority, defaultAutoDismissMs, animation };
}

export function categoryFor(value: NotificationCategory | string | undefined): NotificationCategoryConfig {
  return notificationCategoryConfig[value as NotificationCategory] || {
    ...notificationCategoryConfig.system,
    label: "Guardian update",
    icon: value === "error" ? CircleAlert : Globe2
  };
}
