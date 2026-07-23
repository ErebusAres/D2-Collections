import type { CharacterPowerCeiling, PowerData, PowerSlot } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Archive, ArrowDown, Check, Gauge, Shield, Sparkles, TrendingUp, Vault } from "lucide-react";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import { api } from "../services/api/client";
import styles from "./PowerPage.module.css";

const POWER_CAP = 550;

export function PowerPage() {
  const { session, selectedCharacterId, autoRefresh } = useGuardian();
  const result = useQuery({
    queryKey: ["power", selectedCharacterId],
    queryFn: () => api<PowerData>(`/api/v1/me/power?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    staleTime: 60_000,
    refetchInterval: autoRefresh ? 60_000 : false,
    refetchIntervalInBackground: false
  });
  const data = result.data?.data;
  const strongestCharacter = data?.characters.reduce<CharacterPowerCeiling | undefined>((best, character) => {
    if (!best || character.maximumPower > best.maximumPower) return character;
    return best;
  }, undefined);
  const weakestSlots = strongestCharacter?.slots.filter((slot) => slot.lowest) || [];

  return <AuthGate>
    <PageHeader
      eyebrow="Account-wide Power analysis"
      title="Power"
      description="Gear Power excludes Artifact bonuses and stops at the hard cap of 550."
      actions={<Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />}
    />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(data)} onRetry={() => void result.refetch()} />
    {data && strongestCharacter && <>
      <section className={styles.capBanner} aria-label={`Maximum gear Power is ${POWER_CAP}`}>
        <Gauge />
        <div><span>Gear hard cap</span><strong>{POWER_CAP}</strong></div>
        <p>{POWER_CAP} is the maximum gear Power. A Guardian at the cap is complete—there is no progression bar or gear target beyond {POWER_CAP}.</p>
      </section>

      <section className={styles.powerBoard} aria-label="Power by character and account">
        {data.characters.map((character) => <PowerColumn
          key={character.characterId}
          character={character}
          selected={character.characterId === data.selectedCharacterId}
        />)}
        <PowerColumn character={strongestCharacter} accountPower={data.accountMaximumPower} account />
      </section>

      <section className={styles.accountSummary}>
        <div><TrendingUp /><span>Highest item</span><strong>{capped(data.highestItemPower) || "—"}</strong><small>Anywhere on the account</small></div>
        <div><Vault /><span>Vault high</span><strong>{capped(data.vaultHighestItemPower) || "—"}</strong><small>Highest item currently stored in the vault</small></div>
        <div className={styles.weakSummary}><ArrowDown /><span>Lowest best-in-slot</span><strong>{capped(strongestCharacter.lowestSlotPower) || "—"}</strong><small>{weakestSlots.map((slot) => slot.label).join(", ") || "No complete slot set returned"}</small></div>
      </section>

      <footer className={styles.sourceNote}>Each class ceiling averages its strongest equippable item in all eight slots across characters and the vault.</footer>
    </>}
  </AuthGate>;
}

function PowerColumn({ character, selected = false, account = false, accountPower }: { character: CharacterPowerCeiling; selected?: boolean; account?: boolean; accountPower?: number }) {
  const maximumPower = capped(account ? accountPower ?? character.maximumPower : character.maximumPower);
  const atCap = maximumPower >= POWER_CAP;
  const pips = atCap ? 8 : Math.max(0, Math.min(8, character.progressToNextPower));
  const scaleMin = slotScaleMinimum(character.slots);
  const lowestSlots = character.slots.filter((slot) => slot.lowest);
  const nextPower = Math.min(POWER_CAP, maximumPower + 1);
  const title = account ? "Account" : character.className;

  return <article className={`${styles.powerColumn} ${account ? styles.accountColumn : ""}`}>
    <header className={styles.columnHeader} style={{ "--power-banner": character.emblemBackgroundPath ? `url(${character.emblemBackgroundPath})` : "none" } as React.CSSProperties}>
      <span className={styles.columnEmblem}>{character.emblemPath ? <img src={character.emblemPath} alt="" /> : <Shield />}</span>
      <div><small>{account ? `Best loadout · ${character.className}` : selected ? "Selected Guardian" : "Account Guardian"}</small><h2>{title}</h2>{!account && <p>Equipped Power {capped(character.currentPower)}</p>}</div>
      <strong><Sparkles />{maximumPower}</strong>
    </header>

    <section className={`${styles.columnProgress} ${atCap ? styles.capReached : ""}`}>
      <div><span>{atCap ? "Hard cap reached" : `Progress toward ${nextPower}`}</span><b>{atCap ? `${POWER_CAP} / ${POWER_CAP}` : `${pips}/8 slot points`}</b></div>
      <div className={styles.progressPips}>{Array.from({ length: 8 }, (_, index) => <i key={index} className={index < pips ? styles.filledPip : ""} />)}</div>
      <small>{account ? "Account maximum" : `${Math.max(0, Math.min(POWER_CAP, character.averagePower)).toFixed(2)} exact slot average`}</small>
    </section>

    <div className={styles.slotScale}><span>{scaleMin}</span><i><span /></i><strong>{POWER_CAP}</strong></div>
    <section className={styles.slotList} aria-label={`${title} best equipment`}>
      {character.slots.map((slot) => <PowerSlotRow key={slot.kind} slot={slot} scaleMin={scaleMin} ceiling={maximumPower} />)}
    </section>

    <footer className={`${styles.columnAdvice} ${atCap ? styles.capAdvice : ""}`}>
      {atCap ? <><Check /><p><strong>Maximum gear Power reached.</strong><span>Every displayed target stops at {POWER_CAP}.</span></p></> : <><AlertTriangle /><p><strong>{lowestSlots.map((slot) => slot.label).join(" and ") || "Missing gear data"}</strong><span>{lowestSlots.length ? `Your lowest best-in-slot item is ${capped(character.lowestSlotPower)}.` : "Bungie did not return all eight equipment slots."}</span></p></>}
    </footer>
  </article>;
}

function PowerSlotRow({ slot, scaleMin, ceiling }: { slot: PowerSlot; scaleMin: number; ceiling: number }) {
  const item = slot.item;
  const power = capped(slot.power);
  const fill = scalePosition(power, scaleMin);
  const marker = scalePosition(ceiling, scaleMin);
  const vaultDiffers = slot.vaultBest && slot.vaultBest.instanceId !== item?.instanceId;
  const atCap = power >= POWER_CAP;
  return <article className={`${styles.slotRow} ${slot.lowest ? styles.lowestSlot : ""}`}>
    <div className={styles.slotItemIcon}>{item?.icon ? <img src={item.icon} alt="" /> : <Archive />}{slot.lowest && <AlertTriangle />}</div>
    <div className={styles.slotDetails}>
      <div><strong>{power || "—"}</strong><span>{slot.label}</span>{atCap && <Check aria-label="At hard cap" />}</div>
      <small>{item ? `${item.name} · ${locationLabel(item.location)}` : "Bungie did not return eligible gear"}</small>
      <div className={styles.slotMeter} aria-label={`${slot.label} ${power} of ${POWER_CAP}`}>
        <span style={{ width: `${fill}%` }} />
        <i style={{ left: `${marker}%` }} />
      </div>
      <div className={styles.slotMeta}>
        {slot.deficit > 0 ? <span>{slot.deficit} below best slot</span> : <span>{atCap ? "At hard cap" : "At item ceiling"}</span>}
        {vaultDiffers && <span className={styles.vaultBest}><Vault /> Vault {capped(slot.vaultBest!.power)}</span>}
      </div>
    </div>
  </article>;
}

function capped(value: number): number {
  return Math.max(0, Math.min(POWER_CAP, Math.floor(value || 0)));
}

function slotScaleMinimum(slots: PowerSlot[]): number {
  const lowest = Math.min(...slots.map((slot) => capped(slot.power)).filter((power) => power > 0));
  if (!Number.isFinite(lowest)) return 0;
  return Math.max(0, Math.min(POWER_CAP - 120, Math.floor((lowest - 10) / 10) * 10));
}

function scalePosition(power: number, minimum: number): number {
  if (minimum >= POWER_CAP) return 100;
  return Math.max(0, Math.min(100, ((capped(power) - minimum) / (POWER_CAP - minimum)) * 100));
}

function locationLabel(location: "vault" | "inventory" | "equipped"): string {
  return ({ vault: "Vault", inventory: "Character inventory", equipped: "Equipped" } as const)[location];
}
