export const GATEWAY_PROTOCOL_VERSION = "1.0.0";

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

export type GatewayClient = Readonly<{
  checkHealth(signal?: AbortSignal): Promise<Exclude<GatewayHealthStatus, { phase: "idle" | "checking" }>>;
}>;

function isGatewayHealth(value: unknown): value is GatewayHealth {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.service === "knowhere-gateway"
    && record.status === "ok"
    && typeof record.protocolVersion === "string"
    && typeof record.buildVersion === "string"
    && typeof record.startedAt === "string"
    && typeof record.uptimeSeconds === "number"
    && record.apiRelay === "not-probed";
}

function normalizeBaseUrl(value: string | URL): URL {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("The Gateway URL must use HTTP or HTTPS.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("The Gateway URL cannot contain credentials, query parameters, or fragments.");
  }
  return url;
}

export function createGatewayClient(
  baseUrl: string | URL,
  request: typeof fetch = fetch,
): GatewayClient {
  const healthUrl = new URL("/v1/health", normalizeBaseUrl(baseUrl));

  return {
    async checkHealth(signal) {
      try {
        const response = await request(healthUrl, {
          method: "GET",
          headers: { accept: "application/json" },
          signal,
        });
        if (!response.ok) return { phase: "unavailable", reason: "response" };

        const payload: unknown = await response.json();
        return isGatewayHealth(payload)
          ? { phase: "healthy", health: payload }
          : { phase: "unavailable", reason: "invalid-response" };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return { phase: "aborted" };
        return { phase: "unavailable", reason: "network" };
      }
    },
  };
}
