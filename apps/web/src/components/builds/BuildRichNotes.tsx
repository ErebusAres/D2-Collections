import type { BuildGuardianClass, BuildNamedEntry } from "@guardian-nexus/contracts";
import type { ReactNode } from "react";
import { destinySymbol } from "../../modules/builds/destinySymbols";
import styles from "../../pages/Builds.module.css";
import { BuildIconTooltip } from "./BuildIconTooltip";

const TOKEN = /\[\[d2:([^:\]]+):([^:\]]+):([^\]]+)\]\]/g;

export function destinyNoteToken(entry: BuildNamedEntry): string {
  if (!entry.icon) return entry.name;
  return `[[d2:${entry.hash || "icon"}:${encodeURIComponent(entry.name)}:${encodeURIComponent(entry.icon)}]]`;
}

export function BuildRichNotes({ value, classType = "titan" }: { value: string; classType?: BuildGuardianClass }) {
  return <div className={styles.richNotes}>{value.split("\n").map((line, index) => {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading?.[1]?.length === 1) return <h2 key={index}>{inlineNotes(heading[2] || "", classType)}</h2>;
    if (heading?.[1]?.length === 2) return <h3 key={index}>{inlineNotes(heading[2] || "", classType)}</h3>;
    if (heading) return <h4 key={index}>{inlineNotes(heading[2] || "", classType)}</h4>;
    if (/^>\s+/.test(line)) return <blockquote key={index}>{inlineNotes(line.replace(/^>\s+/, ""), classType)}</blockquote>;
    if (/^[-*]\s+/.test(line)) return <p className={styles.noteListItem} key={index}>• {inlineNotes(line.replace(/^[-*]\s+/, ""), classType)}</p>;
    if (/^\d+\.\s+/.test(line)) return <p className={styles.noteListItem} key={index}>{inlineNotes(line, classType)}</p>;
    return line ? <p key={index}>{inlineNotes(line, classType)}</p> : <br key={index} />;
  })}</div>;
}

function inlineNotes(value: string, classType: BuildGuardianClass): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of value.matchAll(TOKEN)) {
    if (match.index! > cursor) nodes.push(...formatText(value.slice(cursor, match.index), nodes.length, classType));
    try {
      const entry = { hash: match[1], name: decodeURIComponent(match[2] || "Destiny icon"), icon: decodeURIComponent(match[3] || "") };
      nodes.push(<BuildIconTooltip key={`icon-${match.index}`} entry={entry} label="Destiny reference" />);
    } catch {
      nodes.push(match[0]);
    }
    cursor = match.index! + match[0].length;
  }
  if (cursor < value.length) nodes.push(...formatText(value.slice(cursor), nodes.length, classType));
  return nodes;
}

function formatText(value: string, offset: number, classType: BuildGuardianClass): ReactNode[] {
  const pattern = /(:[a-z][a-z0-9-]*:|\*\*[^*]+\*\*|~~[^~]+~~|__[^_]+__|\*[^*]+\*|`[^`]+`|\[b\][\s\S]*?\[\/b\]|\[i\][\s\S]*?\[\/i\]|\[u\][\s\S]*?\[\/u\]|\[s\][\s\S]*?\[\/s\]|\[size=(?:small|large|x-large)\][\s\S]*?\[\/size\]|\[font=(?:barlow|condensed|mono)\][\s\S]*?\[\/font\]|\[url=https:\/\/[^\]]+\][\s\S]*?\[\/url\])/gi;
  return value.split(pattern).filter(Boolean).map((part, index) => {
    const key = `${offset}-${index}`;
    const alias = part.match(/^:([a-z][a-z0-9-]*):$/i)?.[1]?.toLocaleLowerCase();
    if (alias && destinySymbol(alias, classType)) return <DestinyEmojiAlias key={key} alias={alias} classType={classType} />;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("~~") && part.endsWith("~~")) return <s key={key}>{part.slice(2, -2)}</s>;
    if (part.startsWith("__") && part.endsWith("__")) return <u key={key}>{part.slice(2, -2)}</u>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={key}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={key}>{part.slice(1, -1)}</code>;
    for (const [tag, Element] of [["b", "strong"], ["i", "em"], ["u", "u"], ["s", "s"]] as const) {
      if (part.toLocaleLowerCase().startsWith(`[${tag}]`) && part.toLocaleLowerCase().endsWith(`[/${tag}]`)) {
        const content = part.slice(tag.length + 2, -(tag.length + 3));
        return <Element key={key}>{formatText(content, index * 100, classType)}</Element>;
      }
    }
    const size = part.match(/^\[size=(small|large|x-large)\]([\s\S]*)\[\/size\]$/i);
    if (size) return <span key={key} className={styles[`noteSize${size[1] === "x-large" ? "XLarge" : capitalize(size[1] || "")}`]}>{formatText(size[2] || "", index * 100, classType)}</span>;
    const font = part.match(/^\[font=(barlow|condensed|mono)\]([\s\S]*)\[\/font\]$/i);
    if (font) return <span key={key} className={styles[`noteFont${capitalize(font[1] || "")}`]}>{formatText(font[2] || "", index * 100, classType)}</span>;
    const link = part.match(/^\[url=(https:\/\/[^\]]+)\]([\s\S]*)\[\/url\]$/i);
    if (link) return <a key={key} href={link[1]!} target="_blank" rel="noreferrer">{formatText(link[2] || link[1]!, index * 100, classType)}</a>;
    return part;
  });
}

function DestinyEmojiAlias({ alias, classType }: { alias: string; classType: BuildGuardianClass }) {
  const entry = destinySymbol(alias, classType);
  return entry ? <span className={styles.destinyEmoji} data-alias={alias}><BuildIconTooltip entry={entry} label={`:${alias}:`} /></span> : <span>{`:${alias}:`}</span>;
}

function capitalize(value: string): string { return value ? value[0]!.toUpperCase() + value.slice(1) : value; }
