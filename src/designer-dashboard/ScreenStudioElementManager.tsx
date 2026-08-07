import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";

import {
  SCREEN_STUDIO_ELEMENT_CATEGORY_ORDER,
  DEFAULT_SCREEN_STUDIO_ELEMENT_ALIGNMENT,
  DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_GRID,
  DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_VIEW_MODE,
  SCREEN_STUDIO_ELEMENT_HORIZONTAL_ANCHORS,
  SCREEN_STUDIO_ELEMENT_SITE_UNIT_BOUNDS,
  SCREEN_STUDIO_ELEMENT_TAB_ORDER,
  SCREEN_STUDIO_ELEMENT_VERTICAL_ANCHORS,
  SCREEN_STUDIO_FUSED_ELEMENT_CATALOG,
  autosaveElementDraft,
  createFusedElementDraft,
  findElementLayerById,
  fusedElementReferenceOptions,
  groupFusedElements,
  projectAlignedSiteUnitGeometry,
  resolveElementDraftInheritance,
  updateElementLayerById,
  type ElementLayerV1,
  type FusedElementCatalogEntry,
  type FusedElementDraftV1,
  type ElementTabDraftV1,
  type ScreenStudioElementColor,
  type ScreenStudioElementAlignmentAnchorsV1,
  type ScreenStudioElementEditorTab,
  type ScreenStudioElementEditorViewMode,
  type ScreenStudioElementEffect,
  type SiteUnitGeometryV1,
} from "../dashboard/screen-studio-element-composition-model.ts";
import {
  createElementDraftLifecycleState,
  replaceWorkingElementDraft,
  saveWorkingElementAsNew,
  selectCanonicalElementForEditing,
  selectSavedElementDraft,
  nextElementDraftId,
  nextElementDraftName,
  type ElementDraftLifecycleResult,
} from "../dashboard/screen-studio-element-draft-lifecycle.ts";
import { groupedBehaviorRecords, SCREEN_STUDIO_BEHAVIOR_CATALOG, behaviorRecord, type ScreenStudioElementBehaviorBinding } from "../dashboard/screen-studio-behavior-model.ts";
import { ELEMENT_COLOR_STEPS } from "../dashboard/screen-studio-element-model.ts";
import {
  isValidScreenStudioBorder,
  screenStudioColorPickerElement,
  screenStudioElementCatalog,
  screenStudioPanelCatalog,
} from "../dashboard/screen-studio-model.ts";
import { toggleCollapsedGroup } from "./screen-studio-manager-view.ts";
import { ProjectStatusDot } from "./ProjectStatusDot.tsx";
import { ScreenStudioElementEditorCanvas } from "./ScreenStudioElementEditorCanvas.tsx";
import { ScreenDesignerSurface } from "./CreatorDesignerSurfaces.tsx";
import { WorkspaceEditorOverlay } from "./WorkspaceEditorOverlay.tsx";
import { canReadScreenStudioThemes, readScreenStudioThemes, type ScreenStudioThemeReadRecord } from "./screen-studio-theme-gateway.ts";
import { elementEffectBoxShadow, formatElementColor, parseDirectElementColor, resolveElementColor, themeColorTokenPaths } from "./screen-studio-element-ui-model.ts";
import { projectFusedElementDraftComposition } from "./screen-studio-composition-ui.ts";
import type { AuthorizationProjection } from "./workspace-model.ts";
import "./screen-studio-element-manager.css";

type ColorField = "color" | "borderColor" | "effectColor";
type ThemeState = Readonly<{ phase: "loading" | "ready" | "unavailable"; records: readonly ScreenStudioThemeReadRecord[] }>;
type PaletteTab = Extract<ElementTabDraftV1, { tab: "Palette" }>;
type EffectsTab = Extract<ElementTabDraftV1, { tab: "Effects" }>;
type MenuTargetKind = "group" | "item";
type MenuRow = Readonly<{
  source: "local" | "template";
  id: string;
  name: string;
  elementType: string;
  draft?: FusedElementDraftV1;
  entry?: FusedElementCatalogEntry;
}>;
type MenuTarget = Readonly<{ kind: MenuTargetKind; category: string; categoryId: string; row?: MenuRow }>;
type ContextMenuState = Readonly<{ x: number; y: number; target: MenuTarget }>;
type ContextMenuEvent = Readonly<{
  preventDefault: () => void;
  stopPropagation: () => void;
  currentTarget: HTMLElement;
  shiftKey?: boolean;
  key?: string;
  clientX?: number;
  clientY?: number;
}>;
type GroupEditorState = Readonly<{ category: string; categoryId: string; draftName: string }>;

const paletteOf = (draft: FusedElementDraftV1) => draft.tabs.Palette as PaletteTab;
const effectsOf = (draft: FusedElementDraftV1) => draft.tabs.Effects as EffectsTab;
const normalizeElementCategoryId = (category: string): string => category
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "") || "category";

function colorForField(draft: FusedElementDraftV1, field: ColorField): ScreenStudioElementColor {
  const palette = paletteOf(draft);
  if (field === "color") return palette.color;
  if (field === "borderColor") return palette.borderColor;
  const effect = effectsOf(draft).effect;
  return effect.kind === "none" || !effect.color ? palette.color : effect.color;
}

function ElementColorEditor({ field, color, themes, selectedThemeId, onThemeChange, onApply, onDismiss, returnFocus }: Readonly<{
  field: ColorField;
  color: ScreenStudioElementColor;
  themes: readonly ScreenStudioThemeReadRecord[];
  selectedThemeId: string;
  onThemeChange: (id: string) => void;
  onApply: (color: ScreenStudioElementColor) => void;
  onDismiss: () => void;
  returnFocus: RefObject<HTMLElement | null>;
}>) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [draftColor, setDraftColor] = useState(color);
  const [draftThemeId, setDraftThemeId] = useState(selectedThemeId);
  const [directValue, setDirectValue] = useState(formatElementColor(color));
  const [directError, setDirectError] = useState("");
  const theme = themes.find((record) => record.id === draftThemeId) ?? themes[0] ?? null;
  const tokenPaths = themeColorTokenPaths(theme);
  useEffect(() => { closeRef.current?.focus(); }, []);
  const dismissAndRestore = () => { onDismiss(); queueMicrotask(() => returnFocus.current?.focus()); };
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        dismissAndRestore();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", keyboard, true);
    return () => window.removeEventListener("keydown", keyboard, true);
  }, [onDismiss, returnFocus]);
  const updateDraft = (next: ScreenStudioElementColor) => { setDraftColor(next); setDirectValue(formatElementColor(next)); setDirectError(""); };
  const updateHsla = (patch: Partial<Extract<ScreenStudioElementColor, { kind: "hsla" }>>) => updateDraft({ ...(draftColor.kind === "hsla" ? draftColor : { kind: "hsla" as const, hue: 210, saturation: 50, lightness: 50, alpha: 1 }), ...patch });
  const commitDirect = (value: string) => {
    const parsed = parseDirectElementColor(value);
    if (!parsed) { setDirectError("Use an allowlisted token or hsla(h, s%, l%, a)."); return; }
    setDirectError("");
    updateDraft(parsed);
  };
  const restoreDefaults = () => {
    const defaultColor: ScreenStudioElementColor = {
      kind: "theme-token",
      token: field === "borderColor" ? "theme.border" : "theme.surface",
    };
    onThemeChange(draftThemeId);
    onApply(defaultColor);
    dismissAndRestore();
  };
  return <div className="screen-studio-color-picker-layer" data-composite-element={screenStudioColorPickerElement.id} onPointerDown={(event) => { if (event.target === event.currentTarget) dismissAndRestore(); }}>
  <section ref={panelRef} className="screen-studio-color-editor" role="dialog" aria-modal="true" aria-labelledby="element-color-editor-title">
    <header><div><span>Composite Element</span><h3 id="element-color-editor-title">{field === "borderColor" ? "Border color" : field === "effectColor" ? "Effect color" : "Fill color"}</h3></div><button ref={closeRef} type="button" aria-label="Close color picker" onClick={dismissAndRestore}>×</button></header>
    <label>Color source<select value={draftColor.kind} onChange={(event) => event.target.value === "theme-token" ? updateDraft({ kind: "theme-token", token: tokenPaths[0] ?? "theme.primary" }) : updateDraft({ kind: "hsla", hue: 210, saturation: 50, lightness: 50, alpha: 1 })}><option value="theme-token">Theme token</option><option value="hsla">Custom HSLA</option></select></label>
    {draftColor.kind === "theme-token" ? <><label>Theme<select value={theme?.id ?? ""} disabled={!themes.length} onChange={(event) => setDraftThemeId(event.target.value)}>{themes.length ? themes.map((record) => <option key={record.id} value={record.id}>{record.name}</option>) : <option value="">Theme projection unavailable</option>}</select></label><label>Theme token<select value={draftColor.token} onChange={(event) => updateDraft({ kind: "theme-token", token: event.target.value })}>{!tokenPaths.includes(draftColor.token) ? <option value={draftColor.token}>{draftColor.token}</option> : null}{tokenPaths.map((path) => <option key={path} value={path}>{path}</option>)}</select></label></> : <div className="screen-studio-color-editor__sliders">
      <label>Hue <output>{draftColor.hue}°</output><input type="range" min="0" max="360" step={ELEMENT_COLOR_STEPS.hue} value={draftColor.hue} onChange={(event) => updateHsla({ hue: Number(event.target.value) })} /></label>
      <label>Saturation <output>{draftColor.saturation}%</output><input type="range" min="0" max="100" step={ELEMENT_COLOR_STEPS.saturation} value={draftColor.saturation} onChange={(event) => updateHsla({ saturation: Number(event.target.value) })} /></label>
      <label>Lightness <output>{draftColor.lightness}%</output><input type="range" min="0" max="100" step={ELEMENT_COLOR_STEPS.lightness} value={draftColor.lightness} onChange={(event) => updateHsla({ lightness: Number(event.target.value) })} /></label>
      <label>Opacity <output>{draftColor.alpha}</output><input type="range" min="0" max="1" step={ELEMENT_COLOR_STEPS.alpha} value={draftColor.alpha} onChange={(event) => updateHsla({ alpha: Number(event.target.value) })} /></label>
    </div>}
    <div className="screen-studio-color-editor__preview" aria-label="Color preview" style={{ background: resolveElementColor(draftColor, theme) }} />
    <label>Direct color value<input value={directValue} aria-invalid={Boolean(directError)} aria-describedby={directError ? "element-color-direct-error" : undefined} onChange={(event) => { setDirectValue(event.target.value); const parsed = parseDirectElementColor(event.target.value); if (parsed) { setDirectError(""); setDraftColor(parsed); } }} onBlur={(event) => commitDirect(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitDirect(event.currentTarget.value); } }} /></label>
    {directError ? <small id="element-color-direct-error" role="alert">{directError}</small> : null}
    <footer><button type="button" onClick={restoreDefaults}>Defaults</button><button type="button" onClick={() => { onThemeChange(draftThemeId); onApply(draftColor); dismissAndRestore(); }}>Apply</button></footer>
  </section></div>;
}

function SiteUnitField({ label, value, onChange, min = SCREEN_STUDIO_ELEMENT_SITE_UNIT_BOUNDS.min }: Readonly<{ label: string; value: number; onChange: (value: number) => void; min?: number }>) {
  return <label className="screen-studio-element-editor__unit-field"><span>{label}</span><span className="screen-studio-element-editor__unit-input"><input type="number" inputMode="decimal" min={min} max={SCREEN_STUDIO_ELEMENT_SITE_UNIT_BOUNDS.max} step={SCREEN_STUDIO_ELEMENT_SITE_UNIT_BOUNDS.step} value={value} aria-label={`${label} in site units`} onChange={(event) => onChange(Number(event.target.value))} /><span aria-hidden="true">u</span></span></label>;
}

function effectWithDefaults(effect: ScreenStudioElementEffect, color: ScreenStudioElementColor) {
  if (effect.kind === "none") return { kind: "none" as const };
  return { kind: effect.kind, color: effect.color ?? color, offsetX: effect.offsetX ?? 0.25, offsetY: effect.offsetY ?? 0.25, blur: effect.blur ?? 0.5, spread: effect.spread ?? 0, alpha: effect.alpha ?? 0.5 };
}

function selectedLayerParentBounds(layers: readonly ElementLayerV1[], selectedId: string, root: SiteUnitGeometryV1): Readonly<{ width: number; height: number }> {
  const visit = (siblings: readonly ElementLayerV1[], parent: Readonly<{ width: number; height: number }>): Readonly<{ width: number; height: number }> | null => {
    for (const layer of siblings) {
      if (layer.id === selectedId) return parent;
      const nested = visit(layer.children, { width: layer.geometry.width, height: layer.geometry.height });
      if (nested) return nested;
    }
    return null;
  };
  return visit(layers, { width: root.width, height: root.height }) ?? { width: root.width, height: root.height };
}

export function ScreenStudioElementManager({ authorization, expectedAuthorizationRevision }: Readonly<{ authorization: AuthorizationProjection | null; expectedAuthorizationRevision: number }>) {
  const [draftLifecycle, setDraftLifecycle] = useState(() => createElementDraftLifecycleState());
  const localDrafts = draftLifecycle.records;
  const workingDraft = draftLifecycle.working?.draft ?? null;
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ScreenStudioElementEditorTab>("Position");
  const [editorViewMode, setEditorViewMode] = useState<ScreenStudioElementEditorViewMode>(DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_VIEW_MODE);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [alignment, setAlignment] = useState<ScreenStudioElementAlignmentAnchorsV1>(DEFAULT_SCREEN_STUDIO_ELEMENT_ALIGNMENT);
  const [canvasInteractionActive, setCanvasInteractionActive] = useState(false);
  const [error, setError] = useState("");
  const [autosaveStatus, setAutosaveStatus] = useState("");
  const [colorField, setColorField] = useState<ColorField | null>(null);
  const colorReturnFocus = useRef<HTMLElement | null>(null);
  const [themes, setThemes] = useState<ThemeState>({ phase: "loading", records: [] });
  const [selectedThemeId, setSelectedThemeId] = useState("");
  const [behaviorQuery, setBehaviorQuery] = useState("");
  const [collapsedElementGroupIds, setCollapsedElementGroupIds] = useState<ReadonlySet<string>>(() => new Set(SCREEN_STUDIO_ELEMENT_CATEGORY_ORDER.map((category) => normalizeElementCategoryId(category))));
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [menuClipboard, setMenuClipboard] = useState<FusedElementDraftV1 | null>(null);
  const [duplicateBySource, setDuplicateBySource] = useState<Readonly<Record<string, string>>>(Object.freeze({}));
  const [groupEditor, setGroupEditor] = useState<GroupEditorState | null>(null);
  const menuRef = useRef<HTMLElement>(null);
  const menuTriggerRef = useRef<HTMLElement | null>(null);
  const firstMenuItemRef = useRef<HTMLButtonElement>(null);
  const themeGeneration = useRef(0);
  const themeAuthorized = canReadScreenStudioThemes(authorization, expectedAuthorizationRevision);

  useEffect(() => {
    const generation = ++themeGeneration.current;
    const controller = new AbortController();
    if (!themeAuthorized) { setThemes({ phase: "unavailable", records: [] }); return () => controller.abort(); }
    setThemes({ phase: "loading", records: [] });
    void readScreenStudioThemes(authorization, expectedAuthorizationRevision, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted || generation !== themeGeneration.current) return;
      if (!result.ok) { setThemes({ phase: "unavailable", records: [] }); return; }
      setThemes({ phase: "ready", records: result.records });
      setSelectedThemeId((current) => result.records.some((record) => record.id === current) ? current : result.records[0]?.id ?? "");
    });
    return () => controller.abort();
  }, [authorization, expectedAuthorizationRevision, themeAuthorized]);

  const selectedTheme = themes.records.find((record) => record.id === selectedThemeId) ?? themes.records[0] ?? null;
  const normalizedQuery = query.trim().toLowerCase();
  const groups = useMemo(() => SCREEN_STUDIO_ELEMENT_CATEGORY_ORDER.map((category) => {
    const categoryId = normalizeElementCategoryId(category);
    const drafts = localDrafts.filter((draft) => draft.category === category).map((draft) => ({ source: "local" as const, id: draft.id, name: draft.name, elementType: draft.elementType, draft }));
    const templates = (groupFusedElements().find((group) => group.category === category)?.elements ?? []).map((entry) => ({ source: "template" as const, id: entry.id, name: entry.name, elementType: entry.id, entry }));
    const rows = [...drafts, ...templates].filter((row) => !normalizedQuery || `${row.name} ${row.id} ${row.elementType} ${category}`.toLowerCase().includes(normalizedQuery));
    return { category, categoryId, rows };
  }).filter((group) => group.rows.length), [localDrafts, normalizedQuery]);

  const acceptLifecycle = (result: ElementDraftLifecycleResult, status: string) => {
    if (!result.ok) { setError(result.error); setAutosaveStatus("Change rejected; prior local state retained"); return false; }
    setDraftLifecycle(result.state);
    setError("");
    setAutosaveStatus(status);
    return true;
  };
  const closeContextMenu = (restoreFocus = true) => {
    setMenu(null);
    if (restoreFocus) queueMicrotask(() => menuTriggerRef.current?.focus());
  };
  const setClipboardFromDraft = (draft: FusedElementDraftV1 | null) => {
    setMenuClipboard(draft);
  };
  const normalizeMenuPosition = (target: MenuTarget, menuWidth: number, menuHeight: number, x: number, y: number): ContextMenuState => ({
    x: Math.max(8, Math.min(x, window.innerWidth - menuWidth)),
    y: Math.max(8, Math.min(y, window.innerHeight - menuHeight)),
    target,
  });
  const openContextMenu = (event: ContextMenuEvent, target: MenuTarget) => {
    event.preventDefault();
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    const clientX = Number.isFinite(event.clientX) ? event.clientX! : bounds.left + bounds.width / 2;
    const clientY = Number.isFinite(event.clientY) ? event.clientY! : bounds.top + bounds.height / 2;
    menuTriggerRef.current = event.currentTarget;
    setMenu(normalizeMenuPosition(target, 220, 240, clientX, clientY));
  };
  const openContextMenuForGroup = (event: ContextMenuEvent, category: string, categoryId: string) => {
    openContextMenu(event, { kind: "group", category, categoryId });
  };
  const openContextMenuForItem = (event: ContextMenuEvent, category: string, categoryId: string, row: MenuRow) => {
    openContextMenu(event, { kind: "item", category, categoryId, row });
  };
  const menuCategoryRows = (target: MenuTarget): readonly MenuRow[] => {
    if (target.kind === "item" && target.row) return [target.row];
    const match = groups.find((group) => group.category === target.category || group.categoryId === target.categoryId);
    return match?.rows ?? [];
  };
  const openGroupEditorFromMenu = (target: MenuTarget, restoreFocus = true) => {
    if (target.kind === "item") return;
    openGroupEditor(target.category, target.categoryId);
    closeContextMenu(restoreFocus);
  };
  const addNewForGroup = (target: MenuTarget, restoreFocus = true) => {
    const groupRows = menuCategoryRows(target);
    const templateRow = groupRows.find((row) => row.source === "template");
    if (!templateRow) {
      setError("No catalog record exists in this group.");
      closeContextMenu(restoreFocus);
      return;
    }
    closeContextMenu(restoreFocus);
    openNewInMenu(templateRow);
  };
  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!menu) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeContextMenu();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const actions = menuRef.current
      ? [...menuRef.current.querySelectorAll<HTMLButtonElement>("button[role=\"menuitem\"]:not(:disabled)")]
      : [];
    if (!actions.length) return;
    const current = document.activeElement instanceof HTMLElement ? actions.indexOf(document.activeElement as HTMLButtonElement) : -1;
    const next = event.key === "ArrowDown"
      ? actions[(current + 1 + actions.length) % actions.length]
      : event.key === "ArrowUp"
        ? actions[(current - 1 + actions.length) % actions.length]
        : event.key === "Home"
          ? actions[0]
          : actions[actions.length - 1];
    next.focus();
  };
  useEffect(() => {
    if (!menu) return;
    const pointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!target || !(target instanceof Node)) return;
      if (menuRef.current?.contains(target) || menuTriggerRef.current?.contains(target)) return;
      closeContextMenu();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeContextMenu();
    };
    window.addEventListener("pointerdown", pointerDown, true);
    window.addEventListener("keydown", escape, true);
    return () => {
      window.removeEventListener("pointerdown", pointerDown, true);
      window.removeEventListener("keydown", escape, true);
    };
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const focusable = menuRef.current
      ? [...menuRef.current.querySelectorAll<HTMLButtonElement>("button[role=\"menuitem\"]:not(:disabled)")]
      : [];
    (focusable[0] ?? firstMenuItemRef.current)?.focus();
  }, [menu]);
  const createDraft = () => {
    setSelectedLayerId(null);
    const opened = selectCanonicalElementForEditing(draftLifecycle, "button");
    if (!opened.ok) { acceptLifecycle(opened, ""); return; }
    const blank = createFusedElementDraft("button", { id: opened.state.working!.draft.id, name: "Unnamed Element", localDraft: true, updatedAt: "local-session" });
    acceptLifecycle(replaceWorkingElementDraft(opened.state, blank), "Unsaved working copy");
  };
  const openTemplate = (entry: FusedElementCatalogEntry) => {
    setSelectedLayerId(null);
    acceptLifecycle(selectCanonicalElementForEditing(draftLifecycle, entry.id), "Canonical record opened as an unsaved working copy");
    setMenuClipboard(null);
  };
  const openLocal = (draft: FusedElementDraftV1) => {
    setSelectedLayerId(null);
    acceptLifecycle(selectSavedElementDraft(draftLifecycle, draft.id), "Local session draft loaded without duplication");
    setClipboardFromDraft(draft);
  };
  const entryFromElementType = (elementType: string) => SCREEN_STUDIO_FUSED_ELEMENT_CATALOG.find((entry) => entry.id === elementType);
  const openNewInMenu = (row: MenuRow) => {
    const entry = row.entry ?? entryFromElementType(row.elementType);
    if (!entry) {
      setError("No catalog entry was found for this row.");
      return;
    }
    openTemplate(entry);
    closeContextMenu();
  };
  const openGroupEditor = (category: string, categoryId: string) => {
    setGroupEditor(Object.freeze({ category, categoryId, draftName: category }));
    closeContextMenu(false);
  };
  const applyGroupEditorDraftName = (draftName: string) => {
    if (!groupEditor) return;
    setGroupEditor(Object.freeze({ ...groupEditor, draftName }));
  };
  const closeGroupEditor = () => setGroupEditor(null);
  const addRecordToLocalDrafts = (draft: FusedElementDraftV1, status: string): FusedElementDraftV1 | null => {
    const nextDrafts = Object.freeze([draft, ...localDrafts]);
    const opened = selectSavedElementDraft(createElementDraftLifecycleState(nextDrafts), draft.id);
    if (!opened.ok) {
      setError(opened.error);
      setAutosaveStatus("Change rejected; prior local state retained");
      return null;
    }
    acceptLifecycle(opened, status);
    return draft;
  };
  const buildDuplicateDraft = (source: FusedElementDraftV1, suggestedName: string): FusedElementDraftV1 => {
    const name = nextElementDraftName(suggestedName, localDrafts);
    const id = nextElementDraftId(name, localDrafts);
    return Object.freeze({
      ...source,
      id,
      name,
      revision: 1,
      audit: Object.freeze({ ...source.audit, createdAt: "local-session", updatedAt: "local-session" }),
      localDraft: true,
    });
  };
  const openDuplicateRecord = (row: MenuRow, restoreFocus = true) => {
    const cacheKey = `${row.source}-${row.id}`;
    const existingId = duplicateBySource[cacheKey];
    if (existingId) {
      const existing = localDrafts.find((draft) => draft.id === existingId);
      if (existing) {
        const opened = selectSavedElementDraft(createElementDraftLifecycleState(localDrafts), existing.id);
        if (opened.ok) {
          acceptLifecycle(opened, `Reopened duplicate ${existing.name}`);
          setClipboardFromDraft(existing);
          closeContextMenu(restoreFocus);
        }
        return;
      }
    }
    const sourceDraft = row.source === "local" && row.draft
      ? row.draft
      : createFusedElementDraft(row.elementType, { name: row.name, description: row.entry?.description ?? `Unnamed ${row.name}`, updatedAt: "local-session", localDraft: true });
    const duplicate = buildDuplicateDraft(sourceDraft, `${sourceDraft.name} Copy`);
    const persisted = addRecordToLocalDrafts(duplicate, "Duplicate opened once as a local draft");
    if (!persisted) return;
    setDuplicateBySource((current) => Object.freeze({ ...current, [cacheKey]: persisted.id }));
    setClipboardFromDraft(persisted);
    closeContextMenu(restoreFocus);
  };
  const pasteFromClipboard = (targetCategory: string, restoreFocus = true) => {
    if (!menuClipboard) {
      closeContextMenu(restoreFocus);
      return;
    }
    const pasted = buildDuplicateDraft(menuClipboard, `${menuClipboard.name} Paste`);
    const persisted = addRecordToLocalDrafts(pasted, `${targetCategory} pasted`);
    if (!persisted) return;
    setClipboardFromDraft(persisted);
    closeContextMenu(restoreFocus);
  };
  const removeLocalDraft = (draftId: string, restoreFocus = true) => {
    const remaining = localDrafts.filter((draft) => draft.id !== draftId);
    const workingDraftId = draftLifecycle.working?.origin.kind === "saved-local" ? draftLifecycle.working.origin.recordId : null;
    setDraftLifecycle(createElementDraftLifecycleState(remaining));
    if (workingDraftId === draftId) closeEditor();
    setDuplicateBySource((current) => {
      const next = { ...current };
    for (const key of Object.keys(next)) {
      if (next[key] === draftId) delete next[key];
    }
    return Object.freeze(next);
  });
    if (menuClipboard?.id === draftId) setMenuClipboard(null);
    closeContextMenu(restoreFocus);
    setAutosaveStatus("Local draft removed");
  };
  const closeEditor = () => { setEditorViewMode(DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_VIEW_MODE); setSelectedLayerId(null); setCanvasInteractionActive(false); setDraftLifecycle((current) => createElementDraftLifecycleState(current.records)); setColorField(null); setError(""); setAutosaveStatus(""); };
  const dismissEditorBoundary = () => editorViewMode === "expanded" ? setEditorViewMode("compact") : closeEditor();
  const applyAutosave = (change: Parameters<typeof autosaveElementDraft>[1]) => {
    if (!workingDraft) return;
    const result = autosaveElementDraft(workingDraft, change, "local-session");
    if (!result.ok) { setError(result.error); setAutosaveStatus("Change rejected; prior local draft retained"); return; }
    const composition = projectFusedElementDraftComposition(result.draft);
    if (!composition.ok) { setError(composition.errors[0] ?? "Composition rejected"); setAutosaveStatus("Change rejected by ScreenStudioCompositionV1; prior local draft retained"); return; }
    acceptLifecycle(replaceWorkingElementDraft(draftLifecycle, result.draft), "Working copy updated locally");
  };
  const updateRootGeometry = (patch: Partial<SiteUnitGeometryV1>) => {
    if (!workingDraft) return;
    const geometry = { ...workingDraft.geometry, ...patch };
    applyAutosave({ geometry, tabs: { ...workingDraft.tabs, Position: { tab: "Position", x: geometry.x, y: geometry.y }, Size: { tab: "Size", width: geometry.width, height: geometry.height, padding: geometry.padding, margin: geometry.margin, borderWidth: geometry.borderWidth, borderRadius: geometry.borderRadius } } });
  };
  const updateSelectedGeometry = (patch: Partial<SiteUnitGeometryV1>) => {
    if (!workingDraft) return;
    if (!selectedLayerId) { updateRootGeometry(patch); return; }
    const result = updateElementLayerById(workingDraft.layers, selectedLayerId, (layer) => ({ ...layer, geometry: { ...layer.geometry, ...patch } }));
    if (!result.ok) { setError(result.error); setAutosaveStatus("Change rejected; prior local draft retained"); return; }
    applyAutosave({ layers: result.layers });
  };
  const changeType = (entry: FusedElementCatalogEntry) => {
    if (!workingDraft) return;
    if (selectedLayerId) {
      const result = updateElementLayerById(workingDraft.layers, selectedLayerId, (layer) => ({ ...layer, elementType: entry.id, family: entry.family }));
      if (!result.ok) { setError(result.error); setAutosaveStatus("Change rejected; prior local draft retained"); return; }
      applyAutosave({ layers: result.layers });
      return;
    }
    const defaults = createFusedElementDraft(entry.id, { id: workingDraft.id, name: workingDraft.name, description: entry.description, localDraft: true });
    applyAutosave({ elementType: entry.id, family: entry.family, category: entry.category, referenceElementType: defaults.referenceElementType, overrideKeys: defaults.overrideKeys, geometry: workingDraft.geometry, itemGrid: defaults.itemGrid, layers: [], tabs: { ...workingDraft.tabs, Position: { tab: "Position", x: workingDraft.geometry.x, y: workingDraft.geometry.y }, Size: { tab: "Size", width: workingDraft.geometry.width, height: workingDraft.geometry.height, padding: workingDraft.geometry.padding, margin: workingDraft.geometry.margin, borderWidth: workingDraft.geometry.borderWidth, borderRadius: workingDraft.geometry.borderRadius } } });
  };
  const updateColor = (field: ColorField, color: ScreenStudioElementColor) => {
    if (!workingDraft) return;
    const palette = paletteOf(workingDraft);
    if (field === "color" || field === "borderColor") applyAutosave({ tabs: { ...workingDraft.tabs, Palette: { ...palette, [field]: color } } });
    else { const effect = effectWithDefaults(effectsOf(workingDraft).effect, palette.color); if (effect.kind !== "none") applyAutosave({ tabs: { ...workingDraft.tabs, Effects: { tab: "Effects", effect: { ...effect, color } } } }); }
  };
  const setEffect = (kind: ScreenStudioElementEffect["kind"]) => {
    if (!workingDraft) return;
    const effect = kind === "none" ? { kind: "none" as const } : { kind, color: paletteOf(workingDraft).color, offsetX: 0.25, offsetY: 0.25, blur: 0.5, spread: 0, alpha: 0.5 };
    applyAutosave({ tabs: { ...workingDraft.tabs, Effects: { tab: "Effects", effect } } });
  };
  const updateEffectNumber = (field: "offsetX" | "offsetY" | "blur" | "spread" | "alpha", value: number) => {
    if (!workingDraft) return;
    const effect = effectWithDefaults(effectsOf(workingDraft).effect, paletteOf(workingDraft).color);
    if (effect.kind !== "none") applyAutosave({ tabs: { ...workingDraft.tabs, Effects: { tab: "Effects", effect: { ...effect, [field]: value } } } });
  };
  const saveAsNew = () => {
    if (!workingDraft) return;
    acceptLifecycle(saveWorkingElementAsNew(draftLifecycle, workingDraft.name), "Saved exactly one new local session draft");
  };
  const remove = () => {
    if (!workingDraft) return;
    const savedId = draftLifecycle.working?.origin.kind === "saved-local" ? draftLifecycle.working.origin.recordId : null;
    if (!savedId) { closeEditor(); return; }
    if (!window.confirm(`Remove local draft ${workingDraft.name}?`)) return;
    setDraftLifecycle(createElementDraftLifecycleState(localDrafts.filter((draft) => draft.id !== savedId)));
    closeEditor();
  };
  const openColor = (field: ColorField, trigger: HTMLElement) => { colorReturnFocus.current = trigger; setColorField(field); };

  const effectiveDraft = useMemo(() => workingDraft ? resolveElementDraftInheritance(workingDraft, localDrafts.filter((candidate) => candidate.id !== workingDraft.id)) : null, [workingDraft, localDrafts]);
  const activePalette = effectiveDraft ? paletteOf(effectiveDraft) : null;
  const activeEffects = effectiveDraft ? effectsOf(effectiveDraft) : null;
  const activeEffect = effectiveDraft && activePalette && activeEffects ? effectWithDefaults(activeEffects.effect, activePalette.color) : { kind: "none" as const };
  const selectedLayer = effectiveDraft && selectedLayerId ? findElementLayerById(effectiveDraft.layers, selectedLayerId) : null;
  const selectedGeometry = selectedLayer?.geometry ?? effectiveDraft?.geometry ?? null;
  const selectedElementType = selectedLayer?.elementType ?? effectiveDraft?.elementType ?? "";
  const selectedFamily = selectedLayer?.family ?? effectiveDraft?.family;
  const selectedDefinition = selectedFamily === "panel"
    ? screenStudioPanelCatalog.find((entry) => entry.id === selectedElementType)
    : screenStudioElementCatalog.find((entry) => entry.id === selectedElementType);
  const selectedSemantics = selectedDefinition?.semantics ?? (selectedFamily === "panel" ? "container" : "content");
  const expanded = editorViewMode === "expanded";
  const updateLayers = (layers: readonly ElementLayerV1[]) => applyAutosave({ layers });
  const behaviorTab = effectiveDraft?.tabs.Behaviors.tab === "Behaviors" ? effectiveDraft.tabs.Behaviors : null;
  const toggleElementCategory = (categoryId: string) => setCollapsedElementGroupIds((current) => toggleCollapsedGroup(current, categoryId));
  const addBehaviorBinding = (triggerId: string, behaviorId: string) => {
    if (!workingDraft || !behaviorTab || behaviorRecord(triggerId)?.kind !== "trigger" || behaviorRecord(behaviorId)?.kind === "trigger") return;
    const serial = behaviorTab.bindings.length + 1;
    const binding: ScreenStudioElementBehaviorBinding = { id: `behavior-binding-${serial}`, triggerId, behaviorId };
    applyAutosave({ tabs: { ...workingDraft.tabs, Behaviors: { tab: "Behaviors", bindings: Object.freeze([...behaviorTab.bindings, binding]) } } });
  };
  const removeBehaviorBinding = (id: string) => {
    if (!workingDraft || !behaviorTab) return;
    applyAutosave({ tabs: { ...workingDraft.tabs, Behaviors: { tab: "Behaviors", bindings: Object.freeze(behaviorTab.bindings.filter((binding) => binding.id !== id)) } } });
  };
  const updateBorder = (field: "widthUnits" | "radiusUnits", value: number) => {
    if (!selectedGeometry) return;
    const border = {
      widthUnits: field === "widthUnits" ? value : selectedGeometry.borderWidth,
      radiusUnits: field === "radiusUnits" ? value : selectedGeometry.borderRadius,
    };
    if (!isValidScreenStudioBorder(border)) return;
    updateSelectedGeometry(field === "widthUnits" ? { borderWidth: value } : { borderRadius: value });
  };
  const applySelectedAlignment = (next: ScreenStudioElementAlignmentAnchorsV1) => {
    if (!effectiveDraft || !selectedGeometry) return;
    const bounds = selectedLayerId
      ? selectedLayerParentBounds(effectiveDraft.layers, selectedLayerId, effectiveDraft.geometry)
      : { width: DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_GRID.columns, height: DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_GRID.rows };
    const projected = projectAlignedSiteUnitGeometry(selectedGeometry, bounds.width, bounds.height, next);
    if (!projected) { setError("Alignment rejected because the selected geometry exceeds its parent bounds."); setAutosaveStatus("Alignment rejected; prior local draft retained"); return; }
    setAlignment(next);
    updateSelectedGeometry({ x: projected.x, y: projected.y });
  };
  const editorCanvas = effectiveDraft ? <ScreenStudioElementEditorCanvas draft={effectiveDraft} viewMode={editorViewMode} selectedLayerId={selectedLayerId} onSelectedLayerChange={setSelectedLayerId} onGeometryChange={updateRootGeometry} onLayersChange={updateLayers} onCloseDraft={closeEditor} onInteractionActiveChange={setCanvasInteractionActive} /> : null;
  const selectedCatalogId = draftLifecycle.working?.origin.kind === "catalog" ? draftLifecycle.working.origin.catalogId : null;
  const selectedRecordId = draftLifecycle.working?.origin.kind === "saved-local" ? draftLifecycle.working.origin.recordId : null;
  const menuRows = menu ? menuCategoryRows(menu.target) : [];
  const menuItem = menu?.target.kind === "item" ? menu.target.row : undefined;
  const menuCanAdd = menu?.target.kind === "item" ? Boolean(menuItem) : menuRows.some((row) => row.source === "template");
  const menuCanDuplicate = menu?.target.kind === "item" && Boolean(menuItem);
  const menuCanPaste = Boolean(menuClipboard);
  const menuCanRemove = menu?.target.kind === "item" && Boolean(menuItem && menuItem.source === "local" && menuItem.draft);
  return <section className={`screen-studio-manager screen-studio-element-manager workspace-overlay-host${expanded ? " is-expanded" : ""}`} data-element-editor-view={editorViewMode} aria-label="Elements manager">
    <div className="screen-studio-element-manager__manager-surface" hidden={expanded}>
    <header className="screen-studio-manager__header"><div><h2>Elements</h2><p>Elements, Panels, and Inventory presentation types.</p></div><button type="button" onClick={createDraft}>Create Element</button></header>
    <div className="screen-studio-manager__toolbar"><label>Search Elements<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Elements…" /></label><span aria-live="polite">{groups.reduce((count, group) => count + group.rows.length, 0)} visible · {localDrafts.length} local drafts</span></div>
    <div className="screen-studio-manager__body">
      <div className="screen-studio-manager__list screen-studio-element-manager__list" aria-label="Grouped Element records">
        {groups.map((group) => {
          const isCollapsed = collapsedElementGroupIds.has(group.categoryId);
          const labelId = `element-category-${group.categoryId}-label`;
          const recordsId = `element-category-${group.categoryId}-records`;
          return <section className="screen-studio-element-manager__group" aria-labelledby={labelId} key={group.category}>
            <h3 id={labelId}>
              <button
                type="button"
                className="screen-studio-element-manager__group-toggle"
                aria-expanded={!isCollapsed}
                aria-controls={recordsId}
                onClick={() => toggleElementCategory(group.categoryId)}
                onContextMenu={(event) => openContextMenuForGroup(event, group.category, group.categoryId)}
                onKeyDown={(event) => {
                  if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                    event.preventDefault();
                    openContextMenuForGroup(event, group.category, group.categoryId);
                  }
                }}
              >
                <span aria-hidden="true">{isCollapsed ? "▸" : "▾"}</span>
                <span>{group.category}</span>
              </button>
            </h3>
            <div className="screen-studio-element-manager__group-records" role="listbox" aria-label={`${group.category} Elements`} hidden={isCollapsed} id={recordsId}>
              {group.rows.map((row) => {
                const selected = row.source === "local" ? selectedRecordId === row.id : selectedCatalogId === row.id;
                return <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={selected ? "is-selected" : ""}
                  key={`${row.source}-${row.id}`}
                  onContextMenu={(event) => openContextMenuForItem(event, group.category, group.categoryId, row)}
                  onKeyDown={(event) => {
                    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                      event.preventDefault();
                      openContextMenuForItem(event, group.category, group.categoryId, row);
                    }
                  }}
                  onClick={() => row.source === "local" ? openLocal(row.draft) : openTemplate(row.entry)}
                ><span><b>{row.name}</b><small>{row.source === "local" ? "Local session draft" : `${row.entry.family === "panel" ? "Panel" : "Element"} · ${row.elementType}`}</small></span><ProjectStatusDot status={row.source === "local" ? "planned" : "started"} /></button>;
              })}
            </div>
          </section>;
        })}
        {groups.length === 0 ? <p>No Elements match this search.</p> : null}
      </div>
    </div>
    </div>
    {menu ? <nav
      className="screen-studio-element-manager__context-menu"
      role="menu"
      aria-label="Elements manager context menu"
      data-screen-studio-element-manager-context-menu
      style={{ left: menu.x, top: menu.y }}
      ref={menuRef}
      onKeyDown={handleMenuKeyDown}
    >
      {menu.target.kind === "group" ? <>
        <button ref={firstMenuItemRef} type="button" role="menuitem" onClick={() => openGroupEditorFromMenu(menu.target)}>Edit Group</button>
        <button type="button" role="menuitem" disabled={!menuCanAdd} onClick={() => menuCanAdd ? addNewForGroup(menu.target) : null}>Add New</button>
        <button type="button" role="menuitem" disabled={!menuCanPaste} onClick={() => menuCanPaste ? pasteFromClipboard(menu.target.category) : null}>Paste</button>
      </> : <>
        <button ref={firstMenuItemRef} type="button" role="menuitem" disabled={!menuCanAdd} onClick={() => menuItem ? openNewInMenu(menuItem) : null}>Add New</button>
        <button type="button" role="menuitem" disabled={!menuCanDuplicate} onClick={() => menuItem ? openDuplicateRecord(menuItem) : null}>Duplicate</button>
        <button type="button" role="menuitem" disabled={!menuCanPaste} onClick={() => menuCanPaste ? pasteFromClipboard(menu.target.category) : null}>Paste</button>
        <button type="button" role="menuitem" disabled={!menuCanRemove} onClick={() => menuItem?.draft ? removeLocalDraft(menuItem.draft.id) : null}>Remove</button>
      </>}
    </nav> : null}
    {groupEditor ? <div className="screen-studio-element-manager__group-editor-layer">
      <div className="screen-studio-element-manager__group-editor" role="dialog" aria-modal="false" aria-label={`${groupEditor.category} group editor`}>
        <header className="screen-studio-element-manager__group-editor__header">
          <h3>{groupEditor.category} Group editor</h3>
          <button type="button" className="screen-studio-element-manager__group-editor-close" aria-label="Close group editor" onClick={closeGroupEditor}>×</button>
        </header>
        <label className="screen-studio-element-manager__group-editor__label">Display name<input type="text" value={groupEditor.draftName} onChange={(event) => applyGroupEditorDraftName(event.target.value)} /></label>
        <footer className="screen-studio-element-manager__group-editor__actions"><button type="button" onClick={closeGroupEditor}>Save</button><button type="button" onClick={closeGroupEditor}>Cancel</button></footer>
      </div>
    </div> : null}
    {expanded && workingDraft ? <div className="screen-studio-element-manager__expanded-canvas" aria-label="Expanded Screen Designer canvas"><ScreenDesignerSurface label="Screen Designer" variant="element">{editorCanvas}</ScreenDesignerSurface></div> : null}
    <WorkspaceEditorOverlay open={Boolean(workingDraft)} title={workingDraft ? selectedLayer ? `Edit Layer · ${selectedLayer.elementType}` : `Edit Element · ${workingDraft.name}` : "Edit Element"} onDismiss={dismissEditorBoundary} onClose={closeEditor} dismissOnEscape={!colorField && !canvasInteractionActive} className={`screen-studio-element-editor-overlay${expanded ? " is-expanded" : ""}`} headerActions={<button type="button" className="screen-studio-element-editor__view-toggle" aria-label={expanded ? "Contract Element Editor" : "Expand Element Editor"} title={expanded ? "Contract Element Editor" : "Expand Element Editor"} aria-pressed={expanded} onClick={() => setEditorViewMode(expanded ? "compact" : "expanded")}><span aria-hidden="true">{expanded ? "↙" : "⛶"}</span><span className="sr-only">{expanded ? "Contract Element Editor" : "Expand Element Editor"}</span></button>}>
      {workingDraft ? <div className="screen-studio-element-editor">
        {!expanded ? editorCanvas : null}
        <nav className="screen-studio-element-editor__tabs" aria-label="Element settings">{SCREEN_STUDIO_ELEMENT_TAB_ORDER.map((tab) => <button type="button" key={tab} aria-current={activeTab === tab ? "page" : undefined} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav>
        <p className="screen-studio-element-editor__autosave" role="status">{autosaveStatus || "Validated changes autosave in this session"}</p>
        {error ? <p role="alert">{error}</p> : null}
        {activeTab === "Position" && selectedGeometry ? <fieldset><legend>Position</legend>{selectedLayer ? <label>Layer ID<input value={selectedLayer.id} readOnly /></label> : <label>Name<input value={workingDraft.name} onChange={(event) => applyAutosave({ name: event.target.value })} /></label>}<label>Element type<select value={selectedElementType} onChange={(event) => { const entry = SCREEN_STUDIO_FUSED_ELEMENT_CATALOG.find((candidate) => candidate.id === event.target.value); if (entry) changeType(entry); }}>{SCREEN_STUDIO_FUSED_ELEMENT_CATALOG.filter((entry) => selectedLayer ? entry.family === selectedFamily : true).map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select></label>{!selectedLayer ? <label>Reference element<select value={workingDraft.referenceElementType ?? ""} onChange={(event) => applyAutosave({ referenceElementType: event.target.value || undefined })}><option value="">No reference</option>{fusedElementReferenceOptions(workingDraft.elementType).map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select></label> : null}<label>Semantics<input value={selectedSemantics} readOnly aria-readonly="true" /></label><fieldset className="screen-studio-element-editor__anchors"><legend>Alignment anchors</legend><label>Horizontal anchor<select value={alignment.horizontal} onChange={(event) => applySelectedAlignment({ ...alignment, horizontal: event.target.value as ScreenStudioElementAlignmentAnchorsV1["horizontal"] })}>{SCREEN_STUDIO_ELEMENT_HORIZONTAL_ANCHORS.map((anchor) => <option value={anchor} key={anchor}>{anchor}</option>)}</select></label><label>Vertical anchor<select value={alignment.vertical} onChange={(event) => applySelectedAlignment({ ...alignment, vertical: event.target.value as ScreenStudioElementAlignmentAnchorsV1["vertical"] })}>{SCREEN_STUDIO_ELEMENT_VERTICAL_ANCHORS.map((anchor) => <option value={anchor} key={anchor}>{anchor}</option>)}</select></label></fieldset><div className="screen-studio-element-editor__geometry"><SiteUnitField label="x position" value={selectedGeometry.x} onChange={(value) => updateSelectedGeometry({ x: value })} /><SiteUnitField label="y position" value={selectedGeometry.y} onChange={(value) => updateSelectedGeometry({ y: value })} /></div></fieldset> : null}
        {activeTab === "Size" && selectedGeometry ? <fieldset><legend>Size</legend><div className="screen-studio-element-editor__geometry">{(["width", "height", "padding", "margin"] as const).map((field) => <SiteUnitField key={field} label={field.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)} value={selectedGeometry[field]} onChange={(value) => updateSelectedGeometry({ [field]: value })} />)}</div><fieldset className="screen-studio-element-editor__border"><legend>Border</legend><SiteUnitField label="border width" value={selectedGeometry.borderWidth} onChange={(value) => updateBorder("widthUnits", value)} /><SiteUnitField label="border radius" value={selectedGeometry.borderRadius} onChange={(value) => updateBorder("radiusUnits", value)} /></fieldset>{!selectedLayer && effectiveDraft?.itemGrid ? <fieldset className="screen-studio-element-editor__item-grid"><legend>Item grid</legend><SiteUnitField label="item-grid width" min={1} value={effectiveDraft.itemGrid.width} onChange={(value) => applyAutosave({ itemGrid: { ...effectiveDraft.itemGrid!, width: value } })} /><SiteUnitField label="item-grid height" min={1} value={effectiveDraft.itemGrid.height} onChange={(value) => applyAutosave({ itemGrid: { ...effectiveDraft.itemGrid!, height: value } })} /></fieldset> : null}</fieldset> : null}
        {activeTab === "Palette" && selectedLayer ? <p className="screen-studio-element-editor__layer-boundary">Palette is inherited by this nested layer. Select the root Element to edit its typed colors.</p> : null}
        {activeTab === "Palette" && !selectedLayer && activePalette ? <fieldset className="screen-studio-element-editor__colors"><legend>Palette</legend>{(["color", "borderColor"] as const).map((field) => <button type="button" className="screen-studio-element-editor__color-field" key={field} aria-haspopup="dialog" onClick={(event) => openColor(field, event.currentTarget)}><span>{field === "color" ? "Fill color" : "Border color"}</span><i aria-hidden="true" style={{ background: resolveElementColor(activePalette[field], selectedTheme) }} /><small>{formatElementColor(activePalette[field])}</small></button>)}<button type="button" onClick={() => updateRootGeometry({ borderWidth: 0 })}>No border</button></fieldset> : null}
        {activeTab === "Effects" && selectedLayer ? <p className="screen-studio-element-editor__layer-boundary">Effects are inherited by this nested layer. Select the root Element to edit its typed effect.</p> : null}
        {activeTab === "Effects" && !selectedLayer && activeEffects ? <fieldset className="screen-studio-element-editor__effects"><legend>Effects</legend><label>Effect type<select value={activeEffects.effect.kind} onChange={(event) => setEffect(event.target.value as ScreenStudioElementEffect["kind"])}><option value="none">None</option><option value="drop-shadow">Drop shadow</option><option value="glow">Glow</option></select></label>{activeEffect.kind !== "none" ? <><button type="button" className="screen-studio-element-editor__color-field" aria-haspopup="dialog" onClick={(event) => openColor("effectColor", event.currentTarget)}><span>Effect color</span><i aria-hidden="true" style={{ background: resolveElementColor(activeEffect.color, selectedTheme) }} /><small>{formatElementColor(activeEffect.color)}</small></button>{(["offsetX", "offsetY", "blur", "spread"] as const).map((field) => <SiteUnitField key={field} label={field.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)} value={activeEffect[field]} onChange={(value) => updateEffectNumber(field, value)} />)}<label>Effect opacity<input type="range" min="0" max="1" step={ELEMENT_COLOR_STEPS.alpha} value={activeEffect.alpha} onChange={(event) => updateEffectNumber("alpha", Number(event.target.value))} /><output>{activeEffect.alpha}</output></label><output className="sr-only">{elementEffectBoxShadow(activeEffect, selectedTheme)}</output></> : null}</fieldset> : null}
        {activeTab === "Behaviors" && selectedLayer ? <p className="screen-studio-element-editor__layer-boundary">Behavior bindings are defined on the root Element only.</p> : null}
        {activeTab === "Behaviors" && !selectedLayer && behaviorTab ? <section className="screen-studio-element-editor__behaviors" aria-labelledby="element-behaviors-title"><h3 id="element-behaviors-title">Behaviors</h3><p>Account Settings action bindings connect to typed declarative behaviors. No executable script is accepted.</p><label>Search behaviors<input type="search" value={behaviorQuery} onChange={(event) => setBehaviorQuery(event.target.value)} placeholder="Search behaviors, triggers, schedules…" /></label><div className="screen-studio-element-editor__behavior-bindings" role="list" aria-label="Element behavior bindings">{behaviorTab.bindings.map((binding) => <div role="listitem" key={binding.id} onContextMenu={(event) => { event.preventDefault(); removeBehaviorBinding(binding.id); }}><span><b>{behaviorRecord(binding.triggerId)?.name ?? binding.triggerId}</b> → {behaviorRecord(binding.behaviorId)?.name ?? binding.behaviorId}</span><button type="button" onClick={() => removeBehaviorBinding(binding.id)}>Remove</button></div>)}{!behaviorTab.bindings.length ? <p>No behaviors assigned.</p> : null}</div><div className="screen-studio-element-editor__behavior-catalog">{groupedBehaviorRecords(behaviorQuery).map((group) => <section key={group.category}><h4>{group.category}</h4>{group.records.map((record) => <button type="button" key={record.id} disabled={record.kind === "trigger"} title={record.description} onClick={() => addBehaviorBinding("input-left-hand", record.id)}><span>{record.name}</span><small>{record.kind}</small></button>)}</section>)}</div><button type="button" onClick={() => addBehaviorBinding("input-left-hand", SCREEN_STUDIO_BEHAVIOR_CATALOG.find((record) => record.kind === "behavior")?.id ?? "activate")}>Add New</button><small>{selectedSemantics === "trigger" ? "This control Element emits triggers." : "This Element can consume inherited or explicit behavior bindings."}</small></section> : null}
        <footer className="screen-studio-element-editor__footer"><button type="button" onClick={saveAsNew}>Save as New</button><button type="button" className="is-destructive" onClick={remove}>{draftLifecycle.working?.origin.kind === "saved-local" ? "Remove local draft" : "Discard working copy"}</button></footer>
        {colorField ? <ElementColorEditor field={colorField} color={colorForField(workingDraft, colorField)} themes={themes.records} selectedThemeId={selectedThemeId} onThemeChange={setSelectedThemeId} onApply={(color) => updateColor(colorField, color)} onDismiss={() => setColorField(null)} returnFocus={colorReturnFocus} /> : null}
      </div> : null}
    </WorkspaceEditorOverlay>
  </section>;
}
