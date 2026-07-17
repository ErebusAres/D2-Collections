import type { BuildRating as BuildRatingData, BuildVoteResult, BuildVoteValue } from "@guardian-nexus/contracts";
import { useMutation } from "@tanstack/react-query";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useGuardian } from "../../context/GuardianContext";
import { api, mutationHeaders } from "../../services/api/client";
import styles from "../../pages/Builds.module.css";

export function BuildRating({ buildId, rating, viewerVote, compact = false, disabled = false, onChange }: { buildId: string; rating: BuildRatingData; viewerVote?: BuildVoteValue; compact?: boolean; disabled?: boolean; onChange?: (result: BuildVoteResult) => void }) {
  const { session, signIn } = useGuardian();
  const [latest, setLatest] = useState<BuildVoteResult>();
  useEffect(() => { setLatest(undefined); }, [rating.upvotes, rating.downvotes, viewerVote]);
  const vote = useMutation({
    mutationFn: (value: BuildVoteValue | null) => api<BuildVoteResult>(`/api/v1/builds/${encodeURIComponent(buildId)}/vote`, { method: "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ vote: value }) }),
    onSuccess: (result) => { setLatest(result.data); onChange?.(result.data); }
  });
  const shownRating = latest?.rating ?? rating;
  const shownVote = latest ? latest.viewerVote ?? undefined : viewerVote;
  const tone = shownRating.total < 3 ? "neutral" : (shownRating.percentPositive || 0) >= 70 ? "positive" : (shownRating.percentPositive || 0) < 45 ? "negative" : "mixed";
  const cast = (value: BuildVoteValue) => {
    if (disabled) return;
    if (session?.authenticated) vote.mutate(nextBuildVote(shownVote, value)); else signIn();
  };
  return <div className={`${styles.rating} ${compact ? styles.compactRating : ""}`} data-tone={tone} aria-label={`${shownRating.upvotes} upvotes, ${shownRating.downvotes} downvotes`}>
    <button type="button" aria-pressed={shownVote === "up"} className={shownVote === "up" ? styles.selectedVote : ""} disabled={vote.isPending || disabled} onClick={() => cast("up")} title={voteTitle("up", shownVote, Boolean(session?.authenticated), disabled)}><ThumbsUp /><span>{shownRating.upvotes}</span></button>
    <strong>{shownRating.total ? `${shownRating.percentPositive}%` : "New"}</strong>
    <button type="button" aria-pressed={shownVote === "down"} className={shownVote === "down" ? styles.selectedVote : ""} disabled={vote.isPending || disabled} onClick={() => cast("down")} title={voteTitle("down", shownVote, Boolean(session?.authenticated), disabled)}><ThumbsDown /><span>{shownRating.downvotes}</span></button>
  </div>;
}

export function nextBuildVote(current: BuildVoteValue | undefined, selected: BuildVoteValue): BuildVoteValue | null {
  return current === selected ? null : selected;
}

function voteTitle(selected: BuildVoteValue, current: BuildVoteValue | undefined, authenticated: boolean, disabled: boolean): string {
  if (disabled) return "Publish this draft before voting.";
  if (!authenticated) return "Sign in to vote";
  if (current === selected) return selected === "up" ? "Remove your upvote" : "Remove your downvote";
  return selected === "up" ? "Upvote this build" : "Downvote this build";
}
