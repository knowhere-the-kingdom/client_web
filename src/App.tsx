import { type DragEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createGatewayClient } from "./api/gateway-client";
import type { GatewayResult, GatewaySessionProjection, WorldHudProjectionV2 } from "./api/gateway-contract";
import { CharacterAssetPreview } from "./character-preview/CharacterAssetPreview";
import { Dashboard } from "./Dashboard";
import { BabylonScene } from "./scene/BabylonScene";
import { KnowhereHud } from "./hud/KnowhereHud";
import { InventoryItemCard, InventorySlot } from "./inventory/InventoryPrimitives";
import { AWARENESS_INSTANCE, AWARENESS_ITEM, DESIGNER_RECEPTACLE } from "./inventory/inventory-model";
import { EMPTY_INVENTORY_MOVEMENT, cancelInventoryMovement, pickUpInventoryItem, placeHeldInventoryItem } from "./inventory/inventory-movement";
import { beginWorldBootstrap, completeWorldBootstrap, stateFromSession, type ClientFlowState } from "./session/client-flow";

function configuredGatewayUrl(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="knowhere-gateway-url"]')?.content.trim() || window.location.origin;
}

function gatewayFailure(result: Exclude<GatewayResult<unknown>, { ok: true }>, projection: GatewaySessionProjection | null): ClientFlowState {
  return { phase: "error", boundary: "gateway", message: result.message || "Knowhere is not open yet.", retryable: result.retryable, projection };
}

function KeyGate({ busy, message, onUnlock }: Readonly<{ busy: boolean; message: string | null; onUnlock: () => void }>) {
  const [movement, setMovement] = useState(EMPTY_INVENTORY_MOVEMENT);
  const [cursor, setCursor] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2, pointerType: "mouse" });
  const slotRef = useRef<HTMLDivElement>(null);
  const held = movement.heldInstanceId === AWARENESS_INSTANCE.instanceId;

  useEffect(() => {
    if (!held) return;
    const move = (event: PointerEvent) => setCursor({ x: event.clientX, y: event.clientY, pointerType: event.pointerType });
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMovement(cancelInventoryMovement());
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("keydown", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("keydown", cancel);
    };
  }, [held]);

  const placeAwareness = () => {
    const placed = placeHeldInventoryItem(movement, AWARENESS_INSTANCE, true);
    if (!placed.ok) return;
    setMovement(placed.state);
    onUnlock();
  };
  const placeNearSlot = (x: number, y: number, pointerType: string) => {
    const bounds = slotRef.current?.getBoundingClientRect();
    if (!bounds || !held) return;
    const deltaX = Math.max(bounds.left - x, 0, x - bounds.right);
    const deltaY = Math.max(bounds.top - y, 0, y - bounds.bottom);
    const forgiveness = Math.max(48, Math.min(96, Math.hypot(bounds.width, bounds.height) * 0.72))
      * (pointerType === "touch" || pointerType === "pen" ? 1.3 : 1);
    if (Math.hypot(deltaX, deltaY) <= forgiveness) placeAwareness();
  };
  const trackDrag = (event: DragEvent<HTMLElement>) => {
    if (!held) return;
    event.preventDefault();
    setCursor({ x: event.clientX, y: event.clientY, pointerType: "mouse" });
  };

  return <main className={`inventory-login-designer atlas-power-gate${held ? " is-holding-awareness" : ""}`} aria-label="Designer access" onDragOver={trackDrag} onDrop={(event) => { event.preventDefault(); placeNearSlot(event.clientX, event.clientY, "mouse"); }}>
    <h1 className="sr-only">Designer access</h1>
    {held ? <div className="inventory-login-designer__slot is-revealed" ref={slotRef}><InventorySlot definition={DESIGNER_RECEPTACLE} heldItem={{ definition: AWARENESS_ITEM, instance: AWARENESS_INSTANCE }} className="designer-slot" disabled={busy} onPlace={placeAwareness} onCancel={() => setMovement(cancelInventoryMovement())}><span className="atlas-designer-keyhole" aria-hidden="true" /></InventorySlot></div> : null}
    <div className="inventory-login-designer__item"><InventoryItemCard definition={AWARENESS_ITEM} instance={AWARENESS_INSTANCE} held={held} disabled={busy} cancelOnDragEnd={false} onPickUp={(_instanceId, pointer) => { if (pointer) setCursor({ x: pointer.x, y: pointer.y, pointerType: pointer.pointerType }); setMovement(pickUpInventoryItem(AWARENESS_INSTANCE)); }} onCancel={() => setMovement(cancelInventoryMovement())} /></div>
    {held ? <div className="inventory-cursor-item" style={{ left: cursor.x, top: cursor.y }} aria-hidden="true"><img src={AWARENESS_ITEM.iconPath} alt="" /></div> : null}
    {message || busy || held ? <p className="inventory-login-designer__hint" role={message ? "alert" : undefined}>{message ?? (busy ? "Preparing your Garden…" : "Place Awareness into the Designer Slot")}</p> : null}
  </main>;
}

function LoginPanel({ busy, message, onSubmit }: Readonly<{ busy: boolean; message: string | null; onSubmit: (identifier: string, password: string) => void }>) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  return <main className="atlas-login-stage"><form className="atlas-panel atlas-login-panel" onSubmit={(event: FormEvent) => { event.preventDefault(); const secret = password; setPassword(""); onSubmit(identifier, secret); }}><header className="atlas-panel-header"><div><span className="atlas-eyebrow">Identity</span><h1>Enter the Kingdom</h1></div></header><div className="atlas-panel-body"><p>The keyhole watches. Present yourself to enter Knowhere.</p><label>Account<input value={identifier} autoComplete="username" onChange={(event) => setIdentifier(event.target.value)} disabled={busy} /></label><label>Password<input value={password} type="password" autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} disabled={busy} /></label>{message ? <p className="dashboard-error" role="alert">{message}</p> : null}<button className="atlas-primary-button" type="submit" disabled={busy || !identifier || !password}>{busy ? "Checking…" : "Enter Knowhere"}</button></div></form></main>;
}

function SeatedAwareness({ disabled, onRemove }: Readonly<{ disabled: boolean; onRemove: () => void }>) {
  return <><button className="atlas-seated-awareness" type="button" disabled={disabled} onClick={onRemove} draggable={!disabled} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; }} onDragEnd={onRemove} aria-label="Remove Awareness and log out"><span className="atlas-seated-awareness__slot" aria-hidden="true"><img src={AWARENESS_ITEM.iconPath} alt="" /></span><span>{disabled ? "Closing the gate…" : "Remove Awareness"}</span></button>{disabled ? <span className="atlas-tube-close" aria-hidden="true" /> : null}</>;
}

export function App() {
  const [flow, setFlow] = useState<ClientFlowState>({ phase: "restoring" });
  const [gateUnlocked, setGateUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [poweringDown, setPoweringDown] = useState(false);
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const [hudProjection, setHudProjection] = useState<WorldHudProjectionV2 | null>(null);
  const [route, setRoute] = useState(window.location.pathname);
  const logoutInFlight = useRef<Promise<void> | null>(null);
  const gateway = useMemo(() => createGatewayClient(configuredGatewayUrl()), []);

  useEffect(() => { const update = () => setRoute(window.location.pathname); window.addEventListener("popstate", update); return () => window.removeEventListener("popstate", update); }, []);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("preview")) return; const controller = new AbortController(); void restore(controller.signal); return () => controller.abort(); }, []);
  useEffect(() => { if (flow.phase !== "world-ready") { setHudProjection(null); return; } const controller = new AbortController(); void gateway.getWorldHud(controller.signal).then((result) => { if (result.ok) setHudProjection(result.value); }); return () => controller.abort(); }, [flow.phase, gateway]);

  async function restore(signal?: AbortSignal) {
    setBusy(true); const result = await gateway.restoreSession(signal); setBusy(false);
    if (result.ok) {
      const prewarm = await gateway.prewarmGarden(signal);
      if (!prewarm.ok) { setFlow(gatewayFailure(prewarm, result.value)); return; }
      setGateUnlocked(true); await continueFromProjection(result.value); return;
    }
    if (result.code === "unauthenticated" || result.code === "session_expired") { setGateUnlocked(false); setFlow({ phase: "login", message: null }); return; }
    if (result.code !== "aborted") setFlow(gatewayFailure(result, null));
  }
  async function unlockGarden() { setBusy(true); setGateMessage(null); const result = await gateway.prewarmGarden(); setBusy(false); if (!result.ok) { setGateMessage("Your Garden could not be prepared yet. Try placing Awareness again."); return; } setGateUnlocked(true); setFlow({ phase: "login", message: null }); }
  async function continueFromProjection(projection: GatewaySessionProjection) { const next = stateFromSession(projection); if (next.phase !== "gateway-entry") { setFlow(next); return; } await enterGarden(next); }
  async function login(identifier: string, password: string) { setBusy(true); const result = await gateway.login(identifier, password); setBusy(false); if (result.ok) await continueFromProjection(result.value); else setFlow({ phase: "login", message: result.message }); }
  async function resume(projection: GatewaySessionProjection) { setBusy(true); const result = await gateway.resumeSession(); setBusy(false); if (result.ok) await continueFromProjection(result.value); else if (result.code === "unauthenticated" || result.code === "session_expired") { setGateUnlocked(false); setFlow({ phase: "login", message: "Your session expired. Present Awareness again." }); } else setFlow({ phase: "resume-required", projection, message: result.message }); }
  async function selectCharacter(projection: GatewaySessionProjection, characterId: string) { setBusy(true); const result = await gateway.selectCharacter(characterId, projection.selection.version); setBusy(false); if (result.ok) await continueFromProjection(result.value); else setFlow({ phase: "character-select", projection, message: result.message }); }
  async function enterGarden(state: Extract<ClientFlowState, { phase: "gateway-entry" }>) { setFlow(state); setBusy(true); const entry = await gateway.enterWorld("garden"); if (!entry.ok) { setBusy(false); setFlow(gatewayFailure(entry, state.projection)); return; } const bootstrapping = beginWorldBootstrap(state, entry.value); setFlow(bootstrapping); if (bootstrapping.phase !== "world-bootstrap") { setBusy(false); return; } const bootstrap = await gateway.getWorldBootstrap(); setBusy(false); setFlow(completeWorldBootstrap(bootstrapping, bootstrap.ok ? bootstrap.value : null)); }
  function navigate(path: string) { window.history.pushState({}, "", path); setRoute(path); }
  function logout() { if (logoutInFlight.current) return; setPoweringDown(true); logoutInFlight.current = (async () => { try { await Promise.all([gateway.logout(), new Promise((resolve) => window.setTimeout(resolve, 760))]); } finally { setFlow({ phase: "login", message: null }); setGateUnlocked(false); setPoweringDown(false); navigate("/"); logoutInFlight.current = null; } })(); }

  if (new URLSearchParams(window.location.search).get("preview") === "staxel-voxel-female") return <CharacterAssetPreview />;
  if (flow.phase === "restoring") return <main className="atlas-login-stage"><p aria-live="polite">Preparing Knowhere…</p></main>;
  if (!gateUnlocked) return <KeyGate busy={busy} message={gateMessage} onUnlock={() => void unlockGarden()} />;
  if (flow.phase === "login") return <><LoginPanel busy={busy} message={flow.message} onSubmit={(identifier, password) => void login(identifier, password)} /><SeatedAwareness disabled={poweringDown} onRemove={logout} /></>;

  const projection = "projection" in flow ? flow.projection : null;
  if (route.startsWith("/dashboard") && projection) return <><Dashboard projection={projection} onBack={() => navigate("/")} onLogout={logout} /><SeatedAwareness disabled={poweringDown} onRemove={logout} /></>;
  if (route === "/characters/new" && projection) return <><main className="atlas-login-stage"><section className="atlas-panel atlas-character-placeholder"><span className="atlas-eyebrow">Character creation</span><h1>Create a new character</h1><p>The character creator is being prepared. Your current spirit and character selection are unchanged.</p><button className="atlas-secondary-button" type="button" onClick={() => navigate("/")}>Back to characters</button></section></main><SeatedAwareness disabled={poweringDown} onRemove={logout} /></>;
  if (flow.phase === "resume-required") return <><main className="atlas-login-stage"><section className="atlas-panel"><h1>Resume Knowhere</h1><p>{flow.message ?? "Your authenticated spirit is idle."}</p><button className="atlas-primary-button" disabled={busy} onClick={() => void resume(flow.projection)}>Resume session</button></section></main><SeatedAwareness disabled={poweringDown} onRemove={logout} /></>;
  if (flow.phase === "character-select") return <><main className="atlas-login-stage"><section className="atlas-panel atlas-character-select"><header className="atlas-character-select__header"><span className="atlas-eyebrow">Your spirit</span><h1>Choose your character</h1><p>Your Garden is waking. Choose who will enter first.</p></header>{flow.message ? <p className="atlas-character-select__error" role="alert">{flow.message}</p> : null}<div className="atlas-character-grid">{flow.projection.selection.characters.map((character) => <button className="atlas-character-card" type="button" key={character.id} disabled={busy || !character.selectable} onClick={() => void selectCharacter(flow.projection, character.id)}><span className="atlas-character-card__sigil" aria-hidden="true">{character.displayName.trim().charAt(0).toUpperCase()}</span><span className="atlas-character-card__identity"><strong>{character.displayName}</strong><small>{character.archetype}</small></span><span className="atlas-character-card__action">{character.selectable ? "Enter Garden" : "Unavailable"}<span aria-hidden="true">→</span></span></button>)}</div><footer className="atlas-character-actions"><span>Another story is waiting?</span><a className="atlas-secondary-button" href="/characters/new" onClick={(event) => { event.preventDefault(); navigate("/characters/new"); }}>Create a new character</a></footer></section></main><SeatedAwareness disabled={poweringDown} onRemove={logout} /></>;
  if (flow.phase === "gateway-entry" || flow.phase === "world-bootstrap") return <><main className="atlas-login-stage"><p aria-live="polite">{flow.phase === "gateway-entry" ? "Requesting admission…" : "Loading the world…"}</p></main><SeatedAwareness disabled={poweringDown} onRemove={logout} /></>;
  if (flow.phase === "world-ready") { const selected = flow.projection.selection.characters.find((character) => character.id === flow.projection.selection.selectedCharacterId); return <main className={`app-shell${poweringDown ? " is-powering-down" : ""}`}><BabylonScene projection={flow.world.scene} /><KnowhereHud accountLabel={selected?.displayName ?? "Traveler"} projection={hudProjection} poweringDown={poweringDown} onInventoryMove={async(itemInstanceId,destination,expectedProjectionRevision)=>{const result=await gateway.moveInventory({itemInstanceId,destination,expectedProjectionRevision});if(!result.ok)return null;setHudProjection(result.value);return result.value;}} onLogout={logout} /><SeatedAwareness disabled={poweringDown} onRemove={logout} /></main>; }
  return <><main className="atlas-login-stage"><section className="atlas-panel" role="alert"><h1>Knowhere is unavailable</h1><p>{flow.message}</p><button className="atlas-secondary-button" onClick={() => void restore()}>Try again</button></section></main><SeatedAwareness disabled={poweringDown} onRemove={logout} /></>;
}
