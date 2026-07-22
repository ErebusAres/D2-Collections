import type { MailboxData, MailboxItem, MailboxPullRequest, MailboxPullResult } from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArchiveRestore, Inbox, Mail, PackageOpen, RefreshCw } from "lucide-react";
import { api, mutationHeaders } from "../services/api/client";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import styles from "./MailboxPage.module.css";

export function MailboxPage() {
  const { session, autoRefresh, refresh } = useGuardian();
  const queryClient = useQueryClient();
  const result = useQuery({
    queryKey: ["mailbox"],
    queryFn: () => api<MailboxData>("/api/v1/me/mailbox"),
    enabled: Boolean(session?.authenticated),
    refetchInterval: autoRefresh ? 60_000 : false,
    refetchIntervalInBackground: false
  });
  const pull = useMutation({
    mutationFn: (input: MailboxPullRequest) => api<MailboxPullResult>("/api/v1/me/mailbox/pull", { method: "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify(input) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mailbox"] });
      await refresh();
    }
  });
  const data = result.data?.data;
  const utilization = data?.capacity ? Math.min(100, Math.round(data.count / data.capacity * 100)) : 0;

  return <AuthGate>
    <PageHeader eyebrow="Recovered inventory" title="Mailbox" description="Review every item recovered by each character's Postmaster and pull supported items directly into that character's inventory." actions={<><Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} /><button className={styles.refresh} onClick={() => void result.refetch()}><RefreshCw size={14} /> Sync mailbox</button></>} />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(data)} onRetry={() => void result.refetch()} />
    {data && <>
      <section className={styles.overview}>
        <div><Inbox /><span>Account Postmaster</span><strong>{data.count} <small>/ {data.capacity || "capacity unavailable"}</small></strong></div>
        <div className={utilization >= 80 ? styles.warning : ""}><PackageOpen /><span>Capacity used</span><strong>{data.capacity ? `${utilization}%` : "Unavailable"}</strong></div>
        <div className={styles.capacityBar}><span style={{ width: `${utilization}%` }} /></div>
      </section>
      {data.characters.map((character) => <section className={styles.characterMailbox} key={character.characterId}>
        <header>{character.emblemPath ? <img src={character.emblemPath} alt="" /> : <Mail />}<div><span>{character.className} Postmaster</span><h2>{character.count} / {character.capacity || "?"} slots</h2></div><i><span style={{ width: `${character.capacity ? Math.min(100, character.count / character.capacity * 100) : 0}%` }} /></i></header>
        {character.items.length ? <div className={styles.itemGrid}>{character.items.map((item) => <MailboxItemCard key={item.instanceId || `${item.characterId}-${item.itemHash}`} item={item} busy={pull.isPending} onPull={(input) => pull.mutate(input)} />)}</div>
          : <div className={styles.empty}><PackageOpen /><strong>Postmaster clear</strong><span>No recovered items are waiting for this character.</span></div>}
      </section>)}
      {pull.data?.data.pulled && <div className={styles.success}><ArchiveRestore /> Item pulled into the character's inventory.</div>}
      {pull.error && <div className={styles.error}><AlertTriangle /> {pull.error.message}</div>}
    </>}
  </AuthGate>;
}

function MailboxItemCard({ item, busy, onPull }: { item: MailboxItem; busy: boolean; onPull: (input: MailboxPullRequest) => void }) {
  return <article className={`${styles.itemCard} ${!item.definitionAvailable ? styles.unavailable : ""}`}>
    <div className={styles.itemArt}>{item.icon ? <img src={item.icon} alt="" loading="lazy" /> : <span>Image unavailable</span>}{item.quantity > 1 && <b>×{item.quantity.toLocaleString()}</b>}</div>
    <main><span>{item.rarity} · {item.itemType}</span><h3>{item.name}</h3>{item.description && <p>{item.description}</p>}{!item.definitionAvailable && <em>Manifest definition unavailable</em>}</main>
    <button disabled={busy || !item.canPull} title={item.canPull ? `Pull ${item.name} to this character` : item.unavailableReason} onClick={() => onPull({ itemInstanceId: item.instanceId, characterId: item.characterId, quantity: item.quantity })}><ArchiveRestore />{item.canPull ? "Pull item" : "Unavailable"}</button>
  </article>;
}
