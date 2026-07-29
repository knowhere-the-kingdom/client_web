import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import demoSkills from "../data/demo-skills.json";
import { initialBindings, initialCanvasItems, initialLogs } from "./demoData";
import { CHARACTER_BLOCK_FACE_TARGET_PRESENTATION_EVENT, createActionbarItemAbilityContracts, createDemoSkillContracts, createItemAbilityContracts, createMovementActionsReadModel, findPublishedItemDefinition, characterController, gameplayMouseMode, useCharacterControllerState } from "../features/character-controller";
import type { AbilitySlot, CharacterBlockFaceTargetPresentationEventDetail, CharacterBlockFaceTargetPromptKind, CharacterRenderEvent, MovementActionReadModel, PublishedItemDefinition, SkillRuntimeContract } from "../features/character-controller";
import { EQUIPMENT_LAYOUT_V2_REGIONS } from "../editor/items";
import type { EquipmentLayoutV2LaneDescriptor, EquipmentLayoutV2RegionDescriptor } from "../editor/items";
import { AtlasCooldown, AtlasIcon, AtlasItemIcon, AtlasItemSlot, AtlasPanel, AtlasProgress } from "./AtlasPrimitives";
import { PlayerMapPanel } from "./PlayerMapPanel";
import { SettingsPanel } from "./SettingsPanel";
import type { CanvasItem, CanvasItemLocation, DemoSkill, HudLogEntry, HudMapMarker, HudMapPosition, SettingsBinding } from "./types";
import type { WorldHudProjectionV2 } from "../api/gateway-contract";

type OpenPanel = "login" | "account" | "equipment" | "tome" | "settings";
type CrosshairState = "default" | "targetable" | "interact" | "blocked" | "place" | "place-valid" | "destructive";
type CrosshairSource = CharacterBlockFaceTargetPresentationEventDetail["source"] | "crosshair";
type CrosshairPresentation = {
  state: CrosshairState;
  prompt?: string;
  promptKind: CharacterBlockFaceTargetPromptKind;
  source: CrosshairSource;
  rarityThemeToken?: string;
  validity?: string;
  stability?: string;
  targetDirection?: string;
  revision?: number;
};
type DropState = "valid" | "invalid" | undefined;

type ItemContext = {
  item: CanvasItem;
  slotKind: string;
  x: number;
  y: number;
};

const equipmentSlotKinds: ReadonlySet<string> = new Set<string>(EQUIPMENT_LAYOUT_V2_REGIONS.flatMap((region): string[] => region.lanes?.map((lane) => lane.id) ?? [region.id]));

const abilityItem = (id: string, name: string, icon: string, note: string): CanvasItem => ({
  id,
  type: "skill",
  name,
  w: 1,
  h: 1,
  icon,
  note,
  loc: { kind: "limbo" },
});

const movementAbilities = [
  abilityItem("movement-sprint", "Sprint", "boots", "Movement ability"),
  abilityItem("movement-dodge", "Dodge", "target", "Double-tap movement (WASD)"),
  abilityItem("movement-jump", "Jump", "chevron", "Movement ability"),
  abilityItem("movement-crouch", "Crouch", "person", "Movement ability"),
  abilityItem("movement-flight", "Flight", "orb", "Movement ability"),
];

const tomeAbilities = [
  abilityItem("tome-ultimate", "Ultimate", "orb", "Tome ability"),
  abilityItem("tome-action-1", "Action 1", "sword", "Tome ability"),
  abilityItem("tome-action-2", "Action 2", "flask", "Tome ability"),
];
const movementAbilityHotkeys = ["Shift", "DTAP", "Space", "Ctrl", "Alt"];
const tomeAbilityHotkeys = ["Q", "F", "G"];
const equipmentSlotLabels: ReadonlyMap<string, string> = new Map<string, string>(EQUIPMENT_LAYOUT_V2_REGIONS.flatMap((region): [string, string][] => region.lanes?.map((lane) => [lane.id, lane.label]) ?? [[region.id, region.label]]));
const equipmentCellUnit = 3;
const demoRuntimeSkills = createDemoSkillContracts(demoSkills.skills as DemoSkill[]);
const defaultMapPosition: HudMapPosition = { x: 0, z: 0, heading: 0 };
const defaultMapMarkers: HudMapMarker[] = [
  { id: "garden-keep", kind: "keep", label: "Hollow King Keep", x: 1720, z: 940, discovered: true },
  { id: "garden-gate", kind: "gate", label: "North Gate", x: -2320, z: -1480, discovered: true },
  { id: "boss-threat", kind: "objective", label: "Boss threat: Hollow King stirring", x: 4100, z: 2620, discovered: true },
  { id: "survey-party", kind: "party", label: "Garden survey party", x: -900, z: 1840, discovered: true },
];

function CompassBar({ player, markers }: { player: HudMapPosition; markers: HudMapMarker[] }) {
  const [heading, setHeading] = useState(0);
  const [face, setFace] = useState("+Y");
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

  useEffect(() => {
    const updateHeading = (event: Event) => {
      const detail = (event as CustomEvent<{ heading?: number; face?: string }>).detail;
      if (typeof detail?.heading === "number") setHeading(detail.heading);
      if (detail?.face) setFace(detail.face);
    };
    window.addEventListener("knowhere:camera-heading", updateHeading);
    return () => window.removeEventListener("knowhere:camera-heading", updateHeading);
  }, []);

  const centerIndex = Math.round(heading / 45) % directions.length;
  const tape = Array.from({ length: 7 }, (_, index) => directions[(centerIndex + index - 3 + directions.length) % directions.length]);
  const compassMarkers = markers
    .filter((marker) => marker.discovered)
    .map((marker) => {
      const bearing = (Math.atan2(marker.x - player.x, marker.z - player.z) * 180) / Math.PI;
      const delta = ((bearing - heading + 540) % 360) - 180;
      return {
        marker,
        delta,
        distance: Math.max(1, Math.round(Math.hypot(marker.x - player.x, marker.z - player.z) / 10)),
      };
    })
    .filter(({ delta }) => Math.abs(delta) <= 105)
    .slice(0, 4);

  const markerIcon = (kind: HudMapMarker["kind"]) => kind === "objective" ? "target" : kind === "keep" ? "castle" : kind === "gate" ? "keyhole" : "person";

  return (
    <section className="atlas-compass" aria-label="Compass and experience">
      <div className="atlas-compass-tape">{tape.map((direction, index) => <span key={`${direction}-${index}`} className={index === 3 ? "is-center" : ""}>{direction}</span>)}</div>
      <div className="atlas-compass-rule">
        <i className="atlas-compass-heading" />
        {compassMarkers.map(({ marker, delta, distance }) => (
          <span
            key={marker.id}
            className={`atlas-compass-poi atlas-compass-poi-${marker.kind}`}
            style={{ left: `${50 + (delta / 105) * 50}%` }}
            title={marker.label}
          >
            <small>{distance}m</small>
            <AtlasIcon name={markerIcon(marker.kind)} size={0.72} />
          </span>
        ))}
      </div>
      <div className="atlas-compass-readout"><span>{face}</span><strong>{Math.round(heading).toString().padStart(3, "0")}°</strong></div>
      <div className="atlas-xp-row"><span>Lv 04</span><AtlasProgress value={50} tone="accent" label="Experience" /><strong>4,250 / 8,500 XP</strong></div>
    </section>
  );
}

function MeterRail({ kind, current, max }: { kind: "health" | "spirit"; current: number; max: number }) {
  const percent = max > 0 ? (current / max) * 100 : 0;
  const label = kind === "health" ? "Health" : "Spirit";
  const previous = useRef(current);
  const [change, setChange] = useState<"gaining" | "losing" | null>(null);

  useEffect(() => {
    if (current === previous.current) return;
    setChange(current > previous.current ? "gaining" : "losing");
    previous.current = current;
    const timeout = window.setTimeout(() => setChange(null), 850);
    return () => window.clearTimeout(timeout);
  }, [current]);

  return (
    <section className={`atlas-meter atlas-meter-${kind} ${change ? `is-${change}` : ""}`} aria-label={`${label}: ${current} of ${max}`}>
      <div className="atlas-meter-heading"><span>{label}</span><strong>{current} / {max}</strong></div>
      <div className="atlas-meter-segments" aria-hidden="true">
        {[4, 3, 2, 1, 0].map((segment) => {
          const fill = Math.max(0, Math.min(1, (percent - segment * 20) / 20));
          return <i key={segment} className={fill >= 1 ? "is-filled" : fill > 0 ? "is-partial" : ""}><b style={{ height: `${fill * 100}%` }} /></i>;
        })}
      </div>
    </section>
  );
}

function EventLog({ channel, align, logs }: { channel: "player" | "spirit" | "system"; align: "left" | "right" | "center"; logs: HudLogEntry[] }) {
  const entries = logs.filter((entry) => entry.channel === channel).slice(-4);
  return (
    <section className={`atlas-event-log atlas-event-log-${align}`} aria-label={`${channel} event log`} aria-live={align === "center" ? "assertive" : "polite"} aria-relevant="additions text">
      {entries.map((entry) => <div key={entry.id} className={`atlas-event atlas-event-${entry.severity}`}><span className="atlas-event-dot" /><span>{entry.text}</span></div>)}
    </section>
  );
}

const defaultCrosshairPresentation: CrosshairPresentation = {
  state: "default",
  promptKind: "target",
  source: "crosshair",
};

function targetClassPart(value: string | undefined, fallback: string) {
  return (value ?? fallback).toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

function legacyPromptKind(state: CrosshairState): CharacterBlockFaceTargetPromptKind {
  if (state === "blocked") return "blocked";
  if (state === "place" || state === "place-valid") return "place";
  if (state === "destructive") return "destructive";
  return "target";
}

function promptIcon(promptKind: CharacterBlockFaceTargetPromptKind) {
  if (promptKind === "blocked") return "x";
  if (promptKind === "place") return "plus";
  if (promptKind === "destructive") return "pickaxe";
  return "target";
}

function Crosshair({ presentation }: { presentation: CrosshairPresentation }) {
  const style = presentation.rarityThemeToken ? ({ "--atlas-target-rarity": `var(${presentation.rarityThemeToken})` } as CSSProperties) : undefined;
  const state = presentation.state;
  const prompt = presentation.prompt;
  const promptKind = presentation.promptKind;
  const statusText = prompt ? `${prompt}${presentation.validity ? `. ${presentation.validity}` : ""}` : "No block target";
  return (
    <div
      className={`atlas-crosshair atlas-crosshair-${state} atlas-crosshair-source-${targetClassPart(presentation.source, "crosshair")} atlas-crosshair-stability-${targetClassPart(presentation.stability, "unknown")} atlas-crosshair-validity-${targetClassPart(presentation.validity, "unknown")} atlas-crosshair-direction-${targetClassPart(presentation.targetDirection, "selected")}`}
      style={style}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={statusText}
      data-target-revision={presentation.revision}
    >
      <span className="atlas-crosshair-reticle" aria-hidden="true"><i /><i /><i /><i /></span>
      <span className={`atlas-crosshair-prompt ${prompt ? "" : "is-empty"}`.trim()} aria-hidden={prompt ? undefined : true}>
        <AtlasIcon name={promptIcon(promptKind)} size={0.8} />
        <span>{prompt ?? "No target"}</span>
      </span>
    </div>
  );
}

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function AtlasOverlay({ children, className = "", onClose }: { children: ReactNode; className?: string; onClose?: () => void }) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFirst = () => {
      const first = overlay.querySelector<HTMLElement>(focusableSelector);
      (first ?? overlay).focus();
    };
    window.requestAnimationFrame(focusFirst);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose?.();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(overlay.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        overlay.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    overlay.addEventListener("keydown", handleKeyDown);
    return () => {
      overlay.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  return <div ref={overlayRef} className={`atlas-overlay ${className}`.trim()} tabIndex={-1} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>{children}</div>;
}

function LoginPanel({ onLogin, onClose }: { onLogin: (name: "User" | "Admin") => void; onClose: () => void }) {
  return (
    <AtlasOverlay onClose={onClose}>
      <AtlasPanel title="Enter the Kingdom" eyebrow="Identity" className="atlas-login-panel" onClose={onClose}>
        <div className="atlas-panel-copy"><AtlasIcon name="keyhole" size={2.5} /><p>The keyhole watches. Present yourself to enter Knowhere.</p></div>
        <div className="atlas-panel-actions"><button type="button" className="atlas-primary-button" onClick={() => onLogin("User")}>Test login: User</button><button type="button" className="atlas-secondary-button" onClick={() => onLogin("Admin")}>Test login: Admin</button></div>
      </AtlasPanel>
    </AtlasOverlay>
  );
}

function AccountPanel({ loggedIn, onSignOut, onClose }: { loggedIn: "User" | "Admin" | null; onSignOut: () => void; onClose: () => void }) {
  const [tab, setTab] = useState<"profile" | "knowledge">("profile");
  return (
    <AtlasOverlay onClose={onClose}>
      <AtlasPanel title={`Account · ${loggedIn ?? "Wanderer"}`} eyebrow="Spirit profile" className="atlas-account-panel" onClose={onClose}>
        <div className="atlas-tabs">{(["profile", "knowledge"] as const).map((value) => <button key={value} type="button" className={tab === value ? "is-active" : ""} onClick={() => setTab(value)}>{value === "profile" ? "Profile" : "Knowledge"}</button>)}</div>
        {tab === "profile" ? (
          <div className="atlas-profile-card"><div className="atlas-profile-sigil"><AtlasIcon name="person" size={2.2} /></div><div><strong>{loggedIn ?? "Wanderer"}</strong><span>{loggedIn === "Admin" ? "Keeper of the Kingdom" : "Spirit of Knowhere"}</span><AtlasProgress value={68} tone="spirit" label="Spirit attunement" detail="68% attuned" /></div></div>
        ) : (
          <div className="atlas-list"><div className="atlas-list-row"><AtlasIcon name="person" size={1.2} /><span>Avatars</span><small>3 discovered</small></div><div className="atlas-list-row"><AtlasIcon name="gem" size={1.2} /><span>Collections</span><small>18 items catalogued</small></div><div className="atlas-list-row"><AtlasIcon name="castle" size={1.2} /><span>Reputation</span><small>The Keepers · Honored</small></div><div className="atlas-list-row"><AtlasIcon name="target" size={1.2} /><span>Achievements</span><small>3 of 12 unlocked</small></div></div>
        )}
        <div className="atlas-panel-footer"><button type="button" className="atlas-secondary-button" onClick={onSignOut}>Sign out</button></div>
      </AtlasPanel>
    </AtlasOverlay>
  );
}

function BagGrid({ bag, items, draggedItemId, onDragStart, onDragEnd, onDropGrid, onClick, onContextMenu }: { bag: CanvasItem; items: CanvasItem[]; draggedItemId: string | null; onDragStart: (item: CanvasItem) => void; onDragEnd: () => void; onDropGrid: (event: DragEvent<HTMLDivElement>, x: number, y: number) => void; onClick: (item: CanvasItem) => void; onContextMenu: (event: MouseEvent<HTMLButtonElement>, item: CanvasItem, slotKind: string) => void }) {
  const cols = bag.grid?.cols ?? 6;
  const rows = bag.grid?.rows ?? 4;
  const unit = 4;
  return (
    <div className="atlas-bag-grid" data-bag-id={bag.id} style={{ width: `${cols * unit}rem`, height: `${rows * unit}rem`, gridTemplateColumns: `repeat(${cols}, ${unit}rem)`, gridTemplateRows: `repeat(${rows}, ${unit}rem)` }}>
      {Array.from({ length: cols * rows }).map((_, index) => {
        const x = index % cols;
        const y = Math.floor(index / cols);
        return <div key={`${x}:${y}`} className="atlas-bag-cell" data-x={x} data-y={y} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDropGrid(event, x, y)} />;
      })}
      {items.map((item) => {
        if (item.loc.kind !== "grid") return null;
        return (
          <button
            key={item.id}
            type="button"
            className={`atlas-grid-item ${draggedItemId === item.id ? "is-dragging" : ""}`}
            style={{ left: `${item.loc.x * unit}rem`, top: `${item.loc.y * unit}rem`, width: `${item.w * unit}rem`, height: `${item.h * unit}rem` }}
            draggable
            onDragStart={() => onDragStart(item)}
            onDragEnd={onDragEnd}
            onClick={() => onClick(item)}
            onContextMenu={(event) => onContextMenu(event, item, "grid")}
            title={`${item.name}. ${item.type}. ${item.w} by ${item.h} cells.`}
          >
            <AtlasItemIcon item={item} size={item.w > 1 || item.h > 1 ? 1.7 : 1.2} /><span>{item.name}</span><AtlasCooldown item={item} />
          </button>
        );
      })}
    </div>
  );
}

function StashPanel({ bag, items, capacity, draggedItemId, onDragStart, onDragEnd, onDropGrid, onClick, onContextMenu, onClose }: { bag: CanvasItem; items: CanvasItem[]; capacity: number; draggedItemId: string | null; onDragStart: (item: CanvasItem) => void; onDragEnd: () => void; onDropGrid: (event: DragEvent<HTMLDivElement>, x: number, y: number) => void; onClick: (item: CanvasItem) => void; onContextMenu: (event: MouseEvent<HTMLButtonElement>, item: CanvasItem, slotKind: string) => void; onClose: () => void }) {
  return (
    <AtlasOverlay className="atlas-stash-overlay" onClose={onClose}>
      <section className="atlas-panel atlas-inventory-panel atlas-stash-panel" role="dialog" aria-modal="true" aria-label={`${bag.name} stash`}>
        <header className="atlas-panel-header atlas-stash-header">
          <div><span className="atlas-eyebrow">Personal inventory</span><h2>Stash</h2><small>{bag.name} · drag items to arrange them</small></div>
          <button type="button" className="atlas-close" onClick={onClose} aria-label="Close stash"><AtlasIcon name="x" size={1.1} /></button>
        </header>
        <nav className="atlas-stash-tabs" aria-label="Stash locations">
          <button type="button" className="is-active" aria-current="page">Personal</button>
          <button type="button" disabled>Shared I</button>
          <button type="button" disabled>Shared II</button>
          <button type="button" disabled>Shared III</button>
        </nav>
        <div className="atlas-inventory-toolbar">
          <div><strong>{items.length} items secured</strong><span>Drag to move · right-click for actions · nested bags retain their contents</span></div>
          <span>{capacity} / 20 capacity</span>
        </div>
        <div className="atlas-bag-grid-wrap atlas-stash-grid-wrap">
          <BagGrid bag={{ ...bag, grid: bag.grid ?? { cols: 6, rows: 4 } }} items={items} draggedItemId={draggedItemId} onDragStart={onDragStart} onDragEnd={onDragEnd} onDropGrid={onDropGrid} onClick={onClick} onContextMenu={onContextMenu} />
        </div>
        <footer className="atlas-stash-footer"><span><AtlasIcon name="backpack" size={0.8} /> Personal vault</span><small>Esc closes · gold cells show the active container footprint</small></footer>
      </section>
    </AtlasOverlay>
  );
}

function EquipmentPanel({ activeCharacter, equipItem, movementActions, onDrop, draggedItemId, onDragStart, onDragEnd, onContextMenu, onClose }: { activeCharacter?: CanvasItem; equipItem: (slot: string) => CanvasItem | undefined; movementActions: MovementActionReadModel; onDrop: (event: DragEvent<HTMLButtonElement>, slot: string) => void; draggedItemId: string | null; onDragStart: (item: CanvasItem) => void; onDragEnd: () => void; onContextMenu: (event: MouseEvent<HTMLButtonElement>, item: CanvasItem, slot: string) => void; onClose: () => void }) {
  const panelRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{ pointerId: number; dx: number; dy: number } | null>(null);
  const [position, setPosition] = useState(() => readEquipmentPanelPosition());
  const leftRegions = EQUIPMENT_LAYOUT_V2_REGIONS.filter((region) => region.stack === "left").sort((a, b) => a.order - b.order);
  const rightRegions = EQUIPMENT_LAYOUT_V2_REGIONS.filter((region) => region.stack === "right").sort((a, b) => a.order - b.order);
  const movePanel = (x: number, y: number) => {
    const rect = panelRef.current?.getBoundingClientRect();
    const next = clampPanelPosition(x, y, rect?.width ?? 820, rect?.height ?? 620);
    setPosition(next);
    window.localStorage.setItem("knowhere.equipmentPanel.v2.position", JSON.stringify({ version: 2, ...next }));
  };
  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { pointerId: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const dragPanel = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    movePanel(event.clientX - drag.dx, event.clientY - drag.dy);
  };
  const stopDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };
  return (
    <AtlasOverlay className="atlas-overlay-no-blur" onClose={onClose}>
      <section ref={panelRef} className="atlas-panel atlas-equipment-panel atlas-equipment-panel-v2" role="dialog" aria-modal="true" aria-label={`${activeCharacter?.name ?? "No character"} equipment`} style={{ left: `${position.x}px`, top: `${position.y}px` }}>
        <header className="atlas-panel-header atlas-equipment-drag-handle" onPointerDown={startDrag} onPointerMove={dragPanel} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
          <div><span className="atlas-eyebrow">Equipment Layout V2</span><h2>{activeCharacter?.name ?? "No character"} · Equipment</h2><small>Header drag handle · Escape closes · no earrings in V2</small></div>
          <button type="button" className="atlas-close" onClick={onClose} aria-label="Close equipment"><AtlasIcon name="x" size={1} /></button>
        </header>
        <div className="atlas-equipment-summary"><div className="atlas-equipment-avatar"><AtlasIcon name={activeCharacter?.icon ?? "person"} size={3} /></div><div><strong>Field loadout</strong><span>Two contract-backed equipment stacks with split glove lanes and separate ring cells.</span><AtlasProgress value={72} tone="accent" label="Loadout stability" detail="72% stable" /></div></div>
        <div className="atlas-equipment-v2-body">
          <EquipmentStack title="Left stack" regions={leftRegions} equipItem={equipItem} draggedItemId={draggedItemId} onDrop={onDrop} onDragStart={onDragStart} onDragEnd={onDragEnd} onContextMenu={onContextMenu} />
          <EquipmentStack title="Right stack" regions={rightRegions} equipItem={equipItem} draggedItemId={draggedItemId} onDrop={onDrop} onDragStart={onDragStart} onDragEnd={onDragEnd} onContextMenu={onContextMenu} />
        </div>
        <section className="atlas-equipment-group atlas-movement-actions"><h3>{movementActions.sectionLabel}</h3><div className="atlas-movement-action-row">{movementActions.actions.map((action) => <MovementActionSlot key={action.id} action={action} />)}</div></section>
      </section>
    </AtlasOverlay>
  );
}

function EquipmentStack({ title, regions, equipItem, draggedItemId, onDrop, onDragStart, onDragEnd, onContextMenu }: { title: string; regions: readonly EquipmentLayoutV2RegionDescriptor[]; equipItem: (slot: string) => CanvasItem | undefined; draggedItemId: string | null; onDrop: (event: DragEvent<HTMLButtonElement>, slot: string) => void; onDragStart: (item: CanvasItem) => void; onDragEnd: () => void; onContextMenu: (event: MouseEvent<HTMLButtonElement>, item: CanvasItem, slot: string) => void }) {
  return <section className="atlas-equipment-stack"><h3>{title}</h3>{regions.map((region) => <EquipmentRegion key={region.id} region={region} equipItem={equipItem} draggedItemId={draggedItemId} onDrop={onDrop} onDragStart={onDragStart} onDragEnd={onDragEnd} onContextMenu={onContextMenu} />)}</section>;
}

function EquipmentRegion({ region, equipItem, draggedItemId, onDrop, onDragStart, onDragEnd, onContextMenu }: { region: EquipmentLayoutV2RegionDescriptor; equipItem: (slot: string) => CanvasItem | undefined; draggedItemId: string | null; onDrop: (event: DragEvent<HTMLButtonElement>, slot: string) => void; onDragStart: (item: CanvasItem) => void; onDragEnd: () => void; onContextMenu: (event: MouseEvent<HTMLButtonElement>, item: CanvasItem, slot: string) => void }) {
  const lanes = region.lanes ?? null;
  const gridStyle = { gridTemplateColumns: `repeat(${region.grid.cols}, ${equipmentCellUnit}rem)`, gridTemplateRows: `repeat(${region.grid.rows}, ${equipmentCellUnit}rem)` } as CSSProperties;
  return (
    <div className="atlas-equipment-region" data-region-id={region.id}>
      <span>{region.label}</span>
      <div className="atlas-equipment-region-grid" style={gridStyle}>
        {lanes ? lanes.map((lane) => <EquipmentLaneSlot key={lane.id} lane={lane} item={equipItem(lane.id)} draggedItemId={draggedItemId} onDrop={onDrop} onDragStart={onDragStart} onDragEnd={onDragEnd} onContextMenu={onContextMenu} />) : <EquipmentRegionSlot region={region} item={equipItem(region.id)} draggedItemId={draggedItemId} onDrop={onDrop} onDragStart={onDragStart} onDragEnd={onDragEnd} onContextMenu={onContextMenu} />}
      </div>
    </div>
  );
}

function EquipmentRegionSlot({ region, item, draggedItemId, onDrop, onDragStart, onDragEnd, onContextMenu }: { region: EquipmentLayoutV2RegionDescriptor; item?: CanvasItem; draggedItemId: string | null; onDrop: (event: DragEvent<HTMLButtonElement>, slot: string) => void; onDragStart: (item: CanvasItem) => void; onDragEnd: () => void; onContextMenu: (event: MouseEvent<HTMLButtonElement>, item: CanvasItem, slot: string) => void }) {
  return <AtlasItemSlot item={item} label={region.label} size="grid" className="atlas-equipment-slot atlas-equipment-slot-v2" style={{ gridColumn: `span ${region.grid.cols}`, gridRow: `span ${region.grid.rows}` }} dropState={draggedItemId ? "valid" : undefined} onDrop={(event) => onDrop(event, region.id)} onDragStart={onDragStart} onDragEnd={onDragEnd} onContextMenu={(event) => item && onContextMenu(event, item, region.id)} />;
}

function EquipmentLaneSlot({ lane, item, draggedItemId, onDrop, onDragStart, onDragEnd, onContextMenu }: { lane: EquipmentLayoutV2LaneDescriptor; item?: CanvasItem; draggedItemId: string | null; onDrop: (event: DragEvent<HTMLButtonElement>, slot: string) => void; onDragStart: (item: CanvasItem) => void; onDragEnd: () => void; onContextMenu: (event: MouseEvent<HTMLButtonElement>, item: CanvasItem, slot: string) => void }) {
  return <AtlasItemSlot item={item} label={lane.label} size="grid" className="atlas-equipment-slot atlas-equipment-slot-v2" style={{ gridColumn: `${lane.origin.x + 1} / span ${lane.grid.cols}`, gridRow: `${lane.origin.y + 1} / span ${lane.grid.rows}` }} dropState={draggedItemId ? "valid" : undefined} onDrop={(event) => onDrop(event, lane.id)} onDragStart={onDragStart} onDragEnd={onDragEnd} onContextMenu={(event) => item && onContextMenu(event, item, lane.id)} />;
}

function MovementActionSlot({ action }: { action: MovementActionReadModel["actions"][number] }) {
  const cooldownSeconds = action.cooldown ? action.cooldown.totalMs / 1000 : 0;
  const cooldownRemaining = action.cooldown ? action.cooldown.remainingMs / 1000 : 0;
  const item = abilityItem(action.id, action.label, action.icon, action.disabledReason ?? action.binding);
  const displayItem = { ...item, stats: cooldownSeconds > 0 ? { cooldown: cooldownSeconds, cooldownRemaining } : undefined };
  return <div className={`atlas-movement-action ${action.active ? "is-active" : ""} ${action.disabled ? "is-disabled" : ""}`.trim()} title={action.disabledReason ?? `${action.label}: ${action.binding}`}><AtlasItemSlot item={displayItem} label={action.label} size="action" selected={action.selected} /><small>{action.binding}</small>{action.charges ? <span>{action.charges.current}/{action.charges.max}</span> : null}</div>;
}

function readEquipmentPanelPosition(): { x: number; y: number } {
  const fallback = () => clampPanelPosition((window.innerWidth - 820) / 2, 48, 820, 620);
  try {
    const stored = JSON.parse(window.localStorage.getItem("knowhere.equipmentPanel.v2.position") ?? "null") as { version?: number; x?: number; y?: number } | null;
    if (stored?.version === 2 && Number.isFinite(stored.x) && Number.isFinite(stored.y)) return clampPanelPosition(stored.x ?? 0, stored.y ?? 0, 820, 620);
  } catch { return fallback(); }
  return fallback();
}

function clampPanelPosition(x: number, y: number, width: number, height: number): { x: number; y: number } {
  const pad = 8;
  return { x: Math.max(pad, Math.min(x, window.innerWidth - width - pad)), y: Math.max(pad, Math.min(y, window.innerHeight - height - pad)) };
}

function TomePanel({ onClose }: { onClose: () => void }) {
  const playerSkills = demoSkills.skills.filter((skill) => demoSkills.playerSkillIds.includes(skill.id)) as DemoSkill[];
  return (
    <AtlasOverlay onClose={onClose}>
      <AtlasPanel title="Tome of Knowhere" eyebrow="Skills" className="atlas-tome-panel" onClose={onClose}>
        <div className="atlas-tome-xp"><div><span>Tome experience</span><strong>64%</strong></div><AtlasProgress value={64} tone="spirit" label="Tome experience" /></div>
        <div className="atlas-skill-grid">{playerSkills.slice(0, 8).map((skill) => <div key={skill.id} className="atlas-skill-card"><AtlasIcon name={skill.icon} size={1.25} /><div><strong>{skill.name}</strong><span>{skill.description}</span></div></div>)}</div>
      </AtlasPanel>
    </AtlasOverlay>
  );
}

function isCompatible(item: CanvasItem, slotKind: string) {
  if (slotKind === "grid") return true;
  if (slotKind === "character") return item.type === "character";
  if (slotKind === "spirit") return item.type === "spirit";
  if (slotKind === "food") return item.type === "food";
  if (slotKind === "drink") return item.type === "drink";
  if (slotKind === "map") return item.type === "map";
  if (slotKind === "backpack") return item.type === "bag";
  if (slotKind === "tome") return item.type === "tome";
  if (slotKind.startsWith("action")) return item.compatibleSlots?.includes("action") || ["weapon", "tool", "block", "skill"].includes(item.type);
  if (equipmentSlotKinds.has(slotKind)) {
    const accepted = equipmentAcceptedKinds(slotKind);
    const kind = equipmentKindForItem(item);
    if (item.type === "glove" && accepted.some((entry) => entry === "glove-left" || entry === "glove-right")) return true;
    return kind ? accepted.includes(kind) : false;
  }
  return false;
}

function equipmentAcceptedKinds(slotKind: string): readonly string[] {
  const region = EQUIPMENT_LAYOUT_V2_REGIONS.find((entry) => entry.id === slotKind);
  if (region) return region.acceptedKinds;
  const laneRegion = EQUIPMENT_LAYOUT_V2_REGIONS.find((entry) => entry.lanes?.some((lane) => lane.id === slotKind));
  const lane = laneRegion?.lanes?.find((entry) => entry.id === slotKind);
  return lane?.acceptedKinds ?? [];
}

function equipmentKindForItem(item: CanvasItem): string | null {
  if (item.type === "glove") return "glove-left";
  if (item.type === "ring") return "ring";
  if (item.type === "glasses") return "face";
  if (item.type === "feet") return "feet";
  if (["head", "outfit", "belt", "neck"].includes(item.type)) return item.type;
  return null;
}

function locationsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

export type KnowhereHudProps = Readonly<{ accountLabel: string; projection?: WorldHudProjectionV2 | null; poweringDown?: boolean; onInventoryMove?: (itemInstanceId:string,destination:CanvasItemLocation,expectedRevision:number)=>Promise<WorldHudProjectionV2|null>; onLogout: () => void }>;

export function KnowhereHud({ accountLabel, projection = null, poweringDown = false, onInventoryMove, onLogout }: KnowhereHudProps) {
  const [items, setItems] = useState<Record<string, CanvasItem>>(() => ({
    ...initialCanvasItems,
    kingdom: { ...initialCanvasItems.kingdom, loc: { kind: "limbo" } },
    acctUser: { ...initialCanvasItems.acctUser, name: accountLabel, loc: { kind: "hud", slot: "account" } },
  }));
  const [logs, setLogs] = useState<HudLogEntry[]>(initialLogs);
  const [bindings, setBindings] = useState<SettingsBinding[]>(initialBindings);
  const controllerState = useCharacterControllerState();
  const previousMeters = useRef({ health: controllerState.health.current, spirit: controllerState.resources.spirit.current });
  const previousLifecycle = useRef(controllerState.lifecycle);
  const logSequence = useRef(initialLogs.length);
  const [openPanel, setOpenPanel] = useState<OpenPanel | null>(null);
  const [openBagId, setOpenBagId] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState<"User" | "Admin" | null>("User");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [rejectedDropTarget, setRejectedDropTarget] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState(0);
  const [abilityClock, setAbilityClock] = useState(() => performance.now());
  const [publishedSkills] = useState<SkillRuntimeContract[]>([]);
  const [publishedItems] = useState<PublishedItemDefinition[]>([]);
  const [contextMenu, setContextMenu] = useState<ItemContext | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const [crosshairPresentation, setCrosshairPresentation] = useState<CrosshairPresentation>(defaultCrosshairPresentation);
  const [mapPosition, setMapPosition] = useState<HudMapPosition>(defaultMapPosition);
  const [chatDraft, setChatDraft] = useState("");
  const chatInputRef = useRef<HTMLInputElement | null>(null);

  const allItems = useMemo(() => Object.values(items), [items]);
  const hudItem = (slot: string) => allItems.find((item) => item.loc.kind === "hud" && item.loc.slot === slot);
  const gridItems = (bagId: string) => allItems.filter((item) => item.loc.kind === "grid" && item.loc.bagId === bagId);
  const activeCharacter = hudItem("character");
  const mapItem = hudItem("map");
  const equipItem = (slot: string) => allItems.find((item) => item.loc.kind === "equip" && item.loc.charId === activeCharacter?.id && item.loc.slot === slot);
  const actionSlots = useMemo(() => Array.from({ length: 9 }, (_, index) => hudItem(`action${index}`)), [allItems]);
  const selectedHandItem = actionSlots[selectedAction];
  const selectedItemDefinition = useMemo(() => findPublishedItemDefinition(selectedHandItem, publishedItems), [selectedHandItem?.id, selectedHandItem?.name, publishedItems]);
  const itemAbilityContracts = useMemo(
    () => createItemAbilityContracts(selectedHandItem, selectedItemDefinition),
    [selectedHandItem?.id, selectedHandItem?.leftClickAction, selectedHandItem?.rightClickAction, selectedHandItem?.stats?.cooldown, selectedItemDefinition],
  );
  const actionbarItemAbilityContracts = useMemo(
    () => createActionbarItemAbilityContracts(actionSlots, publishedItems),
    [actionSlots, publishedItems],
  );
  const backpack = hudItem("backpack");
  const tome = hudItem("tome");
  const bagSlotCount = useMemo(() => Math.min(20, 4 + (equipItem("belt")?.stats?.bagSlots ?? 0) + (equipItem("outfit")?.stats?.bagSlots ?? 0)), [allItems, activeCharacter?.id]);
  const movementActions = useMemo(() => createMovementActionsReadModel({ state: controllerState, skills: [...demoRuntimeSkills, ...publishedSkills, ...actionbarItemAbilityContracts, ...itemAbilityContracts], bindings, now: abilityClock }), [actionbarItemAbilityContracts, abilityClock, bindings, controllerState, itemAbilityContracts, publishedSkills]);

  const appendLog = (channel: HudLogEntry["channel"], text: string, severity: HudLogEntry["severity"]) => {
    logSequence.current += 1;
    const entry: HudLogEntry = { id: `runtime-${logSequence.current}`, channel, text, severity, createdAt: Date.now() };
    setLogs((current) => [...current, entry].slice(-24));
  };

  const activateAction = (index: number) => {
    const item = actionSlots[index];
    setSelectedAction(index);
    if (!item) { appendLog("spirit", `Action ${index + 1} is empty`, "warning"); return; }
    if (controllerState.lifecycle !== "alive") { appendLog("spirit", `${item.name} unavailable while defeated`, "warning"); return; }
    const abilitySlot = `actionbar.${index + 1}` as AbilitySlot;
    const skill = characterController.getSkillForSlot(abilitySlot);
    if (skill) {
      if (!characterController.activateSlot(abilitySlot)) appendLog("spirit", `${item.name} action blocked`, "warning");
      else appendLog("spirit", `${skill.name}`, "info");
      return;
    }
    const remaining = item.stats?.cooldownRemaining ?? 0;
    if (remaining > 0) { appendLog("spirit", `${item.name} ready in ${remaining.toFixed(1)}s`, "warning"); return; }
    const cooldown = item.stats?.cooldown ?? 0;
    if (cooldown > 0) setItems((current) => ({ ...current, [item.id]: { ...current[item.id], stats: { ...current[item.id].stats, cooldown, cooldownRemaining: cooldown } } }));
    if (item.type === "skill") characterController.spendSpirit(6);
    const action = item.leftClickAction ? item.leftClickAction.replace(/^./, (value) => value.toUpperCase()) : "Used";
    appendLog("spirit", `${action}: ${item.name}`, "info");
  };

  const slotDisplayName = (slotKind: string) => slotKind.startsWith("action") ? `Action ${Number(slotKind.replace("action", "")) + 1}` : equipmentSlotLabels.get(slotKind) ?? slotKind.replace(/^./, (value) => value.toUpperCase());

  const rejectDrop = (slotKind: string, itemName: string, reason: string) => {
    setRejectedDropTarget(slotKind);
    appendLog("player", `${itemName} cannot use ${slotDisplayName(slotKind)} — ${reason}`, "warning");
    window.setTimeout(() => setRejectedDropTarget((current) => current === slotKind ? null : current), 720);
    setDraggedItemId(null);
    setDropTarget(null);
  };

  useEffect(() => {
    characterController.configureBindings(bindings);
  }, [bindings]);

  useEffect(() => {
    if (!projection) return;
    characterController.setMeter("health", projection.meters.health.current, projection.meters.health.max);
    characterController.setMeter("spirit", projection.meters.spirit.current, projection.meters.spirit.max);
  }, [projection?.projectionRevision]);

  useEffect(() => {
    characterController.configureSkills([...demoRuntimeSkills, ...publishedSkills, ...actionbarItemAbilityContracts, ...itemAbilityContracts]);
  }, [actionbarItemAbilityContracts, itemAbilityContracts, publishedSkills]);

  useEffect(() => {
    if (Object.keys(controllerState.timers.cooldowns).length === 0) return;
    const interval = window.setInterval(() => setAbilityClock(performance.now()), 100);
    return () => window.clearInterval(interval);
  }, [controllerState.timers.cooldowns]);

  useEffect(() => characterController.subscribeEvents((event: CharacterRenderEvent) => {
    if (!event.abilityId) return;
    const phase = event.animationTag.split(".").at(-1) ?? "active";
    appendLog("spirit", `${event.abilityId}: ${phase}`, "info");
  }), []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setItems((current) => {
        let changed = false;
        const next = Object.fromEntries(Object.entries(current).map(([id, item]) => {
          const remaining = item.stats?.cooldownRemaining ?? 0;
          if (remaining <= 0) return [id, item];
          changed = true;
          return [id, { ...item, stats: { ...item.stats, cooldownRemaining: Math.max(0, Number((remaining - 0.1).toFixed(1))) } }];
        })) as Record<string, CanvasItem>;
        return changed ? next : current;
      });
    }, 100);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const nextEntries: HudLogEntry[] = [];
    const healthDelta = controllerState.health.current - previousMeters.current.health;
    const spiritDelta = controllerState.resources.spirit.current - previousMeters.current.spirit;
    const add = (channel: HudLogEntry["channel"], text: string, severity: HudLogEntry["severity"]) => {
      logSequence.current += 1;
      nextEntries.push({ id: `runtime-${logSequence.current}`, channel, text, severity, createdAt: Date.now() });
    };
    if (healthDelta < 0) add("player", `Damage taken: ${Math.abs(healthDelta)}`, "damage");
    if (healthDelta > 0) add("player", `Health restored: ${healthDelta}`, "gain");
    if (spiritDelta < 0) add("spirit", `Spirit spent: ${Math.abs(spiritDelta)}`, "warning");
    if (spiritDelta > 0) add("spirit", `Spirit restored: ${spiritDelta}`, "gain");
    if (controllerState.lifecycle !== previousLifecycle.current) {
      if (controllerState.lifecycle === "dying") add("player", "Critical health — spirit destabilizing", "warning");
      if (controllerState.lifecycle === "dead") add("player", "Player defeated", "damage");
      if (controllerState.lifecycle === "respawning") add("player", "Spirit reforming…", "info");
      if (controllerState.lifecycle === "alive" && previousLifecycle.current !== "alive") add("player", "Player restored", "gain");
      previousLifecycle.current = controllerState.lifecycle;
    }
    previousMeters.current = { health: controllerState.health.current, spirit: controllerState.resources.spirit.current };
    if (nextEntries.length > 0) setLogs((current) => [...current, ...nextEntries].slice(-24));
  }, [controllerState.health.current, controllerState.lifecycle, controllerState.resources.spirit.current]);

  useEffect(() => {
    const handleMeter = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: "health" | "spirit"; current?: number; max?: number }>).detail;
      if (!detail?.kind || typeof detail.current !== "number" || typeof detail.max !== "number") return;
      characterController.setMeter(detail.kind, detail.current, detail.max);
    };
    const handleCrosshair = (event: Event) => {
      const detail = (event as CustomEvent<{ state?: CrosshairState; prompt?: string }>).detail;
      if (!detail?.state) return;
      setCrosshairPresentation({
        state: detail.state,
        prompt: detail.prompt,
        promptKind: legacyPromptKind(detail.state),
        source: "crosshair",
      });
    };
    const handleBlockFaceTargetPresentation = (event: Event) => {
      const detail = (event as CustomEvent<CharacterBlockFaceTargetPresentationEventDetail>).detail;
      if (!detail?.presentation) return;
      setCrosshairPresentation({
        state: detail.presentation.state,
        prompt: detail.presentation.state === "blocked" ? detail.presentation.reason : detail.presentation.prompt,
        promptKind: detail.presentation.promptKind,
        source: detail.source,
        rarityThemeToken: detail.presentation.rarityThemeToken,
        validity: detail.presentation.validity,
        stability: detail.presentation.stability,
        targetDirection: detail.presentation.targetDirection,
        revision: detail.revision,
      });
    };
    const handleBlockFaceTargetClear = () => {
      setCrosshairPresentation(defaultCrosshairPresentation);
    };
    const amount = (event: Event) => Math.max(0, Number((event as CustomEvent<{ amount?: number }>).detail?.amount ?? 0));
    const handleDamage = (event: Event) => characterController.damage(amount(event));
    const handleHeal = (event: Event) => characterController.heal(amount(event));
    const handleSpiritSpend = (event: Event) => characterController.spendSpirit(amount(event));
    const handleSpiritRestore = (event: Event) => characterController.restoreSpirit(amount(event));
    const handleRespawn = () => characterController.respawn();
    const handleMapPosition = (event: Event) => {
      const detail = (event as CustomEvent<Partial<HudMapPosition>>).detail;
      setMapPosition((current) => {
        const next = {
          x: typeof detail?.x === "number" ? detail.x : current.x,
          z: typeof detail?.z === "number" ? detail.z : current.z,
          heading: typeof detail?.heading === "number" ? detail.heading : current.heading,
        };
        const moved = Math.abs(next.x - current.x) > 0.25 || Math.abs(next.z - current.z) > 0.25;
        const turned = Math.abs(next.heading - current.heading) > 0.5;
        return moved || turned ? next : current;
      });
    };
    window.addEventListener("knowhere:hud-meter", handleMeter);
    window.addEventListener("knowhere:crosshair", handleCrosshair);
    window.addEventListener(CHARACTER_BLOCK_FACE_TARGET_PRESENTATION_EVENT, handleBlockFaceTargetPresentation);
    window.addEventListener("knowhere:block-face-target-clear", handleBlockFaceTargetClear);
    window.addEventListener("knowhere:player-damage", handleDamage);
    window.addEventListener("knowhere:player-heal", handleHeal);
    window.addEventListener("knowhere:spirit-spend", handleSpiritSpend);
    window.addEventListener("knowhere:spirit-restore", handleSpiritRestore);
    window.addEventListener("knowhere:player-respawn", handleRespawn);
    window.addEventListener("knowhere:player-map-position", handleMapPosition);
    return () => {
      window.removeEventListener("knowhere:hud-meter", handleMeter);
      window.removeEventListener("knowhere:crosshair", handleCrosshair);
      window.removeEventListener(CHARACTER_BLOCK_FACE_TARGET_PRESENTATION_EVENT, handleBlockFaceTargetPresentation);
      window.removeEventListener("knowhere:block-face-target-clear", handleBlockFaceTargetClear);
      window.removeEventListener("knowhere:player-damage", handleDamage);
      window.removeEventListener("knowhere:player-heal", handleHeal);
      window.removeEventListener("knowhere:spirit-spend", handleSpiritSpend);
      window.removeEventListener("knowhere:spirit-restore", handleSpiritRestore);
      window.removeEventListener("knowhere:player-respawn", handleRespawn);
      window.removeEventListener("knowhere:player-map-position", handleMapPosition);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
      if (import.meta.env.DEV && event.key === "[") { event.preventDefault(); characterController.damage(12); return; }
      if (import.meta.env.DEV && event.key === "]") { event.preventDefault(); characterController.heal(10); return; }
      if (import.meta.env.DEV && event.key === ";") { event.preventDefault(); characterController.spendSpirit(8); return; }
      if (import.meta.env.DEV && event.key === "'") { event.preventDefault(); characterController.restoreSpirit(10); return; }
      if (import.meta.env.DEV && event.key === "\\") { event.preventDefault(); characterController.damage(controllerState.health.maximum); return; }
      if (import.meta.env.DEV && event.key === "=") { event.preventDefault(); characterController.respawn(); return; }
      if (import.meta.env.DEV && event.key === ",") { event.preventDefault(); rejectDrop("food", actionSlots[selectedAction]?.name ?? "Selected item", "development rejection test"); return; }
      if (event.key >= "1" && event.key <= "9") {
        event.preventDefault();
        activateAction(Number(event.key) - 1);
      }
      if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        chatInputRef.current?.focus();
        return;
      }
      if (event.key.toLowerCase() === "b" && backpack) {
        event.preventDefault();
        setOpenPanel(null);
        setOpenBagId((current) => current === backpack.id ? null : backpack.id);
        return;
      }
      if (event.key.toLowerCase() === "c") { event.preventDefault(); setPanel("equipment"); return; }
      if (event.key.toLowerCase() === "u") { event.preventDefault(); setPanel("tome"); return; }
      if (event.key.toLowerCase() === "p") { event.preventDefault(); setPanel("account"); return; }
      if (event.key.toLowerCase() === "m" && mapItem) { event.preventDefault(); setMapOpen(true); return; }
      if (event.key === "Escape") {
        setContextMenu(null);
        setMapOpen(false);
        setOpenPanel(null);
        setOpenBagId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [backpack, controllerState.health.maximum, controllerState.lifecycle, items, mapItem, selectedAction]);

  useEffect(() => {
    const handleTab = (event: KeyboardEvent) => {
      gameplayMouseMode.handleTabToggle(event, document.querySelector<HTMLCanvasElement>(".scene-canvas"), Boolean(openPanel || mapOpen || contextMenu));
    };
    window.addEventListener("keydown", handleTab);
    return () => window.removeEventListener("keydown", handleTab);
  }, [contextMenu, mapOpen, openPanel]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = (event: PointerEvent) => { if (!contextMenuRef.current?.contains(event.target as Node)) setContextMenu(null); };
    window.addEventListener("pointerdown", close, { capture: true });
    return () => window.removeEventListener("pointerdown", close, { capture: true });
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const menu = contextMenuRef.current;
    if (!menu) return;
    window.requestAnimationFrame(() => {
      const firstItem = menu.querySelector<HTMLElement>("[role='menuitem']");
      (firstItem ?? menu).focus();
    });
  }, [contextMenu]);

  const handleContextMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setContextMenu(null);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const menu = contextMenuRef.current;
    if (!menu) return;
    const items = Array.from(menu.querySelectorAll<HTMLElement>("[role='menuitem']"));
    if (items.length === 0) return;
    event.preventDefault();
    const currentIndex = Math.max(0, items.indexOf(document.activeElement as HTMLElement));
    const direction = event.key === "ArrowDown" ? 1 : -1;
    items[(currentIndex + direction + items.length) % items.length].focus();
  };

  useLayoutEffect(() => {
    const menu = contextMenuRef.current;
    if (!contextMenu || !menu) return;
    const viewportPadding = 8;
    const rect = menu.getBoundingClientRect();
    const x = Math.max(viewportPadding, Math.min(contextMenu.x, window.innerWidth - rect.width - viewportPadding));
    const y = Math.max(viewportPadding, Math.min(contextMenu.y, window.innerHeight - rect.height - viewportPadding));
    if (x !== contextMenu.x || y !== contextMenu.y) setContextMenu((current) => current ? { ...current, x, y } : current);
  }, [contextMenu]);

  const setPanel = (panel: OpenPanel | null) => { setMapOpen(false); setOpenBagId(null); setOpenPanel(panel); };

  const loginAs = (name: "User" | "Admin") => {
    setItems((current) => ({ ...current, kingdom: { ...current.kingdom, loc: { kind: "limbo" } }, acctUser: { ...current.acctUser, loc: name === "User" ? { kind: "hud", slot: "account" } : { kind: "limbo" } }, acctAdmin: { ...current.acctAdmin, loc: name === "Admin" ? { kind: "hud", slot: "account" } : { kind: "limbo" } } }));
    setLoggedIn(name);
    setPanel(null);
  };

  const signOut = () => {
    setPanel(null);
    onLogout();
  };

  const targetLocation = (slotKind: string): CanvasItemLocation | null => {
    if (slotKind === "character") return { kind: "hud", slot: "character" };
    if (["account", "map", "settings", "backpack", "tome", "spirit", "food", "drink"].includes(slotKind)) return { kind: "hud", slot: slotKind };
    if (slotKind.startsWith("action")) return { kind: "hud", slot: slotKind };
    if (equipmentSlotKinds.has(slotKind) && activeCharacter) return { kind: "equip", charId: activeCharacter.id, slot: slotKind };
    return null;
  };

  const canPlaceGridItem = (current: Record<string, CanvasItem>, item: CanvasItem, bagId: string, x: number, y: number) => {
    const bag = current[bagId];
    if (!bag?.grid || x < 0 || y < 0 || x + item.w > bag.grid.cols || y + item.h > bag.grid.rows) return false;
    const candidate = { x, y, w: item.w, h: item.h };
    return Object.values(current).filter((other) => other.id !== item.id && other.loc.kind === "grid" && other.loc.bagId === bagId).every((other) => other.loc.kind !== "grid" || !locationsOverlap(candidate, { x: other.loc.x, y: other.loc.y, w: other.w, h: other.h }));
  };

  const moveItem = async (itemId: string, destination: CanvasItemLocation) => {
    if (projection && onInventoryMove) {
      const confirmed=await onInventoryMove(itemId,destination,projection.projectionRevision);
      if(!confirmed){appendLog("system","Inventory changed elsewhere; authoritative state restored.","warning");setDraggedItemId(null);setDropTarget(null);return false;}
    }
    setItems((current) => {
      const item = current[itemId];
      if (!item) return current;
      if (destination.kind === "grid" && !canPlaceGridItem(current, item, destination.bagId, destination.x, destination.y)) return current;
      const occupant = Object.values(current).find((other) => other.id !== itemId && JSON.stringify(other.loc) === JSON.stringify(destination));
      const next = { ...current, [itemId]: { ...item, loc: destination } };
      if (occupant) next[occupant.id] = { ...occupant, loc: item.loc };
      return next;
    });
    setDraggedItemId(null);
    setDropTarget(null);
    return true;
  };

  const handleFixedDrop = async (event: DragEvent<HTMLButtonElement>, slotKind: string) => {
    event.preventDefault();
    const itemId = event.dataTransfer.getData("text/plain") || draggedItemId;
    const item = itemId ? items[itemId] : undefined;
    const destination = targetLocation(slotKind);
    if (!item) { rejectDrop(slotKind, "Item", "drag payload was unavailable"); return; }
    if (!destination) { rejectDrop(slotKind, item.name, "slot is not assignable"); return; }
    if (!isCompatible(item, slotKind)) { rejectDrop(slotKind, item.name, `requires a compatible ${slotDisplayName(slotKind).toLowerCase()} item`); return; }
    if(await moveItem(item.id, destination))appendLog(slotKind.startsWith("action") ? "spirit" : "player", `${item.name} assigned to ${slotDisplayName(slotKind)}`, "gain");
  };

  const handleGridDrop = async (event: DragEvent<HTMLDivElement>, x: number, y: number) => {
    event.preventDefault();
    const itemId = event.dataTransfer.getData("text/plain") || draggedItemId;
    const item = itemId ? items[itemId] : undefined;
    const bagId = event.currentTarget.parentElement?.dataset.bagId;
    if (!item || !bagId) { rejectDrop("grid", item?.name ?? "Item", "inventory target was unavailable"); return; }
    const bag = items[bagId];
    if (!bag?.grid) { rejectDrop("grid", item.name, "bag has no item grid"); return; }
    if (x < 0 || y < 0 || x + item.w > bag.grid.cols || y + item.h > bag.grid.rows) { rejectDrop("grid", item.name, "item footprint exceeds bag bounds"); return; }
    const candidate = { x, y, w: item.w, h: item.h };
    const overlap = Object.values(items).some((other) => other.id !== item.id && other.loc.kind === "grid" && other.loc.bagId === bagId && locationsOverlap(candidate, { x: other.loc.x, y: other.loc.y, w: other.w, h: other.h }));
    if (overlap) { rejectDrop("grid", item.name, "item footprint overlaps occupied cells"); return; }
    if(await moveItem(item.id, { kind: "grid", bagId, x, y }))appendLog("player", `${item.name} moved in ${bag.name}`, "gain");
  };

  const openItemContextMenu = (event: MouseEvent<HTMLButtonElement>, item: CanvasItem, slotKind: string) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ item, slotKind, x: event.clientX, y: event.clientY });
  };

  const compatibleItems = (slotKind: string) => allItems.filter((item) => item.loc.kind === "grid" && isCompatible(item, slotKind)).slice(0, 6);

  const openItem = (item?: CanvasItem) => {
    if (!item) return;
    if (item.type === "kingdom") setPanel("login");
    else if (item.type === "account" || item.type === "spirit") setPanel("account");
    else if (item.type === "character") setPanel("equipment");
    else if (item.type === "bag") { setPanel(null); setOpenBagId((current) => current === item.id ? null : item.id); }
    else if (item.type === "tome") setPanel("tome");
    else if (item.type === "map") { setOpenPanel(null); setOpenBagId(null); setMapOpen(true); }
    else if (item.type === "settings") window.location.assign("/dashboard");
    else if (item.type === "food") { characterController.heal(20); setItems((current) => ({ ...current, [item.id]: { ...current[item.id], quantity: Math.max(0, (current[item.id].quantity ?? 1) - 1) } })); }
    else if (item.type === "drink") { characterController.restoreSpirit(20); setItems((current) => ({ ...current, [item.id]: { ...current[item.id], quantity: Math.max(0, (current[item.id].quantity ?? 1) - 1) } })); }
  };

  const mapDropState: DropState = rejectedDropTarget === "map" ? "invalid" : draggedItemId && dropTarget === "map" ? (isCompatible(items[draggedItemId], "map") ? "valid" : "invalid") : undefined;
  const mapSlot = <AtlasItemSlot item={mapItem} label="Map" size="utility" hotkey="M" dropState={mapDropState} onClick={() => openItem(mapItem)} onContextMenu={(event) => mapItem && openItemContextMenu(event, mapItem, "map")} onDragStart={(item) => { setDraggedItemId(item.id); setDropTarget("map"); }} onDragEnd={() => { setDraggedItemId(null); setDropTarget(null); }} onDrop={(event) => handleFixedDrop(event, "map")} onDragOver={() => setDropTarget("map")} />;

  const abilitySlotForHud = (slotKind: string): AbilitySlot | null => {
    if (slotKind === "tome-ultimate") return "tome.ultimate";
    if (slotKind === "tome-action-1") return "tome.action1";
    if (slotKind === "tome-action-2") return "tome.action2";
    if (slotKind.startsWith("action")) {
      const index = Number(slotKind.slice("action".length)) + 1;
      if (index >= 1 && index <= 9) return `actionbar.${index}` as AbilitySlot;
    }
    return null;
  };

  const withAbilityCooldown = (item: CanvasItem, slot: AbilitySlot): CanvasItem => {
    const skill = characterController.getSkillForSlot(slot);
    if (!skill || skill.cooldownMs <= 0) return item;
    const remainingMs = Math.max(0, (controllerState.timers.cooldowns[skill.id] ?? 0) - abilityClock);
    return { ...item, stats: { ...item.stats, cooldown: skill.cooldownMs / 1000, cooldownRemaining: remainingMs / 1000 } };
  };

  const renderSlot = (slotKind: string, label: string, item: CanvasItem | undefined, size: "utility" | "action" | "small" = "utility", hotkey?: string, className = "") => {
    const dropState: DropState = rejectedDropTarget === slotKind ? "invalid" : draggedItemId && dropTarget === slotKind ? (isCompatible(items[draggedItemId], slotKind) ? "valid" : "invalid") : undefined;
    const abilitySlot = abilitySlotForHud(slotKind);
    const displayedItem = item && abilitySlot ? withAbilityCooldown(item, abilitySlot) : item;
    return <AtlasItemSlot key={slotKind} item={displayedItem} label={label} size={size} hotkey={hotkey} className={className} selected={slotKind.startsWith("action") && Number(slotKind.replace("action", "")) === selectedAction} dropState={dropState} onClick={() => { if (slotKind.startsWith("action")) activateAction(Number(slotKind.replace("action", ""))); else openItem(item); }} onContextMenu={(event) => item && openItemContextMenu(event, item, slotKind)} onDragStart={(dragItem) => { setDraggedItemId(dragItem.id); setDropTarget(slotKind); }} onDragEnd={() => { setDraggedItemId(null); setDropTarget(null); }} onDragOver={() => setDropTarget(slotKind)} onDrop={(event) => handleFixedDrop(event, slotKind)} />;
  };

  return (
    <div className={`hud-root atlas-hud${poweringDown ? " atlas-hud-powering-down" : ""}`} aria-busy={poweringDown} onContextMenu={(event) => { event.preventDefault(); setContextMenu(null); }}>
      <header className="atlas-topbar">
        <div className="atlas-utility-group"><div className="atlas-settings-slot">{renderSlot("settings", "Dashboard", hudItem("settings"), "utility", "Esc")}</div><div className="atlas-brand"><strong>Knowhere</strong><span>The Kingdom</span></div></div>
        <CompassBar player={mapPosition} markers={defaultMapMarkers} />
        <div className="atlas-map-group">{mapSlot}</div>
      </header>

      <aside className="atlas-side atlas-side-left">
        <div className="atlas-column-stack">
          {renderSlot("backpack", "Backpack", backpack, "utility", "B", "atlas-column-anchor atlas-column-anchor-top")}
          <div className="atlas-side-body"><MeterRail kind="health" current={controllerState.health.current} max={controllerState.health.maximum} /><div className="atlas-column-consumable">{renderSlot("food", "Food", hudItem("food"), "utility", "R")}</div></div>
          <div className="atlas-side-footer atlas-side-footer-left">
            {renderSlot("character", "Character", activeCharacter, "utility", "C", "atlas-column-anchor atlas-column-anchor-bottom")}
            <div className="atlas-mini-ability-group" role="group" aria-label="Movement abilities">
              {movementAbilities.map((ability, index) => <AtlasItemSlot key={ability.id} item={ability} label={ability.name} size="micro" hotkey={movementAbilityHotkeys[index]} />)}
            </div>
          </div>
        </div>
        <EventLog channel="player" align="left" logs={logs} />
      </aside>

      <aside className="atlas-side atlas-side-right">
        <EventLog channel="spirit" align="right" logs={logs} />
        <div className="atlas-column-stack">
          {renderSlot("spirit", "Spirit", hudItem("spirit"), "utility", "P", "atlas-column-anchor atlas-column-anchor-top")}
          <div className="atlas-side-body"><MeterRail kind="spirit" current={controllerState.resources.spirit.current} max={controllerState.resources.spirit.maximum} /><div className="atlas-column-consumable">{renderSlot("drink", "Drink", hudItem("drink"), "utility", "R")}</div></div>
          <div className="atlas-side-footer atlas-side-footer-right">
            <div className="atlas-mini-ability-group" role="group" aria-label="Tome abilities">
              {tomeAbilities.map((ability, index) => { const slot = abilitySlotForHud(ability.id); return <AtlasItemSlot key={ability.id} item={slot ? withAbilityCooldown(ability, slot) : ability} label={ability.name} size="micro" hotkey={tomeAbilityHotkeys[index]} onClick={() => { if (slot) characterController.activateSlot(slot); }} />; })}
            </div>
            {renderSlot("tome", "Tome", tome, "utility", "U", "atlas-column-anchor atlas-column-anchor-bottom")}
          </div>
        </div>
      </aside>

      <main className="atlas-center-stage"><Crosshair presentation={crosshairPresentation} /><EventLog channel="system" align="center" logs={logs} /></main>

      <form className="atlas-chat" onSubmit={(event) => { event.preventDefault(); const message = chatDraft.trim(); if (!message) return; appendLog("system", `Message sent: ${message}`, "info"); setChatDraft(""); chatInputRef.current?.blur(); }}>
        <label className="sr-only" htmlFor="atlas-chat-input">Chat message</label>
        <input ref={chatInputRef} id="atlas-chat-input" value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.currentTarget.blur(); } }} placeholder="Type a message…" maxLength={180} />
        <button type="submit" aria-label="Send message"><AtlasIcon name="chevron" size={0.9} /></button>
      </form>

      <nav className="atlas-actionbar" aria-label="Action bar">{actionSlots.map((item, index) => renderSlot(`action${index}`, `Action ${index + 1}`, item, "action", String(index + 1)))}</nav>

      {openBagId && items[openBagId] ? <StashPanel bag={items[openBagId]} items={gridItems(openBagId)} capacity={bagSlotCount} draggedItemId={draggedItemId} onDragStart={(item) => { setDraggedItemId(item.id); setDropTarget(`grid:${openBagId}`); }} onDragEnd={() => { setDraggedItemId(null); setDropTarget(null); }} onDropGrid={(event, x, y) => handleGridDrop(event, x, y)} onClick={openItem} onContextMenu={openItemContextMenu} onClose={() => setOpenBagId(null)} /> : null}

      {openPanel === "login" ? <LoginPanel onLogin={loginAs} onClose={() => setPanel(null)} /> : null}
      {openPanel === "account" ? <AccountPanel loggedIn={loggedIn} onSignOut={signOut} onClose={() => setPanel(null)} /> : null}
      {openPanel === "equipment" ? <EquipmentPanel activeCharacter={activeCharacter} equipItem={equipItem} movementActions={movementActions} onDrop={handleFixedDrop} draggedItemId={draggedItemId} onDragStart={(item) => setDraggedItemId(item.id)} onDragEnd={() => setDraggedItemId(null)} onContextMenu={openItemContextMenu} onClose={() => setPanel(null)} /> : null}
      {openPanel === "tome" ? <TomePanel onClose={() => setPanel(null)} /> : null}
      {openPanel === "settings" ? <SettingsPanel bindings={bindings} onBindingsChange={setBindings} onClose={() => setPanel(null)} /> : null}
      {mapOpen && mapItem ? <PlayerMapPanel item={mapItem} player={mapPosition} markers={defaultMapMarkers} onClose={() => setMapOpen(false)} /> : null}

      {contextMenu ? <div ref={contextMenuRef} className="atlas-context-menu" style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }} role="menu" aria-label={`${contextMenu.item.name} actions`} tabIndex={-1} onKeyDown={handleContextMenuKeyDown}><strong>{contextMenu.item.name}</strong><span>{contextMenu.item.leftClickAction ?? "Inspect item"}</span><div className="atlas-context-divider" />{compatibleItems(contextMenu.slotKind).map((item) => <button key={item.id} type="button" role="menuitem" onClick={() => { const destination = targetLocation(contextMenu.slotKind); if (destination) moveItem(item.id, destination); setContextMenu(null); }}><AtlasIcon name={item.icon} size={0.9} /><span>{item.name}</span></button>)}{compatibleItems(contextMenu.slotKind).length === 0 ? <small>No compatible items</small> : null}</div> : null}
    </div>
  );
}
