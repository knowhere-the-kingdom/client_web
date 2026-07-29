import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createGatewayClient } from "./api/gateway-client";
import type { GatewayResult, GatewaySessionProjection, WorldHudProjectionV2 } from "./api/gateway-contract";
import { CharacterAssetPreview } from "./character-preview/CharacterAssetPreview";
import { Dashboard } from "./Dashboard";
import { BabylonScene } from "./scene/BabylonScene";
import { KnowhereHud } from "./hud/KnowhereHud";
import { InventoryItemCard, InventorySlot } from "./inventory/InventoryPrimitives";
import { AWARENESS_INSTANCE, AWARENESS_ITEM, DESIGNER_RECEPTACLE } from "./inventory/inventory-model";
import { EMPTY_INVENTORY_MOVEMENT, cancelInventoryMovement, pickUpInventoryItem, placeHeldInventoryItem } from "./inventory/inventory-movement";
import { beginWorldBootstrap, beginWorldEntry, completeWorldBootstrap, stateFromSession, stateFromWorldDiscovery, type ClientFlowState } from "./session/client-flow";

function configuredGatewayUrl(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="knowhere-gateway-url"]')?.content.trim() || window.location.origin;
}

function gatewayFailure(result: Exclude<GatewayResult<unknown>, { ok: true }>, projection: GatewaySessionProjection | null): ClientFlowState {
  return { phase: "error", boundary: "gateway", message: result.message || "Knowhere is not open yet.", retryable: result.retryable, projection };
}

function KeyGate({ onUnlock }: Readonly<{ onUnlock: () => void }>) {
  const [movement, setMovement] = useState(EMPTY_INVENTORY_MOVEMENT);
  return <main className="inventory-login-designer atlas-power-gate" aria-label="Designer access">
    <h1 className="sr-only">Designer access</h1>
    <div className="inventory-login-designer__item"><InventoryItemCard definition={AWARENESS_ITEM} instance={AWARENESS_INSTANCE} held={movement.heldInstanceId === AWARENESS_INSTANCE.instanceId} onPickUp={() => setMovement(pickUpInventoryItem(AWARENESS_INSTANCE))} onCancel={() => setMovement(cancelInventoryMovement())} /></div>
    <div className="inventory-login-designer__slot"><InventorySlot definition={DESIGNER_RECEPTACLE} heldItem={movement.heldInstanceId ? { definition: AWARENESS_ITEM, instance: AWARENESS_INSTANCE } : null} className="designer-slot" onPlace={() => { const placed = placeHeldInventoryItem(movement, AWARENESS_INSTANCE, true); if (placed.ok) { setMovement(placed.state); onUnlock(); } }} onCancel={() => setMovement(cancelInventoryMovement())}><span className="atlas-designer-keyhole" aria-hidden="true" /></InventorySlot></div>
    <p className="inventory-login-designer__hint">Move Awareness into the Designer Slot</p>
  </main>;
}

function LoginPanel({ busy, message, onSubmit }: Readonly<{ busy: boolean; message: string | null; onSubmit: (identifier: string, password: string) => void }>) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  return <main className="atlas-login-stage"><form className="atlas-panel atlas-login-panel" onSubmit={(event: FormEvent) => { event.preventDefault(); const secret = password; setPassword(""); onSubmit(identifier, secret); }}><header className="atlas-panel-header"><div><span className="atlas-eyebrow">Identity</span><h1>Enter the Kingdom</h1></div></header><div className="atlas-panel-body"><p>The keyhole watches. Present yourself to enter Knowhere.</p><label>Account<input value={identifier} autoComplete="username" onChange={(event) => setIdentifier(event.target.value)} disabled={busy} /></label><label>Password<input value={password} type="password" autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} disabled={busy} /></label>{message ? <p className="dashboard-error" role="alert">{message}</p> : null}<button className="atlas-primary-button" type="submit" disabled={busy || !identifier || !password}>{busy ? "Checking…" : "Enter Knowhere"}</button></div></form></main>;
}

function SeatedAwareness({ disabled, onRemove }: Readonly<{ disabled: boolean; onRemove: () => void }>) {
  return <button className="atlas-seated-awareness" type="button" disabled={disabled} onClick={onRemove} draggable={!disabled} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; }} onDragEnd={onRemove} aria-label="Remove Awareness and log out"><img src={AWARENESS_ITEM.iconPath} alt="" /><span>{disabled ? "Powering down" : "Remove key · Log out"}</span></button>;
}

export function App() {
  const [flow, setFlow] = useState<ClientFlowState>({ phase: "restoring" });
  const [gateUnlocked, setGateUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [poweringDown, setPoweringDown] = useState(false);
  const [hudProjection, setHudProjection] = useState<WorldHudProjectionV2 | null>(null);
  const [route, setRoute] = useState(window.location.pathname);
  const logoutInFlight = useRef<Promise<void> | null>(null);
  const gateway = useMemo(() => createGatewayClient(configuredGatewayUrl()), []);

  useEffect(() => { const update = () => setRoute(window.location.pathname); window.addEventListener("popstate", update); return () => window.removeEventListener("popstate", update); }, []);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("preview")) return; const controller = new AbortController(); void restore(controller.signal); return () => controller.abort(); }, []);
  useEffect(() => { if (flow.phase !== "world-ready") { setHudProjection(null); return; } const controller = new AbortController(); void gateway.getWorldHud(controller.signal).then((result) => { if (result.ok) setHudProjection(result.value); }); return () => controller.abort(); }, [flow.phase, gateway]);

  async function restore(signal?: AbortSignal) {
    setBusy(true); const result = await gateway.restoreSession(signal); setBusy(false);
    if (result.ok) { setGateUnlocked(true); setFlow(stateFromSession(result.value)); return; }
    if (result.code === "unauthenticated" || result.code === "session_expired") { setGateUnlocked(false); setFlow({ phase: "login", message: null }); return; }
    if (result.code !== "aborted") setFlow(gatewayFailure(result, null));
  }
  async function login(identifier: string, password: string) { setBusy(true); const result = await gateway.login(identifier, password); setBusy(false); if (result.ok) setFlow(stateFromSession(result.value)); else setFlow({ phase: "login", message: result.message }); }
  async function resume(projection: GatewaySessionProjection) { setBusy(true); const result = await gateway.resumeSession(); setBusy(false); if (result.ok) setFlow(stateFromSession(result.value)); else if (result.code === "unauthenticated" || result.code === "session_expired") { setGateUnlocked(false); setFlow({ phase: "login", message: "Your session expired. Present Awareness again." }); } else setFlow({ phase: "resume-required", projection, message: result.message }); }
  async function selectCharacter(projection: GatewaySessionProjection, characterId: string) { setBusy(true); const result = await gateway.selectCharacter(characterId, projection.selection.version); setBusy(false); if (result.ok) setFlow(stateFromSession(result.value)); else setFlow({ phase: "character-select", projection, message: result.message }); }
  async function discoverWorld(projection: GatewaySessionProjection) { setBusy(true); const result = await gateway.getWorlds(); setBusy(false); if (result.ok) setFlow(stateFromWorldDiscovery(projection, result.value)); else setFlow({ phase: "error", boundary: "world-discovery", message: result.message, retryable: result.retryable, projection }); }
  async function enterWorld(state: Extract<ClientFlowState, { phase: "ready-to-enter" }>) { const entering = beginWorldEntry(state); setFlow(entering); setBusy(true); const entry = await gateway.enterWorld(state.worldId); if (!entry.ok) { setBusy(false); setFlow(gatewayFailure(entry, state.projection)); return; } const bootstrapping = beginWorldBootstrap(entering, entry.value); setFlow(bootstrapping); if (bootstrapping.phase !== "world-bootstrap") { setBusy(false); return; } const bootstrap = await gateway.getWorldBootstrap(); setBusy(false); setFlow(completeWorldBootstrap(bootstrapping, bootstrap.ok ? bootstrap.value : null)); }
  function navigate(path: string) { window.history.pushState({}, "", path); setRoute(path); }
  function logout() { if (logoutInFlight.current) return; setPoweringDown(true); logoutInFlight.current = (async () => { try { await Promise.all([gateway.logout(), new Promise((resolve) => window.setTimeout(resolve, 760))]); } finally { setFlow({ phase: "login", message: null }); setGateUnlocked(false); setPoweringDown(false); navigate("/"); logoutInFlight.current = null; } })(); }

  if (new URLSearchParams(window.location.search).get("preview") === "staxel-voxel-female") return <CharacterAssetPreview />;
  if (flow.phase === "restoring") return <main className="atlas-login-stage"><p aria-live="polite">Preparing Knowhere…</p></main>;
  if (!gateUnlocked) return <KeyGate onUnlock={() => { setGateUnlocked(true); setFlow({ phase: "login", message: null }); }} />;
  if (flow.phase === "login") return <LoginPanel busy={busy} message={flow.message} onSubmit={(identifier, password) => void login(identifier, password)} />;

  const projection = "projection" in flow ? flow.projection : null;
  if (route.startsWith("/dashboard") && projection) return <Dashboard projection={projection} onBack={() => navigate("/")} onLogout={logout} />;
  if (route === "/characters/new" && projection) return <main className="atlas-login-stage"><section className="atlas-panel atlas-character-placeholder"><span className="atlas-eyebrow">Character creation</span><h1>Create a new character</h1><p>The character creator is being prepared. Your current spirit and character selection are unchanged.</p><button className="atlas-secondary-button" type="button" onClick={() => navigate("/")}>Back to characters</button></section></main>;
  if (flow.phase === "resume-required") return <main className="atlas-login-stage"><section className="atlas-panel"><h1>Resume Knowhere</h1><p>{flow.message ?? "Your authenticated spirit is idle."}</p><button className="atlas-primary-button" disabled={busy} onClick={() => void resume(flow.projection)}>Resume session</button></section></main>;
  if (flow.phase === "character-select") return <main className="atlas-login-stage"><section className="atlas-panel"><h1>Choose your character</h1>{flow.message ? <p role="alert">{flow.message}</p> : null}<div className="atlas-list">{flow.projection.selection.characters.map((character) => <button className="atlas-list-row" key={character.id} disabled={busy || !character.selectable} onClick={() => void selectCharacter(flow.projection, character.id)}><strong>{character.displayName}</strong><small>{character.archetype}</small></button>)}</div><div className="atlas-character-actions"><a className="atlas-secondary-button" href="/characters/new" onClick={(event) => { event.preventDefault(); navigate("/characters/new"); }}>Create a new character</a></div></section></main>;
  if (flow.phase === "world-discovery") return <main className="atlas-login-stage"><section className="atlas-panel"><h1>Enter the Garden</h1><button className="atlas-primary-button" disabled={busy} onClick={() => void discoverWorld(flow.projection)}>Find available world</button></section></main>;
  if (flow.phase === "ready-to-enter") return <main className="atlas-login-stage"><section className="atlas-panel"><h1>{flow.discovery.worlds.find((world) => world.id === flow.worldId)?.displayName}</h1><button className="atlas-primary-button" disabled={busy} onClick={() => void enterWorld(flow)}>Enter world</button></section></main>;
  if (flow.phase === "gateway-entry" || flow.phase === "world-bootstrap") return <main className="atlas-login-stage"><p aria-live="polite">{flow.phase === "gateway-entry" ? "Requesting admission…" : "Loading the world…"}</p></main>;
  if (flow.phase === "world-ready") { const selected = flow.projection.selection.characters.find((character) => character.id === flow.projection.selection.selectedCharacterId); return <main className={`app-shell${poweringDown ? " is-powering-down" : ""}`}><BabylonScene /><KnowhereHud accountLabel={selected?.displayName ?? "Traveler"} projection={hudProjection} poweringDown={poweringDown} onInventoryMove={async(itemInstanceId,destination,expectedProjectionRevision)=>{const result=await gateway.moveInventory({itemInstanceId,destination,expectedProjectionRevision});if(!result.ok)return null;setHudProjection(result.value);return result.value;}} onLogout={logout} /><SeatedAwareness disabled={poweringDown} onRemove={logout} /></main>; }
  return <main className="atlas-login-stage"><section className="atlas-panel" role="alert"><h1>Knowhere is unavailable</h1><p>{flow.message}</p><button className="atlas-secondary-button" onClick={() => void restore()}>Try again</button></section></main>;
}
