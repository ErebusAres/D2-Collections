import type { FireteamData } from "@guardian-nexus/contracts";
import { LogOut, RefreshCcw, Trash2, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, mutationHeaders, queuedApi } from "../../services/api/client";
import { pinsKey, useGuardian } from "../../context/GuardianContext";
import styles from "./OptionsPanel.module.css";

export function OptionsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const guardianState = useGuardian();
  const queryClient = useQueryClient();
  const session = guardianState.session;
  const fireteam = useQuery({
    queryKey: ["fireteam", guardianState.selectedCharacterId],
    queryFn: () => api<FireteamData>(`/api/v1/fireteam?characterId=${encodeURIComponent(guardianState.selectedCharacterId)}`),
    enabled: Boolean(open && session?.authenticated && guardianState.selectedCharacterId),
    staleTime: 30_000
  });
  const setPersistentSharing = useMutation({
    mutationFn: (enabled: boolean) => {
      if (!enabled) return queuedApi("/api/v1/fireteam/share", { method: "DELETE", headers: mutationHeaders(session?.csrfToken) });
      let sitePinnedQuestIds: string[] = [];
      try { sitePinnedQuestIds = JSON.parse(localStorage.getItem(pinsKey(session?.guardian?.membershipId || "", guardianState.selectedCharacterId)) || "[]") as string[]; } catch { sitePinnedQuestIds = []; }
      return queuedApi("/api/v1/fireteam/share", { method: "PUT", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ characterId: guardianState.selectedCharacterId, sitePinnedQuestIds, mode: "persistent" }) });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["fireteam"] })
  });
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
        {session?.authenticated && <section>
          <h3>Fireteam privacy</h3>
          <Toggle label="Always share with friends" description={fireteam.data?.data.sharingMode === "persistent" ? "Background updates are active until you disable sharing or sign out." : "Keep a timestamped last-known snapshot visible to your current fireteam."} checked={fireteam.data?.data.sharingMode === "persistent"} onChange={(value) => setPersistentSharing.mutate(value)} />
        </section>}
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
