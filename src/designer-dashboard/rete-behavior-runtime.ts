import { ClassicPreset } from "rete";

import { behaviorRecord, type ScreenStudioBehaviorNode } from "../dashboard/screen-studio-behavior-model.ts";

export const SCREEN_STUDIO_RETE_RUNTIME = "ScreenStudioReteBehaviorRuntimeV1" as const;
export const screenStudioBehaviorSocket = new ClassicPreset.Socket("behavior-flow");

export function buildScreenStudioReteNode(draftNode: ScreenStudioBehaviorNode): ClassicPreset.Node {
  const record = behaviorRecord(draftNode.recordId);
  const node = new ClassicPreset.Node(record?.name ?? draftNode.recordId);
  node.id = draftNode.id;
  for (const input of record?.inputs ?? []) node.addInput(input, new ClassicPreset.Input(screenStudioBehaviorSocket, input));
  for (const output of record?.outputs ?? []) node.addOutput(output, new ClassicPreset.Output(screenStudioBehaviorSocket, output));
  return node;
}
