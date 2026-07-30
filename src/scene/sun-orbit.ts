export const PROTOTYPE_SUN_ORBIT = Object.freeze({
  horizontalRadius: 180,
  verticalRadius: 80,
});

export type WorldPosition = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

/**
 * The voxel world uses +X east, +Y up, and +Z north. The prototype sun rises
 * in the east, crosses overhead, and sets in the west without drifting north
 * or south. Keeping the orbit camera-relative gives it a stable sky-scale in
 * the streamed world while the Gateway-projected clock controls its phase.
 */
export function prototypeSunPositionAt(
  orbitRadians: number,
  cameraPosition: WorldPosition,
): WorldPosition {
  return {
    x: cameraPosition.x + Math.cos(orbitRadians) * PROTOTYPE_SUN_ORBIT.horizontalRadius,
    y: cameraPosition.y + Math.sin(orbitRadians) * PROTOTYPE_SUN_ORBIT.verticalRadius,
    z: cameraPosition.z,
  };
}
