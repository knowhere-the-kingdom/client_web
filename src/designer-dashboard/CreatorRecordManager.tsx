import { useMemo, useState } from "react";

import type { CreatorWorkspaceEntry } from "../dashboard/creator-workspace-registry.ts";
import { ProjectStatusDot } from "./ProjectStatusDot.tsx";
import { WorkspaceEditorOverlay } from "./WorkspaceEditorOverlay.tsx";
import "./creator-workspace-pages.css";

type LocalCreatorRecord = Readonly<{ id: string; name: string; description: string }>;

export function CreatorRecordManager({ entry }: Readonly<{ entry: CreatorWorkspaceEntry }>) {
  const [records, setRecords] = useState<readonly LocalCreatorRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const visible = useMemo(() => records.filter((record) => `${record.name} ${record.id} ${record.description}`.toLowerCase().includes(query.trim().toLowerCase())), [query, records]);
  const selected = records.find((record) => record.id === selectedId) ?? null;
  const createRecord = () => {
    const id = `local-${entry.id}-${records.length + 1}`;
    const record = { id, name: `Unnamed ${entry.label.replace(/s$/, "")}`, description: "Session-local draft — not published" };
    setRecords((current) => [record, ...current]);
    setSelectedId(id);
  };
  const updateSelected = (patch: Partial<LocalCreatorRecord>) => {
    if (!selected) return;
    setRecords((current) => current.map((record) => record.id === selected.id ? { ...record, ...patch } : record));
  };
  const removeSelected = () => {
    if (!selected || !window.confirm(`Remove local draft ${selected.name}?`)) return;
    setRecords((current) => current.filter((record) => record.id !== selected.id));
    setSelectedId(null);
  };
  return <section className="screen-studio-manager creator-record-manager workspace-overlay-host" aria-label={`${entry.label} manager`}>
    <header className="screen-studio-manager__header"><div><h2>{entry.label}</h2><p>{entry.description}</p></div><button type="button" onClick={createRecord}>Create {entry.label.replace(/s$/, "")}</button></header>
    <div className="screen-studio-manager__toolbar"><label>Search {entry.label}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label><span aria-live="polite">{visible.length} session-local drafts</span></div>
    <div className="screen-studio-manager__body"><div className="screen-studio-manager__list" role="listbox" aria-label={`${entry.label} records`}>
      {visible.map((record) => <button type="button" role="option" aria-selected={record.id === selectedId} className={record.id === selectedId ? "is-selected" : ""} key={record.id} onClick={() => setSelectedId(record.id)}><span><b>{record.name}</b><small>{record.id}</small></span><ProjectStatusDot status="planned" /></button>)}
      {!visible.length ? <p>No {entry.label.toLowerCase()} are loaded. Create a session-local draft to begin.</p> : null}
    </div></div>
    <WorkspaceEditorOverlay open={Boolean(selected)} title={selected ? `Edit ${selected.name}` : `Edit ${entry.label}`} onDismiss={() => setSelectedId(null)} className="creator-record-editor">
      {selected ? <div className="creator-record-editor__body"><strong>Local draft — not published</strong><label>Name<input value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })} /></label><label>Description<textarea value={selected.description} onChange={(event) => updateSelected({ description: event.target.value })} /></label><footer><button type="button" className="is-destructive" onClick={removeSelected}>Remove</button></footer><small>No storage, Gateway mutation, database write, or publication occurs.</small></div> : null}
    </WorkspaceEditorOverlay>
  </section>;
}
