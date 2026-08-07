import type { InventoryPlacement, Item } from "./types";
import { backpackGrid } from "./inventory";
import { DraggableItem, DroppableFrame } from "./ItemViews";

type InventoryGridProps = {
  items: Record<string, Item>;
  placements: InventoryPlacement[];
};

export function InventoryGrid({ items, placements }: InventoryGridProps) {
  const placementByCoordinate = new Map<string, InventoryPlacement>();
  placements.forEach((placement) => {
    placementByCoordinate.set(`${placement.x}:${placement.y}`, placement);
  });

  return (
    <div className="inventory-grid-shell">
      <div className="inventory-grid">
        {Array.from({ length: backpackGrid.rows }).map((_, y) =>
          Array.from({ length: backpackGrid.cols }).map((__, x) => (
            <DroppableFrame key={`${x}:${y}`} id={`grid:backpack:${x}:${y}`} className="inventory-grid-cell" />
          ))
        )}
        {placements.map((placement) => {
          const item = items[placement.itemId];
          if (!item) return null;

          return (
            <div
              key={placement.itemId}
              className="inventory-grid-item"
              style={{
                gridColumn: `${placement.x + 1} / span ${placement.cols}`,
                gridRow: `${placement.y + 1} / span ${placement.rows}`
              }}
            >
              <DraggableItem item={item} dragId={`grid:${item.id}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
