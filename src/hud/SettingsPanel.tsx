import { useEffect, useMemo, useState } from "react";
import type { SettingsBinding } from "./types";

type SettingsPanelProps = {
  bindings: SettingsBinding[];
  onBindingsChange: (bindings: SettingsBinding[]) => void;
  onClose: () => void;
};

type SettingsTab = "Gameplay" | "Controls" | "Display" | "Audio";
type ControlsTab = "Game Actions" | "UI Controls" | "Mouse Settings" | "Gamepad Configuration";
type BindingColumn = "primary" | "secondary" | "gamepad";

const tabs: SettingsTab[] = ["Gameplay", "Controls", "Display", "Audio"];
const controlsTabs: ControlsTab[] = ["Game Actions", "UI Controls", "Mouse Settings", "Gamepad Configuration"];
const gameBindingGroups: SettingsBinding["group"][] = [
  "Movement & Look",
  "Movement Abilities",
  "Actionbar",
  "Tome Actions",
  "Item Actions",
  "General Actions",
  "Grab & Swap",
];
const interfaceBindingGroups: SettingsBinding["group"][] = ["UI", "Chat"];

export function SettingsPanel({ bindings, onBindingsChange, onClose }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("Controls");
  const [activeControlsTab, setActiveControlsTab] = useState<ControlsTab>("Game Actions");
  const [rebinding, setRebinding] = useState<{ id: string; column: BindingColumn } | null>(null);
  const [mouseX, setMouseX] = useState(50);
  const [mouseY, setMouseY] = useState(44);

  useEffect(() => {
    if (!rebinding) return;

    const commitBinding = (value: string) => {
      onBindingsChange(
        bindings.map((binding) =>
          binding.id === rebinding.id ? { ...binding, [rebinding.column]: value } : binding
        )
      );
      setRebinding(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();

      if (event.key === "Escape") {
        setRebinding(null);
        return;
      }

      commitBinding(event.key.length === 1 ? event.key.toUpperCase() : event.key);
    };

    const handleMouseDown = (event: MouseEvent) => {
      event.preventDefault();
      const ordinal = event.button === 0 ? 1 : event.button === 2 ? 2 : event.button === 1 ? 3 : event.button + 1;
      commitBinding(`Mouse ${ordinal}${rebinding.id === "right-action-scroll-modifier" ? " (Hold)" : ""}`);
    };
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      commitBinding(event.deltaY < 0 ? "Scroll Up" : "Scroll Down");
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("mousedown", handleMouseDown, { capture: true });
    window.addEventListener("wheel", handleWheel, { capture: true, passive: false });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("mousedown", handleMouseDown, { capture: true });
      window.removeEventListener("wheel", handleWheel, { capture: true });
    };
  }, [bindings, onBindingsChange, rebinding]);

  const groupedBindings = useMemo(
    () =>
      gameBindingGroups.map((group) => ({
        group,
        bindings: bindings.filter((binding) => binding.group === group)
      })),
    [bindings]
  );

  const startRebind = (id: string, column: BindingColumn) => {
    if (id === "escape") return;
    setRebinding({ id, column });
  };

  return (
    <div className="modal-backdrop">
      <section className="settings-panel" aria-label="Settings panel">
        <header className="settings-header">
          <h2>Settings</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close settings">
            x
          </button>
        </header>

        <nav className="settings-tabs" aria-label="Settings tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`settings-tab ${activeTab === tab ? "settings-tab-active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>

        <div className="settings-body">
          {activeTab === "Gameplay" ? (
            <div className="settings-section-grid">
              <section className="settings-section">
                <h3>Gameplay</h3>
                <label className="settings-check"><input type="checkbox" defaultChecked /> Show combat floaters</label>
                <label className="settings-check"><input type="checkbox" defaultChecked /> Auto-open pickup log</label>
                <label className="settings-check"><input type="checkbox" /> Hold to interact</label>
              </section>
            </div>
          ) : null}

          {activeTab === "Controls" ? (
            <div className="settings-section-grid">
              <section className="settings-section settings-section-wide">
                <nav className="settings-subtabs" aria-label="Controls tabs">
                  {controlsTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={`settings-subtab ${activeControlsTab === tab ? "settings-subtab-active" : ""}`}
                      onClick={() => setActiveControlsTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </nav>

                {activeControlsTab === "Game Actions" ? (
                  <>
                    <h3>Game Actions</h3>
                    {groupedBindings.map(({ group, bindings: groupBindings }) => (
                      <div className="binding-group" key={group}>
                        <h4>{group}</h4>
                        <div className="binding-table">
                          <div className="binding-row binding-head">
                            <span>Action</span>
                            <span>Key/Mouse 1</span>
                            <span>Key/Mouse 2</span>
                            <span>Gamepad</span>
                          </div>
                          {groupBindings.map((binding) => (
                            <div className="binding-row" key={binding.id}>
                              <span title={binding.hint}>{binding.label}</span>
                              <button type="button" disabled={binding.id === "escape"} onClick={() => startRebind(binding.id, "primary")}>{binding.primary}</button>
                              <button type="button" disabled={binding.id === "escape"} onClick={() => startRebind(binding.id, "secondary")}>{binding.secondary}</button>
                              <button type="button" disabled={binding.id === "escape"} onClick={() => startRebind(binding.id, "gamepad")}>{binding.gamepad}</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                ) : null}

                {activeControlsTab === "UI Controls" ? (
                  <div className="settings-nested-grid">
                    {interfaceBindingGroups.map((group) => (
                      <section key={group}>
                        <h3>{group}</h3>
                        <div className="binding-table">
                          <div className="binding-row binding-head">
                            <span>Action</span>
                            <span>Key/Mouse 1</span>
                            <span>Key/Mouse 2</span>
                            <span>Gamepad</span>
                          </div>
                          {bindings.filter((binding) => binding.group === group).map((binding) => (
                            <div className="binding-row" key={binding.id}>
                              <span>{binding.label}</span>
                              <button type="button" disabled={binding.id === "escape"} onClick={() => startRebind(binding.id, "primary")}>{binding.primary}</button>
                              <button type="button" disabled={binding.id === "escape"} onClick={() => startRebind(binding.id, "secondary")}>{binding.secondary}</button>
                              <button type="button" disabled={binding.id === "escape"} onClick={() => startRebind(binding.id, "gamepad")}>{binding.gamepad}</button>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : null}

                {activeControlsTab === "Mouse Settings" ? (
                  <div className="settings-nested-grid">
                    <section>
                      <h3>Mouse Settings</h3>
                      <label>X sensitivity <input type="range" min="1" max="100" value={mouseX} onChange={(event) => setMouseX(Number(event.target.value))} /></label>
                      <label>Y sensitivity <input type="range" min="1" max="100" value={mouseY} onChange={(event) => setMouseY(Number(event.target.value))} /></label>
                    </section>
                  </div>
                ) : null}

                {activeControlsTab === "Gamepad Configuration" ? (
                  <div className="settings-nested-grid">
                    <section>
                      <h3>Gamepad Configuration</h3>
                      <label className="settings-check"><input type="checkbox" defaultChecked /> Enable gamepad input</label>
                      <label className="settings-check"><input type="checkbox" /> Invert camera Y</label>
                    </section>
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}

          {activeTab === "Display" ? (
            <div className="settings-section-grid">
              <section className="settings-section"><h3>Display</h3><p>Fullscreen, resolution, and HUD scale controls will live here.</p></section>
              <section className="settings-section"><h3>Graphics</h3><p>Quality, shadows, effects, and render distance controls will live here.</p></section>
            </div>
          ) : null}

          {activeTab === "Audio" ? (
            <div className="settings-section-grid audio-grid">
              {["General", "Voice", "Music", "SFX", "Ambience"].map((label) => (
                <section className="settings-section" key={label}>
                  <h3>{label}</h3>
                  <input type="range" min="0" max="100" defaultValue="70" aria-label={`${label} volume`} />
                </section>
              ))}
            </div>
          ) : null}
        </div>

        {rebinding ? <div className="rebind-prompt">Press a key or mouse button. Escape cancels and cannot be bound.</div> : null}
      </section>
    </div>
  );
}
