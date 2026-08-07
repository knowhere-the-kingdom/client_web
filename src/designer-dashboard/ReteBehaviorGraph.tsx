import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { ClassicPreset, GetSchemes, NodeEditor } from "rete";
import { AreaExtensions, AreaPlugin } from "rete-area-plugin";
import { ConnectionPlugin, Presets as ConnectionPresets } from "rete-connection-plugin";
import { Presets as ReactPresets, ReactArea2D, ReactPlugin } from "rete-react-plugin";

import {
  connectBehaviorNodes,
  disconnectBehaviorWire,
  moveBehaviorNode,
  type ScreenStudioBehaviorDraft,
} from "../dashboard/screen-studio-behavior-model.ts";
import { buildScreenStudioReteNode } from "./rete-behavior-runtime.ts";

type ReteNode = ClassicPreset.Node;
type ReteConnection = ClassicPreset.Connection<ReteNode, ReteNode>;
type Schemes = GetSchemes<ReteNode, ReteConnection>;
type AreaExtra = ReactArea2D<Schemes>;

export function ReteBehaviorGraph({ draft, onChange, onSelect }: Readonly<{
  draft: ScreenStudioBehaviorDraft;
  onChange: (draft: ScreenStudioBehaviorDraft) => void;
  onSelect: (nodeId: string | null) => void;
}>) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const draftRef = useRef(draft);
  onChangeRef.current = onChange;
  draftRef.current = draft;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();
    const editor = new NodeEditor<Schemes>();
    const area = new AreaPlugin<Schemes, AreaExtra>(host);
    const connections = new ConnectionPlugin<Schemes, AreaExtra>();
    const renderer = new ReactPlugin<Schemes, AreaExtra>({ createRoot });
    renderer.addPreset(ReactPresets.classic.setup());
    connections.addPreset(ConnectionPresets.classic.setup());
    editor.use(area);
    area.use(connections);
    area.use(renderer);
    AreaExtensions.selectableNodes(area, AreaExtensions.selector(), { accumulating: AreaExtensions.accumulateOnCtrl() });
    AreaExtensions.simpleNodesOrder(area);

    let hydrating = true;
    area.addPipe((context) => {
      if (context.type === "nodepicked") onSelect(context.data.id);
      if (context.type === "pointerdown" && context.data.event.target === host) onSelect(null);
      if (!hydrating && context.type === "nodetranslated") {
        const current = draftRef.current;
        const next = moveBehaviorNode(current, context.data.id, context.data.position.x, context.data.position.y);
        if (next !== current) onChangeRef.current(next);
      }
      return context;
    });
    editor.addPipe((context) => {
      if (!hydrating && context.type === "connectioncreated") {
        const connection = context.data;
        const current = draftRef.current;
        const next = connectBehaviorNodes(current, connection.source, String(connection.sourceOutput), connection.target, String(connection.targetInput));
        if (next !== current) onChangeRef.current(next);
      }
      if (!hydrating && context.type === "connectionremoved") {
        const current = draftRef.current;
        const wire = current.wires.find((candidate) => candidate.fromNodeId === context.data.source
          && candidate.toNodeId === context.data.target
          && candidate.fromPort === String(context.data.sourceOutput)
          && candidate.toPort === String(context.data.targetInput));
        if (wire) onChangeRef.current(disconnectBehaviorWire(current, wire.id));
      }
      return context;
    });

    let cancelled = false;
    void (async () => {
      const reteNodes = new Map<string, ReteNode>();
      for (const draftNode of draft.nodes) {
        const node = buildScreenStudioReteNode(draftNode);
        reteNodes.set(node.id, node);
        await editor.addNode(node);
        await area.translate(node.id, { x: draftNode.x, y: draftNode.y });
      }
      for (const wire of draft.wires) {
        const source = reteNodes.get(wire.fromNodeId);
        const target = reteNodes.get(wire.toNodeId);
        if (!source || !target || !source.hasOutput(wire.fromPort) || !target.hasInput(wire.toPort)) continue;
        const connection = new ClassicPreset.Connection(source, wire.fromPort, target, wire.toPort);
        connection.id = wire.id;
        await editor.addConnection(connection);
      }
      if (!cancelled) {
        hydrating = false;
        if (draft.nodes.length) await AreaExtensions.zoomAt(area, editor.getNodes());
      }
    })();

    return () => {
      cancelled = true;
      area.destroy();
      void editor.clear();
    };
  }, [draft.id, draft.nodes.length, draft.wires.length, onSelect]);

  return <div ref={hostRef} className="screen-studio-behavior-rete" role="application" aria-label="Rete behavior visual programming graph" />;
}
