import type { CSSProperties, DragEvent } from "react";

import type { ScreenElementHierarchyNode, ScreenRecord } from "../dashboard/screen-studio-model.ts";
import { reorderScreenHierarchy, screenLayoutPreviewNodes } from "./screen-studio-screen-layout.ts";

function HierarchyList({
  nodes,
  draggedId,
  setDraggedId,
  onReorder,
}: Readonly<{
  nodes: readonly ScreenElementHierarchyNode[];
  draggedId: string | null;
  setDraggedId: (id: string | null) => void;
  onReorder: (elements: readonly ScreenElementHierarchyNode[]) => void;
}>) {
  const drop = (event: DragEvent<HTMLButtonElement>, targetId: string) => {
    event.preventDefault();
    if (draggedId) onReorder(reorderScreenHierarchy(nodes, draggedId, targetId));
    setDraggedId(null);
  };
  return <ul className="screen-studio-screen-hierarchy">
    {nodes.map((node) => <li key={node.id}>
      <button
        type="button"
        draggable
        onDragStart={() => setDraggedId(node.id)}
        onDragEnd={() => setDraggedId(null)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => drop(event, node.id)}
        aria-label={`Reorder ${node.definitionId}`}
      >
        <span>{node.definitionId}</span><small>{node.kind}</small>
      </button>
      {node.children.length ? <HierarchyList nodes={node.children} draggedId={draggedId} setDraggedId={setDraggedId} onReorder={(children) => onReorder(nodes.map((candidate) => candidate.id === node.id ? Object.freeze({ ...candidate, children }) : candidate))} /> : null}
    </li>)}
  </ul>;
}

export function ScreenStudioScreenPreview({
  screen,
  elements,
  mode,
  draggedId,
  setDraggedId,
  onReorder,
}: Readonly<{
  screen: ScreenRecord;
  elements: readonly ScreenElementHierarchyNode[];
  mode: "preview" | "elements";
  draggedId: string | null;
  setDraggedId: (id: string | null) => void;
  onReorder: (elements: readonly ScreenElementHierarchyNode[]) => void;
}>) {
  if (mode === "elements") return <div className="screen-studio-screen-hierarchy-wrap">
    <p>Drag items within their current parent to change their order in this session-only layout.</p>
    <HierarchyList nodes={elements} draggedId={draggedId} setDraggedId={setDraggedId} onReorder={onReorder} />
  </div>;
  const previewNodes = screenLayoutPreviewNodes(screen, elements);
  return <div
    className="screen-studio-screen-preview"
    role="img"
    aria-label={`Live designer preview of ${screen.displayName}`}
    style={{ "--screen-preview-columns": screen.grid.columns, "--screen-preview-rows": screen.grid.rows } as CSSProperties}
  >
    {previewNodes.map(({ node, placement, depth }) => <div
      key={node.id}
      className="screen-studio-screen-preview__node"
      data-kind={node.kind}
      style={{
        left: `${placement.x / (screen.grid.columns * screen.grid.unit) * 100}%`,
        top: `${placement.y / (screen.grid.rows * screen.grid.unit) * 100}%`,
        width: `${Math.min(100, placement.width / (screen.grid.columns * screen.grid.unit) * 100)}%`,
        height: `${Math.min(100, placement.height / (screen.grid.rows * screen.grid.unit) * 100)}%`,
        zIndex: placement.zIndex,
      }}
    ><span>{node.definitionId}</span><small>{node.kind} · depth {depth}</small></div>)}
  </div>;
}
