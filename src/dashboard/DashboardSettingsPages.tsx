import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { initialBindings, saveControlBindings } from "../hud/demoData";
import type { SettingsBinding } from "../hud/types";
import { publishStoredCharacterInputSettings } from "../features/character-controller/runtimeSettings";
import { publishStoredCrosshairSettings } from "../hud/crosshairSettings";
import { publishTooltipSettings, type TooltipPlacement } from "../hud/tooltipSettings";

export type SettingsDashboardPage =
  | "profile"
  | "account"
  | "gameplay"
  | "controls-actions"
  | "controls-ui"
  | "controls-mouse"
  | "controls-gamepad"
  | "controls-touch"
  | "display"
  | "audio";

type ControlsPage = Extract<SettingsDashboardPage, `controls-${string}`>;
type BindingColumn = "primary" | "secondary" | "gamepad";

type DashboardPreferenceDocument = {
  version: 1;
  profile: {
    displayName: string;
    title: string;
    pronouns: string;
    about: string;
    status: string;
    visibility: "public" | "friends" | "private";
  };
  account: {
    email: string;
    locale: string;
    timezone: string;
    announcements: boolean;
    securityAlerts: boolean;
  };
  gameplay: {
    crosshairEnabled: boolean;
    crosshairPreset: "cross" | "dot" | "circle" | "chevron";
    crosshairSize: number;
    crosshairLineWidth: number;
    crosshairGap: number;
    crosshairOpacity: number;
    crosshairColor: string;
    crosshairOutline: boolean;
    crosshairOutlineColor: string;
    crosshairOutlineWidth: number;
    crosshairOutlineOpacity: number;
    centerDot: boolean;
    crosshairCenterDotSize: number;
    crosshairCenterDotColor: string;
    lootLabels: boolean;
    lootMinimumQuality: string;
    lootDistance: boolean;
    lootMaxDistance: number;
    tooltipPlacement: TooltipPlacement;
  };
  controls: {
    bindings: SettingsBinding[];
    mouseX: number;
    mouseY: number;
    invertMouseY: boolean;
    gamepadEnabled: boolean;
    invertGamepadY: boolean;
    deadzone: number;
    vibration: number;
  };
  display: {
    windowMode: string;
    resolution: string;
    quality: string;
    renderDistance: number;
    hudScale: number;
    shadows: boolean;
    bloom: boolean;
    motionBlur: boolean;
  };
  audio: {
    master: number;
    voice: number;
    music: number;
    effects: number;
    ambience: number;
    muteUnfocused: boolean;
    output: string;
  };
  updatedAt: string | null;
};

const controlPages: ReadonlyArray<{ page: ControlsPage; label: string }> = [
  { page: "controls-actions", label: "Game Actions" },
  { page: "controls-ui", label: "Interface" },
  { page: "controls-mouse", label: "Mouse" },
  { page: "controls-gamepad", label: "Gamepad" },
  { page: "controls-touch", label: "Touch" },
];

function defaults(displayName: string): DashboardPreferenceDocument {
  return {
    version: 1,
    profile: { displayName, title: "Wanderer", pronouns: "", about: "Exploring the Kingdom of Knowhere.", status: "Available", visibility: "public" },
    account: { email: "", locale: "English (US)", timezone: "Local device time", announcements: true, securityAlerts: true },
    gameplay: { crosshairEnabled: true, crosshairPreset: "cross", crosshairSize: 42, crosshairLineWidth: 2, crosshairGap: 6, crosshairOpacity: 88, crosshairColor: "#70b9b2", crosshairOutline: true, crosshairOutlineColor: "#000000", crosshairOutlineWidth: 1, crosshairOutlineOpacity: 80, centerDot: true, crosshairCenterDotSize: 4, crosshairCenterDotColor: "#70b9b2", lootLabels: true, lootMinimumQuality: "Common", lootDistance: true, lootMaxDistance: 24, tooltipPlacement: "right" },
    controls: { bindings: initialBindings.map((binding) => ({ ...binding })), mouseX: 50, mouseY: 44, invertMouseY: false, gamepadEnabled: true, invertGamepadY: false, deadzone: 12, vibration: 60 },
    display: { windowMode: "Borderless", resolution: "Native", quality: "High", renderDistance: 70, hudScale: 100, shadows: true, bloom: true, motionBlur: false },
    audio: { master: 80, voice: 72, music: 55, effects: 75, ambience: 68, muteUnfocused: false, output: "System default" },
    updatedAt: null,
  };
}

function storageKey(userId: string) {
  return `knowhere.dashboard.preferences.v1.${userId}`;
}

function loadPreferences(userId: string, displayName: string): DashboardPreferenceDocument {
  const fallback = defaults(displayName);
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<DashboardPreferenceDocument>;
    if (parsed.version !== 1) return fallback;
    const savedBindings = new Map(parsed.controls?.bindings?.map((binding) => [binding.id, binding]));
    const bindings = fallback.controls.bindings.map((binding) => ({
      ...binding,
      ...savedBindings.get(binding.id),
      group: binding.group,
      label: binding.label,
      hint: binding.hint,
    }));
    return {
      ...fallback,
      ...parsed,
      profile: { ...fallback.profile, ...parsed.profile },
      account: { ...fallback.account, ...parsed.account },
      gameplay: { ...fallback.gameplay, ...parsed.gameplay },
      controls: { ...fallback.controls, ...parsed.controls, bindings },
      display: { ...fallback.display, ...parsed.display },
      audio: { ...fallback.audio, ...parsed.audio },
    };
  } catch {
    return fallback;
  }
}

export function DashboardSettingsPage({
  page,
  user,
  onNavigate,
}: Readonly<{
  page: SettingsDashboardPage;
  user: { id: string; username: string; displayName: string };
  onNavigate: (page: SettingsDashboardPage | "avatars") => void;
}>) {
  const [preferences, setPreferences] = useState(() => loadPreferences(user.id, user.displayName));
  const [saved, setSaved] = useState(preferences.updatedAt);

  useEffect(() => {
    setPreferences(loadPreferences(user.id, user.displayName));
  }, [user.displayName, user.id]);

  const update = <K extends keyof DashboardPreferenceDocument>(section: K, next: DashboardPreferenceDocument[K]) => {
    setPreferences((current) => ({ ...current, [section]: next }));
  };
  const save = () => {
    const next = { ...preferences, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(storageKey(user.id), JSON.stringify(next));
    saveControlBindings(next.controls.bindings);
    publishStoredCharacterInputSettings(user.id);
    publishStoredCrosshairSettings(user.id);
    publishTooltipSettings(next.gameplay.tooltipPlacement);
    setPreferences(next);
    setSaved(next.updatedAt);
  };
  const reset = () => {
    const next = defaults(user.displayName);
    window.localStorage.setItem(storageKey(user.id), JSON.stringify(next));
    saveControlBindings(next.controls.bindings);
    publishStoredCharacterInputSettings(user.id);
    publishStoredCrosshairSettings(user.id);
    publishTooltipSettings(next.gameplay.tooltipPlacement);
    setPreferences(next);
    setSaved(null);
  };

  if (page === "profile") return <ProfilePage userId={user.id} value={preferences.profile} onChange={(value) => update("profile", value)} onNavigateAvatars={() => onNavigate("avatars")} onSave={save} saved={saved} />;
  if (page === "account") return <AccountPage user={user} value={preferences.account} onChange={(value) => update("account", value)} onSave={save} saved={saved} />;
  if (page === "gameplay") return <GameplayPage value={preferences.gameplay} onChange={(value) => update("gameplay", value)} onSave={save} onReset={reset} saved={saved} />;
  if (page === "display") return <DisplayPage value={preferences.display} onChange={(value) => update("display", value)} onSave={save} onReset={reset} saved={saved} />;
  if (page === "audio") return <AudioPage value={preferences.audio} onChange={(value) => update("audio", value)} onSave={save} onReset={reset} saved={saved} />;
  return <ControlsPage page={page} value={preferences.controls} onChange={(value) => update("controls", value)} onNavigate={onNavigate} onSave={save} onReset={reset} saved={saved} />;
}

function PageShell({ eyebrow, title, description, saved, onSave, onReset, children }: Readonly<{ eyebrow: string; title: string; description: string; saved: string | null; onSave: () => void; onReset?: () => void; children: React.ReactNode }>) {
  return <section className="dashboard-form-page"><header className="dashboard-form-header"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><div><small>{saved ? `Saved ${new Date(saved).toLocaleString()}` : "Local draft not saved"}</small>{onReset ? <button type="button" onClick={onReset}>Restore Defaults</button> : null}<button className="dashboard-primary" type="button" onClick={onSave}>Save Changes</button></div></header>{children}</section>;
}

function Panel({ title, description, children }: Readonly<{ title: string; description?: string; children: React.ReactNode }>) {
  return <section className="dashboard-form-panel"><header><h2>{title}</h2>{description ? <p>{description}</p> : null}</header><div className="dashboard-form-grid">{children}</div></section>;
}

function Field({ label, hint, children }: Readonly<{ label: string; hint?: string; children: React.ReactNode }>) {
  return <label className="dashboard-field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

function Toggle({ label, description, checked, onChange }: Readonly<{ label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }>) {
  return <label className="dashboard-toggle"><span><b>{label}</b><small>{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>;
}

function Slider({ label, value, min = 0, max = 100, suffix = "%", onChange }: Readonly<{ label: string; value: number; min?: number; max?: number; suffix?: string; onChange: (value: number) => void }>) {
  return <label className="dashboard-slider"><span><b>{label}</b><output>{value}{suffix}</output></span><input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function ProfilePage({ userId, value, onChange, onNavigateAvatars, onSave, saved }: Readonly<{ userId: string; value: DashboardPreferenceDocument["profile"]; onChange: (value: DashboardPreferenceDocument["profile"]) => void; onNavigateAvatars: () => void; onSave: () => void; saved: string | null }>) {
  const selectedAvatar = window.localStorage.getItem(`knowhere.dashboard.knowledge.v1.${userId}.avatars`);
  const avatarGlyphs: Readonly<Record<string, string>> = { wanderer: "GW", wraith: "SW", keeper: "KI", ember: "EC" };
  return <PageShell eyebrow="Account" title="Profile Page" description="Control how your identity appears throughout the Kingdom." saved={saved} onSave={onSave}><div className="dashboard-profile-layout"><Panel title="Spirit portrait" description="Choose from avatars collected in Knowledge."><div className="dashboard-avatar-preview">{selectedAvatar ? avatarGlyphs[selectedAvatar] ?? value.displayName.slice(0, 2).toUpperCase() : value.displayName.slice(0, 2).toUpperCase()}</div><button type="button" onClick={onNavigateAvatars}>Choose Collected Avatar</button></Panel><Panel title="Public identity"><Field label="Display name"><input value={value.displayName} onChange={(event) => onChange({ ...value, displayName: event.target.value })} /></Field><Field label="Title"><input value={value.title} onChange={(event) => onChange({ ...value, title: event.target.value })} /></Field><Field label="Pronouns"><input value={value.pronouns} placeholder="Optional" onChange={(event) => onChange({ ...value, pronouns: event.target.value })} /></Field><Field label="Presence"><select value={value.status} onChange={(event) => onChange({ ...value, status: event.target.value })}><option>Available</option><option>Busy</option><option>Invisible</option></select></Field><Field label="About"><textarea rows={5} value={value.about} onChange={(event) => onChange({ ...value, about: event.target.value })} /></Field><Field label="Profile visibility"><select value={value.visibility} onChange={(event) => onChange({ ...value, visibility: event.target.value as typeof value.visibility })}><option value="public">Public</option><option value="friends">Friends</option><option value="private">Private</option></select></Field></Panel></div></PageShell>;
}

function AccountPage({ user, value, onChange, onSave, saved }: Readonly<{ user: { id: string; username: string }; value: DashboardPreferenceDocument["account"]; onChange: (value: DashboardPreferenceDocument["account"]) => void; onSave: () => void; saved: string | null }>) {
  return <PageShell eyebrow="Account" title="Account Settings" description="Review your local identity, communication, and session preferences." saved={saved} onSave={onSave}><div className="dashboard-section-grid"><Panel title="Identity"><Field label="Username" hint="Usernames require a verified server workflow to change."><input readOnly value={user.username} /></Field><Field label="Account ID"><input readOnly value={user.id} /></Field><Field label="Email"><input type="email" value={value.email} placeholder="Optional local contact address" onChange={(event) => onChange({ ...value, email: event.target.value })} /></Field></Panel><Panel title="Region and language"><Field label="Language"><select value={value.locale} onChange={(event) => onChange({ ...value, locale: event.target.value })}><option>English (US)</option><option>English (UK)</option><option>French</option><option>German</option><option>Japanese</option></select></Field><Field label="Timezone"><select value={value.timezone} onChange={(event) => onChange({ ...value, timezone: event.target.value })}><option>Local device time</option><option>UTC</option><option>America/New_York</option><option>Europe/London</option></select></Field><Toggle label="Kingdom announcements" description="Receive important local-world notices." checked={value.announcements} onChange={(checked) => onChange({ ...value, announcements: checked })} /><Toggle label="Security alerts" description="Show warnings for new and revoked sessions." checked={value.securityAlerts} onChange={(checked) => onChange({ ...value, securityAlerts: checked })} /></Panel><Panel title="Security and sessions" description="Sensitive operations remain server-authoritative."><div className="dashboard-session-row"><span><b>This browser</b><small>Active local session</small></span><i>current</i></div><button type="button" disabled>Change Password</button><button type="button" disabled>Revoke Other Sessions</button><p className="dashboard-inline-note">Password and session mutations will unlock with persistent identity storage and audited endpoints.</p></Panel></div></PageShell>;
}

function GameplayPage({ value, onChange, onSave, onReset, saved }: Readonly<{ value: DashboardPreferenceDocument["gameplay"]; onChange: (value: DashboardPreferenceDocument["gameplay"]) => void; onSave: () => void; onReset: () => void; saved: string | null }>) {
  const [tab, setTab] = useState<"crosshair" | "loot" | "tooltips">("crosshair");
  return <PageShell eyebrow="Game Settings" title="Game" description="Configure the live reticle and loot-label presentation." saved={saved} onSave={onSave} onReset={onReset}>
    <nav className="dashboard-subtabs" aria-label="Game settings categories">
      <button type="button" className={tab === "crosshair" ? "active" : ""} onClick={() => setTab("crosshair")}>Crosshair</button>
      <button type="button" className={tab === "loot" ? "active" : ""} onClick={() => setTab("loot")}>Loot Options</button>
      <button type="button" className={tab === "tooltips" ? "active" : ""} onClick={() => setTab("tooltips")}>Tooltips</button>
    </nav>
    {tab === "crosshair" ? <div className="dashboard-preview-layout"><Panel title="Crosshair Settings" description="The saved profile drives this preview and the live world reticle."><Toggle label="Show crosshair" description="Display the world targeting reticle." checked={value.crosshairEnabled} onChange={(crosshairEnabled) => onChange({ ...value, crosshairEnabled })} /><Field label="Reticle preset"><select value={value.crosshairPreset} onChange={(event) => onChange({ ...value, crosshairPreset: event.target.value as typeof value.crosshairPreset })}><option value="cross">Cross</option><option value="dot">Dot</option><option value="circle">Circle</option><option value="chevron">Chevron</option></select></Field><Field label="Reticle color"><input type="color" value={value.crosshairColor} onChange={(event) => onChange({ ...value, crosshairColor: event.target.value })} /></Field><Slider label="Overall size" value={value.crosshairSize} min={16} max={80} suffix="px" onChange={(crosshairSize) => onChange({ ...value, crosshairSize })} /><Slider label="Line thickness" value={value.crosshairLineWidth} min={1} max={12} suffix="px" onChange={(crosshairLineWidth) => onChange({ ...value, crosshairLineWidth })} /><Slider label="Center gap" value={value.crosshairGap} min={0} max={32} suffix="px" onChange={(crosshairGap) => onChange({ ...value, crosshairGap })} /><Slider label="Reticle opacity" value={value.crosshairOpacity} onChange={(crosshairOpacity) => onChange({ ...value, crosshairOpacity })} /><Toggle label="Show outline" description="Add a high-contrast reticle outline." checked={value.crosshairOutline} onChange={(crosshairOutline) => onChange({ ...value, crosshairOutline })} />{value.crosshairOutline ? <><Field label="Outline color"><input type="color" value={value.crosshairOutlineColor} onChange={(event) => onChange({ ...value, crosshairOutlineColor: event.target.value })} /></Field><Slider label="Outline width" value={value.crosshairOutlineWidth} min={0} max={6} suffix="px" onChange={(crosshairOutlineWidth) => onChange({ ...value, crosshairOutlineWidth })} /><Slider label="Outline opacity" value={value.crosshairOutlineOpacity} onChange={(crosshairOutlineOpacity) => onChange({ ...value, crosshairOutlineOpacity })} /></> : null}<Toggle label="Show center dot" description="Place a dot at the exact target point." checked={value.centerDot} onChange={(centerDot) => onChange({ ...value, centerDot })} />{value.centerDot ? <><Slider label="Center-dot size" value={value.crosshairCenterDotSize} min={1} max={16} suffix="px" onChange={(crosshairCenterDotSize) => onChange({ ...value, crosshairCenterDotSize })} /><Field label="Center-dot color"><input type="color" value={value.crosshairCenterDotColor} onChange={(event) => onChange({ ...value, crosshairCenterDotColor: event.target.value })} /></Field></> : null}</Panel><figure className="dashboard-live-preview"><figcaption>Live settings preview</figcaption><div className={`dashboard-crosshair-preview reticle-preset-${value.crosshairPreset}${value.crosshairOutline ? " has-reticle-outline" : ""}`} style={{ "--atlas-crosshair-size": `${value.crosshairSize}px`, "--atlas-crosshair-line-width": `${value.crosshairLineWidth}px`, "--atlas-crosshair-gap": `${value.crosshairGap}px`, "--atlas-crosshair-color": value.crosshairColor, "--atlas-crosshair-opacity": value.crosshairEnabled ? value.crosshairOpacity / 100 : 0, "--atlas-crosshair-outline-color": value.crosshairOutlineColor, "--atlas-crosshair-outline-width": `${value.crosshairOutline ? value.crosshairOutlineWidth : 0}px`, "--atlas-crosshair-outline-opacity": value.crosshairOutlineOpacity / 100, "--atlas-crosshair-dot-size": `${value.crosshairCenterDotSize}px`, "--atlas-crosshair-dot-color": value.crosshairCenterDotColor } as CSSProperties}><span className="atlas-crosshair-reticle"><i className="reticle-part-top" /><i className="reticle-part-right" /><i className="reticle-part-bottom" /><i className="reticle-part-left" />{value.centerDot ? <b /> : null}<em /><s /></span></div></figure></div> : null}
    {tab === "loot" ? <div className="dashboard-preview-layout"><Panel title="Loot Options" description="Preview label preferences. In-world application awaits a loot-label renderer consumer."><Toggle label="Show loot labels" description="Display labels for nearby dropped items." checked={value.lootLabels} onChange={(lootLabels) => onChange({ ...value, lootLabels })} /><Field label="Minimum quality"><select value={value.lootMinimumQuality} onChange={(event) => onChange({ ...value, lootMinimumQuality: event.target.value })}><option>Common</option><option>Uncommon</option><option>Rare</option><option>Epic</option><option>Cosmic</option></select></Field><Toggle label="Show distance" description="Include distance in each visible label." checked={value.lootDistance} onChange={(lootDistance) => onChange({ ...value, lootDistance })} /><Slider label="Maximum label distance" value={value.lootMaxDistance} min={4} max={64} suffix="m" onChange={(lootMaxDistance) => onChange({ ...value, lootMaxDistance })} /></Panel><figure className="dashboard-live-preview"><figcaption>Live settings preview</figcaption><div className="dashboard-loot-preview">{value.lootLabels ? <span><b>Awareness</b><small>{value.lootMinimumQuality}{value.lootDistance ? ` · ${Math.min(12, value.lootMaxDistance)}m` : ""}</small></span> : <em>Loot labels disabled</em>}</div></figure></div> : null}
    {tab === "tooltips" ? <div className="dashboard-preview-layout"><Panel title="Tooltip placement" description="Choose where item details appear throughout inventory screens and the live HUD."><Field label="Preferred side"><select value={value.tooltipPlacement} onChange={(event) => onChange({ ...value, tooltipPlacement: event.target.value as TooltipPlacement })}><option value="right">Right</option><option value="left">Left</option><option value="above">Above</option><option value="below">Below</option><option value="cursor">Cursor</option></select></Field><p className="dashboard-inline-note">Right is the default. Tooltips remain within the viewport when the preferred side has limited space.</p></Panel><figure className={`dashboard-live-preview dashboard-tooltip-preview is-${value.tooltipPlacement}`}><figcaption>Live settings preview</figcaption><div className="dashboard-tooltip-preview__item">Awareness<span><b>Awareness</b><small>Quality 8 · Cosmic</small></span></div></figure></div> : null}
  </PageShell>;
}

function ControlsPage({ page, value, onChange, onNavigate, onSave, onReset, saved }: Readonly<{ page: ControlsPage; value: DashboardPreferenceDocument["controls"]; onChange: (value: DashboardPreferenceDocument["controls"]) => void; onNavigate: (page: SettingsDashboardPage) => void; onSave: () => void; onReset: () => void; saved: string | null }>) {
  const [rebinding, setRebinding] = useState<{ id: string; column: BindingColumn } | null>(null);
  useEffect(() => {
    if (!rebinding) return;
    const commit = (nextValue: string) => {
      onChange({ ...value, bindings: value.bindings.map((binding) => binding.id === rebinding.id ? { ...binding, [rebinding.column]: nextValue } : binding) });
      setRebinding(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      if (event.key === "Escape") { setRebinding(null); return; }
      commit(event.key.length === 1 ? event.key.toUpperCase() : event.key);
    };
    const onMouseDown = (event: MouseEvent) => {
      event.preventDefault();
      const ordinal = event.button === 0 ? 1 : event.button === 2 ? 2 : event.button === 1 ? 3 : event.button + 1;
      commit(`Mouse ${ordinal}${rebinding.id === "right-action-scroll-modifier" ? " (Hold)" : ""}`);
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      commit(event.deltaY < 0 ? "Scroll Up" : "Scroll Down");
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("mousedown", onMouseDown, { capture: true });
    window.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("mousedown", onMouseDown, { capture: true });
      window.removeEventListener("wheel", onWheel, { capture: true });
    };
  }, [onChange, rebinding, value]);
  const bindingGroups = useMemo(() => {
    const interfaceGroups = new Set<SettingsBinding["group"]>(["UI", "Chat"]);
    const visible = value.bindings.filter((binding) => page === "controls-actions" ? !interfaceGroups.has(binding.group) : interfaceGroups.has(binding.group));
    return visible.reduce<Array<[SettingsBinding["group"], SettingsBinding[]]>>((groups, binding) => {
      const existing = groups.find(([group]) => group === binding.group);
      if (existing) existing[1].push(binding);
      else groups.push([binding.group, [binding]]);
      return groups;
    }, []);
  }, [page, value.bindings]);
  const bindingPanels = page === "controls-actions" || page === "controls-ui" ? bindingGroups.map(([group, bindings]) => (
    <Panel title={group} description={group === "Movement Abilities" ? "Dodge activates by double-tapping a movement direction, or through its dedicated binding." : undefined} key={group}>
      <div className="dashboard-binding-table">
        <header><span>Action</span><span>Primary</span><span>Secondary</span><span>Gamepad</span></header>
        {bindings.map((binding) => <div key={binding.id}><span><b>{binding.label}</b>{binding.hint ? <small>{binding.hint}</small> : null}</span>{(["primary", "secondary", "gamepad"] as const).map((column) => <button type="button" disabled={binding.id === "escape" || column === "gamepad"} className={rebinding?.id === binding.id && rebinding.column === column ? "active" : ""} onClick={() => setRebinding({ id: binding.id, column })} key={column}>{rebinding?.id === binding.id && rebinding.column === column ? "Press a key…" : binding[column]}</button>)}</div>)}
      </div>
    </Panel>
  )) : null;
  return <PageShell eyebrow="Game Settings · Controls" title={controlPages.find((entry) => entry.page === page)?.label ?? "Controls"} description="Bindings and device preferences are shared with the gameplay HUD." saved={saved} onSave={onSave} onReset={onReset}><nav className="dashboard-subtabs">{controlPages.map((entry) => <button type="button" className={page === entry.page ? "active" : ""} onClick={() => onNavigate(entry.page)} key={entry.page}>{entry.label}</button>)}</nav>{bindingPanels}{page === "controls-mouse" ? <div className="dashboard-section-grid"><Panel title="Pointer response"><Slider label="Horizontal sensitivity" value={value.mouseX} onChange={(mouseX) => onChange({ ...value, mouseX })} /><Slider label="Vertical sensitivity" value={value.mouseY} onChange={(mouseY) => onChange({ ...value, mouseY })} /><Toggle label="Invert vertical look" description="Reverse the mouse Y axis." checked={value.invertMouseY} onChange={(invertMouseY) => onChange({ ...value, invertMouseY })} /></Panel></div> : null}{page === "controls-gamepad" ? <div className="dashboard-section-grid"><Panel title="Gamepad configuration"><Toggle label="Enable gamepad" description="Accept input from the active controller." checked={value.gamepadEnabled} onChange={(gamepadEnabled) => onChange({ ...value, gamepadEnabled })} /><Toggle label="Invert camera Y" description="Reverse the right-stick vertical axis." checked={value.invertGamepadY} onChange={(invertGamepadY) => onChange({ ...value, invertGamepadY })} /><Slider label="Stick deadzone" value={value.deadzone} onChange={(deadzone) => onChange({ ...value, deadzone })} /><Slider label="Vibration" value={value.vibration} onChange={(vibration) => onChange({ ...value, vibration })} /></Panel><Panel title="Detected controller"><div className="dashboard-device-state"><i /><span><b>No controller detected</b><small>Connect a controller and press any button.</small></span></div></Panel></div> : null}{page === "controls-touch" ? <div className="dashboard-section-grid"><Panel title="Touch Sources & Tuning" description="Semantic assignments share the player action bus; layout slots remain presentation metadata."><div className="dashboard-touch-source"><b>Movement</b><span>Left control region · camera-relative movement</span></div><div className="dashboard-touch-source"><b>Look</b><span>Right gameplay region · drag to look</span></div><div className="dashboard-touch-source"><b>Primary action</b><span>Action control · press and release semantics</span></div><div className="dashboard-touch-source"><b>Jump / Flight</b><span>Uses the same configured character actions as keyboard input</span></div></Panel><Panel title="Touch status"><div className="dashboard-device-state"><i /><span><b>Adaptive layout</b><small>Controls attach only on touch-capable gameplay surfaces.</small></span></div></Panel></div> : null}</PageShell>;
}

function DisplayPage({ value, onChange, onSave, onReset, saved }: Readonly<{ value: DashboardPreferenceDocument["display"]; onChange: (value: DashboardPreferenceDocument["display"]) => void; onSave: () => void; onReset: () => void; saved: string | null }>) {
  return <PageShell eyebrow="Game Settings" title="Display" description="Configure presentation, graphics quality, and interface scale." saved={saved} onSave={onSave} onReset={onReset}><div className="dashboard-section-grid"><Panel title="Display mode"><Field label="Window mode"><select value={value.windowMode} onChange={(event) => onChange({ ...value, windowMode: event.target.value })}><option>Windowed</option><option>Borderless</option><option>Fullscreen</option></select></Field><Field label="Resolution"><select value={value.resolution} onChange={(event) => onChange({ ...value, resolution: event.target.value })}><option>Native</option><option>2560 × 1440</option><option>1920 × 1080</option><option>1280 × 720</option></select></Field><Slider label="HUD scale" value={value.hudScale} min={75} max={150} onChange={(hudScale) => onChange({ ...value, hudScale })} /></Panel><Panel title="Graphics"><Field label="Quality preset"><select value={value.quality} onChange={(event) => onChange({ ...value, quality: event.target.value })}><option>Low</option><option>Medium</option><option>High</option><option>Ultra</option><option>Custom</option></select></Field><Slider label="Render distance" value={value.renderDistance} onChange={(renderDistance) => onChange({ ...value, renderDistance })} /><Toggle label="Shadows" description="Render dynamic terrain and object shadows." checked={value.shadows} onChange={(shadows) => onChange({ ...value, shadows })} /><Toggle label="Bloom" description="Enable glow around emissive materials." checked={value.bloom} onChange={(bloom) => onChange({ ...value, bloom })} /><Toggle label="Motion blur" description="Blur fast camera and object movement." checked={value.motionBlur} onChange={(motionBlur) => onChange({ ...value, motionBlur })} /></Panel></div></PageShell>;
}

function AudioPage({ value, onChange, onSave, onReset, saved }: Readonly<{ value: DashboardPreferenceDocument["audio"]; onChange: (value: DashboardPreferenceDocument["audio"]) => void; onSave: () => void; onReset: () => void; saved: string | null }>) {
  return <PageShell eyebrow="Game Settings" title="Audio" description="Balance voice, music, effects, and environmental sound." saved={saved} onSave={onSave} onReset={onReset}><div className="dashboard-section-grid"><Panel title="Volume mixer"><Slider label="Master" value={value.master} onChange={(master) => onChange({ ...value, master })} /><Slider label="Voice" value={value.voice} onChange={(voice) => onChange({ ...value, voice })} /><Slider label="Music" value={value.music} onChange={(music) => onChange({ ...value, music })} /><Slider label="Sound effects" value={value.effects} onChange={(effects) => onChange({ ...value, effects })} /><Slider label="Ambience" value={value.ambience} onChange={(ambience) => onChange({ ...value, ambience })} /></Panel><Panel title="Output"><Field label="Audio device"><select value={value.output} onChange={(event) => onChange({ ...value, output: event.target.value })}><option>System default</option><option>Primary speakers</option><option>Primary headphones</option></select></Field><Toggle label="Mute while unfocused" description="Silence the game when another window is active." checked={value.muteUnfocused} onChange={(muteUnfocused) => onChange({ ...value, muteUnfocused })} /></Panel></div></PageShell>;
}
