import { useEffect, useRef, useState } from "react";
import type { CSSProperties, DragEvent, MouseEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import type { CanvasItem } from "./types";
import { defaultTooltipSettings, readTooltipSettings, TOOLTIP_SETTINGS_EVENT, type TooltipPlacement, type TooltipSettings } from "./tooltipSettings";
import backpackArt from "../assets/ui/hud-icons/backpack-pixel.png";
import characterArt from "../assets/ui/hud-icons/character-pixel.png";
import drinkArt from "../assets/ui/hud-icons/drink-pixel.png";
import foodArt from "../assets/ui/hud-icons/food-pixel.png";
import keyholeArt from "../assets/ui/hud-icons/keyhole-pixel.png";
import mapArt from "../assets/ui/hud-icons/map-pixel.png";
import spiritArt from "../assets/ui/hud-icons/spirit-pixel.png";
import sprintArt from "../assets/ui/hud-icons/sprint.png";
import swordArt from "../assets/ui/hud-icons/sword-pixel.png";
import tomeArt from "../assets/ui/hud-icons/tome-pixel.png";

const itemArt: Record<string, string> = {
  backpack: backpackArt,
  boots: sprintArt,
  character: characterArt,
  drink: drinkArt,
  food: foodArt,
  keyhole: keyholeArt,
  map: mapArt,
  spirit: spiritArt,
  sword: swordArt,
  tome: tomeArt,
};

const iconPaths: Record<string, string> = {
  account: '<circle cx="12" cy="10" r="3.2"/><path d="M5 20c.6-3.4 3-5.2 7-5.2s6.4 1.8 7 5.2"/>',
  backpack: '<path d="M7 9a5 5 0 0 1 10 0v11H7z"/><path d="M9.5 9V7a2.5 2.5 0 0 1 5 0v2M7 14h10M10 14v3h4v-3"/>',
  block: '<path d="M12 2l8 4.5v9L12 20l-8-4.5v-9z"/><path d="M12 11l8-4.5M12 11v9M12 11L4 6.5"/>',
  boots: '<path d="M9 3h6v9l4.5 3.5c1.2 1 .5 2.5-1 2.5H9z"/><path d="M9 3v15M6 18h12"/>',
  castle: '<path d="M5 21V9l2-1.5V4h2v2h2V4h2v2h2V4h2v3.5L19 9v12M10 21v-4a2 2 0 0 1 4 0v4M3 21h18"/>',
  cat: '<path d="M6.5 10L5 5l4.5 2.5M17.5 10L19 5l-4.5 2.5"/><circle cx="12" cy="13.5" r="6"/><path d="M9.6 12.8h.01M14.4 12.8h.01M9.2 16c1 .9 1.9 1.3 2.8 1.3s1.8-.4 2.8-1.3"/>',
  earring: '<circle cx="12" cy="6.5" r="2.2"/><path d="M12 8.7v2.8"/><circle cx="12" cy="15.5" r="4"/>',
  flask: '<path d="M10 3h4M10 3v5.5L5.5 17a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 8.5V3M8 15h8"/>',
  glasses: '<circle cx="7" cy="14" r="3.4"/><circle cx="17" cy="14" r="3.4"/><path d="M10.4 14h3.2M3.6 13L3 8.5M20.4 13l.6-4.5"/>',
  gem: '<path d="M6 9l6-6 6 6-6 12zM6 9h12M9.5 9L12 21M14.5 9L12 21"/>',
  glove: '<path d="M8 12V5.5a1.2 1.2 0 0 1 2.4 0V11M10.4 11V4.2a1.2 1.2 0 0 1 2.4 0V11M12.8 11V5a1.2 1.2 0 0 1 2.4 0v6.5M15.2 11.5V7a1.2 1.2 0 0 1 2.4 0v6c0 4.5-2 7.5-5.2 7.5-2.8 0-4.6-1.8-5.4-4.6L5.6 12c.8-1 2-.8 2.4.4"/>',
  helm: '<path d="M5 13v-2a7 7 0 0 1 14 0v2M5 13h14v3.5c-2.5 1.8-4.5 2.5-7 2.5s-4.5-.7-7-2.5zM12 4v9"/>',
  key: '<circle cx="8" cy="8" r="3.4"/><path d="M10.4 10.4L20 20M20 20v-3.5M20 20h-3.5"/>',
  keyhole: '<path d="M12 3.25a5.25 5.25 0 0 0-2.1 10.06L8.5 20.75h7l-1.4-7.44A5.25 5.25 0 0 0 12 3.25Z"/><path d="M12 5.75a2.75 2.75 0 0 1 1.08 5.28l-1.01.43.89 6.79h-1.92l.89-6.79-1.01-.43A2.75 2.75 0 0 1 12 5.75Z"/>',
  map: '<path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3zM9 3v15M15 6v15"/>',
  orb: '<circle cx="12" cy="12" r="5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  outfit: '<path d="M9 4L4 6.5 6 11l2-.8V20h8v-9.8l2 .8 2-4.5L15 4l-3 2z"/>',
  person: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-4 3.2-6 7-6s7 2 7 6"/>',
  phial: '<path d="M9 2h6M10 2v6l-4.5 9a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 8.5V2M9 12h6"/>',
  pickaxe: '<path d="M14 5c3 .2 5.4 1.4 7 3.5l-2 2c-1.4-1.4-3-2.1-5-2.2M3 21l9.8-9.8M8 6l10 10"/>',
  pouch: '<path d="M9 6.5h6l3.5 4.5c0 5.5-2.5 9.5-6.5 9.5S5.5 16 5.5 11zM9 6.5C9 4.5 10 3 12 3s3 1.5 3 3.5"/>',
  ring: '<circle cx="12" cy="14.5" r="5.5"/><path d="M9.8 9.6L12 4l2.2 5.6"/>',
  sword: '<path d="M14.5 3.5l6 6-2.2 2.2-2-2-7.8 7.8-3 1 1-3 7.8-7.8-2-2zM5 19l-2 2M8.5 15.5L12 19"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  tome: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5M9 7h7M9 10h5"/>',
  tool: '<path d="M14 5c3 .2 5.4 1.4 7 3.5l-2 2c-1.4-1.4-3-2.1-5-2.2M3 21l9.8-9.8M8 6l10 10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
};

export function AtlasIcon({ name, size = 1.35, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <svg
      className={`atlas-icon ${className}`.trim()}
      width={`${size}rem`}
      height={`${size}rem`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: iconPaths[name] ?? iconPaths.orb }}
    />
  );
}

export function AtlasItemIcon({ item, size = 1.5 }: { item: CanvasItem; size?: number }) {
  if (item.artPath) return <img className="atlas-slot-art" src={item.artPath} alt="" draggable={false} />;
  const art = itemArt[item.icon];
  if (art) return <img className="atlas-slot-art" src={art} alt="" draggable={false} />;
  return <AtlasIcon name={item.icon} size={size} />;
}

export function AtlasPanel({ title, eyebrow, className = "", children, onClose }: { title: string; eyebrow?: string; className?: string; children: ReactNode; onClose: () => void }) {
  return (
    <section className={`atlas-panel ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title}>
      <header className="atlas-panel-header">
        <div>
          {eyebrow ? <span className="atlas-eyebrow">{eyebrow}</span> : null}
          <h2>{title}</h2>
        </div>
        <button type="button" className="atlas-close" onClick={onClose} aria-label={`Close ${title}`}>
          <AtlasIcon name="x" size={1} />
        </button>
      </header>
      {children}
    </section>
  );
}

export function AtlasCooldown({ item }: { item?: CanvasItem }) {
  const cooldown = item?.stats?.cooldown ?? 0;
  const cooldownRemaining = Math.max(0, Math.min(cooldown, item?.stats?.cooldownRemaining ?? 0));
  if (cooldown <= 0 || cooldownRemaining <= 0) return null;
  const cooldownProgress = (cooldownRemaining / cooldown) * 100;
  return <span className="atlas-slot-cooldown" aria-label={`${cooldownRemaining.toFixed(1)} seconds cooldown remaining`}><strong>{Math.ceil(cooldownRemaining)}</strong><i><b style={{ width: `${cooldownProgress}%` }} /></i></span>;
}

export function AtlasItemSlot({
  item,
  label,
  size = "utility",
  hotkey,
  selected = false,
  dropState,
  className = "",
  style,
  onClick,
  onContextMenu,
  onDrop,
  onDragOver,
  onDragStart,
  onDragEnd,
}: {
  item?: CanvasItem;
  label: string;
  size?: "utility" | "action" | "grid" | "small" | "micro";
  hotkey?: string;
  selected?: boolean;
  dropState?: "valid" | "invalid";
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  onContextMenu?: (event: MouseEvent<HTMLButtonElement>) => void;
  onDrop?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragOver?: () => void;
  onDragStart?: (item: CanvasItem) => void;
  onDragEnd?: () => void;
}) {
  const itemQuantity = item?.quantity && item.quantity > 1 ? ` Quantity ${item.quantity}.` : "";
  const itemCooldown = item?.stats?.cooldownRemaining && item.stats.cooldownRemaining > 0 ? ` Cooldown ${item.stats.cooldownRemaining.toFixed(1)} seconds.` : "";
  const itemTitle = item ? `${item.name}. ${label}.${itemQuantity}${itemCooldown} Drag to move. Right-click for actions.` : `${label}. Empty.`;
  const tooltipText = item ? `${item.name}${item.note ? ` · ${item.note}` : ""}` : `${label} empty`;
  const durability = item?.stats?.durability;
  const durabilityMaximum = item?.stats?.durabilityMaximum ?? 100;
  const durabilityPercent = durability === undefined ? null : Math.max(0, Math.min(100, (durability / Math.max(1, durabilityMaximum)) * 100));
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [tooltipPlacement, setTooltipPlacement] = useState<TooltipPlacement>(() => typeof window === "undefined" ? defaultTooltipSettings.placement : readTooltipSettings(window.localStorage).placement);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number }>({ visible: false, x: 0, y: 0 });

  useEffect(() => {
    const handleSettings = (event: Event) => setTooltipPlacement((event as CustomEvent<TooltipSettings>).detail?.placement ?? readTooltipSettings(window.localStorage).placement);
    window.addEventListener(TOOLTIP_SETTINGS_EVENT, handleSettings);
    return () => window.removeEventListener(TOOLTIP_SETTINGS_EVENT, handleSettings);
  }, []);

  const showTooltip = (pointer?: Readonly<{ x: number; y: number }>) => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const x = tooltipPlacement === "left" ? rect.left
      : tooltipPlacement === "right" ? rect.right
      : tooltipPlacement === "cursor" && pointer ? pointer.x
      : rect.left + rect.width / 2;
    const y = tooltipPlacement === "above" ? rect.top
      : tooltipPlacement === "below" ? rect.bottom
      : tooltipPlacement === "cursor" && pointer ? pointer.y
      : rect.top + rect.height / 2;
    setTooltip({ visible: true, x, y });
  };

  const hideTooltip = () => setTooltip((current) => ({ ...current, visible: false }));
  const handleDragStart = (event: DragEvent<HTMLButtonElement>) => {
    if (!item || !onDragStart) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.id);
    onDragStart(item);
  };

  return (
    <>
      <div className={`atlas-slot-wrap atlas-slot-wrap-${size} ${className}`.trim()} style={style}>
      <button
        ref={buttonRef}
        type="button"
        className={`atlas-slot atlas-slot-type-${item?.type ?? "empty"} ${selected ? "is-selected" : ""} ${dropState ? `is-drop-${dropState}` : ""}`.trim()}
        aria-label={itemTitle}
        draggable={Boolean(item && onDragStart)}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onMouseEnter={(event) => showTooltip({ x: event.clientX, y: event.clientY })}
        onMouseMove={(event) => {
          if (tooltipPlacement === "cursor") showTooltip({ x: event.clientX, y: event.clientY });
        }}
        onMouseLeave={hideTooltip}
        onFocus={() => showTooltip()}
        onBlur={hideTooltip}
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDrop ? (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; onDragOver?.(); } : undefined}
        onDrop={onDrop}
      >
        {hotkey ? <span className="atlas-slot-hotkey">{hotkey}</span> : null}
        {item ? (
          <>
            <AtlasItemIcon item={item} size={size === "action" ? 1.8 : size === "small" ? 1 : size === "micro" ? 0.85 : 1.5} />
            <span className="atlas-slot-name">{item.name}</span>
            {item.quantity && item.quantity > 1 ? <span className="atlas-slot-quantity">{item.quantity}</span> : null}
            {durabilityPercent !== null ? <span className="atlas-slot-durability" aria-label={`${Math.round(durabilityPercent)} percent durability`}><i style={{ width: `${durabilityPercent}%` }} /></span> : null}
            <AtlasCooldown item={item} />
          </>
        ) : (
          <span className="atlas-slot-empty"><AtlasIcon name="plus" size={size === "small" || size === "micro" ? 0.7 : 1} />{label}</span>
        )}
      </button>
      <span className="atlas-slot-caption">{label}</span>
      </div>
      {tooltip.visible && typeof document !== "undefined" ? createPortal(
        <span className={`atlas-slot-tooltip is-${tooltipPlacement}`} style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }} role="tooltip">{tooltipText}</span>,
        document.body,
      ) : null}
    </>
  );
}

export function AtlasProgress({ value, tone = "accent", label, detail }: { value: number; tone?: "accent" | "health" | "spirit" | "success"; label?: string; detail?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={`atlas-progress atlas-progress-${tone}`} aria-label={label}>
      <span className="atlas-progress-track"><i style={{ width: `${clamped}%` }} /></span>
      {detail ? <span className="atlas-progress-detail">{detail}</span> : null}
    </div>
  );
}
