import { CharacterAssetPreview } from "./character-preview/CharacterAssetPreview";
import { DashboardShell } from "./dashboard/DashboardShell";
import { LoginExperience } from "./login/LoginExperience";
import { WorldBootstrapStatus } from "./world/WorldBootstrapStatus";

function WorldPresentationBoundary() {
  return (
    <main className="browser-shell" aria-labelledby="world-presentation-title">
      <section className="browser-shell__panel">
        <p className="browser-shell__eyebrow">Knowhere</p>
        <h1 id="world-presentation-title">World presentation</h1>
        <WorldBootstrapStatus />
      </section>
    </main>
  );
}

export function App() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("preview") === "staxel-voxel-female") {
    return <CharacterAssetPreview />;
  }
  if (window.location.pathname === "/dashboard" || params.has("page")) {
    return <DashboardShell />;
  }
  if (window.location.pathname === "/world") {
    return <WorldPresentationBoundary />;
  }

  return <LoginExperience />;
}
