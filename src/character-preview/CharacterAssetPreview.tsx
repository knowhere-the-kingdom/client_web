import { useEffect, useRef, useState } from "react";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";

import { createCharacterControllerPreview } from "../characters/CharacterControllerPreview";
import { STAXEL_VOXEL_FEMALE } from "../characters/staxelVoxelFemale";

export function CharacterAssetPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Loading Babylon character…");
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
    const scene = new Scene(engine);
    const camera = new ArcRotateCamera("preview-camera", Math.PI / 2, Math.PI / 2.35, 4.5, new Vector3(0, 1, 0), scene);
    camera.attachControl(canvas, true);
    new HemisphericLight("preview-light", new Vector3(0.2, 1, -0.3), scene);
    let controller: ReturnType<typeof createCharacterControllerPreview> | null = null;
    let active = true;
    const source = new URL(STAXEL_VOXEL_FEMALE.gltfUrl, window.location.origin);
    void SceneLoader.ImportMeshAsync(null, `${source.origin}${source.pathname.slice(0, source.pathname.lastIndexOf("/") + 1)}`, source.pathname.split("/").at(-1)!, scene).then((result) => {
      if (!active) return;
      controller = createCharacterControllerPreview({ meshes: result.meshes, transformNodes: result.transformNodes, animationGroups: result.animationGroups });
      setStatus(`Babylon preview ready · ${controller.state.meshCount} meshes · ${controller.state.clipName}`);
    }).catch(() => active && setStatus("Babylon could not load the temporary character asset."));
    engine.runRenderLoop(() => scene.render());
    const resize = () => engine.resize();
    window.addEventListener("resize", resize);
    return () => { active = false; window.removeEventListener("resize", resize); controller?.dispose(); scene.dispose(); engine.dispose(); };
  }, []);
  return <main className="asset-preview"><section className="asset-preview__panel"><p className="browser-shell__eyebrow">Babylon prototype character</p><h1>{STAXEL_VOXEL_FEMALE.displayName}</h1><canvas ref={canvasRef} className="asset-preview__canvas" aria-label="Animated Babylon character preview" /><p role="status">{status}</p><small>{STAXEL_VOXEL_FEMALE.attribution}</small></section></main>;
}
