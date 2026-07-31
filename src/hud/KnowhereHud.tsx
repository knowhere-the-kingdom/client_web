import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import demoSkills from "../data/demo-skills.json";
import { initialCanvasItems, initialLogs, loadControlBindings, saveControlBindings } from "./demoData";
import { CHARACTER_BLOCK_FACE_TARGET_PRESENTATION_EVENT, createActionbarItemAbilityContracts, createDemoSkillContracts, createItemAbilityContracts, findPublishedItemDefinition, characterController, gameplayMouseMode, useCharacterControllerState } from "../features/character-controller";
import type { AbilitySlot, CharacterBlockFaceTargetPresentationEventDetail, CharacterBlockFaceTargetPromptKind, CharacterRenderEvent, PublishedItemDefinition, SkillRuntimeContract } from "../features/character-controller";
import { AtlasCooldown, AtlasIcon, AtlasItemIcon, AtlasItemSlot, AtlasPanel, AtlasProgress } from "./AtlasPrimitives";
import { PlayerMapPanel } from "./PlayerMapPanel";
import { SettingsPanel } from "./SettingsPanel";
import type { CanvasItem, CanvasItemLocation, DemoSkill, HudLogEntry, HudMapMarker, HudMapPosition, SettingsBinding } from "./types";
import type { WorldHudProjectionV2 } from "../api/gateway-contract";
import { AWARENESS_ITEM } from "../inventory/inventory-model";
import { CROSSHAIR_SETTINGS_EVENT, defaultCrosshairSettings, readCrosshairSettings, type CrosshairSettings, type CrosshairSettingsEventDetail } from "./crosshairSettings";
import { EMPTY_CURSOR_INVENTORY, clearCursorInventory, holdCursorItem, moveCursor, planCursorPlacement } from "../inventory/cursor-inventory";

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

const prototypeEquipmentSlots = [
  { id: "head", label: "Head", cols: 2, rows: 2, column: 2, row: 1, acceptedKinds: ["head"] },
  { id: "left", label: "Left", cols: 2, rows: 3, column: 1, row: 2, acceptedKinds: ["glove-left", "weapon", "tool"] },
  { id: "outfit", label: "Outfit", cols: 2, rows: 3, column: 2, row: 2, acceptedKinds: ["outfit"] },
  { id: "right", label: "Right", cols: 2, rows: 3, column: 3, row: 2, acceptedKinds: ["glove-right", "weapon", "tool"] },
  { id: "belt", label: "Belt", cols: 2, rows: 1, column: 2, row: 3, acceptedKinds: ["belt"] },
  { id: "footwear", label: "Footwear", cols: 2, rows: 2, column: 2, row: 4, acceptedKinds: ["feet"] },
] as const;
const equipmentSlotKinds: ReadonlySet<string> = new Set(prototypeEquipmentSlots.map((slot) => slot.id));

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
  abilityItem("tome-action-3", "Action 3", "target", "Tome ability"),
  abilityItem("tome-passive-1", "Passive 1", "gem", "Tome passive"),
  abilityItem("tome-passive-2", "Passive 2", "tome", "Tome passive"),
  abilityItem("tome-passive-3", "Passive 3", "orb", "Tome passive"),
];
const movementAbilityHotkeys = ["Shift", "DTAP", "Space", "Ctrl", "Alt"];
const tomeAbilityHotkeys = ["Q", "E", "F", "", "", "", ""];
const equipmentSlotLabels: ReadonlyMap<string, string> = new Map(prototypeEquipmentSlots.map((slot) => [slot.id, slot.label]));
const demoRuntimeSkills = createDemoSkillContracts(demoSkills.skills as DemoSkill[]);
const defaultMapPosition: HudMapPosition = { x: 0, z: 0, heading: 0 };
const defaultMapMarkers: HudMapMarker[] = [
  { id: "garden-keep", kind: "keep", label: "Hollow King Keep", x: 1720, z: 940, discovered: true },
  { id: "garden-gate", kind: "gate", label: "North Gate", x: -2320, z: -1480, discovered: true },
  { id: "boss-threat", kind: "objective", label: "Boss threat: Hollow King stirring", x: 4100, z: 2620, discovered: true },
  { id: "survey-party", kind: "party", label: "Garden survey party", x: -900, z: 1840, discovered: true },
];
const compassHudItem: CanvasItem = { id: "hud-compass", type: "map", name: "Wayfinder Compass", w: 2, h: 2, icon: "target", note: "Toggle compass", loc: { kind: "limbo" } };
const awarenessHudItem: CanvasItem = { id: "hud-awareness", type: "key", name: AWARENESS_ITEM.name, w: AWARENESS_ITEM.gridSize.width, h: AWARENESS_ITEM.gridSize.height, icon: "key", artPath: AWARENESS_ITEM.iconPath, note: AWARENESS_ITEM.description, loc: { kind: "limbo" } };
const actionSlotName = (loadout: number, index: number) => loadout === 0 ? `action${index}` : `action-loadout-${loadout + 1}-${index}`;

export function DesignerAwarenessSlot({ disabled, onActivate, onLogout }: { disabled: boolean; onActivate?: () => void; onLogout: () => void }) {
  const returnedToDesigner = useRef(false);
  const draggingAwareness = useRef(false);

  useEffect(() => {
    const allowAwarenessDrop = (event: globalThis.DragEvent) => {
      if (!draggingAwareness.current) return;
      event.preventDefault();
      event.dataTransfer!.dropEffect = "move";
    };
    const finishAwarenessDrop = (event: globalThis.DragEvent) => {
      if (!draggingAwareness.current) return;
      event.preventDefault();
      const returned = returnedToDesigner.current;
      draggingAwareness.current = false;
      returnedToDesigner.current = false;
      if (!returned && !disabled) onLogout();
    };
    window.addEventListener("dragover", allowAwarenessDrop);
    window.addEventListener("drop", finishAwarenessDrop);
    return () => {
      window.removeEventListener("dragover", allowAwarenessDrop);
      window.removeEventListener("drop", finishAwarenessDrop);
    };
  }, [disabled, onLogout]);

  return (
    <div className="prototype-designer-access" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); returnedToDesigner.current = true; }}>
      <AtlasItemSlot
        item={awarenessHudItem}
        label="Designer"
        size="utility"
        className="prototype-designer-access__slot"
        onClick={onActivate}
        onDragStart={() => { returnedToDesigner.current = false; draggingAwareness.current = true; }}
        onDragEnd={() => {
          const droppedOutsideViewport = draggingAwareness.current;
          draggingAwareness.current = false;
          returnedToDesigner.current = false;
          if (droppedOutsideViewport && !disabled) onLogout();
        }}
      />
      <span>Designer</span>
    </div>
  );
}

function CompassBar({ player, markers, onCollapse }: { player: HudMapPosition; markers: HudMapMarker[]; onCollapse: () => void }) {
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

  const tape = Array.from({ length: 25 }, (_, index) => {
    const bearing = (index - 8) * 45;
    return { bearing, direction: directions[((index - 8) % directions.length + directions.length) % directions.length] };
  });
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
    <button type="button" className="atlas-compass" aria-label={`Compass heading ${Math.round(heading)} degrees. Collapse compass to its item slot.`} onClick={onCollapse}>
      <div className="atlas-compass-tape" aria-hidden="true">{tape.map(({ bearing, direction }) => (
        <span key={bearing} className={direction.length === 1 ? "is-cardinal" : ""} style={{ left: `${50 + ((bearing - heading) / 315) * 100}%` }}>{direction}</span>
      ))}</div>
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
    </button>
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
        {[5, 4, 3, 2, 1, 0].map((segment) => {
          const segmentPercent = 100 / 6;
          const fill = Math.max(0, Math.min(1, (percent - segment * segmentPercent) / segmentPercent));
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

function Crosshair({ presentation, settings }: { presentation: CrosshairPresentation; settings: CrosshairSettings }) {
  const style = ({
    ...(presentation.rarityThemeToken ? { "--atlas-target-rarity": `var(${presentation.rarityThemeToken})` } : {}),
    "--atlas-crosshair-size": `${settings.size}px`,
    "--atlas-crosshair-line-width": `${settings.lineWidth}px`,
    "--atlas-crosshair-gap": `${settings.gap}px`,
    "--atlas-crosshair-color": settings.color,
    "--atlas-crosshair-opacity": settings.opacity / 100,
    "--atlas-crosshair-outline-color": settings.outlineColor,
    "--atlas-crosshair-outline-width": `${settings.outline ? settings.outlineWidth : 0}px`,
    "--atlas-crosshair-outline-opacity": settings.outlineOpacity / 100,
    "--atlas-crosshair-dot-size": `${settings.centerDotSize}px`,
    "--atlas-crosshair-dot-color": settings.centerDotColor,
  } as CSSProperties);
  const state = presentation.state;
  const prompt = presentation.prompt;
  const promptKind = presentation.promptKind;
  const statusText = prompt ? `${prompt}${presentation.validity ? `. ${presentation.validity}` : ""}` : "No block target";
  return (
    <div
      className={`atlas-crosshair reticle-preset-${settings.preset} atlas-crosshair-${state} atlas-crosshair-source-${targetClassPart(presentation.source, "crosshair")} atlas-crosshair-stability-${targetClassPart(presentation.stability, "unknown")} atlas-crosshair-validity-${targetClassPart(presentation.validity, "unknown")} atlas-crosshair-direction-${targetClassPart(presentation.targetDirection, "selected")}${settings.enabled ? "" : " is-reticle-disabled"}${settings.outline ? " has-reticle-outline" : ""}`}
      style={style}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={statusText}
      data-target-revision={presentation.revision}
    >
      <span className="atlas-crosshair-reticle" aria-hidden="true"><i className="reticle-part-top" /><i className="reticle-part-right" /><i className="reticle-part-bottom" /><i className="reticle-part-left" />{settings.centerDot ? <b /> : null}<em /><s /></span>
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

function BagGrid({ bag, items, draggedItemId, onDragStart, onDragEnd, onDropGrid, onPlaceGrid, onClick, onContextMenu }: { bag: CanvasItem; items: CanvasItem[]; draggedItemId: string | null; onDragStart: (item: CanvasItem) => void; onDragEnd: () => void; onDropGrid: (event: DragEvent<HTMLElement>, x: number, y: number) => void; onPlaceGrid: (x: number, y: number) => void; onClick: (item: CanvasItem) => void; onContextMenu: (event: MouseEvent<HTMLButtonElement>, item: CanvasItem, slotKind: string) => void }) {
  const cols = bag.grid?.cols ?? 6;
  const rows = bag.grid?.rows ?? 4;
  return (
    <div className="atlas-bag-grid prototype-inventory-grid" data-bag-id={bag.id} style={{ "--bag-columns": cols, "--bag-rows": rows } as CSSProperties}>
      {Array.from({ length: cols * rows }).map((_, index) => {
        const x = index % cols;
        const y = Math.floor(index / cols);
        return <button type="button" aria-label={`Grid position ${x + 1}, ${y + 1}`} key={`${x}:${y}`} className="atlas-bag-cell" data-x={x} data-y={y} onClick={() => onPlaceGrid(x, y)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDropGrid(event, x, y)} />;
      })}
      {items.map((item) => {
        if (item.loc.kind !== "grid") return null;
        return (
          <button
            key={item.id}
            type="button"
            className={`atlas-grid-item ${draggedItemId === item.id ? "is-dragging" : ""}`}
            style={{ "--item-x": item.loc.x, "--item-y": item.loc.y, "--item-columns": item.w, "--item-rows": item.h } as CSSProperties}
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

function StashPanel({ bag, items, capacity, draggedItemId, onDragStart, onDragEnd, onDropGrid, onPlaceGrid, onClick, onContextMenu, onClose }: { bag: CanvasItem; items: CanvasItem[]; capacity: number; draggedItemId: string | null; onDragStart: (item: CanvasItem) => void; onDragEnd: () => void; onDropGrid: (event: DragEvent<HTMLElement>, x: number, y: number) => void; onPlaceGrid: (x: number, y: number) => void; onClick: (item: CanvasItem) => void; onContextMenu: (event: MouseEvent<HTMLButtonElement>, item: CanvasItem, slotKind: string) => void; onClose: () => void }) {
  const spiritBox = bag.id === "spiritBox1";
  const canonicalStash = bag.id === "stashVault";
  const inventoryKind = canonicalStash ? "stash" : bag.id === "lunchbox1" ? "lunchbox" : "backpack";
  const columns = bag.grid?.cols ?? 6;
  const rows = bag.grid?.rows ?? 4;
  const title = canonicalStash ? "Stash" : bag.name;
  const [windowOffset, setWindowOffset] = useState({ x: 0, y: 0 });
  const startWindowDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    const start = { x: event.clientX, y: event.clientY, offsetX: windowOffset.x, offsetY: windowOffset.y };
    const move = (next: globalThis.PointerEvent) => setWindowOffset({ x: start.offsetX + next.clientX - start.x, y: start.offsetY + next.clientY - start.y });
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
    window.addEventListener("pointercancel", finish, { once: true });
  };
  return (
    <section className={`atlas-panel atlas-inventory-panel atlas-stash-panel prototype-floating-panel${spiritBox ? " prototype-spirit-panel" : ` prototype-inventory-window prototype-inventory-window--${inventoryKind}`}`} style={{ "--inventory-window-x": `${windowOffset.x}px`, "--inventory-window-y": `${windowOffset.y}px` } as CSSProperties} role="dialog" aria-modal="false" aria-label={spiritBox ? "Spirit of Life" : title}>
        <header className="atlas-panel-header atlas-stash-header" onPointerDown={startWindowDrag}>
          <div>{spiritBox ? <span className="atlas-eyebrow">Characters</span> : null}<h2>{spiritBox ? "Spirit of Life" : title}{spiritBox ? null : <small>{columns}×{rows}</small>}</h2>{spiritBox ? <small>Choose the character bound to this Spirit.</small> : null}</div>
          <button type="button" className="atlas-close" onClick={onClose} aria-label="Close stash"><AtlasIcon name="x" size={1.1} /></button>
        </header>
        {!spiritBox && canonicalStash ? <nav className="atlas-stash-tabs prototype-inventory-tabs" aria-label="Stash locations">
          <button type="button" className="is-active" aria-current="page">Personal</button>
          <button type="button" disabled>Shared I</button>
          <button type="button" disabled>Shared II</button>
          <button type="button" disabled>Shared III</button>
        </nav> : null}
        {spiritBox ? <div className="atlas-inventory-toolbar">
          <div><strong>{`${items.length} characters available`}</strong><span>Select a character to inspect their field loadout.</span></div>
          <span>Spirit linked</span>
        </div> : null}
        <div className="atlas-bag-grid-wrap atlas-stash-grid-wrap">
          <BagGrid bag={{ ...bag, grid: bag.grid ?? { cols: 6, rows: 4 } }} items={items} draggedItemId={draggedItemId} onDragStart={onDragStart} onDragEnd={onDragEnd} onDropGrid={onDropGrid} onPlaceGrid={onPlaceGrid} onClick={onClick} onContextMenu={onContextMenu} />
        </div>
        {spiritBox ? <footer className="atlas-stash-footer"><span><AtlasIcon name="spirit" size={0.8} /> Spirit of Life</span><small>Esc closes</small></footer> : null}
    </section>
  );
}

function EquipmentPanel({ activeCharacter, equipItem, onDrop, draggedItemId, onDragStart, onDragEnd, onContextMenu, onClose }: { activeCharacter?: CanvasItem; equipItem: (slot: string) => CanvasItem | undefined; onDrop: (event: DragEvent<HTMLButtonElement>, slot: string) => void; draggedItemId: string | null; onDragStart: (item: CanvasItem) => void; onDragEnd: () => void; onContextMenu: (event: MouseEvent<HTMLButtonElement>, item: CanvasItem, slot: string) => void; onClose: () => void }) {
  return (
    <AtlasOverlay className="atlas-overlay-no-blur" onClose={onClose}>
      <section className="atlas-panel atlas-equipment-panel atlas-equipment-panel-prototype" role="dialog" aria-modal="true" aria-label={`${activeCharacter?.name ?? "No character"} equipment`}>
        <h2 className="sr-only">{activeCharacter?.name ?? "No character"} equipment</h2>
        <button type="button" className="atlas-close atlas-equipment-prototype-close" onClick={onClose} aria-label="Close equipment"><AtlasIcon name="x" size={1} /></button>
        <div className="atlas-equipment-prototype-grid" aria-label="Equipment slots">
          {prototypeEquipmentSlots.map((slot) => {
            const item = equipItem(slot.id);
            return <AtlasItemSlot key={slot.id} item={item} label={slot.label} size="grid" className={`atlas-equipment-slot atlas-equipment-prototype-slot atlas-equipment-prototype-slot--${slot.id}`} style={{ gridColumn: `${slot.column} / span 1`, gridRow: `${slot.row} / span 1`, "--equipment-slot-cols": slot.cols, "--equipment-slot-rows": slot.rows } as CSSProperties} dropState={draggedItemId ? "valid" : undefined} onDrop={(event) => onDrop(event, slot.id)} onDragStart={onDragStart} onDragEnd={onDragEnd} onContextMenu={(event) => item && onContextMenu(event, item, slot.id)} />;
          })}
        </div>
      </section>
    </AtlasOverlay>
  );
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
  return prototypeEquipmentSlots.find((slot) => slot.id === slotKind)?.acceptedKinds ?? [];
}

function equipmentKindForItem(item: CanvasItem): string | null {
  if (item.type === "glove") return "glove-left";
  if (item.type === "ring") return "ring";
  if (item.type === "glasses") return "face";
  if (item.type === "feet") return "feet";
  if (["head", "outfit", "belt", "neck", "weapon", "tool"].includes(item.type)) return item.type;
  return null;
}

function locationsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

export type KnowhereHudProps = Readonly<{ accountLabel: string; settingsOwnerId: string; projection?: WorldHudProjectionV2 | null; poweringDown?: boolean; onInventoryMove?: (itemInstanceId:string,destination:CanvasItemLocation,expectedRevision:number)=>Promise<WorldHudProjectionV2|null>; onOpenDashboard: () => void; onLogout: () => void }>;

export function KnowhereHud({ accountLabel, settingsOwnerId, projection = null, poweringDown = false, onInventoryMove, onOpenDashboard, onLogout }: KnowhereHudProps) {
  const [items, setItems] = useState<Record<string, CanvasItem>>(() => ({
    ...initialCanvasItems,
    kingdom: { ...initialCanvasItems.kingdom, loc: { kind: "limbo" } },
    acctUser: { ...initialCanvasItems.acctUser, name: accountLabel, loc: { kind: "hud", slot: "account" } },
  }));
  const [logs, setLogs] = useState<HudLogEntry[]>(initialLogs);
  const [bindings, setBindings] = useState<SettingsBinding[]>(loadControlBindings);
  const controllerState = useCharacterControllerState();
  const previousMeters = useRef({ health: controllerState.health.current, spirit: controllerState.resources.spirit.current });
  const previousLifecycle = useRef(controllerState.lifecycle);
  const logSequence = useRef(initialLogs.length);
  const [openPanel, setOpenPanel] = useState<OpenPanel | null>(null);
  const [openBagIds, setOpenBagIds] = useState<string[]>([]);
  const [spiritOpen, setSpiritOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [compassOpen, setCompassOpen] = useState(true);
  const [loggedIn, setLoggedIn] = useState<"User" | "Admin" | null>("User");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [cursorInventory, setCursorInventory] = useState(EMPTY_CURSOR_INVENTORY);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [rejectedDropTarget, setRejectedDropTarget] = useState<string | null>(null);
  const [activeLoadout, setActiveLoadout] = useState(0);
  const [leftSelections, setLeftSelections] = useState([0, 0, 0]);
  const [rightSelections, setRightSelections] = useState([0, 0, 0]);
  const rightMouseHeld = useRef(false);
  const [abilityClock, setAbilityClock] = useState(() => performance.now());
  const [publishedSkills] = useState<SkillRuntimeContract[]>([]);
  const [publishedItems] = useState<PublishedItemDefinition[]>([]);
  const [contextMenu, setContextMenu] = useState<ItemContext | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const [crosshairPresentation, setCrosshairPresentation] = useState<CrosshairPresentation>(defaultCrosshairPresentation);
  const [crosshairSettings, setCrosshairSettings] = useState<CrosshairSettings>(() => typeof window === "undefined" ? defaultCrosshairSettings : readCrosshairSettings(window.localStorage, settingsOwnerId));
  const [mapPosition, setMapPosition] = useState<HudMapPosition>(defaultMapPosition);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const chatInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const trackCursor = (event: PointerEvent) => setCursorInventory((current) => moveCursor(current, event.clientX, event.clientY));
    const cancelCursor = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setCursorInventory((current) => clearCursorInventory(current));
      setDraggedItemId(null);
      setDropTarget(null);
    };
    window.addEventListener("pointermove", trackCursor, { passive: true });
    window.addEventListener("keydown", cancelCursor);
    return () => {
      window.removeEventListener("pointermove", trackCursor);
      window.removeEventListener("keydown", cancelCursor);
    };
  }, []);

  useEffect(() => {
    setCrosshairSettings(readCrosshairSettings(window.localStorage, settingsOwnerId));
    const handleCrosshairSettings = (event: Event) => {
      const detail = (event as CustomEvent<CrosshairSettingsEventDetail>).detail;
      if (detail?.ownerId === settingsOwnerId) setCrosshairSettings(detail.settings);
    };
    window.addEventListener(CROSSHAIR_SETTINGS_EVENT, handleCrosshairSettings);
    return () => window.removeEventListener(CROSSHAIR_SETTINGS_EVENT, handleCrosshairSettings);
  }, [settingsOwnerId]);

  const allItems = useMemo(() => Object.values(items), [items]);
  const visibleItems = useMemo(() => allItems.filter((item) => item.id !== cursorInventory.heldItemId), [allItems, cursorInventory.heldItemId]);
  const hudItem = (slot: string) => visibleItems.find((item) => item.loc.kind === "hud" && item.loc.slot === slot);
  const gridItems = (bagId: string) => visibleItems.filter((item) => item.loc.kind === "grid" && item.loc.bagId === bagId);
  const activeCharacter = hudItem("character");
  const mapItem = hudItem("map");
  const equipItem = (slot: string) => visibleItems.find((item) => item.loc.kind === "equip" && item.loc.charId === activeCharacter?.id && item.loc.slot === slot);
  const actionPairCapacity = Math.max(1, Math.min(10, 5 + (equipItem("belt")?.stats?.actionSlotPairs ?? 0) + (equipItem("outfit")?.stats?.actionSlotPairs ?? 0)));
  const oddActionIndices = useMemo(() => Array.from({ length: actionPairCapacity }, (_, index) => index * 2), [actionPairCapacity]);
  const evenActionIndices = useMemo(() => Array.from({ length: actionPairCapacity }, (_, index) => index * 2 + 1), [actionPairCapacity]);
  const actionSlots = useMemo(() => Array.from({ length: actionPairCapacity * 2 }, (_, index) => hudItem(actionSlotName(activeLoadout, index))), [actionPairCapacity, activeLoadout, allItems]);
  const selectedLeftIndex = oddActionIndices[(leftSelections[activeLoadout] ?? 0) % actionPairCapacity];
  const selectedRightIndex = evenActionIndices[(rightSelections[activeLoadout] ?? 0) % actionPairCapacity];
  const selectedLeftItem = actionSlots[selectedLeftIndex];
  const selectedRightItem = actionSlots[selectedRightIndex];
  const selectedLeftDefinition = useMemo(() => findPublishedItemDefinition(selectedLeftItem, publishedItems), [selectedLeftItem?.id, selectedLeftItem?.name, publishedItems]);
  const selectedRightDefinition = useMemo(() => findPublishedItemDefinition(selectedRightItem, publishedItems), [selectedRightItem?.id, selectedRightItem?.name, publishedItems]);
  const itemAbilityContracts = useMemo(() => [
    ...createItemAbilityContracts(selectedLeftItem, selectedLeftDefinition).filter((contract) => contract.slot === "item.leftHand"),
    ...createItemAbilityContracts(selectedRightItem, selectedRightDefinition).filter((contract) => contract.slot === "item.rightHand"),
  ], [selectedLeftDefinition, selectedLeftItem, selectedRightDefinition, selectedRightItem]);
  const actionbarItemAbilityContracts = useMemo(
    () => createActionbarItemAbilityContracts(actionSlots, publishedItems),
    [actionSlots, publishedItems],
  );
  const backpack = hudItem("backpack");
  const lunchbox = hudItem("lunchbox");
  const tome = hudItem("tome");
  const bagSlotCount = useMemo(() => Math.min(20, 4 + (equipItem("belt")?.stats?.bagSlots ?? 0) + (equipItem("outfit")?.stats?.bagSlots ?? 0)), [allItems, activeCharacter?.id]);

  const appendLog = (channel: HudLogEntry["channel"], text: string, severity: HudLogEntry["severity"]) => {
    logSequence.current += 1;
    const entry: HudLogEntry = { id: `runtime-${logSequence.current}`, channel, text, severity, createdAt: Date.now() };
    setLogs((current) => [...current, entry].slice(-24));
  };

  const activateAction = (index: number) => {
    const item = actionSlots[index];
    const indices = index % 2 === 0 ? oddActionIndices : evenActionIndices;
    const position = indices.indexOf(index);
    const update = index % 2 === 0 ? setLeftSelections : setRightSelections;
    update((current) => current.map((value, loadout) => loadout === activeLoadout ? Math.max(0, position) : value));
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

  const activateHandAction = (side: "left" | "right") => {
    const slot: AbilitySlot = side === "left" ? "item.leftHand" : "item.rightHand";
    const label = side === "left" ? "Left Action" : "Right Action";
    const item = side === "left" ? selectedLeftItem : selectedRightItem;
    if (!item) {
      appendLog("spirit", `${label} is empty`, "warning");
      return;
    }
    if (!characterController.activateSlot(slot)) {
      appendLog("spirit", `${item.name} ${label.toLowerCase()} blocked`, "warning");
    }
  };

  const slotDisplayName = (slotKind: string) => slotKind.startsWith("action") ? `Action ${Number(/(\d+)$/.exec(slotKind)?.[1] ?? -1) + 1}` : equipmentSlotLabels.get(slotKind) ?? slotKind.replace(/^./, (value) => value.toUpperCase());

  const rejectDrop = (slotKind: string, itemName: string, reason: string) => {
    setRejectedDropTarget(slotKind);
    appendLog("player", `${itemName} cannot use ${slotDisplayName(slotKind)} — ${reason}`, "warning");
    window.setTimeout(() => setRejectedDropTarget((current) => current === slotKind ? null : current), 720);
    setDraggedItemId(null);
    setDropTarget(null);
  };

  useEffect(() => {
    characterController.configureBindings(bindings);
    saveControlBindings(bindings);
  }, [bindings]);

  useEffect(() => {
    const handleBindingsChanged = (event: Event) => {
      const next = (event as CustomEvent<SettingsBinding[]>).detail;
      if (!Array.isArray(next)) return;
      setBindings((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next.map((binding) => ({ ...binding })));
    };
    window.addEventListener("knowhere:control-bindings-changed", handleBindingsChanged);
    return () => window.removeEventListener("knowhere:control-bindings-changed", handleBindingsChanged);
  }, []);

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

  const bindingUsesKey = (id: string, key: string) => {
    const binding = bindings.find((candidate) => candidate.id === id);
    const normalized = key.length === 1 ? key.toUpperCase() : key;
    return [binding?.primary, binding?.secondary].some((value) => value === normalized);
  };
  const bindingLabel = (id: string) => {
    const binding = bindings.find((candidate) => candidate.id === id);
    return binding?.primary && binding.primary !== "Unbound" ? binding.primary : binding?.secondary && binding.secondary !== "Unbound" ? binding.secondary : undefined;
  };
  const toggleBagWindow = (bagId: string) => setOpenBagIds((current) => current.includes(bagId) ? current.filter((id) => id !== bagId) : [...current, bagId]);

  useEffect(() => characterController.subscribeActionSignals((signal) => {
    if (signal.phase !== "pressed") return;
    if (signal.actionId === "backpack" && backpack) {
      toggleBagWindow(backpack.id);
    } else if (signal.actionId === "stash") {
      toggleBagWindow("stashVault");
    } else if (signal.actionId === "lunchbox" && lunchbox) {
      toggleBagWindow(lunchbox.id);
    } else if (signal.actionId === "character" && activeCharacter) {
      setMapOpen(false);
      setOpenPanel((current) => {
        const next = current === "equipment" ? null : "equipment";
        if (next === "equipment") {
          gameplayMouseMode.cancelFreeDrag();
          if (document.pointerLockElement) document.exitPointerLock();
        }
        return next;
      });
    }
  }), [activeCharacter?.id, backpack?.id, lunchbox?.id]);

  const rotateActionSelection = (side: "left" | "right", direction: -1 | 1) => {
    const update = side === "left" ? setLeftSelections : setRightSelections;
    update((current) => current.map((position, loadout) => loadout === activeLoadout ? (position + direction + actionPairCapacity) % actionPairCapacity : position));
  };

  useEffect(() => {
    const modifier = bindings.find((binding) => binding.id === "right-action-scroll-modifier");
    const mouseOrdinal = Number(/Mouse (\d+)/.exec(modifier?.primary ?? "")?.[1] ?? 2);
    const modifierButton = mouseOrdinal === 1 ? 0 : mouseOrdinal === 2 ? 2 : mouseOrdinal === 3 ? 1 : mouseOrdinal - 1;
    const handleMouseDown = (event: globalThis.MouseEvent) => { if (event.button === modifierButton) rightMouseHeld.current = true; };
    const handleMouseUp = (event: globalThis.MouseEvent) => { if (event.button === modifierButton) rightMouseHeld.current = false; };
    const handleBlur = () => { rightMouseHeld.current = false; characterController.cancelPendingPointerAction(); };
    const handleWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[role='dialog'],[role='menu'],.player-map-panel,.settings-panel")) return;
      const directionBinding = event.deltaY < 0 ? "previous-action-slot" : "next-action-slot";
      const expected = event.deltaY < 0 ? "Scroll Up" : "Scroll Down";
      const binding = bindings.find((candidate) => candidate.id === directionBinding);
      if (![binding?.primary, binding?.secondary].includes(expected)) return;
      event.preventDefault();
      characterController.cancelPendingPointerAction();
      rotateActionSelection(rightMouseHeld.current ? "right" : "left", event.deltaY < 0 ? -1 : 1);
    };
    window.addEventListener("mousedown", handleMouseDown, { capture: true });
    window.addEventListener("mouseup", handleMouseUp, { capture: true });
    window.addEventListener("blur", handleBlur);
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("mousedown", handleMouseDown, { capture: true });
      window.removeEventListener("mouseup", handleMouseUp, { capture: true });
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("wheel", handleWheel);
      rightMouseHeld.current = false;
    };
  }, [actionPairCapacity, activeLoadout, bindings]);

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
      if (import.meta.env.DEV && event.key === ",") { event.preventDefault(); rejectDrop("food", selectedLeftItem?.name ?? "Selected item", "development rejection test"); return; }
      const directAction = bindings.find((binding) => /^actionbar-(?:[1-9]|10)$/.test(binding.id) && [binding.primary, binding.secondary].some((value) => value.toLowerCase() === event.key.toLowerCase()));
      if (directAction) {
        event.preventDefault();
        activateAction(Number(directAction.id.replace("actionbar-", "")) - 1);
        return;
      }
      if (bindingUsesKey("swap", event.key)) {
        event.preventDefault();
        setActiveLoadout((current) => (current + 1) % 3);
        return;
      }
      if (bindingUsesKey("previous-action-slot", event.key)) { event.preventDefault(); rotateActionSelection("left", -1); return; }
      if (bindingUsesKey("next-action-slot", event.key)) { event.preventDefault(); rotateActionSelection("left", 1); return; }
      const chatBinding = bindings.find((binding) => binding.id === "open-chat");
      const chatKeys = [chatBinding?.primary, chatBinding?.secondary]
        .filter((value): value is string => Boolean(value) && value !== "Unbound")
        .map((value) => value.toLowerCase());
      if (chatKeys.includes(event.key.toLowerCase())) {
        event.preventDefault();
        setChatOpen((current) => {
          const next = !current;
          if (next) window.requestAnimationFrame(() => chatInputRef.current?.focus());
          else chatInputRef.current?.blur();
          return next;
        });
        return;
      }
      if (event.key.toLowerCase() === "u") { event.preventDefault(); setPanel("tome"); return; }
      if (event.key.toLowerCase() === "p") { event.preventDefault(); setPanel("account"); return; }
      if (event.key.toLowerCase() === "m" && mapItem) { event.preventDefault(); setMapOpen(true); return; }
      if (event.key === "Escape") {
        setContextMenu(null);
        setMapOpen(false);
        setOpenPanel(null);
        setOpenBagIds([]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actionPairCapacity, activeLoadout, backpack, bindings, controllerState.health.maximum, controllerState.lifecycle, items, lunchbox, mapItem, selectedLeftItem]);

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

  const setPanel = (panel: OpenPanel | null) => {
    setMapOpen(false);
    if (panel === "equipment") {
      gameplayMouseMode.cancelFreeDrag();
      if (document.pointerLockElement) document.exitPointerLock();
    }
    setOpenPanel(panel);
  };

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
    if (["account", "map", "settings", "backpack", "lunchbox", "tome", "spirit", "food", "drink"].includes(slotKind)) return { kind: "hud", slot: slotKind };
    if (slotKind.startsWith("action")) return { kind: "hud", slot: slotKind };
    if (equipmentSlotKinds.has(slotKind) && activeCharacter) return { kind: "equip", charId: activeCharacter.id, slot: slotKind };
    return null;
  };

  const canPlaceGridItem = (current: Record<string, CanvasItem>, item: CanvasItem, bagId: string, x: number, y: number, ignoredItemId?: string) => {
    const bag = current[bagId];
    if (!bag?.grid || x < 0 || y < 0 || x + item.w > bag.grid.cols || y + item.h > bag.grid.rows) return false;
    const candidate = { x, y, w: item.w, h: item.h };
    return Object.values(current).filter((other) => other.id !== item.id && other.id !== ignoredItemId && other.loc.kind === "grid" && other.loc.bagId === bagId).every((other) => other.loc.kind !== "grid" || !locationsOverlap(candidate, { x: other.loc.x, y: other.loc.y, w: other.w, h: other.h }));
  };

  const moveItem = async (itemId: string, destination: CanvasItemLocation) => {
    const movingItem = items[itemId];
    if (!movingItem) return false;
    const occupant = Object.values(items).find((other) => other.id !== itemId && JSON.stringify(other.loc) === JSON.stringify(destination));
    if (destination.kind === "grid" && !canPlaceGridItem(items, movingItem, destination.bagId, destination.x, destination.y, occupant?.id)) return false;
    const isScopedStashDemo = itemId.startsWith("stash");
    if (!isScopedStashDemo && destination.kind === "grid" && destination.bagId === "stashVault" && projection && onInventoryMove) {
      appendLog("system", "The local stash cannot accept a server-projected inventory item without confirmation.", "warning");
      setDraggedItemId(null);
      setDropTarget(null);
      return false;
    }
    if (projection && onInventoryMove && !isScopedStashDemo) {
      const confirmed=await onInventoryMove(itemId,destination,projection.projectionRevision);
      if(!confirmed){appendLog("system","Inventory changed elsewhere; authoritative state restored.","warning");setDraggedItemId(null);setDropTarget(null);return false;}
    }
    setItems((current) => {
      const item = current[itemId];
      if (!item) return current;
      if (destination.kind === "grid" && !canPlaceGridItem(current, item, destination.bagId, destination.x, destination.y, occupant?.id)) return current;
      const next = { ...current, [itemId]: { ...item, loc: destination } };
      if (occupant) next[occupant.id] = { ...occupant, loc: item.loc };
      return next;
    });
    setCursorInventory((current) => occupant ? holdCursorItem(current, occupant.id) : clearCursorInventory(current));
    setDraggedItemId(null);
    setDropTarget(null);
    return true;
  };

  const pickCursorItem = (item: CanvasItem, pointer?: Readonly<{ x: number; y: number }>) => {
    if (cursorInventory.heldItemId === item.id) return;
    if (!cursorInventory.heldItemId) {
      setCursorInventory((current) => holdCursorItem(current, item.id, pointer?.x, pointer?.y));
      setDraggedItemId(item.id);
      return;
    }
    const held = items[cursorInventory.heldItemId];
    if (!held) {
      setCursorInventory((current) => clearCursorInventory(current));
      return;
    }
    const slotKind = item.loc.kind === "hud" ? item.loc.slot : item.loc.kind === "equip" ? item.loc.slot : "grid";
    const acceptsHeld = item.loc.kind === "grid" || isCompatible(held, slotKind);
    const gridAvailable = item.loc.kind !== "grid" || canPlaceGridItem(items, held, item.loc.bagId, item.loc.x, item.loc.y, item.id);
    const plan = planCursorPlacement(cursorInventory, items, item.loc, acceptsHeld, item.id, gridAvailable);
    if (!plan.ok) {
      rejectDrop(slotKind, held?.name ?? "Held item", "the attempted cursor swap is incompatible");
      return;
    }
    void moveItem(plan.movedItemId, plan.destination);
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

  const placeCursorInFixed = async (slotKind: string) => {
    const item = cursorInventory.heldItemId ? items[cursorInventory.heldItemId] : undefined;
    const destination = targetLocation(slotKind);
    if (!item || !destination) return false;
    if (!isCompatible(item, slotKind)) {
      rejectDrop(slotKind, item.name, `requires a compatible ${slotDisplayName(slotKind).toLowerCase()} item`);
      return false;
    }
    return moveItem(item.id, destination);
  };

  const handleGridDrop = async (event: DragEvent<HTMLElement>, x: number, y: number) => {
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

  const placeCursorInGrid = async (bagId: string, x: number, y: number) => {
    const item = cursorInventory.heldItemId ? items[cursorInventory.heldItemId] : undefined;
    const bag = items[bagId];
    if (!item || !bag?.grid) return false;
    if (!canPlaceGridItem(items, item, bagId, x, y)) {
      rejectDrop("grid", item.name, "item footprint overlaps occupied cells or exceeds bag bounds");
      return false;
    }
    return moveItem(item.id, { kind: "grid", bagId, x, y });
  };

  const openItemContextMenu = (event: MouseEvent<HTMLButtonElement>, item: CanvasItem, slotKind: string) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ item, slotKind, x: event.clientX, y: event.clientY });
  };

  const equipItemForActionSide = async (item: CanvasItem, side: "left" | "right") => {
    if (!isCompatible(item, "action0")) {
      rejectDrop("action0", item.name, "item has no usable action");
      setContextMenu(null);
      return;
    }
    const index = side === "left" ? selectedLeftIndex : selectedRightIndex;
    const destination: CanvasItemLocation = { kind: "hud", slot: actionSlotName(activeLoadout, index) };
    if (await moveItem(item.id, destination)) {
      appendLog("player", `${item.name} equipped for ${side === "left" ? "left click" : "right click"} in loadout ${activeLoadout + 1}`, "gain");
    }
    setContextMenu(null);
  };

  const compatibleItems = (slotKind: string) => allItems.filter((item) => item.loc.kind === "grid" && isCompatible(item, slotKind)).slice(0, 6);

  const openItem = (item?: CanvasItem) => {
    if (!item) return;
    if (item.type === "kingdom") setPanel("login");
    else if (item.type === "account") setPanel("account");
    else if (item.type === "spirit") setSpiritOpen((current) => !current);
    else if (item.type === "character") setPanel("equipment");
    else if (item.type === "bag") toggleBagWindow(item.id);
    else if (item.type === "tome") setPanel("tome");
    else if (item.type === "map") { setOpenPanel(null); setMapOpen(true); }
    else if (item.type === "settings") window.location.assign("/dashboard");
    else if (item.type === "food") { characterController.heal(20); setItems((current) => ({ ...current, [item.id]: { ...current[item.id], quantity: Math.max(0, (current[item.id].quantity ?? 1) - 1) } })); }
    else if (item.type === "drink") { characterController.restoreSpirit(20); setItems((current) => ({ ...current, [item.id]: { ...current[item.id], quantity: Math.max(0, (current[item.id].quantity ?? 1) - 1) } })); }
  };

  const mapDropState: DropState = rejectedDropTarget === "map" ? "invalid" : draggedItemId && dropTarget === "map" ? (isCompatible(items[draggedItemId], "map") ? "valid" : "invalid") : undefined;
  const mapSlot = <AtlasItemSlot item={mapItem} label="Map" size="utility" hotkey="M" dropState={mapDropState} onClick={() => openItem(mapItem)} onContextMenu={(event) => mapItem && openItemContextMenu(event, mapItem, "map")} onDragStart={(item) => { pickCursorItem(item); setDropTarget("map"); }} onDragEnd={() => setDropTarget(null)} onDrop={(event) => handleFixedDrop(event, "map")} onDragOver={() => setDropTarget("map")} />;

  const abilitySlotForHud = (slotKind: string): AbilitySlot | null => {
    if (slotKind === "tome-ultimate") return "tome.ultimate";
    if (slotKind === "tome-action-1") return "tome.action1";
    if (slotKind === "tome-action-2") return "tome.action2";
    if (slotKind.startsWith("action")) {
      const index = Number(/(\d+)$/.exec(slotKind)?.[1] ?? -1) + 1;
      if (index >= 1 && index <= 10) return `actionbar.${index}` as AbilitySlot;
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
    const actionIndex = slotKind.startsWith("action") ? Number(/(\d+)$/.exec(slotKind)?.[1] ?? -1) : -1;
    const actionSelected = actionIndex === selectedLeftIndex || actionIndex === selectedRightIndex;
    return <AtlasItemSlot key={slotKind} item={displayedItem} label={label} size={size} hotkey={hotkey} className={className} selected={actionSelected} dropState={dropState} onClick={() => { if (cursorInventory.heldItemId) { void placeCursorInFixed(slotKind); return; } if (actionIndex >= 0) activateAction(actionIndex); else openItem(item); }} onContextMenu={(event) => item && openItemContextMenu(event, item, slotKind)} onDragStart={(dragItem) => { pickCursorItem(dragItem); setDropTarget(slotKind); }} onDragEnd={() => setDropTarget(null)} onDragOver={() => setDropTarget(slotKind)} onDrop={(event) => handleFixedDrop(event, slotKind)} />;
  };

  return (
    <div className={`hud-root atlas-hud prototype-hud${poweringDown ? " atlas-hud-powering-down" : ""}${rejectedDropTarget ? " is-alerting" : ""}`} aria-busy={poweringDown} onContextMenu={(event) => { event.preventDefault(); setContextMenu(null); }}>
      <header className="atlas-topbar prototype-hud__top">
        <div className="atlas-utility-group prototype-hud__designer"><DesignerAwarenessSlot disabled={poweringDown} onActivate={onOpenDashboard} onLogout={onLogout} /></div>
        {compassOpen
          ? <CompassBar player={mapPosition} markers={defaultMapMarkers} onCollapse={() => setCompassOpen(false)} />
          : <div className="prototype-hud__compass-slot"><AtlasItemSlot item={compassHudItem} label="Compass" size="utility" hotkey="N" onClick={() => setCompassOpen(true)} /></div>}
        <div className="prototype-hud__spirit">{renderSlot("spirit", "Spirit", hudItem("spirit"), "utility", "P")}</div>
      </header>

      <aside className="prototype-hud__backpack" aria-label="Backpack loadout">
        {renderSlot("backpack", "Backpack", backpack, "utility", bindingLabel("backpack"))}
        {renderSlot("lunchbox", "Lunchbox", lunchbox, "utility", bindingLabel("lunchbox"))}
      </aside>

      <section className="prototype-hud__character-loadout" aria-label="Map slot">
        {mapSlot}
      </section>

      <section className="prototype-hud__knowledge" aria-label="Knowledge and skills">
        <div className="atlas-mini-ability-group prototype-hud__knowledge-skills" role="group" aria-label="Knowledge skills">
          {tomeAbilities.map((ability, index) => { const slot = abilitySlotForHud(ability.id); return <AtlasItemSlot key={ability.id} item={slot ? withAbilityCooldown(ability, slot) : ability} label={ability.name} size={index === 0 ? "small" : "micro"} hotkey={tomeAbilityHotkeys[index] || undefined} onClick={() => { if (slot) characterController.activateSlot(slot); }} />; })}
        </div>
        {renderSlot("tome", "Knowledge", tome, "utility", "U")}
      </section>

      <main className="atlas-center-stage"><Crosshair presentation={crosshairPresentation} settings={crosshairSettings} /><EventLog channel="player" align="left" logs={logs} /><EventLog channel="spirit" align="right" logs={logs} /></main>

      {chatOpen ? <section className="atlas-chat-stack" aria-label="Chat">
        <EventLog channel="system" align="center" logs={logs} />
        <form className="atlas-chat" onSubmit={(event) => { event.preventDefault(); const message = chatDraft.trim(); if (!message) return; appendLog("system", `Message sent: ${message}`, "info"); setChatDraft(""); }}>
          <label className="sr-only" htmlFor="atlas-chat-input">Chat message</label>
          <input ref={chatInputRef} id="atlas-chat-input" value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setChatOpen(false); event.currentTarget.blur(); } }} placeholder="Type a message…" maxLength={160} />
          <button type="submit" aria-label="Send message"><AtlasIcon name="chevron" size={0.9} /></button>
        </form>
      </section> : null}

      <nav className="atlas-actionbar prototype-hud__actionbar" aria-label="Action slots">
        <div className="prototype-hud__action-side prototype-hud__action-side--left">
          <div className="prototype-hud__action-vital prototype-hud__action-vital--health"><MeterRail kind="health" current={controllerState.health.current} max={controllerState.health.maximum} /></div>
          <div className="prototype-hud__action-grid" aria-label="Odd action slots surrounding the active left action">
            {oddActionIndices.filter((index) => index !== selectedLeftIndex).map((index) => renderSlot(actionSlotName(activeLoadout, index), `Action ${index + 1}`, actionSlots[index], "action", String(index + 1)))}
          </div>
          <AtlasItemSlot item={selectedLeftItem} label="Left Action" size="action" hotkey={bindingLabel("left-hand")} selected className="prototype-hud__hand-action prototype-hud__hand-action--left" onClick={() => activateHandAction("left")} />
        </div>
        <section className="prototype-hud__creature" aria-label="Character slot">
          {renderSlot("character", "Character", activeCharacter, "utility", bindingLabel("character"), "prototype-hud__character-anchor")}
          <div className="atlas-mini-ability-group prototype-hud__agility" role="group" aria-label="Movement abilities">
            {movementAbilities.filter((ability) => ability.id !== "movement-dodge").map((ability) => { const index = movementAbilities.findIndex((candidate) => candidate.id === ability.id); return <AtlasItemSlot key={ability.id} item={ability} label={ability.name} size="micro" hotkey={movementAbilityHotkeys[index]} />; })}
          </div>
          <span className="prototype-hud__loadout-index">Loadout {activeLoadout + 1}/3 · X</span>
        </section>
        <div className="prototype-hud__action-side prototype-hud__action-side--right">
          <div className="prototype-hud__action-vital prototype-hud__action-vital--spirit"><MeterRail kind="spirit" current={controllerState.resources.spirit.current} max={controllerState.resources.spirit.maximum} /></div>
          <AtlasItemSlot item={selectedRightItem} label="Right Action" size="action" hotkey={bindingLabel("right-hand")} selected className="prototype-hud__hand-action prototype-hud__hand-action--right" onClick={() => activateHandAction("right")} />
          <div className="prototype-hud__action-grid" aria-label="Even action slots surrounding the active right action">
            {evenActionIndices.filter((index) => index !== selectedRightIndex).map((index) => renderSlot(actionSlotName(activeLoadout, index), `Action ${index + 1}`, actionSlots[index], "action", String(index + 1)))}
          </div>
        </div>
      </nav>

      {openBagIds.map((bagId) => items[bagId] ? <StashPanel key={bagId} bag={items[bagId]} items={gridItems(bagId)} capacity={bagSlotCount} draggedItemId={draggedItemId} onDragStart={(item) => { pickCursorItem(item); setDropTarget(`grid:${bagId}`); }} onDragEnd={() => setDropTarget(null)} onDropGrid={(event, x, y) => handleGridDrop(event, x, y)} onPlaceGrid={(x, y) => { void placeCursorInGrid(bagId, x, y); }} onClick={pickCursorItem} onContextMenu={openItemContextMenu} onClose={() => setOpenBagIds((current) => current.filter((id) => id !== bagId))} /> : null)}
      {spiritOpen ? <StashPanel bag={items.spiritBox1} items={allItems.filter((item) => item.type === "character").map((item, index) => ({ ...item, loc: { kind: "grid", bagId: "spiritBox1", x: index % 4, y: Math.floor(index / 4) } }))} capacity={4} draggedItemId={draggedItemId} onDragStart={(item) => setDraggedItemId(item.id)} onDragEnd={() => setDraggedItemId(null)} onDropGrid={(event) => event.preventDefault()} onPlaceGrid={() => undefined} onClick={openItem} onContextMenu={openItemContextMenu} onClose={() => setSpiritOpen(false)} /> : null}

      {openPanel === "login" ? <LoginPanel onLogin={loginAs} onClose={() => setPanel(null)} /> : null}
      {openPanel === "account" ? <AccountPanel loggedIn={loggedIn} onSignOut={signOut} onClose={() => setPanel(null)} /> : null}
      {openPanel === "equipment" ? <EquipmentPanel activeCharacter={activeCharacter} equipItem={equipItem} onDrop={handleFixedDrop} draggedItemId={draggedItemId} onDragStart={(item) => setDraggedItemId(item.id)} onDragEnd={() => setDraggedItemId(null)} onContextMenu={openItemContextMenu} onClose={() => setPanel(null)} /> : null}
      {openPanel === "tome" ? <TomePanel onClose={() => setPanel(null)} /> : null}
      {openPanel === "settings" ? <SettingsPanel bindings={bindings} onBindingsChange={setBindings} onClose={() => setPanel(null)} /> : null}
      {mapOpen && mapItem ? <PlayerMapPanel item={mapItem} player={mapPosition} markers={defaultMapMarkers} onClose={() => setMapOpen(false)} /> : null}

      {cursorInventory.heldItemId && items[cursorInventory.heldItemId] ? <div className="atlas-cursor-inventory" style={{ left: `${cursorInventory.pointerX}px`, top: `${cursorInventory.pointerY}px` }} aria-label={`Cursor inventory: ${items[cursorInventory.heldItemId].name}`}><AtlasItemIcon item={items[cursorInventory.heldItemId]} size={1.65} /><span>Cursor</span></div> : null}

      {contextMenu ? <div ref={contextMenuRef} className="atlas-context-menu" style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }} role="menu" aria-label={`${contextMenu.item.name} actions`} tabIndex={-1} onKeyDown={handleContextMenuKeyDown}><strong>{contextMenu.item.name}</strong><span>{contextMenu.item.leftClickAction ?? "Inspect item"}</span>{isCompatible(contextMenu.item, "action0") ? <><div className="atlas-context-divider" /><button type="button" role="menuitem" onClick={() => equipItemForActionSide(contextMenu.item, "left")}><AtlasIcon name="chevron" size={0.9} /><span>Equip Left · Slot {selectedLeftIndex + 1}</span></button><button type="button" role="menuitem" onClick={() => equipItemForActionSide(contextMenu.item, "right")}><AtlasIcon name="chevron" size={0.9} /><span>Equip Right · Slot {selectedRightIndex + 1}</span></button></> : null}<div className="atlas-context-divider" />{compatibleItems(contextMenu.slotKind).map((item) => <button key={item.id} type="button" role="menuitem" onClick={() => { const destination = targetLocation(contextMenu.slotKind); if (destination) moveItem(item.id, destination); setContextMenu(null); }}><AtlasIcon name={item.icon} size={0.9} /><span>{item.name}</span></button>)}{compatibleItems(contextMenu.slotKind).length === 0 && !isCompatible(contextMenu.item, "action0") ? <small>No compatible items</small> : null}</div> : null}
    </div>
  );
}
