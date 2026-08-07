import {
  SCREEN_STUDIO_FUSED_ELEMENT_CATALOG,
  createFusedElementDraft,
  validateElementDraft,
  type FusedElementDraftV1,
} from "./screen-studio-element-composition-model.ts";

export const SCREEN_STUDIO_ELEMENT_DRAFT_LIFECYCLE_CONTRACT = "knowhere.screen-studio.element-draft-lifecycle.v1" as const;

export type ElementDraftWorkingOrigin =
  | Readonly<{ kind: "catalog"; catalogId: string }>
  | Readonly<{ kind: "saved-local"; recordId: string }>;

export type ElementDraftWorkingCopy = Readonly<{
  origin: ElementDraftWorkingOrigin;
  draft: FusedElementDraftV1;
}>;

export type ElementDraftLifecycleState = Readonly<{
  contract: typeof SCREEN_STUDIO_ELEMENT_DRAFT_LIFECYCLE_CONTRACT;
  records: readonly FusedElementDraftV1[];
  working: ElementDraftWorkingCopy | null;
}>;

export type ElementDraftLifecycleResult =
  | Readonly<{ ok: true; state: ElementDraftLifecycleState; record?: FusedElementDraftV1 }>
  | Readonly<{ ok: false; state: ElementDraftLifecycleState; error: string }>;

const safeName = (name: string): boolean => {
  const value = name.trim();
  return value.length >= 2 && value.length <= 80 && !/[<>\u0000-\u001f\u007f]/u.test(value);
};

const safeId = (id: string): boolean => /^[a-z0-9][a-z0-9-]{1,79}$/u.test(id);

const catalogEntry = (id: string) => SCREEN_STUDIO_FUSED_ELEMENT_CATALOG.find((entry) => entry.id === id);

function validateSavedRecords(records: readonly FusedElementDraftV1[]): string | null {
  const ids = new Set<string>();
  for (const record of records) {
    if (validateElementDraft(record).length || !record.localDraft || !safeId(record.id) || !safeName(record.name)) return "Saved local Element records must be valid drafts.";
    if (ids.has(record.id)) return "Saved local Element record IDs must be unique.";
    ids.add(record.id);
  }
  return null;
}

const freezeState = (records: readonly FusedElementDraftV1[], working: ElementDraftWorkingCopy | null): ElementDraftLifecycleState => Object.freeze({
  contract: SCREEN_STUDIO_ELEMENT_DRAFT_LIFECYCLE_CONTRACT,
  records: Object.isFrozen(records) ? records : Object.freeze([...records]),
  working: working ? Object.freeze({ origin: Object.freeze({ ...working.origin }), draft: working.draft }) : null,
});

export function createElementDraftLifecycleState(records: readonly FusedElementDraftV1[] = []): ElementDraftLifecycleState {
  const error = validateSavedRecords(records);
  if (error) throw new RangeError(error);
  return freezeState(records, null);
}

export function selectCanonicalElementForEditing(state: ElementDraftLifecycleState, catalogId: string): ElementDraftLifecycleResult {
  const entry = catalogEntry(catalogId);
  if (!entry) return Object.freeze({ ok: false, state, error: "Choose a canonical Element or Panel." });
  if (state.working?.origin.kind === "catalog" && state.working.origin.catalogId === catalogId) return Object.freeze({ ok: true, state });
  const draft = createFusedElementDraft(entry.id, {
    id: `working-${entry.id}`,
    name: entry.name,
    description: entry.description,
    localDraft: true,
    updatedAt: "local-session",
  });
  return Object.freeze({ ok: true, state: freezeState(state.records, { origin: { kind: "catalog", catalogId }, draft }) });
}

export function selectSavedElementDraft(state: ElementDraftLifecycleState, recordId: string): ElementDraftLifecycleResult {
  const record = state.records.find((candidate) => candidate.id === recordId);
  if (!record) return Object.freeze({ ok: false, state, error: "Saved local Element draft was not found." });
  if (state.working?.origin.kind === "saved-local" && state.working.origin.recordId === recordId) return Object.freeze({ ok: true, state });
  return Object.freeze({ ok: true, state: freezeState(state.records, { origin: { kind: "saved-local", recordId }, draft: record }) });
}

export function replaceWorkingElementDraft(state: ElementDraftLifecycleState, draft: FusedElementDraftV1): ElementDraftLifecycleResult {
  if (!state.working) return Object.freeze({ ok: false, state, error: "Open an Element before editing it." });
  if (validateElementDraft(draft).length || !draft.localDraft || draft.id !== state.working.draft.id) return Object.freeze({ ok: false, state, error: "Working Element draft is invalid." });
  if (draft === state.working.draft) return Object.freeze({ ok: true, state });
  return Object.freeze({ ok: true, state: freezeState(state.records, { origin: state.working.origin, draft }) });
}

export function nextElementDraftName(requestedName: string, records: readonly FusedElementDraftV1[]): string {
  const requested = requestedName.trim();
  const taken = new Set(records.map((record) => record.name.trim().toLocaleLowerCase("en-US")));
  if (!taken.has(requested.toLocaleLowerCase("en-US"))) return requested;
  const base = `${requested} - Copy`;
  if (!taken.has(base.toLocaleLowerCase("en-US"))) return base;
  let suffix = 2;
  while (taken.has(`${base} ${suffix}`.toLocaleLowerCase("en-US"))) suffix += 1;
  return `${base} ${suffix}`;
}

function slugForName(name: string): string {
  const slug = name.normalize("NFKD").toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 56);
  return slug || "element";
}

export function nextElementDraftId(name: string, records: readonly FusedElementDraftV1[]): string {
  const base = `local-element-${slugForName(name)}`;
  const taken = new Set(records.map((record) => record.id));
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function saveWorkingElementAsNew(state: ElementDraftLifecycleState, requestedName: string, updatedAt = "local-session"): ElementDraftLifecycleResult {
  if (!state.working) return Object.freeze({ ok: false, state, error: "Open an Element before saving it." });
  if (!safeName(requestedName)) return Object.freeze({ ok: false, state, error: "Use a plain name from 2 to 80 characters." });
  if (validateElementDraft(state.working.draft).length) return Object.freeze({ ok: false, state, error: "Working Element draft is invalid." });
  const name = nextElementDraftName(requestedName, state.records);
  const id = nextElementDraftId(name, state.records);
  const record = Object.freeze({
    ...state.working.draft,
    id,
    name,
    revision: 1,
    audit: Object.freeze({ owner: "Creator", createdAt: updatedAt, updatedAt }),
    localDraft: true,
  });
  if (validateElementDraft(record).length || !safeId(record.id) || !safeName(record.name)) return Object.freeze({ ok: false, state, error: "New local Element draft failed validation." });
  const records = Object.freeze([record, ...state.records]);
  const nextState = freezeState(records, { origin: { kind: "saved-local", recordId: record.id }, draft: record });
  return Object.freeze({ ok: true, state: nextState, record });
}
