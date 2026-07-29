import type {
  GatewaySessionProjection,
  WorldEntry,
  WorldHudBootstrap,
  WorldDiscovery,
} from "../api/gateway-contract.ts";

export type ClientFlowState =
  | Readonly<{ phase: "restoring" }>
  | Readonly<{ phase: "login"; message: string | null }>
  | Readonly<{ phase: "resume-required"; projection: GatewaySessionProjection; message: string | null }>
  | Readonly<{ phase: "character-select"; projection: GatewaySessionProjection; message: string | null }>
  | Readonly<{ phase: "world-discovery"; projection: GatewaySessionProjection }>
  | Readonly<{
    phase: "ready-to-enter";
    projection: GatewaySessionProjection;
    discovery: WorldDiscovery;
    worldId: string;
  }>
  | Readonly<{
    phase: "gateway-entry";
    projection: GatewaySessionProjection;
    worldId: string;
  }>
  | Readonly<{
    phase: "world-bootstrap";
    projection: GatewaySessionProjection;
    worldId: string;
  }>
  | Readonly<{
    phase: "world-ready";
    projection: GatewaySessionProjection;
    world: WorldHudBootstrap;
  }>
  | Readonly<{
    phase: "error";
    boundary: "gateway" | "world-discovery" | "world-bootstrap" | "protocol";
    message: string;
    retryable: boolean;
    projection: GatewaySessionProjection | null;
  }>;

export function stateFromSession(projection: GatewaySessionProjection): ClientFlowState {
  if (
    projection.session.lifecycle === "idle-exited"
    || projection.session.requiresExplicitResume
  ) {
    return { phase: "resume-required", projection, message: null };
  }
  if (
    projection.selection.resumeStage === "character"
    || !projection.selection.canEnterWorld
    || !projection.selection.selectedCharacterId
  ) {
    return { phase: "character-select", projection, message: null };
  }
  return { phase: "world-discovery", projection };
}

export function stateFromWorldDiscovery(
  projection: GatewaySessionProjection,
  discovery: WorldDiscovery,
): ClientFlowState {
  const selectedWorld = discovery.worlds.find(
    (world) => world.id === discovery.defaultWorldId && world.available,
  );
  if (!discovery.defaultWorldId || !selectedWorld) {
    return {
      phase: "error",
      boundary: "world-discovery",
      message: "No approved local world is currently available.",
      retryable: true,
      projection,
    };
  }
  return {
    phase: "ready-to-enter",
    projection,
    discovery,
    worldId: selectedWorld.id,
  };
}

export function beginWorldEntry(
  state: ClientFlowState,
): ClientFlowState {
  if (state.phase !== "ready-to-enter") return state;
  return {
    phase: "gateway-entry",
    projection: state.projection,
    worldId: state.worldId,
  };
}

export function beginWorldBootstrap(
  state: ClientFlowState,
  entry: WorldEntry,
): ClientFlowState {
  if (state.phase !== "gateway-entry") return state;
  if (entry.session.lifecycle !== "active") {
    return {
      phase: "error",
      boundary: "protocol",
      message: "Gateway did not confirm an active session for world admission.",
      retryable: false,
      projection: state.projection,
    };
  }
  return {
    phase: "world-bootstrap",
    projection: state.projection,
    worldId: state.worldId,
  };
}

export function completeWorldBootstrap(
  state: ClientFlowState,
  result: WorldHudBootstrap | null,
): ClientFlowState {
  if (state.phase !== "world-bootstrap") return state;
  if (!result) {
    return {
      phase: "error",
      boundary: "world-bootstrap",
      message: "The approved Gateway world bootstrap was unavailable.",
      retryable: true,
      projection: state.projection,
    };
  }
  if (
    result.worldId !== state.worldId
    || result.characterId !== state.projection.selection.selectedCharacterId
  ) {
    return {
      phase: "error",
      boundary: "protocol",
      message: "Gateway bootstrap described a different world or character.",
      retryable: false,
      projection: state.projection,
    };
  }
  return {
    phase: "world-ready",
    projection: state.projection,
    world: result,
  };
}
