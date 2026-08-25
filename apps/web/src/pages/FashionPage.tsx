import type { BuildCatalogEntry, BuildGuardianClass, BuildNamedEntry, FashionLook, FashionLooksDocument } from "@guardian-nexus/contracts";
import { Copy, Download, Palette, Plus, Save, ShieldQuestion, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { AuthGate, PageHeader } from "../components/common/Page";
import { ManifestSingleEditor } from "../components/builds/ManifestPicker";
import { useGuardian } from "../context/GuardianContext";
import { emptyFashionLook, FASHION_SLOTS, importFashionLook, parseFashionLooks, portableFashionLook } from "../modules/fashion/fashion";
import styles from "./FashionPage.module.css";

const cloneLook = (look: FashionLook): FashionLook => JSON.parse(JSON.stringify(look)) as FashionLook;
const ornament = (entry: BuildCatalogEntry) => /armor|universal/.test(entry.itemType.toLocaleLowerCase()) && entry.itemType.toLocaleLowerCase().includes("ornament");
const shader = (entry: BuildCatalogEntry) => entry.itemType.toLocaleLowerCase() === "shader";

export function FashionPage() {
  const { preferences, setPreference, session, selectedCharacterId } = useGuardian();
  const document = useMemo(() => parseFashionLooks(preferences["fashion.looks.v1"]), [preferences]);
  const characterClass = session?.guardian?.characters.find((entry) => entry.characterId === selectedCharacterId)?.className.toLocaleLowerCase();
  const defaultClass: BuildGuardianClass = characterClass === "titan" || characterClass === "warlock" ? characterClass : "hunter";
  const [draft, setDraft] = useState(() => emptyFashionLook(defaultClass));
  const [editingId, setEditingId] = useState<string>();
  const [message, setMessage] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const saveDocument = (next: FashionLooksDocument) => setPreference("fashion.looks.v1", JSON.stringify(next));
  const patchSlot = (index: number, field: "ornament" | "shader", value?: BuildNamedEntry) => setDraft((current) => ({ ...current, slots: current.slots.map((slot, slotIndex) => slotIndex === index ? { ...slot, [field]: value } : slot) }));
  const save = () => {
    const name = draft.name.trim().slice(0, 80);
    if (!name) { setMessage("Name the look before saving it."); return; }
    const now = new Date().toISOString();
    const look = { ...draft, name, note: draft.note?.trim().slice(0, 600) || undefined, updatedAt: now };
    const looks = editingId ? document.looks.map((entry) => entry.id === editingId ? look : entry) : [look, ...document.looks].slice(0, 20);
    saveDocument({ schemaVersion: 1, looks }); setEditingId(look.id); setDraft(look); setMessage("Saved privately to your Guardian Nexus account.");
  };
  const open = (look: FashionLook) => { setEditingId(look.id); setDraft(cloneLook(look)); setMessage(""); };
  const fresh = () => { setEditingId(undefined); setDraft(emptyFashionLook(defaultClass)); setMessage(""); };
  const remove = (look: FashionLook) => { saveDocument({ schemaVersion: 1, looks: document.looks.filter((entry) => entry.id !== look.id) }); if (editingId === look.id) fresh(); };
  const applyShader = (value: BuildNamedEntry | undefined) => setDraft((current) => ({ ...current, slots: current.slots.map((slot) => ({ ...slot, shader: value })) }));
  const exportLook = (look: FashionLook) => {
    const href = URL.createObjectURL(new Blob([JSON.stringify(portableFashionLook(look), null, 2)], { type: "application/json" }));
    const anchor = globalThis.document.createElement("a"); anchor.href = href; anchor.download = `${look.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "guardian-look"}.json`; anchor.click(); URL.revokeObjectURL(href);
    setMessage("Exported this look without your Guardian name or account details.");
  };
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file || document.looks.length >= 20) return;
    try { const look = importFashionLook(await file.text()); saveDocument({ schemaVersion: 1, looks: [look, ...document.looks] }); open(look); setMessage(`Imported ${look.name} as a private look.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Fashion import failed."); }
  };

  return <AuthGate>
    <PageHeader eyebrow="Guardian style" title="Fashion workspace" description="Plan armor ornaments and shaders, save private looks, and share them without changing your equipped gear." actions={<button className={styles.newLook} type="button" onClick={fresh}><Plus /> New look</button>} />
    <section className={styles.honesty}><ShieldQuestion /><div><strong>Preview only</strong><p>This workspace does not yet check whether you own each ornament or shader. Saving a look will not equip it or make it public.</p></div></section>
    <section className={styles.layout}>
      <section className={styles.editor}>
        <header><Palette /><div><span>{editingId ? "Editing private look" : "New private look"}</span><h2>{draft.name || "Untitled look"}</h2></div></header>
        <div className={styles.basics}><label><span>Look name</span><input maxLength={80} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Void Regent" /></label><label><span>Guardian class</span><select value={draft.classType} onChange={(event) => setDraft({ ...draft, classType: event.target.value as BuildGuardianClass })}><option value="hunter">Hunter</option><option value="titan">Titan</option><option value="warlock">Warlock</option></select></label></div>
        <div className={styles.globalShader}><ManifestSingleEditor value={commonShader(draft)} onChange={applyShader} kind="cosmetic" label="Apply one shader to every slot" placeholder="Search official shaders…" filterEntry={shader} /></div>
        <div className={styles.slots}>{draft.slots.map((slot, index) => <article key={slot.slot}>
          <header><span>{index + 1}</span><h3>{FASHION_SLOTS.find((entry) => entry.slot === slot.slot)?.label}</h3></header>
          <ManifestSingleEditor value={slot.ornament} onChange={(value) => patchSlot(index, "ornament", value)} kind="cosmetic" label="Armor ornament" placeholder={`Search ${draft.classType} armor ornaments…`} context={{ classType: draft.classType }} filterEntry={ornament} />
          <ManifestSingleEditor value={slot.shader} onChange={(value) => patchSlot(index, "shader", value)} kind="cosmetic" label="Shader" placeholder="Search official shaders…" filterEntry={shader} />
        </article>)}</div>
        <label className={styles.notes}><span>Styling notes <small>Optional</small></span><textarea maxLength={600} rows={3} value={draft.note || ""} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Silhouette, color balance, alternate pieces…" /></label>
        <footer><button type="button" onClick={save} disabled={!draft.name.trim()}><Save /> Save private look</button>{message && <p role="status">{message}</p>}</footer>
      </section>
      <aside className={styles.library}>
        <header><div><span>Private library</span><h2>Saved looks</h2></div><strong>{document.looks.length}/20</strong></header>
        <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => void importFile(event)} /><button className={styles.import} type="button" onClick={() => importRef.current?.click()} disabled={document.looks.length >= 20}><Upload /> Import portable look</button>
        {!document.looks.length && <div className={styles.empty}><Palette /><strong>No saved looks yet</strong><p>Build your first five-slot fashion reference, then save it here.</p></div>}
        <div className={styles.looks}>{document.looks.map((look) => <article key={look.id} data-selected={editingId === look.id}>
          <button type="button" className={styles.lookBody} onClick={() => open(look)}><LookStrip look={look} /><span><small>{look.classType}</small><strong>{look.name}</strong><em>{look.slots.filter((slot) => slot.ornament || slot.shader).length}/5 styled</em></span></button>
          <footer><button type="button" onClick={() => { const copy = { ...cloneLook(look), id: emptyFashionLook(look.classType).id, name: `${look.name} copy`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; saveDocument({ schemaVersion: 1, looks: [copy, ...document.looks].slice(0, 20) }); open(copy); }}><Copy /> Duplicate</button><button type="button" onClick={() => exportLook(look)}><Download /> Export</button><button type="button" aria-label={`Delete ${look.name}`} onClick={() => remove(look)}><Trash2 /></button></footer>
        </article>)}</div>
      </aside>
    </section>
  </AuthGate>;
}

function commonShader(look: FashionLook): BuildNamedEntry | undefined {
  const shaders = look.slots.map((slot) => slot.shader).filter((entry): entry is BuildNamedEntry => Boolean(entry));
  const first = shaders[0];
  return first && shaders.length === look.slots.length && shaders.every((entry) => entry.hash ? entry.hash === first.hash : entry.name === first.name) ? first : undefined;
}

function LookStrip({ look }: { look: FashionLook }) {
  return <i className={styles.lookStrip}>{look.slots.map((slot) => <span key={slot.slot}>{slot.ornament?.icon || slot.shader?.icon ? <img src={slot.ornament?.icon || slot.shader?.icon} alt="" loading="lazy" /> : <Palette />}</span>)}</i>;
}
