import type { BuildData, BuildDocument, GuardianBuild } from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Eye, FilePenLine, Save, Send, ShieldX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BuildDetailSections } from "../components/builds/BuildDetailSections";
import { BuildEditorBasics } from "../components/builds/BuildEditorBasics";
import { BuildEditorConfiguration } from "../components/builds/BuildEditorConfiguration";
import { ClassIcon, SubclassIcon } from "../components/builds/BuildIcon";
import { AuthGate, PageHeader, QueryState } from "../components/common/Page";
import { emptyBuildDocument, prepareBuildDocument, titleCase } from "../modules/builds/builds";
import { useGuardian } from "../context/GuardianContext";
import { api, mutationHeaders } from "../services/api/client";
import styles from "./Builds.module.css";

export function BuildEditorPage() {
  return <AuthGate><BuildEditor /></AuthGate>;
}

function BuildEditor() {
  const { buildId } = useParams();
  const editing = Boolean(buildId);
  const { session } = useGuardian();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const initialized = useRef(false);
  const [draft, setDraft] = useState<BuildDocument>(emptyBuildDocument);
  const [preview, setPreview] = useState(false);
  const existing = useQuery({ queryKey: ["build", buildId], queryFn: () => api<BuildData>(`/api/v1/builds/${encodeURIComponent(buildId || "")}`), enabled: editing && Boolean(session?.roles.buildEditor) });
  useEffect(() => {
    if (!existing.data?.data.build || initialized.current) return;
    setDraft(documentFromBuild(existing.data.data.build));
    initialized.current = true;
  }, [existing.data]);
  const save = useMutation({
    mutationFn: (document: BuildDocument) => api<BuildData>(editing ? `/api/v1/builds/${encodeURIComponent(buildId || "")}` : "/api/v1/builds", { method: editing ? "PUT" : "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify(document) }),
    onSuccess: (result) => { void queryClient.invalidateQueries({ queryKey: ["builds"] }); navigate(`/builds/${result.data.build.slug}`); }
  });
  const submit = (status: "draft" | "published") => {
    if (!formRef.current?.reportValidity()) return;
    if (!draft.tags.length) return;
    save.mutate(prepareBuildDocument({ ...draft, status, visibility: status === "published" ? "public" : "private" }));
  };
  const previewBuild: GuardianBuild = { ...prepareBuildDocument(draft), id: "preview", slug: "preview", authorMembershipId: session?.guardian?.membershipId || "preview", authorDisplayName: session?.guardian?.displayName || "Guardian", rating: { upvotes: 0, downvotes: 0, total: 0, score: 0 }, canEdit: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

  if (!session?.roles.buildEditor) return <><PageHeader eyebrow="Restricted authoring" title="Build editor" description="Published builds are public, but creation and editing are currently limited to the three approved Guardian Matrix identities." /><section className={styles.editorDenied}><ShieldX /><h2>Browse access only</h2><p>This Bungie identity is not on the Builds editor allowlist.</p></section></>;
  return <>
    <PageHeader eyebrow={editing ? "Revise Guardian field guide" : "New Guardian field guide"} title={editing ? "Edit build" : "Build creator"} description="Compose a complete, scannable build using the same modular Guardian Nexus visual system. Empty optional sections remain clearly unavailable instead of being filled with dummy data." actions={<button className={styles.secondaryAction} type="button" onClick={() => setPreview((value) => !value)}><Eye /> {preview ? "Return to editor" : "Preview build"}</button>} />
    {editing && <QueryState loading={existing.isLoading} error={existing.error as Error} hasData={Boolean(existing.data)} onRetry={() => void existing.refetch()} />}
    {(!editing || existing.data) && (preview ? <section className={styles.editorPreview}><header><Eye /><span><strong>Private preview</strong><small>This is not published or saved.</small></span></header><div className={styles.buildHero}><SubclassIcon subclass={previewBuild.subclass} icon={previewBuild.subclassIcon} large /><div><span><ClassIcon classType={previewBuild.classType} /> {titleCase(previewBuild.classType)} · {titleCase(previewBuild.subclass)}</span><h2>{previewBuild.title || "Untitled build"}</h2><p>{previewBuild.summary || "No card summary yet."}</p></div></div><BuildDetailSections build={previewBuild} /></section> : <form ref={formRef} className={styles.buildEditor} onSubmit={(event) => event.preventDefault()}>
      <BuildEditorBasics value={draft} onChange={setDraft} />
      <BuildEditorConfiguration value={draft} onChange={setDraft} />
      <section className={styles.publishPanel}><div><FilePenLine /><span><strong>Publish / review</strong><small>Save privately as a draft, or publish immediately to the public Builds catalog.</small></span></div><button type="button" disabled={save.isPending} onClick={() => submit("draft")}><Save /> Save draft</button><button type="button" className={styles.publishButton} disabled={save.isPending} onClick={() => submit("published")}><Send /> Publish build</button></section>
      {!draft.tags.length && <div className={styles.editorWarning}><AlertTriangle /> Add at least one tag before saving.</div>}
      {save.isSuccess && <div className={styles.editorSuccess}><Check /> Build saved.</div>}
      {save.error && <div className={styles.editorError}><AlertTriangle /> {save.error.message}</div>}
    </form>)}
  </>;
}

function documentFromBuild(build: GuardianBuild): BuildDocument {
  return {
    title: build.title,
    originalCreatorName: build.originalCreatorName,
    classType: build.classType,
    subclass: build.subclass,
    subclassIcon: build.subclassIcon,
    tags: build.tags,
    activityTags: build.activityTags,
    summary: build.summary,
    notes: build.notes,
    links: build.links,
    subclassConfig: build.subclassConfig,
    equipment: build.equipment,
    statPriorities: build.statPriorities,
    armorMods: build.armorMods,
    artifacts: build.artifacts,
    gameplayLoop: build.gameplayLoop,
    cosmetics: build.cosmetics,
    patch: build.patch,
    outdated: build.outdated,
    changelog: build.changelog,
    status: build.status,
    visibility: build.visibility
  };
}
