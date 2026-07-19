import type { BuildData, BuildDocument, BuildWorkingDraftData, GuardianBuild } from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Circle, CloudOff, Eye, FileInput, FilePenLine, RotateCcw, Save, Send, ShieldX, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BuildDetailSections } from "../components/builds/BuildDetailSections";
import { BuildEditorBasics } from "../components/builds/BuildEditorBasics";
import { BuildEditorConfiguration } from "../components/builds/BuildEditorConfiguration";
import { ClassIcon, SubclassIcon } from "../components/builds/BuildIcon";
import { AuthGate, PageHeader, QueryState } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import { buildCompletion } from "../modules/builds/buildCompletion";
import { clearBuildRecovery, readBuildRecovery, writeBuildRecovery, type BuildRecoveryRecord } from "../modules/builds/buildDraftRecovery";
import { emptyBuildDocument, prepareBuildDocument, titleCase } from "../modules/builds/builds";
import { normalizeBuildStatPriorities } from "../modules/builds/buildStats";
import { readLoadoutBuildImport, removeLoadoutBuildImport } from "../modules/loadouts/loadoutBuildImport";
import { api, mutationHeaders } from "../services/api/client";
import styles from "./Builds.module.css";

export function BuildEditorPage() { return <AuthGate><BuildEditor /></AuthGate>; }

function BuildEditor() {
  const { buildId = "" } = useParams();
  const editing = Boolean(buildId);
  const { session } = useGuardian();
  const membershipId = session?.guardian?.membershipId || "";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const importToken = editing ? "" : searchParams.get("fromLoadout") || "";
  const loadoutImport = useMemo(() => readLoadoutBuildImport(importToken), [importToken]);
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const hydrated = useRef(false);
  const draftRef = useRef<BuildDocument>(loadoutImport?.document || emptyBuildDocument());
  const [draft, setDraftState] = useState<BuildDocument>(() => loadoutImport?.document || emptyBuildDocument());
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [recovery, setRecovery] = useState<BuildRecoveryRecord>();
  const [serverAutosave, setServerAutosave] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string>();
  const [publishReview, setPublishReview] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);

  const existing = useQuery({ queryKey: ["build", buildId], queryFn: () => api<BuildData>(`/api/v1/builds/${encodeURIComponent(buildId)}`), enabled: editing && Boolean(session?.roles.buildEditor) });
  const working = useQuery({ queryKey: ["build-working-draft", buildId], queryFn: () => api<BuildWorkingDraftData>(`/api/v1/builds/${encodeURIComponent(buildId)}/working-draft`), enabled: editing && Boolean(session?.roles.buildEditor) });
  const existingBuild = existing.data?.data.build;

  const setDraft = (next: BuildDocument) => { draftRef.current = next; setDraftState(next); if (hydrated.current) setDirty(true); };
  useEffect(() => { draftRef.current = draft; }, [draft]);

  useEffect(() => {
    if (!membershipId || hydrated.current) return;
    if (editing) {
      if (!existingBuild || !working.isFetched) return;
      const initial = working.data?.data.draft?.document || documentFromBuild(existingBuild);
      draftRef.current = initial;
      setDraftState(initial);
      setServerAutosave(existingBuild.status === "draft" || Boolean(working.data?.data.draft));
      setLastSavedAt(working.data?.data.draft?.savedAt || existingBuild.updatedAt);
    }
    const saved = readBuildRecovery(membershipId, buildId || "new");
    if (saved && JSON.stringify(saved.document) !== JSON.stringify(draftRef.current)) setRecovery(saved);
    hydrated.current = true;
    if (loadoutImport) setDirty(true);
  }, [buildId, editing, existingBuild, loadoutImport, membershipId, working.data, working.isFetched]);

  useEffect(() => {
    if (hydrated.current && importToken) removeLoadoutBuildImport(importToken);
  }, [importToken, membershipId]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  useEffect(() => {
    if (!dirty || !membershipId || !hydrated.current) return;
    const timer = window.setTimeout(() => writeBuildRecovery(membershipId, buildId || "new", draft), 750);
    return () => window.clearTimeout(timer);
  }, [buildId, dirty, draft, membershipId]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const markSaved = (savedDocument: BuildDocument, savedAt = new Date().toISOString()) => {
    const current = prepareBuildDocument({ ...draftRef.current, status: savedDocument.status, visibility: savedDocument.visibility });
    if (JSON.stringify(current) === JSON.stringify(savedDocument)) {
      setDirty(false);
      if (membershipId) clearBuildRecovery(membershipId, buildId || "new");
    }
    setLastSavedAt(savedAt);
  };

  const autosave = useMutation({
    mutationFn: async (document: BuildDocument) => {
      if (!existingBuild) throw new Error("Save this new build once before autosave begins.");
      if (existingBuild.status === "published") return api<BuildWorkingDraftData>(`/api/v1/builds/${encodeURIComponent(buildId)}/working-draft`, { method: "PUT", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ document, baseUpdatedAt: existingBuild.updatedAt }) });
      return api<BuildData>(`/api/v1/builds/${encodeURIComponent(buildId)}`, { method: "PUT", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify(document) });
    },
    onSuccess: (result, document) => markSaved(document, "draft" in result.data && result.data.draft ? result.data.draft.savedAt : new Date().toISOString())
  });

  useEffect(() => {
    if (!serverAutosave || !dirty || !editing || !online || autosave.isPending) return;
    const timer = window.setTimeout(() => autosave.mutate(prepareBuildDocument({ ...draftRef.current, status: "draft", visibility: "private" })), 3_000);
    return () => window.clearTimeout(timer);
  }, [autosave.isPending, dirty, draft, editing, online, serverAutosave]);

  const create = useMutation({
    mutationFn: (document: BuildDocument) => api<BuildData>("/api/v1/builds", { method: "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify(document) }),
    onSuccess: (result, document) => {
      markSaved(document);
      if (membershipId) clearBuildRecovery(membershipId, "new");
      void queryClient.invalidateQueries({ queryKey: ["builds"] });
      navigate(`/builds/${result.data.build.slug}/edit`, { replace: true });
    }
  });

  const publish = useMutation({
    mutationFn: (document: BuildDocument) => api<BuildData>(editing ? `/api/v1/builds/${encodeURIComponent(buildId)}` : "/api/v1/builds", { method: editing ? "PUT" : "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify(document) }),
    onSuccess: (result) => {
      if (membershipId) clearBuildRecovery(membershipId, buildId || "new");
      setDirty(false); setPublishReview(false);
      void queryClient.invalidateQueries({ queryKey: ["builds"] });
      navigate(`/builds/${result.data.build.slug}`);
    }
  });
  const discardWorking = useMutation({
    mutationFn: () => api<BuildWorkingDraftData>(`/api/v1/builds/${encodeURIComponent(buildId)}/working-draft`, { method: "DELETE", headers: mutationHeaders(session?.csrfToken) }),
    onSuccess: () => {
      if (!existingBuild) return;
      const original = documentFromBuild(existingBuild);
      draftRef.current = original; setDraftState(original); setDirty(false); setServerAutosave(false);
      if (membershipId) clearBuildRecovery(membershipId, buildId);
      void queryClient.invalidateQueries({ queryKey: ["build-working-draft", buildId] });
    }
  });

  const saveDraft = () => {
    if (!formRef.current?.reportValidity() || !draft.tags.length) return;
    const document = prepareBuildDocument({ ...draft, status: "draft", visibility: "private" });
    if (editing) { setServerAutosave(true); autosave.mutate(document); }
    else create.mutate(document);
  };
  const reviewPublish = () => { if (formRef.current?.reportValidity() && draft.tags.length) setPublishReview(true); };
  const confirmPublish = () => publish.mutate(prepareBuildDocument({ ...draft, status: "published", visibility: "public" }));
  const completion = useMemo(() => buildCompletion(draft), [draft]);
  const previewBuild: GuardianBuild = { ...prepareBuildDocument(draft), id: "preview", slug: "preview", authorMembershipId: membershipId || "preview", authorDisplayName: session?.guardian?.displayName || "Guardian", rating: { upvotes: 0, downvotes: 0, total: 0, score: 0 }, canEdit: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const pending = autosave.isPending || create.isPending || publish.isPending;
  const saveError = autosave.error || create.error || publish.error;

  if (!session?.roles.buildEditor) return <><PageHeader eyebrow="Restricted authoring" title="Build editor" description="Published builds are public, but creation and editing are currently limited to the three approved Guardian Matrix identities." /><section className={styles.editorDenied}><ShieldX /><h2>Browse access only</h2><p>This Bungie identity is not on the Builds editor allowlist.</p></section></>;
  return <>
    <PageHeader eyebrow={editing ? "Revise Guardian field guide" : "New Guardian field guide"} title={editing ? "Edit build" : "Build creator"} description="Select official Destiny configuration data, review completion, and publish without risking the live build." actions={<button className={styles.secondaryAction} type="button" onClick={() => setPreview((value) => !value)}><Eye /> {preview ? "Hide preview" : "Preview build"}</button>} />
    {editing && <QueryState loading={existing.isLoading || working.isLoading} error={(existing.error || working.error) as Error} hasData={Boolean(existing.data && working.isFetched)} onRetry={() => { void existing.refetch(); void working.refetch(); }} />}
    {loadoutImport && <section className={`${styles.recoveryBanner} ${styles.importBanner}`}><FileInput /><span><strong>Imported from {loadoutImport.sourceName}</strong><small>Saved equipment, subclass choices, mods, cosmetics, and Artifact perks were prefilled. Complete the guide details, stats, tags, and gameplay notes before publishing.</small></span></section>}
    {recovery && <section className={styles.recoveryBanner}><RotateCcw /><span><strong>Unsaved recovery found</strong><small>Saved locally {new Date(recovery.savedAt).toLocaleString()}.</small></span><button type="button" onClick={() => { setDraft(recovery.document); setRecovery(undefined); }}>Restore</button><button type="button" onClick={() => { clearBuildRecovery(membershipId, buildId || "new"); setRecovery(undefined); }}><Trash2 /> Discard</button></section>}
    {serverAutosave && existingBuild?.status === "published" && <section className={styles.recoveryBanner}><Save /><span><strong>Private working draft active</strong><small>The published build remains unchanged until Review &amp; Publish.</small></span><span /><button type="button" disabled={discardWorking.isPending} onClick={() => discardWorking.mutate()}><Trash2 /> Discard working draft</button></section>}
    {(!editing || existing.data) && <>
      <nav className={styles.builderProgress} aria-label="Build completion">{completion.map((entry) => <span key={entry.id} data-state={entry.state} title={entry.errors.join(" ")}><i>{entry.state === "complete" ? <Check /> : entry.state === "needs-attention" ? <AlertTriangle /> : <Circle />}</i><b>{entry.label}</b><small>{entry.state === "needs-attention" ? `${entry.errors.length} issue${entry.errors.length === 1 ? "" : "s"}` : entry.state}</small></span>)}</nav>
      <div className={styles.editorWorkspace} data-preview={preview}>
        <form ref={formRef} className={styles.buildEditor} onSubmit={(event) => event.preventDefault()}>
          <BuildEditorBasics value={draft} onChange={setDraft} />
          <BuildEditorConfiguration value={draft} onChange={setDraft} />
          <section className={styles.publishPanel}><div><FilePenLine /><span><strong>{!online ? "Offline recovery" : pending ? "Saving changes" : dirty ? "Unsaved changes" : "Draft protected"}</strong><small>{!online ? "Changes remain safe in this browser until connection returns." : lastSavedAt ? `Last saved ${new Date(lastSavedAt).toLocaleTimeString()}.` : "Save privately before publishing."}</small></span></div><button type="button" disabled={pending || !online} onClick={saveDraft}>{online ? <Save /> : <CloudOff />} Save draft</button><button type="button" className={styles.publishButton} disabled={pending || !online} onClick={reviewPublish}><Send /> Review & publish</button></section>
          {!draft.tags.length && <div className={styles.editorWarning}><AlertTriangle /> Add at least one tag before saving.</div>}
          {autosave.isSuccess && !dirty && <div className={styles.editorSuccess}><Check /> Draft saved safely.</div>}
          {saveError && <div className={styles.editorError}><AlertTriangle /> {saveError.message}</div>}
        </form>
        {preview && <aside className={styles.editorPreview}><header><Eye /><span><strong>Private preview</strong><small>This reflects the current unsaved editor state.</small></span></header><div className={styles.buildHero}><SubclassIcon subclass={previewBuild.subclass} icon={previewBuild.subclassIcon} large /><div><span><ClassIcon classType={previewBuild.classType} icon={previewBuild.classIcon} /> {titleCase(previewBuild.classType)} · {titleCase(previewBuild.subclass)}</span><h2>{previewBuild.title || "Untitled build"}</h2><p>{previewBuild.summary || "No card summary yet."}</p></div></div><BuildDetailSections build={previewBuild} showEmpty /></aside>}
      </div>
    </>}
    {publishReview && <div className={styles.publishReviewBackdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPublishReview(false)}><section className={styles.publishReview} role="dialog" aria-modal="true" aria-labelledby="publish-review-title"><header><Send /><div><span>Final review</span><h2 id="publish-review-title">Publish {draft.title}</h2></div></header><p>This will make the current editor version public. Autosaved working drafts never publish on their own.</p><div>{completion.map((entry) => <span key={entry.id} data-state={entry.state}><b>{entry.label}</b><small>{entry.state === "optional" ? "Optional information not required" : entry.errors.join(" ") || "Ready"}</small></span>)}</div><footer><button type="button" onClick={() => setPublishReview(false)}>Return to editor</button><button type="button" className={styles.publishButton} disabled={publish.isPending} onClick={confirmPublish}><Send /> Publish build</button></footer></section></div>}
  </>;
}

function documentFromBuild(build: GuardianBuild): BuildDocument {
  return { title: build.title, originalCreatorName: build.originalCreatorName, classType: build.classType, classIcon: build.classIcon, subclass: build.subclass, subclassIcon: build.subclassIcon, tags: build.tags, activityTags: build.activityTags, summary: build.summary, notes: build.notes, concepts: build.concepts, championCounters: build.championCounters, links: build.links, subclassConfig: build.subclassConfig, equipment: build.equipment, statPriorities: normalizeBuildStatPriorities(build.statPriorities), armorMods: build.armorMods, artifacts: build.artifacts, gameplayLoop: build.gameplayLoop, cosmetics: build.cosmetics, patch: build.patch, outdated: build.outdated, changelog: build.changelog, status: build.status, visibility: build.visibility };
}
