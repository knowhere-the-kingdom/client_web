import { AnimationMixer, type AnimationClip, type Object3D, type SkinnedMesh } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";

import { STAXEL_VOXEL_FEMALE, STAXEL_VOXEL_FEMALE_CONTROLLER_BINDING } from "./staxelVoxelFemale";

export type CharacterControllerPreviewState = Readonly<{
  mode: "preview-only";
  assetId: typeof STAXEL_VOXEL_FEMALE.id;
  rigVersion: typeof STAXEL_VOXEL_FEMALE_CONTROLLER_BINDING.rigVersion;
  rootNodeName: string;
  skinJointCount: number;
  clipName: string;
}>;

export type CharacterControllerPreview = Readonly<{
  state: CharacterControllerPreviewState;
  root: Object3D;
  skin: SkinnedMesh;
  update: (deltaSeconds: number) => void;
  dispose: () => void;
}>;

function firstSkinnedMesh(scene: Object3D): SkinnedMesh | null {
  let result: SkinnedMesh | null = null;
  scene.traverse((node) => {
    if (!result && "isSkinnedMesh" in node && node.isSkinnedMesh === true) {
      result = node as SkinnedMesh;
    }
  });
  return result;
}

function requiredClip(clips: readonly AnimationClip[]): AnimationClip {
  const clip = clips.find((candidate) => candidate.name === STAXEL_VOXEL_FEMALE_CONTROLLER_BINDING.previewClip);
  if (!clip) {
    throw new Error(`Preview asset is missing required clip ${STAXEL_VOXEL_FEMALE_CONTROLLER_BINDING.previewClip}.`);
  }
  return clip;
}

/**
 * Binds only local visual state. It intentionally has no account, inventory,
 * network, player-command, or game-authority dependency.
 */
export function createCharacterControllerPreview(gltf: GLTF): CharacterControllerPreview {
  const root = gltf.scene.getObjectByName("_rootJoint");
  if (!root) {
    throw new Error("Preview asset is missing the approved _rootJoint rig root.");
  }

  const skin = firstSkinnedMesh(gltf.scene);
  if (!skin) {
    throw new Error("Preview asset has no skinned mesh.");
  }

  const clip = requiredClip(gltf.animations);
  const mixer = new AnimationMixer(gltf.scene);
  const action = mixer.clipAction(clip);
  action.play();

  return {
    state: Object.freeze({
      mode: "preview-only",
      assetId: STAXEL_VOXEL_FEMALE.id,
      rigVersion: STAXEL_VOXEL_FEMALE_CONTROLLER_BINDING.rigVersion,
      rootNodeName: root.name,
      skinJointCount: skin.skeleton.bones.length,
      clipName: clip.name,
    }),
    root,
    skin,
    update(deltaSeconds) {
      if (Number.isFinite(deltaSeconds) && deltaSeconds > 0) mixer.update(deltaSeconds);
    },
    dispose() {
      action.stop();
      mixer.stopAllAction();
      mixer.uncacheRoot(gltf.scene);
    },
  };
}
