import type { BuildLink } from "@guardian-nexus/contracts";
import { ExternalLink, Play, Twitch } from "lucide-react";
import styles from "../../pages/Builds.module.css";

export function BuildLinkActions({ links }: { links: BuildLink[] }) {
  return <>{links.map((link) => <a className={styles.buildServiceLink} href={link.url} target="_blank" rel="noreferrer" key={`${link.kind}-${link.url}`} aria-label={`Open ${link.label}`}>
    <ServiceIcon kind={link.kind} />
    <span role="tooltip"><strong>{link.label}</strong><small>{serviceName(link.kind)} · opens in a new tab</small></span>
  </a>)}</>;
}

function ServiceIcon({ kind }: { kind: BuildLink["kind"] }) {
  if (kind === "youtube") return <Play fill="currentColor" />;
  if (kind === "twitch") return <Twitch />;
  if (kind === "dim") return <b>DIM</b>;
  if (kind === "mobalytics") return <b>M</b>;
  return <ExternalLink />;
}

function serviceName(kind: BuildLink["kind"]): string {
  if (kind === "dim") return "Destiny Item Manager";
  if (kind === "mobalytics") return "Mobalytics";
  if (kind === "youtube") return "YouTube";
  if (kind === "twitch") return "Twitch";
  return "External resource";
}
