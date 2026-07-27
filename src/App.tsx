import { CharacterAssetPreview } from "./character-preview/CharacterAssetPreview";
import { useWebmasterHealth } from "./api/useWebmasterHealth";

function WebmasterHealthStatus() {
  const [status, refresh] = useWebmasterHealth();

  const description = status.phase === "healthy"
    ? `Web service is responding (${status.health.buildVersion}).`
    : status.phase === "unavailable"
      ? `Web service is unavailable for this request (${status.reason}).`
      : status.phase === "checking"
        ? "Checking web service availability…"
        : status.phase === "aborted"
          ? "The availability request was cancelled."
          : "Availability has not been checked.";

  return (
    <section className="browser-shell__health" aria-live="polite">
      <p><strong>Service status:</strong> {description}</p>
      <button type="button" onClick={refresh}>Check again</button>
    </section>
  );
}

export function App() {
  if (new URLSearchParams(window.location.search).get("preview") === "staxel-voxel-female") {
    return <CharacterAssetPreview />;
  }

  return (
    <main className="browser-shell" aria-labelledby="browser-shell-title">
      <section className="browser-shell__panel">
        <p className="browser-shell__eyebrow">Knowhere</p>
        <h1 id="browser-shell-title">Web client scaffold</h1>
        <p>
          The browser shell is ready for service contracts. Login, world entry,
          messaging, inventory, and rendering remain intentionally unported.
        </p>
        <WebmasterHealthStatus />
        <p>
          The isolated third-party character intake preview is available only at
          <code> ?preview=staxel-voxel-female</code>.
        </p>
      </section>
    </main>
  );
}
