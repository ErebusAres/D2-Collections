import type { BuildData, BuildVoteResult } from "@guardian-nexus/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardCopy, FilePenLine, LayoutGrid, Link as LinkIcon, ListTree, Share2 } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BuildDetailSections, buildDetailNavigation } from "../components/builds/BuildDetailSections";
import { BuildCompactView } from "../components/builds/BuildCompactView";
import { BuildLinkActions } from "../components/builds/BuildLinkActions";
import { ClassIcon, SubclassIcon } from "../components/builds/BuildIcon";
import { BuildRating } from "../components/builds/BuildRating";
import { PageHeader, QueryState } from "../components/common/Page";
import { buildDiscordSummary, titleCase } from "../modules/builds/builds";
import { api } from "../services/api/client";
import { useGuardian } from "../context/GuardianContext";
import { useBuildArmorTraits } from "../modules/builds/buildCatalog";
import styles from "./Builds.module.css";

export function BuildDetailPage() {
  const { buildId = "" } = useParams();
  const queryClient = useQueryClient();
  const { preferences, setPreference } = useGuardian();
  const [copied, setCopied] = useState("");
  const result = useQuery({ queryKey: ["build", buildId], queryFn: () => api<BuildData>(`/api/v1/builds/${encodeURIComponent(buildId)}`), enabled: Boolean(buildId) });
  const build = result.data?.data.build;
  const resolvedBuild = useBuildArmorTraits(build);
  const dimLink = build?.links.find((link) => link.kind === "dim");
  const savedLayout = preferences["build.detail.layout"];
  const layout = savedLayout === "detailed" ? "detailed" : "compact";
  const copy = async (label: string, text: string) => { await navigator.clipboard.writeText(text); setCopied(label); window.setTimeout(() => setCopied(""), 1_800); };
  const ratingChanged = (_vote: BuildVoteResult) => { void queryClient.invalidateQueries({ queryKey: ["build", buildId] }); void queryClient.invalidateQueries({ queryKey: ["builds"] }); };
  return <>
    {!build && <PageHeader eyebrow="Guardian build" title="Build details" description="Loading the selected Guardian Nexus field guide." />}
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(build)} onRetry={() => void result.refetch()} />
    {build && <>
      <PageHeader eyebrow={`${titleCase(build.classType)} · ${titleCase(build.subclass)}`} title={build.title} description={build.summary || "No short summary has been added."} actions={<div className={styles.buildTitleActions}><BuildLinkActions links={build.links} />{dimLink && <button className={styles.buildUtilityAction} onClick={() => void copy("dim", dimLink.url)} aria-label="Copy DIM link">{copied === "dim" ? <Check /> : <ClipboardCopy />}<span role="tooltip">{copied === "dim" ? "DIM link copied" : "Copy DIM link"}</span></button>}<button className={styles.buildUtilityAction} onClick={() => void copy("link", window.location.href)} aria-label="Copy build link">{copied === "link" ? <Check /> : <Share2 />}<span role="tooltip">{copied === "link" ? "Link copied" : "Copy build link"}</span></button><button className={styles.buildUtilityAction} onClick={() => void copy("discord", buildDiscordSummary(build))} aria-label="Copy Discord summary">{copied === "discord" ? <Check /> : <ClipboardCopy />}<span role="tooltip">{copied === "discord" ? "Discord summary copied" : "Copy for Discord"}</span></button>{build.canEdit && <Link className={styles.buildUtilityAction} to={`/builds/${build.slug}/edit`} aria-label="Edit build"><FilePenLine /><span role="tooltip">Edit build</span></Link>}</div>} />
      <section className={styles.buildHero}>
        <SubclassIcon subclass={build.subclass} icon={build.subclassIcon} large />
        <div><span><ClassIcon classType={build.classType} icon={build.classIcon} /> {titleCase(build.classType)} · {titleCase(build.subclass)}</span><div>{build.tags.map((tag) => <b key={tag}>#{tag}</b>)}{build.activityTags.map((tag) => <em key={tag}>{tag}</em>)}</div><p>Authored by <strong>{build.authorDisplayName}</strong>{build.originalCreatorName && <> · original build by <strong>{build.originalCreatorName}</strong></>}</p><small>Updated {new Date(build.updatedAt).toLocaleString()}{build.patch && ` · ${build.patch}`}{build.outdated && " · Marked outdated"}</small></div>
        <BuildRating buildId={build.id} rating={build.rating} viewerVote={build.viewerVote} disabled={build.status !== "published"} onChange={ratingChanged} />
      </section>
      <div className={styles.buildLayoutToggle} role="group" aria-label="Build presentation"><button type="button" data-active={layout === "compact"} onClick={() => setPreference("build.detail.layout", "compact")}><LayoutGrid /> Standard <span>complete build at a glance</span></button><button type="button" data-active={layout === "detailed"} onClick={() => setPreference("build.detail.layout", "detailed")}><ListTree /> Full breakdown <span>expanded sections</span></button></div>
      {layout === "compact" && <BuildCompactView build={resolvedBuild || build} />}
      {layout === "detailed" && <><nav className={styles.detailNav} aria-label="Build sections">{buildDetailNavigation(resolvedBuild || build).map(({ id, label }) => <a key={id} href={`#${id}`}><LinkIcon /> {label}</a>)}</nav><BuildDetailSections build={resolvedBuild || build} /></>}
    </>}
  </>;
}
