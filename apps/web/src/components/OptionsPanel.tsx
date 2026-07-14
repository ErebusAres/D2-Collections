import { LogOut, RefreshCcw, Trash2, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, mutationHeaders } from "../api/client";
import { useGuardian } from "../state/GuardianContext";
import styles from "./OptionsPanel.module.css";

export function OptionsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const guardianState = useGuardian();
  const queryClient = useQueryClient();
  const session = guardianState.session;
  const signOut = useMutation({
    mutationFn: () => api("/api/v1/session", { method: "DELETE", headers: mutationHeaders(session?.csrfToken) }),
    onSuccess: () => { queryClient.clear(); window.location.href = "/collection"; }
  });

  return (
    <>
      <button className={`${styles.scrim} ${open ? styles.open : ""}`} onClick={onClose} aria-label="Close options" tabIndex={open ? 0 : -1} />
      <aside className={`${styles.panel} ${open ? styles.open : ""}`} aria-hidden={!open}>
        <header><div><span>Guardian settings</span><h2>Options</h2></div><button onClick={onClose} aria-label="Close"><X /></button></header>
        <section>
          <h3>Selected Guardian</h3>
          <div className={styles.characters}>
            {session?.guardian?.characters.map((character) => (
              <button key={character.characterId} className={guardianState.selectedCharacterId === character.characterId ? styles.selected : ""} onClick={() => guardianState.selectCharacter(character.characterId)}>
                <img src={character.emblemPath} alt="" /><span><b>{character.className}</b><small>{character.power} Power</small></span>
              </button>
            )) || <p>Sign in to choose a character.</p>}
          </div>
        </section>
        <section>
          <h3>Experience</h3>
          <Toggle label="Auto-refresh live data" description="Refresh visible live pages every 60 seconds." checked={guardianState.autoRefresh} onChange={guardianState.setAutoRefresh} />
          <Toggle label="Reduce motion" description="Disable non-essential interface movement." checked={guardianState.reducedMotion} onChange={guardianState.setReducedMotion} />
        </section>
        <section className={styles.actions}>
          <button onClick={() => void guardianState.refresh()}><RefreshCcw size={17} /> Refresh all data</button>
          <button onClick={() => { Object.keys(localStorage).filter((key) => key.startsWith("guardian-nexus:")).forEach((key) => localStorage.removeItem(key)); window.location.reload(); }}><Trash2 size={17} /> Clear local preferences</button>
          {session?.authenticated && <button className={styles.danger} onClick={() => signOut.mutate()} disabled={signOut.isPending}><LogOut size={17} /> Sign out</button>}
        </section>
      </aside>
    </>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className={styles.toggle}><span><b>{label}</b><small>{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /></label>;
}
