import { useMemo } from "react";

import type { GatewaySessionProjection } from "../api/gateway-contract.ts";
import { AtlasItemSlot } from "../hud/AtlasPrimitives.tsx";
import { DesignerAwarenessSlot } from "../hud/KnowhereHud.tsx";
import type { CanvasItem } from "../hud/types.ts";
import { ACCOUNT_SOUL_ITEM, CHARACTER_SOUL_ITEM } from "../inventory/inventory-model.ts";
import type { WorkspaceId } from "./workspace-model.ts";

export function WorkspaceSlotHeader({ projection, selectedWorkspace, onBack, onLogout, onWorkspace }: Readonly<{
  projection: GatewaySessionProjection;
  selectedWorkspace: WorkspaceId;
  onBack: () => void;
  onLogout: () => void;
  onWorkspace: (workspace: WorkspaceId, preferredPage: string) => void;
}>) {
  const selectedCharacter = projection.selection.characters.find((character) => character.id === projection.selection.selectedCharacterId)
    ?? projection.selection.characters[0];
  const characterItem = useMemo<CanvasItem | undefined>(() => selectedCharacter ? ({
    id: selectedCharacter.itemInstanceId, type: "character", name: selectedCharacter.displayName,
    w: 2, h: 2, icon: "person", artPath: CHARACTER_SOUL_ITEM.iconPath,
    note: `${selectedCharacter.archetype}${selectedCharacter.level ? ` · Level ${selectedCharacter.level}` : ""}`,
    loc: { kind: "limbo" },
  }) : undefined, [selectedCharacter]);
  const accountItem = useMemo<CanvasItem>(() => ({
    id: projection.accountSoul.instanceId, type: "spirit", name: projection.accountSoul.displayName,
    w: 2, h: 2, icon: "orb", artPath: ACCOUNT_SOUL_ITEM.iconPath,
    note: `Spirit level ${projection.accountSoul.stats.spiritLevel} · ${projection.accountSoul.stats.characterCapacity} character capacity`,
    loc: { kind: "limbo" },
  }), [projection.accountSoul]);

  return <nav className="designer-workspace-slots" aria-label="Primary Workspace slots">
    <section className="designer-workspace-slot designer-workspace-slot--designer" aria-label="Designer slot" data-footprint="2x2">
      <DesignerAwarenessSlot disabled={false} onActivate={onBack} onLogout={onLogout} />
    </section>
    <section className="designer-workspace-slot designer-workspace-slot--character" aria-label="Character slot" data-footprint="2x2">
      <AtlasItemSlot className="designer-workspace-primary-item-slot" item={characterItem} label="Character" size="utility" selected={selectedWorkspace === "character"} onClick={() => onWorkspace("character", "current-character")} />
    </section>
    <section className="designer-workspace-slot designer-workspace-slot--spirit" aria-label="Spirit slot" data-footprint="2x2">
      <AtlasItemSlot className="designer-workspace-primary-item-slot" item={accountItem} label="Spirit" size="utility" selected={selectedWorkspace === "account"} onClick={() => onWorkspace("account", "account-settings")} />
    </section>
  </nav>;
}
