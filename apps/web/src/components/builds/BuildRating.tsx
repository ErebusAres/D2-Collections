import type { BuildRating as BuildRatingData, BuildVoteResult, BuildVoteValue } from "@guardian-nexus/contracts";
import { useMutation } from "@tanstack/react-query";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useGuardian } from "../../context/GuardianContext";
import { api, mutationHeaders } from "../../services/api/client";
import styles from "../../pages/Builds.module.css";

export function BuildRating({ buildId, rating, viewerVote, compact = false, onChange }: { buildId: string; rating: BuildRatingData; viewerVote?: BuildVoteValue; compact?: boolean; onChange?: (result: BuildVoteResult) => void }) {
  const { session, signIn } = useGuardian();
  const vote = useMutation({
    mutationFn: (value: BuildVoteValue) => api<BuildVoteResult>(`/api/v1/builds/${encodeURIComponent(buildId)}/vote`, { method: "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ vote: value }) }),
    onSuccess: (result) => onChange?.(result.data)
  });
  const tone = rating.total < 3 ? "neutral" : (rating.percentPositive || 0) >= 70 ? "positive" : (rating.percentPositive || 0) < 45 ? "negative" : "mixed";
  const cast = (value: BuildVoteValue) => session?.authenticated ? vote.mutate(value) : signIn();
  return <div className={`${styles.rating} ${compact ? styles.compactRating : ""}`} data-tone={tone} aria-label={`${rating.upvotes} upvotes, ${rating.downvotes} downvotes`}>
    <button type="button" className={viewerVote === "up" ? styles.selectedVote : ""} disabled={vote.isPending} onClick={() => cast("up")} title={session?.authenticated ? "Upvote this build" : "Sign in to vote"}><ThumbsUp /><span>{rating.upvotes}</span></button>
    <strong>{rating.total ? `${rating.percentPositive}%` : "New"}</strong>
    <button type="button" className={viewerVote === "down" ? styles.selectedVote : ""} disabled={vote.isPending} onClick={() => cast("down")} title={session?.authenticated ? "Downvote this build" : "Sign in to vote"}><ThumbsDown /><span>{rating.downvotes}</span></button>
  </div>;
}
