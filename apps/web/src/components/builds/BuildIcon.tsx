import type { BuildGuardianClass, BuildSubclass } from "@guardian-nexus/contracts";
import { AlertTriangle } from "lucide-react";
import { useBuildCatalog } from "../../modules/builds/buildCatalog";
import styles from "../../pages/Builds.module.css";

export function SubclassIcon({ subclass, icon, large = false }: { subclass: BuildSubclass; icon?: string; large?: boolean }) {
  if (icon) return <span className={`${styles.subclassIcon} ${large ? styles.largeIcon : ""}`} data-element={subclass}><img src={icon} alt="" /></span>;
  return <span className={`${styles.subclassIcon} ${large ? styles.largeIcon : ""}`} data-element={subclass} aria-label={`${subclass} icon unavailable`} title="Official subclass icon unavailable"><AlertTriangle /></span>;
}

export function ClassIcon({ classType, icon }: { classType: BuildGuardianClass; icon?: string }) {
  const catalog = useBuildCatalog({ kind: "class", query: "", classType });
  const resolvedIcon = icon || catalog.data?.data.results.find((entry) => entry.classType === classType)?.icon;
  return <span className={styles.classIcon} aria-label={classType} title={resolvedIcon ? undefined : "Official class icon unavailable"}>{resolvedIcon ? <img src={resolvedIcon} alt="" /> : <AlertTriangle />}</span>;
}
