import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { surfaceMapStore } from "../scene/surfaceMapStore";
import { WORLD_MAP_ZOOM_STEPS } from "../scene/BabylonScene";
import { AtlasIcon, AtlasProgress } from "./AtlasPrimitives";
import type { CanvasItem, HudMapMarker, HudMapPosition } from "./types";

type Pan = { x: number; z: number };
const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function projectMapPoint(point: Pan, pan: Pan, zoom: number, width: number, height: number) {
  const worldWidth = zoom * (width / Math.max(1, height));
  return {
    x: 50 + ((point.x - pan.x) / worldWidth) * 100,
    y: 50 - ((point.z - pan.z) / zoom) * 100,
  };
}

function MapCanvas({
  zoom,
  pan,
  player,
  markers,
  interactive,
  className = "",
  onPanChange,
  onZoomChange,
}: {
  zoom: number;
  pan: Pan;
  player: HudMapPosition;
  markers: HudMapMarker[];
  interactive: boolean;
  className?: string;
  onPanChange?: (pan: Pan) => void;
  onZoomChange?: (direction: -1 | 1) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
  const dragRef = useRef<{ pointerId: number; x: number; y: number; pan: Pan } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 2));
      const width = Math.max(1, Math.floor(rect.width * ratio));
      const height = Math.max(1, Math.floor(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      setCanvasSize((current) => current.width === width && current.height === height ? current : { width, height });
      const context = canvas.getContext("2d");
      if (context) surfaceMapStore.draw(context, width, height, "final", zoom, pan);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [pan.x, pan.z, zoom]);

  const adjustPan = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!interactive || !onPanChange) return;
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const worldPerPixel = zoom / Math.max(1, rect.height);
    onPanChange({
      x: drag.pan.x - (event.clientX - drag.x) * worldPerPixel,
      z: drag.pan.z + (event.clientY - drag.y) * worldPerPixel,
    });
  };

  const visibleMarkers = markers
    .filter((marker) => marker.discovered)
    .map((marker) => ({ marker, position: projectMapPoint(marker, pan, zoom, canvasSize.width, canvasSize.height) }))
    .filter(({ position }) => position.x >= -8 && position.x <= 108 && position.y >= -8 && position.y <= 108);
  const playerPosition = projectMapPoint(player, pan, zoom, canvasSize.width, canvasSize.height);

  return (
    <div className={`atlas-map-canvas ${interactive ? "is-interactive" : ""} ${className}`.trim()}>
      <canvas
        ref={canvasRef}
        onPointerDown={(event) => {
          if (!interactive || !onPanChange) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, pan };
        }}
        onPointerMove={adjustPan}
        onPointerUp={(event) => { if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null; }}
        onPointerCancel={(event) => { if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null; }}
        onWheel={(event: ReactWheelEvent<HTMLCanvasElement>) => {
          if (!interactive) return;
          event.preventDefault();
          onZoomChange?.(event.deltaY > 0 ? 1 : -1);
        }}
        aria-label="Rendered player map"
      />
      {visibleMarkers.map(({ marker, position }) => (
        <span
          key={marker.id}
          className={`atlas-map-marker atlas-map-marker-${marker.kind}`}
          style={{ left: `${position.x}%`, top: `${position.y}%` }}
          aria-label={marker.label}
          title={marker.label}
        >
          <AtlasIcon name={marker.kind === "gate" ? "keyhole" : marker.kind === "keep" ? "castle" : marker.kind === "objective" ? "target" : "person"} size={marker.kind === "objective" ? 0.95 : 0.85} />
        </span>
      ))}
      <span className="atlas-map-marker atlas-map-marker-player" style={{ left: `${playerPosition.x}%`, top: `${playerPosition.y}%` }} aria-label="Your location"><AtlasIcon name="target" size={1.05} /></span>
      <span className="atlas-map-facing" style={{ left: `${playerPosition.x}%`, top: `${playerPosition.y}%`, transform: `translate(-50%, -100%) rotate(${player.heading}deg)` }} aria-hidden="true" />
    </div>
  );
}

export function MiniMap({ item, player, markers, onOpen }: { item: CanvasItem; player: HudMapPosition; markers: HudMapMarker[]; onOpen: () => void }) {
  const zoom = 24000;
  const pan = useMemo(() => ({ x: player.x, z: player.z }), [player.x, player.z]);
  return (
    <section className="atlas-minimap" aria-label={`${item.name} minimap`}>
      <button type="button" className="atlas-minimap-header" onClick={onOpen}>
        <span><AtlasIcon name="map" size={0.85} />{item.name}</span>
        <small>Open map</small>
      </button>
      <button type="button" className="atlas-minimap-body" onClick={onOpen} aria-label={`Open ${item.name}`}>
        <MapCanvas zoom={zoom} pan={pan} player={player} markers={markers} interactive={false} />
      </button>
      <div className="atlas-minimap-footer"><span>North up</span><span>24 km</span></div>
    </section>
  );
}

export function PlayerMapPanel({ item, player, markers, onClose }: { item: CanvasItem; player: HudMapPosition; markers: HudMapMarker[]; onClose: () => void }) {
  const zoomSteps = WORLD_MAP_ZOOM_STEPS.filter((step) => step >= 1600);
  const [zoomIndex, setZoomIndex] = useState(2);
  const [pan, setPan] = useState<Pan>({ x: player.x, z: player.z });
  const panelRef = useRef<HTMLElement | null>(null);
  const zoom = zoomSteps[zoomIndex] ?? 6400;

  const adjustZoom = (direction: -1 | 1) => setZoomIndex((current) => Math.max(0, Math.min(zoomSteps.length - 1, current + direction)));
  const centerOnPlayer = () => setPan({ x: player.x, z: player.z });
  const discoveredMarkers = markers.filter((marker) => marker.discovered);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFirst = () => {
      const first = panel.querySelector<HTMLElement>(focusableSelector);
      (first ?? panel).focus();
    };
    window.requestAnimationFrame(focusFirst);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
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
    panel.addEventListener("keydown", handleKeyDown);
    return () => {
      panel.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className="atlas-overlay atlas-map-overlay" role="presentation">
      <section ref={panelRef} className="atlas-map-panel" role="dialog" aria-modal="true" aria-label="Player map" tabIndex={-1}>
        <header className="atlas-map-header">
          <div>
            <span className="atlas-eyebrow">Navigation</span>
            <h2>{item.name}</h2>
            <p>Garden region · Your position is marked in spectral cyan.</p>
          </div>
          <button type="button" className="atlas-close" onClick={onClose} aria-label="Close player map"><AtlasIcon name="x" size={1} /></button>
        </header>
        <div className="atlas-map-workspace">
          <div className="atlas-map-stage">
            <MapCanvas zoom={zoom} pan={pan} player={player} markers={markers} interactive onPanChange={setPan} onZoomChange={adjustZoom} />
            <div className="atlas-map-readout"><span>{Math.round(pan.x)} X · {Math.round(pan.z)} Z</span><span>{zoom.toLocaleString()} m view</span></div>
          </div>
          <aside className="atlas-map-sidebar">
            <section className="atlas-map-card">
              <span className="atlas-eyebrow">Map controls</span>
              <div className="atlas-map-zoom"><button type="button" onClick={() => adjustZoom(-1)} aria-label="Zoom out">−</button><AtlasProgress value={(zoomIndex / Math.max(1, zoomSteps.length - 1)) * 100} label="Map zoom" /><button type="button" onClick={() => adjustZoom(1)} aria-label="Zoom in">+</button></div>
              <button type="button" className="atlas-secondary-button" onClick={centerOnPlayer}>Center on player</button>
              <small>Drag to pan · wheel to zoom · Esc to close</small>
            </section>
            <section className="atlas-map-card">
              <span className="atlas-eyebrow">Legend</span>
              <div className="atlas-map-legend"><span><i className="legend-player" />You</span><span><i className="legend-keep" />Discovered keep</span><span><i className="legend-gate" />Garden gate</span><span><i className="legend-objective" />Objective</span></div>
            </section>
            <section className="atlas-map-card">
              <span className="atlas-eyebrow">Discovered</span>
              <div className="atlas-map-poi-list">{discoveredMarkers.map((marker) => <button type="button" key={marker.id} onClick={() => setPan({ x: marker.x, z: marker.z })}><span>{marker.label}</span><small>{Math.round(marker.x)} X · {Math.round(marker.z)} Z</small></button>)}</div>
            </section>
            <section className="atlas-map-card atlas-map-card-muted"><span className="atlas-eyebrow">Exploration</span><strong>18%</strong><small>{discoveredMarkers.length} landmarks charted. Uncharted regions remain hidden until discovered.</small></section>
          </aside>
        </div>
      </section>
    </div>
  );
}
