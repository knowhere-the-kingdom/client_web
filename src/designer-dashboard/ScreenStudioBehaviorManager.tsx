import { useEffect, useMemo, useState } from "react";
import {
  actionBindingForBehaviorRecord,
  addBehaviorNode,
  behaviorRecord,
  createBehaviorDraft,
  groupedBehaviorRecords,
  parentBehaviorNode,
  removeBehaviorNode,
  updateBehaviorDraft,
  type ScreenStudioBehaviorDraft,
} from "../dashboard/screen-studio-behavior-model.ts";
import { loadControlBindings } from "../hud/demoData.ts";
import type { SettingsBinding } from "../hud/types.ts";
import { ScreenDesignerSurface } from "./CreatorDesignerSurfaces.tsx";
import { ReteBehaviorGraph } from "./ReteBehaviorGraph.tsx";
import { WorkspaceEditorOverlay } from "./WorkspaceEditorOverlay.tsx";
import type { AuthorizationProjection } from "./workspace-model.ts";
import "./screen-studio-behavior-manager.css";

export function ScreenStudioBehaviorManager({ authorization, expectedAuthorizationRevision }: Readonly<{ authorization: AuthorizationProjection | null; expectedAuthorizationRevision: number }>) {
  const allowed = authorization?.revision === expectedAuthorizationRevision && authorization.capabilities.includes("world.designer.read");
  const [drafts, setDrafts] = useState<readonly ScreenStudioBehaviorDraft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [accountBindings, setAccountBindings] = useState<readonly SettingsBinding[]>(loadControlBindings);
  useEffect(() => {
    const refresh = (event: Event) => setAccountBindings((event as CustomEvent<SettingsBinding[]>).detail ?? loadControlBindings());
    window.addEventListener("knowhere:control-bindings-changed", refresh);
    return () => window.removeEventListener("knowhere:control-bindings-changed", refresh);
  }, []);
  const selected = drafts.find((draft) => draft.id === selectedDraftId) ?? null;
  const groups = useMemo(() => groupedBehaviorRecords(query), [query]);
  const save = (draft: ScreenStudioBehaviorDraft) => { setDrafts((current)=>[draft,...current.filter((entry)=>entry.id!==draft.id)]); setSelectedDraftId(draft.id); };
  const create = () => { const draft=createBehaviorDraft(`local-behavior-${drafts.length+1}`); save(draft); };
  const openCatalog = (recordId: string) => { const entry=behaviorRecord(recordId)!; const draft=addBehaviorNode(createBehaviorDraft(`local-${recordId}-${drafts.length+1}`,entry.name),recordId); save(draft); };
  const add = (recordId: string) => { if(selected) save(addBehaviorNode(selected,recordId,selectedNodeId)); };
  const removeSelectedNode = () => { if(selected&&selectedNodeId){save(removeBehaviorNode(selected,selectedNodeId));setSelectedNodeId(null);} };
  const groupSelected = () => { if(!selected||!selectedNodeId)return; const groupDraft=addBehaviorNode(selected,"sequence"); const groupNode=groupDraft.nodes.at(-1); if(groupNode) save(parentBehaviorNode(groupDraft,selectedNodeId,groupNode.id)); };
  const ungroupSelected = () => { if(selected&&selectedNodeId) save(parentBehaviorNode(selected,selectedNodeId,null)); };
  if (!allowed) return <p className="screen-studio-boundary" role="alert">Behaviors require the exact revision-matched World Designer capability.</p>;
  const graph = selected ? <ReteBehaviorGraph draft={selected} onSelect={setSelectedNodeId} onChange={save}/> : null;
  return <section className={`screen-studio-manager screen-studio-behavior-manager workspace-overlay-host${expanded?" is-expanded":""}`} aria-label="Behaviors manager">
    <div className="screen-studio-behavior-manager__surface" hidden={expanded}><header className="screen-studio-manager__header"><div><h2>Behaviors</h2><p>Rete visual behaviors driven by the current Account Settings action bindings.</p></div><button type="button" onClick={create}>Add New</button></header><div className="screen-studio-manager__toolbar"><label>Search behaviors<input type="search" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search behaviors, actions and triggers…"/></label></div><div className="screen-studio-behavior-manager__catalog">{groups.map((group)=><section key={group.category}><h3>{group.category}</h3><div role="listbox" aria-label={`${group.category} behavior records`}>{group.records.map((record)=>{const binding=actionBindingForBehaviorRecord(record.id,accountBindings);return <button role="option" aria-selected={selected?.nodes.some((node)=>node.recordId===record.id)} type="button" key={record.id} onClick={()=>openCatalog(record.id)}><span><b>{record.name}</b><small>{binding?`Account keybind · ${binding.primary} · ${binding.secondary} · ${binding.gamepad}`:`${record.kind} · ${record.description}`}</small></span></button>;})}</div></section>)}</div></div>
    {expanded&&selected?<ScreenDesignerSurface label="Behavior Designer" variant="behavior">{graph}</ScreenDesignerSurface>:null}
    <WorkspaceEditorOverlay open={Boolean(selected)} title={selected?`Edit Behavior · ${selected.name}`:"Edit Behavior"} onDismiss={()=>expanded?setExpanded(false):setSelectedDraftId(null)} onClose={()=>setSelectedDraftId(null)} className={`screen-studio-behavior-editor${expanded?" is-expanded":""}`} headerActions={<button type="button" aria-label={expanded?"Contract Behavior Editor":"Expand Behavior Editor"} aria-pressed={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?"↙":"⛶"}</button>}>
      {selected?<div className="screen-studio-behavior-editor__body">{!expanded?graph:null}<label>Name<input value={selected.name} onChange={(event)=>save(updateBehaviorDraft(selected,{name:event.target.value}))}/></label><div className="screen-studio-behavior-editor__actions"><button type="button" onClick={groupSelected} disabled={!selectedNodeId}>Group</button><button type="button" onClick={ungroupSelected} disabled={!selectedNodeId}>Ungroup</button><button type="button" onClick={removeSelectedNode} disabled={!selectedNodeId}>Remove node</button></div><fieldset><legend>Add visual block</legend>{groups.map((group)=><section key={group.category}><h3>{group.category}</h3>{group.records.map((record)=><button type="button" key={record.id} onClick={()=>add(record.id)}>{record.name}</button>)}</section>)}</fieldset><small>Session-memory Rete graph only. Ports and Account action references are typed; executable scripts, database writes, and publication are unavailable.</small></div>:null}
    </WorkspaceEditorOverlay>
  </section>;
}
