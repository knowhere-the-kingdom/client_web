import { screenStudioElementCatalog, type ElementDefinition } from "./screen-studio-model.ts";

export const SCREEN_STUDIO_ELEMENT_UNIT_CONTRACT = "ScreenStudioElementUnitsV1" as const;
export type ElementUnitMode = "px" | "rem";
export type SiteUnitContract = Readonly<{
  version: 1;
  defaultMode: ElementUnitMode;
  pxPerSiteUnit: 32;
  remRootPx: 16;
  screenStudioGridUnitPx: 8;
}>;
export const DEFAULT_SITE_UNIT_CONTRACT: SiteUnitContract = Object.freeze({ version: 1, defaultMode: "px", pxPerSiteUnit: 32, remRootPx: 16, screenStudioGridUnitPx: 8 });

export type ScreenStudioElementCategory = "Controls" | "Text" | "Inputs" | "Navigation" | "Feedback" | "Layout/Media";
export const SCREEN_STUDIO_ELEMENT_CATEGORY_ORDER: readonly ScreenStudioElementCategory[] = ["Controls", "Text", "Inputs", "Navigation", "Feedback", "Layout/Media"];
const CATEGORY_BY_ID: Readonly<Record<string, ScreenStudioElementCategory>> = Object.freeze({
  button: "Controls", "icon-button": "Controls", "menu-item": "Controls", checkbox: "Inputs", select: "Inputs", toggle: "Inputs", "text-field": "Inputs", "search-field": "Inputs", heading: "Text", text: "Text", "rich-text": "Text", label: "Text", badge: "Feedback", link: "Navigation", tabs: "Navigation", "status-dot": "Feedback", "progress-bar": "Feedback", toast: "Feedback", tooltip: "Feedback", image: "Layout/Media", divider: "Layout/Media", spacer: "Layout/Media", container: "Layout/Media", stack: "Layout/Media", grid: "Layout/Media", "scroll-region": "Layout/Media", modal: "Layout/Media", table: "Layout/Media", list: "Layout/Media", card: "Layout/Media", "tree-view": "Layout/Media", "inspector-panel": "Layout/Media", "item-slot": "Layout/Media", "inventory-grid": "Layout/Media",
});
export function elementCategory(id: string): ScreenStudioElementCategory {
  const category = CATEGORY_BY_ID[id];
  if (!category) throw new RangeError(`Unknown Screen Studio Element type: ${id}`);
  return category;
}
export function elementTypeOptions(catalog: readonly ElementDefinition[] = screenStudioElementCatalog): readonly string[] { return Object.freeze([...catalog].sort((a, b) => a.id.localeCompare(b.id)).map((entry) => entry.id)); }
export function isCanonicalElementType(id: string, catalog: readonly ElementDefinition[] = screenStudioElementCatalog): boolean { return catalog.some((entry) => entry.id === id); }
export type ElementCategoryGroup = Readonly<{ category: ScreenStudioElementCategory; elements: readonly ElementDefinition[] }>;
export function groupScreenStudioElements(catalog: readonly ElementDefinition[] = screenStudioElementCatalog): readonly ElementCategoryGroup[] {
  return Object.freeze(SCREEN_STUDIO_ELEMENT_CATEGORY_ORDER.map((category) => ({ category, elements: Object.freeze([...catalog].filter((entry) => elementCategory(entry.id) === category).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))) })).filter((group) => group.elements.length > 0));
}

export type ElementUnitGeometry = Readonly<{ width: number; height: number; padding: number; margin: number; borderWidth: number; borderRadius: number; offsetX: number; offsetY: number }>;
export const ELEMENT_UNIT_BOUNDS = Object.freeze({ min: 0, max: 64, step: 0.25 });
export function isValidSiteUnitContract(contract: SiteUnitContract): boolean { return contract.version === 1 && (contract.defaultMode === "px" || contract.defaultMode === "rem") && [contract.pxPerSiteUnit, contract.remRootPx, contract.screenStudioGridUnitPx].every((value) => Number.isFinite(value) && value > 0 && value <= 4096); }
function checkedConversion(value: number, mode: ElementUnitMode, contract: SiteUnitContract): number { if (!Number.isFinite(value) || value < 0 || (mode !== "px" && mode !== "rem") || !isValidSiteUnitContract(contract)) throw new RangeError("Invalid Element unit conversion."); return value * (mode === "px" ? contract.pxPerSiteUnit : contract.remRootPx); }
export function siteUnitsToPixels(value: number, mode: ElementUnitMode = DEFAULT_SITE_UNIT_CONTRACT.defaultMode, contract: SiteUnitContract = DEFAULT_SITE_UNIT_CONTRACT): number { return checkedConversion(value, mode, contract); }
export function pixelsToSiteUnits(value: number, mode: ElementUnitMode = DEFAULT_SITE_UNIT_CONTRACT.defaultMode, contract: SiteUnitContract = DEFAULT_SITE_UNIT_CONTRACT): number { const factor = checkedConversion(1, mode, contract); if (!Number.isFinite(value) || value < 0) throw new RangeError("Invalid Element pixel conversion."); return value / factor; }
export function elementGeometryPixels(geometry: ElementUnitGeometry, mode: ElementUnitMode = DEFAULT_SITE_UNIT_CONTRACT.defaultMode, contract: SiteUnitContract = DEFAULT_SITE_UNIT_CONTRACT) { return Object.fromEntries(Object.entries(geometry).map(([key, value]) => [key, siteUnitsToPixels(value, mode, contract)])) as Record<keyof ElementUnitGeometry, number>; }
export function isValidElementUnitGeometry(geometry: ElementUnitGeometry): boolean { return Object.values(geometry).every((value) => Number.isFinite(value) && value >= ELEMENT_UNIT_BOUNDS.min && value <= ELEMENT_UNIT_BOUNDS.max && Math.abs(value / ELEMENT_UNIT_BOUNDS.step - Math.round(value / ELEMENT_UNIT_BOUNDS.step)) < 1e-9); }

export type ElementColorDraft = Readonly<{ kind: "theme-token"; token: string } | { kind: "hsla"; hue: number; saturation: number; lightness: number; alpha: number }>;
export const ELEMENT_COLOR_STEPS = Object.freeze({ hue: 1, saturation: 0.1, lightness: 0.1, alpha: 0.01 });
export const SCREEN_STUDIO_ELEMENT_THEME_TOKEN_OPTIONS: readonly string[] = Object.freeze(["theme.accent", "theme.primary", "theme.secondary", "theme.surface", "theme.text", "theme.border", "theme.focus"]);
const unsafePresentationPattern = /(?:<\/?(?:script|style|iframe)|javascript:|url\s*\(|expression\s*\(|data:text\/html|on[a-z]+\s*=)/i;
export function isSafeElementText(value: string): boolean { return !unsafePresentationPattern.test(value); }
export function isValidElementColor(color: ElementColorDraft): boolean { if (!color || typeof color !== "object" || (color as { kind?: string }).kind === undefined) return false; if (color.kind === "theme-token") return SCREEN_STUDIO_ELEMENT_THEME_TOKEN_OPTIONS.includes(color.token) && isSafeElementText(color.token); if (color.kind !== "hsla") return false; return Number.isFinite(color.hue) && color.hue >= 0 && color.hue <= 360 && Number.isFinite(color.saturation) && color.saturation >= 0 && color.saturation <= 100 && Number.isFinite(color.lightness) && color.lightness >= 0 && color.lightness <= 100 && Number.isFinite(color.alpha) && color.alpha >= 0 && color.alpha <= 1; }
export type ElementEffectDraft = Readonly<{ kind: "none" } | { kind: "drop-shadow" | "glow"; color: ElementColorDraft; offsetX: number; offsetY: number; blur: number; spread: number; alpha: number }>;
export function isValidElementEffect(effect: ElementEffectDraft): boolean { if (!effect || typeof effect !== "object" || typeof (effect as { kind?: string }).kind !== "string") return false; if (effect.kind === "none") return true; if (effect.kind !== "drop-shadow" && effect.kind !== "glow") return false; return isValidElementColor(effect.color) && [effect.offsetX, effect.offsetY, effect.blur, effect.spread, effect.alpha].every((value) => Number.isFinite(value)) && [effect.offsetX, effect.offsetY, effect.blur, effect.spread].every((value) => value >= -64 && value <= 64) && effect.alpha >= 0 && effect.alpha <= 1; }

export type ScreenStudioElementDraftV1 = Readonly<{ contract: typeof SCREEN_STUDIO_ELEMENT_UNIT_CONTRACT; id: string; name: string; elementType: string; category: ScreenStudioElementCategory; unitMode: ElementUnitMode; geometry: ElementUnitGeometry; color: ElementColorDraft; borderColor: ElementColorDraft; effect: ElementEffectDraft; content: Readonly<{ label?: string; text?: string }>; revision: 1 }>;
export function validateScreenStudioElementDraft(draft: ScreenStudioElementDraftV1): Readonly<Record<string, string>> { const errors: Record<string, string> = {}; if (!draft || draft.contract !== SCREEN_STUDIO_ELEMENT_UNIT_CONTRACT) errors.contract = "Unsupported Element contract."; const canonical = isCanonicalElementType(draft.elementType); if (!canonical) errors.elementType = "Choose a canonical Element type."; if (canonical && draft.category !== elementCategory(draft.elementType)) errors.category = "Element category does not match its canonical type."; if (draft.unitMode !== "px" && draft.unitMode !== "rem") errors.unitMode = "Choose px or rem."; if (!isValidElementUnitGeometry(draft.geometry)) errors.geometry = "Geometry must use bounded site units."; if (!isValidElementColor(draft.color) || !isValidElementColor(draft.borderColor)) errors.color = "Use a valid theme token or HSLA color."; if (!isValidElementEffect(draft.effect)) errors.effect = "Effect parameters are outside their bounds."; if (!isSafeElementText(draft.name) || !Object.values(draft.content ?? {}).every((value) => typeof value === "string" && isSafeElementText(value))) errors.content = "Element text contains unsafe presentation markup."; return errors; }
