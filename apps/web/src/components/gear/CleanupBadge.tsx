import { Trash2 } from "lucide-react";
import styles from "./CleanupBadge.module.css";
export function CleanupBadge({ value }: { value?: { reason: string; confidence: number } }) {
  return value ? <span className={styles.junk} title={`Recommended junk · ${value.confidence}% rules-based confidence · ${value.reason}`} aria-label="Recommended junk"><Trash2 size={15} /></span> : null;
}
