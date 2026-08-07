import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

import { STAXEL_VOXEL_FEMALE, STAXEL_VOXEL_FEMALE_CONTROLLER_BINDING } from "./staxelVoxelFemale";
import { derivePlayerPresentationReadiness, type PlayerPresentationReadiness, type PlayerWorldAuthoritySnapshot } from "./playerPresentationContract";

export type BabylonCharacterAsset = Readonly<{
  meshes: readonly AbstractMesh[];
  transformNodes: readonly TransformNode[];
  animationGroups: readonly AnimationGroup[];
}>;

export type CharacterControllerPreview = Readonly<{
  state: Readonly<{ mode: "preview-only"; assetId: string; rigVersion: string; rootNodeName: string; meshCount: number; clipName: string }>;
  root: TransformNode;
  update: (deltaSeconds: number) => void;
  dispose: () => void;
}>;

export type AdmittedCharacterPresentationResult =
  | Readonly<{ activated: false; readiness: Extract<PlayerPresentationReadiness, { lifecycle: "inactive" }> }>
  | Readonly<{ activated: true; readiness: Extract<PlayerPresentationReadiness, { lifecycle: "ready" }>; presentation: CharacterControllerPreview }>;

export function createCharacterControllerPreview(asset: BabylonCharacterAsset): CharacterControllerPreview {
  const root = asset.transformNodes.find((node) => node.name === "_rootJoint") ?? asset.transformNodes[0];
  if (!root) throw new Error("Preview asset is missing a Babylon transform root.");
  for (const nodeName of STAXEL_VOXEL_FEMALE.previewExcludedNodeNames) {
    const mesh = asset.meshes.find((candidate) => candidate.name === nodeName);
    if (mesh) mesh.setEnabled(false);
  }
  const animation = asset.animationGroups.find((candidate) => candidate.name === STAXEL_VOXEL_FEMALE_CONTROLLER_BINDING.previewClip) ?? asset.animationGroups[0];
  if (!animation) throw new Error("Preview asset is missing a Babylon animation group.");
  animation.start(true);
  return Object.freeze({
    state: Object.freeze({ mode: "preview-only", assetId: STAXEL_VOXEL_FEMALE.id, rigVersion: STAXEL_VOXEL_FEMALE_CONTROLLER_BINDING.rigVersion, rootNodeName: root.name, meshCount: asset.meshes.length, clipName: animation.name }),
    root,
    update() { /* Babylon advances animation groups with the scene render loop. */ },
    dispose() { animation.stop(); for (const mesh of asset.meshes) mesh.dispose(false, true); root.dispose(); },
  });
}

export function createAdmittedStaxelCharacterPresentation(asset: BabylonCharacterAsset, authority: PlayerWorldAuthoritySnapshot): AdmittedCharacterPresentationResult {
  const readiness = derivePlayerPresentationReadiness(authority);
  if (readiness.lifecycle !== "ready") return Object.freeze({ activated: false, readiness });
  return Object.freeze({ activated: true, readiness, presentation: createCharacterControllerPreview(asset) });
}
