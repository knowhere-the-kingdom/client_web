export const GATEWAY_PROTOCOL_VERSION = "1.0" as const;

export const GATEWAY_CLIENT_ROUTES = Object.freeze({
  health: "/v1/health",
  login: "/v1/session/login",
  logout: "/v1/session/logout",
  session: "/v1/session",
  resume: "/v1/session/resume",
  characterSelection: "/v1/accounts/character-selection",
  characters: "/v1/accounts/characters",
  worldPrewarm: "/v1/worlds/prewarm",
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
  authorization: AuthorizationProjection;
  requiresExplicitResume: boolean;
}>;

export type AuthorizationCapability = "admin.dashboard.read" | "world.designer.read" | "world.designer.write";
export type AuthorizationProjection = Readonly<{
  revision: number;
  capabilities: readonly AuthorizationCapability[];
}>;

export type GatewayItemDisplay =
  | Readonly<{ type: "icon"; assetId: string }>
  | Readonly<{ type: "model"; assetId: string; renderer: "babylon"; assetRevision: number }>;

export type GatewaySystemItem = Readonly<{
  definitionId: string;
  name: string;
  description: string;
  quality: number;
  footprint: Readonly<{ width: number; height: number }>;
  display: GatewayItemDisplay;
}>;

export type GatewayCharacter = Readonly<{
  id: string;
  displayName: string;
  bio: string;
  archetype: string;
  selectable: boolean;
  spiritSlot: number;
  itemInstanceId: string;
  level?: number;
  item: GatewaySystemItem;
}>;

export type GatewayAccountSoul = Readonly<{
  instanceId: string;
  displayName: string;
  item: GatewaySystemItem;
  stats: Readonly<{
    totalLoginSeconds: number;
    spiritLevel: number;
    characterCapacity: number;
  }>;
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
  accountSoul: GatewayAccountSoul;
}>;

export type CharacterCreationProjection = GatewaySessionProjection & Readonly<{
  createdCharacterId?: string;
}>;

export type GardenWorldPrewarm = Readonly<{
  worldId: "garden";
  status: "ready";
  sceneRevision: 1;
}>;

// World entry is mediated by the Gateway. The browser never receives an
// admission ticket, a tunnel URL, or a direct Gamemaster transport.
export type WorldEntry = Readonly<{ session: AuthSession }>;

export type GardenSceneProjectionV1 = Readonly<{
  schemaVersion: 1;
  sceneId: "garden-alpha-v1";
  voxelLandscape: Readonly<{
    kind: "flat-chunk-grid";
    voxelSizeMeters: 1;
    chunkSize: 16;
    chunkRadius: 14;
    diffuse: "#3f9b45";
    emissive: "#102d13";
    specular: "#17351a";
  }>;
  skybox: Readonly<{
    kind: "solid-color-sphere";
    diameter: 440;
    segments: 24;
    dayColor: "#55a9ed";
    nightColor: "#020718";
  }>;
  sun: Readonly<{
    kind: "orbiting-mythic-sun";
    assetId: "mythic-sun";
    assetVersion: 1;
    diameter: 52;
    quality: "medium";
    seed: 17;
    palette: Readonly<{
      heart: "#ffe29a";
      plasma: "#ff8a3d";
      ember: "#b84a32";
      shadow: "#3a1820";
    }>;
    dayDurationSeconds: number;
    nightDurationSeconds: number;
    cycleEpoch: string;
    cycleOffsetSeconds: number;
    scheduleRevision: number;
    sunlight: "#fff3d0";
    maxIntensity: 1.25;
  }>;
}>;

export type WorldHudBootstrap = Readonly<{
  schemaVersion: 1;
  worldSessionId: string;
  worldId: string;
  characterId: string;
  leaseExpiresAt: string;
  serverSnapshot: Readonly<{ contentRevision: number; contentHash: string }>;
  hudProjectionRevision: number;
  scene: GardenSceneProjectionV1;
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
    description: string;
    currentPlayerCount: number;
    previewItem: GatewaySystemItem;
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
  | "character_bio_invalid"
  | "character_capacity_reached"
  | "character_creation_unavailable"
  | "character_name_invalid"
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
  | "spirit_capacity_full"
  | "spirit_capacity_unavailable"
  | "unauthenticated"
  | "unknown_error"
  | "world_admission_routing_unconfigured"
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
