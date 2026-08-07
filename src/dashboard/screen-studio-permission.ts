import type { AuthorizationProjection } from "../api/gateway-contract.ts";
import type { PermissionGate } from "./screen-studio-model.ts";

export type ScreenStudioPermissionContext = Readonly<{
  authorization: AuthorizationProjection | null;
  expectedAuthorizationRevision: number;
  parentAuthorized: boolean;
}>;

export type ScreenStudioPermissionDecision = Readonly<{
  allowed: boolean;
  reason: "allowed" | "parent-route-denied" | "missing-authorization" | "stale-authorization" | "unknown-capability" | "unsupported-role-gate";
}>;

const KNOWN_CAPABILITIES = new Set(["admin.dashboard.read", "world.designer.read"]);

export function evaluateScreenStudioPermissionGate(gate: PermissionGate | undefined, context: ScreenStudioPermissionContext): ScreenStudioPermissionDecision {
  if (!context.parentAuthorized) return { allowed: false, reason: "parent-route-denied" };
  if (!context.authorization) return { allowed: false, reason: "missing-authorization" };
  if (!Number.isSafeInteger(context.authorization.revision) || context.authorization.revision !== context.expectedAuthorizationRevision) return { allowed: false, reason: "stale-authorization" };
  if (!gate) return { allowed: true, reason: "allowed" };
  if (gate.requiredRole) return { allowed: false, reason: "unsupported-role-gate" };
  if (!gate.requiredCapability || !KNOWN_CAPABILITIES.has(gate.requiredCapability)) return { allowed: false, reason: "unknown-capability" };
  return context.authorization.capabilities.includes(gate.requiredCapability as "admin.dashboard.read" | "world.designer.read")
    ? { allowed: true, reason: "allowed" }
    : { allowed: false, reason: "unknown-capability" };
}
