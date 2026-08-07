export type ScreenSortColumn = "screen" | "type" | "roles" | "tags" | "status";
export type ScreenSortDirection = "ascending" | "descending";
export type ScreenSortState = Readonly<{
  column: ScreenSortColumn;
  direction: ScreenSortDirection;
}>;

export type SortableScreenRecord = Readonly<{
  id: string;
  name: string;
  kind: string;
  status: string;
  screen?: Readonly<{ type: string }>;
  roles?: readonly string[];
  tags?: readonly string[];
}>;

// The status column follows the lifecycle order presented by the authoring UI.
const statusOrder = new Map([
  "planned",
  "ready",
  "started",
  "in-progress",
  "blocked",
  "review",
  "complete",
].map((status, index) => [status, index] as const));

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function nextScreenSort(
  current: ScreenSortState,
  column: ScreenSortColumn,
): ScreenSortState {
  return current.column === column
    ? { column, direction: current.direction === "ascending" ? "descending" : "ascending" }
    : { column, direction: "ascending" };
}

export function normalizedJoinedDisplay(values: readonly string[] | undefined): string {
  return [...(values ?? [])]
    .map((value) => value.trim())
    .filter(Boolean)
    .sort((left, right) => collator.compare(left, right))
    .join(", ");
}

function sortValue(record: SortableScreenRecord, column: ScreenSortColumn): string | number {
  if (column === "screen") return record.name;
  if (column === "type") return record.screen?.type ?? record.kind;
  if (column === "roles") return normalizedJoinedDisplay(record.roles);
  if (column === "tags") return normalizedJoinedDisplay(record.tags);
  return statusOrder.get(record.status) ?? statusOrder.size;
}

export function sortScreenRecords<T extends SortableScreenRecord>(
  records: readonly T[],
  sort: ScreenSortState,
): readonly T[] {
  const direction = sort.direction === "ascending" ? 1 : -1;
  return [...records].sort((left, right) => {
    const leftValue = sortValue(left, sort.column);
    const rightValue = sortValue(right, sort.column);
    const primary = typeof leftValue === "number" && typeof rightValue === "number"
      ? leftValue - rightValue
      : collator.compare(String(leftValue), String(rightValue));
    if (primary !== 0) return primary * direction;
    return collator.compare(left.id, right.id);
  });
}

export function toggleCollapsedGroup(
  current: ReadonlySet<string>,
  groupId: string,
): ReadonlySet<string> {
  const next = new Set(current);
  if (next.has(groupId)) next.delete(groupId);
  else next.add(groupId);
  return next;
}
