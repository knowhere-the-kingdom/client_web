/**
 * Client-only third-party asset descriptor. This is not gameplay authority,
 * an account record, or a server-delivered model contract.
 */
export type CharacterPreviewAsset = Readonly<{
  id: "staxel-voxel-female";
  displayName: string;
  sourceUrl: string;
  license: "CC-BY-4.0";
  attribution: string;
  gltfUrl: string;
  defaultAnimation: "Take 001";
  previewExcludedNodeNames: readonly ["Plane001_Material #26_0"];
  status: "preview-only";
}>;

/**
 * The controller consumes stable semantic names, never glTF node indices or
 * archive clip names. This preview intentionally maps no gameplay actions.
 */
export type CharacterAnimationIntent =
  | "idle"
  | "walking"
  | "running"
  | "crouching"
  | "jump-requested"
  | "flying"
  | "control-released"
  | "interact";

export type CharacterControllerVisualBinding = Readonly<{
  assetId: CharacterPreviewAsset["id"];
  rigVersion: "staxel-voxel-female-v1";
  previewClip: CharacterPreviewAsset["defaultAnimation"];
  semanticAnimations: Readonly<Partial<Record<CharacterAnimationIntent, string>>>;
  status: "preview-only";
}>;

export const STAXEL_VOXEL_FEMALE: CharacterPreviewAsset = {
  id: "staxel-voxel-female",
  displayName: "Staxel Voxel Female",
  sourceUrl: "https://sketchfab.com/3d-models/staxel-voxel-female-debe55a5358b4efc89e346ab4a7d4d57",
  license: "CC-BY-4.0",
  attribution: "This work is based on \"Staxel Voxel Female\" by andruha1801, licensed under CC-BY-4.0.",
  gltfUrl: "/third-party/staxel_voxel_female/source/scene.gltf",
  defaultAnimation: "Take 001",
  previewExcludedNodeNames: ["Plane001_Material #26_0"],
  status: "preview-only",
};

export const STAXEL_VOXEL_FEMALE_CONTROLLER_BINDING: CharacterControllerVisualBinding = {
  assetId: STAXEL_VOXEL_FEMALE.id,
  rigVersion: "staxel-voxel-female-v1",
  previewClip: STAXEL_VOXEL_FEMALE.defaultAnimation,
  semanticAnimations: {},
  status: "preview-only",
};
