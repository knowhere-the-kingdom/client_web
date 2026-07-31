import { useEffect, useReducer, useRef, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import type { GatewayClient } from "../api/gateway-client.ts";
import type { GatewaySessionProjection } from "../api/gateway-contract.ts";
import { InventoryItemCard, InventorySlot } from "../inventory/InventoryPrimitives.tsx";
import { AWARENESS_INSTANCE, AWARENESS_ITEM, DESIGNER_RECEPTACLE } from "../inventory/inventory-model.ts";
import { EMPTY_INVENTORY_MOVEMENT, cancelInventoryMovement, pickUpInventoryItem, placeHeldInventoryItem } from "../inventory/inventory-movement.ts";
import { initialSystemFlowState, reduceSystemFlow, safeSystemError, type SystemSafeError } from "./system-flow.ts";
import "../theme/system-theme.css";
import "./system-flow.css";

const safeCopy: Readonly<Record<SystemSafeError, string>> = {
  "credentials-denied": "Those details could not be accepted.", "registration-denied": "Registration could not be completed.",
  "request-invalid": "Check the details and try again.", "too-many-attempts": "Please wait before trying again.",
  "session-ended": "Your session has ended. Please log in again.", "service-unavailable": "Knowhere is unavailable right now.",
  "selection-changed": "Your character selection changed. Please choose again.", "entry-denied": "Garden entry is unavailable right now.",
};

type Props = Readonly<{
  gateway: GatewayClient;
  onSessionReady: (projection: GatewaySessionProjection, source: "restore" | "login", signal: AbortSignal) => void | Promise<void>;
}>;

export function SystemThemeExperience({ gateway, onSessionReady }: Props) {
  const [flow, dispatch] = useReducer(reduceSystemFlow, initialSystemFlowState);
  const [movement, setMovement] = useState(EMPTY_INVENTORY_MOVEMENT);
  const [cursorPoint, setCursorPoint] = useState({ x: 0, y: 0 });
  const [closing, setClosing] = useState(false);
  const [qrSource, setQrSource] = useState("");
  const request = useRef<AbortController | null>(null);
  const loginForm = useRef<HTMLFormElement | null>(null);
  const removalInFlight = useRef(false);
  const generation = useRef(flow.generation);
  generation.current = flow.generation;
  const held = movement.heldInstanceId === AWARENESS_INSTANCE.instanceId;

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!held) return;
    const followPointer = (event: PointerEvent) => setCursorPoint({ x: event.clientX, y: event.clientY });
    window.addEventListener("pointermove", followPointer);
    return () => window.removeEventListener("pointermove", followPointer);
  }, [held]);
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL("https://knowhere.fyi", {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 184,
      color: { dark: "#061014", light: "#f8ffff" },
    }).then((source) => {
      if (active) setQrSource(source);
    });
    return () => { active = false; };
  }, []);
  const beginRequest = () => { request.current?.abort(); const controller = new AbortController(); request.current = controller; return { controller, generation: generation.current }; };
  const fail = (g: number, code: string) => dispatch({ type: "failure", generation: g, error: safeSystemError(code) });
  const progress = (g: number, correlationId: string, sequence: number, percent: number, message: "Connecting to server" | "Message received" | "Entering Garden") => dispatch({ type: "progress", generation: g, progress: { correlationId, sequence, percent, message } });

  async function acceptSession(projection: Parameters<typeof onSessionReady>[0], source: "restore" | "login", controller: AbortController) {
    if (controller.signal.aborted) return;
    await onSessionReady(projection, source, controller.signal);
  }

  async function checkSession() {
    const { controller, generation: g } = beginRequest();
    const result = await gateway.restoreSession(controller.signal);
    if (controller.signal.aborted) return;
    if (result.ok) await acceptSession(result.value, "restore", controller);
    else if (["unauthenticated", "session_expired"].includes(result.code)) dispatch({ type: "session-anonymous", generation: g });
    else fail(g, result.code);
  }
  function insertKey() {
    if (!placeHeldInventoryItem(movement, AWARENESS_INSTANCE, true).ok) return;
    setMovement(EMPTY_INVENTORY_MOVEMENT);
    dispatch({ type: "insert-key" });
    void gateway.prewarmGarden();
    queueMicrotask(() => void checkSession());
  }
  async function removeKey() {
    if (removalInFlight.current) return;
    removalInFlight.current = true;
    loginForm.current?.reset();
    request.current?.abort(); setClosing(true);
    const g = generation.current;
    const result = await gateway.logout();
    if (!result.ok) { setClosing(false); removalInFlight.current = false; fail(g, result.code); return; }
    setMovement(EMPTY_INVENTORY_MOVEMENT); dispatch({ type: "remove-key" });
    window.setTimeout(() => { setClosing(false); removalInFlight.current = false; }, 320);
  }
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); form.reset(); const { controller, generation: g } = beginRequest();
    dispatch({ type: "connect" }); const correlationId = crypto.randomUUID(); progress(g, correlationId, 1, 20, "Connecting to server");
    const result = await gateway.login(String(data.get("username") ?? ""), String(data.get("password") ?? ""), controller.signal);
    if (controller.signal.aborted) return; if (!result.ok) return fail(g, result.code);
    progress(g, correlationId, 2, 100, "Message received"); await acceptSession(result.value, "login", controller);
  }
  if (flow.stage === "splash" || flow.stage === "identified" || flow.stage === "designer-ready") return <main className="system-stage system-theme system-splash">
    <h1 className="sr-only">Unknown item</h1>{held ? <div className="system-designer"><InventorySlot definition={DESIGNER_RECEPTACLE} heldItem={{ definition: AWARENESS_ITEM, instance: AWARENESS_INSTANCE }} className="designer-slot system-designer__slot" onPlace={insertKey} onCancel={() => { setMovement(cancelInventoryMovement()); dispatch({ type: "identify" }); }} /><span className="system-designer__label">Designer</span></div> : null}
    <div className={`system-key ${flow.stage === "splash" ? "is-unknown" : "is-identified"}`} data-quality={flow.stage === "splash" ? undefined : "8"} data-quality-state={held ? "held" : "reveal"}><InventoryItemCard definition={AWARENESS_ITEM} instance={AWARENESS_INSTANCE} held={held} cancelOnDragEnd={false} showTooltip={flow.stage !== "splash"} onPickUp={(_, pointer) => {
      setCursorPoint(pointer ? { x: pointer.x, y: pointer.y } : { x: window.innerWidth / 2, y: window.innerHeight / 2 });
      setMovement(pickUpInventoryItem(AWARENESS_INSTANCE));
      dispatch({ type: "identify" });
      queueMicrotask(() => dispatch({ type: "hold-key" }));
    }} onCancel={() => setMovement(cancelInventoryMovement())} /></div>
    {held ? <div className="inventory-cursor-item system-key-cursor" style={{ left: cursorPoint.x, top: cursorPoint.y }} aria-label="Cursor inventory: Awareness"><img src={AWARENESS_ITEM.iconPath} alt="" /></div> : null}
  </main>;

  const panel = flow.stage === "registering" ? <section><h1>Register</h1><p>Registration is unavailable until the required phone-based contract is approved.</p><button type="button" onClick={() => dispatch({ type: "show-login" })}>Back to login</button></section>
    : flow.stage === "recovering" ? <section><h1>Recover access</h1><p>Recovery is unavailable until its generic Gateway acknowledgement and delivery contract are approved.</p><button type="button" onClick={() => dispatch({ type: "show-login" })}>Back to login</button></section>
    : flow.stage === "character-select" ? <section><h1>Select Character</h1><p>The four-position Spirit projection is not available yet. No positions have been inferred from the current character list.</p></section>
    : flow.stage === "character-create" ? <section><h1>Create Character</h1><p>Character creation requires a server-confirmed profile and ownership projection. No request is mounted.</p></section>
    : flow.stage === "login" ? <form className="system-login-form" ref={loginForm} onSubmit={login}>
      <header className="system-login-heading"><span>System Access</span><h1>KNOWHERE</h1><i aria-hidden="true" /></header>
      <label className="system-login-field"><span aria-hidden="true">●</span><input name="username" required autoComplete="username" placeholder="Username" aria-label="Username" /></label>
      <label className="system-login-field"><span aria-hidden="true">◆</span><input name="password" type="password" required autoComplete="current-password" placeholder="Password" aria-label="Password" /></label>
      <button className="system-login-submit" type="submit">LOGIN</button>
      <div className="system-login-utility"><label className="system-check"><input name="remember" type="checkbox" disabled /> Remember me</label><button type="button" disabled title="Recovery is not configured">Forgot Password?</button></div>
      <div className="system-divider" aria-hidden="true"><i />◇<i /></div>
      <div className="system-login-secondary">
        <div><button type="button" disabled title="Discord state and PKCE handshake is not configured">Login with Discord</button><button type="button" disabled title="Registration is not configured">Register</button></div>
        <a className="system-qr" href="https://knowhere.fyi" aria-label="Placeholder QR code linking to Knowhere dot FYI">
          <small>Scan to Login</small>
          {qrSource ? <img src={qrSource} alt="QR code for https://knowhere.fyi" /> : <span aria-hidden="true">Generating QR…</span>}
        </a>
      </div>
    </form>
    : <section aria-live="polite"><h1>{flow.stage === "session-check" ? "Checking session" : flow.stage === "garden-entry" ? "Garden entry unavailable" : "Connecting"}</h1><progress max="100" value={flow.progress?.percent ?? 10} /><p>{flow.stage === "garden-entry" ? "Waiting for the reviewed server-selected Garden contract." : flow.progress?.message ?? "Connecting to server"}</p></section>;
  return <main className="system-stage"><div className="system-access-shell"><button className="system-seated-key" onClick={() => void removeKey()}><img src={AWARENESS_ITEM.iconPath} alt="" /><span className="sr-only">Remove Awareness and log out</span></button><div className="system-panel">{panel}{flow.error ? <p className="system-error" role="alert">{safeCopy[flow.error]}</p> : null}</div></div>{closing ? <span className="system-tube-close" /> : null}</main>;
}
