export type HorizontalDirection = Readonly<{ x: number; z: number }>;

export function voxelHeadingFromForward(forward: HorizontalDirection) {
  if (!Number.isFinite(forward.x) || !Number.isFinite(forward.z)) return 0;
  if ((forward.x * forward.x) + (forward.z * forward.z) < 0.0001) return 0;
  const heading = (Math.atan2(forward.x, forward.z) * 180) / Math.PI;
  return (heading + 360) % 360;
}
