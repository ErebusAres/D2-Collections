import { Boxes, ChevronRight, ShieldEllipsis, Sparkles, Wrench } from "lucide-react";
import { AuthGate, PageHeader } from "../components/Page";
import styles from "./Pages.module.css";

export function GearPage() {
  return <AuthGate><PageHeader eyebrow="Future integration" title="Gear" description="A dedicated Guardian equipment workspace will arrive in a later release through the new shared character contracts." />
    <section className={styles.gearHero}><div className={styles.gearSigil}><ShieldEllipsis /></div><span>Development queue</span><h2>Loadout intelligence is next</h2><p>The v1 boundary is already prepared for a future D2AA integration, but no archived or D2AA implementation has been copied into Guardian Nexus.</p><div><article><Boxes /><span>Inventory model</span><strong>Contract ready</strong></article><article><Sparkles /><span>Armor analysis</span><strong>Planned</strong></article><article><Wrench /><span>Build tools</span><strong>Planned</strong></article></div><button disabled>Coming in a later phase <ChevronRight /></button></section>
  </AuthGate>;
}
