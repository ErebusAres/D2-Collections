import type { ReactNode } from "react";
import { destinySymbol } from "../../modules/builds/destinySymbols";
import styles from "./ObjectiveRequirementText.module.css";

const TOKEN_PATTERN = /\[\s*([^\]]+?)\s*\]/g;
const LOCAL_ICON_ROOT = "/icons/destiny/objectives/";

const OBJECTIVE_ICONS: Record<string, string> = {
  "auto rifle": `${LOCAL_ICON_ROOT}auto_rifle.svg`, bow: `${LOCAL_ICON_ROOT}bow.svg`,
  "fusion rifle": `${LOCAL_ICON_ROOT}fusion_rifle.svg`, glaive: `${LOCAL_ICON_ROOT}glaive.svg`,
  "grapple melee": `${LOCAL_ICON_ROOT}melee.svg`, grenade: `${LOCAL_ICON_ROOT}grenade.svg`,
  "grenade launcher": `${LOCAL_ICON_ROOT}grenade_launcher.svg`, "special grenade launcher": `${LOCAL_ICON_ROOT}grenade_launcher.svg`,
  "hand cannon": `${LOCAL_ICON_ROOT}hand_cannon.svg`, headshot: `${LOCAL_ICON_ROOT}headshot.svg`,
  "linear fusion rifle": `${LOCAL_ICON_ROOT}fusion_rifle.svg`, "machine gun": `${LOCAL_ICON_ROOT}machinegun.svg`,
  melee: `${LOCAL_ICON_ROOT}melee.svg`, "pulse rifle": `${LOCAL_ICON_ROOT}pulse_rifle.svg`,
  "rocket launcher": `${LOCAL_ICON_ROOT}rocket_launcher.svg`, "scout rifle": `${LOCAL_ICON_ROOT}scout_rifle.svg`,
  shotgun: `${LOCAL_ICON_ROOT}shotgun.svg`, sidearm: `${LOCAL_ICON_ROOT}sidearm.svg`, smg: `${LOCAL_ICON_ROOT}smg.svg`,
  "sniper rifle": `${LOCAL_ICON_ROOT}sniper_rifle.svg`, sword: `${LOCAL_ICON_ROOT}sword_heavy.svg`,
  "trace rifle": `${LOCAL_ICON_ROOT}trace_rifle.svg`
};

export function ObjectiveRequirementText({ value }: { value: string }) {
  return <>{objectiveRequirementNodes(value)}</>;
}

export function objectiveRequirementNodes(value: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let matched = false;
  for (const match of value.matchAll(TOKEN_PATTERN)) {
    const label = match[1]?.trim() || "";
    const icon = objectiveIcon(label);
    if (!icon) continue;
    matched = true;
    if (match.index! > cursor) nodes.push(value.slice(cursor, match.index));
    nodes.push(<img className={styles.icon} key={`${match.index}-${label}`} src={icon} alt={label} title={label} data-local-icon={icon.startsWith("/")} />);
    cursor = match.index! + match[0].length;
  }
  if (!matched) return [value];
  if (cursor < value.length) nodes.push(value.slice(cursor));
  return nodes;
}

function objectiveIcon(label: string): string | undefined {
  const normalized = label.toLocaleLowerCase().replace(/\s+/g, " ").trim();
  return OBJECTIVE_ICONS[normalized] || destinySymbol(normalized)?.icon;
}
