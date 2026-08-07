import type { CreatorWorkspaceEntry } from "../dashboard/creator-workspace-registry.ts";
import { CreatorGridDesigner, CreatorModelDesigner } from "./CreatorDesignerSurfaces.tsx";
import { CreatorRecordManager } from "./CreatorRecordManager.tsx";
import type { AuthorizationProjection } from "./workspace-model.ts";

export function CreatorWorkspacePage({ entry, authorization, expectedAuthorizationRevision, parentAuthorized }: Readonly<{
  entry: CreatorWorkspaceEntry;
  authorization: AuthorizationProjection | null;
  expectedAuthorizationRevision: number;
  parentAuthorized: boolean;
}>) {
  if (entry.renderMode === "grid-editor") return <CreatorGridDesigner entry={entry} authorization={authorization} expectedAuthorizationRevision={expectedAuthorizationRevision} parentAuthorized={parentAuthorized} />;
  if (entry.renderMode === "model-focus") return <CreatorModelDesigner entry={entry} />;
  return <CreatorRecordManager entry={entry} />;
}
