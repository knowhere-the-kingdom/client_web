import { useEffect, useMemo, useRef, useState } from "react";
import { createGatewayClient } from "./api/gateway-client";
import type { GatewayResult, GatewaySessionProjection, WorldHudProjectionV2 } from "./api/gateway-contract";
import { CharacterAssetPreview } from "./character-preview/CharacterAssetPreview";
import { Dashboard } from "./Dashboard";
import { BabylonScene } from "./scene/BabylonScene";
import { DesignerAwarenessSlot, KnowhereHud } from "./hud/KnowhereHud";
import { beginWorldBootstrap, completeWorldBootstrap, stateFromSession, type ClientFlowState } from "./session/client-flow";
import { SystemThemeExperience } from "./system-theme/SystemThemeExperience";

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

function SystemCharacterSelect({ projection, busy, message, onSelect, onCreate }: Readonly<{
  projection: GatewaySessionProjection;
  busy: boolean;
  message: string | null;
  onSelect: (characterId: string) => void;
  onCreate: () => void;
}>) {
  const positions = Array.from({ length: 4 }, (_, index) => projection.selection.characters[index] ?? null);
  return <main className="system-stage system-theme system-character-stage"><section className="system-panel system-character-panel"><header><span className="system-eyebrow">Spirit inventory</span><h1>Select Character</h1><p>Choose a character for your Garden.</p></header>{message ? <p className="system-error" role="alert">{message}</p> : null}<div className="system-character-grid">{positions.map((character, index) => character ? <button className="system-character-card" type="button" key={character.id} disabled={busy || !character.selectable} onClick={() => onSelect(character.id)}><span className="system-character-card__portrait" aria-hidden="true">{character.displayName.trim().charAt(0).toUpperCase()}</span><strong>{character.displayName}</strong><small>{character.archetype}</small></button> : <a className="system-character-card is-empty" href="/characters/new" key={`empty-${index}`} aria-disabled={busy} onClick={(event) => { event.preventDefault(); if (!busy) onCreate(); }}><span className="system-character-card__portrait" aria-hidden="true">+</span><strong>New Character</strong><small>Empty Spirit position</small></a>)}</div><a href="/characters/new" onClick={(event) => { event.preventDefault(); if (!busy) onCreate(); }}>Create a new character</a></section></main>;
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
  useEffect(() => { if (flow.phase !== "world-ready") { setHudProjection(null); return; } const controller = new AbortController(); void gateway.getWorldHud(controller.signal).then((result) => { if (result.ok) setHudProjection(result.value); }); return () => controller.abort(); }, [flow.phase, gateway]);

  async function restore(signal?: AbortSignal) {
    setBusy(true); const result = await gateway.restoreSession(signal); setBusy(false);
    if (result.ok) {
      setGateUnlocked(true); await continueFromProjection(result.value); return;
    }
    if (result.code === "unauthenticated" || result.code === "session_expired") { setGateUnlocked(false); setFlow({ phase: "login", message: null }); return; }
    if (result.code !== "aborted") setFlow(gatewayFailure(result, null));
  }
  async function continueFromProjection(projection: GatewaySessionProjection) { const next = stateFromSession(projection); if (next.phase !== "gateway-entry") { setFlow(next); return; } await enterGarden(next); }
  async function resume(projection: GatewaySessionProjection) { setBusy(true); const result = await gateway.resumeSession(); setBusy(false); if (result.ok) await continueFromProjection(result.value); else if (result.code === "unauthenticated" || result.code === "session_expired") { setGateUnlocked(false); setFlow({ phase: "login", message: "Your session expired. Present Awareness again." }); } else setFlow({ phase: "resume-required", projection, message: safeGatewayMessage(result.code) }); }
  async function selectCharacter(projection: GatewaySessionProjection, characterId: string) { setBusy(true); const result = await gateway.selectCharacter(characterId, projection.selection.version); setBusy(false); if (result.ok) await continueFromProjection(result.value); else setFlow({ phase: "character-select", projection, message: safeGatewayMessage(result.code) }); }
  async function enterGarden(state: Extract<ClientFlowState, { phase: "gateway-entry" }>) { setFlow(state); setBusy(true); const entry = await gateway.enterWorld("garden"); if (!entry.ok) { setBusy(false); setFlow(gatewayFailure(entry, state.projection)); return; } const bootstrapping = beginWorldBootstrap(state, entry.value); setFlow(bootstrapping); if (bootstrapping.phase !== "world-bootstrap") { setBusy(false); return; } let bootstrap = await gateway.getWorldBootstrap(); for (let attempt = 1; !bootstrap.ok && attempt < 4; attempt += 1) { await new Promise((resolve) => window.setTimeout(resolve, attempt * 350)); bootstrap = await gateway.getWorldBootstrap(); } setBusy(false); setFlow(completeWorldBootstrap(bootstrapping, bootstrap.ok ? bootstrap.value : null)); }
  function navigate(path: string) { window.history.pushState({}, "", path); setRoute(path); }
  function logout() { if (logoutInFlight.current) return; setPoweringDown(true); logoutInFlight.current = (async () => { const [result] = await Promise.all([gateway.logout(), new Promise((resolve) => window.setTimeout(resolve, 760))]); if (!result.ok) { setPoweringDown(false); setFlow(gatewayFailure(result, "projection" in flow ? flow.projection : null)); return; } setFlow({ phase: "login", message: null }); setGateUnlocked(false); setPoweringDown(false); navigate("/"); })().finally(() => { logoutInFlight.current = null; }); }

  if (new URLSearchParams(window.location.search).get("preview") === "staxel-voxel-female") return <CharacterAssetPreview />;
  if (!gateUnlocked || flow.phase === "restoring" || flow.phase === "login") return <SystemThemeExperience gateway={gateway} onSessionReady={async (projection, source, signal) => { if (signal.aborted) return; setGateUnlocked(true); if (source === "login") { setFlow({ phase: "character-select", projection, message: null }); return; } await continueFromProjection(projection); }} />;

  const projection = "projection" in flow ? flow.projection : null;
  if (route === "/characters/new" && projection) return <><main className="system-stage system-theme"><section className="system-panel"><span className="system-eyebrow">Spirit inventory</span><h1>Create a new character</h1><p>The character creator is being prepared. Your current Spirit inventory is unchanged.</p><button type="button" onClick={() => navigate("/")}>Back to characters</button></section></main><SeatedAwareness disabled={poweringDown} onRemove={logout} /></>;
  if (flow.phase === "resume-required") return <><main className="atlas-login-stage"><section className="atlas-panel"><h1>Resume Knowhere</h1><p>{flow.message ?? "Your authenticated spirit is idle."}</p><button className="atlas-primary-button" disabled={busy} onClick={() => void resume(flow.projection)}>Resume session</button></section></main><SeatedAwareness disabled={poweringDown} onRemove={logout} /></>;
  if (flow.phase === "character-select") return <><SystemCharacterSelect projection={flow.projection} busy={busy} message={flow.message} onSelect={(characterId) => void selectCharacter(flow.projection, characterId)} onCreate={() => navigate("/characters/new")} /><SeatedAwareness disabled={poweringDown} onRemove={logout} /></>;
  if (flow.phase === "gateway-entry" || flow.phase === "world-bootstrap") return <><main className="atlas-login-stage"><p aria-live="polite">{flow.phase === "gateway-entry" ? "Requesting admission…" : "Loading the world…"}</p></main><SeatedAwareness disabled={poweringDown} onRemove={logout} /></>;
  if (flow.phase === "world-ready") { const selected = flow.projection.selection.characters.find((character) => character.id === flow.projection.selection.selectedCharacterId); const dashboardOpen = route.startsWith("/dashboard"); return <main className={`app-shell${poweringDown ? " is-powering-down" : ""}${dashboardOpen ? " is-dashboard-open" : ""}`}><BabylonScene projection={flow.world.scene} worldIdentity={flow.world} interactive={!dashboardOpen} />{dashboardOpen ? <Dashboard projection={flow.projection} onBack={() => navigate("/")} onLogout={logout} /> : <KnowhereHud accountLabel={selected?.displayName ?? "Traveler"} settingsOwnerId={selected?.id ?? ""} projection={hudProjection} poweringDown={poweringDown} onOpenDashboard={() => navigate("/dashboard")} onInventoryMove={async(itemInstanceId,destination,expectedProjectionRevision)=>{const result=await gateway.moveInventory({itemInstanceId,destination,expectedProjectionRevision});if(!result.ok)return null;setHudProjection(result.value);return result.value;}} onLogout={logout} />}{poweringDown ? <span className="atlas-tube-close" aria-hidden="true" /> : null}</main>; }
  return <><main className="atlas-login-stage"><section className="atlas-panel" role="alert"><h1>Knowhere is unavailable</h1><p>{flow.message}</p><button className="atlas-secondary-button" onClick={() => void restore()}>Try again</button></section></main><SeatedAwareness disabled={poweringDown} onRemove={logout} /></>;
}
