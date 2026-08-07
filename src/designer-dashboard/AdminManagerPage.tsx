import { useEffect, useMemo, useRef, useState } from "react";

import { ADMIN_MANAGER_CAPABILITY, ADMIN_MANAGER_CAPABILITIES, ADMIN_MANAGER_STATUSES, hasAdminManagerAccess, type AdminManagerKind, type AdminManagerRecord } from "../dashboard/admin-manager-model.ts";
import { readAdminManager } from "./admin-manager-gateway.ts";
import { WorkspaceEditorOverlay } from "./WorkspaceEditorOverlay.tsx";
import type { AuthorizationProjection } from "./workspace-model.ts";

const labels: Readonly<Record<AdminManagerKind, string>> = { users: "Users", groups: "Groups", roles: "Roles", permissions: "Permissions" };
const emptyDraft = (kind: AdminManagerKind, serial: number): AdminManagerRecord => {
  const base = { id: `draft-${kind}-${serial}`, displayName: "Unnamed draft", status: "draft" as const, summary: "Session-local draft only; no Gateway persistence is attached.", referenceLabels: ["source: session-draft"], revision: 0, audit: { revision: 0, state: "local-draft" as const, source: "session-draft" as const }, mutation: "local-draft" as const };
  if (kind === "users") return { ...base, kind: "user", roleRefs: [], groupRefs: [], capabilityRefs: [] };
  if (kind === "groups") return { ...base, kind: "group", memberRefs: [], roleRefs: [], scope: "self" };
  if (kind === "roles") return { ...base, kind: "role", canonicalRole: "", capabilityRefs: [], memberCount: 0 };
  return { ...base, kind: "permission", capability: "admin.dashboard.read", subjectKind: "role", resource: "", action: "read", description: "Session-local permission draft.", scope: "self" };
};

function draftUpdate(record: AdminManagerRecord, patch: Readonly<Record<string, unknown>>): AdminManagerRecord {
  return record.mutation === "local-draft" ? { ...record, ...patch, revision: record.revision + 1, audit: { ...record.audit, revision: record.audit.revision + 1 } } as AdminManagerRecord : record;
}

const referenceOptions = (values: readonly string[]): readonly Readonly<{ value: string; label: string }>[] => [...new Set(values)].sort().map((value) => ({ value, label: value }));

function toggleReference(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

function specificDetails(record: AdminManagerRecord): readonly Readonly<{ label: string; value: string }>[] {
  if (record.kind === "user") return [{ label: "Roles", value: record.roleRefs.join(", ") || "None" }, { label: "Groups", value: record.groupRefs.join(", ") || "None" }, { label: "Capabilities", value: record.capabilityRefs.join(", ") || "None" }];
  if (record.kind === "group") return [{ label: "Members", value: record.memberRefs.join(", ") || "None" }, { label: "Roles", value: record.roleRefs.join(", ") || "None" }, { label: "Scope", value: record.scope }];
  if (record.kind === "role") return [{ label: "Canonical role", value: record.canonicalRole || "Unnamed" }, { label: "Capabilities", value: record.capabilityRefs.join(", ") || "None" }, { label: "Members", value: String(record.memberCount) }];
  return [{ label: "Capability", value: record.capability }, { label: "Subject", value: `${record.subjectKind}:${record.resource}` }, { label: "Action", value: record.action }, { label: "Description", value: record.description }, { label: "Scope", value: record.scope }];
}

function DraftChecklist({ label, options, selected, disabled, onToggle }: Readonly<{ label: string; options: readonly Readonly<{ value: string; label: string }>[]; selected: readonly string[]; disabled: boolean; onToggle: (value: string) => void }>) {
  return <fieldset disabled={disabled}><legend>{label}</legend>{options.map((option) => <label key={option.value}><input type="checkbox" checked={selected.includes(option.value)} onChange={() => onToggle(option.value)} />{option.label}</label>)}</fieldset>;
}

type AdminServerState = Readonly<{ phase: "loading" | "ready" | "unavailable"; records: readonly AdminManagerRecord[]; message: string }>;

export function AdminManagerPage({ kind, authorization, expectedAuthorizationRevision }: Readonly<{ kind: AdminManagerKind; authorization: AuthorizationProjection | null; expectedAuthorizationRevision: number }>) {
  const authorized = hasAdminManagerAccess(authorization, expectedAuthorizationRevision);
  const [server, setServer] = useState<AdminServerState>({ phase: "loading", records: [], message: "Loading Administrator records…" });
  const [drafts, setDrafts] = useState<readonly AdminManagerRecord[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftSerial, setDraftSerial] = useState(0);
  const [retryGeneration, setRetryGeneration] = useState(0);
  const requestGeneration = useRef(0);
  const draftContext = useRef(`${kind}:${expectedAuthorizationRevision}`);

  useEffect(() => {
    const nextContext = `${kind}:${expectedAuthorizationRevision}`;
    if (authorized && draftContext.current === nextContext) return;
    draftContext.current = nextContext;
    setDrafts([]);
    setSelectedId(null);
    setDraftSerial(0);
  }, [authorized, expectedAuthorizationRevision, kind]);

  useEffect(() => {
    const generation = ++requestGeneration.current;
    const controller = new AbortController();
    if (!authorized) {
      setServer({ phase: "unavailable", records: [], message: "Administrator records are unavailable because authorization is missing or stale." });
      return () => controller.abort();
    }
    setServer({ phase: "loading", records: [], message: "Loading Administrator records…" });
    void readAdminManager(kind, authorization, expectedAuthorizationRevision, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted || generation !== requestGeneration.current) return;
      if (!result.ok) {
        setServer({ phase: "unavailable", records: [], message: result.message });
        setSelectedId((current) => drafts.some((record) => record.id === current) ? current : null);
        return;
      }
      setServer({ phase: "ready", records: result.records, message: "" });
      setSelectedId((current) => current && (drafts.some((record) => record.id === current) || result.records.some((record) => record.id === current)) ? current : null);
    });
    return () => controller.abort();
  }, [authorization, authorized, expectedAuthorizationRevision, kind, retryGeneration]);

  const records = useMemo(() => [...drafts, ...server.records], [drafts, server.records]);
  const relationshipOptions = useMemo(() => ({
    users: referenceOptions(server.records.flatMap((record) => record.kind === "group" ? record.memberRefs : [])),
    groups: referenceOptions(server.records.flatMap((record) => record.kind === "user" ? record.groupRefs : [])),
    roles: referenceOptions(server.records.flatMap((record) => record.kind === "role" ? [record.canonicalRole] : record.kind === "user" || record.kind === "group" ? record.roleRefs : [])),
  }), [server.records]);
  const selected = records.find((record) => record.id === selectedId) ?? null;
  const visible = useMemo(() => records.filter((record) => `${record.id} ${record.displayName} ${record.summary} ${record.referenceLabels.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())), [records, query]);
  const addDraft = () => { const nextSerial = draftSerial + 1; const draft = emptyDraft(kind, nextSerial); setDraftSerial(nextSerial); setDrafts((current) => [draft, ...current]); setSelectedId(draft.id); };
  const saveDraft = () => { if (!selected || selected.mutation !== "local-draft") return; setDrafts((current) => [{ ...selected, audit: { ...selected.audit, revision: selected.audit.revision + 1 }, revision: selected.revision + 1 }, ...current.filter((record) => record.id !== selected.id)] as readonly AdminManagerRecord[]); };
  const duplicate = () => { if (!selected) return; const nextSerial = draftSerial + 1; const copy = { ...selected, id: `draft-${kind}-${nextSerial}`, displayName: `${selected.displayName} copy`, status: "draft" as const, mutation: "local-draft" as const, revision: 0, audit: { revision: 0, state: "local-draft" as const, source: "session-draft" as const } } as AdminManagerRecord; setDraftSerial(nextSerial); setDrafts((current) => [copy, ...current]); setSelectedId(copy.id); };
  const remove = () => { if (!selected || selected.mutation !== "local-draft") return; setDrafts((current) => current.filter((record) => record.id !== selected.id)); setSelectedId(null); };
  const updateSelected = (patch: Readonly<Record<string, unknown>>) => { if (!selected || selected.mutation !== "local-draft") return; setDrafts((current) => current.map((record) => record.id === selected.id ? draftUpdate(record, patch) : record)); };

  if (!authorized) return <section className="manager-page" aria-label={`${labels[kind]} Manager`}><p className="designer-workspace-placeholder__boundary" role="alert">{labels[kind]} unavailable: {ADMIN_MANAGER_CAPABILITY} with a current authorization revision is required.</p></section>;
  return <section className="manager-page admin-manager-page" aria-label={`${labels[kind]} Manager`}>
    <header className="manager-header"><div><span>Administrator manager · read projection</span><h1>{labels[kind]}</h1><p>Gateway-derived records are read-only; edits remain session-local drafts until a reviewed mutation contract exists.</p></div><button type="button" onClick={addDraft}>Create {kind.slice(0, -1)}</button></header>
    <div className="manager-toolbar"><label>Search {labels[kind]}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label={`Search ${labels[kind]}`} /></label><span aria-live="polite">{visible.length} of {records.length} records · server read-only / local drafts</span></div>
    <div className="manager-workspace workspace-overlay-host"><section className="manager-list" aria-label={`${labels[kind]} records`}><header><span>Name</span><span>Status</span><span>Revision</span><span>References</span></header>{visible.map((record) => <button type="button" className={record.id === selectedId ? "active" : ""} data-record-origin={record.mutation === "local-draft" ? "local-draft" : "gateway"} key={record.id} onClick={() => setSelectedId(record.id === selectedId ? null : record.id)}><span><b>{record.displayName}</b><small>{record.id} · {record.mutation === "local-draft" ? "Local draft — not published" : "Gateway projection — read only"}</small></span><span>{record.status}</span><span>{record.revision}</span><span>{record.referenceLabels.length}</span></button>)}{server.phase !== "ready" ? <div className="admin-manager-page__unavailable" role={server.phase === "unavailable" ? "alert" : "status"}><p>{server.message}</p>{server.phase === "unavailable" ? <button type="button" onClick={() => setRetryGeneration((value) => value + 1)}>Retry Administrator read</button> : null}</div> : null}{server.phase === "ready" && visible.length === 0 ? <p>No records match this search.</p> : null}</section>
      <WorkspaceEditorOverlay open={Boolean(selected)} title={selected ? `${labels[kind]} · ${selected.displayName}` : labels[kind]} onDismiss={() => setSelectedId(null)} className="admin-manager-editor"><p>{selected?.summary}</p>{selected ? <><strong>{selected.mutation === "local-draft" ? "Local draft — not published" : "Gateway projection — read only"}</strong><label>Name<input readOnly={selected.mutation !== "local-draft"} value={selected.displayName} onChange={(event) => updateSelected({ displayName: event.target.value })} /></label><label>Status<select disabled={selected.mutation !== "local-draft"} value={selected.status} onChange={(event) => updateSelected({ status: event.target.value })}>{ADMIN_MANAGER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>{selected.kind === "user" ? <><DraftChecklist label="Roles" options={relationshipOptions.roles} selected={selected.roleRefs} disabled={selected.mutation !== "local-draft"} onToggle={(value) => updateSelected({ roleRefs: toggleReference(selected.roleRefs, value) })} /><DraftChecklist label="Groups" options={relationshipOptions.groups} selected={selected.groupRefs} disabled={selected.mutation !== "local-draft"} onToggle={(value) => updateSelected({ groupRefs: toggleReference(selected.groupRefs, value) })} /></> : null}{selected.kind === "group" ? <><DraftChecklist label="Members" options={relationshipOptions.users} selected={selected.memberRefs} disabled={selected.mutation !== "local-draft"} onToggle={(value) => updateSelected({ memberRefs: toggleReference(selected.memberRefs, value) })} /><DraftChecklist label="Roles" options={relationshipOptions.roles} selected={selected.roleRefs} disabled={selected.mutation !== "local-draft"} onToggle={(value) => updateSelected({ roleRefs: toggleReference(selected.roleRefs, value) })} /></> : null}{selected.kind === "role" ? <DraftChecklist label="Allowlisted capabilities" options={ADMIN_MANAGER_CAPABILITIES.map((value) => ({ value, label: value }))} selected={selected.capabilityRefs} disabled={selected.mutation !== "local-draft"} onToggle={(value) => updateSelected({ capabilityRefs: toggleReference(selected.capabilityRefs, value) })} /> : null}{selected.kind === "permission" ? <><label>Capability key<input readOnly value={selected.capability} /></label><label>Description<input readOnly value={selected.description} /></label><label>Scope<input readOnly value={selected.scope} /></label></> : null}<button type="button" disabled={selected.mutation !== "local-draft"} onClick={saveDraft}>Save local draft</button><dl><div><dt>Stable ID</dt><dd>{selected.id}</dd></div><div><dt>Status</dt><dd>{selected.status}</dd></div><div><dt>Revision</dt><dd>{selected.revision}</dd></div><div><dt>Audit</dt><dd>{selected.audit.state} · {selected.audit.source}</dd></div><div><dt>References</dt><dd>{selected.referenceLabels.join(", ") || "None"}</dd></div>{specificDetails(selected).map((detail) => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl><footer><button type="button" onClick={duplicate}>Duplicate as local draft</button><button type="button" disabled={selected.mutation !== "local-draft"} onClick={remove}>Remove</button></footer></> : null}</WorkspaceEditorOverlay>
    </div>
  </section>;
}
