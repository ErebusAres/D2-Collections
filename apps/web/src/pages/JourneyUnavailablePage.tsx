import { Crown, ScrollText } from "lucide-react";
import { AuthGate, PageHeader } from "../components/common/Page";
import { JourneyNav } from "../components/journey/JourneyNav";
import styles from "./JourneyTrackers.module.css";

export function JourneyUnavailablePage({ kind }: { kind: "titles" | "triumphs" }) {
  const titles = kind === "titles";
  const Icon = titles ? Crown : ScrollText;
  return <AuthGate>
    <PageHeader eyebrow="Journey · Long-term progression" title={titles ? "Titles & Seals" : "Triumphs"} description={titles ? "Seal completion and equipped-title tracking." : "Triumph score, tracked records, and near-complete objectives."} />
    <JourneyNav />
    <section className={styles.unavailable}>
      <Icon />
      <span>Tracker foundation ready</span>
      <h2>Live {titles ? "Title and Seal" : "Triumph"} data is not connected yet</h2>
      <p>Guardian Nexus does not currently normalize Bungie's full record catalog for this progression system. No score or completion count is being guessed.</p>
      <small>The route and dashboard entry are in place so the live tracker can be added without changing the Journey layout.</small>
    </section>
  </AuthGate>;
}
