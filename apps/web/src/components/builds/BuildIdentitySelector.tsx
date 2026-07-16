import type { BuildDocument, BuildGuardianClass, BuildSubclass } from "@guardian-nexus/contracts";
import { AlertTriangle, BadgeCheck } from "lucide-react";
import { useEffect } from "react";
import { useBuildCatalog } from "../../modules/builds/buildCatalog";
import { titleCase } from "../../modules/builds/builds";
import styles from "../../pages/Builds.module.css";

const classes: BuildGuardianClass[] = ["hunter", "titan", "warlock"];
const subclasses: BuildSubclass[] = ["prismatic", "arc", "solar", "void", "strand", "stasis"];

export function BuildIdentitySelector({ value, onChange }: { value: BuildDocument; onChange: (value: BuildDocument) => void }) {
  const catalog = useBuildCatalog({ kind: "subclass", query: "", classType: value.classType });
  const definition = catalog.data?.data.results.find((entry) => entry.subclass === value.subclass);
  useEffect(() => {
    if (definition?.icon && definition.icon !== value.subclassIcon) onChange({ ...value, subclassIcon: definition.icon });
  }, [definition?.icon, onChange, value]);
  const setClass = (classType: BuildGuardianClass) => onChange({ ...value, classType, subclassIcon: undefined });
  const setSubclass = (subclass: BuildSubclass) => onChange({ ...value, subclass, subclassIcon: undefined });
  return <div className={styles.identitySelectors}>
    <label><span>Class *</span><select value={value.classType} onChange={(event) => setClass(event.target.value as BuildGuardianClass)}>{classes.map((entry) => <option key={entry} value={entry}>{titleCase(entry)}</option>)}</select></label>
    <label><span>Subclass *</span><select value={value.subclass} onChange={(event) => setSubclass(event.target.value as BuildSubclass)}>{subclasses.map((entry) => <option key={entry} value={entry}>{titleCase(entry)}</option>)}</select></label>
    <div className={styles.identityManifestPreview}>
      {definition?.icon ? <img src={definition.icon} alt="" /> : <AlertTriangle />}
      <span><strong>{titleCase(value.classType)} · {titleCase(value.subclass)}</strong><small>{definition ? <><BadgeCheck /> Official Bungie subclass definition</> : catalog.isLoading ? "Resolving official subclass icon…" : "Official icon unavailable; no placeholder will be saved."}</small></span>
    </div>
  </div>;
}
