export const GATEWAY_PROTOCOL_VERSION = "1.0" as const;

export const GATEWAY_CLIENT_ROUTES = Object.freeze({
  health: "/v1/health",
  login: "/v1/session/login",
  logout: "/v1/session/logout",
  session: "/v1/session",
  resume: "/v1/session/resume",
  characterSelection: "/v1/accounts/character-selection",
  worlds: "/v1/worlds",
  worldEntry: "/v1/worlds/entry",
  worldBootstrap: "/v1/worlds/bootstrap",
  worldHud: "/v1/worlds/hud",
  inventoryMove: "/v1/worlds/inventory/move",
});

export type AuthSession = Readonly<{
  authenticated: true;
  lifecycle: "active" | "idle-exited";
  expiresAt: string;
  authorizationRevision: number;
  requiresExplicitResume: boolean;
}>;

export type GatewayCharacter = Readonly<{
  id: string;
  displayName: string;
  archetype: string;
  selectable: boolean;
}>;

export type CharacterSelectionProjection = Readonly<{
  version: number;
  selectedCharacterId: string | null;
  characters: readonly GatewayCharacter[];
  canEnterWorld: boolean;
  resumeStage: "character" | "world-entry";
  reason: "character_required" | "character_denied" | null;
}>;

export type GatewaySessionProjection = Readonly<{
  session: AuthSession;
  selection: CharacterSelectionProjection;
}>;

// World entry is mediated by the Gateway. The browser never receives an
// admission ticket, a tunnel URL, or a direct Gamemaster transport.
export type WorldEntry = Readonly<{ session: AuthSession }>;

export type WorldHudBootstrap = Readonly<{
  schemaVersion: 1;
  worldSessionId: string;
  worldId: string;
  characterId: string;
  leaseExpiresAt: string;
  serverSnapshot: Readonly<{ contentRevision: number; contentHash: string }>;
  hudProjectionRevision: number;
}>;

export type WorldHudProjectionV2 = Readonly<{
  schemaVersion: 2;
  projectionRevision: number;
  source: "gamemaster";
  meters: Readonly<{ health: Readonly<{ current:number; max:number }>; spirit: Readonly<{ current:number; max:number }> }>;
  inventory: Readonly<{ definitions: readonly unknown[]; instances: readonly unknown[]; placements: readonly unknown[] }>;
  equipment: readonly unknown[];
  actionSlots: readonly unknown[];
  abilities: readonly unknown[];
  map: Readonly<{ markers: readonly unknown[] }>;
  logs: readonly unknown[];
}>;

export type InventoryMoveCommandV2 = Readonly<{ itemInstanceId:string; destination:Readonly<Record<string,unknown>>; expectedProjectionRevision:number }>;

export type WorldDiscovery = Readonly<{
  defaultWorldId: string | null;
  worlds: readonly Readonly<{
    id: string;
    displayName: string;
    available: boolean;
    gameProtocolVersion: typeof GATEWAY_PROTOCOL_VERSION;
  }>[];
}>;

export type LogoutResult = Readonly<{
  revoked: true;
  authorizationRevision: number;
}>;

export type GatewayErrorCode =
  | "aborted"
  | "account_denied"
  | "character_denied"
  | "character_selection_unavailable"
  | "character_unavailable"
  | "csrf_denied"
  | "csrf_unavailable"
  | "downstream_protocol_error"
  | "downstream_timeout"
  | "downstream_unavailable"
  | "idempotency_conflict"
  | "invalid_credentials"
  | "invalid_request"
  | "invalid_response"
  | "network_error"
  | "origin_denied"
  | "protocol_unsupported"
  | "rate_limited"
  | "selection_conflict"
  | "session_expired"
  | "session_resume_required"
  | "unauthenticated"
  | "unknown_error"
  | "world_entry_denied";

export type GatewayResult<T> =
  | Readonly<{
    ok: true;
    value: T;
    correlationId: string;
  }>
  | Readonly<{
    ok: false;
    code: GatewayErrorCode;
    message: string;
    correlationId: string | null;
    retryable: boolean;
    retryAfterSeconds: number | null;
  }>;
