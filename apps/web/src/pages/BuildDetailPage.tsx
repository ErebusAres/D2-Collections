import type { BuildData, BuildVoteResult } from "@guardian-nexus/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardCopy, ExternalLink, FilePenLine, Link as LinkIcon, Share2 } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BuildDetailSections } from "../components/builds/BuildDetailSections";
import { ClassIcon, SubclassIcon } from "../components/builds/BuildIcon";
import { BuildRating } from "../components/builds/BuildRating";
import { PageHeader, QueryState } from "../components/common/Page";
import { buildDiscordSummary, titleCase } from "../modules/builds/builds";
import { api } from "../services/api/client";
import styles from "./Builds.module.css";

export function BuildDetailPage() {
  const { buildId = "" } = useParams();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState("");
  const result = useQuery({ queryKey: ["build", buildId], queryFn: () => api<BuildData>(`/api/v1/builds/${encodeURIComponent(buildId)}`), enabled: Boolean(buildId) });
  const build = result.data?.data.build;
  const dimLink = build?.links.find((link) => link.kind === "dim");
  const copy = async (label: string, text: string) => { await navigator.clipboard.writeText(text); setCopied(label); window.setTimeout(() => setCopied(""), 1_800); };
  const ratingChanged = (_vote: BuildVoteResult) => { void queryClient.invalidateQueries({ queryKey: ["build", buildId] }); void queryClient.invalidateQueries({ queryKey: ["builds"] }); };
  return <>
    {!build && <PageHeader eyebrow="Guardian build" title="Build details" description="Loading the selected Guardian Nexus field guide." />}
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(build)} onRetry={() => void result.refetch()} />
    {build && <>
      <PageHeader eyebrow={`${titleCase(build.classType)} · ${titleCase(build.subclass)}`} title={build.title} description={build.summary || "No short summary has been added."} actions={<>{dimLink && <><a className={styles.secondaryAction} href={dimLink.url} target="_blank" rel="noreferrer"><ExternalLink /> Open DIM</a><button className={styles.secondaryAction} onClick={() => void copy("dim", dimLink.url)}>{copied === "dim" ? <Check /> : <ClipboardCopy />} {copied === "dim" ? "Copied" : "Copy DIM"}</button></>}<button className={styles.secondaryAction} onClick={() => void copy("link", window.location.href)}>{copied === "link" ? <Check /> : <Share2 />} {copied === "link" ? "Copied" : "Copy link"}</button><button className={styles.secondaryAction} onClick={() => void copy("discord", buildDiscordSummary(build))}>{copied === "discord" ? <Check /> : <ClipboardCopy />} {copied === "discord" ? "Copied" : "Copy for Discord"}</button>{build.canEdit && <Link className={styles.primaryAction} to={`/builds/${build.slug}/edit`}><FilePenLine /> Edit build</Link>}</>} />
      <section className={styles.buildHero}>
        <SubclassIcon subclass={build.subclass} icon={build.subclassIcon} large />
        <div><span><ClassIcon classType={build.classType} icon={build.subclassIcon} /> {titleCase(build.classType)} · {titleCase(build.subclass)}</span><div>{build.tags.map((tag) => <b key={tag}>#{tag}</b>)}{build.activityTags.map((tag) => <em key={tag}>{tag}</em>)}</div><p>Authored by <strong>{build.authorDisplayName}</strong>{build.originalCreatorName && <> · original build by <strong>{build.originalCreatorName}</strong></>}</p><small>Updated {new Date(build.updatedAt).toLocaleString()}{build.patch && ` · ${build.patch}`}{build.outdated && " · Marked outdated"}</small></div>
        <BuildRating buildId={build.id} rating={build.rating} viewerVote={build.viewerVote} disabled={build.status !== "published"} onChange={ratingChanged} />
      </section>
      <nav className={styles.detailNav} aria-label="Build sections">{[["links", "Overview"], ["notes", "Notes"], ["subclass", "Subclass"], ["gear", "Gear"], ["stats", "Stats"], ["mods", "Mods"], ["artifact", "Artifact"], ["loop", "Loop"]].map(([to, label]) => <a key={to} href={`#${to}`}><LinkIcon /> {label}</a>)}</nav>
      <BuildDetailSections build={build} />
    </>}
  </>;
}
