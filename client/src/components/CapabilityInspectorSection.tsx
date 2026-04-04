import { useEffect, useMemo, type ReactNode } from 'react';
import { Info, ExternalLink, GitBranch, Layers3 } from 'lucide-react';
import { useAppStore } from '../store';
import { BLOCK_FAMILY_BADGE_CLASSES, BLOCK_FAMILY_LABELS, SUPPORT_STATUS_META, getInteroperabilityBridges, type ArtifactType, type ProjectMode } from '../capabilities';
import { SUPPORT_STATUS_BADGE_CLASSES, SUPPORT_STATUS_LABELS, getNodeCapabilityInfo, getNodeRuntimeMeta, getRailBadgeClass, getRailLabel, inferNodeMaturity, MATURITY_BADGE_CLASSES, MATURITY_LABELS, SURFACE_BADGE_CLASSES, SURFACE_LABELS } from '../catalog';
import { getLocalPromptForNode, getPromptAssignmentsForTarget, isPromptCapableNodeType, resolvePromptStripsForNodeTarget } from '../store/workspace';

function BoolPill({ value }: { value: boolean }) {
  return (
    <span className={`px-1.5 py-0.5 rounded-full text-[10px] border ${value ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-slate-400 bg-slate-500/10 border-slate-500/20'}`}>
      {value ? 'Yes' : 'No'}
    </span>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[11px]">
      <span className="text-slate-500">{label}</span>
      <div className="text-right text-slate-200">{value}</div>
    </div>
  );
}

export default function CapabilityInspectorSection() {
  const editorMode = useAppStore((s) => s.editorMode);
  const nodes = useAppStore((s) => s.nodes);
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const inspectorTarget = useAppStore((s) => s.capabilityInspectorTarget);
  const openSubgraphTabFromNode = useAppStore((s) => s.openSubgraphTabFromNode);
  const liveState = useAppStore((s) => s.liveState);

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const selectedNode = useMemo(() => {
    if (inspectorTarget?.nodeId) {
      return nodes.find((node) => node.id === inspectorTarget.nodeId) || null;
    }
    return nodes.find((node) => node.selected) || null;
  }, [inspectorTarget?.nodeId, nodes]);

  const nodeType = inspectorTarget?.nodeType || String(selectedNode?.data?.nodeType || '');
  const capability = useMemo(
    () => nodeType ? getNodeCapabilityInfo(nodeType, { artifactType: activeTab?.artifactType, executionProfile: activeTab?.executionProfile }) : null,
    [activeTab?.artifactType, activeTab?.executionProfile, nodeType],
  );
  const maturity = useMemo(
    () => nodeType ? inferNodeMaturity(nodeType, { artifactType: activeTab?.artifactType, executionProfile: activeTab?.executionProfile }) : null,
    [activeTab?.artifactType, activeTab?.executionProfile, nodeType],
  );
  const meta = useMemo(() => nodeType ? getNodeRuntimeMeta(nodeType) : null, [nodeType]);
  const params = (selectedNode?.data?.params || {}) as Record<string, unknown>;
  const structuredSchemaText = typeof params.structured_schema_json === 'string' ? params.structured_schema_json.trim() : '';
  const structuredOutputKey = typeof params.structured_output_key === 'string' && params.structured_output_key.trim() ? params.structured_output_key : structuredSchemaText ? `${selectedNode?.id || nodeType}_data` : '';
  const artifactRefKind = typeof params.artifact_ref_kind === 'string' ? params.artifact_ref_kind : null;
  const targetSubgraph = typeof params.target_subgraph === 'string' ? params.target_subgraph : '';
  const explicitReferenceKind = artifactRefKind || (targetSubgraph.startsWith('artifact:') ? targetSubgraph.split(':')[1]?.split('/')[0] || null : null);
  const openableChild = Boolean(selectedNode && ((nodeType === 'subgraph_node' && (!explicitReferenceKind || explicitReferenceKind === 'subgraph')) || (nodeType === 'sub_agent' && Boolean(explicitReferenceKind) && explicitReferenceKind !== 'subgraph') || (nodeType === 'deep_agent_suite' && (Boolean(explicitReferenceKind) || !explicitReferenceKind))));
  const explicitReferenceMode = explicitReferenceKind === 'agent' ? 'langchain' : explicitReferenceKind === 'deep_agent' ? 'deepagents' : 'langgraph';
  const referenceBridges = explicitReferenceKind
    ? getInteroperabilityBridges(explicitReferenceMode as ProjectMode, (activeTab?.projectMode || 'langgraph') as ProjectMode, explicitReferenceKind as ArtifactType)
    : [];
  const referenceBridge = referenceBridges[0] || null;
  const referenceExecutionKind = typeof params.artifact_execution_kind === 'string' ? params.artifact_execution_kind : null;
  const runtimePromptStripSummary = useMemo(() => {
    if (!selectedNode) return null;
    const raw = liveState['__prompt_strip_meta__'];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const nodesMeta = (raw as Record<string, unknown>).nodes;
    if (!nodesMeta || typeof nodesMeta !== 'object' || Array.isArray(nodesMeta)) return null;
    const entry = (nodesMeta as Record<string, unknown>)[selectedNode.id];
    return entry && typeof entry === 'object' && !Array.isArray(entry)
      ? entry as Record<string, unknown>
      : null;
  }, [liveState, selectedNode]);

  const promptStripSummary = useMemo(() => {
    if (!selectedNode || !activeTab || !isPromptCapableNodeType(nodeType)) return null;
    const library = activeTab.runtimeSettings?.promptStripLibrary || [];
    const allAssignments = activeTab.runtimeSettings?.promptStripAssignments || [];
    const assignments = getPromptAssignmentsForTarget(allAssignments, { kind: 'node', tabId: activeTab.id, nodeId: selectedNode.id });
    const inheritedGraphAssignments = getPromptAssignmentsForTarget(allAssignments, { kind: 'graph', tabId: activeTab.id });
    const localPrompt = getLocalPromptForNode(nodeType, params);
    return {
      assignmentCount: assignments.length,
      inheritedAssignmentCount: inheritedGraphAssignments.length,
      localPromptPresent: localPrompt.trim().length > 0,
      resolved: resolvePromptStripsForNodeTarget({
        localPrompt,
        library,
        assignments: allAssignments,
        graphTarget: { kind: 'graph', tabId: activeTab.id },
        nodeTarget: { kind: 'node', tabId: activeTab.id, nodeId: selectedNode.id },
      }).resolvedPrompt,
    };
  }, [activeTab, nodeType, params, selectedNode]);

  useEffect(() => {
    if (!inspectorTarget && selectedNode?.id && nodeType) {
      useAppStore.getState().setCapabilityInspectorTarget({ source: 'node', nodeType, nodeId: selectedNode.id });
    }
  }, [inspectorTarget, nodeType, selectedNode?.id]);

  return (
    <div className="border border-panel-border rounded-lg overflow-hidden bg-black/10" data-testid="capability-inspector">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-panel-border text-xs font-medium text-slate-300">
        <Info size={12} className="text-cyan-400" />
        <span>Capability Inspector</span>
      </div>
      <div className="px-3 py-3 space-y-3">
        {!capability || !meta ? (
          <div className="text-[11px] text-slate-500 leading-6">
            Pick a node on the canvas or use the small info control in the palette. This inspector reads the canonical catalog/runtime matrix instead of improvising myths.
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">{inspectorTarget?.source === 'catalog' ? 'Catalog entry' : 'Surface target'}</div>
              <div className="text-sm font-medium text-slate-100">{typeof selectedNode?.data?.label === 'string' ? selectedNode.data.label : nodeType}</div>
              <div className="text-[11px] text-slate-400 leading-5">{capability.oneLine}</div>
            </div>

            <div className="space-y-2 rounded-lg border border-panel-border bg-black/20 p-2.5">
              <Row label="Canonical node" value={<code className="text-[10px] text-cyan-300">{capability.canonicalNodeType}</code>} />
              <Row label="Compile target" value={<code className="text-[10px] text-violet-300">{capability.compileTargetType}</code>} />
              <Row label="Rail" value={<span className={`px-1.5 py-0.5 rounded text-[10px] border ${getRailBadgeClass(capability.rail)}`}>{getRailLabel(capability.rail)}</span>} />
              <Row label="Block family" value={<span className={`px-1.5 py-0.5 rounded text-[10px] border ${BLOCK_FAMILY_BADGE_CLASSES[capability.blockFamily]}`}>{BLOCK_FAMILY_LABELS[capability.blockFamily]}</span>} />
              <Row label="Surface" value={<span className={`px-1.5 py-0.5 rounded text-[10px] border ${SURFACE_BADGE_CLASSES[capability.surfaceLevel]}`}>{SURFACE_LABELS[capability.surfaceLevel]}</span>} />
              {maturity && <Row label="Maturity" value={<span className={`px-1.5 py-0.5 rounded text-[10px] border ${MATURITY_BADGE_CLASSES[maturity]}`}>{MATURITY_LABELS[maturity]}</span>} />}
              <Row label="Support status" value={<span data-testid="inspector-support-status" className={`px-1.5 py-0.5 rounded text-[10px] border ${SUPPORT_STATUS_BADGE_CLASSES[capability.supportStatus]}`}>{SUPPORT_STATUS_LABELS[capability.supportStatus]}</span>} />
              {meta.providerLabel && <Row label="Provider" value={<span>{meta.providerLabel}</span>} />}
              {meta.toolFamilyLabel && <Row label="Tool family" value={<span>{meta.toolFamilyLabel}</span>} />}
              {meta.toolProvisioningModel && <Row label="Tool provisioning" value={<span>{meta.toolProvisioningModel.replace(/_/g, ' ')}</span>} />}
              {meta.toolSelectionAuthority && <Row label="Tool selection authority" value={<span>{meta.toolSelectionAuthority.replace(/_/g, ' ')}</span>} />}
              {meta.toolAccessScope && <Row label="Tool access scope" value={<span>{meta.toolAccessScope.replace(/_/g, ' ')}</span>} />}
              {meta.toolResultModel && <Row label="Tool result delivery" value={<span>{meta.toolResultModel.replace(/_/g, ' ')}</span>} />}
              {meta.statefulness && <Row label="Statefulness" value={<span>{meta.statefulness.replace(/_/g, ' ')}</span>} />}
              {meta.permissionLevel && <Row label="Permission" value={<span>{meta.permissionLevel.replace(/_/g, ' ')}</span>} />}
              {typeof meta.configRequired === 'boolean' && <Row label="Config required" value={<BoolPill value={meta.configRequired} />} />}
              {typeof meta.sessionBacked === 'boolean' && <Row label="Session-backed" value={<BoolPill value={meta.sessionBacked} />} />}
              <Row label="Runtime-backed" value={<BoolPill value={capability.runtimeBacked} />} />
              <Row label="Alias-backed" value={<BoolPill value={capability.aliasBacked} />} />
              <Row label="Wrapper" value={<BoolPill value={capability.wrapper} />} />
              {editorMode === 'advanced' && (
                <>
                  <Row label="Abstraction" value={<BoolPill value={capability.abstraction} />} />
                  <Row label="Legacy surface" value={<BoolPill value={capability.legacySurface} />} />
                  <Row label="Placement" value={<span>{meta.executionPlacement || 'graph'}</span>} />
                  <Row label="Flavor" value={<span>{meta.executionFlavor || 'inherit'}</span>} />
                  {meta.statefulness && <Row label="Statefulness" value={<span>{meta.statefulness.replace(/_/g, ' ')}</span>} />}
                  {meta.permissionLevel && <Row label="Permission" value={<span>{meta.permissionLevel.replace(/_/g, ' ')}</span>} />}
                  {meta.memorySystemKind && <Row label="Memory system" value={<span>{meta.memorySystemKind.replace(/_/g, ' ')}</span>} />}
                  {meta.memoryDurability && <Row label="Durability" value={<span>{meta.memoryDurability.replace(/_/g, ' ')}</span>} />}
                  {typeof activeTab?.runtimeSettings?.storeBackend === 'string' && meta.memorySystemKind && meta.memorySystemKind.includes('store') && (
                    <Row label="Store backend" value={<span>{activeTab.runtimeSettings.storeBackend.replace(/_/g, ' ')}</span>} />
                  )}
                  <Row label="Profiles" value={<span>{capability.supportedExecutionProfiles.join(', ')}</span>} />
                  <Row label="Trunk-dependent" value={<BoolPill value={capability.trunkDependent} />} />
                  <Row label="Adapter-backed" value={<BoolPill value={capability.adapterBacked} />} />
                  <Row label="Direct compile" value={<BoolPill value={capability.directCompile} />} />
                  <Row label="Direct run" value={<BoolPill value={capability.directRun} />} />
                </>
              )}
              <Row label="Simple palette" value={<BoolPill value={capability.visibleInSimpleMode} />} />
              <Row label="Advanced palette" value={<BoolPill value={capability.visibleInAdvancedMode} />} />
              <Row label="Opens child editor" value={<BoolPill value={capability.opensSubgraphEditor && openableChild} />} />
            </div>

            <div className="rounded-lg border border-panel-border bg-black/20 px-2.5 py-2 text-[11px] text-slate-300 leading-5">
              <strong className="text-slate-200">Status meaning:</strong> {SUPPORT_STATUS_META[capability.supportStatus].description}
            </div>

            {capability.hiddenReason && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-200 leading-5">
                {capability.hiddenReason}
              </div>
            )}


            {(Array.isArray(meta.linkSemantics) && meta.linkSemantics.length > 0 || Array.isArray(meta.uiAbstractionNotes) && meta.uiAbstractionNotes.length > 0 || Array.isArray(meta.linkMultiplicity) && meta.linkMultiplicity.length > 0 || Array.isArray(meta.uiSemanticHandles) && meta.uiSemanticHandles.length > 0 || Array.isArray(meta.debugProjection) && meta.debugProjection.length > 0 || typeof meta.interactionModel === 'string' || typeof meta.graphAbstractionKind === 'string' || typeof meta.compiledGraphRelation === 'string') && (
              <div className="rounded-lg border border-panel-border bg-black/20 p-2.5 space-y-2 text-[11px] text-slate-300 leading-5">
                <div className="font-medium text-slate-200">Interface semantics</div>
                {typeof meta.interactionModel === 'string' && (
                  <div><strong className="text-slate-200">Interaction model:</strong> {meta.interactionModel.replace(/_/g, ' ')}</div>
                )}
                {typeof meta.graphAbstractionKind === 'string' && (
                  <div><strong className="text-slate-200">Graph abstraction kind:</strong> {meta.graphAbstractionKind.replace(/_/g, ' ')}</div>
                )}
                {Array.isArray(meta.uiSemanticHandles) && meta.uiSemanticHandles.length > 0 && (
                  <div>
                    <strong className="text-slate-200">Semantic handles:</strong>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {meta.uiSemanticHandles.map((item) => <span key={item} className="px-1.5 py-0.5 rounded border border-panel-border text-[10px] text-slate-300">{item}</span>)}
                    </div>
                  </div>
                )}
                {Array.isArray(meta.linkMultiplicity) && meta.linkMultiplicity.length > 0 && (
                  <div>
                    <strong className="text-slate-200">Link multiplicity:</strong>
                    <ul className="mt-1 space-y-1 list-disc list-inside text-slate-400">
                      {meta.linkMultiplicity.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                )}
                {Array.isArray(meta.linkSemantics) && meta.linkSemantics.length > 0 && (
                  <div>
                    <strong className="text-slate-200">Link semantics:</strong>
                    <ul className="mt-1 space-y-1 list-disc list-inside text-slate-400">
                      {meta.linkSemantics.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                )}
                {typeof meta.compiledGraphRelation === 'string' && (
                  <div>
                    <strong className="text-slate-200">Compiled graph relation:</strong>
                    <div className="mt-1 text-slate-400">{meta.compiledGraphRelation}</div>
                  </div>
                )}
                {(nodeType === 'llm_chat' || nodeType === 'react_agent' || nodeType === 'sub_agent' || nodeType === 'subgraph_node') && (
                  <div><strong className="text-slate-200">Authoring note:</strong> Handles in the editor are ergonomic attachment points. They do not guarantee a one-to-one correspondence with compiled LangGraph nodes or edges.</div>
                )}
                {Array.isArray(meta.debugProjection) && meta.debugProjection.length > 0 && (
                  <div>
                    <strong className="text-slate-200">Debug / state projection:</strong>
                    <ul className="mt-1 space-y-1 list-disc list-inside text-slate-400">
                      {meta.debugProjection.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                )}
                {meta.graphScopeMarker && (
                  <div><strong className="text-slate-200">Graph-scope marker:</strong> yes</div>
                )}
                {meta.detachedAllowed && (
                  <div><strong className="text-slate-200">Detached allowed:</strong> yes</div>
                )}
                {typeof meta.graphScopeExplanation === 'string' && (
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2 text-[11px] text-slate-300 leading-5">
                    {meta.graphScopeExplanation}
                  </div>
                )}
                {typeof meta.memoryRole === 'string' && (
                  <div><strong className="text-slate-200">Memory role:</strong> {meta.memoryRole.replace(/_/g, ' ')}</div>
                )}
                {typeof meta.memoryAccessModel === 'string' && (
                  <div><strong className="text-slate-200">Memory access model:</strong> {meta.memoryAccessModel.replace(/_/g, ' ')}</div>
                )}
                {typeof meta.toolRuntimeMemoryAccessMode === 'string' && (
                  <div><strong className="text-slate-200">Tool/runtime memory access:</strong> {meta.toolRuntimeMemoryAccessMode.replace(/_/g, ' ')}</div>
                )}
                {meta.preferredSurface && (
                  <div><strong className="text-slate-200">Preferred memory surface:</strong> {meta.preferredSurface === true ? 'this node' : String(meta.preferredSurface)}</div>
                )}
                {meta.legacyHelperSurface && typeof meta.preferredSurface === 'string' && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] text-slate-300 leading-5">
                    This node is still supported, but it now behaves as a <strong>legacy helper surface</strong>. Prefer <code>{String(meta.preferredSurface)}</code> when you want the clearest bounded memory access path in the current build.
                  </div>
                )}
                {!meta.legacyHelperSurface && meta.preferredSurface === true && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 text-[11px] text-slate-300 leading-5">
                    This is the <strong>recommended primary memory surface</strong> for this access pattern in the current build.
                  </div>
                )}
                {Array.isArray(meta.uiAbstractionNotes) && meta.uiAbstractionNotes.length > 0 && (
                  <div>
                    <strong className="text-slate-200">Graphical abstraction notes:</strong>
                    <ul className="mt-1 space-y-1 list-disc list-inside text-slate-400">
                      {meta.uiAbstractionNotes.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {selectedNode && ['llm_chat', 'react_agent', 'sub_agent'].includes(nodeType) && (
              <div className="rounded-lg border border-panel-border bg-black/20 p-2.5 text-[11px] text-slate-300 leading-5">
                Memory linked through <strong>memory_in</strong> is currently a <strong>graph/runtime input payload path</strong>. In the current build the node consumes whatever upstream memory payload is wired in; it is <strong>not</strong> a generic ToolRuntime-style memory search/store API for arbitrary tools.
              </div>
            )}

            {selectedNode && ['llm_chat', 'react_agent'].includes(nodeType) && structuredSchemaText && (
              <div className="rounded-lg border border-panel-border bg-black/20 p-2.5 text-[11px] text-slate-300 leading-5">
                Structured output is active on this node. In the current build the parsed payload is written to <strong>custom_vars.{structuredOutputKey}</strong> rather than emitted as a separate visible graph node.
              </div>
            )}

            {selectedNode && nodeType === 'tool_executor' && (
              <div className="rounded-lg border border-panel-border bg-black/20 p-2.5 text-[11px] text-slate-300 leading-5">
                Explicit <strong>ToolNode</strong> surface. Keep it when you want tool execution shown as a first-class graph step; omit it when the compiler can safely auto-insert the tool loop from linked tools.
              </div>
            )}

            {selectedNode && nodeType === 'deep_agent_suite' && (
              <div className="rounded-lg border border-panel-border bg-black/20 p-2.5 text-[11px] text-slate-300 leading-5">
                Advanced DeepAgents-flavored suite surface. In the current build it remains <strong>adapter-backed</strong> and trunk-compiled rather than a fully separate native runtime family.
              </div>
            )}

            {selectedNode && nodeType === 'prompt_template' && (
              <div className="rounded-lg border border-panel-border bg-black/20 p-2.5 text-[11px] text-slate-300 leading-5" data-testid="prompt-template-boundary">
                Local prompt-composition surface. Use it when one graph step needs an explicit formatted prompt payload. In the current build it does <strong>not</strong> imply a reusable global prompt-strip registry or central prompt assignment panel.
              </div>
            )}

            {selectedNode && promptStripSummary && (
              <div className="rounded-lg border border-panel-border bg-black/20 p-2.5 text-[11px] text-slate-300 leading-5" data-testid="prompt-strip-node-summary">
                <div><strong className="text-slate-200">Prompt strips:</strong> {promptStripSummary.assignmentCount} assignment(s) on this node.</div>
                <div><strong className="text-slate-200">Inherited graph defaults:</strong> {promptStripSummary.inheritedAssignmentCount} assignment(s).</div>
                <div><strong className="text-slate-200">Local prompt:</strong> {promptStripSummary.localPromptPresent ? 'present' : 'empty'}</div>
                <div><strong className="text-slate-200">Resolved preview:</strong> {promptStripSummary.resolved.trim() ? 'available in the state panel' : 'empty for now'}</div>
                <div className="mt-1 text-slate-400">Phase 2 resolves graph defaults plus node-local prompt strips before compile/runtime on supported prompt-bearing surfaces. Prompt-strip publishing and artifact-level propagation still come later.</div>
                {runtimePromptStripSummary && (
                  <div className="mt-1 text-slate-400">Runtime provenance available via <code>__prompt_strip_meta__</code>: {Number(runtimePromptStripSummary.localAssignmentCount || 0)} local assignment(s), {Number(runtimePromptStripSummary.graphAssignmentCount || 0)} inherited graph assignment(s), preview length {Number(runtimePromptStripSummary.resolvedPromptLength || 0)}.</div>
                )}
              </div>
            )}

            {selectedNode && ['memory_store_read', 'memoryreader', 'memorywriter', 'memory_access'].includes(nodeType) && (
              <div className="rounded-lg border border-panel-border bg-black/20 p-2.5 text-[11px] text-slate-300 leading-5">
                {nodeType === 'memory_store_read'
                  ? 'Cross-thread store/profile read. Use this for profile or long-lived store access, not for lightweight state peeks. In the current build the runtime store backing depends on the selected runtime store backend (in-memory or local SQLite).'
                  : nodeType === 'memoryreader'
                    ? 'Lightweight helper read surface. It currently resolves through the runtime store, so the UI must not mislabel it as a raw checkpoint peek or as arbitrary tool-driven memory search.'
                    : nodeType === 'memory_access'
                      ? 'Canonical bounded memory access surface. Use it when you want one explicit memory payload for downstream agents or tools without choosing early between profile lookup, store get, or store search helper variants.'
                      : 'Lightweight helper write surface. It still writes through the runtime store, not through plain in-thread state mutation; think bounded helper alias, not magical checkpoint mutation.'}
              </div>
            )}


            {selectedNode && nodeType === 'command_node' && (
              <div className="rounded-lg border border-panel-border bg-black/20 p-2.5 text-[11px] text-slate-300 leading-5">
                Combines a bounded <strong>custom_vars</strong> update with a direct graph hop via <strong>Command</strong>. In the current build it expects at most one direct outgoing edge and is best used when a state update and a goto belong to the same step.
              </div>
            )}

            {selectedNode && nodeType === 'handoff_node' && (
              <div className="rounded-lg border border-panel-border bg-black/20 p-2.5 text-[11px] text-slate-300 leading-5">
                Bounded handoff / state-transfer surface built on <strong>Command</strong>. Use it to switch active agent or workflow step in <strong>custom_vars</strong> without pretending you have a full magical multi-agent runtime.
              </div>
            )}

            {selectedNode && ['store_put', 'store_search'].includes(nodeType) && (
              <div className="rounded-lg border border-panel-border bg-black/20 p-2.5 text-[11px] text-slate-300 leading-5">
                {nodeType === 'store_put'
                  ? 'Runtime store write surface. Use this for bounded namespace/item persistence, distinct from lightweight memorywriter state helpers. Durability now depends on the selected runtime store backend for the graph (in-memory or local SQLite).'
                  : 'Runtime store search surface. Use this for bounded namespace queries that return normalized search results into graph state. Results are projections, not raw store internals.'}
              </div>
            )}


            {selectedNode && nodeType === 'send_fanout' && (
              <div className="rounded-lg border border-panel-border bg-black/20 p-2.5 text-[11px] text-slate-300 leading-5">
                Bounded <strong>Send API</strong> fanout surface. It dispatches one worker payload per source item into a single worker target, without pretending you have a generic distributed workflow engine. One visual edge can therefore represent many runtime worker dispatches.
              </div>
            )}

            {selectedNode && nodeType === 'reduce_join' && (
              <div className="rounded-lg border border-panel-border bg-black/20 p-2.5 text-[11px] text-slate-300 leading-5">
                Bounded reduce/join surface paired with <strong>send_fanout</strong>. It reduces a shared state key as worker outputs accumulate instead of pretending every worker edge has a one-to-one final join node in the compiled graph.
              </div>
            )}

            {selectedNode && ['store_get', 'store_delete'].includes(nodeType) && (
              <div className="rounded-lg border border-panel-border bg-black/20 p-2.5 text-[11px] text-slate-300 leading-5">
                {nodeType === 'store_get'
                  ? 'Runtime store read-by-key surface. Use it when you need one specific persisted item rather than a search result list. The returned value is normalized back into graph state, and durability depends on the selected store backend.'
                  : 'Runtime store delete surface. Use it for bounded namespace/key cleanup without implying broad store admin semantics or durable audit guarantees.'}
              </div>
            )}

            {selectedNode && nodeType === 'tool_sub_agent' && (
              <div className="rounded-lg border border-panel-border bg-black/20 p-2.5 text-[11px] text-slate-300 leading-5">
                Canonical <strong>subagent</strong> surface: a LangChain-style agent used as a tool by a parent agent. Configure it in the <strong>Subagent Library</strong>, then reference it here via a selected <code>group</code> and optionally one <code>subagent</code>. Leaving the subagent empty enables bounded group dispatch. Subagents are ephemeral by default and do not imply independent persistent memory.
              </div>
            )}

            {selectedNode && (nodeType === 'sub_agent' || nodeType === 'subgraph_node') && (
              <div className="rounded-lg border border-panel-border bg-black/20 p-2.5 space-y-2">
                {nodeType === 'subgraph_node' ? (
                  explicitReferenceKind === 'subgraph' ? (
                    <div className="flex items-start gap-2 text-[11px] text-slate-300 leading-5">
                      <ExternalLink size={12} className="text-cyan-400 mt-0.5 shrink-0" />
                      <span>Graph-native wrapper reference to a saved subgraph artifact. Opening it creates a child tab inside the current workspace, not a second root runtime.</span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-[11px] text-slate-300 leading-5">
                      <GitBranch size={12} className="text-fuchsia-400 mt-0.5 shrink-0" />
                      <span>Editable child subgraph. Use this when the authored object is still a graph/subgraph, not a LangChain-derived agent artifact.</span>
                    </div>
                  )
                ) : explicitReferenceKind ? (
                  <div className="flex items-start gap-2 text-[11px] text-slate-300 leading-5">
                    <Layers3 size={12} className="text-amber-400 mt-0.5 shrink-0" />
                    <span>
                      Wrapper reference to a saved <strong>{explicitReferenceKind}</strong> artifact. This surface is for LangChain-derived subagents/agents, not graph-native child subgraphs.
                      {referenceBridge?.supportLevel === 'compile_capable'
                        ? ' This specific bridge is compile-capable under explicit constraints.'
                        : referenceBridge?.supportLevel === 'editor_package_only'
                          ? ' This bridge remains editor/package-only in the current build.'
                          : ''}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-[11px] text-slate-300 leading-5">
                    <Layers3 size={12} className="text-amber-400 mt-0.5 shrink-0" />
                    <span>This surface expects a saved LangChain agent artifact reference. Use <strong>tool_sub_agent</strong> for the canonical subagent-as-tool model, and <strong>subgraph_node</strong> for child graphs.</span>
                  </div>
                )}
                {referenceBridges.length > 0 && (
                  <div className="rounded-lg border border-panel-border bg-black/10 p-2 space-y-2 text-[10px] text-slate-400">
                    {referenceExecutionKind && (
                      <div><strong className="text-slate-200">Node execution kind:</strong> {referenceExecutionKind}</div>
                    )}
                    {referenceBridges.map((bridge) => (
                      <div key={bridge.id || `${bridge.integrationModel || 'bridge'}-${bridge.supportLevel}`} className="border border-panel-border/60 rounded-md p-2 space-y-1">
                        <div><strong className="text-slate-200">Integration model:</strong> {bridge.integrationModel || 'lowered_bridge'}</div>
                        <div><strong className="text-slate-200">Bridge support:</strong> {bridge.supportLevel}</div>
                        {Array.isArray(bridge.bridgeContractIds) && bridge.bridgeContractIds.length > 0 && (
                          <div><strong className="text-slate-200">Contracts:</strong> {bridge.bridgeContractIds.join(', ')}</div>
                        )}
                        {typeof bridge.bridgeAcceptedSourceShape === 'string' && bridge.bridgeAcceptedSourceShape && (
                          <div><strong className="text-slate-200">Accepted shape:</strong> {bridge.bridgeAcceptedSourceShape}</div>
                        )}
                        {Array.isArray(bridge.bridgeAllowedToolFamilies) && bridge.bridgeAllowedToolFamilies.length > 0 && (
                          <div><strong className="text-slate-200">Allowed shared tools:</strong> {bridge.bridgeAllowedToolFamilies.join(', ')}</div>
                        )}
                        {Array.isArray((bridge.bridgeConstraintSummary as Record<string, unknown> | undefined)?.acceptedProviderFamilies) && ((bridge.bridgeConstraintSummary as Record<string, unknown> | undefined)?.acceptedProviderFamilies as string[]).length > 0 && (
                          <div><strong className="text-slate-200">Accepted providers:</strong> {((bridge.bridgeConstraintSummary as Record<string, unknown>).acceptedProviderFamilies as string[]).join(', ')}</div>
                        )}
                        {Array.isArray((bridge.bridgeConstraintSummary as Record<string, unknown> | undefined)?.requiredProviderEnvVars) && ((bridge.bridgeConstraintSummary as Record<string, unknown> | undefined)?.requiredProviderEnvVars as string[]).length > 0 && (
                          <div><strong className="text-slate-200">Provider env:</strong> {((bridge.bridgeConstraintSummary as Record<string, unknown>).requiredProviderEnvVars as string[]).join(', ')}</div>
                        )}
                        {Array.isArray(bridge.bridgeRejectedReasonCodes) && bridge.bridgeRejectedReasonCodes.length > 0 && (
                          <div><strong className="text-slate-200">Common rejection codes:</strong> {bridge.bridgeRejectedReasonCodes.slice(0, 4).join(', ')}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {openableChild && (
                  <button
                    onClick={() => openSubgraphTabFromNode(selectedNode.id)}
                    className="w-full px-2.5 py-2 rounded-lg border border-cyan-500/20 text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 transition-all text-[11px]"
                  >
                    {nodeType === 'subgraph_node' ? (explicitReferenceKind === 'subgraph' ? 'Open referenced child tab' : 'Open child subgraph tab') : 'Open referenced source artifact'}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
