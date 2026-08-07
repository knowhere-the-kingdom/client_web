import {
  DEFAULT_SITE_UNIT_CONTRACT,
  ELEMENT_UNIT_BOUNDS,
  SCREEN_STUDIO_ELEMENT_THEME_TOKEN_OPTIONS,
  SCREEN_STUDIO_ELEMENT_UNIT_CONTRACT,
  elementCategory,
  elementGeometryPixels,
  isValidElementColor,
  isValidElementEffect,
  isValidElementUnitGeometry,
  pixelsToSiteUnits,
  siteUnitsToPixels,
  type ElementColorDraft,
  type ElementEffectDraft,
  type ElementUnitMode,
  type ScreenStudioElementDraftV1,
} from "../dashboard/screen-studio-element-model.ts";
import { themeReadTokenEntries, type ScreenStudioThemeReadRecord } from "./screen-studio-theme-gateway.ts";

const FALLBACK_COLOR = "#16272d";
const THEME_TOKEN_PATHS: Readonly<Record<string, string>> = Object.freeze({
  "theme.accent": "colors.accent",
  "theme.primary": "colors.primary",
  "theme.secondary": "colors.secondary",
  "theme.surface": "surfaces.panel",
  "theme.text": "text.primary",
  "theme.border": "borders.default",
  "theme.focus": "borders.focus",
});
const roundToUnitStep = (value: number) => Math.min(ELEMENT_UNIT_BOUNDS.max, Math.max(ELEMENT_UNIT_BOUNDS.min, Math.round(value / ELEMENT_UNIT_BOUNDS.step) * ELEMENT_UNIT_BOUNDS.step));

export function createDefaultElementDraft(id: string, name: string, elementType = "button"): ScreenStudioElementDraftV1 {
  return {
    contract: SCREEN_STUDIO_ELEMENT_UNIT_CONTRACT,
    id,
    name,
    elementType,
    category: elementCategory(elementType),
    unitMode: DEFAULT_SITE_UNIT_CONTRACT.defaultMode,
    geometry: { width: 4, height: 2, padding: 0.5, margin: 0, borderWidth: 0.25, borderRadius: 0.25, offsetX: 0, offsetY: 0 },
    color: { kind: "theme-token", token: "theme.primary" },
    borderColor: { kind: "theme-token", token: "theme.border" },
    effect: { kind: "none" },
    content: { label: name, text: name },
    revision: 1,
  };
}

export function convertElementDraftUnitMode(draft: ScreenStudioElementDraftV1, nextMode: ElementUnitMode): ScreenStudioElementDraftV1 {
  if (draft.unitMode === nextMode) return draft;
  const geometry = Object.fromEntries(Object.entries(draft.geometry).map(([key, value]) => {
    const safeValue = Number.isFinite(value) ? Math.min(ELEMENT_UNIT_BOUNDS.max, Math.max(ELEMENT_UNIT_BOUNDS.min, value)) : 0;
    return [key, roundToUnitStep(pixelsToSiteUnits(siteUnitsToPixels(safeValue, draft.unitMode), nextMode))];
  })) as ScreenStudioElementDraftV1["geometry"];
  return { ...draft, unitMode: nextMode, geometry };
}

export function formatElementColor(color: ElementColorDraft): string {
  return color.kind === "theme-token" ? color.token : `hsla(${color.hue}, ${color.saturation}%, ${color.lightness}%, ${color.alpha})`;
}

export function parseDirectElementColor(value: string): ElementColorDraft | null {
  const normalized = value.trim();
  const token: ElementColorDraft = { kind: "theme-token", token: normalized };
  if (isValidElementColor(token)) return token;
  const match = /^hsla\(\s*(\d{1,3}(?:\.\d+)?)\s*,\s*(\d{1,3}(?:\.\d+)?)%\s*,\s*(\d{1,3}(?:\.\d+)?)%\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*\)$/i.exec(normalized);
  if (!match) return null;
  const color: ElementColorDraft = { kind: "hsla", hue: Number(match[1]), saturation: Number(match[2]), lightness: Number(match[3]), alpha: Number(match[4]) };
  return isValidElementColor(color) ? color : null;
}

export function themeColorTokenPaths(theme: ScreenStudioThemeReadRecord | null): readonly string[] {
  if (!theme) return SCREEN_STUDIO_ELEMENT_THEME_TOKEN_OPTIONS;
  const available = new Set(themeReadTokenEntries(theme).filter((entry) => /^#[0-9a-f]{6}$/i.test(entry.value)).map((entry) => entry.path));
  return SCREEN_STUDIO_ELEMENT_THEME_TOKEN_OPTIONS.filter((tokenName) => available.has(THEME_TOKEN_PATHS[tokenName]));
}

export function resolveElementColor(color: ElementColorDraft, theme: ScreenStudioThemeReadRecord | null): string {
  if (!isValidElementColor(color)) return FALLBACK_COLOR;
  if (color.kind === "hsla") return formatElementColor(color);
  const path = THEME_TOKEN_PATHS[color.token];
  const entry = theme && path ? themeReadTokenEntries(theme).find((candidate) => candidate.path === path) : null;
  return entry && /^#[0-9a-f]{6}$/i.test(entry.value) ? entry.value : FALLBACK_COLOR;
}

export function elementEffectBoxShadow(effect: ElementEffectDraft, theme: ScreenStudioThemeReadRecord | null): string {
  if (!isValidElementEffect(effect) || effect.kind === "none") return "none";
  const color = resolveElementColor(effect.color, theme);
  const alpha = Math.min(effect.alpha, 1);
  const effectColor = effect.color.kind === "hsla"
    ? `hsla(${effect.color.hue}, ${effect.color.saturation}%, ${effect.color.lightness}%, ${Number((effect.color.alpha * alpha).toFixed(4))})`
    : /^#[0-9a-f]{6}$/i.test(color) ? `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}` : FALLBACK_COLOR;
  if (effect.kind === "glow") return `0 0 ${Math.max(0, effect.blur)}px ${Math.max(0, effect.spread)}px ${effectColor}`;
  return `${effect.offsetX}px ${effect.offsetY}px ${Math.max(0, effect.blur)}px ${effect.spread}px ${effectColor}`;
}

export function elementPreviewPresentation(draft: ScreenStudioElementDraftV1, theme: ScreenStudioThemeReadRecord | null) {
  const geometrySource = isValidElementUnitGeometry(draft.geometry) ? draft.geometry : Object.fromEntries(Object.entries(draft.geometry).map(([key, value]) => [key, roundToUnitStep(Number.isFinite(value) ? value : 0)])) as ScreenStudioElementDraftV1["geometry"];
  const geometry = elementGeometryPixels(geometrySource, draft.unitMode === "rem" ? "rem" : "px");
  return {
    geometry,
    style: {
      width: Math.max(1, geometry.width),
      height: Math.max(1, geometry.height),
      padding: geometry.padding,
      margin: geometry.margin,
      borderWidth: geometry.borderWidth,
      borderRadius: geometry.borderRadius,
      translate: `${geometry.offsetX}px ${geometry.offsetY}px`,
      background: resolveElementColor(draft.color, theme),
      borderColor: geometry.borderWidth === 0 ? "transparent" : resolveElementColor(draft.borderColor, theme),
      boxShadow: elementEffectBoxShadow(draft.effect, theme),
    },
  };
}
