import type { BuildVoteResult, GuardianBuild } from "@guardian-nexus/contracts";
import { CalendarClock, ExternalLink, FilePenLine, Play, Swords } from "lucide-react";
import { Link } from "react-router-dom";
import { titleCase } from "../../modules/builds/builds";
import { BuildRating } from "./BuildRating";
import { ClassIcon, SubclassIcon } from "./BuildIcon";
import styles from "../../pages/Builds.module.css";

export function BuildCard({ build, onRatingChange }: { build: GuardianBuild; onRatingChange: (result: BuildVoteResult) => void }) {
  const exotic = build.equipment.armor.find((item) => item.exotic) || build.equipment.armor.find((item) => /exotic/i.test(item.slot));
  const weapons = build.equipment.weapons.slice(0, 3);
  const quickLinks = build.links.filter((link) => ["dim", "mobalytics", "youtube", "twitch"].includes(link.kind)).slice(0, 3);
  return <article className={styles.buildCard} data-status={build.status}>
    <header><SubclassIcon subclass={build.subclass} icon={build.subclassIcon} /><div><span><ClassIcon classType={build.classType} /> {titleCase(build.classType)} · {titleCase(build.subclass)}</span><Link to={`/builds/${build.slug}`}><h2>{build.title}</h2></Link></div>{build.status !== "published" && <em>{build.status.replace("_", " ")}</em>}</header>
    <div className={styles.cardTags}>{build.activityTags.map((tag) => <b key={`activity-${tag}`}>{tag}</b>)}{build.tags.slice(0, 5).map((tag) => <span key={tag}>#{tag}</span>)}</div>
    <p>{build.summary || "No summary has been added to this build yet."}</p>
    <section className={styles.cardGear}>
      {exotic && <div><Swords /><span><small>Key armor</small><strong>{exotic.name}</strong></span></div>}
      {weapons.length > 0 && <div><Swords /><span><small>Weapons</small><strong>{weapons.map((item) => item.name).join(" · ")}</strong></span></div>}
    </section>
    <footer>
      <div><span>By {build.authorDisplayName}</span>{build.originalCreatorName && <small>Source: {build.originalCreatorName}</small>}<time><CalendarClock /> {new Date(build.updatedAt).toLocaleDateString()}</time></div>
      <nav>{quickLinks.map((link) => <a key={`${link.kind}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" title={link.label}>{link.kind === "youtube" || link.kind === "twitch" ? <Play /> : <ExternalLink />}<span>{link.label}</span></a>)}{build.canEdit && <Link to={`/builds/${build.slug}/edit`} title="Edit build"><FilePenLine /><span>Edit</span></Link>}</nav>
      <BuildRating buildId={build.id} rating={build.rating} viewerVote={build.viewerVote} compact disabled={build.status !== "published"} onChange={onRatingChange} />
    </footer>
  </article>;
}
