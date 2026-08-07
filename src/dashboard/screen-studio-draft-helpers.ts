import type { PageRecord } from "./screen-studio-model.ts";

export function nextDraftCopyName(
  name: string,
  existingNames: readonly string[],
): string {
  const taken = new Set(existingNames.map((value) => value.toLowerCase()));
  const base = `${name} - Copy`;
  if (!taken.has(base.toLowerCase())) return base;
  let suffix = 2;
  while (taken.has(`${base} ${suffix}`.toLowerCase())) suffix += 1;
  return `${base} ${suffix}`;
}

export function insertDraftAtTop<T>(
  items: readonly T[],
  draft: T,
): readonly T[] {
  return [draft, ...items];
}
export function renameDraft(page: PageRecord, name: string): PageRecord {
  return {
    ...page,
    displayName: name.trim(),
    audit: { ...page.audit, updatedAt: "2026-08-04T00:00:00Z" },
    revision: { ...page.revision, revision: 1, lifecycle: "draft" },
  };
}
export function duplicateDraft(
  page: PageRecord,
  existing: readonly PageRecord[],
): PageRecord {
  const name = nextDraftCopyName(
    page.displayName,
    existing.map((item) => item.displayName),
  );
  const id = nextDraftCopyName(
    page.id,
    existing.map((item) => item.id),
  )
    .replace(/ /g, "-")
    .toLowerCase();
  return {
    ...page,
    id,
    slug: id,
    displayName: name,
    revision: { revision: 1, lifecycle: "draft" },
    audit: { ...page.audit, updatedAt: "2026-08-04T00:00:00Z" },
  };
}
