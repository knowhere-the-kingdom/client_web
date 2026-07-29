export type DefinitionWithRevision = Readonly<{
  definition: Readonly<{ id: string; kind: string; slug: string; name: string; lifecycle: string; currentRevision: number }>;
  revision: Readonly<{ definitionId: string; revision: number; schemaVersion: number; status: string; payload: Record<string, unknown> }>;
}>;
