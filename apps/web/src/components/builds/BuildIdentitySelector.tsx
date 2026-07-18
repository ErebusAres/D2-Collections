import type { BuildDocument, BuildGuardianClass, BuildSubclass } from "@guardian-nexus/contracts";
import { AlertTriangle, BadgeCheck } from "lucide-react";
import { useEffect } from "react";
import { useBuildCatalog, useBuildTranscendence } from "../../modules/builds/buildCatalog";
import { titleCase } from "../../modules/builds/builds";
import styles from "../../pages/Builds.module.css";

const classes: BuildGuardianClass[] = ["hunter", "titan", "warlock"];
const subclasses: BuildSubclass[] = ["prismatic", "arc", "solar", "void", "strand", "stasis"];

export function BuildIdentitySelector({ value, onChange }: { value: BuildDocument; onChange: (value: BuildDocument) => void }) {
  const catalog = useBuildCatalog({ kind: "subclass", query: "", classType: value.classType });
  const classCatalog = useBuildCatalog({ kind: "class", query: "", classType: value.classType });
  const definition = catalog.data?.data.results.find((entry) => entry.subclass === value.subclass);
  const classDefinition = classCatalog.data?.data.results.find((entry) => entry.classType === value.classType);
  const transcendence = useBuildTranscendence(value.classType, value.subclass, value.subclassConfig.transcendence);
  useEffect(() => {
    const subclassIcon = definition?.icon || value.subclassIcon;
    const classIcon = classDefinition?.icon || value.classIcon;
    const nextTranscendence = value.subclass === "prismatic" ? transcendence : undefined;
    if (subclassIcon !== value.subclassIcon || classIcon !== value.classIcon || nextTranscendence?.hash !== value.subclassConfig.transcendence?.hash || nextTranscendence?.icon !== value.subclassConfig.transcendence?.icon || Boolean(nextTranscendence) !== Boolean(value.subclassConfig.transcendence)) {
      onChange({ ...value, subclassIcon, classIcon, subclassConfig: { ...value.subclassConfig, transcendence: nextTranscendence } });
    }
  }, [classDefinition?.icon, definition?.icon, onChange, transcendence, value]);
  const setClass = (classType: BuildGuardianClass) => onChange({ ...value, classType, classIcon: undefined, subclassIcon: undefined, subclassConfig: { ...value.subclassConfig, transcendence: undefined } });
  const setSubclass = (subclass: BuildSubclass) => onChange({ ...value, subclass, subclassIcon: undefined, subclassConfig: { ...value.subclassConfig, transcendence: subclass === "prismatic" ? value.subclassConfig.transcendence : undefined } });
  return <div className={styles.identitySelectors}>
    <label><span>Class *</span><select value={value.classType} onChange={(event) => setClass(event.target.value as BuildGuardianClass)}>{classes.map((entry) => <option key={entry} value={entry}>{titleCase(entry)}</option>)}</select></label>
    <label><span>Subclass *</span><select value={value.subclass} onChange={(event) => setSubclass(event.target.value as BuildSubclass)}>{subclasses.map((entry) => <option key={entry} value={entry}>{titleCase(entry)}</option>)}</select></label>
    <div className={styles.identityManifestPreview}>
      {definition?.icon ? <img src={definition.icon} alt="" /> : <AlertTriangle />}
      <span><strong>{titleCase(value.classType)} · {titleCase(value.subclass)}</strong><small>{definition && classDefinition ? <><BadgeCheck /> Official Bungie class and subclass definitions</> : catalog.isLoading || classCatalog.isLoading ? "Resolving official identity icons…" : "One or more official icons are unavailable."}</small></span>
    </div>
  </div>;
}
