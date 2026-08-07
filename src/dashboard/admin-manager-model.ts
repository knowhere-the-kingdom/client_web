import type { AuthorizationCapability, AuthorizationProjection } from "../api/gateway-contract.ts";

export const ADMIN_MANAGER_CONTRACT = "AdminManagerReadV1" as const;
export const ADMIN_MANAGER_CONTRACT_VERSION = 1 as const;
export const ADMIN_MANAGER_CAPABILITY: AuthorizationCapability = "admin.dashboard.read";
export const ADMIN_MANAGER_RECORD_LIMIT = 100;
export const ADMIN_MANAGER_REFERENCE_LIMIT = 100;
export const ADMIN_MANAGER_LABEL_LIMIT = 16;
export const ADMIN_MANAGER_ERROR_CODES = ["unauthorized", "stale-authorization", "unavailable", "invalid-projection"] as const;
export const ADMIN_MANAGER_CAPABILITIES = ["admin.dashboard.read", "world.designer.read"] as const satisfies readonly AuthorizationCapability[];
export const ADMIN_MANAGER_STATUSES = ["active", "draft", "review", "system", "suspended", "planned"] as const;

export type AdminManagerKind = "users" | "groups" | "roles" | "permissions";
export type AdminRecordStatus = "active" | "draft" | "review" | "system" | "suspended" | "planned";
export type AdminMutationState = "disabled" | "local-draft";

export type AdminAuditSummary = Readonly<{
  revision: number;
  state: "server-projected" | "local-fixture" | "local-draft";
  source: "gateway" | "local-fixture" | "session-draft";
}>;

type AdminRecordBase = Readonly<{
  id: string;
  displayName: string;
  status: AdminRecordStatus;
  summary: string;
  referenceLabels: readonly string[];
  revision: number;
  audit: AdminAuditSummary;
  mutation: AdminMutationState;
}>;

export type AdminUserRecord = AdminRecordBase & Readonly<{
  kind: "user";
  roleRefs: readonly string[];
  groupRefs: readonly string[];
  capabilityRefs: readonly AuthorizationCapability[];
}>;

export type AdminGroupRecord = AdminRecordBase & Readonly<{
  kind: "group";
  memberRefs: readonly string[];
  roleRefs: readonly string[];
  scope: "global" | "world" | "content" | "self";
}>;

export type AdminRoleRecord = AdminRecordBase & Readonly<{
  kind: "role";
  canonicalRole: string;
  capabilityRefs: readonly AuthorizationCapability[];
  memberCount: number;
}>;

export type AdminPermissionRecord = AdminRecordBase & Readonly<{
  kind: "permission";
  capability: AuthorizationCapability;
  subjectKind: "user" | "group" | "role";
  resource: string;
  action: "read";
  description: string;
  scope: "global" | "world" | "content" | "self";
}>;

export type AdminManagerRecord = AdminUserRecord | AdminGroupRecord | AdminRoleRecord | AdminPermissionRecord;

type AdminManagerWireRecord = Omit<AdminManagerRecord, "mutation">;

export type AdminManagerGatewayProjection = Readonly<{
  contract: typeof ADMIN_MANAGER_CONTRACT;
  version: typeof ADMIN_MANAGER_CONTRACT_VERSION;
  authorizationRevision: number;
  manager: AdminManagerKind;
  records: readonly AdminManagerWireRecord[];
}>;

export type AdminManagerProjection = Readonly<{
  contract: typeof ADMIN_MANAGER_CONTRACT;
  version: typeof ADMIN_MANAGER_CONTRACT_VERSION;
  authorizationRevision: number;
  manager: AdminManagerKind;
  records: readonly AdminManagerRecord[];
}>;

export type AdminManagerReadError = Readonly<{
  contract: typeof ADMIN_MANAGER_CONTRACT;
  version: typeof ADMIN_MANAGER_CONTRACT_VERSION;
  error: Readonly<{
    code: typeof ADMIN_MANAGER_ERROR_CODES[number];
    message: string;
  }>;
}>;

const audit = (state: AdminAuditSummary["state"]): AdminAuditSummary => ({ revision: 1, state, source: state === "server-projected" ? "gateway" : state === "local-draft" ? "session-draft" : "local-fixture" });
const base = (id: string, displayName: string, status: AdminRecordStatus, summary: string, referenceLabels: readonly string[] = []): AdminRecordBase => ({ id, displayName, status, summary, referenceLabels, revision: 1, audit: audit("local-fixture"), mutation: "disabled" });

export const ADMIN_MANAGER_FIXTURES: Readonly<Record<AdminManagerKind, readonly AdminManagerRecord[]>> = Object.freeze({
  users: Object.freeze([
    { ...base("user-testadmin", "Test Admin", "active", "Local development account with explicit Administrator and World Designer projections.", ["source: local-dev-seed-v1", "session revision: server-owned"]), kind: "user", roleRefs: ["administrator", "world-designer", "user"], groupRefs: [], capabilityRefs: ["admin.dashboard.read", "world.designer.read"] },
    { ...base("user-testuser", "Test User", "active", "Local development account with player-only presentation access.", ["source: local-dev-seed-v1"]), kind: "user", roleRefs: ["user"], groupRefs: [], capabilityRefs: [] },
  ] as readonly AdminUserRecord[]),
  groups: Object.freeze([
    { ...base("group-keepers", "The Keepers", "draft", "Local draft group for audited administrative membership review.", ["scope: global"]), kind: "group", memberRefs: [], roleRefs: ["administrator"], scope: "global" },
    { ...base("group-world-builders", "World Builders", "draft", "Local draft group for world-content authoring review.", ["scope: content"]), kind: "group", memberRefs: [], roleRefs: ["world-designer"], scope: "content" },
  ] as readonly AdminGroupRecord[]),
  roles: Object.freeze([
    { ...base("role-administrator", "Administrator", "system", "Canonical administrative read role; no implicit owner or mutation bypass.", ["canonical role: administrator"]), kind: "role", canonicalRole: "administrator", capabilityRefs: ["admin.dashboard.read"], memberCount: 1 },
    { ...base("role-world-designer", "World Designer", "system", "Canonical Creator read role for reviewed Screen Studio and world-content projections.", ["canonical role: world-designer"]), kind: "role", canonicalRole: "world-designer", capabilityRefs: ["world.designer.read"], memberCount: 1 },
    { ...base("role-user", "User", "system", "Self-service role with no administrative capability.", ["canonical role: user"]), kind: "role", canonicalRole: "user", capabilityRefs: [], memberCount: 2 },
  ] as readonly AdminRoleRecord[]),
  permissions: Object.freeze([
    { ...base("permission-admin-dashboard-read", "Administrator dashboard read", "system", "Allowlisted capability for read-only administrative projections.", ["subject: role:administrator"]), kind: "permission", capability: "admin.dashboard.read", subjectKind: "role", resource: "admin.dashboard", action: "read", description: "Read administrative manager projections.", scope: "global" },
    { ...base("permission-world-designer-read", "World Designer read", "system", "Allowlisted capability for Creator read-only projections.", ["subject: role:world-designer"]), kind: "permission", capability: "world.designer.read", subjectKind: "role", resource: "world.designer", action: "read", description: "Read reviewed Screen Studio projections.", scope: "content" },
  ] as readonly AdminPermissionRecord[]),
});

const CAPABILITIES = new Set<AuthorizationCapability>(ADMIN_MANAGER_CAPABILITIES);
const STATUSES = new Set<AdminRecordStatus>(ADMIN_MANAGER_STATUSES);

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === allowed.length && keys.every((key, index) => key === [...allowed].sort()[index]);
}

function safeRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function safeText(value: unknown, maximum = 256): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum && value.trim() === value;
}

function capabilityList(value: unknown): value is readonly AuthorizationCapability[] {
  return Array.isArray(value) && value.length <= CAPABILITIES.size && new Set(value).size === value.length
    && value.every((entry) => typeof entry === "string" && CAPABILITIES.has(entry as AuthorizationCapability));
}

function safeTextList(value: unknown, maximum = ADMIN_MANAGER_REFERENCE_LIMIT): value is readonly string[] {
  return Array.isArray(value) && value.length <= maximum && value.every((entry) => safeText(entry));
}

function baseRecord(value: Record<string, unknown>, expectedKind: AdminManagerRecord["kind"]): boolean {
  const extraKeys = expectedKind === "user" ? ["roleRefs", "groupRefs", "capabilityRefs"] : expectedKind === "group" ? ["memberRefs", "roleRefs", "scope"] : expectedKind === "role" ? ["canonicalRole", "capabilityRefs", "memberCount"] : ["capability", "subjectKind", "resource", "action", "description", "scope"];
  return exactKeys(value, ["id", "displayName", "status", "summary", "referenceLabels", "revision", "audit", "kind", ...extraKeys])
    && value.kind === expectedKind && safeText(value.id) && safeText(value.displayName) && STATUSES.has(value.status as AdminRecordStatus)
    && safeText(value.summary, 1024) && safeTextList(value.referenceLabels, ADMIN_MANAGER_LABEL_LIMIT)
    && safeRevision(value.revision)
    && !!value.audit && typeof value.audit === "object" && exactKeys(value.audit as Record<string, unknown>, ["revision", "state", "source"])
    && (value.audit as Record<string, unknown>).revision === value.revision
    && (value.audit as Record<string, unknown>).state === "server-projected"
    && (value.audit as Record<string, unknown>).source === "gateway";
}

export function hasAdminManagerAccess(authorization: AuthorizationProjection | null, expectedRevision: number): boolean {
  return Boolean(authorization && safeRevision(authorization.revision) && authorization.revision === expectedRevision && authorization.capabilities.includes(ADMIN_MANAGER_CAPABILITY));
}

export function acceptAdminManagerProjection(value: unknown, expectedRevision: number): value is AdminManagerGatewayProjection {
  if (!value || typeof value !== "object") return false;
  const projection = value as Record<string, unknown>;
  if (!exactKeys(projection, ["contract", "version", "authorizationRevision", "manager", "records"]) || projection.contract !== ADMIN_MANAGER_CONTRACT || projection.version !== ADMIN_MANAGER_CONTRACT_VERSION || projection.authorizationRevision !== expectedRevision) return false;
  if (!safeRevision(projection.authorizationRevision) || !["users", "groups", "roles", "permissions"].includes(String(projection.manager)) || !Array.isArray(projection.records) || projection.records.length > ADMIN_MANAGER_RECORD_LIMIT) return false;
  const expectedKind = projection.manager === "users" ? "user" : projection.manager === "groups" ? "group" : projection.manager === "roles" ? "role" : "permission";
  let previousId = "";
  for (const entry of projection.records) {
    if (!entry || typeof entry !== "object") return false;
    const record = entry as Record<string, unknown>;
    if (!safeText(record.id) || record.id <= previousId) return false;
    previousId = record.id;
    const kind = record.kind;
    if (kind !== expectedKind || !["user", "group", "role", "permission"].includes(String(kind)) || "mutation" in record || !baseRecord(record, kind as AdminManagerRecord["kind"])) return false;
    if (kind === "user" && (!safeTextList(record.roleRefs) || !safeTextList(record.groupRefs) || !capabilityList(record.capabilityRefs))) return false;
    if (kind === "group" && (!safeTextList(record.memberRefs) || !safeTextList(record.roleRefs) || !["global", "world", "content", "self"].includes(String(record.scope)))) return false;
    if (kind === "role" && (!safeText(record.canonicalRole) || !capabilityList(record.capabilityRefs) || !Number.isSafeInteger(record.memberCount) || (record.memberCount as number) < 0)) return false;
    if (kind === "permission" && (!CAPABILITIES.has(record.capability as AuthorizationCapability) || !["user", "group", "role"].includes(String(record.subjectKind)) || !safeText(record.resource) || record.action !== "read" || !safeText(record.description, 512) || !["global", "world", "content", "self"].includes(String(record.scope)))) return false;
  }
  return true;
}

export function adaptAdminManagerProjection(value: unknown, expectedRevision: number): AdminManagerProjection | null {
  if (!acceptAdminManagerProjection(value, expectedRevision)) return null;
  return {
    ...value,
    records: value.records.map((record) => ({ ...record, mutation: "disabled" as const } as AdminManagerRecord)),
  };
}

export function acceptAdminManagerReadError(value: unknown): value is AdminManagerReadError {
  if (!value || typeof value !== "object") return false;
  const response = value as Record<string, unknown>;
  if (!exactKeys(response, ["contract", "version", "error"]) || response.contract !== ADMIN_MANAGER_CONTRACT || response.version !== ADMIN_MANAGER_CONTRACT_VERSION || !response.error || typeof response.error !== "object") return false;
  const error = response.error as Record<string, unknown>;
  return exactKeys(error, ["code", "message"])
    && ADMIN_MANAGER_ERROR_CODES.includes(error.code as typeof ADMIN_MANAGER_ERROR_CODES[number])
    && safeText(error.message, 160);
}
