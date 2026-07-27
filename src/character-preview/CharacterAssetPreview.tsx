import { useEffect, useRef, useState } from "react";
import { AmbientLight, Box3, Clock, Color, DirectionalLight, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { createCharacterControllerPreview } from "../characters/CharacterControllerPreview";
import { STAXEL_VOXEL_FEMALE } from "../characters/staxelVoxelFemale";

type PreviewState = "loading" | "ready" | "error";

export function CharacterAssetPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<PreviewState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(new Color("#070b12"));

    const scene = new Scene();
    const camera = new PerspectiveCamera(40, 1, 0.01, 1000);
    scene.add(new AmbientLight("#cfe7ff", 1.8));
    const key = new DirectionalLight("#ffddb4", 2.6);
    key.position.set(3, 5, 4);
    scene.add(key);

    let cancelled = false;
    let controller: ReturnType<typeof createCharacterControllerPreview> | null = null;
    let frameId = 0;
    const clock = new Clock();

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const safeWidth = Math.max(1, Math.floor(width));
      const safeHeight = Math.max(1, Math.floor(height));
      renderer.setSize(safeWidth, safeHeight, false);
      camera.aspect = safeWidth / safeHeight;
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    new GLTFLoader().load(
      STAXEL_VOXEL_FEMALE.gltfUrl,
      (gltf) => {
        if (cancelled) return;
        const model = gltf.scene;
        const bounds = new Box3().setFromObject(model);
        const center = bounds.getCenter(new Vector3());
        const size = bounds.getSize(new Vector3());
        const largestAxis = Math.max(size.x, size.y, size.z, 0.01);
        model.position.sub(center);
        model.rotation.y = Math.PI / 8;
        scene.add(model);
        camera.position.set(largestAxis * 1.25, largestAxis * 0.65, largestAxis * 1.75);
        camera.lookAt(0, 0, 0);

        controller = createCharacterControllerPreview(gltf);

        setState("ready");
        const render = () => {
          if (cancelled) return;
          controller?.update(clock.getDelta());
          renderer.render(scene, camera);
          frameId = window.requestAnimationFrame(render);
        };
        render();
      },
      undefined,
      () => {
        if (!cancelled) {
          setError("The isolated character preview could not load its local source asset.");
          setState("error");
        }
      },
    );

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      controller?.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <main className="asset-preview" aria-labelledby="asset-preview-title">
      <section className="asset-preview__panel">
        <p className="browser-shell__eyebrow">Isolated asset preview</p>
        <h1 id="asset-preview-title">{STAXEL_VOXEL_FEMALE.displayName}</h1>
        <p className="asset-preview__status" role="status">
          {state === "loading" ? "Loading local source asset…" : state === "ready" ? "Preview only — no gameplay, account, or server binding." : error}
        </p>
        <canvas ref={canvasRef} className="asset-preview__canvas" aria-label="Animated 3D character asset preview" />
        <p className="asset-preview__credit">
          {STAXEL_VOXEL_FEMALE.attribution} <a href={STAXEL_VOXEL_FEMALE.sourceUrl}>Source and full credit</a>.
        </p>
      </section>
    </main>
  );
}
