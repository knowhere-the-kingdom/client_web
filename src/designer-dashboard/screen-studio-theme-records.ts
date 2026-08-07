import type { ScreenStudioThemeReadRecord } from "./screen-studio-theme-gateway.ts";

export function filterScreenStudioThemeRecords(records: readonly ScreenStudioThemeReadRecord[], query: string): readonly ScreenStudioThemeReadRecord[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return records;
  return records.filter((record) => `${record.id} ${record.slug} ${record.name} ${JSON.stringify(record.tokens)}`.toLowerCase().includes(normalized));
}

export function selectedScreenStudioThemeRecord(records: readonly ScreenStudioThemeReadRecord[], id: string | null): ScreenStudioThemeReadRecord | null {
  return records.find((record) => record.id === id) ?? records[0] ?? null;
}

export type ScreenStudioThemeTokenEntry = Readonly<{ path: string; value: string }>;

export function screenStudioThemeTokenEntries(record: ScreenStudioThemeReadRecord): readonly ScreenStudioThemeTokenEntry[] {
  const entries: ScreenStudioThemeTokenEntry[] = [];
  const visit = (value: unknown, path: string) => {
    if (value && typeof value === "object") {
      for (const [key, nested] of Object.entries(value)) visit(nested, path ? `${path}.${key}` : key);
      return;
    }
    entries.push(Object.freeze({ path, value: String(value) }));
  };
  visit(record.tokens, "");
  return Object.freeze(entries);
}
