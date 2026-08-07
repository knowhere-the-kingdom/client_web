import type { ReactNode } from "react";

import type { CreatorWorkspaceEntry } from "../dashboard/creator-workspace-registry.ts";
import { ScreenStudioEditor } from "./ScreenStudioEditor.tsx";
import type { AuthorizationProjection } from "./workspace-model.ts";
import "./creator-workspace-pages.css";

export function ScreenDesignerSurface({ label, children, variant = "grid" }: Readonly<{ label: string; children: ReactNode; variant?: "grid" | "element" | "behavior" }>) {
  return <section className="creator-screen-designer" data-designer-variant={variant} aria-label={`${label} workspace`}>
    <div className="creator-screen-designer__surface">{children}</div>
  </section>;
}

export function CreatorGridDesigner({ entry, authorization, expectedAuthorizationRevision, parentAuthorized }: Readonly<{
  entry: CreatorWorkspaceEntry;
  authorization: AuthorizationProjection | null;
  expectedAuthorizationRevision: number;
  parentAuthorized: boolean;
}>) {
  return <ScreenDesignerSurface label={entry.label}>
    <ScreenStudioEditor authorization={authorization} expectedAuthorizationRevision={expectedAuthorizationRevision} parentAuthorized={parentAuthorized} />
  </ScreenDesignerSurface>;
}

export function CreatorModelDesigner({ entry }: Readonly<{ entry: CreatorWorkspaceEntry }>) {
  const focus = entry.id === "model-designer" ? null : entry.label;
  return <section className="creator-model-designer" aria-labelledby="creator-model-designer-title" data-model-focus={focus ?? "blank"}>
    <header><h1 id="creator-model-designer-title">Model Designer</h1>{focus ? <span>Focus: {focus}</span> : null}</header>
    <div className="creator-model-designer__canvas" role="img" aria-label={focus ? `Blank Model Designer canvas focused on ${focus}` : "Blank Model Designer canvas"}>
      <span>{focus ? `${focus} model workspace` : "Model Designer"}</span>
      <small>Blank session-local authoring surface</small>
    </div>
  </section>;
}
