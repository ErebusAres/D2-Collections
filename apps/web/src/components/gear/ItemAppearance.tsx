import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GearActionResult } from "@guardian-nexus/contracts";
import { Check, ChevronDown, Palette, Search, Sparkles, UserRound } from "lucide-react";
import { useGuardian } from "../../context/GuardianContext";
import { api, mutationHeaders } from "../../services/api/client";
import styles from "./ItemAppearance.module.css";

interface Choice { hash: string; name: string; icon: string; kind: "shader" | "ornament"; socketIndex: number; selected: boolean; enabled: boolean }
interface Appearance { itemId: string; characterId?: string; location?: string; canApply: boolean; canMoveToCharacter?: boolean; warning?: string; choices: Choice[] }

export function ItemAppearance({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false);
  return <section className={styles.appearance} onKeyDown={(event) => { if (event.key !== "Escape") event.stopPropagation(); }}>
    <button className={styles.disclosure} type="button" aria-expanded={open} onClick={() => setOpen(!open)}><Palette size={14} /><span>Appearance</span><ChevronDown size={14} /></button>
    {open && <AppearancePicker itemId={itemId} />}
  </section>;
}

function AppearancePicker({ itemId }: { itemId: string }) {
  const { session, selectedCharacterId } = useGuardian();
  const client = useQueryClient();
  const [kind, setKind] = useState<Choice["kind"]>("ornament");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Choice>();
  const [notice, setNotice] = useState("");
  const key = ["item-cosmetics", session?.guardian?.membershipId, itemId];
  const query = useQuery({ queryKey: key, queryFn: () => api<Appearance>(`/api/v1/me/gear/cosmetics?itemId=${encodeURIComponent(itemId)}`), staleTime: 30_000 });
  const apply = useMutation({
    mutationFn: async (choice: Choice) => {
      const current = query.data?.data.choices.find((entry) => entry.socketIndex === choice.socketIndex && entry.selected);
      if (!current) throw new Error("Refresh the appearance choices before applying.");
      return api("/api/v1/me/gear/cosmetics", { method: "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ itemId, socketIndex: choice.socketIndex, hash: choice.hash, expectedHash: current.hash }) });
    },
    onSuccess: (_result, choice) => {
      client.setQueryData(key, (old: typeof query.data) => old ? { ...old, data: { ...old.data, choices: old.data.choices.map((entry) => entry.socketIndex === choice.socketIndex ? { ...entry, selected: entry.hash === choice.hash } : entry) } } : old);
      setSelected(undefined); setNotice("Appearance applied.");
      for (const queryKey of ["gear", "recent-items", "fireteam-recent-items", "cleanup-state"]) void client.invalidateQueries({ queryKey: [queryKey] });
    }
  });
  const move = useMutation({
    mutationFn: async () => {
      if (!selectedCharacterId) throw new Error("Choose a character before moving this item.");
      const result = await api<GearActionResult>("/api/v1/me/gear/action", { method: "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ action: "transfer", itemInstanceId: itemId, target: "character", targetCharacterId: selectedCharacterId }) });
      if (result.data.failed.length) throw new Error(result.data.failed[0]!.message);
      if (!result.data.succeeded.includes(itemId)) throw new Error(result.data.skipped[0]?.reason || "The item could not be moved.");
      return result;
    },
    onSuccess: async () => {
      setNotice("Moved to your selected character. Refreshing available appearances…");
      for (const queryKey of ["gear", "recent-items", "fireteam-recent-items", "cleanup-state"]) void client.invalidateQueries({ queryKey: [queryKey] });
      await query.refetch();
    }
  });
  if (query.isPending) return <p role="status">Loading owned appearances…</p>;
  if (query.isError) return <p role="alert">{query.error.message} <button type="button" onClick={() => void query.refetch()}>Retry</button></p>;
  const data = query.data.data;
  const choices = data.choices.filter((choice) => choice.kind === kind && choice.name.toLowerCase().includes(search.toLowerCase()));
  const selectedCharacter = session?.guardian?.characters.find((character) => character.characterId === selectedCharacterId);
  const current = data.choices.find((choice) => choice.kind === kind && choice.selected);
  const pending = apply.isPending || move.isPending;
  return <div className={styles.picker}>
    <header className={styles.pickerHeader}><span><Sparkles size={15} /><strong>Owned appearances</strong></span><small>{data.choices.length} compatible choices</small></header>
    <div className={styles.tabs}>{(["ornament", "shader"] as const).map((value) => <button type="button" key={value} aria-pressed={kind === value} onClick={() => { setKind(value); setSelected(undefined); }}>{value === "ornament" ? "Ornaments" : "Shaders"}<b>{data.choices.filter((entry) => entry.kind === value).length}</b></button>)}</div>
    <label className={styles.search}><Search size={14} /><input aria-label="Search owned appearances" placeholder={`Search ${kind === "ornament" ? "ornaments" : "shaders"}…`} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
    {data.warning && <div className={styles.warning}><UserRound size={16} /><span><strong>{data.canMoveToCharacter ? "One step before applying" : "Appearance unavailable"}</strong><small>{data.warning}</small>{data.canMoveToCharacter && <button type="button" disabled={pending || !selectedCharacterId} onClick={() => move.mutate()}>Move to {selectedCharacter?.className || "selected character"}</button>}</span></div>}
    <div className={styles.grid}>{choices.map((choice) => <button className={styles.choice} type="button" key={`${choice.socketIndex}:${choice.hash}`} title={`${choice.name}${choice.selected ? " · Applied" : !choice.enabled ? " · Currently unavailable" : ""}`} aria-label={`${choice.name}${choice.selected ? " (applied)" : ""}`} aria-pressed={selected ? selected.hash === choice.hash && selected.socketIndex === choice.socketIndex : choice.selected} disabled={!choice.enabled || apply.isPending} onClick={() => { setSelected(choice); setNotice(""); }}>
      {choice.icon ? <img src={choice.icon} alt="" loading="lazy" /> : <span>{choice.name}</span>}{choice.selected && <b className={styles.applied} aria-hidden="true"><Check size={12} /></b>}
    </button>)}</div>
    {!choices.length && <p>{search ? "No matching owned appearances." : "Bungie returned no owned choices for this category."}</p>}
    <div className={styles.selection}><span>{selected?.icon && <img src={selected.icon} alt="" />}<span><small>{selected ? "Selected" : "Currently applied"}</small><strong>{selected?.name || current?.name || "No appearance reported"}</strong></span></span>{selected && <button type="button" disabled={!data.canApply || selected.selected || pending} onClick={() => apply.mutate(selected)}>{apply.isPending ? "Applying…" : selected.selected ? "Applied" : "Apply appearance"}</button>}</div>
    {notice && <p className={styles.notice} role="status">{notice}</p>}{(apply.isError || move.isError) && <p className={styles.error} role="alert">{(apply.error || move.error)?.message} <button type="button" onClick={() => { setSelected(undefined); apply.reset(); move.reset(); void query.refetch(); }}>Refresh choices</button></p>}
    <small className={styles.footnote}>Only Bungie-verified owned and compatible choices are shown. Applying is always a separate confirmation and never spends currency.</small>
  </div>;
}
