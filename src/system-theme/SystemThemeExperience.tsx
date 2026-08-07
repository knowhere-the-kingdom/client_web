import { useEffect, useReducer, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent } from "react";
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

type TransferAnimation = Readonly<{
  kind: "pickup" | "place";
  from: Readonly<{ x: number; y: number }>;
  to: Readonly<{ x: number; y: number }>;
}>;

export function SystemThemeExperience({ gateway, onSessionReady }: Props) {
  const [flow, dispatch] = useReducer(reduceSystemFlow, initialSystemFlowState);
  const [movement, setMovement] = useState(EMPTY_INVENTORY_MOVEMENT);
  const [cursorPoint, setCursorPoint] = useState({ x: 0, y: 0 });
  const [looseKeyPoint, setLooseKeyPoint] = useState<Readonly<{ x: number; y: number }> | null>(null);
  const [closing, setClosing] = useState(false);
  const [qrSource, setQrSource] = useState("");
  const [transfer, setTransfer] = useState<TransferAnimation | null>(null);
  const request = useRef<AbortController | null>(null);
  const loginForm = useRef<HTMLFormElement | null>(null);
  const gameScreen = useRef<HTMLElement | null>(null);
  const designer = useRef<HTMLDivElement | null>(null);
  const transferTimer = useRef<number | null>(null);
  const removalInFlight = useRef(false);
  const generation = useRef(flow.generation);
  generation.current = flow.generation;
  const held = movement.heldInstanceId === AWARENESS_INSTANCE.instanceId;

  useEffect(() => () => {
    request.current?.abort();
    if (transferTimer.current !== null) window.clearTimeout(transferTimer.current);
  }, []);
  useEffect(() => {
    if (!held || transfer?.kind === "place") return;
    const followPointer = (event: PointerEvent) => setCursorPoint({ x: event.clientX, y: event.clientY });
    window.addEventListener("pointermove", followPointer);
    return () => window.removeEventListener("pointermove", followPointer);
  }, [held, transfer?.kind]);
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
  function finishInsertKey() {
    transferTimer.current = null;
    setMovement(EMPTY_INVENTORY_MOVEMENT);
    setTransfer(null);
    dispatch({ type: "insert-key" });
    void gateway.prewarmGarden();
    queueMicrotask(() => void checkSession());
  }
  function finishLooseDrop(point: Readonly<{ x: number; y: number }>) {
    transferTimer.current = null;
    const bounds = gameScreen.current?.getBoundingClientRect();
    setLooseKeyPoint(bounds ? { x: point.x - bounds.left, y: point.y - bounds.top } : point);
    setMovement(EMPTY_INVENTORY_MOVEMENT);
    setTransfer(null);
    dispatch({ type: "drop-key" });
  }
  function dropKeyOnGameScreen(event: MouseEvent<HTMLElement>) {
    if (!held || transfer) return;
    if (event.target instanceof Element && event.target.closest(".system-designer")) return;
    const point = { x: event.clientX, y: event.clientY };
    setTransfer({ kind: "place", from: cursorPoint, to: point });
    if (transferTimer.current !== null) window.clearTimeout(transferTimer.current);
    transferTimer.current = window.setTimeout(() => finishLooseDrop(point), 220);
  }
  function insertKey() {
    if (transfer || !placeHeldInventoryItem(movement, AWARENESS_INSTANCE, true).ok) return;
    const target = designer.current?.querySelector(".system-designer__slot")?.getBoundingClientRect();
    if (!target) return finishInsertKey();
    const from = cursorPoint;
    const to = { x: target.left + target.width / 2, y: target.top + target.height / 2 };
    setTransfer({ kind: "place", from, to });
    transferTimer.current = window.setTimeout(finishInsertKey, 220);
  }
  function cancelMovement() {
    if (transferTimer.current !== null) window.clearTimeout(transferTimer.current);
    transferTimer.current = null;
    setTransfer(null);
    setMovement(cancelInventoryMovement());
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
  if (flow.stage === "splash" || flow.stage === "identified" || flow.stage === "designer-ready") return <main className="system-stage system-theme system-splash" ref={gameScreen} onClick={dropKeyOnGameScreen}>
    <h1 className="sr-only">{flow.stage === "splash" ? "Unknown item" : "Awareness"}</h1>{held ? <div className="system-designer" ref={designer}><InventorySlot definition={DESIGNER_RECEPTACLE} heldItem={{ definition: AWARENESS_ITEM, instance: AWARENESS_INSTANCE }} className="designer-slot system-designer__slot" onPlace={insertKey} onCancel={() => { cancelMovement(); dispatch({ type: "identify" }); }} /><span className="system-designer__label">Designer</span></div> : null}
    <div
      className={`system-key ${flow.stage === "splash" ? "is-unknown" : "is-identified"}${looseKeyPoint ? " is-positioned" : ""}`}
      style={looseKeyPoint ? { left: looseKeyPoint.x, top: looseKeyPoint.y } : undefined}
      data-quality={flow.stage === "splash" ? undefined : "8"}
      data-quality-state={held ? "held" : "reveal"}
    ><InventoryItemCard definition={AWARENESS_ITEM} instance={AWARENESS_INSTANCE} held={held} cancelOnDragEnd={false} showTooltip={flow.stage !== "splash"} onPickUp={(_, pointer) => {
      if (flow.stage === "splash") {
        dispatch({ type: "identify" });
        return;
      }
      const target = pointer ? { x: pointer.x, y: pointer.y } : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      const source = document.querySelector(".system-key .inventory-item")?.getBoundingClientRect();
      setCursorPoint(target);
      setTransfer({
        kind: "pickup",
        from: source ? { x: source.left + source.width / 2, y: source.top + source.height / 2 } : target,
        to: target,
      });
      if (transferTimer.current !== null) window.clearTimeout(transferTimer.current);
      transferTimer.current = window.setTimeout(() => {
        transferTimer.current = null;
        setTransfer(null);
      }, 220);
      setMovement(pickUpInventoryItem(AWARENESS_INSTANCE));
      dispatch({ type: "hold-key" });
    }} onCancel={cancelMovement} /></div>
    {held ? <div
      className={`inventory-cursor-item system-key-cursor${transfer ? ` is-${transfer.kind}-transfer` : ""}`}
      style={{
        left: transfer?.kind === "place" ? transfer.from.x : cursorPoint.x,
        top: transfer?.kind === "place" ? transfer.from.y : cursorPoint.y,
        "--transfer-dx": `${transfer ? transfer.to.x - transfer.from.x : 0}px`,
        "--transfer-dy": `${transfer ? transfer.to.y - transfer.from.y : 0}px`,
      } as CSSProperties}
      aria-label="Cursor inventory: Awareness"
    ><img src={AWARENESS_ITEM.iconPath} alt="" /></div> : null}
  </main>;

  const panel = flow.stage === "registering" ? <section><h1>Register</h1><p>Registration is unavailable until the required phone-based contract is approved.</p><button type="button" onClick={() => dispatch({ type: "show-login" })}>Back to login</button></section>
    : flow.stage === "recovering" ? <section><h1>Recover access</h1><p>Recovery is unavailable until its generic Gateway acknowledgement and delivery contract are approved.</p><button type="button" onClick={() => dispatch({ type: "show-login" })}>Back to login</button></section>
    : flow.stage === "character-select" ? <section><h1>Select Character</h1><p>Preparing your server-confirmed Spirit inventory.</p></section>
    : flow.stage === "character-create" ? <section><h1>Create Character</h1><p>Character creation requires a server-confirmed profile and ownership projection. No request is mounted.</p></section>
    : flow.stage === "login" ? <form className="system-login-form" ref={loginForm} onSubmit={login}>
      <header className="system-login-heading"><span>System Access</span><h1>KNOWHERE</h1><i aria-hidden="true" /></header>
      {flow.error ? <p className="system-error system-login-error" role="alert">{safeCopy[flow.error]}</p> : null}
      <label className="system-login-field"><span className="system-field-icon is-user" aria-hidden="true" /><input name="username" required autoComplete="username" placeholder="Username" aria-label="Username" /></label>
      <label className="system-login-field"><span className="system-field-icon is-lock" aria-hidden="true" /><input name="password" type="password" required autoComplete="current-password" placeholder="Password" aria-label="Password" /></label>
      <button className="system-login-submit" type="submit">LOGIN</button>
      <div className="system-login-utility"><label className="system-check"><input name="remember" type="checkbox" disabled /> Remember me</label><button type="button" disabled title="Recovery is not configured">Forgot Password?</button></div>
      <div className="system-divider" aria-hidden="true"><i />◇<i /></div>
      <div className="system-login-secondary">
        <div><button className="system-discord-button" type="button" disabled title="Discord state and PKCE handshake is not configured"><span className="system-discord-mark" aria-hidden="true" />Login with Discord</button><button className="system-register-button" type="button" disabled title="Registration is not configured">Register</button></div>
        <a className="system-qr" href="https://knowhere.fyi" aria-label="Placeholder QR code linking to Knowhere dot FYI">
          <small><i aria-hidden="true" />Scan to Login<i aria-hidden="true" /></small>
          {qrSource ? <img src={qrSource} alt="QR code for https://knowhere.fyi" /> : <span aria-hidden="true">Generating QR…</span>}
        </a>
      </div>
    </form>
    : <section className="system-login-progress" aria-live="polite">
      <span className="system-login-progress__eyebrow">System Access</span>
      <h1>{flow.stage === "session-check" ? "Checking session" : flow.stage === "garden-entry" ? "Preparing Garden" : "Connecting"}</h1>
      <div className="system-login-progress__status">
        <p>{flow.stage === "garden-entry" ? "Confirming your server-selected Garden." : flow.progress?.message ?? "Connecting to server"}</p>
        <output aria-label="Login progress">{flow.progress?.percent ?? 10}%</output>
      </div>
      <progress max="100" value={flow.progress?.percent ?? 10} />
    </section>;
  return <main className="system-stage"><div className="system-access-shell"><button className="system-seated-key" onClick={() => void removeKey()}><img src={AWARENESS_ITEM.iconPath} alt="" /><span className="sr-only">Remove Awareness and log out</span></button><div className="system-panel">{panel}{flow.stage !== "login" && flow.error ? <p className="system-error" role="alert">{safeCopy[flow.error]}</p> : null}</div></div>{closing ? <span className="system-tube-close" /> : null}</main>;
}
