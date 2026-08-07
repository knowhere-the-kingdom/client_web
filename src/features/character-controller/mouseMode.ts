export type GameplayMouseMode = "free" | "captured";

export type GameplayMouseModeState = Readonly<{
  requestedMode: GameplayMouseMode;
  actualMode: GameplayMouseMode;
  pointerLocked: boolean;
  freeDragActive: boolean;
  suppressPointerActionsUntil: number;
}>;

export type GameplayPointerDecision = Readonly<{
  allowGameplayAction: boolean;
  lookDelta: Readonly<{ x: number; y: number }> | null;
}>;

const SUPPRESS_DOUBLE_CLICK_ACTION_MS = 360;

function isHTMLElement(value: EventTarget | null): value is HTMLElement {
  return typeof HTMLElement !== "undefined" && value instanceof HTMLElement;
}

export function isGameplayMouseExcludedTarget(target: EventTarget | null) {
  if (!isHTMLElement(target)) return false;
  const tagName = target.tagName;
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target.isContentEditable) return true;
  return Boolean(target.closest("[role='dialog'], [role='menu'], [data-rebinding='true'], .settings-panel, .rebind-prompt, .atlas-modal, .player-map-panel"));
}

export class GameplayMouseModeController {
  private state: GameplayMouseModeState = {
    requestedMode: "free",
    actualMode: "free",
    pointerLocked: false,
    freeDragActive: false,
    suppressPointerActionsUntil: 0,
  };
  private lastFreeDragPoint: Readonly<{ x: number; y: number }> | null = null;

  getSnapshot = () => this.state;

  handleTabToggle(event: KeyboardEvent, canvas: HTMLCanvasElement | null, blocked = false) {
    if (event.key !== "Tab" || event.repeat || blocked || !canvas || isGameplayMouseExcludedTarget(event.target)) return false;
    event.preventDefault();
    event.stopPropagation();
    if (document.pointerLockElement === canvas) {
      this.patch({ requestedMode: "free" });
      document.exitPointerLock();
      return true;
    }
    this.patch({ requestedMode: "captured" });
    canvas.requestPointerLock();
    return true;
  }

  handleEscape(event: KeyboardEvent, canvas: HTMLCanvasElement | null) {
    if (event.key !== "Escape" || !canvas || document.pointerLockElement !== canvas) return false;
    event.preventDefault();
    this.patch({ requestedMode: "free" });
    document.exitPointerLock();
    return true;
  }

  reconcilePointerLock(canvas: HTMLCanvasElement | null) {
    const pointerLocked = Boolean(canvas && document.pointerLockElement === canvas);
    this.patch({
      actualMode: pointerLocked ? "captured" : "free",
      requestedMode: pointerLocked ? "captured" : "free",
      pointerLocked,
      freeDragActive: pointerLocked ? false : this.state.freeDragActive,
    });
    if (pointerLocked) this.lastFreeDragPoint = null;
  }

  handlePointerDown(event: MouseEvent, canvas: HTMLCanvasElement | null, now = performance.now()): GameplayPointerDecision {
    if (!canvas || isGameplayMouseExcludedTarget(event.target) || event.button !== 0) return { allowGameplayAction: this.state.pointerLocked, lookDelta: null };
    if (this.state.pointerLocked) {
      return {
        allowGameplayAction: now >= this.state.suppressPointerActionsUntil,
        lookDelta: null,
      };
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.detail >= 2) {
      this.patch({
        requestedMode: "captured",
        freeDragActive: false,
        suppressPointerActionsUntil: now + SUPPRESS_DOUBLE_CLICK_ACTION_MS,
      });
      this.lastFreeDragPoint = null;
      canvas.requestPointerLock();
      return { allowGameplayAction: false, lookDelta: null };
    }
    this.lastFreeDragPoint = this.readClientPoint(event);
    this.patch({ requestedMode: "free", actualMode: "free", pointerLocked: false, freeDragActive: true });
    return { allowGameplayAction: false, lookDelta: null };
  }

  handleDoubleClick(event: MouseEvent, canvas: HTMLCanvasElement | null, now = performance.now()) {
    if (!canvas || isGameplayMouseExcludedTarget(event.target) || event.button !== 0 || this.state.pointerLocked) return false;
    event.preventDefault();
    event.stopPropagation();
    this.lastFreeDragPoint = null;
    this.patch({
      requestedMode: "captured",
      freeDragActive: false,
      suppressPointerActionsUntil: now + SUPPRESS_DOUBLE_CLICK_ACTION_MS,
    });
    canvas.requestPointerLock();
    return true;
  }

  handlePointerMove(event: MouseEvent): GameplayPointerDecision {
    if (!this.state.pointerLocked && !this.state.freeDragActive) return { allowGameplayAction: false, lookDelta: null };
    if (this.state.pointerLocked) {
      return { allowGameplayAction: false, lookDelta: { x: event.movementX, y: event.movementY } };
    }

    const movementX = Number.isFinite(event.movementX) ? event.movementX : 0;
    const movementY = Number.isFinite(event.movementY) ? event.movementY : 0;
    const currentPoint = this.readClientPoint(event);
    const previousPoint = this.lastFreeDragPoint;
    const shouldUseClientDelta = movementX === 0 && movementY === 0 && currentPoint !== null && previousPoint !== null;
    const lookDelta = shouldUseClientDelta
      ? { x: currentPoint.x - previousPoint.x, y: currentPoint.y - previousPoint.y }
      : { x: movementX, y: movementY };
    if (currentPoint) this.lastFreeDragPoint = currentPoint;
    return { allowGameplayAction: false, lookDelta };
  }

  handlePointerUp(event: MouseEvent) {
    if (event.button !== 0 || !this.state.freeDragActive) return false;
    this.lastFreeDragPoint = null;
    this.patch({ freeDragActive: false });
    return true;
  }

  cancelFreeDrag() {
    if (!this.state.freeDragActive) return false;
    this.lastFreeDragPoint = null;
    this.patch({ freeDragActive: false });
    return true;
  }

  private readClientPoint(event: MouseEvent) {
    const clientX = event.clientX;
    const clientY = event.clientY;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
    return { x: clientX, y: clientY };
  }

  private patch(next: Partial<GameplayMouseModeState>) {
    const previous = this.state;
    this.state = { ...this.state, ...next };
    if (previous.actualMode === this.state.actualMode && previous.requestedMode === this.state.requestedMode && previous.pointerLocked === this.state.pointerLocked && previous.freeDragActive === this.state.freeDragActive) return;
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("knowhere:gameplay-mouse-mode", { detail: this.state }));
  }
}

export const gameplayMouseMode = new GameplayMouseModeController();
