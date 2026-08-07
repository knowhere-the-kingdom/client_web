/**
 * Renderer-facing style metadata for the isolated Staxel intake preview.
 *
 * This is a client-local art slice, not a gameplay camera, world lighting
 * contract, or admitted-player presentation authority.
 */
export type CharacterPreviewStyle = Readonly<{
  id: "knowhere-character-preview-v1";
  status: "preview-only";
  clearColor: string;
  ambientLight: Readonly<{
    color: string;
    intensity: number;
  }>;
  keyLight: Readonly<{
    color: string;
    intensity: number;
    position: readonly [number, number, number];
  }>;
  camera: Readonly<{
    fieldOfViewDegrees: number;
    distanceScale: number;
    heightScale: number;
    depthScale: number;
    turnRadians: number;
  }>;
}>;

/**
 * The approved intake-preview look. Values are intentionally scoped to the
 * isolated asset review and must not be treated as gameplay presentation
 * defaults until art and admitted-world contracts are approved.
 */
export const STAXEL_VOXEL_FEMALE_PREVIEW_STYLE: CharacterPreviewStyle = Object.freeze({
  id: "knowhere-character-preview-v1",
  status: "preview-only",
  clearColor: "#070b12",
  ambientLight: Object.freeze({ color: "#cfe7ff", intensity: 1.8 }),
  keyLight: Object.freeze({ color: "#ffddb4", intensity: 2.6, position: [3, 5, 4] as const }),
  camera: Object.freeze({
    fieldOfViewDegrees: 40,
    distanceScale: 1.25,
    heightScale: 0.65,
    depthScale: 1.75,
    turnRadians: Math.PI / 8,
  }),
});
