import type { GatewaySessionProjection } from "../api/gateway-contract.ts";

export const SYSTEM_FLOW_VERSION = "system-theme.1" as const;

export type SystemStage =
  | "splash" | "identified" | "designer-ready" | "session-check"
  | "login" | "registering" | "recovering" | "connecting"
  | "character-select" | "character-create" | "garden-entry" | "garden";

export type SystemProgress = Readonly<{
  correlationId: string;
  sequence: number;
  percent: number;
  message: "Connecting to server" | "Message received" | "Entering Garden";
}>;

export type SystemFlowState = Readonly<{
  version: typeof SYSTEM_FLOW_VERSION;
  stage: SystemStage;
  generation: number;
  projection: GatewaySessionProjection | null;
  error: SystemSafeError | null;
  progress: SystemProgress | null;
}>;

export type SystemSafeError =
  | "credentials-denied" | "registration-denied" | "request-invalid"
  | "too-many-attempts" | "session-ended" | "service-unavailable"
  | "selection-changed" | "entry-denied";

export type SystemFlowEvent =
  | { type: "identify" }
  | { type: "hold-key" }
  | { type: "insert-key" }
  | { type: "session-anonymous"; generation: number }
  | { type: "session-ready"; generation: number; projection: GatewaySessionProjection }
  | { type: "show-register" }
  | { type: "show-recovery" }
  | { type: "show-login" }
  | { type: "connect" }
  | { type: "character-create" }
  | { type: "garden-entry" }
  | { type: "garden-ready"; generation: number }
  | { type: "failure"; generation: number; error: SystemSafeError }
  | { type: "progress"; generation: number; progress: SystemProgress }
  | { type: "remove-key" };

export const initialSystemFlowState: SystemFlowState = Object.freeze({
  version: SYSTEM_FLOW_VERSION,
  stage: "splash",
  generation: 0,
  projection: null,
  error: null,
  progress: null,
});

function stageForProjection(projection: GatewaySessionProjection): SystemStage {
  return projection.selection.canEnterWorld && projection.selection.selectedCharacterId
    ? "garden-entry"
    : "character-select";
}

export function reduceSystemFlow(state: SystemFlowState, event: SystemFlowEvent): SystemFlowState {
  if (event.type === "remove-key") {
    if (state.stage === "splash") return state;
    return { ...initialSystemFlowState, generation: state.generation + 1 };
  }
  if ("generation" in event && event.generation !== state.generation) return state;
  switch (event.type) {
    case "identify": return state.stage === "splash" ? { ...state, stage: "identified" } : state;
    case "hold-key": return state.stage === "identified" ? { ...state, stage: "designer-ready" } : state;
    case "insert-key": return state.stage === "designer-ready" ? { ...state, stage: "session-check", error: null } : state;
    case "session-anonymous": return state.stage === "session-check" ? { ...state, stage: "login" } : state;
    case "session-ready": return state.stage === "session-check" || state.stage === "connecting"
      ? { ...state, stage: stageForProjection(event.projection), projection: event.projection, error: null }
      : state;
    case "show-register": return state.stage === "login" ? { ...state, stage: "registering", error: null } : state;
    case "show-recovery": return state.stage === "login" ? { ...state, stage: "recovering", error: null } : state;
    case "show-login": return ["registering", "recovering"].includes(state.stage) ? { ...state, stage: "login", error: null } : state;
    case "connect": return ["login", "registering", "recovering"].includes(state.stage) ? { ...state, stage: "connecting", error: null } : state;
    case "character-create": return state.stage === "character-select" ? { ...state, stage: "character-create", error: null } : state;
    case "garden-entry": return ["character-select", "character-create"].includes(state.stage) ? { ...state, stage: "garden-entry", error: null } : state;
    case "garden-ready": return state.stage === "garden-entry" ? { ...state, stage: "garden", error: null } : state;
    case "failure": return { ...state, stage: state.stage === "connecting" ? "login" : state.stage, error: event.error, progress: null };
    case "progress": {
      const previous = state.progress;
      if (previous && (previous.correlationId !== event.progress.correlationId || event.progress.sequence <= previous.sequence || event.progress.percent < previous.percent)) return state;
      return { ...state, progress: event.progress };
    }
  }
}

const SAFE_ERROR_MAP: Readonly<Record<string, SystemSafeError>> = Object.freeze({
  invalid_credentials: "credentials-denied", registration_denied: "registration-denied",
  invalid_request: "request-invalid", rate_limited: "too-many-attempts",
  unauthenticated: "session-ended", session_expired: "session-ended",
  selection_conflict: "selection-changed", character_unavailable: "selection-changed",
  character_denied: "selection-changed", world_entry_denied: "entry-denied",
});

export function safeSystemError(code: string): SystemSafeError {
  return SAFE_ERROR_MAP[code] ?? "service-unavailable";
}
