import { useEffect, useMemo, useRef, useState } from "react";

import { ProjectStatusDot } from "./ProjectStatusDot.tsx";
import { WorkspaceEditorOverlay } from "./WorkspaceEditorOverlay.tsx";
import { canReadScreenStudioThemes, readScreenStudioThemes, type ScreenStudioThemeReadRecord } from "./screen-studio-theme-gateway.ts";
import { createLocalThemeDraft, discardThemeDraft, duplicateThemeDraft, removeThemeDraft, saveThemeDraft, updateThemeDraft, updateThemeToken, type ScreenStudioThemeDraftEntry } from "./screen-studio-theme-drafts.ts";
import { filterScreenStudioThemeRecords, screenStudioThemeTokenEntries } from "./screen-studio-theme-records.ts";
import type { AuthorizationProjection } from "./workspace-model.ts";

type ThemeServerState = Readonly<{
  phase: "loading" | "ready" | "unavailable";
  records: readonly ScreenStudioThemeReadRecord[];
  message: string;
}>;

export function ScreenStudioThemesPanel({ authorization, expectedAuthorizationRevision }: Readonly<{ authorization: AuthorizationProjection | null; expectedAuthorizationRevision: number }>) {
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<readonly ScreenStudioThemeDraftEntry[]>([]);
  const [server, setServer] = useState<ThemeServerState>({ phase: "loading", records: [], message: "Loading styles…" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [notice, setNotice] = useState("");
  const [retryGeneration, setRetryGeneration] = useState(0);
  const requestGeneration = useRef(0);
  const draftAuthorizationRevision = useRef(expectedAuthorizationRevision);
  const authorized = canReadScreenStudioThemes(authorization, expectedAuthorizationRevision);

  useEffect(() => {
    if (draftAuthorizationRevision.current === expectedAuthorizationRevision && authorized) return;
    draftAuthorizationRevision.current = expectedAuthorizationRevision;
    setDrafts([]);
    setSelectedId(null);
    setErrors({});
    setNotice("");
  }, [authorized, expectedAuthorizationRevision]);

  useEffect(() => {
    const generation = ++requestGeneration.current;
    const controller = new AbortController();
    if (!authorized) {
      setServer({ phase: "unavailable", records: [], message: "Styles are unavailable because Workspace authorization is missing or stale." });
      return () => controller.abort();
    }
    setServer({ phase: "loading", records: [], message: "Loading styles…" });
    void readScreenStudioThemes(authorization, expectedAuthorizationRevision, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted || generation !== requestGeneration.current) return;
      if (!result.ok) {
        setServer({ phase: "unavailable", records: [], message: result.message });
        setSelectedId((current) => drafts.some((entry) => entry.record.id === current) ? current : null);
        return;
      }
      setServer({ phase: "ready", records: result.records, message: "" });
      setSelectedId((current) => current && (drafts.some((entry) => entry.record.id === current) || result.records.some((record) => record.id === current)) ? current : null);
    });
    return () => controller.abort();
  }, [authorization, authorized, expectedAuthorizationRevision, retryGeneration]);

  const allRecords = useMemo(() => [...drafts.map((entry) => entry.record), ...server.records], [drafts, server.records]);
  const visible = useMemo(() => filterScreenStudioThemeRecords(allRecords, query), [allRecords, query]);
  const selectedDraft = selectedId ? drafts.find((entry) => entry.record.id === selectedId) : undefined;
  const selectedServer = selectedId ? server.records.find((record) => record.id === selectedId) : undefined;
  const selected = selectedDraft?.record ?? selectedServer ?? null;
  const selectedVisible = selected ? visible.some((record) => record.id === selected.id) : false;
  const template = selectedServer ?? server.records[0];

  const createTheme = () => {
    if (!template) return;
    const next = createLocalThemeDraft(drafts, template);
    setDrafts(next.entries);
    setSelectedId(next.selectedId);
    setQuery("");
    setErrors({});
    setNotice("Local draft created — not published.");
  };
  const closeEditor = () => { setSelectedId(null); setErrors({}); setNotice(""); };
  const discard = () => {
    if (!selectedDraft) return;
    setDrafts((current) => discardThemeDraft(current, selectedDraft.record.id));
    closeEditor();
  };
  const save = () => {
    if (!selectedDraft) return;
    const result = saveThemeDraft(drafts, selectedDraft.record.id);
    setErrors(result.errors);
    setDrafts(result.entries);
    if (!Object.keys(result.errors).length) setNotice("Saved in this session only — not published.");
  };
  const duplicate = () => {
    if (!selectedDraft) return;
    const next = duplicateThemeDraft(drafts, selectedDraft.record.id);
    if (!next) return;
    setDrafts(next.entries);
    setSelectedId(next.selectedId);
    setQuery("");
    setErrors({});
    setNotice("Local draft copy created — not published.");
  };
  const remove = () => {
    if (!selectedDraft) return;
    if (selectedDraft.dirty && !window.confirm("Discard unsaved changes and remove this local draft?")) return;
    setDrafts((current) => removeThemeDraft(current, selectedDraft.record.id));
    closeEditor();
  };

  return <section className="screen-studio-manager screen-studio-themes" aria-labelledby="screen-studio-themes-title">
    <header className="screen-studio-manager__header"><div><span className="screen-studio-eyebrow">Gateway style tokens and local drafts</span><h2 id="screen-studio-themes-title">Styles</h2><p>Server style records are read-only. Local drafts remain in this tab only and vanish on reload.</p></div><button type="button" onClick={createTheme} disabled={!template}>Create Style</button></header>
    <div className="screen-studio-manager__toolbar"><label>Search <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search styles or tokens…" /></label><span aria-live="polite">{visible.length} of {allRecords.length} styles</span></div>
    <div className="screen-studio-manager__body screen-studio-themes__body workspace-overlay-host">
      <div className="screen-studio-manager__list" role="listbox" aria-label="Style records">
        {drafts.length ? <p className="screen-studio-themes__section-label">Local drafts — not published</p> : null}
        {visible.map((record) => {
          const local = drafts.some((entry) => entry.record.id === record.id);
          return <button type="button" role="option" aria-selected={record.id === selected?.id && selectedVisible} className={record.id === selected?.id && selectedVisible ? "is-selected" : ""} data-theme-origin={local ? "local-draft" : "gateway"} key={record.id} onClick={() => setSelectedId((current) => current === record.id ? null : record.id)}><span><b>{record.name}</b><small>{local ? "Local draft — not published" : "Gateway projection — read only"} · {screenStudioThemeTokenEntries(record).length} tokens</small></span><ProjectStatusDot status={record.status} /></button>;
        })}
        {server.phase !== "ready" ? <div className="screen-studio-themes__unavailable" role={server.phase === "unavailable" ? "alert" : "status"}><p>{server.message}</p>{server.phase === "unavailable" && authorized ? <button type="button" onClick={() => setRetryGeneration((value) => value + 1)}>Retry style read</button> : null}</div> : null}
        {server.phase === "ready" && visible.length === 0 ? <p>No styles match this search.</p> : null}
      </div>
      <WorkspaceEditorOverlay open={Boolean(selected && selectedVisible)} title={selected?.name ?? "Style inspector"} onDismiss={closeEditor} className="screen-studio-theme-editor-overlay">
        {selected ? <div className="screen-studio-theme-editor">
          {selectedDraft ? <div className="screen-studio-theme-editor__save"><button type="button" className="is-primary" onClick={save}>Save Style</button><button type="button" onClick={discard}>Discard / Cancel</button><strong>Local draft — not published</strong></div> : <strong className="screen-studio-themes__read-only">Gateway projection — read only</strong>}
          {notice && selectedDraft ? <p role="status">{notice}</p> : null}
          {selectedDraft ? Object.values(errors).map((error) => <p role="alert" key={error}>{error}</p>) : null}
          <label>Style name<input value={selected.name} readOnly={!selectedDraft} aria-readonly={!selectedDraft} aria-invalid={selectedDraft ? Boolean(errors.name) : undefined} onChange={selectedDraft ? (event) => setDrafts((current) => updateThemeDraft(current, selected.id, (record) => ({ ...record, name: event.target.value }))) : undefined} /></label>
          <dl className="screen-studio-themes__metadata"><div><dt>ID</dt><dd>{selected.id}</dd></div><div><dt>Slug</dt><dd>{selected.slug}</dd></div><div><dt>Status</dt><dd>{selected.status}</dd></div><div><dt>Revision</dt><dd>{selected.revision}</dd></div></dl>
          <div className="screen-studio-themes__tokens" aria-label={`${selected.name} token values`}>{screenStudioThemeTokenEntries(selected).map(({ path, value }) => <label key={path}><span>{path}</span><span className="screen-studio-themes__token-value">{/^#[0-9a-f]{6}$/i.test(value) ? <i aria-hidden="true" style={{ backgroundColor: value }} /> : null}<input value={value} readOnly={!selectedDraft} aria-readonly={!selectedDraft} aria-invalid={selectedDraft ? Boolean(errors[`tokens.${path}`]) : undefined} aria-label={`${path} token value`} onChange={selectedDraft ? (event) => setDrafts((current) => updateThemeDraft(current, selected.id, (record) => updateThemeToken(record, path, event.target.value))) : undefined} /></span></label>)}</div>
          {selectedDraft ? <footer className="screen-studio-theme-editor__footer"><button type="button" onClick={duplicate}>Duplicate</button><button type="button" className="is-destructive" onClick={remove}>Remove</button></footer> : null}
          <small className="screen-studio-boundary">{selectedDraft ? "Session-memory draft only. No Gateway mutation, database write, private-service call, storage, or publication is performed." : "Validated same-origin GET projection only. Create, Save, Duplicate, and Remove do not operate on this server record."}</small>
        </div> : null}
      </WorkspaceEditorOverlay>
    </div>
  </section>;
}
