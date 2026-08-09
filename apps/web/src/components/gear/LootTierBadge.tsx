import styles from "./LootTierBadge.module.css";

export type LootTierBadgeVariant = "inline" | "overlay";

/** DestinyTierType: Unknown 0, Currency 1, Basic 2, Common 3, Rare 4, Superior 5, Exotic 6. */
export function lootTier(rarity?: string): number {
  const key = String(rarity || "").trim().toLowerCase();
  if (key === "exotic") return 6;
  if (key === "legendary" || key === "superior") return 5;
  if (key === "rare") return 4;
  if (key === "common") return 3;
  if (key === "uncommon" || key === "basic") return 2;
  if (key === "currency") return 1;
  return 0;
}

export function LootTierBadge({ rarity, variant = "inline" }: { rarity?: string; variant?: LootTierBadgeVariant }) {
  const tier = lootTier(rarity);
  const label = String(rarity || "Unknown").trim() || "Unknown";
  return <span className={`${styles.badge} ${variant === "overlay" ? styles.overlay : ""}`} data-tier={tier} aria-label={`Tier ${tier} ${label}`} title={`Tier ${tier} · ${label}`}><span>{tier}</span></span>;
}
