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
  return { phase: "error", boundary: "gateway", message: result.message || "Knowhere is not open yet.", retryable: result.retryable, projection };
}

function SeatedAwareness({ disabled, onRemove }: Readonly<{ disabled: boolean; onRemove: () => void }>) {
  return <><div className="atlas-seated-awareness"><DesignerAwarenessSlot disabled={disabled} onLogout={onRemove} /></div>{disabled ? <span className="atlas-tube-close" aria-hidden="true" /> : null}</>;
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
      const prewarm = await gateway.prewarmGarden(signal);
      if (!prewarm.ok) { setFlow(gatewayFailure(prewarm, result.value)); return; }
      setGateUnlocked(true); await continueFromProjection(result.value); return;
    }
    if (result.code === "unauthenticated" || result.code === "session_expired") { setGateUnlocked(false); setFlow({ phase: "login", message: null }); return; }
    if (result.code !== "aborted") setFlow(gatewayFailure(result, null));
  }
  async function continueFromProjection(projection: GatewaySessionProjection) { const next = stateFromSession(projection); if (next.phase !== "gateway-entry") { setFlow(next); return; } await enterGarden(next); }
  async function resume(projection: GatewaySessionProjection) { setBusy(true); const result = await gateway.resumeSession(); setBusy(false); if (result.ok) await continueFromProjection(result.value); else if (result.code === "unauthenticated" || result.code === "session_expired") { setGateUnlocked(false); setFlow({ phase: "login", message: "Your session expired. Present Awareness again." }); } else setFlow({ phase: "resume-required", projection, message: result.message }); }
  async function selectCharacter(projection: GatewaySessionProjection, characterId: string) { setBusy(true); const result = await gateway.selectCharacter(characterId, projection.selection.version); setBusy(false); if (result.ok) await continueFromProjection(result.value); else setFlow({ phase: "character-select", projection, message: result.message }); }
  async function enterGarden(state: Extract<ClientFlowState, { phase: "gateway-entry" }>) { setFlow(state); setBusy(true); const entry = await gateway.enterWorld("garden"); if (!entry.ok) { setBusy(false); setFlow(gatewayFailure(entry, state.projection)); return; } const bootstrapping = beginWorldBootstrap(state, entry.value); setFlow(bootstrapping); if (bootstrapping.phase !== "world-bootstrap") { setBusy(false); return; } const bootstrap = await gateway.getWorldBootstrap(); setBusy(false); setFlow(completeWorldBootstrap(bootstrapping, bootstrap.ok ? bootstrap.value : null)); }
  function navigate(path: string) { window.history.pushState({}, "", path); setRoute(path); }
  function logout() { if (logoutInFlight.current) return; setPoweringDown(true); logoutInFlight.current = (async () => { try { await Promise.all([gateway.logout(), new Promise((resolve) => window.setTimeout(resolve, 760))]); } finally { setFlow({ phase: "login", message: null }); setGateUnlocked(false); setPoweringDown(false); navigate("/"); logoutInFlight.current = null; } })(); }

  if (new URLSearchParams(window.location.search).get("preview") === "staxel-voxel-female") return <CharacterAssetPreview />;
  if (!gateUnlocked || flow.phase === "restoring" || flow.phase === "login") return <SystemThemeExperience gateway={gateway} onSessionReady={async (projection) => { setGateUnlocked(true); await continueFromProjection(projection); }} />;

  const projection = "projection" in flow ? flow.projection : null;
  if (route === "/characters/new" && projection) return <><main className="atlas-login-stage"><section className="atlas-panel atlas-character-placeholder"><span className="atlas-eyebrow">Character creation</span><h1>Create a new character</h1><p>The character creator is being prepared. Your current spirit and character selection are unchanged.</p><button className="atlas-secondary-button" type="button" onClick={() => navigate("/")}>Back to characters</button></section></main><SeatedAwareness disabled={poweringDown} onRemove={logout} /></>;
  if (flow.phase === "resume-required") return <><main className="atlas-login-stage"><section className="atlas-panel"><h1>Resume Knowhere</h1><p>{flow.message ?? "Your authenticated spirit is idle."}</p><button className="atlas-primary-button" disabled={busy} onClick={() => void resume(flow.projection)}>Resume session</button></section></main><SeatedAwareness disabled={poweringDown} onRemove={logout} /></>;
  if (flow.phase === "character-select") return <><main className="atlas-login-stage"><section className="atlas-panel atlas-character-select"><header className="atlas-character-select__header"><span className="atlas-eyebrow">Your spirit</span><h1>Choose your character</h1><p>Your Garden is waking. Choose who will enter first.</p></header>{flow.message ? <p className="atlas-character-select__error" role="alert">{flow.message}</p> : null}<div className="atlas-character-grid">{flow.projection.selection.characters.map((character) => <button className="atlas-character-card" type="button" key={character.id} disabled={busy || !character.selectable} onClick={() => void selectCharacter(flow.projection, character.id)}><span className="atlas-character-card__sigil" aria-hidden="true">{character.displayName.trim().charAt(0).toUpperCase()}</span><span className="atlas-character-card__identity"><strong>{character.displayName}</strong><small>{character.archetype}</small></span><span className="atlas-character-card__action">{character.selectable ? "Enter Garden" : "Unavailable"}<span aria-hidden="true">→</span></span></button>)}</div><footer className="atlas-character-actions"><span>Another story is waiting?</span><a className="atlas-secondary-button" href="/characters/new" onClick={(event) => { event.preventDefault(); navigate("/characters/new"); }}>Create a new character</a></footer></section></main><SeatedAwareness disabled={poweringDown} onRemove={logout} /></>;
  if (flow.phase === "gateway-entry" || flow.phase === "world-bootstrap") return <><main className="atlas-login-stage"><p aria-live="polite">{flow.phase === "gateway-entry" ? "Requesting admission…" : "Loading the world…"}</p></main><SeatedAwareness disabled={poweringDown} onRemove={logout} /></>;
  if (flow.phase === "world-ready") { const selected = flow.projection.selection.characters.find((character) => character.id === flow.projection.selection.selectedCharacterId); const dashboardOpen = route.startsWith("/dashboard"); return <main className={`app-shell${poweringDown ? " is-powering-down" : ""}${dashboardOpen ? " is-dashboard-open" : ""}`}><BabylonScene projection={flow.world.scene} worldIdentity={flow.world} interactive={!dashboardOpen} />{dashboardOpen ? <Dashboard projection={flow.projection} onBack={() => navigate("/")} onLogout={logout} /> : <KnowhereHud accountLabel={selected?.displayName ?? "Traveler"} settingsOwnerId={selected?.id ?? ""} projection={hudProjection} poweringDown={poweringDown} onOpenDashboard={() => navigate("/dashboard")} onInventoryMove={async(itemInstanceId,destination,expectedProjectionRevision)=>{const result=await gateway.moveInventory({itemInstanceId,destination,expectedProjectionRevision});if(!result.ok)return null;setHudProjection(result.value);return result.value;}} onLogout={logout} />}{poweringDown ? <span className="atlas-tube-close" aria-hidden="true" /> : null}</main>; }
  return <><main className="atlas-login-stage"><section className="atlas-panel" role="alert"><h1>Knowhere is unavailable</h1><p>{flow.message}</p><button className="atlas-secondary-button" onClick={() => void restore()}>Try again</button></section></main><SeatedAwareness disabled={poweringDown} onRemove={logout} /></>;
}
