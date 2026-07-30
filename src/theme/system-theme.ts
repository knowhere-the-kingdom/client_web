/**
 * Presentation-only System theme contracts.
 *
 * These tokens carry no account, inventory, session, Gateway, or authority
 * data. A server-confirmed projection may choose a theme at a higher layer;
 * this module only describes how an already-approved choice is presented.
 */

export const THEME_FAMILIES = [
  "System",
  "Kingdom",
  "Revelation",
  "Angelic",
  "Demonic",
  "Hybrid",
  "Cosmic",
] as const;

export type ThemeFamily = (typeof THEME_FAMILIES)[number];

export const SYSTEM_THEME_TOKENS = {
  surface: "#07141c",
  surfaceRaised: "#0b2024",
  surfaceDeep: "#02090d",
  border: "#d2ad48",
  borderBright: "#ffd75a",
  edgeLight: "#48d7df",
  text: "#f8ffff",
  textMuted: "#b5c9c8",
  focus: "#48d7df",
  danger: "#c94848",
  spacingUnit: "0.5rem",
  radius: "0.5rem",
} as const;

export const THEME_TOKEN_CONTRACTS: Record<ThemeFamily, Readonly<Record<string, string>>> = {
  System: { material: "gold-metal/matrix", surface: "#07141c", raised: "#0b2024", text: "#f8ffff", muted: "#b5c9c8", frame: "#d2ad48", focus: "#48d7df", secondaryAccent: "#ffd75a", typography: "display-gold/body-readable", motion: "measured" },
  Kingdom: { material: "roman-stone/cloth", surface: "#191b1d", raised: "#30343a", text: "#f2f0e8", muted: "#b8b6aa", frame: "#c1c5c7", focus: "#e8e8e8", secondaryAccent: "#9d7443", typography: "inscribed/body-readable", motion: "restrained-reveal" },
  Revelation: { material: "clean-glass/minimal", surface: "#f4f7f7", raised: "#ffffff", text: "#142326", muted: "#526466", frame: "#9aaeb0", focus: "#48d7df", secondaryAccent: "#d2ad48", typography: "modern/body-readable", motion: "measured" },
  Angelic: { material: "white-gold/halo", surface: "#f8ffff", raised: "#ffffff", text: "#28221a", muted: "#766d5e", frame: "#d2ad48", focus: "#f8ffff", secondaryAccent: "#fff1a8", typography: "display-gold/body-readable", motion: "slow" },
  Demonic: { material: "black-red/ember", surface: "#10090b", raised: "#281015", text: "#fff4f2", muted: "#c9a8a5", frame: "#c94848", focus: "#ff806d", secondaryAccent: "#6e2029", typography: "display-gold/body-readable", motion: "slow" },
  Hybrid: { material: "white-gold-red/dual", surface: "#171316", raised: "#292126", text: "#fffaf2", muted: "#c7b8b5", frame: "#d2ad48", focus: "#f8ffff", secondaryAccent: "#c94848", typography: "display-gold/body-readable", motion: "measured" },
  Cosmic: { material: "cyan-nebula/starfield", surface: "#06185d", raised: "#102b83", text: "#f8ffff", muted: "#a9c8ed", frame: "#48d7df", focus: "#ff6dca", secondaryAccent: "#ff983d", typography: "display-gold/body-readable", motion: "slow" },
};

export const QUALITY_STATES = ["static", "reveal", "hover-focus", "held", "disabled", "reduced-motion"] as const;
export type QualityState = (typeof QUALITY_STATES)[number];

export type QualityBackdrop = Readonly<{
  level: number;
  name: string;
  color: string;
  backdrop: string;
  pattern: string;
  borderPattern: string;
}>;

// Names and border colors are protected canonical values from the design doc.
export const QUALITY_BACKDROPS: readonly QualityBackdrop[] = [
  { level: 0, name: "Scrap", color: "#4b4b4b", backdrop: "charcoal-plate", pattern: "shallow-scratches", borderPattern: "broken-line" },
  { level: 1, name: "Common", color: "#e8e8e8", backdrop: "neutral-pearl-steel", pattern: "soft-diagonal-sheen", borderPattern: "fine-solid" },
  { level: 2, name: "Uncommon", color: "#4ea85a", backdrop: "deep-green-bloom", pattern: "leaf-like-motes", borderPattern: "leaf-notch" },
  { level: 3, name: "Rare", color: "#3f7dde", backdrop: "sapphire-depth", pattern: "horizontal-scan-glint", borderPattern: "scan-dash" },
  { level: 4, name: "Epic", color: "#8d55cc", backdrop: "violet-haze", pattern: "orbiting-sparks", borderPattern: "arc-double" },
  { level: 5, name: "Relic", color: "#c94848", backdrop: "dark-crimson", pattern: "ember-flecks", borderPattern: "ember-dot" },
  { level: 6, name: "Mythic", color: "#db7b32", backdrop: "orange-gold-plasma", pattern: "heat-shimmer", borderPattern: "plasma-wave" },
  { level: 7, name: "Legendary", color: "#d2ad48", backdrop: "black-gold", pattern: "traveling-edge-sweep", borderPattern: "gold-sweep" },
  { level: 8, name: "Cosmic", color: "#48d7df", backdrop: "cyan-blue-starfield", pattern: "pink-orange-nebula", borderPattern: "constellation" },
  { level: 9, name: "Divine", color: "#f8ffff", backdrop: "white-gold-halo", pattern: "ascending-motes", borderPattern: "halo-triple" },
] as const;

export function getQualityBackdrop(level: number): QualityBackdrop | undefined {
  return QUALITY_BACKDROPS.find((backdrop) => backdrop.level === level);
}

export function qualityBackdropAttributes(level: number, state: QualityState = "static") {
  const backdrop = getQualityBackdrop(level);
  if (!backdrop) return undefined;
  return {
    "data-quality": String(backdrop.level),
    "data-quality-name": backdrop.name,
    "data-quality-level": String(backdrop.level),
    "data-quality-pattern": backdrop.borderPattern,
    "data-quality-state": state,
    "aria-label": `${backdrop.name}, quality ${backdrop.level}, ${backdrop.borderPattern} border`,
    "aria-disabled": state === "disabled" ? "true" : undefined,
  } as const;
}
