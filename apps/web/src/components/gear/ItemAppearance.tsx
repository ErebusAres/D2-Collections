import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useGuardian } from "../../context/GuardianContext";
import { api, mutationHeaders } from "../../services/api/client";
import styles from "./ItemAppearance.module.css";

interface Choice { hash: string; name: string; icon: string; kind: "shader" | "ornament"; socketIndex: number; selected: boolean; enabled: boolean }
interface Appearance { itemId: string; canApply: boolean; warning?: string; choices: Choice[] }

export function ItemAppearance({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false);
  return <section className={styles.appearance} onKeyDown={(event) => { if (event.key !== "Escape") event.stopPropagation(); }}>
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>Appearance {open ? "−" : "+"}</button>
    {open && <AppearancePicker itemId={itemId} />}
  </section>;
}

function AppearancePicker({ itemId }: { itemId: string }) {
  const { session } = useGuardian();
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
  if (query.isPending) return <p role="status">Loading owned appearances…</p>;
  if (query.isError) return <p role="alert">{query.error.message} <button type="button" onClick={() => void query.refetch()}>Retry</button></p>;
  const data = query.data.data;
  const choices = data.choices.filter((choice) => choice.kind === kind && choice.name.toLowerCase().includes(search.toLowerCase()));
  return <div>
    <div className={styles.tabs}>{(["ornament", "shader"] as const).map((value) => <button type="button" key={value} aria-pressed={kind === value} onClick={() => { setKind(value); setSelected(undefined); }}>{value === "ornament" ? "Ornaments" : "Shaders"} ({data.choices.filter((entry) => entry.kind === value).length})</button>)}</div>
    <input aria-label="Search owned appearances" placeholder="Search owned appearances" value={search} onChange={(event) => setSearch(event.target.value)} />
    {data.warning && <p>{data.warning}</p>}
    <div className={styles.grid}>{choices.map((choice) => <button type="button" key={`${choice.socketIndex}:${choice.hash}`} title={`${choice.name}${choice.selected ? " · Applied" : !choice.enabled ? " · Currently unavailable" : ""}`} aria-label={`${choice.name}${choice.selected ? " (applied)" : ""}`} aria-pressed={selected ? selected.hash === choice.hash && selected.socketIndex === choice.socketIndex : choice.selected} disabled={!choice.enabled || apply.isPending} onClick={() => { setSelected(choice); setNotice(""); }}>
      {choice.icon ? <img src={choice.icon} alt="" loading="lazy" /> : <span>{choice.name}</span>}{choice.selected && <b aria-hidden="true">✓</b>}
    </button>)}</div>
    {!choices.length && <p>{search ? "No matching owned appearances." : "Bungie returned no owned choices for this category."}</p>}
    {selected && <div className={styles.selection}><span>{selected.name}</span><button type="button" disabled={!data.canApply || selected.selected || apply.isPending} onClick={() => apply.mutate(selected)}>{apply.isPending ? "Applying…" : selected.selected ? "Applied" : "Apply"}</button></div>}
    {notice && <p role="status">{notice}</p>}{apply.isError && <p role="alert">{apply.error.message} <button type="button" onClick={() => { setSelected(undefined); apply.reset(); void query.refetch(); }}>Refresh choices</button></p>}
    <small>Owned, compatible choices only. No purchases or currency spending.</small>
  </div>;
}
