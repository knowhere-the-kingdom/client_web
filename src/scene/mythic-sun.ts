import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Engine } from "@babylonjs/core/Engines/engine";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Scalar } from "@babylonjs/core/Maths/math.scalar";
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

export type MythicSunPalette = Readonly<{
  heart: string;
  plasma: string;
  ember: string;
  shadow: string;
}>;

export type MythicSunOptions = Readonly<{
  diameter: number;
  quality: "low" | "medium" | "high";
  seed: number;
  palette: MythicSunPalette;
}>;

export type MythicSunAsset = Readonly<{
  root: TransformNode;
  meshes: readonly AbstractMesh[];
  setPosition(position: Vector3): void;
  update(deltaMs: number, visibility?: number): void;
}>;

// Ported from dev_prototype/src/lib/world-assets/mythic-sun.ts. The asset is
// native Babylon geometry and shaders, so it has no external model or texture.
const vertexShader = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
uniform mat4 worldViewProjection;
uniform mat4 world;
varying vec3 vNormal;
varying vec3 vPosition;
void main(void) {
  vec4 worldPosition = world * vec4(position, 1.0);
  vPosition = worldPosition.xyz;
  vNormal = normalize(mat3(world) * normal);
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;

const fragmentShader = `
precision highp float;
uniform float time;
uniform float seed;
uniform float visibility;
uniform vec3 heartColor;
uniform vec3 plasmaColor;
uniform vec3 emberColor;
uniform vec3 shadowColor;
uniform vec3 cameraPosition;
varying vec3 vNormal;
varying vec3 vPosition;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.13, 0.17, 0.19));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 p) {
  vec3 cell = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(cell), hash(cell + vec3(1, 0, 0)), f.x),
        mix(hash(cell + vec3(0, 1, 0)), hash(cell + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(cell + vec3(0, 0, 1)), hash(cell + vec3(1, 0, 1)), f.x),
        mix(hash(cell + vec3(0, 1, 1)), hash(cell + vec3(1, 1, 1)), f.x), f.y),
    f.z
  );
}
float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.56;
  for (int i = 0; i < 4; i++) {
    value += noise(p) * amplitude;
    p = p * 2.03 + vec3(7.1, 3.7, 5.9);
    amplitude *= 0.46;
  }
  return value;
}
void main(void) {
  vec3 n = normalize(vNormal);
  vec3 viewDirection = normalize(cameraPosition - vPosition);
  float longitude = atan(n.z, n.x);
  float latitude = asin(clamp(n.y, -1.0, 1.0));
  vec3 flow = n * 3.4 + vec3(
    time * 0.055,
    sin(longitude * 3.0 + time * 0.12) * 0.32,
    -time * 0.041
  );
  float broad = fbm(flow + seed * 0.071);
  float fine = noise(n * 13.0 + vec3(-time * 0.11, time * 0.07, seed));
  float fissure = smoothstep(0.46, 0.57, abs(sin(longitude * 4.0 + broad * 8.0 + latitude * 2.0)));
  float omen = smoothstep(0.54, 0.82, broad) * (0.45 + fine * 0.55);
  float rim = pow(1.0 - max(dot(n, viewDirection), 0.0), 2.5);
  vec3 color = mix(shadowColor, emberColor, smoothstep(0.08, 0.58, broad));
  color = mix(color, plasmaColor, fissure * 0.68 + fine * 0.18);
  color = mix(color, heartColor, 0.18 + omen * 0.46 + rim * 0.38);
  color *= 0.9 + broad * 0.3;
  gl_FragColor = vec4(color, visibility);
}`;

function segmentsFor(quality: MythicSunOptions["quality"]): number {
  if (quality === "low") return 20;
  if (quality === "high") return 40;
  return 28;
}

export function createMythicSun(scene: Scene, options: MythicSunOptions): MythicSunAsset {
  const root = new TransformNode("mythic-sun-root", scene);
  const core = MeshBuilder.CreateIcoSphere("mythic-sun-core", {
    radius: options.diameter * 0.5,
    subdivisions: options.quality === "high" ? 5 : options.quality === "low" ? 3 : 4,
  }, scene);
  core.parent = root;
  core.isPickable = false;
  core.alwaysSelectAsActiveMesh = true;

  const plasmaMaterial = new ShaderMaterial(
    "mythic-sun-plasma",
    scene,
    { vertexSource: vertexShader, fragmentSource: fragmentShader },
    {
      attributes: ["position", "normal"],
      uniforms: [
        "world",
        "worldViewProjection",
        "cameraPosition",
        "time",
        "seed",
        "visibility",
        "heartColor",
        "plasmaColor",
        "emberColor",
        "shadowColor",
      ],
    },
  );
  plasmaMaterial.backFaceCulling = true;
  plasmaMaterial.alphaMode = Engine.ALPHA_COMBINE;
  plasmaMaterial.setFloat("seed", options.seed);
  plasmaMaterial.setColor3("heartColor", Color3.FromHexString(options.palette.heart));
  plasmaMaterial.setColor3("plasmaColor", Color3.FromHexString(options.palette.plasma));
  plasmaMaterial.setColor3("emberColor", Color3.FromHexString(options.palette.ember));
  plasmaMaterial.setColor3("shadowColor", Color3.FromHexString(options.palette.shadow));
  core.material = plasmaMaterial;

  const shell = MeshBuilder.CreateIcoSphere("mythic-sun-corona-shell", {
    radius: options.diameter * 0.535,
    subdivisions: 2,
  }, scene);
  shell.parent = root;
  shell.isPickable = false;
  shell.alwaysSelectAsActiveMesh = true;
  const shellMaterial = new StandardMaterial("mythic-sun-corona", scene);
  shellMaterial.disableLighting = true;
  shellMaterial.backFaceCulling = false;
  shellMaterial.emissiveColor = Color3.FromHexString(options.palette.ember);
  shellMaterial.alpha = 0.2;
  shellMaterial.wireframe = true;
  shell.material = shellMaterial;

  const crown = MeshBuilder.CreateTorus("mythic-sun-omen-crown", {
    diameter: options.diameter * 1.38,
    thickness: options.diameter * 0.025,
    tessellation: segmentsFor(options.quality),
  }, scene);
  crown.parent = root;
  crown.rotation.x = Math.PI * 0.5;
  crown.rotation.z = -0.18;
  crown.isPickable = false;
  const crownMaterial = new StandardMaterial("mythic-sun-crown", scene);
  crownMaterial.disableLighting = true;
  crownMaterial.emissiveColor = Color3.FromHexString(options.palette.ember);
  crownMaterial.alpha = 0.34;
  crown.material = crownMaterial;

  let elapsedSeconds = 0;
  let currentVisibility = 0;
  return {
    root,
    meshes: [core, shell, crown],
    setPosition(position) {
      root.position.copyFrom(position);
    },
    update(deltaMs, visibility = 1) {
      elapsedSeconds += Math.min(deltaMs, 100) / 1000;
      currentVisibility += (Scalar.Clamp(visibility, 0, 1) - currentVisibility) * 0.12;
      plasmaMaterial.setFloat("time", elapsedSeconds);
      plasmaMaterial.setFloat("visibility", currentVisibility);
      shellMaterial.alpha = currentVisibility * (0.14 + Math.sin(elapsedSeconds * 0.73) * 0.035);
      crownMaterial.alpha = currentVisibility * (0.3 + Math.sin(elapsedSeconds * 0.41 + options.seed) * 0.04);
      shell.rotation.y = elapsedSeconds * 0.045;
      shell.rotation.z = -elapsedSeconds * 0.031;
      crown.rotation.y = elapsedSeconds * -0.027;
      root.setEnabled(currentVisibility > 0.002);
    },
  };
}
