import { adaptAdminManagerProjection, hasAdminManagerAccess, type AdminManagerKind, type AdminManagerRecord } from "../dashboard/admin-manager-model.ts";
import type { AuthorizationProjection } from "./workspace-model.ts";

export const ADMIN_MANAGER_READ_BASE_PATH = "/v1/admin/managers/" as const;

export type AdminManagerReadResult = Readonly<
  | { ok: true; records: readonly AdminManagerRecord[] }
  | { ok: false; code: "authorization_stale" | "invalid_response" | "manager_unavailable"; message: string; retryable: boolean }
>;

export async function readAdminManager(kind: AdminManagerKind, authorization: AuthorizationProjection | null, expectedAuthorizationRevision: number, options: Readonly<{ signal?: AbortSignal; fetchImpl?: typeof fetch; origin?: string; timeoutMs?: number }> = {}): Promise<AdminManagerReadResult> {
  if (!hasAdminManagerAccess(authorization, expectedAuthorizationRevision)) return { ok: false, code: "authorization_stale", message: "Administrator authorization changed. Reopen the Workspace.", retryable: false };
  const fetchImpl = options.fetchImpl ?? window.fetch.bind(window);
  const origin = options.origin ?? window.location.origin;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", abort, { once: true });
  const timeout = globalThis.setTimeout(abort, options.timeoutMs ?? 6000);
  try {
    const response = await fetchImpl(new URL(`${ADMIN_MANAGER_READ_BASE_PATH}${kind}`, origin), {
      method: "GET",
      credentials: "include",
      mode: "same-origin",
      redirect: "error",
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, code: response.status === 401 || response.status === 403 || response.status === 409 ? "authorization_stale" : "manager_unavailable", message: response.status === 401 || response.status === 403 || response.status === 409 ? "Administrator authorization changed. Reopen the Workspace." : "Administrator data is temporarily unavailable.", retryable: response.status >= 500 };
    const projection = adaptAdminManagerProjection(body, expectedAuthorizationRevision);
    if (!projection || projection.manager !== kind) return { ok: false, code: "invalid_response", message: "Administrator data returned an invalid response.", retryable: false };
    return { ok: true, records: projection.records };
  } catch {
    return { ok: false, code: "manager_unavailable", message: "Administrator data is temporarily unavailable.", retryable: true };
  } finally {
    globalThis.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}
