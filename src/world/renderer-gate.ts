import type { WorldHudBootstrapV1 } from "./world-bootstrap";

export type RendererGateState = "awaiting-bootstrap" | "awaiting-presentation-permission" | "ready";

declare const presentationProjectionBrand: unique symbol;
export type ValidatedPresentationProjection = Readonly<{
  readonly [presentationProjectionBrand]: true;
}>;

export type PresentationProjectionValidator = (value: unknown) => boolean;

export type PresentationProjectionResult =
  | Readonly<{ ok: true; value: ValidatedPresentationProjection }>
  | Readonly<{ ok: false; code: "presentation_projection_unavailable" | "invalid_presentation_projection" }>;

/**
 * The concrete AdmittedPresentationProjectionV1 schema is owned by the
 * presentation-authority lane. This adapter brands only a value accepted by
 * that lane's validator; it never interprets private fields or grants access
 * from a boolean flag.
 */
export function validatePresentationProjection(
  value: unknown,
  isApproved: PresentationProjectionValidator | null,
): PresentationProjectionResult {
  if (!isApproved) return { ok: false, code: "presentation_projection_unavailable" };
  return isApproved(value)
    ? { ok: true, value: value as ValidatedPresentationProjection }
    : { ok: false, code: "invalid_presentation_projection" };
}

export function rendererGateState(
  bootstrap: WorldHudBootstrapV1 | null,
  presentation: ValidatedPresentationProjection | null,
): RendererGateState {
  if (!bootstrap) return "awaiting-bootstrap";
  return presentation ? "ready" : "awaiting-presentation-permission";
}
