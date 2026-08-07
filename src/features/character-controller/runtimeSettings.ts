export const CHARACTER_INPUT_SETTINGS_EVENT = "knowhere:character-input-settings-changed";
export const DASHBOARD_PREFERENCES_STORAGE_PREFIX = "knowhere.dashboard.preferences.v1.";

export type CharacterInputBinding = Readonly<{
  id: string;
  primary: string;
  secondary: string;
  gamepad?: string;
}>;

export type CharacterInputSettings = Readonly<{
  accountId: string;
  bindings: readonly CharacterInputBinding[];
  mouseX: number;
  mouseY: number;
  invertMouseY: boolean;
  gamepadEnabled: boolean;
  invertGamepadY: boolean;
  deadzone: number;
}>;

export type CharacterInputSettingsEventDetail = Readonly<{
  accountId: string;
  settings: CharacterInputSettings;
}>;

type StorageReader = Pick<Storage, "getItem">;

const fallbackSettings = Object.freeze({
  mouseX: 50,
  mouseY: 44,
  invertMouseY: false,
  gamepadEnabled: true,
  invertGamepadY: false,
  deadzone: 12,
});

function boundedPercent(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : fallback;
}

function parseBindings(value: unknown): CharacterInputBinding[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const record = candidate as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.primary !== "string" || typeof record.secondary !== "string") return [];
    return [{
      id: record.id,
      primary: record.primary,
      secondary: record.secondary,
      ...(typeof record.gamepad === "string" ? { gamepad: record.gamepad } : {}),
    }];
  });
}

export function characterInputSettingsStorageKey(accountId: string) {
  return `${DASHBOARD_PREFERENCES_STORAGE_PREFIX}${accountId}`;
}

export function readCharacterInputSettings(storage: StorageReader, accountId: string): CharacterInputSettings {
  const fallback: CharacterInputSettings = { accountId, bindings: [], ...fallbackSettings };
  if (!accountId) return fallback;
  try {
    const raw = storage.getItem(characterInputSettingsStorageKey(accountId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { version?: unknown; controls?: Record<string, unknown> };
    if (parsed.version !== 1 || !parsed.controls || typeof parsed.controls !== "object") return fallback;
    return {
      accountId,
      bindings: parseBindings(parsed.controls.bindings),
      mouseX: boundedPercent(parsed.controls.mouseX, fallback.mouseX),
      mouseY: boundedPercent(parsed.controls.mouseY, fallback.mouseY),
      invertMouseY: parsed.controls.invertMouseY === true,
      gamepadEnabled: parsed.controls.gamepadEnabled !== false,
      invertGamepadY: parsed.controls.invertGamepadY === true,
      deadzone: boundedPercent(parsed.controls.deadzone, fallback.deadzone),
    };
  } catch {
    return fallback;
  }
}

export function publishCharacterInputSettings(accountId: string, settings: CharacterInputSettings) {
  if (typeof window === "undefined" || settings.accountId !== accountId) return;
  window.dispatchEvent(new CustomEvent<CharacterInputSettingsEventDetail>(CHARACTER_INPUT_SETTINGS_EVENT, {
    detail: { accountId, settings },
  }));
  window.dispatchEvent(new CustomEvent("knowhere:control-bindings-changed", { detail: settings.bindings }));
}

export function publishStoredCharacterInputSettings(accountId: string) {
  if (typeof window === "undefined") return;
  publishCharacterInputSettings(accountId, readCharacterInputSettings(window.localStorage, accountId));
}
