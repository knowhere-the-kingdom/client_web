import { useEffect, useRef, useState } from "react";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";

import "./system-world-item.css";
import { WORLD_SPAWN_TIMINGS, createWorldFrameGuard, worldSpawnPhase, worldSunOrbit } from "./world-preview-lifecycle.ts";

function seededNoise(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function paintCartoonEarth(texture: DynamicTexture) {
  const context = texture.getContext();
  const width = texture.getSize().width;
  const height = texture.getSize().height;
  const random = seededNoise(0x4b4e4f57);

  context.fillStyle = "#167fb0";
  context.fillRect(0, 0, width, height);
  const ocean = context.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, "#8edcf0");
  ocean.addColorStop(0.28, "#259bc4");
  ocean.addColorStop(0.72, "#116a9b");
  ocean.addColorStop(1, "#7bc9df");
  context.fillStyle = ocean;
  context.fillRect(0, 0, width, height);

  const continents = [
    [0.08, 0.3, 0.22, 0.28], [0.22, 0.6, 0.16, 0.27],
    [0.48, 0.27, 0.25, 0.24], [0.58, 0.55, 0.18, 0.28],
    [0.78, 0.62, 0.13, 0.16], [0.94, 0.34, 0.16, 0.22],
  ] as const;
  for (const [centerX, centerY, radiusX, radiusY] of continents) {
    context.beginPath();
    const points = 18;
    for (let point = 0; point <= points; point += 1) {
      const angle = point / points * Math.PI * 2;
      const roughness = 0.72 + random() * 0.4;
      const x = centerX * width + Math.cos(angle) * radiusX * width * roughness;
      const y = centerY * height + Math.sin(angle) * radiusY * height * roughness;
      if (point === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.fillStyle = "#57a94d";
    context.fill();
    context.strokeStyle = "#d5cf77";
    context.lineWidth = 7;
    context.stroke();
  }

  context.globalAlpha = 0.56;
  context.strokeStyle = "#effcff";
  for (let cloud = 0; cloud < 24; cloud += 1) {
    const x = random() * width;
    const y = (0.12 + random() * 0.76) * height;
    context.lineWidth = 3 + random() * 8;
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(x + 20, y - 8, x + 42 + random() * 34, y);
    context.stroke();
  }
  context.globalAlpha = 1;
  texture.update(false);
}

function paintSpace(texture: DynamicTexture) {
  const context = texture.getContext();
  const { width, height } = texture.getSize();
  const random = seededNoise(0x53504143);
  const space = context.createRadialGradient(width * 0.5, height * 0.48, 0, width * 0.5, height * 0.48, width * 0.72);
  space.addColorStop(0, "#082e43");
  space.addColorStop(0.46, "#03131f");
  space.addColorStop(1, "#010307");
  context.fillStyle = space;
  context.fillRect(0, 0, width, height);
  for (let star = 0; star < 190; star += 1) {
    const radius = random() > 0.9 ? 1.8 : 0.7;
    context.beginPath();
    context.arc(random() * width, random() * height, radius, 0, Math.PI * 2);
    context.fillStyle = random() > 0.82 ? "#69dff0" : "#fff3b0";
    context.fill();
  }
  texture.update(false);
}

function easeOutBack(value: number) {
  const clamped = Math.min(1, Math.max(0, value));
  const overshoot = 1.70158;
  return 1 + (overshoot + 1) * Math.pow(clamped - 1, 3) + overshoot * Math.pow(clamped - 1, 2);
}

export function SystemWorldItem() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: Engine | null = null;
    let scene: Scene | null = null;
    const frameGuard = createWorldFrameGuard();
    let rendering = false;
    let frameStartedAt = performance.now();
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    try {
      engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false, alpha: true });
      scene = new Scene(engine);
      scene.clearColor.set(0, 0, 0, 0);

      // This camera belongs only to the item preview. Looking straight across
      // y=0 makes the planet's equator the horizon without affecting the HUD.
      const camera = new ArcRotateCamera("system-world-equator-camera", -Math.PI / 2, Math.PI / 2, 4.45, Vector3.Zero(), scene);
      camera.fov = 0.68;
      camera.minZ = 0.05;

      const skyTexture = new DynamicTexture("system-world-procedural-space", { width: 768, height: 384 }, scene, false);
      paintSpace(skyTexture);
      const skyMaterial = new StandardMaterial("system-world-space-skybox-material", scene);
      skyMaterial.backFaceCulling = false;
      skyMaterial.disableLighting = true;
      skyMaterial.emissiveTexture = skyTexture;
      skyMaterial.emissiveColor = Color3.White();
      const skybox = MeshBuilder.CreateSphere("system-world-space-skybox", { diameter: 18, segments: 20, sideOrientation: Mesh.BACKSIDE }, scene);
      skybox.material = skyMaterial;
      skybox.isPickable = false;

      const earthTexture = new DynamicTexture("system-world-procedural-cartoon-earth", { width: 1024, height: 512 }, scene, true);
      paintCartoonEarth(earthTexture);
      const matureMaterial = new StandardMaterial("system-world-mature-material", scene);
      matureMaterial.diffuseTexture = earthTexture;
      matureMaterial.diffuseColor = Color3.White();
      matureMaterial.specularColor = new Color3(0.5, 0.72, 0.8);
      matureMaterial.specularPower = 48;

      const explosionMaterial = new StandardMaterial("system-world-explosion-material", scene);
      explosionMaterial.diffuseColor = new Color3(1, 0.28, 0.02);
      explosionMaterial.emissiveColor = new Color3(0.85, 0.08, 0.005);
      const magmaMaterial = new StandardMaterial("system-world-magma-material", scene);
      magmaMaterial.diffuseColor = new Color3(0.72, 0.035, 0.012);
      magmaMaterial.emissiveColor = new Color3(0.38, 0.018, 0.004);
      magmaMaterial.specularColor = new Color3(1, 0.34, 0.06);
      const coolingMaterial = new StandardMaterial("system-world-cooling-material", scene);
      coolingMaterial.diffuseColor = new Color3(0.015, 0.24, 0.78);
      coolingMaterial.emissiveColor = new Color3(0.005, 0.035, 0.12);
      coolingMaterial.specularColor = new Color3(0.45, 0.78, 1);

      const planet = MeshBuilder.CreateSphere("system-world-planet", { diameter: 2, segments: 48 }, scene);
      planet.isPickable = false;
      planet.material = explosionMaterial;

      const sunMaterial = new StandardMaterial("system-world-sun-material", scene);
      sunMaterial.disableLighting = true;
      sunMaterial.emissiveColor = new Color3(1, 0.56, 0.06);
      const sun = MeshBuilder.CreateSphere("system-world-equatorial-sun", { diameter: 0.34, segments: 20 }, scene);
      sun.material = sunMaterial;
      sun.isPickable = false;
      const sunLight = new PointLight("system-world-sun-light", Vector3.Zero(), scene);
      sunLight.parent = sun;
      sunLight.diffuse = new Color3(1, 0.72, 0.4);
      sunLight.specular = new Color3(1, 0.88, 0.62);
      sunLight.intensity = 8;
      sunLight.range = 7;

      const burstMotes = Array.from({ length: 12 }, (_, index) => {
        const mote = MeshBuilder.CreateIcoSphere(`system-world-burst-${index}`, { radius: 0.04 + index % 3 * 0.012, subdivisions: 1 }, scene);
        mote.material = explosionMaterial;
        mote.isPickable = false;
        return mote;
      });

      let lastFrame = frameStartedAt;
      const draw = (now: number, reducedMotion: boolean) => {
        if (!scene || !frameGuard.acceptsFrame()) return;
        const elapsed = reducedMotion ? WORLD_SPAWN_TIMINGS.coolingEndMs : Math.max(0, now - frameStartedAt);
        const delta = Math.min(50, Math.max(0, now - lastFrame));
        lastFrame = now;
        const phase = worldSpawnPhase(elapsed);
        const sunOrbit = worldSunOrbit(elapsed, reducedMotion);
        sun.position.set(sunOrbit.x, sunOrbit.y, sunOrbit.z);

        if (phase === "explosion") {
          const progress = elapsed / WORLD_SPAWN_TIMINGS.explosionEndMs;
          const scale = 0.015 + easeOutBack(progress) * 0.985;
          planet.scaling.setAll(scale);
          planet.material = explosionMaterial;
          burstMotes.forEach((mote, index) => {
            const longitude = index / burstMotes.length * Math.PI * 2;
            const latitude = ((index % 5) - 2) * 0.19;
            const distance = 0.08 + progress * 1.35;
            mote.position.set(Math.cos(longitude) * distance, latitude * distance, Math.sin(longitude) * distance);
            mote.visibility = 1 - progress;
          });
        } else {
          planet.scaling.setAll(1);
          planet.material = phase === "magma" ? magmaMaterial : phase === "cooling" ? coolingMaterial : matureMaterial;
          burstMotes.forEach((mote) => { mote.visibility = 0; });
        }
        if (!reducedMotion) planet.rotation.y += delta * 0.00038;
        scene.render();
      };

      const renderFrame = () => draw(performance.now(), false);
      const startLoop = () => {
        if (!engine || rendering || !frameGuard.acceptsFrame()) return;
        rendering = true;
        frameStartedAt = performance.now();
        lastFrame = frameStartedAt;
        engine.runRenderLoop(renderFrame);
      };
      const stopLoop = () => {
        if (!engine || !rendering) return;
        engine.stopRenderLoop(renderFrame);
        rendering = false;
      };
      const applyMotionPreference = () => {
        if (motionQuery.matches) {
          stopLoop();
          draw(performance.now(), true);
        } else {
          startLoop();
        }
      };
      const resize = () => {
        engine?.resize();
        if (motionQuery.matches) draw(performance.now(), true);
      };

      motionQuery.addEventListener("change", applyMotionPreference);
      window.addEventListener("resize", resize);
      applyMotionPreference();

      return () => {
        frameGuard.dispose();
        motionQuery.removeEventListener("change", applyMotionPreference);
        window.removeEventListener("resize", resize);
        stopLoop();
        scene?.dispose();
        engine?.dispose();
      };
    } catch {
      scene?.dispose();
      engine?.dispose();
      if (frameGuard.acceptsFrame()) setUnavailable(true);
    }
  }, []);

  return <figure className="system-world-preview">
    <div className="system-world-preview__viewport">
      <canvas ref={canvasRef} className="system-world-preview__canvas" aria-label="Animated World preview: a forming cartoon Earth orbited and lit by the Sun" />
      {unavailable ? <p className="system-world-preview__fallback" role="status">World preview unavailable</p> : null}
      <span className="system-world-preview__horizon" aria-hidden="true" />
    </div>
    <figcaption className="sr-only">Local World presentation preview</figcaption>
  </figure>;
}
