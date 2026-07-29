import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { CSSProperties, MouseEventHandler, PointerEventHandler, PropsWithChildren } from "react";
import type { FixedSlot, Item } from "./types";

type DraggableItemProps = {
  item: Item;
  dragId: string;
  compact?: boolean;
};

export function DraggableItem({ item, dragId, compact = false }: DraggableItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId
  });

  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined
  };

  return (
    <div
      ref={setNodeRef}
      className={`item-token ${compact ? "item-token-compact" : ""} ${isDragging ? "item-token-dragging" : ""}`}
      style={style}
      {...listeners}
      {...attributes}
    >
      <span className="item-token-icon">{item.icon}</span>
      <span className="item-token-name">{item.name}</span>
    </div>
  );
}

type DroppableFrameProps = PropsWithChildren<{
  id: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  onPointerUpCapture?: PointerEventHandler<HTMLDivElement>;
}>;

export function DroppableFrame({ id, className = "", onClick, onPointerUpCapture, children }: DroppableFrameProps) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? "drop-target-over" : ""}`.trim()} onClick={onClick} onPointerUpCapture={onPointerUpCapture}>
      {children}
    </div>
  );
}

type ItemSlotProps = {
  slot: FixedSlot;
  item?: Item;
  dragId?: string;
  onClick?: () => void;
  tone?: "left" | "right" | "action";
  logo?: boolean;
};

export function ItemSlot({ slot, item, dragId, onClick, tone = "left", logo = false }: ItemSlotProps) {
  return (
    <DroppableFrame id={`fixed:${slot.id}`} className={`item-slot item-slot-${tone}`} onPointerUpCapture={onClick}>
      {logo ? <div className="slot-logo">Knowhere</div> : null}
      <button className="item-slot-button" type="button" aria-label={slot.label}>
        {item && dragId ? <DraggableItem item={item} dragId={dragId} compact /> : <span className="item-slot-empty">{slot.label}</span>}
      </button>
      <div className="item-slot-label">{slot.label}</div>
    </DroppableFrame>
  );
}
