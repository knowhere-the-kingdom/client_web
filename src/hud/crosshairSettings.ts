export const CROSSHAIR_SETTINGS_EVENT = "knowhere:crosshair-settings-changed";
export const DASHBOARD_PREFERENCES_STORAGE_PREFIX = "knowhere.dashboard.preferences.v1.";

export type CrosshairSettings = Readonly<{
  enabled: boolean;
  preset: "cross" | "dot" | "circle" | "chevron";
  size: number;
  lineWidth: number;
  gap: number;
  opacity: number;
  color: string;
  outline: boolean;
  outlineColor: string;
  outlineWidth: number;
  outlineOpacity: number;
  centerDot: boolean;
  centerDotSize: number;
  centerDotColor: string;
}>;

export type CrosshairSettingsEventDetail = Readonly<{
  ownerId: string;
  settings: CrosshairSettings;
}>;

type StorageReader = Pick<Storage, "getItem">;

export const defaultCrosshairSettings: CrosshairSettings = Object.freeze({
  enabled: true,
  preset: "cross",
  size: 42,
  lineWidth: 2,
  gap: 6,
  opacity: 88,
  color: "#70b9b2",
  outline: true,
  outlineColor: "#000000",
  outlineWidth: 1,
  outlineOpacity: 80,
  centerDot: true,
  centerDotSize: 4,
  centerDotColor: "#70b9b2",
});

function boundedNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, value))
    : fallback;
}

function safeColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : defaultCrosshairSettings.color;
}

function safePreset(value: unknown): CrosshairSettings["preset"] {
  return value === "dot" || value === "circle" || value === "chevron" ? value : "cross";
}

export function crosshairSettingsStorageKey(ownerId: string) {
  return `${DASHBOARD_PREFERENCES_STORAGE_PREFIX}${ownerId}`;
}

export function readCrosshairSettings(storage: StorageReader, ownerId: string): CrosshairSettings {
  if (!ownerId) return defaultCrosshairSettings;
  try {
    const raw = storage.getItem(crosshairSettingsStorageKey(ownerId));
    if (!raw) return defaultCrosshairSettings;
    const parsed = JSON.parse(raw) as { version?: unknown; gameplay?: Record<string, unknown> };
    if (parsed.version !== 1 || !parsed.gameplay || typeof parsed.gameplay !== "object") return defaultCrosshairSettings;
    return {
      enabled: parsed.gameplay.crosshairEnabled !== false,
      preset: safePreset(parsed.gameplay.crosshairPreset),
      size: boundedNumber(parsed.gameplay.crosshairSize, 16, 80, defaultCrosshairSettings.size),
      lineWidth: boundedNumber(parsed.gameplay.crosshairLineWidth, 1, 12, defaultCrosshairSettings.lineWidth),
      gap: boundedNumber(parsed.gameplay.crosshairGap, 0, 32, defaultCrosshairSettings.gap),
      opacity: boundedNumber(parsed.gameplay.crosshairOpacity, 0, 100, defaultCrosshairSettings.opacity),
      color: safeColor(parsed.gameplay.crosshairColor),
      outline: parsed.gameplay.crosshairOutline !== false,
      outlineColor: safeColor(parsed.gameplay.crosshairOutlineColor),
      outlineWidth: boundedNumber(parsed.gameplay.crosshairOutlineWidth, 0, 6, defaultCrosshairSettings.outlineWidth),
      outlineOpacity: boundedNumber(parsed.gameplay.crosshairOutlineOpacity, 0, 100, defaultCrosshairSettings.outlineOpacity),
      centerDot: parsed.gameplay.centerDot !== false,
      centerDotSize: boundedNumber(parsed.gameplay.crosshairCenterDotSize, 1, 16, defaultCrosshairSettings.centerDotSize),
      centerDotColor: safeColor(parsed.gameplay.crosshairCenterDotColor),
    };
  } catch {
    return defaultCrosshairSettings;
  }
}

export function publishStoredCrosshairSettings(ownerId: string) {
  if (typeof window === "undefined" || !ownerId) return;
  window.dispatchEvent(new CustomEvent<CrosshairSettingsEventDetail>(CROSSHAIR_SETTINGS_EVENT, {
    detail: { ownerId, settings: readCrosshairSettings(window.localStorage, ownerId) },
  }));
}
