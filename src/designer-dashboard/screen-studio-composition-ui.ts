import {
  createScreenStudioComposition,
  createScreenStudioCompositionElement,
  resolveScreenStudioComposition,
  validateScreenStudioComposition,
  type ResolvedScreenStudioCompositionElement,
  type ScreenStudioCompositionElement,
  type ScreenStudioCompositionOverrideKey,
  type ScreenStudioCompositionScreen,
  type ScreenStudioCompositionStyleOverrides,
} from "../dashboard/screen-studio-composition-contract.ts";
import type {
  ElementLayerV1,
  FusedElementDraftV1,
} from "../dashboard/screen-studio-element-composition-model.ts";
import { SCREEN_STUDIO_FUSED_ELEMENT_CATALOG } from "../dashboard/screen-studio-element-composition-model.ts";
import type { ScreenNode } from "../dashboard/screen-studio-model.ts";

export type ScreenStudioCompositionUiProjection = Readonly<
  | {
      ok: true;
      screen: ScreenStudioCompositionScreen;
      resolved: readonly ResolvedScreenStudioCompositionElement[];
    }
  | { ok: false; errors: readonly string[] }
>;

const OWNER_ID = "creator-local";
const SCREEN_ID = "screen-studio-canvas";
const SITE_UNIT_STEP = 0.25;
const SITE_UNIT_MAX = 64;

function boundedSiteUnit(value: number): number {
  const finite = Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(SITE_UNIT_MAX, Math.round(finite / SITE_UNIT_STEP) * SITE_UNIT_STEP));
}

function elementPolicy(node: ScreenNode) {
  const entry = SCREEN_STUDIO_FUSED_ELEMENT_CATALOG.find((candidate) => candidate.id === node.definitionId);
  return entry ? { elementType: entry.id, family: entry.family } : null;
}

function currentLayerIndex(layers: readonly ElementLayerV1[], output = new Map<string, ElementLayerV1>()): Map<string, ElementLayerV1> {
  for (const layer of layers) {
    output.set(layer.id, layer);
    currentLayerIndex(layer.children, output);
  }
  return output;
}

export function reconcileScreenNodesToElementLayers(
  current: readonly ElementLayerV1[],
  nodes: readonly ScreenNode[],
  unit: number,
): readonly ElementLayerV1[] {
  const currentById = currentLayerIndex(current);
  const documentIds = new Set(nodes.map((node) => node.id));
  const childrenByParent = new Map<string, ScreenNode[]>();
  const roots: ScreenNode[] = [];

  for (const node of nodes) {
    const parentId = node.placement.parentId;
    if (!parentId || !documentIds.has(parentId)) {
      roots.push(node);
      continue;
    }
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(parentId, siblings);
  }

  const visit = (node: ScreenNode, order: number): ElementLayerV1 | null => {
    const policy = elementPolicy(node);
    if (!policy) return null;
    const documentChildren = [...(childrenByParent.get(node.id) ?? [])]
      .sort((left, right) => left.placement.y - right.placement.y || left.placement.x - right.placement.x || left.id.localeCompare(right.id))
      .flatMap((child, childOrder) => {
        const layer = visit(child, childOrder);
        return layer ? [layer] : [];
      });
    const localChildren = (currentById.get(node.id)?.children ?? []).filter((child) => !documentIds.has(child.id));
    const children = Object.freeze([...documentChildren, ...localChildren].map((child, childOrder) => Object.freeze({ ...child, order: childOrder })));
    return Object.freeze({
      id: node.id,
      elementType: policy.elementType,
      family: policy.family,
      geometry: Object.freeze({
        x: boundedSiteUnit(node.placement.x / unit),
        y: boundedSiteUnit(node.placement.y / unit),
        width: boundedSiteUnit(node.placement.width / unit),
        height: boundedSiteUnit(node.placement.height / unit),
        padding: 0,
        margin: 0,
        borderWidth: 0,
        borderRadius: 0,
      }),
      order,
      children,
    });
  };

  const documentRoots = [...roots]
    .sort((left, right) => left.placement.zIndex - right.placement.zIndex || left.id.localeCompare(right.id))
    .flatMap((node, order) => {
      const layer = visit(node, order);
      return layer ? [layer] : [];
    });
  const localRoots = current.filter((layer) => !documentIds.has(layer.id));
  return Object.freeze([...documentRoots, ...localRoots].map((layer, order) => Object.freeze({ ...layer, order })));
}

function projectLayer(layer: ElementLayerV1, parentId: string): ScreenStudioCompositionElement {
  return createScreenStudioCompositionElement({
    id: layer.id,
    ownerId: OWNER_ID,
    elementType: layer.elementType,
    parentId,
    order: layer.order,
    geometry: layer.geometry,
    children: layer.children.map((child) => projectLayer(child, layer.id)),
  });
}

function finish(children: readonly ScreenStudioCompositionElement[]): ScreenStudioCompositionUiProjection {
  try {
    const screen = createScreenStudioComposition({ id: SCREEN_ID, ownerId: OWNER_ID, children });
    const validation = validateScreenStudioComposition(screen);
    if (!validation.ok) return Object.freeze({ ok: false, errors: validation.errors });
    return Object.freeze({ ok: true, screen, resolved: resolveScreenStudioComposition(screen) });
  } catch (error) {
    return Object.freeze({
      ok: false,
      errors: Object.freeze([error instanceof Error ? error.message : "Composition projection failed"]),
    });
  }
}

export function projectElementLayersComposition(layers: readonly ElementLayerV1[]): ScreenStudioCompositionUiProjection {
  try {
    const screenChildren = layers.flatMap((layer) => layer.elementType === "panel-page-root" ? layer.children : [layer]);
    return finish(screenChildren.map((layer, order) => projectLayer(Object.freeze({ ...layer, order }), SCREEN_ID)));
  } catch (error) {
    return Object.freeze({
      ok: false,
      errors: Object.freeze([error instanceof Error ? error.message : "Layer projection failed"]),
    });
  }
}

export function projectFusedElementDraftComposition(draft: FusedElementDraftV1): ScreenStudioCompositionUiProjection {
  try {
    const palette = draft.tabs.Palette;
    const effects = draft.tabs.Effects;
    const behaviorTab = draft.tabs.Behaviors;
    const styles: ScreenStudioCompositionStyleOverrides = Object.freeze({
      ...(draft.overrideKeys.includes("Palette") && palette.tab === "Palette"
        ? { color: palette.color, borderColor: palette.borderColor }
        : {}),
      ...(draft.overrideKeys.includes("Effects") && effects.tab === "Effects"
        ? { effect: effects.effect }
        : {}),
    });
    const overrides: ScreenStudioCompositionOverrideKey[] = [];
    if (draft.overrideKeys.includes("Palette")) overrides.push("color", "borderColor");
    if (draft.overrideKeys.includes("Effects")) overrides.push("effect");
    if (draft.overrideKeys.includes("Behaviors")) overrides.push("behaviors");
    const root = createScreenStudioCompositionElement({
      id: draft.id,
      ownerId: OWNER_ID,
      revision: { revision: draft.revision, lifecycle: "draft" },
      elementType: draft.elementType,
      parentId: SCREEN_ID,
      geometry: draft.geometry,
      styles,
      behaviors: behaviorTab.tab === "Behaviors" ? behaviorTab.bindings : [],
      overrides,
      children: draft.layers.map((layer) => projectLayer(layer, draft.id)),
    });
    return finish([root]);
  } catch (error) {
    return Object.freeze({
      ok: false,
      errors: Object.freeze([error instanceof Error ? error.message : "Element projection failed"]),
    });
  }
}

export function findResolvedCompositionElement(
  elements: readonly ResolvedScreenStudioCompositionElement[],
  id: string,
): ResolvedScreenStudioCompositionElement | null {
  for (const element of elements) {
    if (element.id === id) return element;
    const child = findResolvedCompositionElement(element.children, id);
    if (child) return child;
  }
  return null;
}
