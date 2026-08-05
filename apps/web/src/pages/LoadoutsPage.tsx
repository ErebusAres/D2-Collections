import type { EquipLoadoutRequest, EquipLoadoutResult, GuardianLoadout, LoadoutItem, LoadoutSocket, LoadoutsData } from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowUp, Boxes, ChevronDown, ChevronUp, CircleHelp, Cpu, FilePlus2, GripHorizontal, RefreshCw, Sparkles, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { api, mutationHeaders } from "../services/api/client";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import { loadoutItemCosmetics, loadoutItemMods } from "../modules/loadouts/loadoutItemSockets";
import { buildDocumentFromLoadout, storeLoadoutBuildImport } from "../modules/loadouts/loadoutBuildImport";
import styles from "./LoadoutsPage.module.css";

export function LoadoutsPage() {
  const { session, selectedCharacterId, autoRefresh } = useGuardian();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const result = useQuery({
    queryKey: ["loadouts", selectedCharacterId],
    queryFn: () => api<LoadoutsData>(`/api/v1/me/loadouts?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    refetchInterval: autoRefresh ? 60_000 : false,
    refetchIntervalInBackground: false
  });
  const equip = useMutation({
    mutationFn: (input: EquipLoadoutRequest) => api<EquipLoadoutResult>("/api/v1/me/loadouts/equip", { method: "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify(input) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["loadouts", selectedCharacterId] })
  });
  const data = result.data?.data;

  return <AuthGate>
    <span id="page-top" className={styles.pageTopAnchor} />
    <PageHeader eyebrow="Saved combat configurations" title="Loadouts" description="Destiny may block equipping during restricted activities." actions={<><Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} /><button className={styles.refresh} onClick={() => void result.refetch()}><RefreshCw size={14} /> Sync loadouts</button></>} />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(data)} onRetry={() => void result.refetch()} />
    {data && <>
      <section className={styles.notice}><Zap /><div><span>Hot swap</span><strong>{data.characterClass} · {data.loadouts.length} saved loadout{data.loadouts.length === 1 ? "" : "s"}</strong><p>{data.equipRestriction}</p></div></section>
      <LoadoutNavigator loadouts={data.loadouts} characterClass={data.characterClass} />
      <section className={styles.equippedArea} id="loadout-equipped">
        <div className={styles.areaHeading}><span>0</span><div><small>Selected Guardian now</small><strong>Equipped area</strong></div></div>
        {data.equipped ? <LoadoutCard loadout={data.equipped} collapsed={collapsed.has("equipped")} onToggle={() => toggleCollapsed(setCollapsed, "equipped")} equippedState={data.equippedState} />
          : <section className={styles.equippedUnavailable}><CircleHelp /><div><strong>Equipped data unavailable</strong><p>Bungie did not return current equipment for this Guardian. Saved loadouts remain available below.</p></div></section>}
      </section>
      {data.loadouts.length ? <section className={styles.loadoutGrid}>{data.loadouts.map((loadout, listIndex) => <div id={`loadout-${loadout.index}`} className={styles.loadoutAnchor} key={loadout.index}><div className={styles.areaHeading}><LoadoutHeadingBadge loadout={loadout} number={listIndex + 1} characterClass={data.characterClass} /><div><small>Saved loadout</small><strong>{loadout.name}</strong></div></div><LoadoutCard loadout={loadout} collapsed={collapsed.has(String(loadout.index))} onToggle={() => toggleCollapsed(setCollapsed, String(loadout.index))} busy={equip.isPending} canCreateBuild={Boolean(session?.roles.buildEditor)} onCreateBuild={() => {
        const token = storeLoadoutBuildImport({ version: 1, sourceName: loadout.name, sourceIndex: loadout.index, document: buildDocumentFromLoadout(loadout, data.characterClass) });
        navigate(`/builds/new?fromLoadout=${encodeURIComponent(token)}`);
      }} onEquip={() => window.confirm(`Equip ${loadout.name} on the selected ${data.characterClass}? Bungie will reject the change if the current activity does not allow loadout changes.`) && equip.mutate({ loadoutIndex: loadout.index, characterId: data.characterId })} /></div>)}</section>
        : <section className={styles.empty}><Boxes /><h2>No saved loadouts</h2><p>Create a loadout in Destiny to see it here.</p></section>}
      {equip.data?.data.equipped && <div className={styles.success}><Sparkles /> Loadout equip request completed.</div>}
      {equip.error && <div className={styles.error}><AlertTriangle /> {equip.error.message}</div>}
    </>}
  </AuthGate>;
}

function LoadoutCard({ loadout, collapsed, onToggle, equippedState, busy = false, canCreateBuild = false, onCreateBuild, onEquip }: { loadout: GuardianLoadout; collapsed: boolean; onToggle: () => void; equippedState?: LoadoutsData["equippedState"]; busy?: boolean; canCreateBuild?: boolean; onCreateBuild?: () => void; onEquip?: () => void }) {
  const equipped = loadout.index < 0;
  const previewItems = [loadout.subclass, ...loadout.equipment, loadout.artifact].filter((item): item is LoadoutItem => Boolean(item));
  return <article className={`${styles.loadoutCard} ${collapsed ? styles.loadoutCollapsed : ""}`} style={loadout.color ? { "--loadout-color": `url(${loadout.color})` } as React.CSSProperties : undefined}>
    <header>{loadout.icon ? <img src={loadout.icon} alt="" /> : <Cpu />}<div><span>{equipped ? `Live equipment · ${equippedState === "partial" ? "Some details unavailable" : loadout.element || "Element unavailable"}` : `Slot ${loadout.index + 1} · ${loadout.element || "Element unavailable"}`}</span><h2>{loadout.name}</h2><small>{loadout.items.length} {equipped ? "equipped" : "saved"} items{loadout.unresolvedItemCount ? ` · ${loadout.unresolvedItemCount} unresolved` : ""}</small></div>{collapsed && <div className={styles.collapsedIcons} aria-label={`${loadout.name} item preview`}>{previewItems.map((item) => item.icon ? <img key={item.instanceId} src={item.icon} alt={item.name} title={item.name} /> : <CircleHelp key={item.instanceId} aria-label={`${item.name} icon unavailable`} />)}</div>}<div className={styles.loadoutActions}>{canCreateBuild && onCreateBuild && <button className={styles.createBuild} onClick={onCreateBuild}><FilePlus2 /> Create build</button>}{onEquip && <button disabled={busy} onClick={onEquip}><Zap /> Equip loadout</button>}<button className={styles.collapseButton} onClick={onToggle} aria-expanded={!collapsed} aria-label={`${collapsed ? "Expand" : "Minimize"} ${loadout.name}`} title={collapsed ? "Expand loadout" : "Minimize to header"}>{collapsed ? <ChevronDown /> : <ChevronUp />}</button></div></header>
    <div className={styles.loadoutBody} hidden={collapsed}>
      <section className={styles.abilitySection}><h3>Subclass configuration</h3><div className={styles.subclassGrid}>{loadout.subclass ? <SubclassIdentity item={loadout.subclass} element={loadout.element} /> : <Unavailable text="Subclass data unavailable" />}{loadout.isPrismatic && (loadout.transcendence ? <SocketChip socket={loadout.transcendence} /> : <Unavailable text="Transcendence data unavailable" />)}{loadout.isPrismatic && (loadout.prismaticGrenade ? <SocketChip socket={loadout.prismaticGrenade} /> : <Unavailable text="Prismatic Grenade data unavailable" />)}{loadout.abilities.map((socket) => <SocketChip key={socket.itemHash} socket={socket} />)}</div>{loadout.aspects.length > 0 && <><h3>Aspects</h3><div>{loadout.aspects.map((socket) => <SocketChip key={socket.itemHash} socket={socket} />)}</div></>}{loadout.fragments.length > 0 && <><h3>Fragments</h3><div>{loadout.fragments.map((socket) => <SocketChip key={socket.itemHash} socket={socket} />)}</div></>}</section>
      <section className={styles.gearSection}><h3>{equipped ? "Equipped gear" : "Saved equipment"}</h3>{loadout.equipment.length ? <div className={styles.equipmentGrid}>{loadout.equipment.map((item) => <LoadoutItemCard key={item.instanceId} item={item} />)}</div> : <Unavailable text={`${equipped ? "Equipped" : "Saved"} equipment data unavailable`} />}</section>
      <ArtifactSection loadout={loadout} equipped={equipped} />
    </div>
  </article>;
}

function LoadoutNavigator({ loadouts, characterClass }: { loadouts: GuardianLoadout[]; characterClass: string }) {
  const sentinelRef = useRef<HTMLSpanElement>(null);
  const [pinned, setPinned] = useState(false);
  const [activated, setActivated] = useState(false);
  const [stickyTop, setStickyTop] = useState(0);
  useEffect(() => {
    const update = () => {
      const headerBottom = Math.max(0, document.querySelector<HTMLElement>("[data-site-header]")?.getBoundingClientRect().bottom || 0);
      setStickyTop((current) => current === headerBottom ? current : headerBottom);
      setPinned((current) => {
        const next = Boolean(sentinelRef.current && sentinelRef.current.getBoundingClientRect().top <= headerBottom);
        return current === next ? current : next;
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  useEffect(() => { if (!pinned) setActivated(false); }, [pinned]);
  const available = loadouts.slice(0, 20);
  return <><span ref={sentinelRef} className={styles.navigatorSentinel} data-testid="loadout-jump-sentinel" aria-hidden="true" /><nav className={`${styles.loadoutNavigator} ${pinned ? styles.navigatorPinned : ""} ${activated ? styles.navigatorActivated : ""}`} style={{ "--loadout-sticky-top": `${stickyTop}px` } as React.CSSProperties} aria-label="Loadout jump list">
    <div className={styles.navigatorFrame}><a href="#page-top" className={styles.navigatorTop} onClick={() => setActivated(false)}><ArrowUp /><span>Top</span></a><span className={styles.navigatorLabel}>Jump to loadout</span><div className={styles.navigatorNumbers}>{available.map((loadout, index) => <LoadoutJumpLink key={loadout.index} loadout={loadout} number={index + 1} characterClass={characterClass} pinned={pinned} onJump={() => setActivated(false)} />)}</div></div>
    <button type="button" className={styles.navigatorHandle} aria-label={activated ? "Hide loadout jump list" : "Show loadout jump list"} aria-expanded={!pinned || activated} onClick={() => setActivated((current) => !current)}><GripHorizontal /><span>Jump to loadout</span></button>
  </nav></>;
}

function LoadoutJumpLink({ loadout, number, characterClass, pinned, onJump }: { loadout: GuardianLoadout; number: number; characterClass: string; pinned: boolean; onJump: () => void }) {
  const [anchor, setAnchor] = useState<DOMRect>();
  const show = (element: HTMLElement) => setAnchor(element.getBoundingClientRect());
  return <>
    <a href={`#loadout-${loadout.index}`} aria-label={`Jump to loadout ${number}: ${loadout.name}`} onMouseEnter={(event) => show(event.currentTarget)} onMouseLeave={() => setAnchor(undefined)} onFocus={(event) => show(event.currentTarget)} onBlur={() => setAnchor(undefined)} onClick={onJump}>
      <LoadoutSlotVisual loadout={loadout} number={number} />
    </a>
    {anchor && <LoadoutTooltip loadout={loadout} number={number} characterClass={characterClass} anchor={anchor} pinned={pinned} />}
  </>;
}

function LoadoutHeadingBadge({ loadout, number, characterClass }: { loadout: GuardianLoadout; number: number; characterClass: string }) {
  const [anchor, setAnchor] = useState<DOMRect>();
  const show = (element: HTMLElement) => setAnchor(element.getBoundingClientRect());
  return <>
    <span className={styles.headingLoadoutBadge} role="img" tabIndex={0} aria-label={`Loadout ${number}: ${loadout.name}`} onMouseEnter={(event) => show(event.currentTarget)} onMouseLeave={() => setAnchor(undefined)} onFocus={(event) => show(event.currentTarget)} onBlur={() => setAnchor(undefined)}>
      <LoadoutSlotVisual loadout={loadout} number={number} />
    </span>
    {anchor && <LoadoutTooltip loadout={loadout} number={number} characterClass={characterClass} anchor={anchor} pinned={false} />}
  </>;
}

function LoadoutSlotVisual({ loadout, number }: { loadout: GuardianLoadout; number: number }) {
  const style = loadout.color ? { "--slot-color": `url(${loadout.color})` } as React.CSSProperties : undefined;
  return <span className={`${styles.loadoutSlotVisual} ${!loadout.color ? styles.loadoutSlotFallback : ""}`} style={style} aria-hidden="true">
    {loadout.icon ? <img src={loadout.icon} alt="" /> : <Cpu />}
    <b>{number}</b>
  </span>;
}

function LoadoutTooltip({ loadout, number, characterClass, anchor, pinned }: { loadout: GuardianLoadout; number: number; characterClass: string; anchor: DOMRect; pinned: boolean }) {
  const width = 238;
  const estimatedHeight = 92;
  const left = Math.min(Math.max(8, anchor.left + anchor.width / 2 - width / 2), Math.max(8, window.innerWidth - width - 8));
  const fitsBelow = anchor.bottom + estimatedHeight + 12 <= window.innerHeight;
  const placement = pinned || fitsBelow ? "below" : "above";
  const top = placement === "below" ? anchor.bottom + 8 : Math.max(8, anchor.top - estimatedHeight - 8);
  const style = { left, top, width, "--tooltip-color": loadout.color ? `url(${loadout.color})` : "none" } as React.CSSProperties;
  return createPortal(<aside className={styles.loadoutTooltip} data-placement={placement} style={style} role="tooltip">
    <LoadoutSlotVisual loadout={loadout} number={number} />
    <div><small>Saved loadout {number}</small><strong>{loadout.name}</strong><span>{characterClass} · {loadout.element || "Subclass element unavailable"}</span></div>
    <i aria-label={loadout.color ? "In-game loadout color" : "In-game loadout color unavailable"} />
  </aside>, document.body);
}

function toggleCollapsed(setCollapsed: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) {
  setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
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

function ArtifactSection({ loadout, equipped = false }: { loadout: GuardianLoadout; equipped?: boolean }) {
  const artifact = loadout.artifact;
  const artifactMods = loadout.artifactMods || [];
  return <section className={styles.artifactSection}>
    <div className={styles.sectionHeading}><h3>Artifact</h3><span>{artifactMods.length} equipped perk{artifactMods.length === 1 ? "" : "s"}</span></div>
    <div className={styles.artifactLayout}>
      {artifact ? <article className={`${styles.artifactItem} ${!artifact.definitionAvailable ? styles.itemUnavailable : ""}`}>{artifact.icon ? <img src={artifact.icon} alt="" loading="lazy" /> : <CircleHelp />}<div><span>{equipped ? "Currently equipped" : "Saved with this loadout"}</span><strong>{artifact.name}</strong><small>{artifact.rarity} · {artifact.itemType}</small></div></article> : <Unavailable text={`This ${equipped ? "equipment set" : "saved loadout"} does not include Artifact data`} />}
      {artifactMods.length ? <div className={styles.artifactMods}>{artifactMods.map((socket) => <article className={`${styles.artifactMod} ${!socket.definitionAvailable ? styles.itemUnavailable : ""}`} key={socket.itemHash} title={socket.description || socket.name}>{socket.icon ? <img src={socket.icon} alt="" loading="lazy" /> : <CircleHelp />}<strong>{socket.name}</strong></article>)}</div> : artifact && <Unavailable text="This saved loadout contains no equipped Artifact perks" />}
    </div>
  </section>;
}

function SocketChip({ socket }: { socket: LoadoutSocket }) {
  return <article className={`${styles.socketChip} ${!socket.definitionAvailable ? styles.itemUnavailable : ""}`} title={socket.description || socket.name}>{socket.icon ? <img src={socket.icon} alt="" loading="lazy" /> : <CircleHelp />}<div><span>{socket.categoryLabel}</span><strong>{socket.name}</strong>{socket.description && <small>{socket.description}</small>}</div></article>;
}

function Unavailable({ text }: { text: string }) { return <div className={styles.unavailable}><CircleHelp /> {text}</div>; }
