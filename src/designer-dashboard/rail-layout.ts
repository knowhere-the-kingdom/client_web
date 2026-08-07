import type { RailMode } from "./workspace-routing.ts";

export type RailLayout = Readonly<{ mode: RailMode; width: number }>;

export function boundedRailPointerLayout(clientX: number, viewportWidth: number): RailLayout {
  const maxWidth = Math.max(224, Math.min(480, viewportWidth - 240));
  const boundary = Math.max(0, Math.min(maxWidth, clientX));
  if (boundary <= 32) return { mode: "hidden", width: 0 };
  if (boundary < 180) return { mode: "compact", width: 96 };
  return { mode: "full", width: boundary };
}
