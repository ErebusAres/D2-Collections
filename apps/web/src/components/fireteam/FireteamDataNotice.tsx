import { AlertTriangle } from "lucide-react";
import styles from "../../styles/fireteam/FireteamComponents.module.css";

export const FIRETEAM_BUNGIE_DATA_NOTICE = "Fireteam membership and activity come from Bungie and may take a few minutes to catch up.";

export function FireteamDataNotice() {
  return <footer className={styles.dataNotice}>
    <AlertTriangle />
    <span>{FIRETEAM_BUNGIE_DATA_NOTICE}</span>
  </footer>;
}
