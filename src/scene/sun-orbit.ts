export const PROTOTYPE_SUN_ORBIT = Object.freeze({
  skyRadius: 1800,
  horizonElevationRadians: 8 * Math.PI / 180,
  apparentDiameterRadians: 7 * Math.PI / 180,
  minimumVisualScale: 0.5,
  maximumVisualScale: 8,
});

export type WorldPosition = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

/**
 * The voxel world uses +X east, +Y up, and +Z north. The visible daylight arc
 * rises in the east, crosses overhead, and sets in the west without drifting
 * north/south or entering streamed terrain. It sits on a distant, fixed-radius
 * celestial sphere while the Gateway-projected clock owns its phase.
 */
export function prototypeSunPositionAt(
  orbitRadians: number,
  cameraPosition: WorldPosition,
): WorldPosition {
  const daylightProgress = Math.max(0, Math.min(1, orbitRadians / Math.PI));
  const elevation = PROTOTYPE_SUN_ORBIT.horizonElevationRadians
    + daylightProgress * (Math.PI - PROTOTYPE_SUN_ORBIT.horizonElevationRadians * 2);
  return {
    x: cameraPosition.x + Math.cos(elevation) * PROTOTYPE_SUN_ORBIT.skyRadius,
    y: cameraPosition.y + Math.sin(elevation) * PROTOTYPE_SUN_ORBIT.skyRadius,
    z: cameraPosition.z,
  };
}

export function safeSunVisualScale(projectedDiameter: number, distance: number): number {
  const boundedDiameter = Math.max(0.001, projectedDiameter);
  const boundedDistance = Math.max(boundedDiameter, distance);
  const targetVisibleDiameter = 2
    * boundedDistance
    * Math.tan(PROTOTYPE_SUN_ORBIT.apparentDiameterRadians / 2);
  return Math.min(
    PROTOTYPE_SUN_ORBIT.maximumVisualScale,
    Math.max(PROTOTYPE_SUN_ORBIT.minimumVisualScale, targetVisibleDiameter / boundedDiameter),
  );
}

export function isSunInVisibleDaylightArc(orbitRadians: number): boolean {
  const fullOrbit = Math.PI * 2;
  const normalized = ((orbitRadians % fullOrbit) + fullOrbit) % fullOrbit;
  return normalized <= Math.PI;
}
