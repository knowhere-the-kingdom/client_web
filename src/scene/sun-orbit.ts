export const PROTOTYPE_SUN_ORBIT = Object.freeze({
  horizontalRadius: 180,
  horizonClearance: 72,
  daylightArcHeight: 120,
  minimumVisualScale: 1.65,
  maximumVisualScale: 8,
  minimumApparentDiameterRadians: 24 * Math.PI / 180,
});

export type WorldPosition = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

/**
 * The voxel world uses +X east, +Y up, and +Z north. The visible daylight arc
 * rises in the east, crosses overhead, and sets in the west without drifting
 * north/south or dropping through streamed terrain. Keeping it camera-relative
 * gives it a stable sky-scale while the Gateway-projected clock owns its phase.
 */
export function prototypeSunPositionAt(
  orbitRadians: number,
  cameraPosition: WorldPosition,
): WorldPosition {
  const daylightArc = Math.max(0, Math.sin(orbitRadians));
  return {
    x: cameraPosition.x + Math.cos(orbitRadians) * PROTOTYPE_SUN_ORBIT.horizontalRadius,
    y: cameraPosition.y
      + PROTOTYPE_SUN_ORBIT.horizonClearance
      + daylightArc * PROTOTYPE_SUN_ORBIT.daylightArcHeight,
    z: cameraPosition.z,
  };
}

export function safeSunVisualScale(projectedDiameter: number, distance: number): number {
  const boundedDiameter = Math.max(0.001, projectedDiameter);
  const boundedDistance = Math.max(boundedDiameter, distance);
  const minimumVisibleDiameter = 2
    * boundedDistance
    * Math.tan(PROTOTYPE_SUN_ORBIT.minimumApparentDiameterRadians / 2);
  return Math.min(
    PROTOTYPE_SUN_ORBIT.maximumVisualScale,
    Math.max(PROTOTYPE_SUN_ORBIT.minimumVisualScale, minimumVisibleDiameter / boundedDiameter),
  );
}

export function isSunInVisibleDaylightArc(orbitRadians: number): boolean {
  const fullOrbit = Math.PI * 2;
  const normalized = ((orbitRadians % fullOrbit) + fullOrbit) % fullOrbit;
  return normalized <= Math.PI;
}
