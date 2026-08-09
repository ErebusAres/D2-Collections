import styles from "./GearTierRail.module.css";

export function normalizeGearTier(value?: number): number {
  const tier = Math.trunc(Number(value || 0));
  return tier >= 1 && tier <= 5 ? tier : 0;
}

export function GearTierRail({ tier: value, kind = "Gear" }: { tier?: number; kind?: "Weapon" | "Armor" | "Gear" }) {
  const tier = normalizeGearTier(value);
  if (!tier) return null;
  const tone = tier >= 5 ? styles.gold : tier >= 3 ? styles.purple : styles.white;
  return <span className={`${styles.rail} ${tone}`} title={`${kind} tier ${tier}`} aria-label={`${kind} tier ${tier}`}>
    {Array.from({ length: 5 }, (_, index) => {
      const level = 5 - index;
      return <span key={level} className={`${styles.mark} ${level <= tier ? styles.on : ""}`}>◆</span>;
    })}
  </span>;
}
