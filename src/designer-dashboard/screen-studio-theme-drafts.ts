import type { ScreenStudioThemeReadRecord } from "./screen-studio-theme-gateway.ts";

export type ScreenStudioThemeDraftEntry = Readonly<{
  origin: "local-draft";
  record: ScreenStudioThemeReadRecord;
  savedRecord: ScreenStudioThemeReadRecord;
  dirty: boolean;
}>;

export type ThemeDraftValidation = Readonly<Record<string, string>>;

const cloneRecord = (record: ScreenStudioThemeReadRecord): ScreenStudioThemeReadRecord => structuredClone(record);
const draftNumber = (entries: readonly ScreenStudioThemeDraftEntry[]) => {
  const used = new Set(entries.map((entry) => entry.record.id));
  let number = 1;
  while (used.has(`local-theme-${number}`)) number += 1;
  return number;
};

export function createLocalThemeDraft(entries: readonly ScreenStudioThemeDraftEntry[], template: ScreenStudioThemeReadRecord): Readonly<{ entries: readonly ScreenStudioThemeDraftEntry[]; selectedId: string }> {
  const number = draftNumber(entries);
  const id = `local-theme-${number}`;
  const record: ScreenStudioThemeReadRecord = {
    ...cloneRecord(template),
    id,
    slug: id,
    name: "Unnamed Theme",
    status: "planned",
    revision: 0,
  };
  const entry = Object.freeze({ origin: "local-draft" as const, record, savedRecord: cloneRecord(record), dirty: true });
  return Object.freeze({ entries: Object.freeze([entry, ...entries]), selectedId: id });
}

export function updateThemeDraft(entries: readonly ScreenStudioThemeDraftEntry[], id: string, update: (record: ScreenStudioThemeReadRecord) => ScreenStudioThemeReadRecord): readonly ScreenStudioThemeDraftEntry[] {
  return entries.map((entry) => entry.record.id === id ? Object.freeze({ ...entry, record: update(cloneRecord(entry.record)), dirty: true }) : entry);
}

export function updateThemeToken(record: ScreenStudioThemeReadRecord, path: string, input: string): ScreenStudioThemeReadRecord {
  const keys = path.split(".");
  const tokens = structuredClone(record.tokens) as unknown as Record<string, unknown>;
  let target = tokens;
  for (const key of keys.slice(0, -1)) {
    const next = target[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) return record;
    target = next as Record<string, unknown>;
  }
  const leaf = keys.at(-1);
  if (!leaf || !(leaf in target)) return record;
  const current = target[leaf];
  target[leaf] = typeof current === "number" ? Number(input) : input;
  return { ...record, tokens: tokens as ScreenStudioThemeReadRecord["tokens"] };
}

export function validateThemeDraft(record: ScreenStudioThemeReadRecord): ThemeDraftValidation {
  const errors: Record<string, string> = {};
  if (!record.name.trim() || record.name.trim().length > 128) errors.name = "Theme name must be between 1 and 128 characters.";
  const visit = (value: unknown, path: string) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [key, nested] of Object.entries(value)) visit(nested, path ? `${path}.${key}` : key);
      return;
    }
    if (typeof value === "number" && (!Number.isFinite(value) || value < 0 || value > 9999)) errors[`tokens.${path}`] = "Enter a finite non-negative token value.";
    const colorPath = /^(surfaces|text|borders|feedback|colors|buttons\.(primary|secondary)\.(default|hover|active|disabled)\.(background|text|border)|buttons\.(primary|secondary)\.focusRing|inputs\.(background|border|focusBorder|placeholder|text|invalidBorder)|panels\.(background|raisedBackground|border|header)|navigation\.(background|text|activeBackground|activeText|hoverBackground|divider))$/.test(path);
    if (typeof value === "string" && colorPath && !/^#[0-9a-f]{6}$/i.test(value)) errors[`tokens.${path}`] = "Enter a six-digit hexadecimal color.";
    if (path === "motion.reducedMotion" && value !== "reduce" && value !== "preserve") errors[`tokens.${path}`] = "Choose reduce or preserve.";
  };
  visit(record.tokens, "");
  return Object.freeze(errors);
}

export function saveThemeDraft(entries: readonly ScreenStudioThemeDraftEntry[], id: string): Readonly<{ entries: readonly ScreenStudioThemeDraftEntry[]; errors: ThemeDraftValidation }> {
  const selected = entries.find((entry) => entry.record.id === id);
  if (!selected) return Object.freeze({ entries, errors: Object.freeze({ draft: "Local draft is unavailable." }) });
  const errors = validateThemeDraft(selected.record);
  if (Object.keys(errors).length) return Object.freeze({ entries, errors });
  const saved = Object.freeze({ ...selected, record: cloneRecord(selected.record), savedRecord: cloneRecord(selected.record), dirty: false });
  return Object.freeze({ entries: Object.freeze([saved, ...entries.filter((entry) => entry.record.id !== id)]), errors });
}

export function discardThemeDraft(entries: readonly ScreenStudioThemeDraftEntry[], id: string): readonly ScreenStudioThemeDraftEntry[] {
  return entries.map((entry) => entry.record.id === id ? Object.freeze({ ...entry, record: cloneRecord(entry.savedRecord), dirty: false }) : entry);
}

export function duplicateThemeDraft(entries: readonly ScreenStudioThemeDraftEntry[], id: string): Readonly<{ entries: readonly ScreenStudioThemeDraftEntry[]; selectedId: string }> | null {
  const source = entries.find((entry) => entry.record.id === id);
  if (!source) return null;
  const created = createLocalThemeDraft(entries, source.record);
  const copy = created.entries[0];
  const copyRecord = { ...copy.record, name: `${source.record.name} - Copy` };
  return Object.freeze({ entries: Object.freeze([{ ...copy, record: copyRecord, savedRecord: cloneRecord(copyRecord), dirty: true }, ...created.entries.slice(1)]), selectedId: created.selectedId });
}

export function removeThemeDraft(entries: readonly ScreenStudioThemeDraftEntry[], id: string): readonly ScreenStudioThemeDraftEntry[] {
  return entries.filter((entry) => entry.record.id !== id);
}
