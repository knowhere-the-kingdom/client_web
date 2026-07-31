export const TOOLTIP_SETTINGS_STORAGE_KEY = "knowhere.hud.tooltip-settings.v1";
export const TOOLTIP_SETTINGS_EVENT = "knowhere:tooltip-settings-changed";

export const TOOLTIP_PLACEMENTS = ["left", "right", "above", "below", "cursor"] as const;
export type TooltipPlacement = (typeof TOOLTIP_PLACEMENTS)[number];

export type TooltipSettings = Readonly<{
  version: 1;
  placement: TooltipPlacement;
}>;

export const defaultTooltipSettings: TooltipSettings = Object.freeze({
  version: 1,
  placement: "right",
});

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;

export function isTooltipPlacement(value: unknown): value is TooltipPlacement {
  return typeof value === "string" && (TOOLTIP_PLACEMENTS as readonly string[]).includes(value);
}

export function readTooltipSettings(storage: StorageReader): TooltipSettings {
  try {
    const parsed = JSON.parse(storage.getItem(TOOLTIP_SETTINGS_STORAGE_KEY) ?? "null") as Partial<TooltipSettings> | null;
    if (parsed?.version !== 1 || !isTooltipPlacement(parsed.placement)) return defaultTooltipSettings;
    return { version: 1, placement: parsed.placement };
  } catch {
    return defaultTooltipSettings;
  }
}

export function saveTooltipSettings(storage: StorageWriter, placement: TooltipPlacement): TooltipSettings {
  const settings: TooltipSettings = { version: 1, placement };
  storage.setItem(TOOLTIP_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  return settings;
}

export function publishTooltipSettings(placement: TooltipPlacement): TooltipSettings {
  const settings = saveTooltipSettings(window.localStorage, placement);
  window.dispatchEvent(new CustomEvent<TooltipSettings>(TOOLTIP_SETTINGS_EVENT, { detail: settings }));
  return settings;
}
