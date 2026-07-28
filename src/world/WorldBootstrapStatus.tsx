import type { WorldHudBootstrapV1 } from "./world-bootstrap";
import { rendererGateState, type ValidatedPresentationProjection } from "./renderer-gate";

export function WorldBootstrapStatus(
  { bootstrap = null, presentation = null }: Readonly<{
    bootstrap?: WorldHudBootstrapV1 | null;
    presentation?: ValidatedPresentationProjection | null;
  }>,
) {
  const state = rendererGateState(bootstrap, presentation);
  const description = state === "awaiting-bootstrap"
    ? "Waiting for the approved Gateway world bootstrap."
    : state === "awaiting-presentation-permission"
      ? "World bootstrap received; waiting for the approved presentation projection."
      : "Renderer and HUD may initialize from the approved projections.";

  return (
    <section className="browser-shell__bootstrap" aria-live="polite">
      <p><strong>World presentation:</strong> {description}</p>
      {bootstrap && <p>World <code>{bootstrap.worldId}</code> · HUD revision {bootstrap.hudProjectionRevision}</p>}
    </section>
  );
}
