import { sampleWorldgenMapPixel } from "./BabylonScene";
import type { WorldgenMapLayerId } from "./BabylonScene";

const SURFACE_TILE_SIZE = 128;
const SOURCE_VIEW_PIXELS_TALL = 256;

type SurfaceMapTile = {
  key: string;
  layer: WorldgenMapLayerId;
  zoom: number;
  tileX: number;
  tileZ: number;
  worldUnitsPerPixel: number;
  worldSize: number;
  canvas: HTMLCanvasElement;
  dirty: boolean;
};

type SurfaceBlockUpdate = {
  x: number;
  z: number;
  radius?: number;
};

function tileKey(layer: WorldgenMapLayerId, zoom: number, tileX: number, tileZ: number) {
  return `${layer}:${zoom}:${tileX}:${tileZ}`;
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

class SurfaceMapStore {
  private tiles = new Map<string, SurfaceMapTile>();

  private maxTiles = 420;

  draw(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    layer: WorldgenMapLayerId,
    zoom: number,
    pan: { x: number; z: number }
  ) {
    const worldUnitsPerPixel = zoom / SOURCE_VIEW_PIXELS_TALL;
    const tileWorldSize = worldUnitsPerPixel * SURFACE_TILE_SIZE;
    const worldWidth = zoom * (width / Math.max(1, height));
    const left = pan.x - worldWidth * 0.5;
    const right = pan.x + worldWidth * 0.5;
    const bottom = pan.z - zoom * 0.5;
    const top = pan.z + zoom * 0.5;
    const scale = height / SOURCE_VIEW_PIXELS_TALL;
    const minTileX = Math.floor(left / tileWorldSize);
    const maxTileX = Math.floor(right / tileWorldSize);
    const minTileZ = Math.floor(bottom / tileWorldSize);
    const maxTileZ = Math.floor(top / tileWorldSize);

    context.clearRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;

    for (let tileZ = minTileZ; tileZ <= maxTileZ; tileZ += 1) {
      for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
        const tile = this.getTile(layer, zoom, tileX, tileZ, worldUnitsPerPixel, tileWorldSize);
        const worldTileLeft = tileX * tileWorldSize;
        const worldTileTop = (tileZ + 1) * tileWorldSize;
        const destX = ((worldTileLeft - left) / worldUnitsPerPixel) * scale;
        const destY = ((top - worldTileTop) / worldUnitsPerPixel) * scale;
        const destSize = SURFACE_TILE_SIZE * scale;
        context.drawImage(tile.canvas, destX, destY, destSize, destSize);
      }
    }

    this.prune();
  }

  patchSurfaceBlock(update: SurfaceBlockUpdate) {
    const radius = update.radius ?? 1;
    for (const tile of this.tiles.values()) {
      const left = tile.tileX * tile.worldSize;
      const right = left + tile.worldSize;
      const bottom = tile.tileZ * tile.worldSize;
      const top = bottom + tile.worldSize;
      if (update.x + radius < left || update.x - radius > right || update.z + radius < bottom || update.z - radius > top) continue;
      tile.dirty = true;
    }
  }

  clear() {
    this.tiles.clear();
  }

  private getTile(
    layer: WorldgenMapLayerId,
    zoom: number,
    tileX: number,
    tileZ: number,
    worldUnitsPerPixel: number,
    worldSize: number
  ) {
    const key = tileKey(layer, zoom, tileX, tileZ);
    const cached = this.tiles.get(key);
    if (cached && !cached.dirty) return cached;

    const canvas = cached?.canvas ?? document.createElement("canvas");
    canvas.width = SURFACE_TILE_SIZE;
    canvas.height = SURFACE_TILE_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Surface map tile canvas context unavailable.");

    const image = context.createImageData(SURFACE_TILE_SIZE, SURFACE_TILE_SIZE);
    const data = image.data;
    const worldLeft = tileX * worldSize;
    const worldTop = (tileZ + 1) * worldSize;

    for (let py = 0; py < SURFACE_TILE_SIZE; py += 1) {
      const z = worldTop - (py + 0.5) * worldUnitsPerPixel;
      for (let px = 0; px < SURFACE_TILE_SIZE; px += 1) {
        const x = worldLeft + (px + 0.5) * worldUnitsPerPixel;
        const pixel = sampleWorldgenMapPixel(x, z, layer);
        const alpha = layer === "final" ? 0 : pixel.overlay.alpha;
        const index = (py * SURFACE_TILE_SIZE + px) * 4;
        data[index] = clampByte(pixel.base[0] * (1 - alpha) + pixel.overlay.color[0] * alpha);
        data[index + 1] = clampByte(pixel.base[1] * (1 - alpha) + pixel.overlay.color[1] * alpha);
        data[index + 2] = clampByte(pixel.base[2] * (1 - alpha) + pixel.overlay.color[2] * alpha);
        data[index + 3] = 255;
      }
    }

    context.putImageData(image, 0, 0);
    const tile = { key, layer, zoom, tileX, tileZ, worldUnitsPerPixel, worldSize, canvas, dirty: false };
    this.tiles.set(key, tile);
    return tile;
  }

  private prune() {
    if (this.tiles.size <= this.maxTiles) return;
    const removeCount = this.tiles.size - this.maxTiles;
    let removed = 0;
    for (const key of this.tiles.keys()) {
      this.tiles.delete(key);
      removed += 1;
      if (removed >= removeCount) break;
    }
  }
}

export const surfaceMapStore = new SurfaceMapStore();
