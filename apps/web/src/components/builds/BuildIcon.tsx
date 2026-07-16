import type { BuildGuardianClass, BuildSubclass } from "@guardian-nexus/contracts";
import { Orbit, Shield, Sparkles, Sun, Waves, Wind, Zap } from "lucide-react";
import styles from "../../pages/Builds.module.css";

export function SubclassIcon({ subclass, icon, large = false }: { subclass: BuildSubclass; icon?: string; large?: boolean }) {
  if (icon) return <span className={`${styles.subclassIcon} ${large ? styles.largeIcon : ""}`} data-element={subclass}><img src={icon} alt="" /></span>;
  const Icon = subclass === "arc" ? Zap : subclass === "solar" ? Sun : subclass === "void" ? Orbit : subclass === "strand" ? Wind : subclass === "stasis" ? Waves : Sparkles;
  return <span className={`${styles.subclassIcon} ${large ? styles.largeIcon : ""}`} data-element={subclass} aria-label={subclass}><Icon /></span>;
}

export function ClassIcon({ classType }: { classType: BuildGuardianClass }) {
  return <span className={styles.classIcon} aria-label={classType}><Shield /><b>{classType[0]!.toUpperCase()}</b></span>;
}
