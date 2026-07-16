import type { EquipLoadoutRequest, EquipLoadoutResult, GuardianLoadout, LoadoutItem, LoadoutSocket, LoadoutsData } from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Boxes, CircleHelp, Cpu, RefreshCw, Sparkles, Zap } from "lucide-react";
import { api, mutationHeaders, queuedApi } from "../services/api/client";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
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
    <PageHeader eyebrow="Saved combat configurations" title="Loadouts" description="Inspect the exact gear, subclass abilities, aspects, fragments, and socket modifiers saved to the selected Guardian." actions={<><Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} /><button className={styles.refresh} onClick={() => void result.refetch()}><RefreshCw size={14} /> Sync loadouts</button></>} />
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
    <section className={styles.abilitySection}><h3>Subclass configuration</h3><div>{loadout.abilities.length ? loadout.abilities.map((socket) => <SocketChip key={socket.itemHash} socket={socket} />) : <Unavailable text="Ability data unavailable" />}</div>{loadout.aspects.length > 0 && <><h3>Aspects</h3><div>{loadout.aspects.map((socket) => <SocketChip key={socket.itemHash} socket={socket} />)}</div></>}{loadout.fragments.length > 0 && <><h3>Fragments</h3><div>{loadout.fragments.map((socket) => <SocketChip key={socket.itemHash} socket={socket} />)}</div></>}</section>
    <section className={styles.gearSection}><h3>Saved equipment</h3><div>{loadout.items.map((item) => <LoadoutItemCard key={item.instanceId} item={item} />)}</div></section>
    {loadout.modifiers.length > 0 && <section className={styles.modifierSection}><h3>Saved modifiers & sockets</h3><div>{loadout.modifiers.map((socket) => <SocketChip key={socket.itemHash} socket={socket} compact />)}</div></section>}
  </article>;
}

function LoadoutItemCard({ item }: { item: LoadoutItem }) {
  return <article className={!item.definitionAvailable ? styles.itemUnavailable : ""}>{item.icon ? <img src={item.icon} alt="" loading="lazy" /> : <CircleHelp />}<div><span>{item.equipmentSlot}</span><strong>{item.name}</strong><small>{item.rarity} · {item.itemType}</small></div></article>;
}

function SocketChip({ socket, compact = false }: { socket: LoadoutSocket; compact?: boolean }) {
  return <article className={`${styles.socketChip} ${compact ? styles.compactSocket : ""} ${!socket.definitionAvailable ? styles.itemUnavailable : ""}`} title={socket.description || socket.name}>{socket.icon ? <img src={socket.icon} alt="" loading="lazy" /> : <CircleHelp />}<div><span>{socket.categoryLabel}</span><strong>{socket.name}</strong>{!compact && socket.description && <small>{socket.description}</small>}</div></article>;
}

function Unavailable({ text }: { text: string }) { return <div className={styles.unavailable}><CircleHelp /> {text}</div>; }
