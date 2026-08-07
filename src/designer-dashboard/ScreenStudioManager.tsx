import { useEffect, useMemo, useState, type CSSProperties } from "react";

import {
  screenStudioDefaultPageRecords,
  screenStudioScreenRecords,
} from "../dashboard/screen-studio-fixtures.ts";
import {
  SCREEN_STUDIO_SCREEN_GROUPS,
  screenStudioElementCatalog,
  screenStudioPanelCatalog,
  type ScreenGroupId,
  type ScreenRecord,
  type ScreenStatus,
} from "../dashboard/screen-studio-model.ts";
import {
  createLocalScreenStudioPage,
  defaultScreenStudioDraftVisualFields,
  validateScreenStudioCreate,
  validateScreenStudioVisualFields,
  type ScreenStudioDraftVisualFields,
  type ScreenStudioCreateInput,
} from "../dashboard/screen-studio-create-model.ts";
import {
  screenStudioPageRecords,
  type PageRecord,
} from "../dashboard/screen-studio-model.ts";
import {
  evaluateScreenStudioPermissionGate,
  type ScreenStudioPermissionContext,
} from "../dashboard/screen-studio-permission.ts";
import { ProjectStatusDot } from "./ProjectStatusDot.tsx";
import { WorkspaceEditorOverlay } from "./WorkspaceEditorOverlay.tsx";
import { ScreenStudioRecordPreview } from "./ScreenStudioRecordPreview.tsx";
import { ScreenStudioScreenPreview } from "./ScreenStudioScreenPreview.tsx";
import { insertDraftAtTop } from "../dashboard/screen-studio-draft-helpers.ts";
import { draftCopyName } from "../dashboard/screen-studio-draft-workflow.ts";
import { autosaveElementDraft } from "../dashboard/screen-studio-element-composition-model.ts";
import {
  createElementDraftLifecycleState,
  replaceWorkingElementDraft,
  saveWorkingElementAsNew,
  selectCanonicalElementForEditing,
  selectSavedElementDraft,
} from "../dashboard/screen-studio-element-draft-lifecycle.ts";
import type { AuthorizationProjection } from "./workspace-model.ts";
import {
  nextScreenSort,
  sortScreenRecords,
  toggleCollapsedGroup,
  type ScreenSortColumn,
  type ScreenSortState,
} from "./screen-studio-manager-view.ts";
import { initialCollapsedManagementListGroups } from "../dashboard/creator-workspace-registry.ts";

export type ScreenStudioManagerScope =
  "screens" | "elements" | "panels" | "pages";

type ManagerRecord = Readonly<{
  id: string;
  name: string;
  kind: string;
  status: ScreenStatus;
  revision: number;
  description: string;
  metadata: readonly string[];
  gate?: Parameters<typeof evaluateScreenStudioPermissionGate>[0];
  page?: PageRecord;
  elementType?: string;
  panelType?: string;
  visual?: ScreenStudioDraftVisualFields;
  canonical?: boolean;
  screen?: ScreenRecord;
  groupId?: ScreenGroupId;
  roles?: readonly string[];
  tags?: readonly string[];
}>;

const scopeLabels: Readonly<Record<ScreenStudioManagerScope, string>> = {
  screens: "Screens",
  elements: "Elements",
  panels: "Panels",
  pages: "Pages",
};
const scopeCreateTitles: Readonly<Record<ScreenStudioManagerScope, string>> = {
  screens: "Create Screen",
  elements: "Create Element",
  panels: "Create Panel",
  pages: "Create Page",
};

function screenGroupDepth(groupId: ScreenGroupId): number {
  let depth = 0;
  let current = SCREEN_STUDIO_SCREEN_GROUPS.find((group) => group.id === groupId);
  const visited = new Set<ScreenGroupId>();
  while (current?.parentId && !visited.has(current.id)) {
    visited.add(current.id);
    depth += 1;
    current = SCREEN_STUDIO_SCREEN_GROUPS.find((group) => group.id === current?.parentId);
  }
  return depth;
}

function screenGroupAncestorIds(groupId: ScreenGroupId): readonly ScreenGroupId[] {
  const ancestors: ScreenGroupId[] = [];
  let current = SCREEN_STUDIO_SCREEN_GROUPS.find((group) => group.id === groupId);
  const visited = new Set<ScreenGroupId>();
  while (current?.parentId && !visited.has(current.id)) {
    visited.add(current.id);
    ancestors.push(current.parentId);
    current = SCREEN_STUDIO_SCREEN_GROUPS.find((group) => group.id === current?.parentId);
  }
  return ancestors;
}

function recordsFor(scope: ScreenStudioManagerScope): readonly ManagerRecord[] {
  if (scope === "screens")
    return screenStudioScreenRecords.map((entry) => ({
      id: entry.id,
      name: entry.displayName,
      kind: "Screen",
      status: entry.status,
      revision: entry.revision.revision,
      description: `${entry.displayName} Screen record.`,
      gate: entry.gate,
      metadata: [`Type: ${entry.type}`, `Roles: ${entry.roles.join(", ")}`, `Tags: ${entry.tags.join(", ")}`],
      canonical: true,
      screen: entry,
      groupId: entry.groupId,
      roles: entry.roles,
      tags: entry.tags,
    }));
  if (scope === "elements")
    return screenStudioElementCatalog.map((entry) => ({
      id: entry.id,
      name: entry.name,
      kind: "Element",
      status: entry.status,
      revision: entry.version,
      description: entry.description,
      gate: entry.gate,
      metadata: [
        `${entry.properties.length} typed properties`,
        `${entry.events.length} local events`,
        entry.requiredAccessibleName
          ? "Accessible name required"
          : "Accessible name optional",
      ],
      elementType: entry.id,
      visual: { ...defaultScreenStudioDraftVisualFields(), label: entry.name },
      canonical: true,
    }));
  if (scope === "panels")
    return screenStudioPanelCatalog.map((entry) => ({
      id: entry.id,
      name: entry.name,
      kind: "Panel",
      status: entry.status,
      revision: entry.version,
      description: entry.description,
      gate: entry.gate,
      metadata: [
        `${entry.allowedChildren.length} allowed child types`,
        entry.gate
          ? `Gate: ${entry.gate.requiredCapability ?? entry.gate.requiredRole}`
          : "No gate on fixture",
      ],
      panelType: entry.id,
      visual: { ...defaultScreenStudioDraftVisualFields(), width: 160, height: 96, label: entry.name, text: entry.description },
    }));
  return screenStudioDefaultPageRecords.map((entry) => ({
    id: entry.id,
    name: entry.displayName,
    kind: "Page",
    status: entry.status,
    revision: entry.revision.revision,
    description: entry.description,
    gate: entry.gate,
    metadata: [
      `Template: ${entry.template}`,
      `Mode: ${entry.runtimeMode}`,
      `${entry.nodes.length} fixture nodes`,
    ],
  }));
}

export function ScreenStudioManager({
  scope,
  authorization,
  expectedAuthorizationRevision,
  parentAuthorized,
}: Readonly<{
  scope: ScreenStudioManagerScope;
  authorization: AuthorizationProjection | null;
  expectedAuthorizationRevision: number;
  parentAuthorized: boolean;
}>) {
  const [localPages, setLocalPages] = useState<readonly PageRecord[]>([]);
  const [localRecords, setLocalRecords] = useState<readonly ManagerRecord[]>([]);
  const [elementDraftLifecycle, setElementDraftLifecycle] = useState(() =>
    createElementDraftLifecycleState(),
  );
  const [elementDraftVisuals, setElementDraftVisuals] = useState<
    Readonly<Record<string, ScreenStudioDraftVisualFields>>
  >({});
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editVisual, setEditVisual] = useState<ScreenStudioDraftVisualFields>(defaultScreenStudioDraftVisualFields());
  const [screenEditorTab, setScreenEditorTab] = useState<"preview" | "elements">("preview");
  const [screenElements, setScreenElements] = useState<ScreenRecord["elements"]>(Object.freeze([]));
  const [draggedScreenElementId, setDraggedScreenElementId] = useState<string | null>(null);
  const [createInput, setCreateInput] = useState<ScreenStudioCreateInput>({
    name: "Unnamed Screen",
    id: "unnamed-screen",
    template: "custom",
    runtimeMode: "page",
    status: "planned",
    requiredCapability: "world.designer.read",
    kind: "Screen",
    elementType: "button",
    panelType: "panel-editor-form",
    ...defaultScreenStudioDraftVisualFields(),
  });
  const [createErrors, setCreateErrors] = useState<
    Readonly<Record<string, string>>
  >({});
  const [editErrors, setEditErrors] = useState<
    Readonly<Record<string, string>>
  >({});
  const elementLocalRecords: readonly ManagerRecord[] =
    elementDraftLifecycle.records.map((draft) => ({
      id: draft.id,
      name: draft.name,
      kind: "Element",
      status: "started",
      revision: draft.revision,
      description: draft.description,
      metadata: ["Local session draft", "Not published"],
      elementType: draft.elementType,
      visual:
        elementDraftVisuals[draft.id] ?? {
          ...defaultScreenStudioDraftVisualFields(),
          label: draft.name,
          text: draft.description,
        },
    }));
  const records: readonly ManagerRecord[] =
    scope === "elements"
      ? [...elementLocalRecords, ...recordsFor(scope)]
      : scope === "screens" || scope === "pages"
      ? [
          ...localPages.map((page) => ({
            id: page.id,
            name: page.displayName,
            kind: scope === "screens" ? "Screen" : "Page",
            status: page.status,
            revision: page.revision.revision,
            description: page.description,
            gate: page.gate,
            page,
            metadata: [
              `Template: ${page.template}`,
              `Mode: ${page.runtimeMode}`,
              "Local draft; persistence disabled",
            ],
          })),
          ...localRecords,
          ...recordsFor(scope),
        ]
      : [...localRecords, ...recordsFor(scope)];
  const permissionContext: ScreenStudioPermissionContext = {
    authorization,
    expectedAuthorizationRevision,
    parentAuthorized,
  };
  const accessibleRecords = records.filter(
    (record) =>
      evaluateScreenStudioPermissionGate(record.gate, permissionContext)
        .allowed,
  );
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsedScreenGroupIds, setCollapsedScreenGroupIds] = useState<ReadonlySet<string>>(() => {
    const initial = new Set(initialCollapsedManagementListGroups("screens"));
    initial.add("local-drafts");
    return initial;
  });
  const [screenSort, setScreenSort] = useState<ScreenSortState>({ column: "screen", direction: "ascending" });
  const visible = useMemo(
    () =>
      accessibleRecords.filter((record) =>
        `${record.name} ${record.id} ${record.description} ${record.metadata.join(" ")}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [accessibleRecords, query],
  );
  const visibleScreenGroups = useMemo(() => {
    if (scope !== "screens") return [];
    const byGroup = new Map<ScreenGroupId, readonly ManagerRecord[]>();
    for (const group of SCREEN_STUDIO_SCREEN_GROUPS) {
      const entries = visible.filter((record) => record.groupId === group.id);
      if (entries.length) byGroup.set(group.id, entries);
    }
    const hasVisibleDescendant = (groupId: ScreenGroupId): boolean =>
      byGroup.has(groupId) ||
      SCREEN_STUDIO_SCREEN_GROUPS.some(
        (candidate) => candidate.parentId === groupId && hasVisibleDescendant(candidate.id),
      );
    return SCREEN_STUDIO_SCREEN_GROUPS.filter((group) => hasVisibleDescendant(group.id));
  }, [scope, visible]);
  const visibleLocalScreenDrafts = useMemo(
    () => scope === "screens" ? visible.filter((record) => !record.groupId) : [],
    [scope, visible],
  );
  const cycleScreenSort = (column: ScreenSortColumn) =>
    setScreenSort((current) => nextScreenSort(current, column));
  const toggleScreenGroup = (groupId: string) =>
    setCollapsedScreenGroupIds((current) => toggleCollapsedGroup(current, groupId));
  const screenColumnHeader = (column: ScreenSortColumn, label: string) => {
    const active = screenSort.column === column;
    return (
      <span role="columnheader" aria-sort={active ? screenSort.direction : "none"}>
        <button type="button" onClick={() => cycleScreenSort(column)}>
          <span>{label}</span>
          <span className="screen-studio-screen-table__sort" aria-hidden="true">
            {active ? screenSort.direction === "ascending" ? "↑" : "↓" : "↕"}
          </span>
        </button>
      </span>
    );
  };
  const selected = accessibleRecords.find((record) => record.id === selectedId);
  const selectedIsLocal = Boolean(selected && (
    elementDraftLifecycle.records.some((record) => record.id === selected.id) ||
    localPages.some((page) => page.id === selected.id) ||
    localRecords.some((record) => record.id === selected.id)
  ));
  const recordKind = scope === "screens" ? "Screen" : scope === "elements" ? "Element" : scope === "panels" ? "Panel" : "Page";
  const createTitle = scopeCreateTitles[scope];
  const resetCreateInput = () => setCreateInput({ name: `Unnamed ${recordKind}`, id: `unnamed-${recordKind.toLowerCase()}`, template: "custom", runtimeMode: "page", status: "planned", requiredCapability: "world.designer.read", kind: recordKind, elementType: "button", panelType: "panel-editor-form", ...defaultScreenStudioDraftVisualFields() });
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && createOpen) {
        event.preventDefault();
        event.stopPropagation();
        setCreateOpen(false);
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [createOpen]);
  useEffect(() => {
    setSelectedId(null);
    setEditOpen(false);
    setCreateOpen(false);
    setEditErrors({});
  }, [scope]);
  const submitCreate = () => {
    const validation = validateScreenStudioCreate(createInput, [
      ...screenStudioPageRecords,
      ...localPages,
    ]);
    const visualErrors = recordKind === "Element" || recordKind === "Panel" ? validateScreenStudioVisualFields({ width: createInput.width ?? 80, height: createInput.height ?? 32, label: createInput.label ?? "", text: createInput.text ?? "", color: createInput.color ?? "#17120d", background: createInput.background ?? "#f2c14e", borderRadius: createInput.borderRadius ?? 4, padding: createInput.padding ?? 8, columns: createInput.columns ?? 2 }) : {};
    setCreateErrors({ ...validation.errors, ...visualErrors });
    if (!validation.valid || Object.keys(visualErrors).length) return;
    if (scope === "elements") {
      const opened = selectCanonicalElementForEditing(
        elementDraftLifecycle,
        createInput.elementType ?? "button",
      );
      if (!opened.ok || !opened.state.working) {
        setCreateErrors({ name: opened.ok ? "Choose an Element type." : opened.error });
        return;
      }
      const named = autosaveElementDraft(
        opened.state.working.draft,
        { name: createInput.name.trim(), description: createInput.text?.trim() || createInput.name.trim() },
        "local-working-copy",
      );
      const replaced = named.ok
        ? replaceWorkingElementDraft(opened.state, named.draft)
        : { ok: false as const, state: opened.state, error: named.error };
      if (!replaced.ok) {
        setCreateErrors({ name: replaced.error });
        return;
      }
      setElementDraftLifecycle(replaced.state);
      setSelectedId(createInput.elementType ?? "button");
      setEditName(createInput.name.trim());
      setEditVisual({
        ...defaultScreenStudioDraftVisualFields(),
        width: createInput.width ?? 80,
        height: createInput.height ?? 32,
        label: createInput.label ?? createInput.name.trim(),
        text: createInput.text ?? createInput.name.trim(),
        color: createInput.color ?? "#17120d",
        background: createInput.background ?? "#f2c14e",
        borderRadius: createInput.borderRadius ?? 4,
        padding: createInput.padding ?? 8,
        columns: createInput.columns ?? 2,
      });
      setCreateOpen(false);
      setEditOpen(true);
      setEditErrors({});
      resetCreateInput();
      return;
    }
    const page = createLocalScreenStudioPage(createInput, [
      ...screenStudioPageRecords,
      ...localPages,
    ]);
    if (page) {
      if (scope === "screens" || scope === "pages") setLocalPages((current) => insertDraftAtTop(current, page));
      else setLocalRecords((current) => [{ id: page.id, name: page.displayName, kind: recordKind, status: page.status, revision: 1, description: page.description, gate: page.gate, metadata: ["Local draft; persistence disabled"], panelType: scope === "panels" ? (createInput.panelType ?? "panel-editor-form") : undefined, visual: { ...defaultScreenStudioDraftVisualFields(), width: createInput.width ?? 80, height: createInput.height ?? 32, label: createInput.label ?? page.displayName, text: createInput.text ?? page.description, color: createInput.color ?? "#17120d", background: createInput.background ?? "#f2c14e", borderRadius: createInput.borderRadius ?? 4, padding: createInput.padding ?? 8, columns: createInput.columns ?? 2 } }, ...current]);
      setSelectedId(page.id);
      setEditName(page.displayName);
      setEditVisual({ ...defaultScreenStudioDraftVisualFields(), width: createInput.width ?? 80, height: createInput.height ?? 32, label: createInput.label ?? page.displayName, text: createInput.text ?? page.description, color: createInput.color ?? "#17120d", background: createInput.background ?? "#f2c14e", borderRadius: createInput.borderRadius ?? 4, padding: createInput.padding ?? 8, columns: createInput.columns ?? 2 });
      setCreateOpen(false);
      setEditOpen(true);
      setQuery("");
      resetCreateInput();
    }
  };
  const selectRecord = (record: ManagerRecord) => {
    if (selectedId === record.id && editOpen) return;
    if (scope === "elements") {
      const result = record.canonical
        ? selectCanonicalElementForEditing(elementDraftLifecycle, record.elementType ?? record.id)
        : selectSavedElementDraft(elementDraftLifecycle, record.id);
      if (!result.ok) {
        setEditErrors({ selection: result.error });
        return;
      }
      setElementDraftLifecycle(result.state);
    }
    setSelectedId(record.id);
    setEditName(record.name);
    setEditVisual(record.visual ?? defaultScreenStudioDraftVisualFields());
    setEditErrors({});
    setScreenEditorTab("preview");
    setScreenElements(record.screen?.elements ?? Object.freeze([]));
    setEditOpen(true);
  };
  const expandSelectedScreen = () => {
    if (!selected?.screen) return;
    const target = new URL(window.location.href);
    target.searchParams.set("workspace", "creator");
    target.searchParams.set("page", "screen-designer");
    target.searchParams.set("screen", selected.screen.id);
    window.history.pushState({}, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  const saveLocalName = () => { if (!selected || !selectedIsLocal || editName.trim().length < 2 || Object.keys(validateScreenStudioVisualFields(editVisual)).length) return; if (selected.page) setLocalPages((pages) => pages.map((page) => page.id === selected.id ? { ...page, displayName: editName.trim(), revision: { ...page.revision, revision: 1, lifecycle: "draft" as const } } : page)); else setLocalRecords((items) => items.map((item) => item.id === selected.id ? { ...item, name: editName.trim(), revision: 1, visual: editVisual } : item)); setEditOpen(false); setSelectedId(null); };
  const duplicateSelected = () => { if (!selected) return; const name = draftCopyName(editName || selected.name, records.map((record) => record.name)); const id = draftCopyName(selected.id, records.map((record) => record.id)).replace(/ /g, "-").toLowerCase(); if (selected.page) { const page = { ...selected.page, id, slug: id, displayName: name, revision: { ...selected.page.revision, revision: 1, lifecycle: "draft" as const }, audit: { ...selected.page.audit, updatedAt: "2026-08-04T00:00:00Z" } }; setLocalPages((pages) => [page, ...pages]); } else setLocalRecords((items) => [{ ...selected, id, name, revision: 1 }, ...items]); setSelectedId(id); setEditName(name); };
  const saveElementAsNew = () => {
    if (scope !== "elements" || !selected || !elementDraftLifecycle.working) return;
    const visualErrors = validateScreenStudioVisualFields(editVisual);
    if (editName.trim().length < 2 || editName.trim().length > 80) {
      setEditErrors({ name: "Use a plain name from 2 to 80 characters.", ...visualErrors });
      return;
    }
    if (Object.keys(visualErrors).length) {
      setEditErrors(visualErrors);
      return;
    }
    const changed = autosaveElementDraft(
      elementDraftLifecycle.working.draft,
      { name: editName.trim(), description: editVisual.text.trim() || selected.description },
      "local-working-copy",
    );
    if (!changed.ok) {
      setEditErrors({ save: changed.error });
      return;
    }
    const replaced = replaceWorkingElementDraft(elementDraftLifecycle, changed.draft);
    if (!replaced.ok) {
      setEditErrors({ save: replaced.error });
      return;
    }
    const saved = saveWorkingElementAsNew(replaced.state, editName, "local-session");
    if (!saved.ok || !saved.record) {
      setEditErrors({ save: saved.ok ? "Local Element draft was not created." : saved.error });
      return;
    }
    setElementDraftLifecycle(saved.state);
    setElementDraftVisuals((current) => ({ ...current, [saved.record!.id]: editVisual }));
    setSelectedId(saved.record.id);
    setEditName(saved.record.name);
    setEditErrors({});
  };
  const removeSelected = () => { if (!selected || !selectedIsLocal || !window.confirm(`Remove local draft ${selected.name}?`)) return; if (scope === "elements") { const remaining = elementDraftLifecycle.records.filter((record) => record.id !== selected.id); setElementDraftLifecycle(createElementDraftLifecycleState(remaining)); setElementDraftVisuals((current) => { const next = { ...current }; delete next[selected.id]; return next; }); } else if (selected.page) setLocalPages((pages) => pages.filter((page) => page.id !== selected.id)); else setLocalRecords((items) => items.filter((item) => item.id !== selected.id)); setSelectedId(null); setEditOpen(false); setEditErrors({}); };
  return (
    <section
      className="screen-studio-manager workspace-overlay-host"
      aria-label={`${scopeLabels[scope]} manager`}
    >
      <header className="screen-studio-manager__header">
        <div>
          <span className="screen-studio-eyebrow">
            Creator-owned draft registry
          </span>
          <h2>{scopeLabels[scope]}</h2>
          <p>
            {scope === "screens"
              ? "Page compositions available to Screen Studio."
              : scope === "elements"
                ? "Reusable allowlisted primitives with typed properties."
                : scope === "panels"
                  ? "Reusable grouped composition regions."
                  : "Revisioned Page records and template instances."}
          </p>
        </div>
        <button
          type="button"
          disabled={false}
          title={
            scope === "screens"
              ? "Open local Create Screen form"
              : "Open local draft form"
          }
          onClick={() => { resetCreateInput(); setCreateOpen(true); }}
        >
          {createTitle}
        </button>
      </header>
      <div className="screen-studio-manager__toolbar">
        <label>
          Search{" "}
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${scopeLabels[scope].toLowerCase()}…`}
          />
        </label>
        <span aria-live="polite">
          {visible.length} of {records.length} local records ·{" "}
          {records.length - accessibleRecords.length} gated
        </span>
      </div>
      <div className="screen-studio-manager__body">
        <div className="screen-studio-manager__list" aria-label={`${scopeLabels[scope]} records`}>
          {scope === "screens" ? (
            <div className="screen-studio-screen-table" role="table" aria-label="Grouped Screen records">
              <div className="screen-studio-screen-table__head" role="row">
                {screenColumnHeader("screen", "Screen")}
                {screenColumnHeader("type", "Type")}
                {screenColumnHeader("roles", "Roles")}
                {screenColumnHeader("tags", "Tags")}
                {screenColumnHeader("status", "Status")}
              </div>
              {visibleLocalScreenDrafts.length ? (
                <section
                  className="screen-studio-screen-group"
                  data-depth="0"
                  style={{ "--screen-group-depth": 0 } as CSSProperties}
                  aria-labelledby="screen-group-local-drafts-label"
                >
                  <h3>
                    <button
                      type="button"
                      id="screen-group-local-drafts-label"
                      aria-expanded={!collapsedScreenGroupIds.has("local-drafts")}
                      aria-controls="screen-group-local-drafts-records"
                      onClick={() => toggleScreenGroup("local-drafts")}
                    >
                      <span aria-hidden="true">{collapsedScreenGroupIds.has("local-drafts") ? "▸" : "▾"}</span>
                      <span>Local drafts</span>
                    </button>
                  </h3>
                  <div
                    id="screen-group-local-drafts-records"
                    className="screen-studio-screen-group__records"
                    hidden={collapsedScreenGroupIds.has("local-drafts")}
                  >
                  {sortScreenRecords(visibleLocalScreenDrafts, screenSort).map((record) => (
                    <button
                      type="button"
                      role="row"
                      aria-selected={record.id === selected?.id}
                      className={`screen-studio-screen-row${record.id === selected?.id ? " is-selected" : ""}`}
                      key={record.id}
                      onClick={() => selectRecord(record)}
                    >
                      <span role="cell"><b>{record.name}</b><small>{record.id}</small></span>
                      <span role="cell">Local draft</span>
                      <span role="cell">Not assigned</span>
                      <span role="cell">Not assigned</span>
                      <span role="cell"><ProjectStatusDot status={record.status} /></span>
                    </button>
                  ))}
                  </div>
                </section>
              ) : null}
              {visibleScreenGroups.map((group) => {
                const groupRecords = visible.filter((record) => record.groupId === group.id);
                const depth = screenGroupDepth(group.id);
                const expanded = !collapsedScreenGroupIds.has(group.id);
                const hiddenByAncestor = screenGroupAncestorIds(group.id).some((ancestorId) => collapsedScreenGroupIds.has(ancestorId));
                return (
                  <section
                    className="screen-studio-screen-group"
                    data-depth={depth}
                    style={{ "--screen-group-depth": depth } as CSSProperties}
                    key={group.id}
                    aria-labelledby={`screen-group-${group.id}-label`}
                    hidden={hiddenByAncestor}
                  >
                    <h3>
                      <button
                        type="button"
                        id={`screen-group-${group.id}-label`}
                        aria-expanded={expanded}
                        aria-controls={`screen-group-${group.id}-records`}
                        onClick={() => toggleScreenGroup(group.id)}
                      >
                        <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
                        <span>{group.label}</span>
                      </button>
                    </h3>
                    <div
                      id={`screen-group-${group.id}-records`}
                      className="screen-studio-screen-group__records"
                      hidden={!expanded}
                    >
                    {sortScreenRecords(groupRecords, screenSort).map((record) => (
                      <button
                        type="button"
                        role="row"
                        aria-selected={record.id === selected?.id}
                        className={`screen-studio-screen-row${record.id === selected?.id ? " is-selected" : ""}`}
                        key={record.id}
                        onClick={() => selectRecord(record)}
                      >
                        <span role="cell"><b>{record.name}</b><small>{record.id}</small></span>
                        <span role="cell">{record.screen?.type ?? "workspace"}</span>
                        <span role="cell">{record.roles?.join(", ") || "None"}</span>
                        <span role="cell">{record.tags?.join(", ") || "None"}</span>
                        <span role="cell"><ProjectStatusDot status={record.status} /></span>
                      </button>
                    ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : visible.map((record) => (
            <button
              type="button"
              aria-selected={record.id === selected?.id}
              className={record.id === selected?.id ? "is-selected" : ""}
              key={record.id}
              onClick={() => selectRecord(record)}
            >
              <span>
                <b>{record.name}</b>
                <small>{record.id}</small>
              </span>
              <ProjectStatusDot status={record.status} />
            </button>
          ))}
          {visible.length === 0 ? (
            <p>No local records match this search.</p>
          ) : null}
        </div>
      </div>
      <WorkspaceEditorOverlay
        open={createOpen}
        title={createTitle}
        onDismiss={() => setCreateOpen(false)}
        className="screen-studio-create-overlay"
      >
        {createOpen ? (
          <aside
            className="screen-studio-create-popover"
            aria-label={`${createTitle} form`}
          >
            <h3>{createTitle}</h3>
            <p>
              Local revision-1 draft only. Reload may discard it; Save Draft
              remains disabled.
            </p>
            <label>
              {recordKind} name
              <input
                autoFocus
                value={createInput.name}
                onChange={(event) =>
                  setCreateInput({ ...createInput, name: event.target.value })
                }
              />
            </label>
            {createErrors.name ? (
              <small role="alert">{createErrors.name}</small>
            ) : null}
            <label>
              Stable draft ID
              <input
                value={createInput.id}
                onChange={(event) =>
                  setCreateInput({ ...createInput, id: event.target.value })
                }
                placeholder="my-screen"
              />
            </label>
            {createErrors.id ? (
              <small role="alert">{createErrors.id}</small>
            ) : null}
            {recordKind === "Element" ? <>
              <label>Element type<select value={createInput.elementType} onChange={(event) => setCreateInput({ ...createInput, elementType: event.target.value })}>{screenStudioElementCatalog.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
              <label>Label / content<input value={createInput.label} onChange={(event) => setCreateInput({ ...createInput, label: event.target.value, text: event.target.value })} /></label>
              <label>Width<input type="number" value={createInput.width} onChange={(event) => setCreateInput({ ...createInput, width: Number(event.target.value) })} /></label>
              <label>Height<input type="number" value={createInput.height} onChange={(event) => setCreateInput({ ...createInput, height: Number(event.target.value) })} /></label>
              <label>Text color<input value={createInput.color} onChange={(event) => setCreateInput({ ...createInput, color: event.target.value })} /></label>
              <label>Background<input value={createInput.background} onChange={(event) => setCreateInput({ ...createInput, background: event.target.value })} /></label>
            </> : null}
            {recordKind === "Panel" ? <>
              <label>Panel type<select value={createInput.panelType} onChange={(event) => setCreateInput({ ...createInput, panelType: event.target.value })}>{screenStudioPanelCatalog.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
              <label>Panel content<input value={createInput.text} onChange={(event) => setCreateInput({ ...createInput, text: event.target.value })} /></label>
              <label>Width<input type="number" value={createInput.width} onChange={(event) => setCreateInput({ ...createInput, width: Number(event.target.value) })} /></label>
              <label>Height<input type="number" value={createInput.height} onChange={(event) => setCreateInput({ ...createInput, height: Number(event.target.value) })} /></label>
              <label>Background<input value={createInput.background} onChange={(event) => setCreateInput({ ...createInput, background: event.target.value })} /></label>
              <label>Padding<input type="number" value={createInput.padding} onChange={(event) => setCreateInput({ ...createInput, padding: Number(event.target.value) })} /></label>
              <label>Columns<input type="number" value={createInput.columns} onChange={(event) => setCreateInput({ ...createInput, columns: Number(event.target.value) })} /></label>
            </> : null}
            <label>
              Template
              <select
                value={createInput.template}
                onChange={(event) =>
                  setCreateInput({
                    ...createInput,
                    template: event.target
                      .value as ScreenStudioCreateInput["template"],
                  })
                }
              >
                {screenStudioPageRecords.map((page) => (
                  <option key={page.template} value={page.template}>
                    {page.template}
                  </option>
                ))}
              </select>
            </label>
            {recordKind === "Screen" || recordKind === "Page" ? <fieldset>
              <legend>Page type</legend>
              <label>
                <input
                  type="radio"
                  checked={createInput.runtimeMode === "hud"}
                  onChange={() =>
                    setCreateInput({ ...createInput, runtimeMode: "hud" })
                  }
                />{" "}
                HUD (game remains beneath UI)
              </label>
              <label>
                <input
                  type="radio"
                  checked={createInput.runtimeMode === "page"}
                  onChange={() =>
                    setCreateInput({ ...createInput, runtimeMode: "page" })
                  }
                />{" "}
                Page (game unloaded for editor)
              </label>
            </fieldset> : null}
            <label>
              Status
              <select
                value={createInput.status}
                onChange={(event) =>
                  setCreateInput({
                    ...createInput,
                    status: event.target.value as ScreenStatus,
                  })
                }
              >
                {[
                  "planned",
                  "ready",
                  "started",
                  "in-progress",
                  "blocked",
                  "review",
                  "complete",
                ].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Permission gate
              <select
                value={createInput.requiredCapability}
                onChange={(event) =>
                  setCreateInput({
                    ...createInput,
                    requiredCapability: event.target
                      .value as ScreenStudioCreateInput["requiredCapability"],
                  })
                }
              >
                <option value="world.designer.read">world.designer.read</option>
                <option value="admin.dashboard.read">
                  admin.dashboard.read
                </option>
                <option value="none">No additional gate</option>
              </select>
            </label>
            {createErrors.requiredCapability ? (
              <small role="alert">{createErrors.requiredCapability}</small>
            ) : null}
            <div className="screen-studio-manager__actions">
              <button type="button" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button type="button" onClick={submitCreate}>
                {createTitle}
              </button>
            </div>
          </aside>
        ) : null}
      </WorkspaceEditorOverlay>
      <WorkspaceEditorOverlay open={editOpen && !!selected} title={`Edit ${selected?.kind ?? "record"}`} onDismiss={() => { setEditOpen(false); setSelectedId(null); setEditErrors({}); }} className="screen-studio-edit-overlay" headerActions={selected?.screen ? <button type="button" className="screen-studio-screen-editor__expand" aria-label={`Open ${selected.name} in Screen Designer`} title="Open in Screen Designer" onClick={expandSelectedScreen}>⛶</button> : undefined}>
        {selected ? <div className="screen-studio-draft-editor">
          {selected.screen ? <>
            <div className="screen-studio-screen-editor__tabs" role="tablist" aria-label="Screen editor views">
              <button type="button" role="tab" aria-selected={screenEditorTab === "preview"} onClick={() => setScreenEditorTab("preview")}>Preview</button>
              <button type="button" role="tab" aria-selected={screenEditorTab === "elements"} onClick={() => setScreenEditorTab("elements")}>Elements</button>
            </div>
            <ScreenStudioScreenPreview screen={selected.screen} elements={screenElements} mode={screenEditorTab} draggedId={draggedScreenElementId} setDraggedId={setDraggedScreenElementId} onReorder={setScreenElements} />
          </> : null}
          <label>Name<input value={editName} readOnly={scope !== "elements" && !selectedIsLocal} aria-readonly={scope !== "elements" && !selectedIsLocal} onChange={(event) => setEditName(event.target.value)} /></label>
          {editErrors.name ? <small role="alert">{editErrors.name}</small> : null}
          <p>Revision {selected.revision} · {selectedIsLocal ? "Local session draft · not published" : scope === "elements" ? "Canonical record · unsaved working copy · not published" : "canonical predefined record; read only"}.</p>
          {selected.kind === "Element" ? <>
            <label>Element type<input value={selected.elementType ?? selected.id} readOnly /></label>
            <label>Label / content<input value={editVisual.label} onChange={(event) => setEditVisual({ ...editVisual, label: event.target.value, text: event.target.value })} /></label>
            <label>Width<input type="number" value={editVisual.width} onChange={(event) => setEditVisual({ ...editVisual, width: Number(event.target.value) })} /></label>
            <label>Height<input type="number" value={editVisual.height} onChange={(event) => setEditVisual({ ...editVisual, height: Number(event.target.value) })} /></label>
            <label>Text color<input value={editVisual.color} onChange={(event) => setEditVisual({ ...editVisual, color: event.target.value })} /></label>
            <label>Background<input value={editVisual.background} onChange={(event) => setEditVisual({ ...editVisual, background: event.target.value })} /></label>
          </> : null}
          {selected.kind === "Panel" ? <>
            <label>Panel type<input value={selected.panelType ?? selected.id} readOnly /></label>
            <label>Panel content<input value={editVisual.text} onChange={(event) => setEditVisual({ ...editVisual, text: event.target.value })} /></label>
            <label>Width<input type="number" value={editVisual.width} onChange={(event) => setEditVisual({ ...editVisual, width: Number(event.target.value) })} /></label>
            <label>Height<input type="number" value={editVisual.height} onChange={(event) => setEditVisual({ ...editVisual, height: Number(event.target.value) })} /></label>
            <label>Background<input value={editVisual.background} onChange={(event) => setEditVisual({ ...editVisual, background: event.target.value })} /></label>
            <label>Padding<input type="number" value={editVisual.padding} onChange={(event) => setEditVisual({ ...editVisual, padding: Number(event.target.value) })} /></label>
            <label>Columns<input type="number" value={editVisual.columns} onChange={(event) => setEditVisual({ ...editVisual, columns: Number(event.target.value) })} /></label>
          </> : null}
          {selected.kind === "Element" || selected.kind === "Panel" ? <ScreenStudioRecordPreview spec={{ kind: selected.kind, id: selected.elementType ?? selected.panelType ?? selected.id, label: editVisual.label || editVisual.text || editName || selected.name, width: editVisual.width, height: editVisual.height, background: editVisual.background, color: editVisual.color, borderRadius: editVisual.borderRadius }} /> : null}
          {Object.entries(editErrors).filter(([field]) => field !== "name").map(([field, message]) => <small role="alert" key={field}>{message}</small>)}
          <div className="screen-studio-draft-editor__bottom">
            {scope === "elements" ? <button type="button" onClick={saveElementAsNew}>Save as New</button> : <button type="button" onClick={duplicateSelected}>Duplicate</button>}
            <button type="button" onClick={removeSelected} disabled={!selectedIsLocal}>Remove</button>
          </div>
        </div> : null}
      </WorkspaceEditorOverlay>
    </section>
  );
}
