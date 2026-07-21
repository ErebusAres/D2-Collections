import type { PowerData, PowerSlot } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Archive, ArrowDown, Boxes, Check, Gauge, Shield, Sparkles, TrendingUp, Vault } from "lucide-react";
import { useEffect, useState } from "react";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import { api } from "../services/api/client";
import styles from "./PowerPage.module.css";

export function PowerPage() {
  const { session, selectedCharacterId, autoRefresh } = useGuardian();
  const [viewedCharacterId, setViewedCharacterId] = useState("");
  const result = useQuery({
    queryKey: ["power", selectedCharacterId],
    queryFn: () => api<PowerData>(`/api/v1/me/power?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    staleTime: 60_000,
    refetchInterval: autoRefresh ? 60_000 : false,
    refetchIntervalInBackground: false
  });
  const data = result.data?.data;
  useEffect(() => {
    if (data && !viewedCharacterId) setViewedCharacterId(data.selectedCharacterId);
  }, [data, viewedCharacterId]);
  const character = data?.characters.find((entry) => entry.characterId === viewedCharacterId) || data?.characters[0];
  const lowestSlots = character?.slots.filter((slot) => slot.lowest) || [];

  return <AuthGate>
    <PageHeader
      eyebrow="Account-wide Power analysis"
      title="Power"
      description="See the strongest transferable gear Bungie reports across your vault and characters, then identify the slot holding each Guardian back."
      actions={<Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />}
    />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(data)} onRetry={() => void result.refetch()} />
    {data && character && <>
      <section className={styles.accountSummary}>
        <div><Gauge /><span>Account ceiling</span><strong>{data.accountMaximumPower}</strong><small>Highest eight-slot character average</small></div>
        <div><TrendingUp /><span>Highest item</span><strong>{data.highestItemPower}</strong><small>Anywhere on the account</small></div>
        <div><Vault /><span>Vault high</span><strong>{data.vaultHighestItemPower || "—"}</strong><small>Highest item currently stored in the vault</small></div>
        <div className={styles.weakSummary}><ArrowDown /><span>Weakest slot</span><strong>{character.lowestSlotPower || "—"}</strong><small>{lowestSlots.map((slot) => slot.label).join(", ") || "No complete slot set returned"}</small></div>
      </section>

      <section className={styles.characterSwitcher} aria-label="Power by character">
        {data.characters.map((entry) => <button key={entry.characterId} onClick={() => setViewedCharacterId(entry.characterId)} className={entry.characterId === character.characterId ? styles.activeCharacter : ""} aria-pressed={entry.characterId === character.characterId}>
          <span style={{ backgroundImage: entry.emblemBackgroundPath ? `linear-gradient(90deg,rgba(4,10,14,.12),rgba(4,10,14,.72)),url(${entry.emblemBackgroundPath})` : undefined }}>{entry.emblemPath ? <img src={entry.emblemPath} alt="" /> : <Shield />}</span>
          <div><small>{entry.characterId === data.selectedCharacterId ? "Selected Guardian" : "Account Guardian"}</small><strong>{entry.className}</strong></div>
          <b><Sparkles />{entry.maximumPower}</b>
        </button>)}
      </section>

      <section className={styles.powerWorkspace}>
        <header className={styles.powerHero} style={{ "--power-banner": character.emblemBackgroundPath ? `url(${character.emblemBackgroundPath})` : "none" } as React.CSSProperties}>
          <div className={styles.characterIdentity}>{character.emblemPath ? <img src={character.emblemPath} alt="" /> : <Shield />}<span><small>Maximum equippable Power</small><h2>{character.className}</h2><p>Current character Power {character.currentPower}</p></span></div>
          <div className={styles.ceiling}><span>Gear ceiling</span><strong><Sparkles />{character.maximumPower}</strong><small>{character.averagePower.toFixed(2)} exact slot average</small></div>
          <div className={styles.nextPower}><span>Progress toward {character.maximumPower + 1}</span><div>{Array.from({ length: 8 }, (_, index) => <i key={index} className={index < character.progressToNextPower ? styles.filledPip : ""} />)}</div><small>{character.progressToNextPower}/8 slot points</small></div>
        </header>

        <div className={styles.slotScale}><span>{character.lowestSlotPower}</span><i><span /></i><strong>{Math.max(...character.slots.map((slot) => slot.power))}</strong></div>
        <section className={styles.slotGrid}>{character.slots.map((slot) => <PowerSlotRow key={slot.kind} slot={slot} highestPower={Math.max(...character.slots.map((entry) => entry.power))} />)}</section>

        <section className={styles.explanation}>
          <Boxes />
          <div><span>How this ceiling is calculated</span><p>For each of the eight equipment slots, Guardian Nexus selects the highest-Power item that this class can equip from the vault, every character inventory, and equipped gear. The displayed ceiling is the floor of those eight values averaged together.</p></div>
        </section>
      </section>
      <footer className={styles.sourceNote}>Power values come from Bungie's live item instance primary stats. Item slot and class eligibility come from current manifest definitions. Guardian Nexus does not fabricate missing item Power or assume an item belongs in a slot.</footer>
    </>}
  </AuthGate>;
}

function PowerSlotRow({ slot, highestPower }: { slot: PowerSlot; highestPower: number }) {
  const item = slot.item;
  const width = highestPower > 0 ? Math.max(4, Math.min(100, (slot.power / highestPower) * 100)) : 0;
  const vaultDiffers = slot.vaultBest && slot.vaultBest.instanceId !== item?.instanceId;
  return <article className={`${styles.slotRow} ${slot.lowest ? styles.lowestSlot : ""}`}>
    <div className={styles.slotItemIcon}>{item?.icon ? <img src={item.icon} alt="" /> : <Archive />}{slot.lowest && <AlertTriangle />}</div>
    <div className={styles.slotIdentity}><span>{slot.label}</span><strong>{item?.name || "No item returned"}</strong><small>{item ? locationLabel(item.location) : "Bungie did not return eligible gear"}</small></div>
    <b className={styles.slotPower}>{slot.power || "—"}</b>
    <div className={styles.powerBar}><i><span style={{ width: `${width}%` }} /></i>{slot.deficit > 0 ? <small>{slot.deficit} below best slot</small> : <small><Check /> At item ceiling</small>}</div>
    {vaultDiffers && <div className={styles.vaultBest}><Vault /><span>Vault best</span><strong>{slot.vaultBest!.power}</strong><small>{slot.vaultBest!.name}</small></div>}
  </article>;
}

function locationLabel(location: "vault" | "inventory" | "equipped"): string {
  return ({ vault: "Vault", inventory: "Character inventory", equipped: "Equipped" } as const)[location];
}
