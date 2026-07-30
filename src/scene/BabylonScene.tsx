import { useEffect, useRef } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Ray } from "@babylonjs/core/Culling/ray";
import { SolidParticleSystem } from "@babylonjs/core/Particles/solidParticleSystem";
import type { SolidParticle } from "@babylonjs/core/Particles/solidParticle";
import { characterController, gameplayMouseMode, routeCharacterBlockFaceTargetSource } from "../features/character-controller";
import type { CharacterActionSignal } from "../features/character-controller";
import { CHARACTER_INPUT_SETTINGS_EVENT, readCharacterInputSettings, type CharacterInputSettingsEventDetail } from "../features/character-controller/runtimeSettings";
import { persistWorldPosition, restoreWorldPosition } from "../features/character-controller/positionPersistence";
import type { WorldPositionIdentity } from "../features/character-controller/positionPersistence";
import { loadActiveStatefulWorld } from "./statefulWorldRuntime";
import type { GardenSceneProjectionV1 } from "../api/gateway-contract";
import { createMythicSun } from "./mythic-sun";
import { isSunInVisibleDaylightArc, prototypeSunPositionAt, safeSunVisualScale } from "./sun-orbit";
import { voxelHeadingFromForward } from "./compass-heading";
import { initialBindings } from "../hud/demoData";

const SEA_LEVEL = 0;
const SOLID_BASE = -42;
const VOXEL_CUBE_SIZE_METERS = 1;
const TERRAIN_SIZE = 24000;
const TERRAIN_CHUNK_SIZE = 512;
const TERRAIN_CHUNK_SEGMENTS = 12;
const TERRAIN_CHUNK_RADIUS = Math.ceil(TERRAIN_SIZE / TERRAIN_CHUNK_SIZE / 2);
const TERRAIN_VERTICAL_SCALE = 4.85;
const PLAYER_EYE_HEIGHT = 2;
const BASE_CAMERA_SPEED = 6;
const MAX_SPRINT_MULTIPLIER = 10 / 6;
const DODGE_SPEED = 52;
const PLAYER_GRAVITY = -18;
const PLAYER_JUMP_IMPULSE = 6.2;
const PLAYER_FLIGHT_VERTICAL_SPEED = 9;
const CROUCH_EYE_HEIGHT = 1.2;
const OCEAN_SIZE = 240000;
const DEFAULT_MOUSE_X = 50;
const DEFAULT_MOUSE_Y = 44;
const LOOK_YAW_RADIANS = 2.4;
const LOOK_PITCH_RADIANS = 2.15;
const MIN_CAMERA_PITCH = -Math.PI / 2 + 0.05;
const MAX_CAMERA_PITCH = Math.PI / 2 - 0.05;
export const WORLD_MAP_ZOOM_STEPS = [100, 200, 400, 800, 1600, 3200, 6400, 12800, 24000, 48000] as const;

export function sunOrbitRadiansAt(
  schedule: GardenSceneProjectionV1["sun"],
  nowMs = Date.now(),
): number {
  const day = schedule.dayDurationSeconds;
  const night = schedule.nightDurationSeconds;
  const cycle = day + night;
  const elapsedSeconds = (nowMs - Date.parse(schedule.cycleEpoch)) / 1000 + schedule.cycleOffsetSeconds;
  const elapsedInCycle = ((elapsedSeconds % cycle) + cycle) % cycle;
  return elapsedInCycle < day
    ? (elapsedInCycle / day) * Math.PI
    : Math.PI + ((elapsedInCycle - day) / night) * Math.PI;
}

export type WorldgenGeneratorConfig = {
  seed: number;
  polygonCellSize: number;
  islandWarp: number;
  islandLobes: number;
  mountainScale: number;
  mountainSharpness: number;
  terraceStrength: number;
  waterDensity: number;
  moisture: number;
  vegetation: number;
  snowline: number;
};

export const DEFAULT_WORLDGEN_GENERATOR_CONFIG: WorldgenGeneratorConfig = {
  seed: 1337,
  polygonCellSize: 3600,
  islandWarp: 1,
  islandLobes: 1,
  mountainScale: 1,
  mountainSharpness: 1,
  terraceStrength: 1,
  waterDensity: 1,
  moisture: 1,
  vegetation: 1,
  snowline: 1
};

let activeWorldgenGeneratorConfig = DEFAULT_WORLDGEN_GENERATOR_CONFIG;

export function getWorldgenGeneratorConfig() {
  return activeWorldgenGeneratorConfig;
}

export function setWorldgenGeneratorConfig(config: WorldgenGeneratorConfig) {
  activeWorldgenGeneratorConfig = config;
}

export function applyCharacterLookToCamera(camera: UniversalCamera, look: Readonly<{ yaw: number; pitch: number }>, settings = { mouseX: DEFAULT_MOUSE_X, mouseY: DEFAULT_MOUSE_Y, invertMouseY: false }) {
  if (look.yaw === 0 && look.pitch === 0) return;
  const yawSensitivity = LOOK_YAW_RADIANS * Math.max(1, settings.mouseX) / DEFAULT_MOUSE_X;
  const pitchSensitivity = LOOK_PITCH_RADIANS * Math.max(1, settings.mouseY) / DEFAULT_MOUSE_Y;
  camera.rotation.y += look.yaw * yawSensitivity;
  camera.rotation.x = Math.max(MIN_CAMERA_PITCH, Math.min(MAX_CAMERA_PITCH, camera.rotation.x + look.pitch * pitchSensitivity * (settings.invertMouseY ? -1 : 1)));
}

export function makeWorldgenGeneratorConfig(seed: number, overrides: Partial<WorldgenGeneratorConfig> = {}): WorldgenGeneratorConfig {
  return { ...DEFAULT_WORLDGEN_GENERATOR_CONFIG, seed, ...overrides };
}

export type WorldgenMapLayerId =
  | "layers"
  | "final"
  | "height"
  | "latitude"
  | "temperature"
  | "humidity"
  | "macro"
  | "mountains"
  | "rainshadow"
  | "plateaus"
  | "plains"
  | "springs"
  | "rivers"
  | "creeks"
  | "deltas"
  | "lakes"
  | "ponds"
  | "swamps"
  | "marshes"
  | "valleys"
  | "floodplains"
  | "canyons"
  | "biomes"
  | "materials"
  | "volcanic"
  | "lava"
  | "craters"
  | "light"
  | "poi"
  | "nations"
  | "roads";

const VOXEL_MATERIAL = {
  water: 0,
  sand: 1,
  gravel: 2,
  stone: 3,
  soil: 4,
  vegetation: 5,
  ice: 6,
  lava: 7
} as const;

const VOXEL_FLAGS = {
  daylightSurface: 1,
  vegetationCandidate: 2
} as const;

type VoxelCell = {
  density: number;
  material: number;
  texture: number;
  flags: number;
  light: number;
};

type TerrainSample = {
  height: number;
  color: Color4;
  moisture: number;
  heat: number;
  canyon: number;
  biome: BiomeId;
  maps: WorldMapPasses;
  voxel: VoxelCell;
};

type BiomeId = "ocean" | "desert" | "savannah" | "temperate" | "rainforest" | "cold" | "volcanic";

type HeightBlendMode = "add" | "max" | "multiply";

type HeightMixControl = {
  name: string;
  scale: number;
  seedX: number;
  seedZ: number;
  weight: number;
  octaves?: number;
  curve?: number;
  remap?: [number, number];
  blend?: HeightBlendMode;
  noise?: "value" | "ridge";
  mask?: (maps: Partial<WorldMapPasses>) => number;
};

type WorldMapPasses = {
  nx: number;
  nz: number;
  distance: number;
  landMask: number;
  innerLand: number;
  latitude: number;
  temperature: number;
  humidity: number;
  smoothFields: number;
  biomeRegion: number;
  mountainRange: number;
  mountainSpine: number;
  ridgeDistance: number;
  mountainSteep: number;
  mountainCliff: number;
  mountainCanyon: number;
  mountainPeak: number;
  mountainMeadow: number;
  orographicRain: number;
  rainShadow: number;
  dryness: number;
  plateau: number;
  plains: number;
  volcanicTraps: number;
  volcano: number;
  crater: number;
  lavaField: number;
  lavaFlow: number;
  heightBase: number;
  height: number;
  spring: number;
  river: number;
  creek: number;
  valley: number;
  floodPlain: number;
  canyon: number;
  delta: number;
  lake: number;
  pond: number;
  swamp: number;
  marsh: number;
  biome: BiomeId;
  light: number;
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number) {
  return value * value * (3 - 2 * value);
}

function smoothstepRange(edge0: number, edge1: number, value: number) {
  return smoothstep(clamp01((value - edge0) / (edge1 - edge0)));
}

function mix(a: number, b: number, amount: number) {
  return a * (1 - amount) + b * amount;
}

function terrace(value: number, step: number, strength: number) {
  if (step <= 0 || strength <= 0) return value;
  const stepped = Math.round(value / step) * step;
  return mix(value, stepped, clamp01(strength));
}

function hash2(x: number, z: number) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function seedOffset(axis: number) {
  return activeWorldgenGeneratorConfig.seed * (axis * 0.0137 + 0.031);
}

function valueNoise(x: number, z: number) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const xf = smoothstep(x - x0);
  const zf = smoothstep(z - z0);
  const a = hash2(x0, z0);
  const b = hash2(x0 + 1, z0);
  const c = hash2(x0, z0 + 1);
  const d = hash2(x0 + 1, z0 + 1);
  return (a * (1 - xf) + b * xf) * (1 - zf) + (c * (1 - xf) + d * xf) * zf;
}

function ridgeNoise(x: number, z: number) {
  return 1 - Math.abs(valueNoise(x, z) * 2 - 1);
}

function layeredNoise(x: number, z: number, octaves = 4) {
  let total = 0;
  let amplitude = 1;
  let frequency = 1;
  let max = 0;

  for (let i = 0; i < octaves; i += 1) {
    total += valueNoise(x * frequency, z * frequency) * amplitude;
    max += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return total / max;
}

function colorMix(a: Color4, b: Color4, amount: number) {
  return new Color4(mix(a.r, b.r, amount), mix(a.g, b.g, amount), mix(a.b, b.b, amount), 1);
}

function regionBand(value: number, center: number, width: number) {
  return clamp01(1 - Math.abs(value - center) / width);
}

function polygonRegion(x: number, z: number, cellSize: number, seedX: number, seedZ: number) {
  const gx = Math.floor(x / cellSize);
  const gz = Math.floor(z / cellSize);
  let bestDistance = Number.POSITIVE_INFINITY;
  let secondDistance = Number.POSITIVE_INFINITY;
  let bestX = 0;
  let bestZ = 0;
  let bestCellX = 0;
  let bestCellZ = 0;

  for (let oz = -1; oz <= 1; oz += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const cellX = gx + ox;
      const cellZ = gz + oz;
      const jitterX = hash2(cellX + seedX, cellZ + seedZ);
      const jitterZ = hash2(cellX - seedZ, cellZ + seedX);
      const cx = (cellX + 0.18 + jitterX * 0.64) * cellSize;
      const cz = (cellZ + 0.18 + jitterZ * 0.64) * cellSize;
      const distance = Math.hypot(x - cx, z - cz);
      if (distance < bestDistance) {
        secondDistance = bestDistance;
        bestDistance = distance;
        bestX = cx;
        bestZ = cz;
        bestCellX = cellX;
        bestCellZ = cellZ;
      } else if (distance < secondDistance) {
        secondDistance = distance;
      }
    }
  }

  return {
    centerX: bestX,
    centerZ: bestZ,
    distance: bestDistance,
    edge: clamp01((secondDistance - bestDistance) / (cellSize * 0.42)),
    value: hash2(bestCellX + seedX * 3.17, bestCellZ + seedZ * 5.31)
  };
}

const heightMixControls: HeightMixControl[] = [
  { name: "rolling-fields", scale: 0.0016, seedX: 0, seedZ: 0, weight: 16, octaves: 3, remap: [-0.5, 0.5], mask: (maps) => 1 - (maps.smoothFields ?? 0) * 0.82 },
  { name: "hill-domes", scale: 0.0022, seedX: -21, seedZ: 32, weight: 36, octaves: 3, curve: 1.95, mask: (maps) => 0.45 + (1 - (maps.smoothFields ?? 0) * 0.82) * 0.55 },
  { name: "mountain-ranges", scale: 0.00092, seedX: -70, seedZ: 45, weight: 125, curve: 2.45, noise: "ridge", mask: (maps) => maps.mountainRange ?? 0 },
  { name: "summit-anchor", scale: 1, seedX: 0, seedZ: 0, weight: 118, blend: "max", mask: () => 1 },
  { name: "coastal-shelf", scale: 1, seedX: 0, seedZ: 0, weight: -18, mask: (maps) => smoothstepRange(0.68, 1.03, maps.distance ?? 0) }
];

function sampleHeightControl(control: HeightMixControl, x: number, z: number, maps: Partial<WorldMapPasses>) {
  let value = 0;
  if (control.name === "summit-anchor") {
    value = Math.exp(-((x - 140) * (x - 140) + (z - 230) * (z - 230)) / 18000);
  } else {
    const nx = x * control.scale + control.seedX;
    const nz = z * control.scale + control.seedZ;
    value = control.noise === "ridge" ? ridgeNoise(nx, nz) : layeredNoise(nx, nz, control.octaves ?? 4);
  }
  if (control.remap) value = mix(control.remap[0], control.remap[1], value);
  if (control.curve) value = Math.pow(Math.max(0, value), control.curve);
  return value * control.weight * (control.mask?.(maps) ?? 1);
}

function runHeightMixControls(x: number, z: number, maps: Partial<WorldMapPasses>) {
  return heightMixControls.reduce((height, control) => {
    const value = sampleHeightControl(control, x, z, maps);
    if (control.blend === "max") return Math.max(height, value);
    if (control.blend === "multiply") return height * value;
    return height + value;
  }, 8);
}

function sampleBaseWorldMaps(x: number, z: number): Partial<WorldMapPasses> {
  const config = activeWorldgenGeneratorConfig;
  const seedX = seedOffset(1);
  const seedZ = seedOffset(2);
  const half = TERRAIN_SIZE * 0.5;
  const nx = x / half;
  const nz = z / half;
  const warpX = (layeredNoise(x * 0.00024 + 18 + seedX, z * 0.00024 - 41 + seedZ, 4) - 0.5) * 0.32 * config.islandWarp;
  const warpZ = (layeredNoise(x * 0.00022 - 77 + seedZ, z * 0.00022 + 108 - seedX, 4) - 0.5) * 0.28 * config.islandWarp;
  const lobeA = (1 - smoothstepRange(0.25, 0.86, Math.hypot(nx + 0.34 + seedX * 0.005, nz - 0.22))) * config.islandLobes;
  const lobeB = (1 - smoothstepRange(0.18, 0.72, Math.hypot(nx - 0.38, nz + 0.34 + seedZ * 0.005))) * config.islandLobes;
  const warpedNx = nx * 0.9 + warpX + lobeA * -0.07 + lobeB * 0.08;
  const warpedNz = nz * 1.08 + warpZ + lobeA * 0.05 + lobeB * -0.05;
  const distance = Math.sqrt(warpedNx * warpedNx + warpedNz * warpedNz);
  const coastNoise = (layeredNoise(x * 0.00056 + 18 + seedX, z * 0.00056 - 41 + seedZ, 4) - 0.5) * 0.2;
  const islandShape = 1 - smoothstepRange(0.76 + coastNoise, 1.03 + coastNoise, distance);
  const islandLobes = clamp01(islandShape + lobeA * 0.26 + lobeB * 0.22);
  const landMask = islandLobes * (1 - smoothstepRange(1.04, 1.24, Math.sqrt(nx * nx + nz * nz)));
  const innerLand = smoothstepRange(0.18, 0.7, landMask);
  const smoothFields = smoothstepRange(0.42, 0.74, layeredNoise(x * 0.00115 + 90 + seedX, z * 0.00115 - 25 + seedZ, 4));
  const biomeRegionCell = polygonRegion(x, z, config.polygonCellSize, 13 + seedX, -29 + seedZ);
  const mountainTypeCell = polygonRegion(x, z, config.polygonCellSize * 0.83, -47 + seedZ, 71 - seedX);
  const latitude = clamp01((z / TERRAIN_SIZE) + 0.5);
  const mountainSpineX = -z * 0.28 + Math.sin(z * 0.00016 + 0.8 + seedX) * 1250 + Math.sin(z * 0.00034 - 1.4 + seedZ) * 420;
  const ridgeDistance = Math.abs(x - mountainSpineX);
  const spineMask = (1 - smoothstepRange(760, 3800 / config.mountainScale, ridgeDistance)) * smoothstepRange(0.18, 0.84, landMask);
  const peakRhythm = smoothstepRange(0.42, 0.94, ridgeNoise(z * 0.00012 + 12 + seedZ, x * 0.00005 - 9 + seedX));
  const mountainRange = clamp01(spineMask * (0.58 + peakRhythm * 0.55 * config.mountainSharpness));
  const typeValue = mountainTypeCell.value;
  const mountainSteep = clamp01(mountainRange * regionBand(typeValue, 0.08, 0.24));
  const mountainCliff = clamp01(mountainRange * regionBand(typeValue, 0.28, 0.22));
  const mountainCanyon = clamp01(mountainRange * regionBand(typeValue, 0.48, 0.22));
  const mountainPeak = clamp01(mountainRange * regionBand(typeValue, 0.68, 0.23));
  const mountainMeadow = clamp01(mountainRange * regionBand(typeValue, 0.9, 0.22));
  const westOfRange = x < mountainSpineX ? 1 : 0;
  const eastOfRange = 1 - westOfRange;
  const orographicRain = westOfRange * (1 - smoothstepRange(600, 3700, ridgeDistance)) * smoothstepRange(0.24, 0.86, landMask);
  const rainShadow = eastOfRange * (1 - smoothstepRange(900, 5600, ridgeDistance)) * smoothstepRange(0.32, 0.9, landMask) * (0.45 + mountainRange * 0.55);
  const rawHumidity = layeredNoise(x * 0.00018 - 120 + seedX, z * 0.00018 + 66 + seedZ, 4);
  const temperature = clamp01(0.64 - latitude * 0.58 + (layeredNoise(x * 0.00034 + seedX, z * 0.00034 + seedZ, 3) - 0.5) * 0.22);
  const oceanHumidity = smoothstepRange(0.96, 0.56, distance) * 0.12;
  const regionHumidityBias = mix(-0.16, 0.18, biomeRegionCell.value) * smoothstepRange(0.34, 0.92, landMask);
  const localHumidity = clamp01((rawHumidity * 0.45 + oceanHumidity + orographicRain * 0.42 - rainShadow * 0.5 + regionHumidityBias) * config.moisture);
  const dryness = clamp01(0.2 + rainShadow * 0.66 + temperature * 0.28 - localHumidity * 0.38 + regionBand(biomeRegionCell.value, 0.18, 0.22) * 0.18);
  const regionInterior = biomeRegionCell.edge;
  const regionBorder = 1 - biomeRegionCell.edge;
  const eastPlateau = eastOfRange * smoothstepRange(0.5, 0.84, layeredNoise(x * 0.0001 + 25 + seedX, z * 0.0001 - 18 + seedZ, 4)) * smoothstepRange(0.34, 0.86, dryness) * (0.68 + regionInterior * 0.32);
  const highBasin = smoothstepRange(0.58, 0.88, layeredNoise(x * 0.00012 - 61 + seedZ, z * 0.00012 + 44 - seedX, 3)) * (1 - smoothstepRange(0.78, 1.05, distance)) * (0.72 + regionInterior * 0.28);
  const plateau = clamp01(Math.max(eastPlateau, highBasin * mountainRange * 0.55) * landMask);
  const plains = clamp01(smoothFields * (1 - mountainRange * 0.86) * (1 - plateau * 0.36) * smoothstepRange(0.34, 0.92, landMask) * (0.72 + regionInterior * 0.28));
  const volcanicCenterDistance = Math.sqrt((x - 4300) * (x - 4300) + (z + 3700) * (z + 3700));
  const secondaryVolcanicDistance = Math.sqrt((x + 6100) * (x + 6100) + (z + 4800) * (z + 4800));
  const volcanicProvince = Math.max(
    1 - smoothstepRange(1800, 4700, volcanicCenterDistance),
    (1 - smoothstepRange(1300, 3300, secondaryVolcanicDistance)) * 0.72
  ) * smoothstepRange(0.28, 0.82, landMask);
  const volcanicTraps = clamp01(volcanicProvince * (0.58 + plateau * 0.34 + ridgeNoise(x * 0.00028 + 17 + seedX, z * 0.00028 - 19 + seedZ) * 0.22));
  const volcano = Math.max(
    1 - smoothstepRange(0, 1450, volcanicCenterDistance),
    (1 - smoothstepRange(0, 950, secondaryVolcanicDistance)) * 0.8
  ) * landMask;
  const craterRing = Math.max(
    smoothstepRange(420, 650, volcanicCenterDistance) * (1 - smoothstepRange(650, 1080, volcanicCenterDistance)),
    smoothstepRange(260, 410, secondaryVolcanicDistance) * (1 - smoothstepRange(410, 760, secondaryVolcanicDistance)) * 0.78
  ) * landMask;
  const lavaField = clamp01(volcanicTraps * smoothstepRange(0.52, 0.88, ridgeNoise(x * 0.00042 - 4 + seedX, z * 0.00042 + 8 + seedZ)) + volcano * 0.38);
  const lavaFlow = clamp01(lavaField * (1 - smoothstepRange(0.26, 0.72, plains)) * smoothstepRange(0.42, 0.95, ridgeNoise((x + z) * 0.00038 + seedX, (z - x) * 0.00038 + seedZ)));

  return {
    nx,
    nz,
    distance,
    landMask,
    innerLand,
    latitude,
    temperature,
    humidity: localHumidity,
    smoothFields,
    biomeRegion: biomeRegionCell.value,
    mountainRange,
    mountainSpine: spineMask,
    ridgeDistance,
    mountainSteep,
    mountainCliff,
    mountainCanyon,
    mountainPeak,
    mountainMeadow,
    orographicRain,
    rainShadow,
    dryness,
    plateau,
    plains,
    volcanicTraps,
    volcano,
    crater: craterRing,
    lavaField,
    lavaFlow
  };
}

function sampleHydrologyPasses(x: number, z: number, maps: Partial<WorldMapPasses>) {
  const config = activeWorldgenGeneratorConfig;
  const seedX = seedOffset(3);
  const seedZ = seedOffset(4);
  const landMask = maps.landMask ?? 0;
  const heightBase = maps.heightBase ?? 0;
  const humidity = maps.humidity ?? 0;
  const mountainRange = maps.mountainRange ?? 0;
  const distance = maps.distance ?? 0;
  const dryness = maps.dryness ?? 0;
  const ridgeDistance = maps.ridgeDistance ?? 9999;
  const mountainCanyon = maps.mountainCanyon ?? 0;
  const waterRegion = polygonRegion(x, z, config.polygonCellSize * 0.72, 37 + seedX, -89 + seedZ);
  const springRegion = polygonRegion(x, z, config.polygonCellSize * 0.42, -23 + seedZ, 41 - seedX);
  const canyonPath = Math.sin(x * 0.00058 + seedX) * 780 + Math.sin(x * 0.0011 + 2.2 + seedZ) * 250 - 420;
  const canyonDistance = Math.abs(z - canyonPath);
  const dryMountainWaterPotential = smoothstepRange(0.48, 0.86, dryness) * smoothstepRange(0.38, 0.88, mountainRange) * smoothstepRange(900, 4800, ridgeDistance);
  const polygonRiverEdge = (1 - smoothstepRange(0.025, 0.18, waterRegion.edge)) * smoothstepRange(62, 190, heightBase) * smoothstepRange(0.22, 0.86, humidity + mountainRange * 0.24) * smoothstepRange(0.3, 0.92, landMask) * config.waterDensity;

  const riverA = Math.sin(x * 0.00036 + 0.9 + seedX) * 1450 + Math.sin(x * 0.0009 - 1.7 + seedZ) * 520 - 450;
  const riverB = Math.sin((x + z) * 0.00032 - 1.4 + seedZ) * 1250 + 740;
  const river = Math.max(
    1 - smoothstepRange(24, 150, Math.abs(z - riverA)),
    1 - smoothstepRange(30, 180, Math.abs(z * 0.52 + x * 0.35 - riverB)),
    polygonRiverEdge * 0.46
  ) * smoothstepRange(0.36, 0.88, landMask) * (0.58 + (1 - waterRegion.edge) * 0.34 + smoothstepRange(0.2, 0.86, humidity) * 0.22);

  const creekA = riverA + Math.sin(x * 0.0012 + 2.4 + seedX) * 420 + Math.sin(z * 0.0007 + seedZ) * 260;
  const creek = Math.max(
    1 - smoothstepRange(12, 86, Math.abs(z - creekA)),
    (1 - smoothstepRange(0.04, 0.22, springRegion.edge)) * polygonRiverEdge * 0.68
  ) * smoothstepRange(0.48, 0.94, landMask) * smoothstepRange(0.26, 0.9, humidity + mountainRange * 0.25);
  const springSpot = 1 - smoothstepRange(70, 430, springRegion.distance);
  const spring = springSpot * smoothstepRange(0.46, 0.9, humidity + mountainRange * 0.34) * smoothstepRange(84, 176, heightBase) * smoothstepRange(0.34, 0.9, mountainRange) * (1 - (maps.lavaField ?? 0) * 0.75);
  const lakeBasin = (1 - smoothstepRange(90, 620, waterRegion.distance)) * smoothstepRange(0.38, 0.92, waterRegion.value) * smoothstepRange(0.26, 0.92, waterRegion.edge);
  const lake = lakeBasin * smoothstepRange(8, 92, heightBase) * smoothstepRange(0.38, 0.92, humidity + river * 0.28) * landMask * (1 - mountainRange * 0.38);
  const pond = (1 - smoothstepRange(60, 340, polygonRegion(x, z, config.polygonCellSize * 0.3, 91 + seedX, 12 + seedZ).distance)) * smoothstepRange(2, 56, heightBase) * smoothstepRange(0.24, 0.82, humidity) * landMask * config.waterDensity;
  const nearCoast = smoothstepRange(0.62, 0.9, distance) * smoothstepRange(0.42, 0.82, landMask);
  const delta = river * nearCoast * smoothstepRange(0.42, 0.82, humidity);
  const floodPlain = river * smoothstepRange(0.18, 0.72, humidity) * smoothstepRange(SEA_LEVEL - 5, SEA_LEVEL + 38, heightBase);
  const marsh = smoothstepRange(0.64, 0.88, humidity) * smoothstepRange(SEA_LEVEL - 2, SEA_LEVEL + 18, heightBase) * landMask;
  const swamp = smoothstepRange(0.76, 0.94, humidity) * smoothstepRange(SEA_LEVEL - 4, SEA_LEVEL + 14, heightBase) * smoothstepRange(0.42, 0.82, landMask);
  const valley = clamp01(river * 0.75 + creek * 0.48 + spring * 0.18);
  const dryRiverCanyon = Math.max(river, creek * 0.8) * dryMountainWaterPotential;
  const canyonMask = clamp01(
    (1 - smoothstepRange(24, 170, canyonDistance)) * smoothstepRange(0.52, 0.85, landMask) * (0.35 + dryness * 0.65) +
    dryRiverCanyon * 0.95 +
    mountainCanyon * smoothstepRange(0.22, 0.82, dryness) * 0.45
  );

  return { spring, river, creek, valley, floodPlain, canyon: canyonMask, delta, lake, pond, swamp, marsh };
}

function classifyBiome(maps: WorldMapPasses): BiomeId {
  if (maps.height <= SEA_LEVEL || maps.landMask < 0.25) return "ocean";
  if (maps.volcanicTraps > 0.48 || maps.lavaField > 0.5 || maps.volcano > 0.38) return "volcanic";
  if (maps.temperature < 0.26 || (maps.height > 126 && maps.temperature < 0.42)) return "cold";
  if (maps.dryness > 0.62 && maps.temperature > 0.38) return "desert";
  if (maps.temperature > 0.56 && maps.humidity < 0.62) return "savannah";
  if (maps.temperature > 0.48 && maps.humidity > 0.68) return "rainforest";
  return "temperate";
}

function sampleWorldMaps(x: number, z: number): WorldMapPasses {
  const config = activeWorldgenGeneratorConfig;
  const base = sampleBaseWorldMaps(x, z);
  const rawLand = runHeightMixControls(x, z, base);
  const oldPeakLift = Math.pow(ridgeNoise(x * 0.0019 - 70 + seedOffset(5), z * 0.0019 + 45 + seedOffset(6)), 2.7) * (base.mountainPeak ?? 0) * 205 * config.mountainSharpness;
  const cliffLift = (base.mountainCliff ?? 0) * 118;
  const meadowSoftener = (base.mountainMeadow ?? 0) * 42;
  const mountainLift = ((base.mountainSpine ?? 0) * 108 + (base.mountainRange ?? 0) * 190 + oldPeakLift + cliffLift - meadowSoftener) * config.mountainScale;
  const plateauLift = (base.plateau ?? 0) * 92;
  const volcanicLift = (base.volcanicTraps ?? 0) * 66 + (base.volcano ?? 0) * 170 - (base.crater ?? 0) * 74;
  const plainsCalm = (base.plains ?? 0) * (1 - (base.mountainRange ?? 0)) * 10;
  const preTerraceHeight = rawLand + mountainLift + plateauLift + volcanicLift - plainsCalm + 10 * (base.innerLand ?? 0);
  const terraceStrength = clamp01(((base.plateau ?? 0) * 0.92 + (base.volcanicTraps ?? 0) * 0.7 + (base.mountainSteep ?? 0) * 0.58 + (base.mountainCliff ?? 0) * 0.86 + (base.mountainCanyon ?? 0) * 0.72) * config.terraceStrength);
  const terraceStep = mix(32, 58, clamp01((base.mountainCliff ?? 0) + (base.mountainCanyon ?? 0) + (base.volcanicTraps ?? 0) * 0.6));
  const terracedHeight = terrace(preTerraceHeight, terraceStep, terraceStrength);
  const heightBase = mix(-24, terracedHeight, base.landMask ?? 0);
  const hydrology = sampleHydrologyPasses(x, z, { ...base, heightBase });
  const waterHumidity = clamp01(hydrology.river * 0.26 + hydrology.creek * 0.16 + hydrology.lake * 0.34 + hydrology.pond * 0.18 + hydrology.delta * 0.26);
  const canyonCut = hydrology.canyon * (22 + ridgeNoise(x * 0.0048 + 80, z * 0.0048 - 10) * 20) * (1 + (base.dryness ?? 0) * (base.mountainRange ?? 0) * 0.82);
  const riverCut = hydrology.river * (5 + hydrology.floodPlain * 7 + (base.dryness ?? 0) * (base.mountainRange ?? 0) * 9);
  const creekCut = hydrology.creek * (3.8 + (base.dryness ?? 0) * (base.mountainRange ?? 0) * 5.5);
  const wetlandCut = Math.max(hydrology.lake * 4, hydrology.pond * 2.5, hydrology.swamp * 1.5, hydrology.marsh * 1.2);
  const deltaBuild = hydrology.delta * 3.5;
  const spawnViewRise = Math.exp(-((x + 70) * (x + 70) + (z + 190) * (z + 190)) / 52000) * 22 * (base.landMask ?? 0);
  const height = heightBase - canyonCut - riverCut - creekCut - wetlandCut + deltaBuild + spawnViewRise + (base.landMask ?? 0) * 3.5;
  const light = clamp01(0.24 + smoothstepRange(SEA_LEVEL + 1, SEA_LEVEL + 34, height) * 0.42 + smoothstepRange(0.28, 0.7, base.landMask ?? 0) * 0.2 - hydrology.canyon * 0.28 - hydrology.valley * 0.12);
  const maps = {
    nx: base.nx ?? 0,
    nz: base.nz ?? 0,
    distance: base.distance ?? 0,
    landMask: base.landMask ?? 0,
    innerLand: base.innerLand ?? 0,
    latitude: base.latitude ?? 0,
    temperature: base.temperature ?? 0,
    humidity: clamp01((base.humidity ?? 0) + waterHumidity),
    smoothFields: base.smoothFields ?? 0,
    biomeRegion: base.biomeRegion ?? 0,
    mountainRange: base.mountainRange ?? 0,
    mountainSpine: base.mountainSpine ?? 0,
    ridgeDistance: base.ridgeDistance ?? 0,
    mountainSteep: base.mountainSteep ?? 0,
    mountainCliff: base.mountainCliff ?? 0,
    mountainCanyon: base.mountainCanyon ?? 0,
    mountainPeak: base.mountainPeak ?? 0,
    mountainMeadow: base.mountainMeadow ?? 0,
    orographicRain: base.orographicRain ?? 0,
    rainShadow: base.rainShadow ?? 0,
    dryness: base.dryness ?? 0,
    plateau: base.plateau ?? 0,
    plains: base.plains ?? 0,
    volcanicTraps: base.volcanicTraps ?? 0,
    volcano: base.volcano ?? 0,
    crater: base.crater ?? 0,
    lavaField: base.lavaField ?? 0,
    lavaFlow: base.lavaFlow ?? 0,
    heightBase,
    height,
    ...hydrology,
    light,
    biome: "temperate" as BiomeId
  };

  return { ...maps, biome: classifyBiome(maps) };
}

export function sampleWorldgenDebugMap(x: number, z: number) {
  return sampleWorldMaps(x, z);
}

function terrainSample(x: number, z: number): TerrainSample {
  const maps = sampleWorldMaps(x, z);
  const height = maps.height;
  const moisture = maps.humidity;
  const heat = maps.temperature;
  const daylight = maps.light;

  const wetSoil = new Color4(0.18, 0.105, 0.062, 1);
  const plainsSoil = new Color4(0.38, 0.245, 0.145, 1);
  const drySoil = new Color4(0.58, 0.43, 0.255, 1);
  const beachSand = new Color4(0.72, 0.61, 0.39, 1);
  const desertSand = new Color4(0.83, 0.69, 0.42, 1);
  const canyonClay = new Color4(0.55, 0.235, 0.145, 1);
  const swampMud = new Color4(0.11, 0.105, 0.065, 1);
  const riverGravel = new Color4(0.36, 0.34, 0.29, 1);
  const iceBlue = new Color4(0.74, 0.88, 0.94, 1);
  const basalt = new Color4(0.15, 0.14, 0.13, 1);
  const lavaOrange = new Color4(1, 0.33, 0.035, 1);
  const vegetationGreen = new Color4(0.08, 0.48, 0.12, 1);
  const stoneLow = new Color4(0.39, 0.365, 0.32, 1);
  const stoneHigh = new Color4(0.58, 0.57, 0.525, 1);
  const paleCap = new Color4(0.72, 0.72, 0.67, 1);

  let material: number = VOXEL_MATERIAL.soil;
  let texture = Math.floor(layeredNoise(x * 0.045 + 14, z * 0.045 - 31, 3) * 4);
  let color = colorMix(drySoil, wetSoil, smoothstepRange(0.38, 0.78, moisture));
  color = colorMix(color, plainsSoil, smoothstepRange(0.32, 0.58, 1 - Math.abs(moisture - 0.5) * 2));
  if (height <= SEA_LEVEL) {
    material = VOXEL_MATERIAL.water;
    color = new Color4(0.04, 0.2, 0.25, 1);
  }
  if (maps.lake > 0.54 || maps.pond > 0.62 || maps.swamp > 0.66 || maps.marsh > 0.7) {
    material = VOXEL_MATERIAL.water;
    color = colorMix(new Color4(0.04, 0.2, 0.2, 1), swampMud, Math.max(maps.swamp, maps.marsh));
  }
  if (heat > 0.62 && moisture < 0.48) {
    material = VOXEL_MATERIAL.sand;
    color = colorMix(color, desertSand, smoothstepRange(0.58, 0.86, heat) * smoothstepRange(0.5, 0.2, moisture));
  }
  if (height < SEA_LEVEL + 7 || maps.delta > 0.28) {
    material = VOXEL_MATERIAL.sand;
    color = colorMix(beachSand, color, smoothstepRange(2, 16, height - SEA_LEVEL) * (1 - maps.delta * 0.4));
  }
  if (maps.river > 0.42 || maps.creek > 0.48 || maps.floodPlain > 0.5) {
    material = maps.floodPlain > 0.58 ? VOXEL_MATERIAL.soil : VOXEL_MATERIAL.gravel;
    color = colorMix(color, maps.floodPlain > 0.58 ? wetSoil : riverGravel, clamp01(maps.river + maps.creek + maps.floodPlain));
  }
  if (maps.canyon > 0.3) color = colorMix(color, canyonClay, clamp01((maps.canyon - 0.2) * 1.7));
  if (height > 64) {
    const stoneBand = Math.floor((height + layeredNoise(x * 0.04, z * 0.04, 2) * 20) / 18) % 2;
    material = height > 98 ? VOXEL_MATERIAL.stone : VOXEL_MATERIAL.gravel;
    texture = stoneBand;
    color = colorMix(color, stoneBand === 0 ? stoneLow : stoneHigh, smoothstepRange(58, 120, height));
  }
  if (maps.biome === "volcanic") {
    material = VOXEL_MATERIAL.stone;
    color = colorMix(color, basalt, 0.54 + maps.volcanicTraps * 0.24);
  }
  if (maps.lavaField > 0.72 || maps.lavaFlow > 0.66 || (maps.volcano > 0.72 && maps.crater > 0.28)) {
    material = VOXEL_MATERIAL.lava;
    color = colorMix(lavaOrange, new Color4(1, 0.58, 0.08, 1), Math.max(maps.lavaField, maps.lavaFlow, maps.volcano));
  }
  const snowCap = smoothstepRange(150 * activeWorldgenGeneratorConfig.snowline, 232 * activeWorldgenGeneratorConfig.snowline, height) * (0.35 + maps.mountainPeak * 0.5 + maps.mountainRange * 0.18) * (1 - smoothstepRange(0.46, 0.72, heat));
  if (snowCap > 0.04) color = colorMix(color, paleCap, clamp01(snowCap));
  if (maps.temperature < 0.24 && (material === VOXEL_MATERIAL.water || height > 92)) {
    material = VOXEL_MATERIAL.ice;
    color = colorMix(color, iceBlue, 0.84);
  }
  if (maps.canyon > 0.58 && height < 72) material = VOXEL_MATERIAL.gravel;

  const brightness = 0.86 + layeredNoise(x * 0.055, z * 0.055, 2) * 0.16;
  color.r *= brightness;
  color.g *= brightness;
  color.b *= brightness;

  const vegetationEligibleMaterials: number[] = [VOXEL_MATERIAL.sand, VOXEL_MATERIAL.gravel, VOXEL_MATERIAL.stone, VOXEL_MATERIAL.soil];
  const vegetationEligible = height > SEA_LEVEL + 2 && daylight > 0.54 && material !== VOXEL_MATERIAL.water && vegetationEligibleMaterials.includes(material);
  const vegetationScore = vegetationEligible ? clamp01((moisture * 0.72 + daylight * 0.38 - heat * 0.16 - maps.canyon * 0.42 + maps.marsh * 0.16) * activeWorldgenGeneratorConfig.vegetation) : 0;
  if (vegetationScore > 0.42) color = colorMix(color, vegetationGreen, smoothstepRange(0.42, 0.86, vegetationScore) * 0.72);
  const flags = (daylight > 0.54 ? VOXEL_FLAGS.daylightSurface : 0) | (vegetationScore > 0.42 ? VOXEL_FLAGS.vegetationCandidate : 0);

  return {
    height,
    color,
    moisture,
    heat,
    canyon: maps.canyon,
    biome: maps.biome,
    maps,
    voxel: {
      density: height - SEA_LEVEL,
      material: vegetationScore > 0.72 ? VOXEL_MATERIAL.vegetation : material,
      texture,
      flags,
      light: daylight
    }
  };
}

function mapRgb(color: Color4): [number, number, number] {
  return [
    Math.round(clamp01(color.r) * 255),
    Math.round(clamp01(color.g) * 255),
    Math.round(clamp01(color.b) * 255)
  ];
}

function gradientColor(value: number, stops: [number, number, number][]) {
  const clamped = clamp01(value);
  if (stops.length === 1) return stops[0];
  const scaled = clamped * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  const amount = scaled - index;
  const a = stops[index];
  const b = stops[index + 1];
  return [
    Math.round(mix(a[0], b[0], amount)),
    Math.round(mix(a[1], b[1], amount)),
    Math.round(mix(a[2], b[2], amount))
  ] as [number, number, number];
}

function biomeMapColor(biome: BiomeId): [number, number, number] {
  if (biome === "ocean") return [18, 116, 164];
  if (biome === "desert") return [245, 190, 77];
  if (biome === "savannah") return [201, 166, 74];
  if (biome === "rainforest") return [20, 155, 91];
  if (biome === "cold") return [177, 235, 245];
  if (biome === "volcanic") return [218, 72, 42];
  return [76, 188, 105];
}

function materialMapColor(material: number): [number, number, number] {
  if (material === VOXEL_MATERIAL.water) return [20, 149, 190];
  if (material === VOXEL_MATERIAL.sand) return [239, 206, 113];
  if (material === VOXEL_MATERIAL.gravel) return [130, 125, 111];
  if (material === VOXEL_MATERIAL.stone) return [189, 190, 176];
  if (material === VOXEL_MATERIAL.vegetation) return [34, 181, 68];
  if (material === VOXEL_MATERIAL.ice) return [196, 244, 255];
  if (material === VOXEL_MATERIAL.lava) return [255, 78, 8];
  return [127, 78, 42];
}

function overlayFromValue(value: number, palette: [number, number, number][], minAlpha = 0.12, maxAlpha = 0.72) {
  const amount = clamp01(value);
  return {
    color: gradientColor(amount, palette),
    alpha: mix(minAlpha, maxAlpha, amount)
  };
}

export function sampleWorldgenMapPixel(x: number, z: number, layer: WorldgenMapLayerId) {
  const sample = terrainSample(x, z);
  const maps = sample.maps;
  const base = mapRgb(sample.color);
  let overlay = { color: base, alpha: 0 };

  if (layer === "layers") {
    const composite = clamp01(maps.mountainRange * 0.38 + maps.river * 0.24 + maps.creek * 0.18 + maps.canyon * 0.32 + maps.delta * 0.2 + maps.light * 0.18);
    overlay = overlayFromValue(composite, [[21, 25, 60], [37, 221, 208], [255, 226, 82], [255, 72, 54]], 0.2, 0.78);
  } else if (layer === "height") {
    overlay = overlayFromValue(smoothstepRange(-28, 190, maps.height), [[15, 32, 75], [28, 130, 96], [225, 180, 83], [244, 250, 238]], 0.35, 0.8);
  } else if (layer === "latitude") {
    overlay = overlayFromValue(maps.latitude, [[104, 219, 255], [255, 217, 91], [77, 181, 255]], 0.4, 0.76);
  } else if (layer === "temperature") {
    overlay = overlayFromValue(maps.temperature, [[32, 98, 255], [253, 232, 94], [255, 75, 32]], 0.42, 0.82);
  } else if (layer === "humidity") {
    overlay = overlayFromValue(maps.humidity, [[127, 75, 34], [90, 194, 93], [47, 211, 255]], 0.4, 0.82);
  } else if (layer === "macro") {
    const macro = clamp01(maps.landMask * 0.18 + maps.plains * 0.18 + maps.plateau * 0.24 + maps.mountainSpine * 0.32 + maps.volcanicTraps * 0.28);
    overlay = overlayFromValue(macro, [[20, 65, 145], [92, 188, 84], [225, 194, 94], [235, 235, 225]], 0.28, 0.82);
  } else if (layer === "mountains") {
    const mountainTypeColor = gradientColor(
      maps.mountainPeak * 0.1 + maps.mountainCliff * 0.3 + maps.mountainCanyon * 0.5 + maps.mountainSteep * 0.7 + maps.mountainMeadow * 0.9,
      [[248, 248, 238], [97, 98, 104], [190, 86, 42], [165, 144, 102], [86, 165, 91]]
    );
    overlay = { color: mountainTypeColor, alpha: mix(0.2, 0.88, maps.mountainRange) };
  } else if (layer === "rainshadow") {
    overlay = overlayFromValue(maps.dryness, [[29, 119, 76], [220, 179, 75], [236, 103, 37]], 0.38, 0.86);
  } else if (layer === "plateaus") {
    overlay = overlayFromValue(maps.plateau, [[58, 40, 24], [190, 117, 51], [255, 214, 120]], 0.12, 0.82);
  } else if (layer === "plains") {
    overlay = overlayFromValue(maps.plains, [[43, 76, 34], [119, 204, 74], [231, 238, 138]], 0.12, 0.78);
  } else if (layer === "springs") {
    overlay = overlayFromValue(maps.spring, [[16, 50, 62], [100, 255, 231], [255, 255, 255]], 0.08, 0.9);
  } else if (layer === "rivers") {
    overlay = overlayFromValue(maps.river, [[7, 34, 88], [34, 192, 255], [231, 255, 255]], 0.08, 0.92);
  } else if (layer === "creeks") {
    overlay = overlayFromValue(maps.creek, [[18, 48, 74], [79, 242, 199], [241, 255, 214]], 0.08, 0.86);
  } else if (layer === "deltas") {
    overlay = overlayFromValue(maps.delta, [[35, 70, 54], [91, 231, 151], [245, 238, 133]], 0.08, 0.88);
  } else if (layer === "lakes") {
    overlay = overlayFromValue(maps.lake, [[7, 42, 80], [33, 157, 229], [191, 246, 255]], 0.08, 0.9);
  } else if (layer === "ponds") {
    overlay = overlayFromValue(maps.pond, [[15, 61, 64], [57, 211, 196], [213, 255, 243]], 0.08, 0.84);
  } else if (layer === "swamps") {
    overlay = overlayFromValue(maps.swamp, [[28, 31, 18], [73, 127, 49], [184, 218, 91]], 0.08, 0.86);
  } else if (layer === "marshes") {
    overlay = overlayFromValue(maps.marsh, [[34, 41, 24], [93, 167, 82], [202, 236, 126]], 0.08, 0.84);
  } else if (layer === "valleys") {
    overlay = overlayFromValue(maps.valley, [[32, 20, 44], [147, 76, 205], [245, 196, 255]], 0.14, 0.82);
  } else if (layer === "floodplains") {
    overlay = overlayFromValue(maps.floodPlain, [[45, 32, 18], [187, 129, 55], [255, 222, 126]], 0.1, 0.82);
  } else if (layer === "canyons") {
    overlay = overlayFromValue(maps.canyon, [[57, 19, 13], [205, 77, 40], [255, 197, 90]], 0.12, 0.92);
  } else if (layer === "biomes") {
    overlay = { color: biomeMapColor(maps.biome), alpha: maps.biome === "ocean" ? 0.42 : 0.68 };
  } else if (layer === "materials") {
    overlay = { color: materialMapColor(sample.voxel.material), alpha: 0.7 };
  } else if (layer === "volcanic") {
    overlay = overlayFromValue(Math.max(maps.volcanicTraps, maps.volcano), [[26, 22, 21], [105, 63, 45], [230, 80, 37]], 0.16, 0.88);
  } else if (layer === "lava") {
    overlay = overlayFromValue(Math.max(maps.lavaField, maps.lavaFlow), [[38, 10, 4], [255, 72, 6], [255, 221, 67]], 0.02, 0.94);
  } else if (layer === "craters") {
    overlay = overlayFromValue(Math.max(maps.crater, maps.volcano * 0.4), [[23, 20, 19], [115, 82, 67], [255, 151, 74]], 0.06, 0.86);
  } else if (layer === "light") {
    overlay = overlayFromValue(maps.light, [[8, 7, 18], [48, 106, 177], [255, 248, 172]], 0.35, 0.82);
  } else if (layer === "poi") {
    const poi = smoothstepRange(0.988, 1, hash2(Math.floor(x / 42), Math.floor(z / 42))) * smoothstepRange(0.48, 0.86, maps.landMask);
    overlay = overlayFromValue(poi, [[40, 30, 12], [255, 215, 71], [255, 255, 255]], 0, 0.92);
  } else if (layer === "nations") {
    const angle = (Math.atan2(z, x) + Math.PI) / (Math.PI * 2);
    overlay = overlayFromValue((Math.floor(angle * 12) % 12) / 11, [[217, 58, 58], [242, 204, 70], [69, 199, 116], [65, 170, 230], [190, 91, 240]], 0.22, maps.landMask > 0.32 ? 0.58 : 0.06);
  } else if (layer === "roads") {
    const road = Math.max(
      1 - smoothstepRange(0, 11, Math.abs(Math.sin((x + z) * 0.006) * 58)),
      1 - smoothstepRange(0, 8, Math.abs(Math.sin((x - z) * 0.005 + 1.2) * 72))
    ) * smoothstepRange(0.48, 0.86, maps.landMask) * (1 - maps.canyon * 0.7);
    overlay = overlayFromValue(road, [[61, 39, 14], [252, 210, 90], [255, 255, 228]], 0, 0.78);
  }

  return { base, overlay, height: maps.height };
}

function createTerrainChunk(scene: Scene, chunkX: number, chunkZ: number) {
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const soilColor = new Color4(0.28, 0.17, 0.1, 1);
  const chunkOriginX = chunkX * TERRAIN_CHUNK_SIZE;
  const chunkOriginZ = chunkZ * TERRAIN_CHUNK_SIZE;
  const halfChunk = TERRAIN_CHUNK_SIZE * 0.5;

  for (let z = 0; z <= TERRAIN_CHUNK_SEGMENTS; z += 1) {
    for (let x = 0; x <= TERRAIN_CHUNK_SEGMENTS; x += 1) {
      const worldX = chunkOriginX - halfChunk + (x / TERRAIN_CHUNK_SEGMENTS) * TERRAIN_CHUNK_SIZE;
      const worldZ = chunkOriginZ - halfChunk + (z / TERRAIN_CHUNK_SEGMENTS) * TERRAIN_CHUNK_SIZE;
      const sample = terrainSample(worldX, worldZ);
      positions.push(worldX, sample.height * TERRAIN_VERTICAL_SCALE, worldZ);
      colors.push(sample.color.r, sample.color.g, sample.color.b, sample.color.a);
    }
  }

  for (let z = 0; z < TERRAIN_CHUNK_SEGMENTS; z += 1) {
    for (let x = 0; x < TERRAIN_CHUNK_SEGMENTS; x += 1) {
      const i = z * (TERRAIN_CHUNK_SEGMENTS + 1) + x;
      indices.push(i, i + 1, i + TERRAIN_CHUNK_SEGMENTS + 1, i + 1, i + TERRAIN_CHUNK_SEGMENTS + 2, i + TERRAIN_CHUNK_SEGMENTS + 1);
    }
  }

  const addSkirt = (topA: number, topB: number) => {
    const ax = positions[topA * 3];
    const az = positions[topA * 3 + 2];
    const bx = positions[topB * 3];
    const bz = positions[topB * 3 + 2];
    const bottomA = positions.length / 3;
    const bottomB = bottomA + 1;
    positions.push(ax, SOLID_BASE, az, bx, SOLID_BASE, bz);
    colors.push(soilColor.r, soilColor.g, soilColor.b, soilColor.a, soilColor.r, soilColor.g, soilColor.b, soilColor.a);
    indices.push(topA, topB, bottomA, topB, bottomB, bottomA);
  };

  if (chunkZ === -TERRAIN_CHUNK_RADIUS) {
    for (let x = 0; x < TERRAIN_CHUNK_SEGMENTS; x += 1) {
      addSkirt(x, x + 1);
    }
  }

  if (chunkZ === TERRAIN_CHUNK_RADIUS) {
    for (let x = 0; x < TERRAIN_CHUNK_SEGMENTS; x += 1) {
      const south = TERRAIN_CHUNK_SEGMENTS * (TERRAIN_CHUNK_SEGMENTS + 1) + x;
      addSkirt(south + 1, south);
    }
  }

  if (chunkX === -TERRAIN_CHUNK_RADIUS) {
    for (let z = 0; z < TERRAIN_CHUNK_SEGMENTS; z += 1) {
      const west = z * (TERRAIN_CHUNK_SEGMENTS + 1);
      addSkirt(west + TERRAIN_CHUNK_SEGMENTS + 1, west);
    }
  }

  if (chunkX === TERRAIN_CHUNK_RADIUS) {
    for (let z = 0; z < TERRAIN_CHUNK_SEGMENTS; z += 1) {
      const east = z * (TERRAIN_CHUNK_SEGMENTS + 1) + TERRAIN_CHUNK_SEGMENTS;
      addSkirt(east, east + TERRAIN_CHUNK_SEGMENTS + 1);
    }
  }

  VertexData.ComputeNormals(positions, indices, normals);

  const applyTerrainData = (mesh: Mesh) => {
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = normals;
    data.colors = colors;
    data.applyToMesh(mesh);
  };

  const surface = new Mesh(`solid-biome-soil-terrain-chunk-${chunkX}-${chunkZ}`, scene);
  applyTerrainData(surface);
  surface.alwaysSelectAsActiveMesh = true;
  surface.useVertexColors = true;
  surface.metadata = {
    chunkX,
    chunkZ,
    chunkSizeMeters: TERRAIN_CHUNK_SIZE,
    baseVoxelMeters: VOXEL_CUBE_SIZE_METERS
  };
  surface.refreshBoundingInfo();

  const wire = new Mesh(`glowing-triangle-terrain-wireframe-chunk-${chunkX}-${chunkZ}`, scene);
  applyTerrainData(wire);
  wire.position.y = 0.08;
  wire.alwaysSelectAsActiveMesh = true;
  wire.useVertexColors = true;
  wire.metadata = surface.metadata;
  wire.refreshBoundingInfo();

  return { surface, wire };
}

function createIslandTerrain(scene: Scene) {
  const surfaceRoot = new Mesh("solid-biome-soil-terrain-chunks", scene);
  const wireRoot = new Mesh("glowing-triangle-terrain-wireframe-chunks", scene);
  const surfaceMeshes: Mesh[] = [];
  const wireMeshes: Mesh[] = [];

  for (let chunkZ = -TERRAIN_CHUNK_RADIUS; chunkZ <= TERRAIN_CHUNK_RADIUS; chunkZ += 1) {
    for (let chunkX = -TERRAIN_CHUNK_RADIUS; chunkX <= TERRAIN_CHUNK_RADIUS; chunkX += 1) {
      const chunk = createTerrainChunk(scene, chunkX, chunkZ);
      chunk.surface.parent = surfaceRoot;
      chunk.wire.parent = wireRoot;
      surfaceMeshes.push(chunk.surface);
      wireMeshes.push(chunk.wire);
    }
  }

  surfaceRoot.metadata = {
    chunkSizeMeters: TERRAIN_CHUNK_SIZE,
    baseVoxelMeters: VOXEL_CUBE_SIZE_METERS,
    generatedChunkCount: surfaceMeshes.length,
    generatedLandmassSizeMeters: TERRAIN_SIZE
  };
  wireRoot.metadata = surfaceRoot.metadata;

  return { surfaceRoot, wireRoot, surfaceMeshes, wireMeshes };
}

type IslandTerrainMeshes = ReturnType<typeof createIslandTerrain>;

function createSoilVoxelTerraces(scene: Scene) {
  const material = new StandardMaterial("soil-terrain-voxel-material", scene);
  material.diffuseColor = new Color3(0.36, 0.21, 0.12);
  material.emissiveColor = new Color3(0.025, 0.014, 0.008);
  material.specularColor = new Color3(0.18, 0.12, 0.08);
  material.specularPower = 34;

  const source = MeshBuilder.CreateBox("soil-terrain-voxel-source", { width: 18, height: 7, depth: 18 }, scene);
  source.material = material;
  source.isVisible = false;

  const root = new Mesh("visible-soil-terrain-voxel-strata", scene);
  let count = 0;

  for (let z = -250; z <= -70; z += 20) {
    for (let x = -260; x <= 260; x += 20) {
      const sample = terrainSample(x, z);
      const variation = hash2(x * 0.17, z * 0.17);
      if (sample.height < SEA_LEVEL + 4 || sample.height > 92 || variation < 0.42) continue;

      const voxel = source.createInstance(`soil-terrain-voxel-${count}`);
      voxel.position.set(x, sample.height * TERRAIN_VERTICAL_SCALE - 3.7 - Math.floor(variation * 2) * 4, z);
      voxel.rotation.y = (variation - 0.5) * 0.08;
      voxel.parent = root;
      count += 1;
    }
  }

  return root;
}

function createVegetationPass(scene: Scene) {
  const mossMaterial = new StandardMaterial("voxel-vegetation-moss-material", scene);
  mossMaterial.diffuseColor = new Color3(0.12, 0.36, 0.16);
  mossMaterial.emissiveColor = new Color3(0.015, 0.04, 0.018);
  mossMaterial.specularColor = new Color3(0.06, 0.11, 0.06);

  const grassMaterial = new StandardMaterial("voxel-vegetation-grass-material", scene);
  grassMaterial.diffuseColor = new Color3(0.12, 0.72, 0.18);
  grassMaterial.emissiveColor = new Color3(0.025, 0.075, 0.022);
  grassMaterial.specularColor = new Color3(0.07, 0.18, 0.06);

  const flowerMaterial = new StandardMaterial("voxel-vegetation-wildflower-material", scene);
  flowerMaterial.diffuseColor = new Color3(0.95, 0.78, 0.28);
  flowerMaterial.emissiveColor = new Color3(0.08, 0.05, 0.012);
  flowerMaterial.specularColor = new Color3(0.08, 0.06, 0.03);

  const vineMaterial = new StandardMaterial("voxel-vegetation-vine-material", scene);
  vineMaterial.diffuseColor = new Color3(0.08, 0.28, 0.12);
  vineMaterial.emissiveColor = new Color3(0.01, 0.03, 0.012);
  vineMaterial.specularColor = new Color3(0.04, 0.08, 0.04);

  const moss = MeshBuilder.CreateBox("moss-vegetation-source", { width: 7, height: 0.35, depth: 5 }, scene);
  moss.material = mossMaterial;
  moss.isVisible = false;
  const grass = MeshBuilder.CreateBox("grass-vegetation-source", { width: 0.75, height: 5, depth: 0.75 }, scene);
  grass.material = grassMaterial;
  grass.isVisible = false;
  const flower = MeshBuilder.CreateSphere("wildflower-vegetation-source", { diameter: 2.2, segments: 5 }, scene);
  flower.material = flowerMaterial;
  flower.isVisible = false;
  const vine = MeshBuilder.CreateBox("vine-vegetation-source", { width: 0.5, height: 8, depth: 0.5 }, scene);
  vine.material = vineMaterial;
  vine.isVisible = false;

  const root = new Mesh("surface-vegetation-generation-pass", scene);
  let count = 0;

  for (let z = -390; z <= 390; z += 24) {
    for (let x = -390; x <= 390; x += 24) {
      const sample = terrainSample(x, z);
      const material = sample.voxel.material;
      const canGrowMaterials: number[] = [VOXEL_MATERIAL.sand, VOXEL_MATERIAL.gravel, VOXEL_MATERIAL.stone, VOXEL_MATERIAL.soil, VOXEL_MATERIAL.vegetation];
      const canGrow = (sample.voxel.flags & VOXEL_FLAGS.vegetationCandidate) !== 0 && canGrowMaterials.includes(material);
      const roll = hash2(x * 0.29 + 11, z * 0.29 - 17);
      if (!canGrow || roll < 0.48) continue;

      const baseY = sample.height + 0.35;
      const source = sample.canyon > 0.45 || material === VOXEL_MATERIAL.stone ? vine : sample.moisture > 0.72 ? moss : roll > 0.9 ? flower : grass;
      const patchCount = source === grass ? 3 : source === flower ? 2 : 1;

      for (let i = 0; i < patchCount; i += 1) {
        const jitterX = (hash2(x + i * 7, z + 3) - 0.5) * 13;
        const jitterZ = (hash2(x - 5, z + i * 11) - 0.5) * 13;
        const plant = source.createInstance(`surface-vegetation-${count}`);
        plant.position.set(x + jitterX, baseY * TERRAIN_VERTICAL_SCALE + (source === grass ? 2.2 : source === flower ? 3.4 : 0), z + jitterZ);
        plant.rotation.y = hash2(x + count, z - count) * Math.PI;
        plant.scaling.setAll(0.75 + hash2(count, x) * 0.65);
        plant.parent = root;
        count += 1;
      }
    }
  }

  return root;
}

function createWorldObjectPass(scene: Scene) {
  type WorldObject = {
    class: "object";
    kind: "bush" | "palmTree";
    x: number;
    z: number;
  };

  const trunkMaterial = new StandardMaterial("object-palm-trunk-material", scene);
  trunkMaterial.diffuseColor = new Color3(0.47, 0.29, 0.16);
  trunkMaterial.specularColor = new Color3(0.12, 0.08, 0.04);
  const palmLeafMaterial = new StandardMaterial("object-palm-leaf-material", scene);
  palmLeafMaterial.diffuseColor = new Color3(0.1, 0.62, 0.16);
  palmLeafMaterial.emissiveColor = new Color3(0.018, 0.052, 0.015);
  const bushMaterial = new StandardMaterial("object-bush-low-poly-material", scene);
  bushMaterial.diffuseColor = new Color3(0.08, 0.52, 0.13);
  bushMaterial.emissiveColor = new Color3(0.014, 0.045, 0.012);

  const objects: WorldObject[] = [];
  for (let z = -340; z <= 340; z += 38) {
    for (let x = -340; x <= 340; x += 38) {
      const sample = terrainSample(x, z);
      if ((sample.voxel.flags & VOXEL_FLAGS.vegetationCandidate) === 0 || sample.voxel.light < 0.62) continue;
      const roll = hash2(x * 0.19 - 3, z * 0.19 + 8);
      if (roll < 0.82) continue;
      const nearShore = sample.height < SEA_LEVEL + 16;
      objects.push({ class: "object", kind: nearShore && sample.heat > 0.55 ? "palmTree" : "bush", x, z });
    }
  }

  const root = new Mesh("vegetation-object-generation-pass", scene);
  objects.slice(0, 52).forEach((object, index) => {
      const sample = terrainSample(object.x, object.z);
      if (object.kind === "palmTree") {
        const trunk = MeshBuilder.CreateCylinder(`object-palm-tree-trunk-${index}`, { height: 24, diameterTop: 2.6, diameterBottom: 4.2, tessellation: 6 }, scene);
        trunk.position.set(object.x, sample.height * TERRAIN_VERTICAL_SCALE + 12, object.z);
      trunk.rotation.z = (hash2(index, object.x) - 0.5) * 0.16;
      trunk.material = trunkMaterial;
      trunk.parent = root;
      for (let leafIndex = 0; leafIndex < 6; leafIndex += 1) {
        const leaf = MeshBuilder.CreateBox(`object-palm-tree-leaf-${index}-${leafIndex}`, { width: 3, height: 1.2, depth: 18 }, scene);
        leaf.position.set(object.x, sample.height * TERRAIN_VERTICAL_SCALE + 25, object.z);
        leaf.rotation.y = (leafIndex / 6) * Math.PI * 2;
        leaf.rotation.x = -0.42;
        leaf.material = palmLeafMaterial;
        leaf.parent = root;
      }
    } else {
      const bush = MeshBuilder.CreateSphere(`object-bush-low-poly-${index}`, { diameter: 12, segments: 5 }, scene);
      bush.position.set(object.x, sample.height * TERRAIN_VERTICAL_SCALE + 5.5, object.z);
      bush.scaling.y = 0.65 + hash2(index, object.z) * 0.25;
      bush.material = bushMaterial;
      bush.parent = root;
    }
  });

  return root;
}

function voxelGridCompass(camera: UniversalCamera) {
  const forward = camera.getForwardRay().direction.normalize();
  return { face: "+Y", heading: voxelHeadingFromForward(forward) };
}

function createStarfield(scene: Scene, skyboxDiameter: number) {
  const starMaterial = new StandardMaterial("void-star-material", scene);
  starMaterial.disableLighting = true;
  starMaterial.disableDepthWrite = true;
  starMaterial.alphaMode = Engine.ALPHA_ADD;
  starMaterial.emissiveColor = new Color3(0.94, 0.9, 1);
  starMaterial.diffuseColor = Color3.Black();
  starMaterial.alpha = 0;

  const starSeed = MeshBuilder.CreateSphere("void-star-seed", { diameter: 1, segments: 4 }, scene);
  const stars = new SolidParticleSystem("void-starfield", scene, { updatable: false });
  const radius = skyboxDiameter * 0.43;
  stars.addShape(starSeed, 720, {
    positionFunction: (particle: SolidParticle, index: number) => {
      const theta = hash2(index, 1) * Math.PI * 2;
      const y = -0.08 + hash2(index, 2) * 1.06;
      const horizontal = Math.sqrt(Math.max(0, 1 - y * y));
      particle.position.set(
        Math.cos(theta) * horizontal * radius,
        y * radius,
        Math.sin(theta) * horizontal * radius,
      );
      const size = 0.1 + Math.pow(hash2(index, 4), 5) * 0.46;
      particle.scaling.setAll(size);
    },
  });
  const starfield = stars.buildMesh();
  starSeed.dispose();
  starfield.material = starMaterial;
  starfield.infiniteDistance = true;
  starfield.alwaysSelectAsActiveMesh = true;
  starfield.isPickable = false;
  starfield.renderingGroupId = 1;
  return { material: starMaterial, mesh: starfield };
}

export function BabylonScene({ projection, worldIdentity, interactive = true }: Readonly<{ projection: GardenSceneProjectionV1; worldIdentity?: WorldPositionIdentity; interactive?: boolean }>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const interactionEnabledRef = useRef(interactive);
  const inputSettingsRef = useRef({ mouseX: DEFAULT_MOUSE_X, mouseY: DEFAULT_MOUSE_Y, invertMouseY: false });

  useEffect(() => {
    if (!worldIdentity) return;
    const applySettings = (settings: ReturnType<typeof readCharacterInputSettings>) => {
      inputSettingsRef.current = settings;
      characterController.configureBindings(settings.bindings.length > 0 ? settings.bindings : initialBindings);
      characterController.configureGamepad({ enabled: settings.gamepadEnabled, invertY: settings.invertGamepadY, deadzone: settings.deadzone / 100 });
    };
    const applyStored = () => applySettings(readCharacterInputSettings(window.localStorage, worldIdentity.characterId));
    const deferred = window.setTimeout(applyStored, 0);
    const handleSettings = (event: Event) => {
      const detail = (event as CustomEvent<CharacterInputSettingsEventDetail>).detail;
      if (detail?.accountId === worldIdentity.characterId) applySettings(detail.settings);
    };
    window.addEventListener(CHARACTER_INPUT_SETTINGS_EVENT, handleSettings);
    return () => {
      window.clearTimeout(deferred);
      window.removeEventListener(CHARACTER_INPUT_SETTINGS_EVENT, handleSettings);
    };
  }, [worldIdentity?.characterId]);

  useEffect(() => {
    interactionEnabledRef.current = interactive;
    if (!interactive) {
      characterController.releaseAllInputs();
      characterController.cancelPendingPointerAction();
      if (document.pointerLockElement) void document.exitPointerLock();
    }
  }, [interactive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let active = true;
    const reportSceneError = (label: string, error: unknown) => {
      console.error(`Knowhere scene ${label} failed`, error);
    };
    const safeRun = <T,>(label: string, action: () => T): T | null => {
      try {
        return action();
      } catch (error) {
        reportSceneError(label, error);
        return null;
      }
    };

    let engine: Engine;
    let scene: Scene;
    try {
      engine = new Engine(canvas, true);
      scene = new Scene(engine);
    } catch (error) {
      reportSceneError("engine creation", error);
      return () => {
        active = false;
      };
    }
    scene.clearColor = new Color4(0.025, 0.027, 0.055, 1);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogColor = new Color3(0.026, 0.035, 0.06);
    scene.fogDensity = 0.00008;

    const openingCameraX = -2400;
    const openingCameraZ = -2200;
    const openingTargetX = 0;
    const openingTargetZ = -800;
    const openingCameraY = terrainSample(openingCameraX, openingCameraZ).height * TERRAIN_VERTICAL_SCALE + 688;
    const openingTargetY = openingCameraY + 20;
    const camera = new UniversalCamera("knowhere-test-camera", new Vector3(openingCameraX, openingCameraY, openingCameraZ), scene);
    camera.setTarget(new Vector3(openingTargetX, openingTargetY, openingTargetZ));
    scene.activeCamera = camera;
    camera.attachControl(canvas, true);
    camera.inputs.removeByType("FreeCameraMouseInput");
    camera.inputs.removeByType("FreeCameraKeyboardMoveInput");
    camera.speed = BASE_CAMERA_SPEED;
    camera.angularSensibility = 2100;
    camera.keysUp = [];
    camera.keysDown = [];
    camera.keysLeft = [];
    camera.keysRight = [];
    camera.minZ = 0.05;
    camera.maxZ = 30000;
    camera.checkCollisions = false;
    const restoredPosition = worldIdentity
      ? restoreWorldPosition(window.sessionStorage, worldIdentity)
      : null;
    if (restoredPosition) {
      camera.position.set(restoredPosition.position.x, restoredPosition.position.y, restoredPosition.position.z);
      camera.rotation.x = restoredPosition.rotation.x;
      camera.rotation.y = restoredPosition.rotation.y;
    }
    engine.resize();

    const glow: GlowLayer | null = null;

    const skybox = MeshBuilder.CreateSphere("garden-solid-color-skybox", {
      diameter: projection.skybox.diameter,
      segments: projection.skybox.segments,
    }, scene);
    skybox.infiniteDistance = true;
    const skyboxMaterial = new StandardMaterial("garden-solid-color-skybox-material", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skyboxMaterial.disableDepthWrite = true;
    skyboxMaterial.diffuseColor = Color3.Black();
    skyboxMaterial.emissiveColor = Color3.FromHexString(projection.skybox.dayColor);
    skybox.material = skyboxMaterial;
    skybox.renderingGroupId = 0;
    const starfield = safeRun("starfield", () => createStarfield(scene, projection.skybox.diameter));

    const ambient = new HemisphericLight("void-ambient-light", new Vector3(0, 1, 0), scene);
    ambient.groundColor = new Color3(0.1, 0.18, 0.16);
    ambient.diffuse = new Color3(0.68, 0.78, 0.74);
    ambient.intensity = 1.05;

    const sunAsset = createMythicSun(scene, {
      diameter: projection.sun.diameter,
      quality: projection.sun.quality,
      seed: projection.sun.seed,
      palette: projection.sun.palette,
    });
    sunAsset.meshes.forEach((mesh) => {
      mesh.renderingGroupId = 2;
    });
    const projectedSunlight = Color3.FromHexString(projection.sun.sunlight);

    const sunLight = new DirectionalLight("orbiting-sun-directional-light", new Vector3(-1, -1, 0), scene);
    sunLight.diffuse = projectedSunlight;
    sunLight.specular = new Color3(1, 0.88, 0.66);
    sunLight.intensity = 2.4;
    const sunPosition = Vector3.Zero();

    let currentTerrain = safeRun("generated terrain mesh", () => createIslandTerrain(scene));
    let terrainSurfaces = currentTerrain?.surfaceMeshes ?? [];
    let terrainMaterial: StandardMaterial | null = null;
    let wireMaterial: StandardMaterial | null = null;
    const applyTerrainMaterials = (terrainMeshes: IslandTerrainMeshes | null) => {
      if (!terrainMeshes || !terrainMaterial || !wireMaterial) return;
      terrainMeshes.surfaceMeshes.forEach((surface) => {
        surface.material = terrainMaterial;
        surface.renderingGroupId = 1;
      });
      terrainMeshes.wireMeshes.forEach((wire) => {
        wire.material = wireMaterial;
        wire.renderingGroupId = 1;
      });
    };
    terrainMaterial = new StandardMaterial("solid-biome-island-material", scene);
    const projectedTerrainDiffuse = Color3.FromHexString(projection.voxelLandscape.diffuse);
    const projectedTerrainEmissive = Color3.FromHexString(projection.voxelLandscape.emissive);
    const projectedTerrainSpecular = Color3.FromHexString(projection.voxelLandscape.specular);
    terrainMaterial.diffuseColor = projectedTerrainDiffuse;
    terrainMaterial.emissiveColor = projectedTerrainEmissive;
    terrainMaterial.specularColor = projectedTerrainSpecular;
    terrainMaterial.specularPower = 56;
    terrainMaterial.backFaceCulling = false;
    wireMaterial = new StandardMaterial("low-light-glowing-triangle-wire-material", scene);
    wireMaterial.wireframe = true;
    wireMaterial.diffuseColor = Color3.Black();
    wireMaterial.emissiveColor = new Color3(0.22, 0.9, 1);
    wireMaterial.specularColor = Color3.Black();
    wireMaterial.alpha = 0.72;
    wireMaterial.backFaceCulling = false;
    applyTerrainMaterials(currentTerrain);

    const loadGeneratedWorld = (event: Event) => {
      const detail = (event as CustomEvent<WorldgenGeneratorConfig>).detail;
      if (detail) setWorldgenGeneratorConfig(detail);
      currentTerrain?.surfaceRoot.dispose(false, true);
      currentTerrain?.wireRoot.dispose(false, true);
      currentTerrain = safeRun("generated terrain mesh reload", () => createIslandTerrain(scene));
      terrainSurfaces = currentTerrain?.surfaceMeshes ?? [];
      applyTerrainMaterials(currentTerrain);
      const surfaceY = terrainSample(camera.position.x, camera.position.z).height * TERRAIN_VERTICAL_SCALE;
      if (camera.position.y < surfaceY + PLAYER_EYE_HEIGHT) camera.position.y = surfaceY + PLAYER_EYE_HEIGHT + 24;
    };

    safeRun("soil voxel terraces", () => createSoilVoxelTerraces(scene));
    safeRun("vegetation pass", () => createVegetationPass(scene));
    safeRun("world object pass", () => createWorldObjectPass(scene));

    const ocean = MeshBuilder.CreateGround("surrounding-smooth-ocean", { width: OCEAN_SIZE, height: OCEAN_SIZE, subdivisions: 96 }, scene);
    ocean.position.y = SEA_LEVEL - 3.5;
    const oceanMaterial = new StandardMaterial("surrounding-smooth-ocean-material", scene);
    oceanMaterial.alpha = 0.68;
    oceanMaterial.diffuseColor = new Color3(0.045, 0.34, 0.48);
    oceanMaterial.emissiveColor = new Color3(0.018, 0.11, 0.18);
    oceanMaterial.specularColor = new Color3(0.78, 0.92, 1);
    oceanMaterial.specularPower = 160;
    ocean.material = oceanMaterial;

    // Clockwork remains authoritative: this scene only renders the validated
    // payload it receives and never derives terrain, water, or status state.
    void loadActiveStatefulWorld().then((runtime) => {
      if (!active) return;
      scene.metadata = { ...(scene.metadata ?? {}), clockworkRuntimeHash: runtime.runtimeHash, clockworkRecipeHash: runtime.recipeHash, clockworkChunkHashes: { chunk: runtime.chunk.chunkHash, environment: runtime.chunk.environmentHash, reservoir: runtime.chunk.reservoirHash, render: runtime.chunk.renderHash } };
      ocean.position.y = SEA_LEVEL - 3.5 + Math.sin(runtime.tides.elapsedGameDays / 16 * Math.PI * 2) * runtime.tides.amplitudeMeters;
      const composite = runtime.chunk.renderComposites[0]; if (!composite || composite.near.lod !== "near" || !composite.near.voxels) return;
      const [red, green, blue] = composite.near.appearance.tintMultiplier;
      const material = new StandardMaterial("clockwork-authoritative-composite-material", scene); material.diffuseColor = new Color3(red, green, blue); material.emissiveColor = new Color3(red * 0.04, green * 0.04, blue * 0.04);
      const root = new Mesh("clockwork-authoritative-composite-root", scene); root.metadata = { local: composite.local, statuses: composite.near.appearance.statuses, lods: { near: composite.near, mid: composite.mid, far: composite.far }, authoritative: true };
      const mid = MeshBuilder.CreateBox("clockwork-authoritative-composite-mid", { size: 1 }, scene); mid.position.set(composite.local.x + 0.5, composite.local.y + 0.5, composite.local.z + 0.5); mid.material = material; mid.parent = root;
      const far = MeshBuilder.CreateBox("clockwork-authoritative-composite-far", { size: Math.max(0.05, composite.far.silhouetteFill ?? 1) }, scene); far.position.copyFrom(mid.position); far.material = material; far.parent = root;
      const nearMeshes: Mesh[] = [];
      for (const voxel of composite.near.voxels.filter((entry) => entry.fill > 0).slice(0, 512)) {
        const mesh = MeshBuilder.CreateBox("clockwork-authoritative-microvoxel", { size: 1 / 16 }, scene); mesh.position.set(composite.local.x + voxel.x / 16, composite.local.y + voxel.y / 16, composite.local.z + voxel.z / 16); mesh.material = material; mesh.parent = root; nearMeshes.push(mesh);
      }
      scene.onBeforeRenderObservable.add(() => { const distance = Vector3.Distance(camera.position, root.getAbsolutePosition()); const lod = distance <= 64 ? "near" : distance <= 256 ? "mid" : "far"; nearMeshes.forEach((mesh) => mesh.setEnabled(lod === "near")); mid.setEnabled(lod === "mid"); far.setEnabled(lod === "far"); root.metadata = { ...root.metadata, activeLod: lod }; });
    }).catch((error) => console.info("Clockwork active-world payload is not ready", error));

    const horizonLine = MeshBuilder.CreateGround("ocean-horizon-lightline", { width: OCEAN_SIZE, height: 4 }, scene);
    horizonLine.position.set(0, SEA_LEVEL + 1.2, OCEAN_SIZE * 0.39);
    const horizonMaterial = new StandardMaterial("ocean-horizon-lightline-material", scene);
    horizonMaterial.disableLighting = true;
    horizonMaterial.alpha = 0.42;
    horizonMaterial.diffuseColor = new Color3(0.22, 0.82, 1);
    horizonMaterial.emissiveColor = new Color3(0.1, 0.46, 0.72);
    horizonMaterial.specularColor = Color3.Black();
    horizonLine.material = horizonMaterial;

    const releasePointerLock = (event: KeyboardEvent) => {
      gameplayMouseMode.handleEscape(event, canvas);
    };
    let lastFrameAt = performance.now();
    let freeDragPointerId: number | null = null;
    let lastCanvasPointer: Readonly<{ x: number; y: number }> | null = null;
    let lastTargetSourceRevision: string | null = null;
    const handleControllerKeyDown = (event: KeyboardEvent) => { if (interactionEnabledRef.current) characterController.handleKeyDown(event); };
    const handleControllerKeyUp = (event: KeyboardEvent) => { if (interactionEnabledRef.current) characterController.handleKeyUp(event); };
    const handleControllerActionSignal = (event: Event) => {
      const detail = (event as CustomEvent<CharacterActionSignal>).detail;
      if (!detail || typeof detail.actionId !== "string" || (detail.phase !== "pressed" && detail.phase !== "released")) return;
      if (interactionEnabledRef.current) characterController.handleActionSignal(detail);
    };
    const readCanvasPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const clearBlockFaceTarget = (reason: string) => {
      lastTargetSourceRevision = null;
      window.dispatchEvent(new CustomEvent("knowhere:block-face-target-clear", { detail: { reason } }));
    };
    const releaseFreeDragPointerCapture = () => {
      if (freeDragPointerId === null) return;
      if (canvas.hasPointerCapture?.(freeDragPointerId)) canvas.releasePointerCapture(freeDragPointerId);
      freeDragPointerId = null;
    };
    const handleControllerPointerDown = (event: PointerEvent) => {
      if (!interactionEnabledRef.current) return;
      lastCanvasPointer = readCanvasPointer(event);
      const decision = gameplayMouseMode.handlePointerDown(event, canvas);
      if (gameplayMouseMode.getSnapshot().freeDragActive && event.pointerId !== undefined) {
        freeDragPointerId = event.pointerId;
        canvas.setPointerCapture?.(event.pointerId);
      }
      if (decision.lookDelta) characterController.handleLookInput(decision.lookDelta.x, decision.lookDelta.y, canvas.clientWidth, canvas.clientHeight);
      if (decision.allowGameplayAction) characterController.handlePointerDown(event);
    };
    const handleControllerDoubleClick = (event: MouseEvent) => {
      if (!interactionEnabledRef.current) return;
      releaseFreeDragPointerCapture();
      gameplayMouseMode.handleDoubleClick(event, canvas);
    };
    const handleControllerPointerMove = (event: PointerEvent) => {
      if (!interactionEnabledRef.current) return;
      lastCanvasPointer = readCanvasPointer(event);
      if (!gameplayMouseMode.getSnapshot().pointerLocked && !gameplayMouseMode.getSnapshot().freeDragActive) return;
      const decision = gameplayMouseMode.handlePointerMove(event);
      if (decision.lookDelta) characterController.handleLookInput(decision.lookDelta.x, decision.lookDelta.y, canvas.clientWidth, canvas.clientHeight);
    };
    const handleControllerPointerUp = (event: PointerEvent) => {
      if (!interactionEnabledRef.current) return;
      characterController.handlePointerUp(event);
      if (gameplayMouseMode.handlePointerUp(event)) releaseFreeDragPointerCapture();
    };
    const handleControllerPointerCancel = () => {
      if (gameplayMouseMode.cancelFreeDrag()) releaseFreeDragPointerCapture();
      lastCanvasPointer = null;
      clearBlockFaceTarget("target.focus-lost");
    };
    const releaseControllerInputs = () => {
      handleControllerPointerCancel();
      characterController.releaseAllInputs();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") releaseControllerInputs();
    };
    const handleControllerPointerLeave = () => {
      if (gameplayMouseMode.getSnapshot().pointerLocked || gameplayMouseMode.getSnapshot().freeDragActive) return;
      lastCanvasPointer = null;
      clearBlockFaceTarget("target.pointer-left");
    };
    const reconcilePointerLock = () => {
      gameplayMouseMode.reconcilePointerLock(canvas);
      if (gameplayMouseMode.getSnapshot().pointerLocked) releaseFreeDragPointerCapture();
      clearBlockFaceTarget("target.mode-changed");
    };
    const handleGameplayMouseModeChange = () => clearBlockFaceTarget("target.mode-changed");

    const captureContextMenu = (event: MouseEvent) => event.preventDefault();
    canvas.addEventListener("contextmenu", captureContextMenu);
    canvas.addEventListener("pointerdown", handleControllerPointerDown);
    canvas.addEventListener("dblclick", handleControllerDoubleClick);
    canvas.addEventListener("pointerleave", handleControllerPointerLeave);
    window.addEventListener("pointermove", handleControllerPointerMove);
    window.addEventListener("pointerup", handleControllerPointerUp);
    window.addEventListener("pointercancel", handleControllerPointerCancel);
    window.addEventListener("blur", releaseControllerInputs);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("knowhere:gameplay-mouse-mode", handleGameplayMouseModeChange);
    document.addEventListener("pointerlockchange", reconcilePointerLock);
    window.addEventListener("keydown", releasePointerLock);
    window.addEventListener("keydown", handleControllerKeyDown);
    window.addEventListener("keyup", handleControllerKeyUp);
    window.addEventListener("knowhere:character-action", handleControllerActionSignal);
    window.addEventListener("knowhere:load-generated-world", loadGeneratedWorld);

    let previousEntityPosition = camera.position.clone();
    let verticalSpeed = 0;
    let nextPositionSaveAt = performance.now() + 1_000;
    const renderFrame = () => {
      const now = performance.now();
      const deltaSeconds = Math.min(0.08, Math.max(0, (now - lastFrameAt) / 1000));
      lastFrameAt = now;
      characterController.pollGamepads(interactionEnabledRef.current ? navigator.getGamepads?.() ?? [] : []);
      const controllerFrame = characterController.tick(now, deltaSeconds);
      applyCharacterLookToCamera(camera, controllerFrame.look, inputSettingsRef.current);
      const routedTargetSource = routeCharacterBlockFaceTargetSource({
        mouseMode: gameplayMouseMode.getSnapshot(),
        viewport: { width: canvas.clientWidth, height: canvas.clientHeight },
        pointer: lastCanvasPointer,
        camera: {
          position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          yaw: camera.rotation.y,
          pitch: camera.rotation.x,
        },
      });
      if (routedTargetSource.intent) {
        const revision = `${routedTargetSource.intent.source}:${routedTargetSource.intent.pointer?.x ?? "center"}:${routedTargetSource.intent.pointer?.y ?? "center"}:${routedTargetSource.intent.camera.revision}`;
        if (revision !== lastTargetSourceRevision) {
          lastTargetSourceRevision = revision;
          window.dispatchEvent(new CustomEvent("knowhere:block-face-target-source", { detail: routedTargetSource.intent }));
        }
      } else if (routedTargetSource.clearReason && routedTargetSource.clearReason !== lastTargetSourceRevision) {
        clearBlockFaceTarget(routedTargetSource.clearReason);
        lastTargetSourceRevision = routedTargetSource.clearReason;
      }
      const sprintMultiplier = 1 + Math.pow(controllerFrame.sprintCharge, 1.45) * (MAX_SPRINT_MULTIPLIER * controllerFrame.movementModifiers.sprintMultiplier - 1);
      const stanceMultiplier = controllerFrame.state.flags.crouched
        ? 0.45 * controllerFrame.movementModifiers.crouchMultiplier
        : controllerFrame.state.flags.flying ? 1.7 * controllerFrame.movementModifiers.flightMultiplier : 1;
      camera.speed = controllerFrame.state.flags.inputLocked ? 0 : BASE_CAMERA_SPEED * controllerFrame.movementModifiers.speedMultiplier * sprintMultiplier * stanceMultiplier;
      if (!controllerFrame.state.flags.inputLocked) {
        const forward = camera.getDirection(new Vector3(0, 0, 1));
        const right = camera.getDirection(new Vector3(1, 0, 0));
        if (!controllerFrame.state.flags.flying) {
          forward.y = 0;
          right.y = 0;
        }
        if (forward.lengthSquared() > 0) forward.normalize();
        if (right.lengthSquared() > 0) right.normalize();
        const movement = forward.scale(controllerFrame.move.forward).add(right.scale(controllerFrame.move.right));
        if (movement.lengthSquared() > 1) movement.normalize();
        camera.position.addInPlace(movement.scale(camera.speed * deltaSeconds));
      }
      if (controllerFrame.dodge) {
        const direction = controllerFrame.dodge.direction;
        const localDirection = direction === "forward" ? new Vector3(0, 0, 1) : direction === "back" ? new Vector3(0, 0, -1) : direction === "left" ? new Vector3(-1, 0, 0) : new Vector3(1, 0, 0);
        const worldDirection = camera.getDirection(localDirection);
        worldDirection.y = 0;
        if (worldDirection.lengthSquared() > 0) camera.position.addInPlace(worldDirection.normalize().scale(DODGE_SPEED * controllerFrame.movementModifiers.dodgeMultiplier * deltaSeconds * Math.sin(controllerFrame.dodge.progress * Math.PI)));
      }
      const cameraGroundY = terrainSample(camera.position.x, camera.position.z).height * TERRAIN_VERTICAL_SCALE;
      const eyeHeight = controllerFrame.state.flags.crouched ? CROUCH_EYE_HEIGHT : PLAYER_EYE_HEIGHT;
      const minimumCameraY = cameraGroundY + eyeHeight;
      if (controllerFrame.state.flags.flying) {
        verticalSpeed = 0;
        camera.position.y += controllerFrame.verticalIntent * PLAYER_FLIGHT_VERTICAL_SPEED * controllerFrame.movementModifiers.flightMultiplier * deltaSeconds;
      } else {
        if (controllerFrame.jumpRequested) verticalSpeed = PLAYER_JUMP_IMPULSE * controllerFrame.movementModifiers.jumpMultiplier;
        verticalSpeed += PLAYER_GRAVITY * deltaSeconds;
        camera.position.y += verticalSpeed * deltaSeconds;
        if (camera.position.y <= minimumCameraY) {
          camera.position.y = minimumCameraY;
          verticalSpeed = 0;
          characterController.setGrounded(true);
        } else {
          characterController.setGrounded(false);
        }
      }
      const entityVelocity = deltaSeconds > 0 ? camera.position.subtract(previousEntityPosition).scale(1 / deltaSeconds) : Vector3.Zero();
      previousEntityPosition = camera.position.clone();
      const entitySnapshot = characterController.createEntityRuntimeSnapshot({
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        velocity: { x: entityVelocity.x, y: entityVelocity.y, z: entityVelocity.z },
      });
      window.dispatchEvent(new CustomEvent("knowhere:entity-runtime-snapshot", { detail: entitySnapshot }));
      if (worldIdentity && now >= nextPositionSaveAt) {
        nextPositionSaveAt = now + 1_000;
        persistWorldPosition(
          window.sessionStorage,
          worldIdentity,
          { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          { x: camera.rotation.x, y: camera.rotation.y },
        );
      }

      const time = sunOrbitRadiansAt(projection.sun);
      const projectedSunPosition = prototypeSunPositionAt(time, camera.position);
      sunPosition.set(projectedSunPosition.x, projectedSunPosition.y, projectedSunPosition.z);
      sunAsset.setPosition(sunPosition);
      sunLight.direction.copyFrom(sunPosition).subtractInPlace(camera.position).normalize().scaleInPlace(-1);
      const compass = voxelGridCompass(camera);
      window.dispatchEvent(new CustomEvent("knowhere:camera-heading", { detail: compass }));
      window.dispatchEvent(new CustomEvent("knowhere:player-map-position", { detail: { x: camera.position.x, z: camera.position.z, heading: compass.heading } }));

      const orbitHeight = Math.sin(time);
      const daylight = Math.max(0, Math.min(1, orbitHeight * 2.3 + 0.18));
      const lowLightWire = Math.pow(1 - daylight, 1.85);
      ambient.intensity = 0.74 + daylight * 0.46;
      ambient.diffuse = new Color3(0.54 + daylight * 0.2, 0.62 + daylight * 0.2, 0.62 + daylight * 0.16);
      sunLight.intensity = 0.12 + daylight * (projection.sun.maxIntensity - 0.12);
      const sunToCamera = sunPosition.subtract(camera.position);
      const sunDistance = sunToCamera.length();
      sunAsset.root.scaling.setAll(safeSunVisualScale(projection.sun.diameter, sunDistance));
      const sunRay = new Ray(camera.position, sunToCamera.normalize(), sunDistance);
      const sunOccluded = terrainSurfaces.some((surface) => sunRay.intersectsMesh(surface, false).hit);
      const sunVisible = isSunInVisibleDaylightArc(time) && !sunOccluded;
      sunAsset.update(deltaSeconds * 1000, sunVisible ? 1 : 0);
      skyboxMaterial.emissiveColor = Color3.Lerp(
        Color3.FromHexString(projection.skybox.nightColor),
        Color3.FromHexString(projection.skybox.dayColor),
        daylight,
      );
      if (starfield) {
        starfield.material.alpha = Math.pow(1 - daylight, 1.35) * 0.96;
      }
      if (terrainMaterial) {
        terrainMaterial.emissiveColor = projectedTerrainEmissive.scale(0.84 + lowLightWire * 0.34);
        terrainMaterial.specularColor = projectedTerrainSpecular.scale(0.82 + daylight * 0.36);
      }
      if (wireMaterial) {
        wireMaterial.alpha = 0.035 + lowLightWire * 0.82;
        wireMaterial.emissiveColor = new Color3(0.06 + lowLightWire * 0.22, 0.18 + lowLightWire * 0.8, 0.22 + lowLightWire * 0.78);
      }
      oceanMaterial.emissiveColor = new Color3(0.02 + daylight * 0.045 + lowLightWire * 0.018, 0.12 + daylight * 0.12 + lowLightWire * 0.055, 0.18 + daylight * 0.16 + lowLightWire * 0.085);
      horizonMaterial.alpha = 0.24 + lowLightWire * 0.32;
      horizonMaterial.emissiveColor = new Color3(0.06 + daylight * 0.12, 0.24 + daylight * 0.32, 0.42 + daylight * 0.34);
      scene.fogColor = new Color3(0.02 + daylight * 0.075, 0.026 + daylight * 0.09, 0.048 + daylight * 0.12);
      scene.clearColor = new Color4(0.018 + daylight * 0.095, 0.022 + daylight * 0.105, 0.05 + daylight * 0.13, 1);
      scene.render();
    };
    safeRun("initial render", () => {
      engine.resize();
      renderFrame();
    });
    const fallbackRenderTimer = window.setInterval(() => safeRun("interval render", renderFrame), 16);
    engine.runRenderLoop(() => safeRun("engine render loop", renderFrame));

    const handleResize = () => {
      engine.resize();
      clearBlockFaceTarget("target.resized");
    };
    window.addEventListener("resize", handleResize);

    return () => {
      active = false;
      canvas.removeEventListener("contextmenu", captureContextMenu);
      releaseFreeDragPointerCapture();
      canvas.removeEventListener("pointerdown", handleControllerPointerDown);
      canvas.removeEventListener("dblclick", handleControllerDoubleClick);
      canvas.removeEventListener("pointerleave", handleControllerPointerLeave);
      window.removeEventListener("pointermove", handleControllerPointerMove);
      window.removeEventListener("pointerup", handleControllerPointerUp);
      window.removeEventListener("pointercancel", handleControllerPointerCancel);
      window.removeEventListener("blur", releaseControllerInputs);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("knowhere:gameplay-mouse-mode", handleGameplayMouseModeChange);
      document.removeEventListener("pointerlockchange", reconcilePointerLock);
      window.removeEventListener("keydown", releasePointerLock);
      window.removeEventListener("keydown", handleControllerKeyDown);
      window.removeEventListener("keyup", handleControllerKeyUp);
      window.removeEventListener("knowhere:character-action", handleControllerActionSignal);
      window.removeEventListener("knowhere:load-generated-world", loadGeneratedWorld);
      window.removeEventListener("resize", handleResize);
      characterController.releaseAllInputs();
      window.clearInterval(fallbackRenderTimer);
      scene.dispose();
      engine.dispose();
    };
  }, [projection, worldIdentity]);

  return <canvas ref={canvasRef} className="scene-canvas" />;
}
