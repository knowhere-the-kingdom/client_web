export type ScreenPoint = Readonly<{ x: number; y: number }>;
export type ScreenRect = Readonly<{ left: number; top: number; right: number; bottom: number }>;

export type CharacterDropProjection = Readonly<{
  accepted: boolean;
  distance: number;
}>;

/** A near-edge release projects into the receptacle; a far release stays held. */
export function projectCharacterDrop(
  point: ScreenPoint,
  slot: ScreenRect,
  forgiveness = 28,
): CharacterDropProjection {
  const nearestX = Math.max(slot.left, Math.min(point.x, slot.right));
  const nearestY = Math.max(slot.top, Math.min(point.y, slot.bottom));
  const distance = Math.hypot(point.x - nearestX, point.y - nearestY);
  return { accepted: distance <= Math.max(0, forgiveness), distance };
}
