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
  const classCatalog = useBuildCatalog({ kind: "class", query: "", classType: value.classType });
  const definition = catalog.data?.data.results.find((entry) => entry.subclass === value.subclass);
  const classDefinition = classCatalog.data?.data.results.find((entry) => entry.classType === value.classType);
  useEffect(() => {
    const subclassIcon = definition?.icon || value.subclassIcon;
    const classIcon = classDefinition?.icon || value.classIcon;
    if (subclassIcon !== value.subclassIcon || classIcon !== value.classIcon) onChange({ ...value, subclassIcon, classIcon });
  }, [classDefinition?.icon, definition?.icon, onChange, value]);
  const setClass = (classType: BuildGuardianClass) => onChange({ ...value, classType, classIcon: undefined, subclassIcon: undefined });
  const setSubclass = (subclass: BuildSubclass) => onChange({ ...value, subclass, subclassIcon: undefined });
  return <div className={styles.identitySelectors}>
    <label><span>Class *</span><select value={value.classType} onChange={(event) => setClass(event.target.value as BuildGuardianClass)}>{classes.map((entry) => <option key={entry} value={entry}>{titleCase(entry)}</option>)}</select></label>
    <label><span>Subclass *</span><select value={value.subclass} onChange={(event) => setSubclass(event.target.value as BuildSubclass)}>{subclasses.map((entry) => <option key={entry} value={entry}>{titleCase(entry)}</option>)}</select></label>
    <div className={styles.identityManifestPreview}>
      {definition?.icon ? <img src={definition.icon} alt="" /> : <AlertTriangle />}
      <span><strong>{titleCase(value.classType)} · {titleCase(value.subclass)}</strong><small>{definition && classDefinition ? <><BadgeCheck /> Official Bungie class and subclass definitions</> : catalog.isLoading || classCatalog.isLoading ? "Resolving official identity icons…" : "One or more official icons are unavailable."}</small></span>
    </div>
  </div>;
}
