import type {
  PageRecord,
  ScreenElementHierarchyNode,
  ScreenNode,
  ScreenRecord,
} from "../dashboard/screen-studio-model.ts";

export type ScreenLayoutPreviewNode = Readonly<{
  node: ScreenElementHierarchyNode;
  depth: number;
  placement: ScreenNode["placement"];
}>;

function flattenHierarchy(
  nodes: readonly ScreenElementHierarchyNode[],
  unit: number,
  parentId: string | undefined,
  depth: number,
  row: { value: number },
): ScreenLayoutPreviewNode[] {
  const flattened: ScreenLayoutPreviewNode[] = [];
  for (const node of [...nodes].sort((left, right) => left.order - right.order)) {
    const currentRow = row.value++;
    const isDesignerSlot = depth === 0 && node.definitionId === "designer-slot";
    const isRootContainer = depth === 0 && (node.kind === "panel" || node.kind === "page");
    const placement = Object.freeze({
      x: isDesignerSlot ? 2 * unit : isRootContainer ? 12 * unit : (depth * 5 + node.order * 2) * unit,
      y: isDesignerSlot || isRootContainer ? 2 * unit : currentRow * 6 * unit,
      width: isDesignerSlot ? 8 * unit : isRootContainer ? 104 * unit : Math.max(12, 38 - depth * 5) * unit,
      height: isDesignerSlot ? 8 * unit : isRootContainer ? 74 * unit : 5 * unit,
      zIndex: isDesignerSlot ? 100 : depth + 1,
      ...(parentId ? { parentId } : {}),
      minWidth: unit,
      minHeight: unit,
    });
    flattened.push({ node, depth, placement });
    flattened.push(...flattenHierarchy(node.children, unit, node.id, depth + 1, row));
  }
  return flattened;
}

export function screenLayoutPreviewNodes(
  screen: ScreenRecord,
  elements: readonly ScreenElementHierarchyNode[] = screen.elements,
): readonly ScreenLayoutPreviewNode[] {
  return Object.freeze(flattenHierarchy(elements, screen.grid.unit, undefined, 0, { value: 1 }));
}

export function screenRecordToPageRecord(
  screen: ScreenRecord,
  elements: readonly ScreenElementHierarchyNode[] = screen.elements,
): PageRecord {
  const nodes: readonly ScreenNode[] = Object.freeze(screenLayoutPreviewNodes(screen, elements).map(({ node, placement }) => Object.freeze({
    id: node.id,
    kind: node.kind,
    definitionId: node.definitionId,
    placement,
    properties: Object.freeze({ ...(node.properties ?? {}) }),
  })));
  return Object.freeze({
    id: screen.id,
    slug: screen.id,
    version: screen.schemaVersion,
    lifecycle: screen.lifecycle,
    status: screen.status,
    displayName: screen.displayName,
    description: `${screen.displayName} Screen layout.`,
    runtimeMode: screen.type === "hud" ? "hud" : "page",
    template: "screen-studio-editor",
    grid: Object.freeze({
      unit: screen.grid.unit,
      columns: screen.grid.columns,
      rows: screen.grid.rows,
      gap: screen.grid.gap,
      breakpoints: Object.freeze([
        Object.freeze({ id: "narrow", minWidth: 0, columns: Math.min(40, screen.grid.columns) }),
        Object.freeze({ id: "wide", minWidth: 1024, columns: screen.grid.columns }),
      ]),
    }),
    nodes,
    ...(screen.gate ? { gate: screen.gate } : {}),
    revision: screen.revision,
    audit: screen.audit,
  });
}

function reorderSiblings(
  siblings: readonly ScreenElementHierarchyNode[],
  draggedId: string,
  targetId: string,
): readonly ScreenElementHierarchyNode[] | null {
  const draggedIndex = siblings.findIndex((node) => node.id === draggedId);
  const targetIndex = siblings.findIndex((node) => node.id === targetId);
  if (draggedIndex >= 0 && targetIndex >= 0) {
    const reordered = [...siblings];
    const [dragged] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, dragged);
    return Object.freeze(reordered.map((node, order) => Object.freeze({ ...node, order })));
  }
  let changed = false;
  const nested = siblings.map((node) => {
    const children = reorderSiblings(node.children, draggedId, targetId);
    if (!children) return node;
    changed = true;
    return Object.freeze({ ...node, children });
  });
  return changed ? Object.freeze(nested) : null;
}

export function reorderScreenHierarchy(
  elements: readonly ScreenElementHierarchyNode[],
  draggedId: string,
  targetId: string,
): readonly ScreenElementHierarchyNode[] {
  if (draggedId === targetId) return elements;
  return reorderSiblings(elements, draggedId, targetId) ?? elements;
}
