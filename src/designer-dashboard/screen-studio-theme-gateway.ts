import type { AuthorizationProjection } from "./workspace-model.ts";

export const SCREEN_STUDIO_THEME_READ_CONTRACT = "ScreenStudioThemeReadV1" as const;
export const SCREEN_STUDIO_THEME_READ_PATH = "/v1/screen-studio/themes" as const;
const STATUSES = new Set(["planned", "ready", "started", "in-progress", "blocked", "review", "complete"]);
const COLOR_GROUPS = {
  surfaces: ["canvas", "background", "panel", "panelRaised", "overlay"],
  text: ["primary", "secondary", "muted", "inverse", "onPrimary"],
  borders: ["subtle", "default", "strong", "focus", "alert"],
  feedback: ["alert", "success", "warning"],
  colors: ["primary", "secondary", "accent"],
} as const;

export type ScreenStudioThemeReadRecord = Readonly<{
  id: string;
  slug: string;
  name: string;
  status: "planned" | "ready" | "started" | "in-progress" | "blocked" | "review" | "complete";
  version: 1;
  revision: number;
  tokens: Readonly<{
    surfaces: Readonly<Record<"canvas" | "background" | "panel" | "panelRaised" | "overlay", string>>;
    text: Readonly<Record<"primary" | "secondary" | "muted" | "inverse" | "onPrimary", string>>;
    borders: Readonly<Record<"subtle" | "default" | "strong" | "focus" | "alert", string>>;
    feedback: Readonly<Record<"alert" | "success" | "warning", string>>;
    colors: Readonly<Record<"primary" | "secondary" | "accent", string>>;
    spacing: Readonly<Record<"gridUnit" | "xs" | "sm" | "md" | "lg" | "xl", number>>;
    radii: Readonly<Record<"sm" | "md" | "lg" | "pill", number>>;
    motion: Readonly<{ reducedMotion: "reduce" | "preserve" }>;
  }>;
}>;

export type ScreenStudioThemeReadResult = Readonly<
  { ok: true; correlationId: string; records: readonly ScreenStudioThemeReadRecord[] }
  | { ok: false; code: "invalid_response" | "authorization_stale" | "themes_unavailable"; message: string; retryable: boolean }
>;

const exactKeys = (value: Record<string, unknown>, allowed: readonly string[]) => {
  const actual = Object.keys(value).sort();
  const expected = [...allowed].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const safeText = (value: unknown, maximum = 128): value is string => typeof value === "string" && value.length > 0 && value.length <= maximum && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
const safeInteger = (value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= maximum;
const hexColor = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

function colorGroup(value: unknown, keys: readonly string[]): boolean {
  return record(value) && exactKeys(value, keys) && keys.every((key) => hexColor(value[key]));
}

function safeTheme(value: unknown): value is ScreenStudioThemeReadRecord {
  if (!record(value) || !exactKeys(value, ["id", "slug", "name", "status", "version", "revision", "tokens"])) return false;
  if (!safeText(value.id) || !safeText(value.slug) || !safeText(value.name) || !STATUSES.has(String(value.status)) || value.version !== 1 || !safeInteger(value.revision)) return false;
  if (!record(value.tokens) || !exactKeys(value.tokens, ["surfaces", "text", "borders", "feedback", "colors", "spacing", "radii", "motion"])) return false;
  for (const [group, keys] of Object.entries(COLOR_GROUPS)) if (!colorGroup(value.tokens[group], keys)) return false;
  if (!record(value.tokens.spacing) || !exactKeys(value.tokens.spacing, ["gridUnit", "xs", "sm", "md", "lg", "xl"]) || !Object.values(value.tokens.spacing).every((entry) => safeInteger(entry, 256))) return false;
  if (!record(value.tokens.radii) || !exactKeys(value.tokens.radii, ["sm", "md", "lg", "pill"]) || !Object.values(value.tokens.radii).every((entry) => safeInteger(entry, 9999))) return false;
  return record(value.tokens.motion) && exactKeys(value.tokens.motion, ["reducedMotion"]) && (value.tokens.motion.reducedMotion === "reduce" || value.tokens.motion.reducedMotion === "preserve");
}

function validateEnvelope(value: unknown, expectedAuthorizationRevision: number): Readonly<{ correlationId: string; themes: readonly ScreenStudioThemeReadRecord[] }> | null {
  if (!record(value) || !exactKeys(value, ["protocolVersion", "correlationId", "data"]) || value.protocolVersion !== "1.0" || !safeText(value.correlationId, 256) || !record(value.data)) return null;
  if (!exactKeys(value.data, ["contract", "authorizationRevision", "themes"]) || value.data.contract !== SCREEN_STUDIO_THEME_READ_CONTRACT || value.data.authorizationRevision !== expectedAuthorizationRevision || !Array.isArray(value.data.themes) || value.data.themes.length > 64) return null;
  let previousId = "";
  for (const theme of value.data.themes) {
    if (!safeTheme(theme) || theme.id <= previousId) return null;
    previousId = theme.id;
  }
  return { correlationId: value.correlationId, themes: value.data.themes };
}

export function canReadScreenStudioThemes(authorization: AuthorizationProjection | null, expectedAuthorizationRevision: number): boolean {
  return Number.isSafeInteger(expectedAuthorizationRevision)
    && expectedAuthorizationRevision >= 0
    && authorization?.revision === expectedAuthorizationRevision
    && authorization.capabilities.includes("world.designer.read");
}

export async function readScreenStudioThemes(authorization: AuthorizationProjection | null, expectedAuthorizationRevision: number, options: Readonly<{ signal?: AbortSignal; fetchImpl?: typeof fetch; origin?: string; timeoutMs?: number }> = {}): Promise<ScreenStudioThemeReadResult> {
  if (!canReadScreenStudioThemes(authorization, expectedAuthorizationRevision)) return { ok: false, code: "authorization_stale", message: "Theme authorization changed. Reopen the Workspace.", retryable: false };
  const fetchImpl = options.fetchImpl ?? window.fetch.bind(window);
  const origin = options.origin ?? window.location.origin;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", abort, { once: true });
  const timeout = globalThis.setTimeout(abort, options.timeoutMs ?? 6000);
  try {
    const response = await fetchImpl(new URL(SCREEN_STUDIO_THEME_READ_PATH, origin), { method: "GET", credentials: "include", mode: "same-origin", redirect: "error", cache: "no-store", headers: { accept: "application/json" }, signal: controller.signal });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const stale = response.status === 409;
      return { ok: false, code: stale ? "authorization_stale" : "themes_unavailable", message: stale ? "Theme authorization changed. Reopen the Workspace." : "Themes are temporarily unavailable.", retryable: response.status >= 500 };
    }
    const envelope = validateEnvelope(body, expectedAuthorizationRevision);
    if (!envelope) return { ok: false, code: "invalid_response", message: "Themes returned an invalid response.", retryable: false };
    return { ok: true, correlationId: envelope.correlationId, records: envelope.themes };
  } catch {
    return { ok: false, code: "themes_unavailable", message: "Themes are temporarily unavailable.", retryable: true };
  } finally {
    globalThis.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

export function themeReadTokenEntries(theme: ScreenStudioThemeReadRecord): readonly Readonly<{ path: string; value: string }>[] {
  const entries: Array<Readonly<{ path: string; value: string }>> = [];
  const visit = (value: unknown, path: string) => {
    if (record(value)) { for (const [key, nested] of Object.entries(value)) visit(nested, path ? `${path}.${key}` : key); return; }
    entries.push({ path, value: String(value) });
  };
  visit(theme.tokens, "");
  return entries;
}
