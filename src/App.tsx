import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent, type PointerEvent } from "react";
import { createGatewayClient } from "./api/gateway-client";
import type { GatewayResult, GatewaySessionProjection, WorldDiscovery, WorldHudProjectionV2 } from "./api/gateway-contract";
import { CharacterAssetPreview } from "./character-preview/CharacterAssetPreview";
import { Dashboard } from "./Dashboard";
import { BabylonScene } from "./scene/BabylonScene";
import { DesignerAwarenessSlot, KnowhereHud } from "./hud/KnowhereHud";
import { beginWorldBootstrap, completeWorldBootstrap, stateFromSession, type ClientFlowState } from "./session/client-flow";
import { SystemThemeExperience } from "./system-theme/SystemThemeExperience";
import { SystemWorldItem } from "./system-theme/SystemWorldItem";
import { ACCOUNT_SOUL_ITEM, CHARACTER_SOUL_ITEM } from "./inventory/inventory-model";
import { projectCharacterDrop, type ScreenPoint } from "./inventory/character-placement";

function configuredGatewayUrl(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="knowhere-gateway-url"]')?.content.trim() || window.location.origin;
}

function gatewayFailure(result: Exclude<GatewayResult<unknown>, { ok: true }>, projection: GatewaySessionProjection | null): ClientFlowState {
  return { phase: "error", boundary: "gateway", message: safeGatewayMessage(result.code), retryable: result.retryable, projection };
}

function safeGatewayMessage(code: string): string {
  if (code === "rate_limited") return "Please wait a moment before trying again.";
  if (code === "session_expired" || code === "unauthenticated") return "Your session ended. Present Awareness again.";
  if (code === "selection_conflict" || code === "character_unavailable" || code === "character_denied") return "That character is unavailable. Choose again.";
  if (code === "world_entry_denied") return "Garden entry is unavailable right now.";
  return "Knowhere is unavailable right now.";
}

function SeatedAwareness({ disabled, onRemove }: Readonly<{ disabled: boolean; onRemove: () => void }>) {
  return <><div className="atlas-seated-awareness"><DesignerAwarenessSlot disabled={disabled} onLogout={onRemove} /></div>{disabled ? <span className="atlas-tube-close" aria-hidden="true" /> : null}</>;
}

function formatLoginTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

type CharacterTraveler = Readonly<{ label: string; style: CSSProperties }>;
type HeldCharacter = Readonly<{
  id: string;
  label: string;
  origin: Readonly<{ left: number; top: number; width: number; height: number }>;
  pointer: ScreenPoint;
}>;

function SystemCharacterSelect({ projection, worlds, busy, poweringDown, message, onSelect, onCreate, onWake, onRemove }: Readonly<{
  projection: GatewaySessionProjection;
  worlds: WorldDiscovery | null;
  busy: boolean;
  poweringDown: boolean;
  message: string | null;
  onSelect: (characterId: string) => void;
  onCreate: () => void;
  onWake: () => void;
  onRemove: () => void;
}>) {
  const [traveler, setTraveler] = useState<CharacterTraveler | null>(null);
  const [heldCharacter, setHeldCharacter] = useState<HeldCharacter | null>(null);
  const [dropProjected, setDropProjected] = useState(false);
  const characterSlotRef = useRef<HTMLDivElement>(null);
  const heldCharacterRef = useRef<HeldCharacter | null>(null);
  const transferTimerRef = useRef<number | null>(null);
  const nativeDragRef = useRef(false);
  const selected = projection.selection.characters.find((character) => character.id === projection.selection.selectedCharacterId) ?? null;
  const accountSpirit = projection.accountSoul;
  const world = worlds?.worlds.find((candidate) => candidate.id === worlds.defaultWorldId && candidate.available) ?? null;

  useEffect(() => () => {
    if (transferTimerRef.current !== null) window.clearTimeout(transferTimerRef.current);
  }, []);

  function holdCharacter(characterId: string, label: string, from: DOMRect, point: ScreenPoint) {
    if (busy || traveler) return;
    const next = { id: characterId, label, origin: { left: from.left, top: from.top, width: from.width, height: from.height }, pointer: point };
    heldCharacterRef.current = next;
    setHeldCharacter(next);
    setDropProjected(false);
  }

  function updateHeldPointer(point: ScreenPoint) {
    const current = heldCharacterRef.current;
    if (!current) return false;
    const next = { ...current, pointer: point };
    heldCharacterRef.current = next;
    setHeldCharacter(next);
    const slot = characterSlotRef.current?.getBoundingClientRect();
    const projected = Boolean(slot && projectCharacterDrop(point, slot).accepted);
    setDropProjected(projected);
    return projected;
  }

  function seatHeldCharacter(point?: ScreenPoint) {
    const current = heldCharacterRef.current;
    const slotElement = characterSlotRef.current;
    if (!current || !slotElement || busy || traveler) return false;
    const to = slotElement.getBoundingClientRect();
    if (point && !projectCharacterDrop(point, to).accepted) {
      setDropProjected(false);
      return false;
    }
    const fromLeft = point ? point.x - current.origin.width / 2 : current.origin.left;
    const fromTop = point ? point.y - current.origin.height / 2 : current.origin.top;
    const style = {
      "--travel-from-x": `${fromLeft}px`, "--travel-from-y": `${fromTop}px`,
      "--travel-from-w": `${current.origin.width}px`, "--travel-from-h": `${current.origin.height}px`,
      "--travel-to-x": `${to.left}px`, "--travel-to-y": `${to.top}px`,
      "--travel-to-w": `${to.width}px`, "--travel-to-h": `${to.height}px`,
    } as CSSProperties;
    heldCharacterRef.current = null;
    setHeldCharacter(null);
    setDropProjected(false);
    setTraveler({ label: current.label, style });
    transferTimerRef.current = window.setTimeout(() => {
      transferTimerRef.current = null;
      setTraveler(null);
      onSelect(current.id);
    }, 440);
    return true;
  }

  function pickUpByClick(event: MouseEvent<HTMLButtonElement>, characterId: string, label: string) {
    if (nativeDragRef.current) { nativeDragRef.current = false; return; }
    if (heldCharacterRef.current?.id === characterId) return;
    holdCharacter(characterId, label, event.currentTarget.getBoundingClientRect(), { x: event.clientX, y: event.clientY });
  }

  function beginNativeDrag(event: DragEvent<HTMLButtonElement>, characterId: string, label: string) {
    nativeDragRef.current = true;
    holdCharacter(characterId, label, event.currentTarget.getBoundingClientRect(), { x: event.clientX, y: event.clientY });
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", characterId);
  }

  function beginPointerDrag(event: PointerEvent<HTMLButtonElement>, characterId: string, label: string) {
    if (event.pointerType === "mouse") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    holdCharacter(characterId, label, event.currentTarget.getBoundingClientRect(), { x: event.clientX, y: event.clientY });
  }

  return <main className={`system-stage system-theme system-character-stage ${selected ? "is-wake-up" : "is-selecting"}`} onDragOver={(event) => { if (!heldCharacterRef.current) return; event.preventDefault(); updateHeldPointer({ x: event.clientX, y: event.clientY }); }} onDrop={(event) => { if (!heldCharacterRef.current) return; event.preventDefault(); seatHeldCharacter({ x: event.clientX, y: event.clientY }); }} onPointerMove={(event) => { if (heldCharacterRef.current) updateHeldPointer({ x: event.clientX, y: event.clientY }); }} onPointerUp={(event) => { if (heldCharacterRef.current) seatHeldCharacter({ x: event.clientX, y: event.clientY }); }}>
    <div className="system-passage-layout">
      <span className="system-character-frame" aria-hidden="true" />
      <svg className="system-passage-connectors" viewBox="0 0 816 1006" preserveAspectRatio="none" aria-hidden="true"><path d="M134 69 H684" /><path d="M38 130 V900 H284" /><path d="M778 130 V900 H532" /></svg>
      <div className="system-passage-slot system-passage-slot--designer"><SeatedAwareness disabled={poweringDown} onRemove={onRemove} /></div>
      <aside className="system-spirit-slot system-passage-slot system-passage-slot--spirit" tabIndex={0} aria-label={`${accountSpirit.item.name}. Account statistics`}>
        <span className="system-grid-slot system-grid-slot--2x2"><img className="system-soul-glyph" src={ACCOUNT_SOUL_ITEM.iconPath} alt="" /></span>
        <span className="system-item-tooltip" role="tooltip"><strong>{accountSpirit.item.name}</strong><span>{accountSpirit.item.description}</span><span>Total login time: {formatLoginTime(accountSpirit.stats.totalLoginSeconds)}</span><span>Session: active</span></span>
      </aside>
      <section className="system-character-composition">
      <header className="system-character-heading"><span aria-hidden="true">◇</span><h1>{selected ? "Wake Up" : "Select Character"}</h1><span aria-hidden="true">◇</span></header>
      {message ? <p className="system-error" role="alert">{message}</p> : null}
      <div className="system-character-content">
        {selected && world ? <button className="system-world-item system-grid-slot system-grid-slot--3x3 system-passage-slot system-passage-slot--world" type="button" disabled={busy} onClick={onWake} aria-label={`Enter ${world.displayName}`}><SystemWorldItem /><span className="system-item-tooltip" role="tooltip"><strong>{world.displayName}</strong><span>{world.description}</span><span>{world.currentPlayerCount} player{world.currentPlayerCount === 1 ? "" : "s"} online</span></span></button> : selected ? <p className="system-error" role="status">Garden details are unavailable.</p> : <div className="system-character-grid">{projection.selection.characters.map((character) => <button className={`system-character-item system-grid-slot system-grid-slot--2x3${heldCharacter?.id === character.id ? " is-held" : ""}`} data-quality={character.item.quality} type="button" key={character.id} disabled={busy || traveler !== null || !character.selectable} draggable={!busy && traveler === null && character.selectable} onClick={(event) => pickUpByClick(event, character.id, character.displayName)} onDragStart={(event) => beginNativeDrag(event, character.id, character.displayName)} onDragEnd={() => { nativeDragRef.current = false; setDropProjected(false); }} onPointerDown={(event) => beginPointerDrag(event, character.id, character.displayName)}><img className="system-character-glyph" src={CHARACTER_SOUL_ITEM.iconPath} alt="" /><span className="system-character-initial" aria-hidden="true">{character.displayName.trim().charAt(0).toUpperCase()}</span><span className="system-character-name">{character.displayName}{character.level ? ` · lvl ${character.level}` : ""}</span><span className="system-item-tooltip" role="tooltip"><strong>{character.displayName}</strong><span>{character.archetype}</span><span>{character.item.description}</span></span></button>)}<button className="system-character-item system-grid-slot system-grid-slot--2x3 is-create" type="button" disabled={busy || traveler !== null || heldCharacter !== null} aria-label="Create character" onClick={onCreate}><span aria-hidden="true">+</span></button></div>}
      </div>
      <div className={`system-equipped-character system-grid-slot system-grid-slot--2x3 system-passage-slot system-passage-slot--character${selected ? " is-seated" : ""}${dropProjected ? " is-drop-projected" : ""}`} ref={characterSlotRef} role="button" tabIndex={heldCharacter ? 0 : -1} aria-label={selected ? `${selected.displayName} selected` : heldCharacter ? `Place ${heldCharacter.label} in character slot` : "Empty character slot"} onClick={() => { if (heldCharacterRef.current) seatHeldCharacter(); }} onKeyDown={(event) => { if (heldCharacterRef.current && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); seatHeldCharacter(); } }}>{selected ? <><img className="system-character-glyph" src={CHARACTER_SOUL_ITEM.iconPath} alt="" /><span className="system-character-initial" aria-hidden="true">{selected.displayName.trim().charAt(0).toUpperCase()}</span><span className="system-character-name">{selected.displayName}</span></> : dropProjected && heldCharacter ? <><img className="system-character-glyph system-character-glyph--projection" src={CHARACTER_SOUL_ITEM.iconPath} alt="" /><span className="system-character-initial" aria-hidden="true">{heldCharacter.label.trim().charAt(0).toUpperCase()}</span></> : null}</div>
      </section>
    </div>
    {heldCharacter ? <span className="system-cursor-character system-grid-slot system-grid-slot--2x3" style={{ "--cursor-x": `${heldCharacter.pointer.x}px`, "--cursor-y": `${heldCharacter.pointer.y}px` } as CSSProperties} aria-hidden="true"><img className="system-character-glyph" src={CHARACTER_SOUL_ITEM.iconPath} alt="" /><span className="system-character-initial">{heldCharacter.label.trim().charAt(0).toUpperCase()}</span></span> : null}
    {traveler ? <span className="system-item-traveler system-grid-slot system-grid-slot--2x3" style={traveler.style} aria-hidden="true"><img className="system-character-glyph" src={CHARACTER_SOUL_ITEM.iconPath} alt="" /><span className="system-character-initial">{traveler.label.trim().charAt(0).toUpperCase()}</span></span> : null}
  </main>;
}

export function App() {
  const [flow, setFlow] = useState<ClientFlowState>({ phase: "restoring" });
  const [gateUnlocked, setGateUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [poweringDown, setPoweringDown] = useState(false);
  const [hudProjection, setHudProjection] = useState<WorldHudProjectionV2 | null>(null);
  const [worldDiscovery, setWorldDiscovery] = useState<WorldDiscovery | null>(null);
  const [route, setRoute] = useState(window.location.pathname);
  const logoutInFlight = useRef<Promise<void> | null>(null);
  const gateway = useMemo(() => createGatewayClient(configuredGatewayUrl()), []);

  useEffect(() => { const update = () => setRoute(window.location.pathname); window.addEventListener("popstate", update); return () => window.removeEventListener("popstate", update); }, []);
  useEffect(() => { if (flow.phase !== "world-ready") { setHudProjection(null); return; } const controller = new AbortController(); void gateway.getWorldHud(controller.signal).then((result) => { if (result.ok) setHudProjection(result.value); }); return () => controller.abort(); }, [flow.phase, gateway]);
  useEffect(() => {
    if (!gateUnlocked || !["character-select", "character-ready"].includes(flow.phase) || worldDiscovery) return;
    const controller = new AbortController();
    void gateway.getWorlds(controller.signal).then((result) => { if (result.ok) setWorldDiscovery(result.value); });
    return () => controller.abort();
  }, [flow.phase, gateUnlocked, gateway, worldDiscovery]);

  async function restore(signal?: AbortSignal) {
    setBusy(true); const result = await gateway.restoreSession(signal); setBusy(false);
    if (result.ok) {
      setGateUnlocked(true); await continueFromProjection(result.value); return;
    }
    if (result.code === "unauthenticated" || result.code === "session_expired") { setGateUnlocked(false); setFlow({ phase: "login", message: null }); return; }
    if (result.code !== "aborted") setFlow(gatewayFailure(result, null));
  }
  async function continueFromProjection(projection: GatewaySessionProjection, autoEnter = true) { const next = stateFromSession(projection); if (next.phase !== "character-ready" || !autoEnter) { setFlow(next); return; } await enterGarden({ phase: "gateway-entry", projection, worldId: "garden" }); }
  async function resume(projection: GatewaySessionProjection) { setBusy(true); const result = await gateway.resumeSession(); setBusy(false); if (result.ok) await continueFromProjection(result.value); else if (result.code === "unauthenticated" || result.code === "session_expired") { setGateUnlocked(false); setFlow({ phase: "login", message: "Your session expired. Present Awareness again." }); } else setFlow({ phase: "resume-required", projection, message: safeGatewayMessage(result.code) }); }
  async function selectCharacter(projection: GatewaySessionProjection, characterId: string) { setBusy(true); const result = await gateway.selectCharacter(characterId, projection.selection.version); setBusy(false); if (result.ok) setFlow({ phase: "character-ready", projection: result.value, message: null }); else setFlow({ phase: "character-select", projection, message: safeGatewayMessage(result.code) }); }
  async function enterGarden(state: Extract<ClientFlowState, { phase: "gateway-entry" }>) { setFlow(state); setBusy(true); const entry = await gateway.enterWorld("garden"); if (!entry.ok) { setBusy(false); setFlow(gatewayFailure(entry, state.projection)); return; } const bootstrapping = beginWorldBootstrap(state, entry.value); setFlow(bootstrapping); if (bootstrapping.phase !== "world-bootstrap") { setBusy(false); return; } let bootstrap = await gateway.getWorldBootstrap(); for (let attempt = 1; !bootstrap.ok && attempt < 4; attempt += 1) { await new Promise((resolve) => window.setTimeout(resolve, attempt * 350)); bootstrap = await gateway.getWorldBootstrap(); } setBusy(false); setFlow(completeWorldBootstrap(bootstrapping, bootstrap.ok ? bootstrap.value : null)); }
  function navigate(path: string) { window.history.pushState({}, "", path); setRoute(path); }
  function logout() { if (logoutInFlight.current) return; setPoweringDown(true); logoutInFlight.current = (async () => { const [result] = await Promise.all([gateway.logout(), new Promise((resolve) => window.setTimeout(resolve, 760))]); if (!result.ok) { setPoweringDown(false); setFlow(gatewayFailure(result, "projection" in flow ? flow.projection : null)); return; } setFlow({ phase: "login", message: null }); setWorldDiscovery(null); setGateUnlocked(false); setPoweringDown(false); navigate("/"); })().finally(() => { logoutInFlight.current = null; }); }

  if (new URLSearchParams(window.location.search).get("preview") === "staxel-voxel-female") return <CharacterAssetPreview />;
  if (!gateUnlocked || flow.phase === "restoring" || flow.phase === "login") return <SystemThemeExperience gateway={gateway} onSessionReady={async (projection, source, signal) => { if (signal.aborted) return; setGateUnlocked(true); if (source === "login") { setFlow({ phase: "character-select", projection, message: null }); return; } await continueFromProjection(projection); }} />;

  const projection = "projection" in flow ? flow.projection : null;
  if (route === "/characters/new" && projection) return <><main className="system-stage system-theme"><section className="system-panel"><span className="system-eyebrow">Spirit inventory</span><h1>Create a new character</h1><p>The character creator is being prepared. Your current Spirit inventory is unchanged.</p><button type="button" onClick={() => navigate("/")}>Back to characters</button></section></main><SeatedAwareness disabled={poweringDown} onRemove={logout} /></>;
  if (flow.phase === "resume-required") return <><main className="atlas-login-stage"><section className="atlas-panel"><h1>Resume Knowhere</h1><p>{flow.message ?? "Your authenticated spirit is idle."}</p><button className="atlas-primary-button" disabled={busy} onClick={() => void resume(flow.projection)}>Resume session</button></section></main><SeatedAwareness disabled={poweringDown} onRemove={logout} /></>;
  if (flow.phase === "character-select" || flow.phase === "character-ready") return <SystemCharacterSelect projection={flow.projection} worlds={worldDiscovery} busy={busy} poweringDown={poweringDown} message={flow.message} onSelect={(characterId) => void selectCharacter(flow.projection, characterId)} onCreate={() => navigate("/characters/new")} onWake={() => void enterGarden({ phase: "gateway-entry", projection: flow.projection, worldId: worldDiscovery?.defaultWorldId ?? "garden" })} onRemove={logout} />;
  if (flow.phase === "gateway-entry" || flow.phase === "world-bootstrap") return <><main className="atlas-login-stage"><p aria-live="polite">{flow.phase === "gateway-entry" ? "Requesting admission…" : "Loading the world…"}</p></main><SeatedAwareness disabled={poweringDown} onRemove={logout} /></>;
  if (flow.phase === "world-ready") { const selected = flow.projection.selection.characters.find((character) => character.id === flow.projection.selection.selectedCharacterId); const dashboardOpen = route.startsWith("/dashboard"); return <main className={`app-shell${poweringDown ? " is-powering-down" : ""}${dashboardOpen ? " is-dashboard-open" : ""}`}><BabylonScene projection={flow.world.scene} worldIdentity={flow.world} interactive={!dashboardOpen} />{dashboardOpen ? <Dashboard projection={flow.projection} onBack={() => navigate("/")} onLogout={logout} /> : <KnowhereHud accountLabel={selected?.displayName ?? "Traveler"} settingsOwnerId={selected?.id ?? ""} projection={hudProjection} poweringDown={poweringDown} onOpenDashboard={() => navigate("/dashboard")} onInventoryMove={async(itemInstanceId,destination,expectedProjectionRevision)=>{const result=await gateway.moveInventory({itemInstanceId,destination,expectedProjectionRevision});if(!result.ok)return null;setHudProjection(result.value);return result.value;}} onLogout={logout} />}{poweringDown ? <span className="atlas-tube-close" aria-hidden="true" /> : null}</main>; }
  return <><main className="atlas-login-stage"><section className="atlas-panel" role="alert"><h1>Knowhere is unavailable</h1><p>{flow.message}</p><button className="atlas-secondary-button" onClick={() => void restore()}>Try again</button></section></main><SeatedAwareness disabled={poweringDown} onRemove={logout} /></>;
}
