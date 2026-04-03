import { memo, useCallback, useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NODE_DEFS, MODALITY_COLORS, type HandleDef, type FieldDef, type Modality } from '../nodeConfig';
import { useAppStore } from '../store';
import { getNodeRuntimeMeta, inferNodeMaturity, isNodeCompatibleWithSurface, isNodeBackedByRuntime, BLOCK_FAMILY_BADGE_CLASSES, BLOCK_FAMILY_LABELS, KIND_BADGE_CLASSES, ORIGIN_BADGE_CLASSES, PLACEMENT_BADGE_CLASSES, FLAVOR_BADGE_CLASSES, KIND_LABELS, ORIGIN_LABELS, EXECUTION_PLACEMENT_LABELS, EXECUTION_FLAVOR_LABELS, SUPPORT_STATUS_BADGE_CLASSES, SUPPORT_STATUS_LABELS, MATURITY_BADGE_CLASSES, MATURITY_LABELS, getNodeCapabilityInfo } from '../catalog';
import { Plus, X, ChevronDown, ChevronRight, Settings, Play, CheckCircle, Info, GitBranch, ExternalLink } from 'lucide-react';
import { describeToolObservationCounts, parseToolObservation, summarizeToolObservation } from '../executionTruth';
import { deriveExecutionTimeline } from '../executionTimeline';

function NodeField({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (field.type === 'select') {
    return (
      <div className="node-field">
        <label>{field.label}</label>
        <select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === 'slider') {
    const num = typeof value === 'number' ? value : (field.defaultValue as number) ?? 0;
    return (
      <div className="node-field">
        <label>{field.label}</label>
        <div className="slider-wrap">
          <input
            type="range"
            min={field.min}
            max={field.max}
            step={field.step}
            value={num}
            onChange={(e) => onChange(parseFloat(e.target.value))}
          />
          <span className="slider-value">{num.toFixed(field.step && field.step < 0.1 ? 2 : 1)}</span>
        </div>
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div className="node-field">
        <label>{field.label}</label>
        <textarea
          value={(value as string) ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
        />
      </div>
    );
  }

  if (field.type === 'number') {
    return (
      <div className="node-field">
        <label>{field.label}</label>
        <input
          type="number"
          value={value as number ?? field.defaultValue ?? ''}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(e) => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
        />
      </div>
    );
  }

  if (field.type === 'dynamic-routes') {
    return <RoutesField value={(value as Record<string, string>) ?? {}} onChange={onChange} />;
  }

  if (field.type === 'key_value_list') {
    const list = (Array.isArray(value) ? value : field.defaultValue || []) as Array<{key: string, value: string}>;
    return (
      <div className="node-field">
        <label className="flex justify-between items-center mb-1">
          {field.label}
          <button onClick={() => onChange([...list, { key: '', value: '' }])} className="text-blue-400 hover:text-white bg-blue-500/20 hover:bg-blue-500/40 rounded p-0.5"><Plus size={12} /></button>
        </label>
        <div className="flex flex-col gap-1">
          {list.map((item, i) => (
            <div key={i} className="flex items-center gap-1">
              <input type="text" placeholder="Clé" value={item.key} onChange={(e) => { const next = [...list]; next[i] = { ...next[i], key: e.target.value }; onChange(next); }} className="w-1/3 bg-black/30 border border-panel-border rounded px-1.5 py-1 text-xs text-white outline-none focus:border-blue-500" />
              <input type="text" placeholder="Valeur" value={item.value} onChange={(e) => { const next = [...list]; next[i] = { ...next[i], value: e.target.value }; onChange(next); }} className="flex-1 bg-black/30 border border-panel-border rounded px-1.5 py-1 text-xs text-white outline-none focus:border-blue-500" />
              <button onClick={() => onChange(list.filter((_, idx) => idx !== i))} className="text-slate-500 hover:text-red-400 p-0.5"><X size={12} /></button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'string-list') {
    return (
      <StringListField
        label={field.label}
        value={(value as string[]) ?? []}
        onChange={onChange}
        placeholder={field.placeholder}
      />
    );
  }

  return (
    <div className="node-field">
      <label>{field.label}</label>
      <input
        type="text"
        value={(value as string) ?? ''}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        list={field.key.includes('key') ? "state-keys-list" : undefined}
      />
    </div>
  );
}


function SubagentLibrarySelectorField({
  field,
  value,
  onChange,
  groups,
  currentGroup,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  groups: Array<{ name: string; agents: Array<{ name: string; description?: string }> }>;
  currentGroup: string;
}) {
  const normalizedGroup = currentGroup || 'default';
  const selectedGroup = groups.find((group) => group.name === normalizedGroup) || groups[0] || null;
  const availableAgents = selectedGroup?.agents || [];
  const currentValue = typeof value === 'string' ? value : '';
  const selectedAgent = field.key === 'target_agent' ? availableAgents.find((agent) => agent.name === currentValue) || null : null;
  const options = field.key === 'target_group'
    ? groups.map((group) => ({ value: group.name, label: group.name }))
    : [
        { value: '', label: 'Dispatch par groupe' },
        ...availableAgents.map((agent) => ({ value: agent.name, label: agent.name })),
      ];
  const effectiveValue = options.some((option) => option.value === currentValue)
    ? currentValue
    : (field.key === 'target_group' ? (selectedGroup?.name || '') : '');

  return (
    <div className="node-field">
      <label>{field.label}</label>
      <select value={effectiveValue} onChange={(e) => onChange(e.target.value)} disabled={field.key === 'target_agent' && !selectedGroup}>
        {field.key === 'target_group' && groups.length === 0 ? (
          <option value="">Créer un groupe dans la bibliothèque</option>
        ) : null}
        {options.map((option) => (
          <option key={option.value || '__dispatch__'} value={option.value}>{option.label}</option>
        ))}
      </select>
      {field.key === 'target_agent' ? (
        <div className="text-[10px] text-slate-500 mt-1 space-y-1">
          <div>{selectedGroup ? 'Laisser vide pour utiliser le mode dispatch du groupe sélectionné.' : 'Crée d’abord un groupe et des sous-agents dans la bibliothèque du projet.'}</div>
          {selectedAgent?.description ? <div className="text-slate-400">{selectedAgent.description}</div> : null}
        </div>
      ) : field.key === 'target_group' && selectedGroup ? (
        <div className="text-[10px] text-slate-500 mt-1">Groupe sélectionné : <span className="font-mono text-slate-400">{selectedGroup.name}</span> · {selectedGroup.agents.length} sous-agent(s)</div>
      ) : null}
    </div>
  );
}

function StringListField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (v: unknown) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  const addItem = () => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      setInput('');
    }
  };

  const removeItem = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="node-field">
      <label>{label}</label>
      {value.length > 0 && (
        <div className="tag-list">
          {value.map((item, idx) => (
            <span key={idx} className="tag-item">
              {item}
              <button onClick={() => removeItem(idx)} className="tag-remove">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="route-row">
        <input
          type="text"
          value={input}
          placeholder={placeholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
        />
        <button
          onClick={addItem}
          title="Ajouter"
          style={{ color: '#10b981' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#10b981';
            e.currentTarget.style.borderColor = '#10b981';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#0f1117';
            e.currentTarget.style.borderColor = '#2a2f45';
            e.currentTarget.style.color = '#10b981';
          }}
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}

interface RouteEntry {
  value: string;
  handle_id: string;
}

function RuntimeStatusChip({ tone, children, dataTestId }: { tone: 'running' | 'queued' | 'paused' | 'done' | 'blocked' | 'failed'; children: ReactNode; dataTestId?: string }) {
  const classes =
    tone === 'running' ? 'text-emerald-300 border-emerald-500/25 bg-emerald-500/10' :
    tone === 'queued' ? 'text-amber-300 border-amber-500/25 bg-amber-500/10' :
    tone === 'paused' ? 'text-orange-300 border-orange-500/25 bg-orange-500/10' :
    tone === 'done' ? 'text-cyan-300 border-cyan-500/25 bg-cyan-500/10' :
    tone === 'blocked' ? 'text-amber-300 border-amber-500/25 bg-amber-500/10' :
    'text-red-300 border-red-500/25 bg-red-500/10';
  return <span data-testid={dataTestId} className={`node-chip ${classes}`}>{children}</span>;
}

function RoutesField({
  value,
  onChange,
}: {
  value: RouteEntry[] | Record<string, string>;
  onChange: (v: unknown) => void;
}) {
  const routes: RouteEntry[] = Array.isArray(value)
    ? value
    : Object.entries(value).map(([k, v]) => ({ value: k, handle_id: v }));

  const [newValue, setNewValue] = useState('');
  const [newHandleId, setNewHandleId] = useState('');

  const addRoute = () => {
    if (newValue.trim() && newHandleId.trim()) {
      onChange([...routes, { value: newValue.trim(), handle_id: newHandleId.trim() }]);
      setNewValue('');
      setNewHandleId('');
    }
  };

  const removeRoute = (idx: number) => {
    onChange(routes.filter((_, i) => i !== idx));
  };

  return (
    <div className="node-field">
      <label>Routes</label>
      {routes.map((r, idx) => (
        <div key={idx} className="route-row">
          <input type="text" value={r.value} readOnly style={{ opacity: 0.7 }} title="Valeur" />
          <input type="text" value={r.handle_id} readOnly style={{ opacity: 0.7 }} title="Handle ID" />
          <button onClick={() => removeRoute(idx)} title="Supprimer">
            <X size={12} />
          </button>
        </div>
      ))}
      <div className="route-row">
        <input
          type="text"
          value={newValue}
          placeholder="valeur (ex: continue)"
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addRoute()}
        />
        <input
          type="text"
          value={newHandleId}
          placeholder="handle_id (ex: continue)"
          onChange={(e) => setNewHandleId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addRoute()}
        />
        <button
          onClick={addRoute}
          title="Ajouter"
          style={{ color: '#10b981' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#10b981';
            e.currentTarget.style.borderColor = '#10b981';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#0f1117';
            e.currentTarget.style.borderColor = '#2a2f45';
            e.currentTarget.style.color = '#10b981';
          }}
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}

function CustomNodeComponent({ id, data, selected }: NodeProps) {
  const updateNodeParam = useAppStore((s) => s.updateNodeParam);
  const graphValidation = useAppStore((s) => s.graphValidation);
  const edges = useAppStore((s) => s.edges);
  const isAsync = useAppStore((s) => s.isAsync);
  const activeTab = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const editorMode = useAppStore((s) => s.editorMode);
  const preferences = useAppStore((s) => s.preferences);
  const runLogs = useAppStore((s) => s.runLogs);
  const isRunning = useAppStore((s) => s.isRunning);
  const isPaused = useAppStore((s) => s.isPaused);
  const pendingNodeId = useAppStore((s) => s.pendingNodeId);
  const liveStateNext = useAppStore((s) => s.liveStateNext);
  const runtimeHoverTarget = useAppStore((s) => s.runtimeHoverTarget);
  const runtimeNavigationSettings = useAppStore((s) => s.runtimeNavigationSettings);
  const setRuntimeHoverTarget = useAppStore((s) => s.setRuntimeHoverTarget);
  const clearRuntimeHoverTarget = useAppStore((s) => s.clearRuntimeHoverTarget);
  const def = NODE_DEFS[data.nodeType as string];
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement | null>(null);
  if (!def) return null;

  const Icon = def.icon;
  const nodeType = data.nodeType as string;
  const params = (data.params as Record<string, unknown>) || {};

  const dynamicRightHandles = useMemo(() => {
    if (nodeType !== 'logic_router') return null;
    const routesRaw = params.routes;
    const routes: RouteEntry[] = Array.isArray(routesRaw) ? routesRaw : [];
    const fallback = (params.fallback_handle as string) || 'fallback';
    const handles: HandleDef[] = routes.map((r) => ({
      id: r.handle_id,
      label: r.value,
      type: 'source' as const,
      position: 'right' as const,
      color: MODALITY_COLORS.any,
      modality: 'any' as Modality,
    }));
    if (!handles.some((h) => h.id === fallback)) {
      handles.push({
        id: fallback,
        label: `⚡ ${fallback}`,
        type: 'source',
        position: 'right',
        color: '#ef4444',
        modality: 'any',
      });
    }
    return handles;
  }, [nodeType, params.routes, params.fallback_handle]);

  const leftHandles = def.handles.filter((h) => h.position === 'left');
  const rightHandles = dynamicRightHandles ?? def.handles.filter((h) => h.position === 'right');
  const hasAdvanced = def.advancedFields && def.advancedFields.length > 0;
  const isValidation = def.needsValidation === true;
  const isMarker = nodeType === 'memory_checkpoint';
  const showRunButton = !isValidation && !isMarker && !def.isTool;
  const isOrphan = graphValidation?.orphanNodeIds?.has(id) ?? false;
  const isSecondary = graphValidation?.secondaryNodeIds?.has(id) ?? false;
  const isDetached = graphValidation?.detachedNodeIds?.has(id) ?? false;

  const linkedToolEdges = useMemo(() => edges.filter((e) => e.target === id && e.targetHandle === 'tools_in' && e.sourceHandle === 'tool_out').length, [edges, id]);
  const manualTools = Array.isArray(params.tools_linked) ? params.tools_linked.length : 0;
  const effectiveTools = linkedToolEdges > 0 ? linkedToolEdges : manualTools;
  const executionGroup = typeof params.execution_group === 'string' && params.execution_group.trim() ? params.execution_group : 'main';
  const hoveredNodeId = runtimeHoverTarget?.nodeId || null;
  const hoverPredecessorNodeIds = useMemo(() => new Set(edges.filter((edge) => edge.target === hoveredNodeId).map((edge) => edge.source)), [edges, hoveredNodeId]);
  const hoverSuccessorNodeIds = useMemo(() => new Set(edges.filter((edge) => edge.source === hoveredNodeId).map((edge) => edge.target)), [edges, hoveredNodeId]);
  const nodeIsHoverFocus = hoveredNodeId === id;
  const nodeIsHoverPredecessor = hoverPredecessorNodeIds.has(id);
  const nodeIsHoverSuccessor = hoverSuccessorNodeIds.has(id);
  const nodeIsHoverMuted = Boolean(hoveredNodeId) && !nodeIsHoverFocus && !nodeIsHoverPredecessor && !nodeIsHoverSuccessor;
  const provider = typeof params.provider === 'string' ? params.provider : null;
  const modelName = typeof params.model_name === 'string' ? params.model_name : null;
  const activeArtifactType = activeTab?.artifactType || 'graph';
  const activeExecutionProfile = activeTab?.executionProfile || 'langgraph_async';
  const setCapabilityInspectorTarget = useAppStore((s) => s.setCapabilityInspectorTarget);
  const openSubgraphTabFromNode = useAppStore((s) => s.openSubgraphTabFromNode);
  const runtimeMeta = getNodeRuntimeMeta(nodeType);
  const capabilityInfo = getNodeCapabilityInfo(nodeType, { artifactType: activeArtifactType, executionProfile: activeExecutionProfile });
  const maturity = inferNodeMaturity(nodeType, { artifactType: activeArtifactType, executionProfile: activeExecutionProfile });
  const truthChips = [
    runtimeMeta.providerLabel,
    runtimeMeta.toolFamilyLabel,
    runtimeMeta.toolProvisioningModel === 'author_linked' ? 'author-wired' : null,
    runtimeMeta.toolSelectionAuthority === 'bounded_model_choice' ? 'bounded-choice' : null,
    runtimeMeta.toolProvisioningModel === 'explicit_step' ? 'explicit-step' : null,
    runtimeMeta.sessionBacked ? 'session' : null,
    runtimeMeta.permissionLevel ? runtimeMeta.permissionLevel.replace(/_/g, '-') : null,
    runtimeMeta.configRequired ? 'config' : null,
  ].filter(Boolean) as string[];
  const compatibleWithSurface = isNodeCompatibleWithSurface(nodeType, { artifactType: activeArtifactType, executionProfile: activeExecutionProfile });
  const runtimeBacked = isNodeBackedByRuntime(nodeType);
  const artifactRefKind = typeof params.artifact_ref_kind === 'string' ? params.artifact_ref_kind : null;
  const targetSubgraph = typeof params.target_subgraph === 'string' ? params.target_subgraph : '';
  const explicitReferenceKind = artifactRefKind || (targetSubgraph.startsWith('artifact:') ? targetSubgraph.split(':')[1]?.split('/')[0] || null : null);
  const canOpenChildTab = (nodeType === 'subgraph_node' && (!explicitReferenceKind || explicitReferenceKind === 'subgraph')) || (nodeType === 'sub_agent' && Boolean(explicitReferenceKind) && explicitReferenceKind !== 'subgraph');
  const structuredSchemaActive = typeof params.structured_schema_json === 'string' && params.structured_schema_json.trim().length > 0;
  const hasSemanticAbstraction = Boolean(runtimeMeta.graphAbstractionKind || (runtimeMeta.linkMultiplicity && runtimeMeta.linkMultiplicity.length > 0) || (runtimeMeta.uiAbstractionNotes && runtimeMeta.uiAbstractionNotes.length > 0) || (runtimeMeta.linkSemantics && runtimeMeta.linkSemantics.length > 0));
  const semanticSummary = runtimeMeta.compiledGraphRelation || runtimeMeta.uiAbstractionNotes?.[0] || runtimeMeta.linkSemantics?.[0] || null;
  const semanticHandleNotes = useMemo(() => {
    const notes: string[] = [];
    const handles = [...leftHandles, ...rightHandles];
    const has = (id: string) => handles.some((h) => h.id === id);
    if (has('tools_in')) notes.push('Tools handle: author-selected tools may attach here; only the linked subset is exposed to this node at runtime. A capable model may choose among that bounded set, but it does not gain global tool access.');
    if (has('memory_in')) notes.push('Memory handle: accepts a memory payload surface; the compiled graph may forward stored or derived memory rather than a direct state edge.');
    if (has('documents_in')) notes.push('Documents handle: lets retrieval or document-like payloads feed the block without implying one literal runtime document edge per source.');
    if (nodeType === 'send_fanout') notes.push('Dispatch edge: one visible worker edge may expand into many runtime sends.');
    if (nodeType === 'reduce_join') notes.push('Reduce input: many worker results may converge here even though the canvas stays visually compact.');
    if (nodeType === 'sub_agent' || nodeType === 'subgraph_node') notes.push('Reference edge: opening/reuse semantics may target a saved artifact or child graph rather than a direct inline graph expansion.');
    return notes;
  }, [leftHandles, rightHandles, nodeType]);

  const contextualHelpLines = useMemo(() => {
    const lines: string[] = [];
    if (hasSemanticAbstraction && semanticSummary) lines.push(semanticSummary);
    lines.push(...semanticHandleNotes);
    if (Array.isArray(runtimeMeta.debugProjection)) lines.push(...runtimeMeta.debugProjection);
    if (isDetached) lines.push('Detached component: this block belongs to a secondary connected component until you merge it back into the main graph.');
    if (nodeType === 'llm_chat' || nodeType === 'react_agent') lines.push('The tools handle marks a capability on the authored block, not a guarantee that tool-calling is active. The compiled graph may synthesize a ToolNode loop only when tools are actually linked.');
    if (nodeType === 'send_fanout') lines.push('One outgoing worker edge can dispatch many runtime workers. This is a graphical fanout abstraction, not a literal one-edge-per-worker compiled graph.');
    if (nodeType === 'reduce_join') lines.push('This node reduces a shared result key as workers finish. It complements fanout without exposing every runtime branch directly on the canvas.');
    if (nodeType === 'tool_executor') lines.push('Tool execution can be shown explicitly here or auto-inserted by the compiler from linked tools on an agent-like node.');
    if (nodeType === 'subgraph_node' && explicitReferenceKind === 'subgraph') lines.push('Graph-native saved subgraph reference. Opening it stays inside the current workspace.');
    if (nodeType === 'subgraph_node' && !explicitReferenceKind) lines.push('Editable child subgraph surface. Use this for graph composition rather than LangChain-derived agents.');
    if (nodeType === 'sub_agent' && explicitReferenceKind && explicitReferenceKind !== 'subgraph') lines.push('LangChain-derived subagent / agent artifact reference. This surface is distinct from graph-native child subgraphs.');
    if (nodeType === 'sub_agent' && !explicitReferenceKind) lines.push('This surface expects a saved LangChain agent/subagent artifact reference. Use Subgraph for child graph tabs.');
    if (nodeType === 'tool_sub_agent') {
      const targetGroup = typeof params.target_group === 'string' && params.target_group.trim() ? params.target_group : 'default';
      const targetAgent = typeof params.target_agent === 'string' ? params.target_agent.trim() : '';
      if (targetAgent) lines.push(`Canonical subagent tool: directly calls '${targetAgent}' from group '${targetGroup}'.`);
      else lines.push(`Canonical subagent tool: dispatches within group '${targetGroup}' using the generated agent_name + description tool contract.`);
    }
    if ((nodeType === 'llm_chat' || nodeType === 'react_agent') && structuredSchemaActive) lines.push('Structured output active: the compiled node validates against the declared schema and writes the parsed payload into the configured structured output key.');
    if (nodeType === 'deep_agent_suite') lines.push('Legacy alias surface. It compiles into the canonical LangGraph trunk and does not open a separate DeepAgents editor.');
    return lines;
  }, [explicitReferenceKind, hasSemanticAbstraction, isDetached, nodeType, runtimeMeta.debugProjection, semanticHandleNotes, semanticSummary, structuredSchemaActive, params.target_agent, params.target_group]);

  const executionTimeline = useMemo(() => deriveExecutionTimeline(edges, runLogs, { isRunning, isPaused, pendingNodeId, scheduledNodeIds: liveStateNext }), [edges, runLogs, isRunning, isPaused, pendingNodeId, liveStateNext]);
  const latestNodeEntry = useMemo(() => [...runLogs].reverse().find((entry) => entry.node === id), [runLogs, id]);
  const latestExecutionEntry = useMemo(() => [...runLogs].reverse().find((entry) => entry.type === 'node_update' || entry.type === 'embedded_trace'), [runLogs]);
  const latestToolObservation = useMemo(() => parseToolObservation(latestNodeEntry?.data), [latestNodeEntry]);
  const toolObservationCounts = useMemo(() => latestToolObservation ? describeToolObservationCounts(latestToolObservation) : [], [latestToolObservation]);
  const nodeIsQueued = liveStateNext.includes(id);
  const nodeIsAwaitingInput = isPaused && pendingNodeId === id;
  const nodeIsLatestExecution = Boolean(isRunning && latestExecutionEntry?.node === id);
  const runtimeTone = latestToolObservation?.status === 'blocked' ? 'blocked' : latestToolObservation?.status === 'failed' ? 'failed' : latestToolObservation ? (latestToolObservation.status === 'preview' ? 'done' : latestToolObservation.status === 'applied' || latestToolObservation.status === 'succeeded' ? 'done' : latestToolObservation.status === 'partially_applied' ? 'blocked' : 'failed') : null;
  const nodeLastStepOrder = executionTimeline.lastStepByNodeId[id] || null;
  const nodeVisitCount = executionTimeline.visitCountByNodeId[id] || 0;
  const nodeFirstStepOrder = executionTimeline.firstStepByNodeId[id] || null;

  useEffect(() => {
    if (selected) {
      setCapabilityInspectorTarget({ source: 'node', nodeType, nodeId: id });
    }
  }, [id, nodeType, selected, setCapabilityInspectorTarget]);

  const handleChange = useCallback(
    (key: string, value: unknown) => {
      updateNodeParam(id, key, value);
    },
    [id, updateNodeParam],
  );

  useEffect(() => {
    if (!selected) setHelpOpen(false);
  }, [selected]);

  useEffect(() => {
    if (!helpOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!helpRef.current?.contains(event.target as Node)) setHelpOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [helpOpen]);

  const nodeClasses = [
    'custom-node',
    selected ? 'selected' : '',
    isOrphan ? 'orphan-node' : '',
    isSecondary && !isOrphan ? 'secondary-node' : '',
    nodeIsQueued ? 'runtime-queued' : '',
    nodeIsLatestExecution ? 'runtime-running' : '',
    nodeIsAwaitingInput ? 'runtime-paused' : '',
    latestToolObservation?.status === 'failed' ? 'runtime-failed' : '',
    latestToolObservation?.status === 'blocked' ? 'runtime-blocked' : '',
    nodeIsHoverFocus ? 'runtime-hovered' : '',
    nodeIsHoverPredecessor ? 'runtime-hover-predecessor' : '',
    nodeIsHoverSuccessor ? 'runtime-hover-successor' : '',
    nodeIsHoverMuted ? 'runtime-hover-muted' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={nodeClasses}
      data-testid={`canvas-node-${id}`}
      onMouseEnter={() => setRuntimeHoverTarget(id, 'graph')}
      onMouseLeave={() => {
        if (!runtimeNavigationSettings.lockHover) clearRuntimeHoverTarget('graph', id);
      }}
    >
      <datalist id="state-keys-list">
        <option value="messages">messages (History)</option>
        <option value="documents">documents (List)</option>
        <option value="custom_vars">custom_vars (Dict)</option>
        <option value="last_error">last_error (String)</option>
        <option value="memory_data">memory_data (Any)</option>
      </datalist>
      <div className="node-header" style={{ background: def.gradient }}>
        <Icon size={16} />
        <span className="node-header-label">{(data.label as string) || def.label}</span>
        <button
          className="node-action-btn"
          title="Inspect capability"
          data-testid={`node-inspect-${id}`}
          onClick={(e) => { e.stopPropagation(); setCapabilityInspectorTarget({ source: 'node', nodeType, nodeId: id }); }}
        >
          <Info size={12} />
        </button>
        {contextualHelpLines.length > 0 && (
          <button
            className="node-action-btn"
            title="Quick help"
            data-testid={`node-help-${id}`}
            onClick={(e) => { e.stopPropagation(); setHelpOpen((v) => !v); }}
          >
            ?
          </button>
        )}
        {isValidation && (
          <button
            className="node-action-btn node-action-validate"
            title="Valider"
            onClick={(e) => { e.stopPropagation(); }}
          >
            <CheckCircle size={14} />
          </button>
        )}
        {showRunButton && (
          <button
            className="node-action-btn node-action-run"
            title="Run"
            onClick={(e) => { e.stopPropagation(); }}
          >
            <Play size={12} />
          </button>
        )}
      </div>


      <div className="node-meta-row">
        <span className="node-chip node-chip-id">#{id}</span>
        <span className={`node-chip ${isAsync ? 'node-chip-async' : 'node-chip-sync'}`}>{isAsync ? 'async' : 'sync'}</span>
        {(editorMode === 'advanced' || !preferences.reducedTechnicalBadgesInSimpleMode) && (
          <span className="node-chip node-chip-scope">grp:{executionGroup}</span>
        )}
        {provider && <span className="node-chip node-chip-provider">{provider}</span>}
        {(editorMode === 'advanced' || !preferences.reducedTechnicalBadgesInSimpleMode) && modelName && <span className="node-chip node-chip-model">{modelName}</span>}
        {effectiveTools > 0 && <span className="node-chip node-chip-tools">tools:{effectiveTools}{linkedToolEdges > 0 ? ' auto' : ''}</span>}
        {structuredSchemaActive && <span className="node-chip node-chip-provider">structured</span>}
        {hasSemanticAbstraction && <span className="node-chip node-chip-semantic" title={`Graph abstraction: ${runtimeMeta.graphAbstractionKind || 'semantic runtime abstraction'}`}>semantic</span>}
        {runtimeMeta.graphScopeMarker && <span className="node-chip node-chip-provider">graph-scope</span>}
        {isDetached && <span className="node-chip node-chip-scope">detached</span>}
      </div>

      {(nodeIsQueued || nodeIsLatestExecution || nodeIsAwaitingInput || latestToolObservation || nodeLastStepOrder) && (
        <div className="node-runtime-row">
          {nodeIsQueued && <RuntimeStatusChip tone="queued" dataTestId={`node-runtime-status-${id}`}>scheduled</RuntimeStatusChip>}
          {nodeIsLatestExecution && <RuntimeStatusChip tone="running" dataTestId={`node-runtime-status-${id}`}>running</RuntimeStatusChip>}
          {nodeIsAwaitingInput && <RuntimeStatusChip tone="paused" dataTestId={`node-runtime-status-${id}`}>awaiting input</RuntimeStatusChip>}
          {latestToolObservation && runtimeTone && <RuntimeStatusChip tone={runtimeTone} dataTestId={`node-runtime-status-${id}`}>{latestToolObservation.status.replace(/_/g, ' ')}</RuntimeStatusChip>}
          {nodeLastStepOrder && <span className="node-chip node-chip-runtime-detail" data-testid={`node-runtime-order-${id}`}>step {nodeLastStepOrder}</span>}
          {nodeVisitCount > 1 && <span className="node-chip node-chip-runtime-detail">visits {nodeVisitCount}</span>}
          {latestToolObservation?.reasonCode && <span className="node-chip node-chip-runtime-detail">{latestToolObservation.reasonCode}</span>}
        </div>
      )}

      {(latestToolObservation || nodeIsQueued || nodeIsAwaitingInput || nodeLastStepOrder) && (
        <div className="node-runtime-summary">
          <div className="node-runtime-summary-text" data-testid={`node-runtime-summary-${id}`}>
            {latestToolObservation
              ? (latestNodeEntry?.operationSummary || summarizeToolObservation(latestToolObservation))
              : nodeIsAwaitingInput
                ? 'Awaiting user input from runtime'
                : nodeLastStepOrder
                  ? `Observed on execution timeline${nodeFirstStepOrder && nodeFirstStepOrder !== nodeLastStepOrder ? ` since step ${nodeFirstStepOrder}` : ''}`
                  : 'Scheduled for upcoming runtime step'}
          </div>
          <div className="node-runtime-summary-chips">
            {latestToolObservation?.path && <span className="node-chip node-chip-runtime-detail">{latestToolObservation.path}</span>}
            {toolObservationCounts.slice(0, 3).map((item) => <span key={item} className="node-chip node-chip-runtime-detail">{item}</span>)}
          </div>
        </div>
      )}

      {runtimeMeta.graphScopeMarker && typeof runtimeMeta.graphScopeExplanation === 'string' && !helpOpen && (
        <div className="mx-3 mt-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-[10px] leading-5 text-slate-300">
          {runtimeMeta.graphScopeExplanation}
        </div>
      )}

      {helpOpen && contextualHelpLines.length > 0 && (
        <div ref={helpRef} className="mx-3 mt-2 rounded-lg border border-panel-border bg-[#0b0e16] px-3 py-2 text-[10px] leading-5 text-slate-300 space-y-1 shadow-2xl">
          <div className="font-medium text-slate-100">Quick help</div>
          {semanticHandleNotes.length > 0 && <div className="text-slate-400">Handle affordances</div>}
          {contextualHelpLines.slice(0, 4).map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}

      {editorMode === 'advanced' ? (
        <>
          <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1 border-b border-panel-border/60">
            <span className={`px-1.5 py-0.5 rounded border text-[10px] ${BLOCK_FAMILY_BADGE_CLASSES[capabilityInfo.blockFamily]}`}>{BLOCK_FAMILY_LABELS[capabilityInfo.blockFamily]}</span>
            <span className={`px-1.5 py-0.5 rounded border text-[10px] ${MATURITY_BADGE_CLASSES[maturity]}`}>{MATURITY_LABELS[maturity]}</span>
            <span data-testid={`node-support-${id}`} className={`px-1.5 py-0.5 rounded border text-[10px] ${SUPPORT_STATUS_BADGE_CLASSES[capabilityInfo.supportStatus]}`}>{SUPPORT_STATUS_LABELS[capabilityInfo.supportStatus]}</span>
            <span className={`px-1.5 py-0.5 rounded border text-[10px] ${KIND_BADGE_CLASSES[runtimeMeta.kind]}`}>{KIND_LABELS[runtimeMeta.kind]}</span>
            <span className={`px-1.5 py-0.5 rounded border text-[10px] ${ORIGIN_BADGE_CLASSES[runtimeMeta.origin]}`}>{ORIGIN_LABELS[runtimeMeta.origin]}</span>
            {runtimeMeta.executionPlacement && <span className={`px-1.5 py-0.5 rounded border text-[10px] ${PLACEMENT_BADGE_CLASSES[runtimeMeta.executionPlacement]}`}>{EXECUTION_PLACEMENT_LABELS[runtimeMeta.executionPlacement]}</span>}
            {runtimeMeta.executionFlavor && <span className={`px-1.5 py-0.5 rounded border text-[10px] ${FLAVOR_BADGE_CLASSES[runtimeMeta.executionFlavor]}`}>{EXECUTION_FLAVOR_LABELS[runtimeMeta.executionFlavor]}</span>}
            {runtimeMeta.fauxNode && <span className="px-1.5 py-0.5 rounded border text-[10px] text-orange-300 bg-orange-500/10 border-orange-500/20">Faux node</span>}
            {!runtimeBacked && <span className="px-1.5 py-0.5 rounded border text-[10px] text-red-300 bg-red-500/10 border-red-500/20">Hidden from palette</span>}
            {!compatibleWithSurface && <span className="px-1.5 py-0.5 rounded border text-[10px] text-amber-300 bg-amber-500/10 border-amber-500/20">Less natural here</span>}
          </div>

          {(runtimeMeta.quickProps?.length || runtimeMeta.autoLinkTargets?.length) ? (
            <div className="px-3 pt-2 pb-1 border-b border-panel-border/60 text-[10px] text-slate-500 space-y-1">
              <div>{activeArtifactType} · {activeExecutionProfile}</div>
              {runtimeMeta.quickProps && runtimeMeta.quickProps.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {runtimeMeta.quickProps.map((prop) => (
                    <span key={prop} className="px-1.5 py-0.5 rounded border border-panel-border text-slate-400">{prop}</span>
                  ))}
                  {truthChips.map((prop) => (
                    <span key={`truth-${prop}`} className="px-1.5 py-0.5 rounded border border-cyan-500/20 text-cyan-300 bg-cyan-500/5">{prop}</span>
                  ))}
                </div>
              )}
              {(!runtimeMeta.quickProps || runtimeMeta.quickProps.length === 0) && truthChips.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {truthChips.map((prop) => (
                    <span key={`truth-${prop}`} className="px-1.5 py-0.5 rounded border border-cyan-500/20 text-cyan-300 bg-cyan-500/5">{prop}</span>
                  ))}
                </div>
              )}
              {runtimeMeta.autoLinkTargets && runtimeMeta.autoLinkTargets.length > 0 && (
                <div className="text-[10px] text-slate-500">auto-link: {runtimeMeta.autoLinkTargets.join(', ')}</div>
              )}
            </div>
          ) : null}
        </>
      ) : (
        <div className="px-3 pt-2 pb-1 border-b border-panel-border/60 text-[10px] text-slate-500 space-y-1">
          <div>{runtimeMeta.summary || def.category}</div>
          <div className="flex flex-wrap gap-1">
            <span className={`px-1.5 py-0.5 rounded border text-[10px] ${BLOCK_FAMILY_BADGE_CLASSES[capabilityInfo.blockFamily]}`}>{BLOCK_FAMILY_LABELS[capabilityInfo.blockFamily]}</span>
            <span data-testid={`node-support-${id}`} className={`px-1.5 py-0.5 rounded border text-[10px] ${SUPPORT_STATUS_BADGE_CLASSES[capabilityInfo.supportStatus]}`}>{SUPPORT_STATUS_LABELS[capabilityInfo.supportStatus]}</span>
            <span className="px-1.5 py-0.5 rounded border border-panel-border text-slate-400">{def.category}</span>
            {!runtimeBacked && <span className="px-1.5 py-0.5 rounded border text-[10px] text-red-300 bg-red-500/10 border-red-500/20">Hidden from palette</span>}
            {!compatibleWithSurface && <span className="px-1.5 py-0.5 rounded border text-[10px] text-amber-300 bg-amber-500/10 border-amber-500/20">Less natural here</span>}
            {!preferences.reducedTechnicalBadgesInSimpleMode && runtimeMeta.quickProps?.slice(0, 2).map((prop) => (
              <span key={prop} className="px-1.5 py-0.5 rounded border border-panel-border text-slate-400">{prop}</span>
            ))}
            {truthChips.slice(0, 3).map((prop) => (
              <span key={`truth-${prop}`} className="px-1.5 py-0.5 rounded border border-cyan-500/20 text-cyan-300 bg-cyan-500/5">{prop}</span>
            ))}
          </div>
        </div>
      )}



      <div className="node-body">
        {def.fields.map((field) => {
          const runtimeLibrary = activeTab?.runtimeSettings?.subagentLibrary || [];
          const currentGroup = String(((data.params as Record<string, unknown>)?.target_group as string) || 'default');
          if (def.type === 'tool_sub_agent' && (field.key === 'target_group' || field.key === 'target_agent')) {
            return (
              <SubagentLibrarySelectorField
                key={field.key}
                field={field}
                value={(data.params as Record<string, unknown>)?.[field.key]}
                onChange={(v) => {
                  handleChange(field.key, v);
                  if (field.key === 'target_group') {
                    const nextGroup = String(v || 'default');
                    const group = runtimeLibrary.find((entry) => entry.name === nextGroup);
                    const hasCurrentAgent = group?.agents?.some((agent) => agent.name === ((data.params as Record<string, unknown>)?.target_agent as string));
                    if (!hasCurrentAgent) {
                      handleChange('target_agent', '');
                    }
                  }
                }}
                groups={runtimeLibrary}
                currentGroup={currentGroup}
              />
            );
          }
          return (
            <NodeField
              key={field.key}
              field={field}
              value={(data.params as Record<string, unknown>)?.[field.key]}
              onChange={(v) => handleChange(field.key, v)}
            />
          );
        })}

        {hasAdvanced && (
          <div className="advanced-section">
            <button
              className="advanced-toggle"
              onClick={() => setOptionsOpen(!optionsOpen)}
            >
              <Settings size={12} />
              <span>Options avancées</span>
              {optionsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            {optionsOpen && (
              <div className="advanced-fields">
                {def.advancedFields!.map((field) => (
                  <NodeField
                    key={field.key}
                    field={field}
                    value={(data.params as Record<string, unknown>)?.[field.key]}
                    onChange={(v) => handleChange(field.key, v)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {leftHandles.map((h, i) => (
        <HandleWithLabel
          key={h.id}
          handleDef={h}
          index={i}
          total={leftHandles.length}
        />
      ))}
      {rightHandles.map((h, i) => (
        <HandleWithLabel
          key={h.id}
          handleDef={h}
          index={i}
          total={rightHandles.length}
        />
      ))}
    </div>
  );
}

function HandleWithLabel({
  handleDef,
  index,
  total,
}: {
  handleDef: HandleDef;
  index: number;
  total: number;
}) {
  const isLeft = handleDef.position === 'left';
  const spacing = 100 / (total + 1);
  const topPercent = spacing * (index + 1);

  const modalityLabel = handleDef.modality !== 'any' ? handleDef.modality : '';

  return (
    <>
      <Handle
        type={handleDef.type}
        position={isLeft ? Position.Left : Position.Right}
        id={handleDef.id}
        title={`${handleDef.label} (${handleDef.modality})`}
        style={{
          background: handleDef.color,
          top: `${topPercent}%`,
          border: `2px solid ${handleDef.color}`,
          boxShadow: `0 0 4px ${handleDef.color}40`,
        }}
      />
      <div
        className={`handle-wrap ${isLeft ? 'left' : 'right'}`}
        style={{ top: `${topPercent}%`, transform: 'translateY(-50%)' }}
      >
        <div style={{ width: 10 }} />
        <span className="handle-label">{handleDef.label}</span>
        {modalityLabel && (
          <span
            className="handle-modality"
            style={{ color: handleDef.color, fontSize: '8px', opacity: 0.7, marginLeft: '2px' }}
          >
            {modalityLabel}
          </span>
        )}
      </div>
    </>
  );
}

export default memo(CustomNodeComponent);
