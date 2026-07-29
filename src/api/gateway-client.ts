import {
  GATEWAY_CLIENT_ROUTES,
  GATEWAY_PROTOCOL_VERSION,
  type AuthSession,
  type CharacterSelectionProjection,
  type GatewayCharacter,
  type GatewayErrorCode,
  type GatewayResult,
  type GatewaySessionProjection,
  type LogoutResult,
  type WorldEntry,
  type WorldHudBootstrap,
  type WorldDiscovery,
  type WorldHudProjectionV2,
  type InventoryMoveCommandV2,
} from "./gateway-contract.ts";

export type GatewayHealth = Readonly<{
  service: "knowhere-gateway";
  status: "ok";
  protocolVersion: string;
  buildVersion: string;
  startedAt: string;
  uptimeSeconds: number;
  apiRelay: "not-probed";
}>;

export type GatewayHealthStatus =
  | Readonly<{ phase: "idle" | "checking" }>
  | Readonly<{ phase: "healthy"; health: GatewayHealth }>
  | Readonly<{ phase: "unavailable"; reason: "network" | "response" | "invalid-response" }>
  | Readonly<{ phase: "aborted" }>;

export type GatewayClientOptions = Readonly<{
  readCsrfToken?: () => string | null;
}>;

export type GatewayClient = Readonly<{
  checkHealth(signal?: AbortSignal): Promise<Exclude<GatewayHealthStatus, { phase: "idle" | "checking" }>>;
  login(identifier: string, password: string, signal?: AbortSignal): Promise<GatewayResult<GatewaySessionProjection>>;
  logout(signal?: AbortSignal): Promise<GatewayResult<LogoutResult>>;
  restoreSession(signal?: AbortSignal): Promise<GatewayResult<GatewaySessionProjection>>;
  resumeSession(signal?: AbortSignal): Promise<GatewayResult<GatewaySessionProjection>>;
  getCharacterSelection(signal?: AbortSignal): Promise<GatewayResult<CharacterSelectionProjection>>;
  getWorlds(signal?: AbortSignal): Promise<GatewayResult<WorldDiscovery>>;
  selectCharacter(characterId: string, expectedSelectionVersion: number, signal?: AbortSignal): Promise<GatewayResult<GatewaySessionProjection>>;
  enterWorld(worldId: string, signal?: AbortSignal): Promise<GatewayResult<WorldEntry>>;
  getWorldBootstrap(signal?: AbortSignal): Promise<GatewayResult<WorldHudBootstrap>>;
  getWorldHud(signal?: AbortSignal): Promise<GatewayResult<WorldHudProjectionV2>>;
  moveInventory(command: InventoryMoveCommandV2, signal?: AbortSignal): Promise<GatewayResult<WorldHudProjectionV2>>;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isGatewayHealth(value: unknown): value is GatewayHealth {
  if (!isRecord(value)) return false;
  return value.service === "knowhere-gateway"
    && value.status === "ok"
    && typeof value.protocolVersion === "string"
    && typeof value.buildVersion === "string"
    && typeof value.startedAt === "string"
    && typeof value.uptimeSeconds === "number"
    && value.apiRelay === "not-probed";
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!isRecord(value)) return false;
  return value.authenticated === true
    && ["active", "idle-exited"].includes(String(value.lifecycle))
    && isString(value.expiresAt)
    && isNonNegativeInteger(value.authorizationRevision)
    && typeof value.requiresExplicitResume === "boolean";
}

function isGatewayCharacter(value: unknown): value is GatewayCharacter {
  if (!isRecord(value)) return false;
  return isString(value.id)
    && isString(value.displayName)
    && isString(value.archetype)
    && typeof value.selectable === "boolean";
}

function isCharacterSelection(value: unknown): value is CharacterSelectionProjection {
  if (!isRecord(value) || !isNonNegativeInteger(value.version)) return false;
  if (value.selectedCharacterId !== null && !isString(value.selectedCharacterId)) return false;
  if (!Array.isArray(value.characters) || !value.characters.every(isGatewayCharacter)) return false;
  return typeof value.canEnterWorld === "boolean"
    && ["character", "world-entry"].includes(String(value.resumeStage))
    && [null, "character_required", "character_denied"].includes(value.reason as null | string);
}

function isSessionProjection(value: unknown): value is GatewaySessionProjection {
  return isRecord(value)
    && isAuthSession(value.session)
    && isCharacterSelection(value.selection);
}

function isWorldDiscovery(value: unknown): value is WorldDiscovery {
  if (!isRecord(value) || !Array.isArray(value.worlds)) return false;
  if (value.defaultWorldId !== null && !isString(value.defaultWorldId)) return false;
  const worldsAreValid = value.worlds.every((world) =>
    isRecord(world)
    && isString(world.id)
    && isString(world.displayName)
    && typeof world.available === "boolean"
    && world.gameProtocolVersion === GATEWAY_PROTOCOL_VERSION
  );
  if (!worldsAreValid) return false;
  return value.defaultWorldId === null || value.worlds.some(
    (world) => world.id === value.defaultWorldId && world.available === true,
  );
}

function isWorldEntry(value: unknown): value is WorldEntry {
  return isRecord(value) && isAuthSession(value.session);
}

function isWorldBootstrap(value: unknown): value is WorldHudBootstrap {
  if (!isRecord(value) || !isRecord(value.serverSnapshot)) return false;
  return value.schemaVersion === 1
    && isString(value.worldSessionId)
    && isString(value.worldId)
    && isString(value.characterId)
    && isString(value.leaseExpiresAt)
    && isNonNegativeInteger(value.serverSnapshot.contentRevision)
    && isString(value.serverSnapshot.contentHash)
    && isNonNegativeInteger(value.hudProjectionRevision);
}

function isWorldHud(value: unknown): value is WorldHudProjectionV2 {
  return isRecord(value) && value.schemaVersion === 2 && value.source === "gamemaster" && isNonNegativeInteger(value.projectionRevision)
    && isRecord(value.meters) && isRecord(value.inventory) && Array.isArray(value.equipment) && Array.isArray(value.actionSlots)
    && Array.isArray(value.abilities) && isRecord(value.map) && Array.isArray(value.logs);
}

function isLogoutResult(value: unknown): value is LogoutResult {
  return isRecord(value)
    && value.revoked === true
    && isNonNegativeInteger(value.authorizationRevision);
}

function isSuccessEnvelope<T>(
  value: unknown,
  validate: (data: unknown) => data is T,
): value is { protocolVersion: typeof GATEWAY_PROTOCOL_VERSION; correlationId: string; data: T } {
  return isRecord(value)
    && value.protocolVersion === GATEWAY_PROTOCOL_VERSION
    && isString(value.correlationId)
    && validate(value.data);
}

const publicErrorCodes = new Set<GatewayErrorCode>([
  "account_denied", "character_denied", "character_selection_unavailable",
  "character_unavailable", "csrf_denied", "downstream_protocol_error",
  "downstream_timeout", "downstream_unavailable", "idempotency_conflict",
  "invalid_credentials", "invalid_request", "origin_denied",
  "protocol_unsupported", "rate_limited", "selection_conflict",
  "session_expired", "session_resume_required", "unauthenticated",
  "world_entry_denied",
]);

function parseErrorEnvelope(value: unknown): GatewayResult<never> | null {
  if (
    !isRecord(value)
    || value.protocolVersion !== GATEWAY_PROTOCOL_VERSION
    || !isString(value.correlationId)
    || !isRecord(value.error)
    || !isString(value.error.code)
    || !isString(value.error.message)
    || typeof value.error.retryable !== "boolean"
  ) {
    return null;
  }
  const code = publicErrorCodes.has(value.error.code as GatewayErrorCode)
    ? value.error.code as GatewayErrorCode
    : "unknown_error";
  return {
    ok: false,
    code,
    message: value.error.message,
    correlationId: value.correlationId,
    retryable: value.error.retryable,
    retryAfterSeconds: isNonNegativeInteger(value.error.retryAfterSeconds)
      ? value.error.retryAfterSeconds
      : null,
  };
}

function normalizeBaseUrl(value: string | URL): URL {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("The Gateway URL must use HTTP or HTTPS.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("The Gateway URL cannot contain credentials, query parameters, or fragments.");
  }
  const isPublicKnowhereGateway = url.origin === "https://matrix.knowhere.fyi";
  if (
    typeof window !== "undefined"
    && url.origin !== window.location.origin
    && !isPublicKnowhereGateway
  ) {
    throw new Error("The browser Gateway must use the current same-origin public surface.");
  }
  return url;
}

function requestId(): string {
  return crypto.randomUUID();
}

function configuredCsrfCookieName(): string | null {
  if (typeof document === "undefined") return null;
  const configured = document
    .querySelector<HTMLMetaElement>('meta[name="knowhere-csrf-cookie"]')
    ?.content.trim();
  if (configured) return configured;
  return "knowhere_csrf";
}

function readCookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`;
  const part = document.cookie.split(";").map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  if (!part) return null;
  const value = decodeURIComponent(part.slice(prefix.length));
  return value || null;
}

function defaultCsrfTokenReader(): string | null {
  const cookieName = configuredCsrfCookieName();
  return cookieName ? readCookie(cookieName) : null;
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function createGatewayClient(
  baseUrl: string | URL,
  request: typeof fetch = fetch,
  options: GatewayClientOptions = {},
): GatewayClient {
  const gatewayUrl = normalizeBaseUrl(baseUrl);
  const readCsrfToken = options.readCsrfToken ?? defaultCsrfTokenReader;

  async function invoke<T>(
    path: string,
    method: "GET" | "POST",
    body: Record<string, unknown> | null,
    validate: (value: unknown) => value is T,
    signal?: AbortSignal,
    authenticatedMutation = false,
  ): Promise<GatewayResult<T>> {
    const correlationId = requestId();
    const headers: Record<string, string> = {
      accept: "application/json",
      "x-correlation-id": correlationId,
      "x-knowhere-protocol-version": GATEWAY_PROTOCOL_VERSION,
    };
    if (method === "POST") {
      headers["content-type"] = "application/json";
      headers["idempotency-key"] = requestId();
    }
    if (authenticatedMutation) {
      const csrfToken = readCsrfToken();
      if (!csrfToken) {
        return {
          ok: false,
          code: "csrf_unavailable",
          message: "The authenticated request cannot be sent without the current CSRF token.",
          correlationId,
          retryable: false,
          retryAfterSeconds: null,
        };
      }
      headers["x-knowhere-csrf"] = csrfToken;
    }

    try {
      const response = await request(new URL(path, gatewayUrl), {
        method,
        credentials: "include",
        headers,
        body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
        signal,
      });
      const payload = await readJson(response);
      if (!response.ok) {
        return parseErrorEnvelope(payload) ?? {
          ok: false,
          code: "invalid_response",
          message: "Gateway returned an invalid error response.",
          correlationId,
          retryable: false,
          retryAfterSeconds: null,
        };
      }
      return isSuccessEnvelope(payload, validate)
        ? { ok: true, value: payload.data, correlationId: payload.correlationId }
        : {
          ok: false,
          code: "invalid_response",
          message: "Gateway returned an invalid success response.",
          correlationId,
          retryable: false,
          retryAfterSeconds: null,
        };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return {
          ok: false,
          code: "aborted",
          message: "The Gateway request was cancelled.",
          correlationId: null,
          retryable: false,
          retryAfterSeconds: null,
        };
      }
      return {
        ok: false,
        code: "network_error",
        message: "The Gateway could not be reached.",
        correlationId: null,
        retryable: true,
        retryAfterSeconds: null,
      };
    }
  }

  return {
    async checkHealth(signal) {
      try {
        const response = await request(new URL(GATEWAY_CLIENT_ROUTES.health, gatewayUrl), {
          method: "GET",
          credentials: "include",
          headers: {
            accept: "application/json",
            "x-knowhere-protocol-version": GATEWAY_PROTOCOL_VERSION,
          },
          signal,
        });
        if (!response.ok) return { phase: "unavailable", reason: "response" };
        const payload = await readJson(response);
        return isGatewayHealth(payload)
          ? { phase: "healthy", health: payload }
          : { phase: "unavailable", reason: "invalid-response" };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return { phase: "aborted" };
        return { phase: "unavailable", reason: "network" };
      }
    },
    login(identifier, password, signal) {
      return invoke(
        GATEWAY_CLIENT_ROUTES.login,
        "POST",
        { identifier, password },
        isSessionProjection,
        signal,
      );
    },
    logout(signal) {
      return invoke(GATEWAY_CLIENT_ROUTES.logout, "POST", {}, isLogoutResult, signal, true);
    },
    restoreSession(signal) {
      return invoke(GATEWAY_CLIENT_ROUTES.session, "GET", null, isSessionProjection, signal);
    },
    resumeSession(signal) {
      return invoke(GATEWAY_CLIENT_ROUTES.resume, "POST", {}, isSessionProjection, signal, true);
    },
    getCharacterSelection(signal) {
      return invoke(
        GATEWAY_CLIENT_ROUTES.characterSelection,
        "GET",
        null,
        isCharacterSelection,
        signal,
      );
    },
    getWorlds(signal) {
      return invoke(GATEWAY_CLIENT_ROUTES.worlds, "GET", null, isWorldDiscovery, signal);
    },
    selectCharacter(characterId, expectedSelectionVersion, signal) {
      return invoke(
        GATEWAY_CLIENT_ROUTES.characterSelection,
        "POST",
        { characterId, expectedSelectionVersion },
        isSessionProjection,
        signal,
        true,
      );
    },
    enterWorld(worldId, signal) {
      return invoke(
        GATEWAY_CLIENT_ROUTES.worldEntry,
        "POST",
        { worldId },
        isWorldEntry,
        signal,
        true,
      );
    },
    getWorldBootstrap(signal) {
      return invoke(GATEWAY_CLIENT_ROUTES.worldBootstrap, "GET", null, isWorldBootstrap, signal);
    },
    getWorldHud(signal) { return invoke(GATEWAY_CLIENT_ROUTES.worldHud, "GET", null, isWorldHud, signal); },
    moveInventory(command, signal) { return invoke(GATEWAY_CLIENT_ROUTES.inventoryMove, "POST", { ...command }, isWorldHud, signal, true); },
  };
}
