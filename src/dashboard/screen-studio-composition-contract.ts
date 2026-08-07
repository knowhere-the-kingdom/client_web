import type { ScreenRevision, ScreenViewportGrid } from "./screen-studio-model.ts";
import {
  DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_GRID,
  SCREEN_STUDIO_ELEMENT_MAX_DEPTH,
  SCREEN_STUDIO_ELEMENT_MAX_LAYERS,
  SCREEN_STUDIO_FUSED_ELEMENT_CATALOG,
  canLayerHostChildren,
  getAllowedChildTypesForLayer,
  isFusedElementType,
  isValidSiteUnitGeometry,
  isValidSiteUnitValue,
  validateElementTabDraft,
  type ScreenStudioElementColor,
  type ScreenStudioElementEffect,
  type ScreenStudioElementFamily,
  type SiteUnitGeometryV1,
} from "./screen-studio-element-composition-model.ts";
import {
  validateElementBehaviorBindings,
  type ScreenStudioElementBehaviorBinding,
} from "./screen-studio-behavior-model.ts";

export const SCREEN_STUDIO_COMPOSITION_CONTRACT = "ScreenStudioCompositionV1" as const;
export const SCREEN_STUDIO_COMPOSITION_OVERRIDE_KEYS = Object.freeze(["color", "borderColor", "effect", "behaviors"] as const);
export type ScreenStudioCompositionOverrideKey = typeof SCREEN_STUDIO_COMPOSITION_OVERRIDE_KEYS[number];

export type ScreenStudioCompositionStyles = Readonly<{
  color: ScreenStudioElementColor;
  borderColor: ScreenStudioElementColor;
  effect: ScreenStudioElementEffect;
}>;

export type ScreenStudioCompositionStyleOverrides = Readonly<Partial<ScreenStudioCompositionStyles>>;

export type ScreenStudioCompositionElement = Readonly<{
  kind: "element";
  id: string;
  ownerId: string;
  revision: ScreenRevision;
  elementType: string;
  parentId: string;
  order: number;
  geometry: SiteUnitGeometryV1;
  styles: ScreenStudioCompositionStyleOverrides;
  behaviors: readonly ScreenStudioElementBehaviorBinding[];
  overrides: readonly ScreenStudioCompositionOverrideKey[];
  children: readonly ScreenStudioCompositionElement[];
}>;

export type ScreenStudioCompositionScreen = Readonly<{
  contract: typeof SCREEN_STUDIO_COMPOSITION_CONTRACT;
  kind: "screen";
  id: string;
  ownerId: string;
  revision: ScreenRevision;
  parentId: null;
  grid: ScreenViewportGrid;
  styles: ScreenStudioCompositionStyles;
  behaviors: readonly ScreenStudioElementBehaviorBinding[];
  children: readonly ScreenStudioCompositionElement[];
}>;

export type ResolvedScreenStudioCompositionElement = Readonly<{
  id: string;
  elementType: string;
  parentId: string;
  order: number;
  geometry: SiteUnitGeometryV1;
  styles: ScreenStudioCompositionStyles;
  behaviors: readonly ScreenStudioElementBehaviorBinding[];
  children: readonly ResolvedScreenStudioCompositionElement[];
}>;

export type ScreenStudioCompositionValidation = Readonly<{ ok: true }> | Readonly<{ ok: false; errors: readonly string[] }>;

const SAFE_ID = /^[a-z][a-z0-9-]{0,63}$/;
const SCREEN_KEYS = Object.freeze(["contract", "kind", "id", "ownerId", "revision", "parentId", "grid", "styles", "behaviors", "children"] as const);
const ELEMENT_KEYS = Object.freeze(["kind", "id", "ownerId", "revision", "elementType", "parentId", "order", "geometry", "styles", "behaviors", "overrides", "children"] as const);
const GRID_KEYS = Object.freeze(["viewport", "scaling", "unit", "columns", "rows", "gap"] as const);
const STYLE_KEYS = Object.freeze(["color", "borderColor", "effect"] as const);
const DEFAULT_COLOR: ScreenStudioElementColor = Object.freeze({ kind: "theme-token", token: "theme.surface" });
const DEFAULT_BORDER_COLOR: ScreenStudioElementColor = Object.freeze({ kind: "theme-token", token: "theme.border" });
const DEFAULT_EFFECT: ScreenStudioElementEffect = Object.freeze({ kind: "none" });

export const DEFAULT_SCREEN_STUDIO_COMPOSITION_GRID: ScreenViewportGrid = Object.freeze({
  viewport: "fullscreen",
  scaling: "viewport-fit",
  ...DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_GRID,
});

export const DEFAULT_SCREEN_STUDIO_COMPOSITION_STYLES: ScreenStudioCompositionStyles = Object.freeze({
  color: DEFAULT_COLOR,
  borderColor: DEFAULT_BORDER_COLOR,
  effect: DEFAULT_EFFECT,
});

const isPlainObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
const freezeBindings = (bindings: readonly ScreenStudioElementBehaviorBinding[]) => Object.freeze(bindings.map((binding) => Object.freeze({ ...binding })));
const freezeStyles = (styles: ScreenStudioCompositionStyles): ScreenStudioCompositionStyles => Object.freeze({ color: Object.freeze({ ...styles.color }), borderColor: Object.freeze({ ...styles.borderColor }), effect: Object.freeze({ ...styles.effect }) });

function validateFullStyles(styles: unknown): styles is ScreenStudioCompositionStyles {
  if (!isPlainObject(styles) || !exactKeys(styles, STYLE_KEYS)) return false;
  return validateElementTabDraft({ tab: "Palette", color: styles.color as ScreenStudioElementColor, borderColor: styles.borderColor as ScreenStudioElementColor }).length === 0
    && validateElementTabDraft({ tab: "Effects", effect: styles.effect as ScreenStudioElementEffect }).length === 0;
}

function validatePartialStyles(styles: unknown): styles is ScreenStudioCompositionStyleOverrides {
  if (!isPlainObject(styles) || Object.keys(styles).some((key) => !STYLE_KEYS.includes(key as typeof STYLE_KEYS[number]))) return false;
  const base = DEFAULT_SCREEN_STUDIO_COMPOSITION_STYLES;
  return validateFullStyles({ ...base, ...styles });
}

function validateGrid(grid: unknown): grid is ScreenViewportGrid {
  if (!isPlainObject(grid) || !exactKeys(grid, GRID_KEYS)) return false;
  return grid.viewport === "fullscreen" && grid.scaling === "viewport-fit"
    && grid.unit === DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_GRID.unit
    && Number.isInteger(grid.columns) && Number.isInteger(grid.rows)
    && (grid.columns as number) > 0 && (grid.rows as number) > 0
    && (grid.columns as number) <= DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_GRID.columns
    && (grid.rows as number) <= DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_GRID.rows
    && isValidSiteUnitValue(grid.gap as number);
}

function containsObjectCycle(value: ScreenStudioCompositionScreen): boolean {
  const ancestors = new WeakSet<object>();
  const visit = (node: ScreenStudioCompositionScreen | ScreenStudioCompositionElement): boolean => {
    if (!node || typeof node !== "object") return false;
    if (ancestors.has(node)) return true;
    ancestors.add(node);
    const cyclic = Array.isArray(node.children) && node.children.some(visit);
    ancestors.delete(node);
    return cyclic;
  };
  return visit(value);
}

function catalogFamily(elementType: string): ScreenStudioElementFamily | null {
  return SCREEN_STUDIO_FUSED_ELEMENT_CATALOG.find((entry) => entry.id === elementType)?.family ?? null;
}

function validRevision(revision: unknown): revision is ScreenRevision {
  if (!isPlainObject(revision)) return false;
  const allowed = ["revision", "lifecycle", "contentHash", "basedOnRevision", "savedAt", "savedBy"];
  return Object.keys(revision).every((key) => allowed.includes(key))
    && Number.isInteger(revision.revision) && (revision.revision as number) >= 1
    && ["draft", "review", "published", "archived"].includes(revision.lifecycle as string)
    && (revision.basedOnRevision === undefined || Number.isInteger(revision.basedOnRevision));
}

export function validateScreenStudioComposition(screen: ScreenStudioCompositionScreen): ScreenStudioCompositionValidation {
  const errors: string[] = [];
  if (!isPlainObject(screen) || !exactKeys(screen, SCREEN_KEYS)) return Object.freeze({ ok: false, errors: Object.freeze(["screen root must use the exact root-only composition shape"]) });
  if (screen.contract !== SCREEN_STUDIO_COMPOSITION_CONTRACT || screen.kind !== "screen" || !SAFE_ID.test(screen.id) || !SAFE_ID.test(screen.ownerId) || !validRevision(screen.revision) || screen.parentId !== null) errors.push("screen root identity, owner, revision, or parent is invalid");
  if (Object.prototype.hasOwnProperty.call(screen, "x") || Object.prototype.hasOwnProperty.call(screen, "y") || Object.prototype.hasOwnProperty.call(screen, "geometry")) errors.push("screen root cannot have position geometry");
  if (!validateGrid(screen.grid)) errors.push("screen grid must be a fullscreen viewport-fit universal-unit grid");
  if (!validateFullStyles(screen.styles)) errors.push("screen styles are invalid");
  if (!Array.isArray(screen.behaviors) || validateElementBehaviorBindings(screen.behaviors).length) errors.push("screen behaviors are invalid");
  if (!Array.isArray(screen.children)) errors.push("screen children must be ordered elements");
  const objectCycle = containsObjectCycle(screen);
  if (objectCycle) errors.push("composition contains an object cycle");

  const ids = new Set<string>([screen.id]);
  let count = 0;
  const visit = (node: ScreenStudioCompositionElement, parentId: string, parentWidth: number, parentHeight: number, depth: number, siblingOrder: number, parentType: string | null) => {
    count += 1;
    if (depth > SCREEN_STUDIO_ELEMENT_MAX_DEPTH) errors.push("composition depth exceeds the bounded maximum");
    if (!isPlainObject(node) || !exactKeys(node, ELEMENT_KEYS)) { errors.push("element must use the exact composition shape"); return; }
    if (node.kind !== "element" || !SAFE_ID.test(node.id) || ids.has(node.id)) errors.push("element IDs must be unique safe identifiers");
    if (!SAFE_ID.test(node.ownerId) || !validRevision(node.revision)) errors.push(`element owner or revision is invalid: ${node.id}`);
    ids.add(node.id);
    if (!isFusedElementType(node.elementType)) errors.push(`unknown element type: ${node.elementType}`);
    if (node.parentId !== parentId) errors.push(`element parent does not match its containing parent: ${node.id}`);
    if (!Number.isInteger(node.order) || node.order !== siblingOrder) errors.push(`element order must be contiguous: ${node.id}`);
    if (!isValidSiteUnitGeometry(node.geometry) || node.geometry.width <= 0 || node.geometry.height <= 0 || node.geometry.x + node.geometry.width > parentWidth || node.geometry.y + node.geometry.height > parentHeight) errors.push(`element geometry is outside its parent unit bounds: ${node.id}`);
    if (!validatePartialStyles(node.styles)) errors.push(`element styles are invalid: ${node.id}`);
    if (!Array.isArray(node.behaviors) || validateElementBehaviorBindings(node.behaviors).length) errors.push(`element behaviors are invalid: ${node.id}`);
    if (!Array.isArray(node.overrides) || new Set(node.overrides).size !== node.overrides.length || node.overrides.some((key) => !SCREEN_STUDIO_COMPOSITION_OVERRIDE_KEYS.includes(key))) errors.push(`element overrides are invalid: ${node.id}`);
    for (const key of node.overrides ?? []) if (key !== "behaviors" && !Object.prototype.hasOwnProperty.call(node.styles, key)) errors.push(`style override requires a local value: ${node.id}.${key}`);
    if (node.overrides?.includes("behaviors") && !Array.isArray(node.behaviors)) errors.push(`behavior override requires local bindings: ${node.id}`);
    if (!Array.isArray(node.children)) { errors.push(`element children must be ordered: ${node.id}`); return; }
    if (parentType !== null) {
      const family = catalogFamily(parentType);
      const parent = family ? { elementType: parentType, family } : null;
      if (!parent || !canLayerHostChildren(parent) || !getAllowedChildTypesForLayer(parent).includes(node.elementType)) errors.push(`parent disallows child type: ${parentId} -> ${node.elementType}`);
    }
    const family = catalogFamily(node.elementType);
    if (node.children.length && (!family || !canLayerHostChildren({ elementType: node.elementType, family }))) errors.push(`element cannot host children: ${node.id}`);
    if (!objectCycle) node.children.forEach((child, index) => visit(child, node.id, node.geometry.width, node.geometry.height, depth + 1, index, node.elementType));
  };
  if (Array.isArray(screen.children)) screen.children.forEach((child, index) => visit(child, screen.id, screen.grid.columns, screen.grid.rows, 1, index, null));
  if (count > SCREEN_STUDIO_ELEMENT_MAX_LAYERS) errors.push("composition element count exceeds the bounded maximum");
  return errors.length ? Object.freeze({ ok: false, errors: Object.freeze([...new Set(errors)]) }) : Object.freeze({ ok: true });
}

export type CreateScreenStudioCompositionElementOptions = Readonly<{
  id: string;
  ownerId: string;
  revision?: ScreenRevision;
  elementType: string;
  parentId: string;
  order?: number;
  geometry?: Partial<SiteUnitGeometryV1>;
  styles?: ScreenStudioCompositionStyleOverrides;
  behaviors?: readonly ScreenStudioElementBehaviorBinding[];
  overrides?: readonly ScreenStudioCompositionOverrideKey[];
  children?: readonly ScreenStudioCompositionElement[];
}>;

export function createScreenStudioCompositionElement(options: CreateScreenStudioCompositionElementOptions): ScreenStudioCompositionElement {
  const geometry: SiteUnitGeometryV1 = Object.freeze({ x: 0, y: 0, width: 8, height: 4, padding: 0, margin: 0, borderWidth: 0, borderRadius: 0, ...options.geometry });
  if (!SAFE_ID.test(options.id) || !SAFE_ID.test(options.ownerId) || !SAFE_ID.test(options.parentId) || !isFusedElementType(options.elementType) || !isValidSiteUnitGeometry(geometry) || geometry.width <= 0 || geometry.height <= 0) throw new RangeError("Invalid composition Element helper input");
  const overrides = Object.freeze([...(options.overrides ?? [])]);
  const styles = Object.freeze({ ...(options.styles ?? {}) });
  const candidate: ScreenStudioCompositionElement = Object.freeze({ kind: "element", id: options.id, ownerId: options.ownerId, revision: Object.freeze({ ...(options.revision ?? { revision: 1, lifecycle: "draft" as const }) }), elementType: options.elementType, parentId: options.parentId, order: options.order ?? 0, geometry, styles, behaviors: freezeBindings(options.behaviors ?? []), overrides, children: Object.freeze([...(options.children ?? [])]) });
  if (!validatePartialStyles(candidate.styles) || new Set(overrides).size !== overrides.length || overrides.some((key) => !SCREEN_STUDIO_COMPOSITION_OVERRIDE_KEYS.includes(key))) throw new RangeError("Invalid composition Element styles or overrides");
  return candidate;
}

export type CreateScreenStudioCompositionOptions = Readonly<{
  id: string;
  ownerId: string;
  revision?: ScreenRevision;
  grid?: ScreenViewportGrid;
  styles?: ScreenStudioCompositionStyles;
  behaviors?: readonly ScreenStudioElementBehaviorBinding[];
  children?: readonly ScreenStudioCompositionElement[];
}>;

export function createScreenStudioComposition(options: CreateScreenStudioCompositionOptions): ScreenStudioCompositionScreen {
  const screen: ScreenStudioCompositionScreen = Object.freeze({ contract: SCREEN_STUDIO_COMPOSITION_CONTRACT, kind: "screen", id: options.id, ownerId: options.ownerId, revision: Object.freeze({ ...(options.revision ?? { revision: 1, lifecycle: "draft" as const }) }), parentId: null, grid: Object.freeze({ ...(options.grid ?? DEFAULT_SCREEN_STUDIO_COMPOSITION_GRID) }), styles: freezeStyles(options.styles ?? DEFAULT_SCREEN_STUDIO_COMPOSITION_STYLES), behaviors: freezeBindings(options.behaviors ?? []), children: Object.freeze([...(options.children ?? [])]) });
  const validation = validateScreenStudioComposition(screen);
  if (!validation.ok) throw new RangeError(`Invalid composition Screen helper input: ${validation.errors[0]}`);
  return screen;
}

function resolveStyles(parent: ScreenStudioCompositionStyles, node: ScreenStudioCompositionElement): ScreenStudioCompositionStyles {
  return freezeStyles({
    color: node.overrides.includes("color") ? node.styles.color! : parent.color,
    borderColor: node.overrides.includes("borderColor") ? node.styles.borderColor! : parent.borderColor,
    effect: node.overrides.includes("effect") ? node.styles.effect! : parent.effect,
  });
}

export function resolveScreenStudioComposition(screen: ScreenStudioCompositionScreen): readonly ResolvedScreenStudioCompositionElement[] {
  const validation = validateScreenStudioComposition(screen);
  if (!validation.ok) throw new RangeError(`Cannot resolve invalid composition: ${validation.errors[0]}`);
  const visit = (node: ScreenStudioCompositionElement, inheritedStyles: ScreenStudioCompositionStyles, inheritedBehaviors: readonly ScreenStudioElementBehaviorBinding[]): ResolvedScreenStudioCompositionElement => {
    const styles = resolveStyles(inheritedStyles, node);
    const behaviors = node.overrides.includes("behaviors") ? freezeBindings(node.behaviors) : inheritedBehaviors;
    return Object.freeze({ id: node.id, elementType: node.elementType, parentId: node.parentId, order: node.order, geometry: node.geometry, styles, behaviors, children: Object.freeze(node.children.map((child) => visit(child, styles, behaviors))) });
  };
  const rootBehaviors = freezeBindings(screen.behaviors);
  return Object.freeze(screen.children.map((child) => visit(child, screen.styles, rootBehaviors)));
}
