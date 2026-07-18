import type { BuildLink } from "@guardian-nexus/contracts";
import { Globe2 } from "lucide-react";
import { useState } from "react";
import styles from "../../pages/Builds.module.css";

const SERVICE_ICONS: Partial<Record<BuildLink["kind"], string>> = {
  youtube: "/icons/services/youtube.ico",
  twitch: "/icons/services/twitch.ico",
  dim: "/icons/services/dim.ico",
  mobalytics: "/icons/services/mobalytics.ico",
};

export function BuildLinkActions({ links }: { links: BuildLink[] }) {
  return <>{links.map((link) => <a className={styles.buildServiceLink} href={link.url} target="_blank" rel="noreferrer" key={`${link.kind}-${link.url}`} aria-label={`Open ${link.label}`}>
    <BuildServiceIcon link={link} />
    <span role="tooltip"><strong>{link.label}</strong><small>{serviceName(link.kind)} · opens in a new tab</small></span>
  </a>)}</>;
}

export function BuildServiceIcon({ link }: { link: BuildLink }) {
  const [failed, setFailed] = useState(false);
  const source = serviceIconSource(link);
  return source && !failed
    ? <img className={styles.buildServiceIconImage} src={source} alt="" aria-hidden="true" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    : <Globe2 aria-hidden="true" />;
}

export function serviceIconSource(link: BuildLink): string | undefined {
  if (SERVICE_ICONS[link.kind]) return SERVICE_ICONS[link.kind];
  try {
    const url = new URL(link.url);
    return ["http:", "https:"].includes(url.protocol) ? `${url.origin}/favicon.ico` : undefined;
  } catch {
    return undefined;
  }
}

function serviceName(kind: BuildLink["kind"]): string {
  if (kind === "dim") return "Destiny Item Manager";
  if (kind === "mobalytics") return "Mobalytics";
  if (kind === "youtube") return "YouTube";
  if (kind === "twitch") return "Twitch";
  return "External resource";
}
