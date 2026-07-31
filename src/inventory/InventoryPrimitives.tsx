import { useEffect, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

import { defaultTooltipSettings, readTooltipSettings, TOOLTIP_SETTINGS_EVENT, type TooltipPlacement, type TooltipSettings } from "../hud/tooltipSettings";
import {
  inventoryQualityName,
  slotAcceptsItem,
  type InventoryItemDefinitionV1,
  type InventoryItemInstanceV1,
  type InventorySlotDefinitionV1,
} from "./inventory-model";
import "./inventory-primitives.css";

export const INVENTORY_DRAG_TYPE = "application/x-knowhere-inventory-instance";

type InventoryItemCardProps = Readonly<{
  definition: InventoryItemDefinitionV1;
  instance: InventoryItemInstanceV1;
  held?: boolean;
  disabled?: boolean;
  cancelOnDragEnd?: boolean;
  showTooltip?: boolean;
  onPickUp: (instanceId: string, pointer?: Readonly<{ x: number; y: number; pointerType: string }>) => void;
  onCancel: () => void;
}>;

type InventorySlotProps = Readonly<{
  definition: InventorySlotDefinitionV1;
  heldItem: Readonly<{
    definition: InventoryItemDefinitionV1;
    instance: InventoryItemInstanceV1;
  }> | null;
  className?: string;
  children?: ReactNode;
  disabled?: boolean;
  onPlace: (instanceId: string) => void;
  onCancel: () => void;
}>;

type InventoryCssProperties = CSSProperties & Record<`--${string}`, string | number>;

export function InventoryItemCard({ definition, instance, held = false, disabled = false, cancelOnDragEnd = true, showTooltip = true, onPickUp, onCancel }: InventoryItemCardProps) {
  const tooltipId = `inventory-tooltip-${instance.instanceId}`;
  const [tooltipPlacement, setTooltipPlacement] = useState<TooltipPlacement>(() => typeof window === "undefined" ? defaultTooltipSettings.placement : readTooltipSettings(window.localStorage).placement);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const style: InventoryCssProperties = {
    "--item-x": 0,
    "--item-y": 0,
    "--item-width": definition.gridSize.width,
    "--item-height": definition.gridSize.height,
    "--tooltip-cursor-x": `${pointer.x}px`,
    "--tooltip-cursor-y": `${pointer.y}px`,
  };

  useEffect(() => {
    const handleSettings = (event: Event) => setTooltipPlacement((event as CustomEvent<TooltipSettings>).detail?.placement ?? readTooltipSettings(window.localStorage).placement);
    window.addEventListener(TOOLTIP_SETTINGS_EVENT, handleSettings);
    return () => window.removeEventListener(TOOLTIP_SETTINGS_EVENT, handleSettings);
  }, []);

  const trackPointer = (event: PointerEvent<HTMLButtonElement>) => {
    if (tooltipPlacement === "cursor") setPointer({ x: event.clientX, y: event.clientY });
  };

  const beginNativeDrag = (event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(INVENTORY_DRAG_TYPE, instance.instanceId);
    onPickUp(instance.instanceId, { x: event.clientX, y: event.clientY, pointerType: "mouse" });
  };

  return (
    <span className="inventory-item-shell">
      <button
        className={`inventory-item${held ? " is-held-source" : ""}`}
        type="button"
        disabled={disabled}
        draggable
        style={style}
        data-item-id={definition.id}
        data-item-instance-id={instance.instanceId}
        data-item-name={definition.name}
        data-item-type={definition.itemType}
        data-item-category={definition.itemCategory}
        data-item-description={definition.description}
        data-item-quality={definition.quality}
        data-item-material-type={definition.materialType}
        data-item-width={definition.gridSize.width}
        data-item-height={definition.gridSize.height}
        data-item-quantity={instance.quantity}
        aria-label={`${definition.name}, ${inventoryQualityName(definition.quality)} quality`}
        aria-describedby={showTooltip ? tooltipId : undefined}
        aria-pressed={held}
        onClick={() => onPickUp(instance.instanceId)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        onDragEnd={cancelOnDragEnd ? onCancel : undefined}
        onPointerCancel={onCancel}
        onPointerMove={trackPointer}
        onTouchCancel={onCancel}
        onLostPointerCapture={onCancel}
        onDragStart={beginNativeDrag}
      >
        <span className="inventory-item__visual">
          <img src={definition.iconPath} alt="" draggable={false} />
          {instance.quantity > 1 ? <span className="inventory-item__quantity">{instance.quantity}</span> : null}
        </span>
      </button>
      {showTooltip ? <span
        id={tooltipId}
        className="slot-tooltip inventory-item-tooltip"
        role="tooltip"
        data-tooltip-placement={tooltipPlacement}
        data-item-quality={definition.quality}
        data-item-category={definition.itemCategory}
      >
        <strong className="slot-tooltip__name">{definition.name}</strong>
        <em className="slot-tooltip__description">{definition.description}</em>
        <span className="inventory-item-tooltip__quality">
          Quality {definition.quality} · {inventoryQualityName(definition.quality)}
        </span>
      </span> : null}
    </span>
  );
}

export function InventorySlot({ definition, heldItem, className = "", children, disabled = false, onPlace, onCancel }: InventorySlotProps) {
  const compatible = !disabled && heldItem ? slotAcceptsItem(definition, heldItem.definition) : false;
  const style: InventoryCssProperties = {
    "--slot-width": definition.gridSize.width,
    "--slot-height": definition.gridSize.height,
  };
  const placeHeld = () => {
    if (compatible && heldItem) onPlace(heldItem.instance.instanceId);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.key === "Enter" || event.key === " ") && compatible) {
      event.preventDefault();
      placeHeld();
    }
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const instanceId = event.dataTransfer.getData(INVENTORY_DRAG_TYPE);
    if (compatible && heldItem?.instance.instanceId === instanceId) onPlace(instanceId);
  };

  return (
    <div
      className={`item-slot ${className}${compatible ? " is-compatible-snap-target" : ""}`.trim()}
      style={style}
      data-accepted-item-types={definition.acceptedItemTypes.join(",")}
      aria-label={definition.label}
      aria-disabled={disabled || !compatible}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={placeHeld}
      onKeyDown={handleKeyDown}
      onDragOver={(event) => {
        if (compatible) event.preventDefault();
      }}
      onDrop={handleDrop}
      onPointerCancel={onCancel}
      onTouchCancel={onCancel}
      onLostPointerCapture={onCancel}
    >
      {children}
    </div>
  );
}
