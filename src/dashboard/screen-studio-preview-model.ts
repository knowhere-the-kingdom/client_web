import { constrainPlacement, defaultLayoutGrid, snapToGrid, type LayoutGrid, type Placement } from "./screen-studio-model.ts";

export type ScreenStudioPreviewSpec = Readonly<{ kind: "Element" | "Panel"; id: string; label: string; width: number; height: number; background?: string; color?: string; borderRadius?: number }>;
export type ScreenStudioPreviewGeometry = Readonly<{ gridUnit: number; placement: Placement; viewport: Readonly<{ width: number; height: number }> }>;

export function centerPreviewGeometry(spec: ScreenStudioPreviewSpec, grid: LayoutGrid = defaultLayoutGrid): ScreenStudioPreviewGeometry {
  const viewport = { width: Math.min(320, grid.columns * grid.unit), height: Math.min(192, grid.rows * grid.unit) };
  const placement = constrainPlacement({ x: snapToGrid((viewport.width - spec.width) / 2, grid.unit), y: snapToGrid((viewport.height - spec.height) / 2, grid.unit), width: spec.width, height: spec.height, zIndex: 1, minWidth: grid.unit, minHeight: grid.unit, maxWidth: viewport.width, maxHeight: viewport.height }, grid);
  return { gridUnit: grid.unit, placement, viewport };
}
