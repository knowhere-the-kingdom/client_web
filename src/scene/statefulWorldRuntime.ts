export type AuthoritativeCompositeLod = Readonly<{ lod: "near" | "mid" | "far"; appearance: Readonly<{ tintMultiplier: readonly [number, number, number]; statuses: readonly string[] }>; voxels?: readonly Readonly<{ x: number; y: number; z: number; fill: number }>[]; dominantMaterialId?: string; tint?: number; silhouetteFill?: number }>;
export type AuthoritativeWorldChunk = Readonly<{ runtimeHash: string; chunkHash: string; environmentHash: string; reservoirHash: string; renderHash: string; renderComposites: readonly Readonly<{ local: Readonly<{ x: number; y: number; z: number }>; near: AuthoritativeCompositeLod; mid: AuthoritativeCompositeLod; far: AuthoritativeCompositeLod }>[] }>;
export type ActiveStatefulWorld = Readonly<{ runtimeHash: string; recipeHash: string; tides: Readonly<{ amplitudeMeters: number; elapsedGameDays: number }>; rendererPolicy: unknown; chunk: AuthoritativeWorldChunk }>;

/** Fetches only Clockwork-authoritative data. Any identity/hash mismatch rejects
 * before Babylon receives a renderable payload. */
export async function loadActiveStatefulWorld(fetcher: typeof fetch = fetch): Promise<ActiveStatefulWorld> {
  const worldResponse = await fetcher("/api/world"); if (!worldResponse.ok) throw new Error(`Active world bridge HTTP ${worldResponse.status}.`);
  const world = await worldResponse.json() as { recipe?: { recipeHash?: string; runtimeHash?: string; rendererReady?: boolean; tides?: { amplitudeMeters?: number; elapsedGameDays?: number }; rendererPolicy?: unknown } };
  const recipe = world.recipe; if (!recipe?.rendererReady || !recipe.recipeHash || !recipe.runtimeHash || !recipe.tides || typeof recipe.tides.amplitudeMeters !== "number" || typeof recipe.tides.elapsedGameDays !== "number") throw new Error("Active world bridge lacks a validated renderer-ready recipe.");
  const chunkResponse = await fetcher("/api/world/chunks/0/0/0"); if (!chunkResponse.ok) throw new Error(`Authoritative world chunk HTTP ${chunkResponse.status}.`);
  const chunk = await chunkResponse.json() as AuthoritativeWorldChunk;
  if (chunk.runtimeHash !== recipe.runtimeHash || !chunk.chunkHash || !chunk.environmentHash || !chunk.reservoirHash || !chunk.renderHash || !chunk.renderComposites.length) throw new Error("Authoritative world chunk failed runtime/hash validation.");
  return { runtimeHash: recipe.runtimeHash, recipeHash: recipe.recipeHash, tides: { amplitudeMeters: recipe.tides.amplitudeMeters, elapsedGameDays: recipe.tides.elapsedGameDays }, rendererPolicy: recipe.rendererPolicy, chunk };
}
