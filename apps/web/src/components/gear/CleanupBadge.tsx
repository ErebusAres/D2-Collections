import { Trash2 } from "lucide-react";
export function CleanupBadge({ value }: { value?: { reason: string; confidence: number } }) {
  return value ? <span title={`Recommended dismantle · ${value.confidence}% rules-based confidence · ${value.reason}`} aria-label="Recommended dismantle"><Trash2 size={15} /></span> : null;
}
