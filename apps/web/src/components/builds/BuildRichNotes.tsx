import type { BuildNamedEntry } from "@guardian-nexus/contracts";
import type { ReactNode } from "react";
import { useBuildCatalog } from "../../modules/builds/buildCatalog";
import { BuildIconTooltip } from "./BuildIconTooltip";
import styles from "../../pages/Builds.module.css";

const TOKEN = /\[\[d2:([^:\]]+):([^:\]]+):([^\]]+)\]\]/g;
const ALIAS_NAMES: Record<string, string> = { arc: "Arc", solar: "Solar", void: "Void", strand: "Strand", stasis: "Stasis", kinetic: "Kinetic", super: "Super", power: "Power Weapons", overload: "Overload Champion", barrier: "Barrier Champion", unstoppable: "Unstoppable Champion" };

export function destinyNoteToken(entry: BuildNamedEntry): string {
  if (!entry.icon) return entry.name;
  return `[[d2:${entry.hash || "icon"}:${encodeURIComponent(entry.name)}:${encodeURIComponent(entry.icon)}]]`;
}

export function BuildRichNotes({ value }: { value: string }) {
  return <div className={styles.richNotes}>{value.split("\n").map((line, index) => {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading?.[1]?.length === 1) return <h2 key={index}>{inlineNotes(heading[2] || "")}</h2>;
    if (heading?.[1]?.length === 2) return <h3 key={index}>{inlineNotes(heading[2] || "")}</h3>;
    if (heading) return <h4 key={index}>{inlineNotes(heading[2] || "")}</h4>;
    if (/^>\s+/.test(line)) return <blockquote key={index}>{inlineNotes(line.replace(/^>\s+/, ""))}</blockquote>;
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
  const pattern = /(:(?:arc|solar|void|strand|stasis|kinetic|super|power|overload|barrier|unstoppable):|\*\*[^*]+\*\*|~~[^~]+~~|__[^_]+__|\*[^*]+\*|`[^`]+`|\[b\][\s\S]*?\[\/b\]|\[i\][\s\S]*?\[\/i\]|\[u\][\s\S]*?\[\/u\]|\[s\][\s\S]*?\[\/s\]|\[size=(?:small|large|x-large)\][\s\S]*?\[\/size\]|\[font=(?:barlow|condensed|mono)\][\s\S]*?\[\/font\]|\[url=https:\/\/[^\]]+\][\s\S]*?\[\/url\])/gi;
  return value.split(pattern).filter(Boolean).map((part, index) => {
    const key = `${offset}-${index}`;
    const alias = part.match(/^:(arc|solar|void|strand|stasis|kinetic|super|power|overload|barrier|unstoppable):$/i)?.[1];
    if (alias) return <DestinyEmojiAlias key={key} alias={alias.toLocaleLowerCase()} />;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("~~") && part.endsWith("~~")) return <s key={key}>{part.slice(2, -2)}</s>;
    if (part.startsWith("__") && part.endsWith("__")) return <u key={key}>{part.slice(2, -2)}</u>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={key}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={key}>{part.slice(1, -1)}</code>;
    for (const [tag, Element] of [["b", "strong"], ["i", "em"], ["u", "u"], ["s", "s"]] as const) {
      if (part.toLocaleLowerCase().startsWith(`[${tag}]`) && part.toLocaleLowerCase().endsWith(`[/${tag}]`)) {
        const content = part.slice(tag.length + 2, -(tag.length + 3));
        return <Element key={key}>{formatText(content, index * 100)}</Element>;
      }
    }
    const size = part.match(/^\[size=(small|large|x-large)\]([\s\S]*)\[\/size\]$/i);
    if (size) return <span key={key} className={styles[`noteSize${size[1] === "x-large" ? "XLarge" : capitalize(size[1] || "")}`]}>{formatText(size[2] || "", index * 100)}</span>;
    const font = part.match(/^\[font=(barlow|condensed|mono)\]([\s\S]*)\[\/font\]$/i);
    if (font) return <span key={key} className={styles[`noteFont${capitalize(font[1] || "")}`]}>{formatText(font[2] || "", index * 100)}</span>;
    const link = part.match(/^\[url=(https:\/\/[^\]]+)\]([\s\S]*)\[\/url\]$/i);
    if (link) return <a key={key} href={link[1]!} target="_blank" rel="noreferrer">{formatText(link[2] || link[1]!, index * 100)}</a>;
    return part;
  });
}

function DestinyEmojiAlias({ alias }: { alias: string }) {
  const result = useBuildCatalog({ kind: "noteIcon", query: ALIAS_NAMES[alias] || alias, enabled: true });
  const expected = (ALIAS_NAMES[alias] || alias).toLocaleLowerCase();
  const entry = result.data?.data.results.find((value) => value.name.toLocaleLowerCase() === expected);
  return entry ? <span className={styles.destinyEmoji} data-alias={alias}><BuildIconTooltip entry={entry} label={`:${alias}:`} /></span> : <span>{`:${alias}:`}</span>;
}

function capitalize(value: string): string { return value ? value[0]!.toUpperCase() + value.slice(1) : value; }
