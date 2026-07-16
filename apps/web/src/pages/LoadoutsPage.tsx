import type { EquipLoadoutRequest, EquipLoadoutResult, GuardianLoadout, LoadoutItem, LoadoutSocket, LoadoutsData } from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Boxes, CircleHelp, Cpu, RefreshCw, Sparkles, Zap } from "lucide-react";
import { api, mutationHeaders, queuedApi } from "../services/api/client";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import { loadoutItemCosmetics, loadoutItemMods } from "../modules/loadouts/loadoutItemSockets";
import styles from "./LoadoutsPage.module.css";

export function LoadoutsPage() {
  const { session, selectedCharacterId, autoRefresh } = useGuardian();
  const queryClient = useQueryClient();
  const result = useQuery({
    queryKey: ["loadouts", selectedCharacterId],
    queryFn: () => api<LoadoutsData>(`/api/v1/me/loadouts?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    refetchInterval: autoRefresh ? 60_000 : false,
    refetchIntervalInBackground: false
  });
  const equip = useMutation({
    mutationFn: (input: EquipLoadoutRequest) => queuedApi<EquipLoadoutResult>("/api/v1/me/loadouts/equip", { method: "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify(input) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["loadouts", selectedCharacterId] })
  });
  const data = result.data?.data;

  return <AuthGate>
    <PageHeader eyebrow="Saved combat configurations" title="Loadouts" description="Inspect the exact gear, subclass abilities, aspects, fragments, Artifact perks, and socket modifiers saved to the selected Guardian." actions={<><Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} /><button className={styles.refresh} onClick={() => void result.refetch()}><RefreshCw size={14} /> Sync loadouts</button></>} />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(data)} onRetry={() => void result.refetch()} />
    {data && <>
      <section className={styles.notice}><Zap /><div><span>Hot swap</span><strong>{data.characterClass} · {data.loadouts.length} saved loadout{data.loadouts.length === 1 ? "" : "s"}</strong><p>{data.equipRestriction}</p></div></section>
      {data.loadouts.length ? <section className={styles.loadoutGrid}>{data.loadouts.map((loadout) => <LoadoutCard key={loadout.index} loadout={loadout} busy={equip.isPending} onEquip={() => window.confirm(`Equip ${loadout.name} on the selected ${data.characterClass}? Bungie will reject the change if the current activity does not allow loadout changes.`) && equip.mutate({ loadoutIndex: loadout.index, characterId: data.characterId })} />)}</section>
        : <section className={styles.empty}><Boxes /><h2>No saved loadouts</h2><p>Bungie did not return a configured loadout for this character.</p></section>}
      {equip.data?.data.equipped && <div className={styles.success}><Sparkles /> Loadout equip request completed.</div>}
      {equip.error && <div className={styles.error}><AlertTriangle /> {equip.error.message}</div>}
    </>}
  </AuthGate>;
}

function LoadoutCard({ loadout, busy, onEquip }: { loadout: GuardianLoadout; busy: boolean; onEquip: () => void }) {
  return <article className={styles.loadoutCard} style={loadout.color ? { "--loadout-color": `url(${loadout.color})` } as React.CSSProperties : undefined}>
    <header>{loadout.icon ? <img src={loadout.icon} alt="" /> : <Cpu />}<div><span>Slot {loadout.index + 1} · {loadout.element || "Element unavailable"}</span><h2>{loadout.name}</h2><small>{loadout.items.length} saved items{loadout.unresolvedItemCount ? ` · ${loadout.unresolvedItemCount} unresolved` : ""}</small></div><button disabled={busy} onClick={onEquip}><Zap /> Equip loadout</button></header>
    <section className={styles.abilitySection}><h3>Subclass configuration</h3><div className={styles.subclassGrid}>{loadout.subclass ? <SubclassIdentity item={loadout.subclass} element={loadout.element} /> : <Unavailable text="Subclass data unavailable" />}{loadout.isPrismatic && (loadout.transcendence ? <SocketChip socket={loadout.transcendence} /> : <Unavailable text="Transcendence data unavailable" />)}{loadout.isPrismatic && (loadout.prismaticGrenade ? <SocketChip socket={loadout.prismaticGrenade} /> : <Unavailable text="Prismatic Grenade data unavailable" />)}{loadout.abilities.map((socket) => <SocketChip key={socket.itemHash} socket={socket} />)}</div>{loadout.aspects.length > 0 && <><h3>Aspects</h3><div>{loadout.aspects.map((socket) => <SocketChip key={socket.itemHash} socket={socket} />)}</div></>}{loadout.fragments.length > 0 && <><h3>Fragments</h3><div>{loadout.fragments.map((socket) => <SocketChip key={socket.itemHash} socket={socket} />)}</div></>}</section>
    <section className={styles.gearSection}><h3>Saved equipment</h3>{loadout.equipment.length ? <div className={styles.equipmentGrid}>{loadout.equipment.map((item) => <LoadoutItemCard key={item.instanceId} item={item} />)}</div> : <Unavailable text="Saved equipment data unavailable" />}</section>
    <ArtifactSection loadout={loadout} />
  </article>;
}

function LoadoutItemCard({ item }: { item: LoadoutItem }) {
  const cosmetics = loadoutItemCosmetics(item);
  const mods = loadoutItemMods(item);
  return <article className={`${styles.loadoutItem} ${!item.definitionAvailable ? styles.itemUnavailable : ""}`} title={!item.definitionAvailable ? "This saved loadout still references an item instance that Bungie no longer returns. It may have been deleted or otherwise removed from the character." : undefined}>
    <div className={styles.itemSummary}>{item.icon ? <img src={item.icon} alt="" loading="lazy" /> : <CircleHelp />}<div><span>{item.equipmentSlot}</span><strong>{item.name}</strong><small>{item.definitionAvailable ? `${item.rarity} · ${item.itemType}` : "The loadout reference remains, but the item may have been deleted or removed."}</small></div>{cosmetics.length > 0 && <div className={styles.cosmetics} aria-label="Saved ornament and shader">{cosmetics.map((socket) => socket.icon ? <img key={socket.itemHash} src={socket.icon} alt={`${socket.categoryLabel}: ${socket.name}`} title={`${socket.categoryLabel}: ${socket.name}`} loading="lazy" /> : <CircleHelp key={socket.itemHash} aria-label={`${socket.categoryLabel} unavailable`} />)}</div>}</div>
    {mods.length > 0 && <div className={styles.itemSockets}>{mods.map((socket) => <div className={styles.itemSocket} key={socket.itemHash} title={socket.description || socket.name}>{socket.icon ? <img src={socket.icon} alt="" loading="lazy" /> : <CircleHelp />}<div><span>{socket.categoryLabel}</span><strong>{socket.name}</strong></div></div>)}</div>}
  </article>;
}

function SubclassIdentity({ item, element }: { item: LoadoutItem; element?: string }) {
  return <article className={`${styles.socketChip} ${styles.subclassIdentity} ${!item.definitionAvailable ? styles.itemUnavailable : ""}`} title={item.itemType}><>{item.icon ? <img src={item.icon} alt="" loading="lazy" /> : <CircleHelp />}</><div><span>Subclass · {element || "Element unavailable"}</span><strong>{item.name}</strong><small>{item.itemType}</small></div></article>;
}

function ArtifactSection({ loadout }: { loadout: GuardianLoadout }) {
  const artifact = loadout.artifact;
  const artifactMods = loadout.artifactMods || [];
  return <section className={styles.artifactSection}>
    <div className={styles.sectionHeading}><h3>Artifact</h3><span>{artifactMods.length} saved perk{artifactMods.length === 1 ? "" : "s"}</span></div>
    <div className={styles.artifactLayout}>
      {artifact ? <article className={`${styles.artifactItem} ${!artifact.definitionAvailable ? styles.itemUnavailable : ""}`}>{artifact.icon ? <img src={artifact.icon} alt="" loading="lazy" /> : <CircleHelp />}<div><span>Saved with this loadout</span><strong>{artifact.name}</strong><small>{artifact.rarity} · {artifact.itemType}</small></div></article> : <Unavailable text="This saved loadout does not include Artifact data" />}
      {artifactMods.length ? <div className={styles.artifactMods}>{artifactMods.map((socket) => <article className={`${styles.artifactMod} ${!socket.definitionAvailable ? styles.itemUnavailable : ""}`} key={socket.itemHash} title={socket.description || socket.name}>{socket.icon ? <img src={socket.icon} alt="" loading="lazy" /> : <CircleHelp />}<strong>{socket.name}</strong></article>)}</div> : artifact && <Unavailable text="This saved loadout contains no resolvable Artifact perks" />}
    </div>
  </section>;
}

function SocketChip({ socket }: { socket: LoadoutSocket }) {
  return <article className={`${styles.socketChip} ${!socket.definitionAvailable ? styles.itemUnavailable : ""}`} title={socket.description || socket.name}>{socket.icon ? <img src={socket.icon} alt="" loading="lazy" /> : <CircleHelp />}<div><span>{socket.categoryLabel}</span><strong>{socket.name}</strong>{socket.description && <small>{socket.description}</small>}</div></article>;
}

function Unavailable({ text }: { text: string }) { return <div className={styles.unavailable}><CircleHelp /> {text}</div>; }
