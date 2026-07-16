import type { BuildNamedEntry } from "@guardian-nexus/contracts";
import type { ReactNode } from "react";
import { BuildIconTooltip } from "./BuildIconTooltip";
import styles from "../../pages/Builds.module.css";

const TOKEN = /\[\[d2:([^:\]]+):([^:\]]+):([^\]]+)\]\]/g;

export function destinyNoteToken(entry: BuildNamedEntry): string {
  if (!entry.icon) return entry.name;
  return `[[d2:${entry.hash || "icon"}:${encodeURIComponent(entry.name)}:${encodeURIComponent(entry.icon)}]]`;
}

export function BuildRichNotes({ value }: { value: string }) {
  return <div className={styles.richNotes}>{value.split("\n").map((line, index) => {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) return <h3 key={index}>{inlineNotes(heading[2] || "")}</h3>;
    if (/^[-*]\s+/.test(line)) return <p className={styles.noteListItem} key={index}>• {inlineNotes(line.replace(/^[-*]\s+/, ""))}</p>;
    if (/^\d+\.\s+/.test(line)) return <p className={styles.noteListItem} key={index}>{inlineNotes(line)}</p>;
    return line ? <p key={index}>{inlineNotes(line)}</p> : <br key={index} />;
  })}</div>;
}

function inlineNotes(value: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of value.matchAll(TOKEN)) {
    if (match.index! > cursor) nodes.push(...formatText(value.slice(cursor, match.index), nodes.length));
    try {
      const entry = { hash: match[1], name: decodeURIComponent(match[2] || "Destiny icon"), icon: decodeURIComponent(match[3] || "") };
      nodes.push(<BuildIconTooltip key={`icon-${match.index}`} entry={entry} label="Destiny reference" />);
    } catch {
      nodes.push(match[0]);
    }
    cursor = match.index! + match[0].length;
  }
  if (cursor < value.length) nodes.push(...formatText(value.slice(cursor), nodes.length));
  return nodes;
}

function formatText(value: string, offset: number): ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part, index) => part.startsWith("**") && part.endsWith("**")
    ? <strong key={`${offset}-${index}`}>{part.slice(2, -2)}</strong>
    : part.startsWith("`") && part.endsWith("`") ? <code key={`${offset}-${index}`}>{part.slice(1, -1)}</code> : part);
}
