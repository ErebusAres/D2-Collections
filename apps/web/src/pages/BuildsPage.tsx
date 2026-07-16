import type { BuildVoteResult, BuildsData } from "@guardian-nexus/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CirclePlus, Filter, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BuildCard } from "../components/builds/BuildCard";
import { PageHeader, QueryState } from "../components/common/Page";
import { defaultBuildFilters, filterBuilds, titleCase, type BuildFilters } from "../modules/builds/builds";
import { api } from "../services/api/client";
import styles from "./Builds.module.css";

export function BuildsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<BuildFilters>(defaultBuildFilters);
  const result = useQuery({ queryKey: ["builds"], queryFn: () => api<BuildsData>("/api/v1/builds") });
  const builds = result.data?.data.builds || [];
  const filtered = useMemo(() => filterBuilds(builds, filters), [builds, filters]);
  const activities = useMemo(() => unique(builds.flatMap((build) => build.activityTags)), [builds]);
  const authors = useMemo(() => unique(builds.flatMap((build) => [build.authorDisplayName, build.originalCreatorName || ""])), [builds]);
  const tags = useMemo(() => unique(builds.flatMap((build) => build.tags)), [builds]);
  const exoticArmor = useMemo(() => unique(builds.flatMap((build) => build.equipment.armor.filter((entry) => entry.exotic).map((entry) => entry.name))), [builds]);
  const exoticWeapons = useMemo(() => unique(builds.flatMap((build) => build.equipment.weapons.filter((entry) => entry.exotic).map((entry) => entry.name))), [builds]);
  const artifacts = useMemo(() => unique(builds.flatMap((build) => build.artifacts.map((entry) => entry.name))), [builds]);
  const update = <K extends keyof BuildFilters>(key: K, value: BuildFilters[K]) => setFilters((current) => ({ ...current, [key]: value }));
  const ratingChanged = (_result: BuildVoteResult) => void queryClient.invalidateQueries({ queryKey: ["builds"] });

  return <>
    <PageHeader eyebrow="Guardian-authored combat library" title="Builds" description="Browse compact, field-tested Destiny 2 configurations from the Guardian Nexus team. Published builds are available to everyone; authoring remains restricted to the approved roster." actions={result.data?.data.canCreate && <Link className={styles.primaryAction} to="/builds/new"><CirclePlus /> Create build</Link>} />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(result.data)} onRetry={() => void result.refetch()} />
    {result.data && <>
      <section className={styles.buildCommandBar}>
        <label className={styles.buildSearch}><Search /><input value={filters.search} onChange={(event) => update("search", event.target.value)} placeholder="Search titles, tags, creators, gear, notes, or Artifact perks…" /></label>
        <label><span>Class</span><select value={filters.classType} onChange={(event) => update("classType", event.target.value as BuildFilters["classType"])}><option value="all">All classes</option>{["hunter", "titan", "warlock"].map((entry) => <option key={entry} value={entry}>{titleCase(entry)}</option>)}</select></label>
        <label><span>Subclass</span><select value={filters.subclass} onChange={(event) => update("subclass", event.target.value as BuildFilters["subclass"])}><option value="all">All subclasses</option>{["prismatic", "arc", "solar", "void", "strand", "stasis"].map((entry) => <option key={entry} value={entry}>{titleCase(entry)}</option>)}</select></label>
        <label><span>Activity</span><select value={filters.activity} onChange={(event) => update("activity", event.target.value)}><option value="all">All activities</option>{activities.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
        <label><span>Creator</span><select value={filters.author} onChange={(event) => update("author", event.target.value)}><option value="all">All creators</option>{authors.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
        <label><span>Tag</span><select value={filters.tag} onChange={(event) => update("tag", event.target.value)}><option value="all">All tags</option>{tags.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
        <label><span>Exotic armor</span><select value={filters.exoticArmor} onChange={(event) => update("exoticArmor", event.target.value)}><option value="all">Any armor</option>{exoticArmor.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
        <label><span>Exotic weapon</span><select value={filters.exoticWeapon} onChange={(event) => update("exoticWeapon", event.target.value)}><option value="all">Any weapon</option>{exoticWeapons.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
        <label><span>Artifact</span><select value={filters.artifact} onChange={(event) => update("artifact", event.target.value)}><option value="all">Any Artifact</option>{artifacts.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
        <label><span>Includes</span><select value={filters.feature} onChange={(event) => update("feature", event.target.value as BuildFilters["feature"])}><option value="all">Any content</option><option value="dim">DIM link</option><option value="video">Video link</option><option value="notes">Build notes</option></select></label>
        <label><span>Sort</span><select value={filters.sort} onChange={(event) => update("sort", event.target.value as BuildFilters["sort"])}><option value="updated">Recently updated</option><option value="newest">Newest</option><option value="top">Top rated</option><option value="most-voted">Most voted</option></select></label>
        <strong><Filter /> {filtered.length} / {builds.length}</strong>
      </section>
      {filtered.length ? <section className={styles.buildGrid}>{filtered.map((build) => <BuildCard key={build.id} build={build} onRatingChange={ratingChanged} />)}</section>
        : <section className={styles.emptyBuilds}><Sparkles /><h2>{builds.length ? "No builds match these filters" : "The Builds library is ready"}</h2><p>{builds.length ? "Clear or adjust the current filters to reveal more configurations." : result.data.data.canCreate ? "Create the first real Guardian Nexus build. No sample or fabricated build data has been inserted." : "The approved editors have not published a build yet. Check back after their first field guide is ready."}</p>{builds.length > 0 && <button type="button" onClick={() => setFilters(defaultBuildFilters)}>Clear filters</button>}</section>}
    </>}
  </>;
}

function unique(values: string[]): string[] { return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
