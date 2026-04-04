import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type ReactFlowInstance,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useAppStore } from './store';
import CustomNode from './components/CustomNode';
import Toolbar from './components/Toolbar';
import TabBar from './components/TabBar';
import RunPanel from './components/RunPanel';
import ProjectManager from './components/ProjectManager';
import CollabPanel from './components/CollabPanel';
import SidePanelSystem from './components/SidePanelSystem';
import { NODE_DEFS } from './nodeConfig';
import { describeConnectionReason, describeSemanticKind, validateConnectionAffordance } from './graphUtils';
import { deriveExecutionTimeline } from './executionTimeline';
import { fetchArtifactManifest } from './api/artifacts';
import { hydrateArtifactEditorGraph } from './store/artifactHydration';
import TabletopStarterDialog from './components/TabletopStarterDialog';
import { buildGuidedTabletopStarter, isTabletopRuntimeConfigNeeded, type TabletopStarterSelection } from './store/tabletopStarter';
import { getTabletopVisualProfile } from './jdr/theme';

const nodeTypes = { custom: CustomNode };

export default function App() {
  const {
    nodes,
    edges,
    tabs,
    activeTabId,
    onNodesChange,
    onEdgesChange,
    onConnect: connectEdge,
    addNode,
    openTab,
    applyWorkspacePreset,
    preferences,
    selectNodesByIds,
    setCapabilityInspectorTarget,
    runtimeFocusRequest,
    clearRuntimeFocusRequest,
    runtimeEdgeLegend,
    updateRuntimeEdgeLegend,
    requestRuntimeFocus,
    clearRuntimeHoverTarget,
    updateRuntimeNavigationSettings,
    editorMode,
  } = useAppStore();

  const isEmptyCanvas = nodes.length === 0;
  const isRunning = useAppStore((s) => s.isRunning);
  const isPaused = useAppStore((s) => s.isPaused);
  const pendingNodeId = useAppStore((s) => s.pendingNodeId);
  const liveStateNext = useAppStore((s) => s.liveStateNext);
  const runLogs = useAppStore((s) => s.runLogs);
  const runtimeHoverTarget = useAppStore((s) => s.runtimeHoverTarget);
  const runtimeNavigationSettings = useAppStore((s) => s.runtimeNavigationSettings);
  const [tabletopDialogOpen, setTabletopDialogOpen] = useState(false);
  const [tabletopStarterRuntimeSettings, setTabletopStarterRuntimeSettings] = useState<Record<string, unknown> | null>(null);

  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeTabId) || null, [tabs, activeTabId]);
  const tabletopVisualProfile = useMemo(() => getTabletopVisualProfile(activeTab?.runtimeSettings), [activeTab?.runtimeSettings]);
  const tabletopRuntimeNeedsConfig = useMemo(() => tabletopVisualProfile.isTabletop && isTabletopRuntimeConfigNeeded(nodes as Node[]), [tabletopVisualProfile.isTabletop, nodes]);

  const executionTimeline = useMemo(() => deriveExecutionTimeline(edges, runLogs, { isRunning, isPaused, pendingNodeId, scheduledNodeIds: liveStateNext }), [edges, runLogs, isRunning, isPaused, pendingNodeId, liveStateNext]);
  const hoveredNodeId = runtimeHoverTarget?.nodeId || null;
  const hoverPathState = useMemo(() => {
    const inboundEdgeIds = new Set<string>();
    const outboundEdgeIds = new Set<string>();
    const predecessorNodeIds = new Set<string>();
    const successorNodeIds = new Set<string>();
    if (!hoveredNodeId) return { inboundEdgeIds, outboundEdgeIds, predecessorNodeIds, successorNodeIds };
    edges.forEach((edge) => {
      if (edge.target === hoveredNodeId) {
        inboundEdgeIds.add(edge.id);
        predecessorNodeIds.add(edge.source);
      }
      if (edge.source === hoveredNodeId) {
        outboundEdgeIds.add(edge.id);
        successorNodeIds.add(edge.target);
      }
    });
    return { inboundEdgeIds, outboundEdgeIds, predecessorNodeIds, successorNodeIds };
  }, [edges, hoveredNodeId]);
  const renderedEdges = useMemo(() => edges.map((edge) => {
    const runtimeState = executionTimeline.edgeStateById[edge.id] || 'idle';
    const runtimeClasses = [
      runtimeState === 'traversed' && runtimeEdgeLegend.showTraversed ? 'runtime-edge-traversed' : '',
      runtimeState === 'active' ? 'runtime-edge-active' : '',
      runtimeState === 'scheduled' && runtimeEdgeLegend.showScheduled ? 'runtime-edge-scheduled' : '',
      runtimeState === 'muted' && runtimeEdgeLegend.showMuted ? 'runtime-edge-muted' : '',
      hoveredNodeId && hoverPathState.inboundEdgeIds.has(edge.id) ? 'runtime-edge-hover-inbound' : '',
      hoveredNodeId && hoverPathState.outboundEdgeIds.has(edge.id) ? 'runtime-edge-hover-outbound' : '',
      hoveredNodeId && !hoverPathState.inboundEdgeIds.has(edge.id) && !hoverPathState.outboundEdgeIds.has(edge.id) ? 'runtime-edge-hover-muted' : '',
    ].filter(Boolean).join(' ');
    const className = [edge.className || '', runtimeClasses].filter(Boolean).join(' ').trim();
    return className === (edge.className || '') ? edge : { ...edge, className, data: { ...(edge.data as Record<string, unknown> | undefined), runtimeState } };
  }), [edges, executionTimeline, runtimeEdgeLegend, hoveredNodeId, hoverPathState]);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const rfInstance = useRef<ReactFlowInstance | null>(null);
  const [connectionFeedback, setConnectionFeedback] = useState<{ tone: 'info' | 'warning' | 'success'; title: string; message: string; suggestion?: string | null } | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const latestInvalidReasonRef = useRef<string | null>(null);

  const pushConnectionFeedback = useCallback((payload: { tone: 'info' | 'warning' | 'success'; title: string; message: string; suggestion?: string | null } | null, timeout = 2200) => {
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    setConnectionFeedback(payload);
    if (payload) feedbackTimerRef.current = window.setTimeout(() => setConnectionFeedback(null), timeout);
  }, []);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!preferences.confirmBeforeCloseUnsavedWork) return;
      if (!tabs.some((tab) => tab.isDirty)) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [preferences.confirmBeforeCloseUnsavedWork, tabs]);

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const isValidConnection = useCallback((connection: Connection | Edge) => {
    const state = useAppStore.getState();
    const currentNodes = state.nodes;
    const currentEdges = state.edges;
    const sourceNode = currentNodes.find((n) => n.id === connection.source);
    const targetNode = currentNodes.find((n) => n.id === connection.target);

    if (!sourceNode || !targetNode) {
      latestInvalidReasonRef.current = 'missing_connection_node';
      return false;
    }

    const sourceDef = NODE_DEFS[sourceNode.data.nodeType as string];
    const targetDef = NODE_DEFS[targetNode.data.nodeType as string];

    if (!sourceDef || !targetDef) {
      latestInvalidReasonRef.current = 'missing_connection_node';
      return false;
    }

    const sourceHandle = sourceDef.handles.find((h) => h.id === connection.sourceHandle);
    const targetHandle = targetDef.handles.find((h) => h.id === connection.targetHandle);

    if (sourceHandle && targetHandle) {
      const srcMod = sourceHandle.modality;
      const tgtMod = targetHandle.modality;
      if (srcMod !== 'any' && tgtMod !== 'any' && srcMod !== tgtMod) {
        latestInvalidReasonRef.current = 'handle_modality_mismatch';
        return false;
      }
    }

    const affordance = validateConnectionAffordance(connection, currentNodes, currentEdges);
    latestInvalidReasonRef.current = affordance.valid ? null : affordance.reasonCode || 'connection_not_supported';
    return affordance.valid;
  }, []);

  const handleConnect = useCallback((connection: Connection) => {
    const state = useAppStore.getState();
    const affordance = validateConnectionAffordance(connection, state.nodes, state.edges);
    if (!affordance.valid) {
      const details = describeConnectionReason(affordance.reasonCode);
      pushConnectionFeedback({
        tone: 'warning',
        title: details?.title || 'Connexion refusée',
        message: details?.message || 'Ce geste de connexion n’est pas autorisé dans le canvas.',
        suggestion: details?.suggestion || null,
      }, 2800);
      return;
    }
    connectEdge(connection);
    pushConnectionFeedback({
      tone: 'success',
      title: 'Connexion créée',
      message: describeSemanticKind(affordance.semanticKind || null) || 'La connexion a été ajoutée au canvas.',
      suggestion: null,
    }, 1400);
  }, [connectEdge, pushConnectionFeedback]);

  const handleConnectStart = useCallback(() => {
    latestInvalidReasonRef.current = null;
    pushConnectionFeedback({
      tone: 'info',
      title: 'Connexion en cours',
      message: 'Les poignées peuvent représenter des attaches sémantiques d’auteur plutôt qu’un edge runtime littéral.',
      suggestion: 'Relie tools vers tools_in, memory vers memory_in, et passe par un worker entre fanout et reduce.',
    }, 1800);
  }, [pushConnectionFeedback]);

  const handleConnectEnd = useCallback(() => {
    if (!latestInvalidReasonRef.current) return;
    const details = describeConnectionReason(latestInvalidReasonRef.current);
    pushConnectionFeedback({
      tone: 'warning',
      title: details?.title || 'Connexion refusée',
      message: details?.message || latestInvalidReasonRef.current,
      suggestion: details?.suggestion || null,
    }, 3200);
  }, [pushConnectionFeedback]);

  useEffect(() => {
    if (!runtimeFocusRequest?.nodeId || !rfInstance.current) return;
    const targetNode = nodes.find((node) => node.id === runtimeFocusRequest.nodeId);
    if (!targetNode) {
      clearRuntimeFocusRequest();
      return;
    }

    selectNodesByIds([targetNode.id]);
    const nodeType = typeof targetNode.data?.nodeType === 'string' ? String(targetNode.data.nodeType) : '';
    if (nodeType) {
      setCapabilityInspectorTarget({ source: 'node', nodeType, nodeId: targetNode.id });
    }

    const width = Number((targetNode as Node & { measured?: { width?: number; height?: number } }).measured?.width ?? (targetNode as Node & { width?: number }).width ?? 240);
    const height = Number((targetNode as Node & { measured?: { width?: number; height?: number } }).measured?.height ?? (targetNode as Node & { height?: number }).height ?? 160);
    const centerX = targetNode.position.x + width / 2;
    const centerY = targetNode.position.y + height / 2;

    window.requestAnimationFrame(() => {
      rfInstance.current?.setCenter(centerX, centerY, { zoom: 1.15, duration: 320 });
      clearRuntimeFocusRequest();
    });
  }, [runtimeFocusRequest?.nonce, runtimeFocusRequest?.nodeId, nodes, selectNodesByIds, setCapabilityInspectorTarget, clearRuntimeFocusRequest]);

  useEffect(() => {
    if (!runtimeNavigationSettings.followActiveNode || !executionTimeline.activeNodeId) return;
    requestRuntimeFocus(executionTimeline.activeNodeId, 'graph');
  }, [runtimeNavigationSettings.followActiveNode, executionTimeline.activeNodeId, requestRuntimeFocus]);

  useEffect(() => {
    if (!runtimeNavigationSettings.lockHover) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      clearRuntimeHoverTarget();
      updateRuntimeNavigationSettings({ lockHover: false });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [runtimeNavigationSettings.lockHover, clearRuntimeHoverTarget, updateRuntimeNavigationSettings]);


  useEffect(() => {
    const handler = () => setTabletopDialogOpen(true);
    window.addEventListener('langsuite:open-tabletop-starter', handler as EventListener);
    return () => window.removeEventListener('langsuite:open-tabletop-starter', handler as EventListener);
  }, []);

  useEffect(() => {
    if (!tabletopDialogOpen) return;
    let cancelled = false;
    const loadTabletopCatalog = async () => {
      try {
        const manifest = await fetchArtifactManifest('graph', 'jdr_solo_session_starter');
        if (cancelled) return;
        setTabletopStarterRuntimeSettings((manifest.artifact.runtimeSettings || {}) as Record<string, unknown>);
      } catch (err) {
        console.error('Failed to preload tabletop module catalog', err);
      }
    };
    void loadTabletopCatalog();
    return () => {
      cancelled = true;
    };
  }, [tabletopDialogOpen]);

  const openBuiltinStarter = useCallback(async (artifactId: string, options: { preset?: 'tabletop_demo' } = {}) => {
    try {
      if (options.preset) applyWorkspacePreset(options.preset);
      const manifest = await fetchArtifactManifest('graph', artifactId);
      const hydrated = hydrateArtifactEditorGraph(manifest.artifact);
      openTab(null, manifest.artifact.name || manifest.title, (hydrated.nodes as never[]) || [], (hydrated.edges as never[]) || [], manifest.artifact.customStateSchema || [], manifest.artifact.isAsync ?? true, {
        graphBindings: manifest.artifact.graphBindings || [],
        artifactType: (manifest.artifact.artifactType || manifest.kind) as never,
        executionProfile: (manifest.artifact.executionProfile || 'langgraph_async') as never,
        runtimeSettings: (manifest.artifact.runtimeSettings || {}) as never,
        projectMode: (manifest.artifact.projectMode || 'langgraph') as never,
        scopeKind: (manifest.artifact.artifactType || manifest.kind) === 'subgraph' ? 'subgraph' : 'project',
      });
    } catch (err) {
      console.error('Failed to open builtin starter', err);
    }
  }, [applyWorkspacePreset, openTab]);

  const openGuidedTabletopStarter = useCallback(async (selection: TabletopStarterSelection) => {
    try {
      applyWorkspacePreset('tabletop_demo');
      const manifest = await fetchArtifactManifest('graph', 'jdr_solo_session_starter');
      const hydrated = hydrateArtifactEditorGraph(manifest.artifact);
      const guided = buildGuidedTabletopStarter(manifest.artifact, (hydrated.nodes as Node[]) || [], (hydrated.edges as Edge[]) || [], selection);
      openTab(null, guided.name, (guided.nodes as never[]) || [], (guided.edges as never[]) || [], manifest.artifact.customStateSchema || [], manifest.artifact.isAsync ?? true, {
        graphBindings: manifest.artifact.graphBindings || [],
        artifactType: (manifest.artifact.artifactType || manifest.kind) as never,
        executionProfile: (manifest.artifact.executionProfile || 'langgraph_async') as never,
        runtimeSettings: guided.runtimeSettings as never,
        projectMode: (manifest.artifact.projectMode || 'langgraph') as never,
        scopeKind: (manifest.artifact.artifactType || manifest.kind) === 'subgraph' ? 'subgraph' : 'project',
      });
      setTabletopDialogOpen(false);
    } catch (err) {
      console.error('Failed to open guided tabletop starter', err);
    }
  }, [applyWorkspacePreset, openTab]);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const nodeType = e.dataTransfer.getData('application/langgraph-node');
      if (!nodeType || !NODE_DEFS[nodeType]) return;

      if (!rfInstance.current) return;

      const position = rfInstance.current.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      addNode(nodeType, position);
    },
    [addNode],
  );

  return (
    <div className={`w-full h-full flex flex-col bg-canvas density-${preferences.uiDensity} ${tabletopVisualProfile.shellClassName}`.trim()}>
      <Toolbar />
      <TabBar />
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={reactFlowWrapper}
          className="absolute inset-0"
        >
          <ReactFlow
            nodes={nodes}
            edges={renderedEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onConnectStart={handleConnectStart}
            onConnectEnd={handleConnectEnd}
            isValidConnection={isValidConnection}
            onInit={(instance) => {
              rfInstance.current = instance;
            }}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={{ animated: true }}
            fitView
            deleteKeyCode={['Backspace', 'Delete']}
            proOptions={{ hideAttribution: true }}
            snapToGrid={preferences.snapToGrid}
            snapGrid={[20, 20]}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e2030" />
            <Controls position="bottom-right" />
            {preferences.showMinimap && (
              <MiniMap
                position="bottom-right"
                style={{ marginBottom: 60 }}
                nodeColor={(n) => {
                  const def = NODE_DEFS[n.data?.nodeType as string];
                  return def?.color ?? '#3b82f6';
                }}
                maskColor="rgba(12, 14, 20, 0.7)"
              />
            )}
          </ReactFlow>
        </div>

        {(executionTimeline.steps.length > 0 || executionTimeline.scheduledNodeIds.length > 0 || hoveredNodeId) && (
          <div className="absolute left-3 top-3 z-20" data-testid="runtime-edge-legend">
            <div className="w-[320px] max-w-[calc(100vw-2rem)] rounded-xl border border-panel-border bg-[#111522]/85 px-3 py-2 shadow-2xl shadow-black/30 backdrop-blur-md">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Runtime path</div>
                  <div className="mt-1 text-xs text-slate-300">Interactive graph correspondence for the current run.</div>
                </div>
                {executionTimeline.activeNodeId && (
                  <button
                    onClick={() => requestRuntimeFocus(executionTimeline.activeNodeId!, 'graph')}
                    className="px-2 py-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 text-[11px] text-emerald-300 font-mono hover:bg-emerald-500/15 transition-all"
                  >
                    current #{executionTimeline.activeNodeId}
                  </button>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => updateRuntimeEdgeLegend({ showTraversed: !runtimeEdgeLegend.showTraversed })}
                  className={`px-2 py-1 rounded-md border text-[11px] transition-all ${runtimeEdgeLegend.showTraversed ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300' : 'border-panel-border bg-black/20 text-slate-500'}`}
                  data-testid="toggle-traversed-edges"
                >
                  traversed {executionTimeline.traversedEdgeIds.length}
                </button>
                <button
                  onClick={() => updateRuntimeEdgeLegend({ showScheduled: !runtimeEdgeLegend.showScheduled })}
                  className={`px-2 py-1 rounded-md border text-[11px] transition-all ${runtimeEdgeLegend.showScheduled ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-panel-border bg-black/20 text-slate-500'}`}
                  data-testid="toggle-scheduled-edges"
                >
                  scheduled {executionTimeline.scheduledPathEdgeIds.length}
                </button>
                <button
                  onClick={() => updateRuntimeEdgeLegend({ showMuted: !runtimeEdgeLegend.showMuted })}
                  className={`px-2 py-1 rounded-md border text-[11px] transition-all ${runtimeEdgeLegend.showMuted ? 'border-slate-500/20 bg-slate-500/10 text-slate-300' : 'border-panel-border bg-black/20 text-slate-500'}`}
                  data-testid="toggle-muted-edges"
                >
                  dim idle {executionTimeline.edgeStateById ? Object.values(executionTimeline.edgeStateById).filter((value) => value === 'muted').length : 0}
                </button>
              </div>
              <div className="mt-3 rounded-lg border border-panel-border bg-black/20 px-2.5 py-2" data-testid="runtime-hover-legend">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">Hover brushing</div>
                    <div className="mt-1 text-[11px] text-slate-400">Inbound edges flow into the inspected node. Outbound edges leave it toward authored successors. Press Esc to clear a locked hover.</div>
                  </div>
                  {hoveredNodeId && <span className="px-1.5 py-0.5 rounded border border-violet-500/20 bg-violet-500/10 text-[10px] text-violet-200 font-mono">hover #{hoveredNodeId}</span>}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="px-2 py-1 rounded-md border border-sky-500/20 bg-sky-500/10 text-[11px] text-sky-300">inbound {hoverPathState.inboundEdgeIds.size}</span>
                  <span className="px-2 py-1 rounded-md border border-violet-500/20 bg-violet-500/10 text-[11px] text-violet-300">outbound {hoverPathState.outboundEdgeIds.size}</span>
                  <span className="px-2 py-1 rounded-md border border-panel-border bg-black/20 text-[11px] text-slate-400">pred {hoverPathState.predecessorNodeIds.size}</span>
                  <span className="px-2 py-1 rounded-md border border-panel-border bg-black/20 text-[11px] text-slate-400">succ {hoverPathState.successorNodeIds.size}</span>
                </div>
                {hoveredNodeId && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md border border-sky-500/15 bg-sky-500/5 px-2 py-2" data-testid="runtime-hover-predecessor-ids">
                      <div className="text-[10px] uppercase tracking-wide text-sky-300/80">Predecessor node ids</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Array.from(hoverPathState.predecessorNodeIds).length > 0 ? Array.from(hoverPathState.predecessorNodeIds).map((nodeId) => (
                          <button key={`pred-${nodeId}`} onClick={() => requestRuntimeFocus(nodeId, 'graph')} className="px-1.5 py-0.5 rounded border border-sky-500/20 bg-sky-500/10 text-[10px] text-sky-200 font-mono hover:bg-sky-500/15 transition-all">#{nodeId}</button>
                        )) : <span className="text-[11px] text-slate-500">none</span>}
                      </div>
                    </div>
                    <div className="rounded-md border border-violet-500/15 bg-violet-500/5 px-2 py-2" data-testid="runtime-hover-successor-ids">
                      <div className="text-[10px] uppercase tracking-wide text-violet-300/80">Successor node ids</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Array.from(hoverPathState.successorNodeIds).length > 0 ? Array.from(hoverPathState.successorNodeIds).map((nodeId) => (
                          <button key={`succ-${nodeId}`} onClick={() => requestRuntimeFocus(nodeId, 'graph')} className="px-1.5 py-0.5 rounded border border-violet-500/20 bg-violet-500/10 text-[10px] text-violet-200 font-mono hover:bg-violet-500/15 transition-all">#{nodeId}</button>
                        )) : <span className="text-[11px] text-slate-500">none</span>}
                      </div>
                    </div>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const next = !runtimeNavigationSettings.lockHover;
                      updateRuntimeNavigationSettings({ lockHover: next });
                      if (!next) clearRuntimeHoverTarget();
                    }}
                    className={`px-2 py-1 rounded-md border text-[11px] transition-all ${runtimeNavigationSettings.lockHover ? 'border-violet-500/20 bg-violet-500/10 text-violet-300' : 'border-panel-border bg-black/20 text-slate-500'}`}
                    data-testid="toggle-lock-hover"
                  >
                    lock hover {runtimeNavigationSettings.lockHover ? 'on' : 'off'}
                  </button>
                  <button
                    onClick={() => updateRuntimeNavigationSettings({ followActiveNode: !runtimeNavigationSettings.followActiveNode })}
                    className={`px-2 py-1 rounded-md border text-[11px] transition-all ${runtimeNavigationSettings.followActiveNode ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-panel-border bg-black/20 text-slate-500'}`}
                    data-testid="toggle-follow-active"
                  >
                    follow active {runtimeNavigationSettings.followActiveNode ? 'on' : 'off'}
                  </button>
                  <button
                    onClick={() => updateRuntimeNavigationSettings({ autoScrollMatchingLogs: !runtimeNavigationSettings.autoScrollMatchingLogs })}
                    className={`px-2 py-1 rounded-md border text-[11px] transition-all ${runtimeNavigationSettings.autoScrollMatchingLogs ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300' : 'border-panel-border bg-black/20 text-slate-500'}`}
                    data-testid="toggle-auto-scroll-matching-logs"
                  >
                    auto-scroll logs {runtimeNavigationSettings.autoScrollMatchingLogs ? 'on' : 'off'}
                  </button>
                  {hoveredNodeId && (
                    <button
                      onClick={() => {
                        clearRuntimeHoverTarget();
                        updateRuntimeNavigationSettings({ lockHover: false });
                      }}
                      className="px-2 py-1 rounded-md border border-panel-border bg-black/20 text-[11px] text-slate-400 hover:bg-panel-hover transition-all"
                      data-testid="clear-runtime-hover"
                    >
                      clear hover / unlock
                    </button>
                  )}
                </div>
                <div className="mt-2 text-[10px] text-slate-500" data-testid="runtime-hover-lock-hint">Double-click any runtime chip to lock the inspected node without keeping the pointer pressed.</div>
              </div>
              {executionTimeline.scheduledNodeIds.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">Scheduled next</span>
                  {executionTimeline.scheduledNodeIds.slice(0, 6).map((nodeId) => (
                    <button
                      key={nodeId}
                      onClick={() => requestRuntimeFocus(nodeId, 'graph')}
                      className="px-1.5 py-0.5 rounded border border-amber-500/20 text-[10px] text-amber-300 bg-amber-500/10 font-mono hover:bg-amber-500/15 transition-all"
                    >
                      #{nodeId}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {editorMode === 'advanced' && (
          <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2" data-testid="advanced-mode-notice">
            <div className="min-w-[360px] max-w-[640px] rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-amber-100 shadow-2xl backdrop-blur-md">
              <div className="text-xs font-semibold">Advanced authoring is visible</div>
              <div className="mt-0.5 text-[11px] leading-5 opacity-95">This exposes richer metadata, wrappers, and bridge-heavy surfaces. The default product path is still the LangGraph trunk plus compile/export.</div>
            </div>
          </div>
        )}

        {connectionFeedback && (
          <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2">
            <div className={`min-w-[320px] max-w-[560px] rounded-xl border px-3 py-2 shadow-2xl backdrop-blur-md ${connectionFeedback.tone === 'warning' ? 'border-amber-500/30 bg-amber-500/10 text-amber-100' : connectionFeedback.tone === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100'}`}>
              <div className="text-xs font-semibold">{connectionFeedback.title}</div>
              <div className="mt-0.5 text-[11px] leading-5 opacity-95">{connectionFeedback.message}</div>
              {connectionFeedback.suggestion && <div className="mt-1 text-[10px] opacity-80">{connectionFeedback.suggestion}</div>}
            </div>
          </div>
        )}

        {tabletopVisualProfile.isTabletop && !isEmptyCanvas && (
          <div className="absolute right-3 top-3 z-20" data-testid="tabletop-shell-badge">
            <div className="rounded-2xl border border-fuchsia-500/20 bg-[#111522]/88 px-3 py-2 shadow-2xl shadow-black/30 backdrop-blur-md">
              <div className="text-[10px] uppercase tracking-[0.22em] text-fuchsia-200/90">{tabletopVisualProfile.badgeLabel}</div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                {tabletopVisualProfile.settingLabel && <span className="rounded-full border border-panel-border bg-black/20 px-2 py-1 text-slate-200">{tabletopVisualProfile.settingLabel}</span>}
                {tabletopVisualProfile.rulesLabel && <span className="rounded-full border border-panel-border bg-black/20 px-2 py-1 text-slate-300">{tabletopVisualProfile.rulesLabel}</span>}
                {tabletopVisualProfile.toneLabel && <span className="rounded-full border border-panel-border bg-black/20 px-2 py-1 text-slate-300">{tabletopVisualProfile.toneLabel}</span>}
                {tabletopRuntimeNeedsConfig && <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-amber-200">Runtime setup needed</span>}
                {!tabletopRuntimeNeedsConfig && <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-emerald-200">Check runtime on Run</span>}
              </div>
              <div className="mt-2 text-[11px] leading-5 text-slate-400">
                {tabletopRuntimeNeedsConfig
                  ? 'This session is ready to edit. Choose provider/model later from the graph or Run panel.'
                  : 'Provider-backed nodes are configured. Run preflight still decides whether execution is allowed.'}
              </div>
            </div>
          </div>
        )}

        {isEmptyCanvas && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none px-6">
            <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-panel-border bg-[#111522]/85 backdrop-blur-md shadow-2xl shadow-black/30 p-5 md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Canvas vide</div>
                  <h2 className="mt-2 text-xl font-semibold text-slate-100">Commence par un petit circuit lisible</h2>
                  <p className="mt-2 text-sm text-slate-400 max-w-lg">Ajoute une entrée, un LLM, puis un outil ou une sortie. Le reste pourra devenir aussi baroque que nécessaire plus tard.</p>
                </div>
                <div className="hidden md:flex h-9 items-center rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 text-[11px] text-cyan-300">
                  Glisser-déposer ou clic rapide
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4" data-testid="recommended-path-card">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-[10px] uppercase tracking-wide text-emerald-300">Primary path</span>
                  <span className="text-[11px] text-slate-400">Start with the proven LangGraph trunk, then opt into advanced bridges only when needed.</span>
                </div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div className="rounded-lg border border-panel-border bg-black/20 px-3 py-2">1. Create or open a LangGraph graph/subgraph.</div>
                  <div className="rounded-lg border border-panel-border bg-black/20 px-3 py-2">2. Build with core nodes first: input, LLM, tool, output.</div>
                  <div className="rounded-lg border border-panel-border bg-black/20 px-3 py-2">3. Check runtime settings only where the graph actually needs them.</div>
                  <div className="rounded-lg border border-panel-border bg-black/20 px-3 py-2">4. Run, then inspect execution logs and state before expanding the graph.</div>
                  <div className="rounded-lg border border-panel-border bg-black/20 px-3 py-2">5. Save the workspace tree for editor continuity.</div>
                  <div className="rounded-lg border border-panel-border bg-black/20 px-3 py-2">6. Export zip when you want the runnable Python output.</div>
                </div>
              </div>


              <div className="mt-3 flex flex-wrap gap-2" data-testid="empty-state-starters">
                <button
                  onClick={() => void openBuiltinStarter('core_echo_starter')}
                  className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20 transition-all"
                >
                  Open compile-safe starter
                </button>
                <button
                  onClick={() => void openBuiltinStarter('static_debug_starter')}
                  className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/20 transition-all"
                >
                  Open static debug starter
                </button>
                <button
                  onClick={() => setTabletopDialogOpen(true)}
                  className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/10 px-3 py-2 text-[11px] font-medium text-fuchsia-100 hover:bg-fuchsia-500/20 transition-all"
                >
                  Build guided session
                </button>
                <button
                  onClick={() => void openBuiltinStarter('jdr_solo_session_starter', { preset: 'tabletop_demo' })}
                  className="rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-[11px] font-medium text-violet-100 hover:bg-violet-500/20 transition-all"
                >
                  Open tabletop starter
                </button>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                Guided setup assembles bounded packs and opens a normal editable graph. Runtime setup stays deferred until Run. The direct starter opens the same JDR scaffold with GM, cast, prompt strips, dice, and a rules helper.
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => addNode('user_input_node', { x: 120, y: 140 })}
                  className="rounded-xl border border-panel-border bg-black/20 px-4 py-3 text-left hover:bg-panel-hover transition-all"
                >
                  <div className="text-sm font-medium text-slate-100">Entrée utilisateur</div>
                  <div className="mt-1 text-xs text-slate-500">Le point de départ le plus simple.</div>
                </button>
                <button
                  onClick={() => addNode('llm_chat', { x: 360, y: 140 })}
                  className="rounded-xl border border-panel-border bg-black/20 px-4 py-3 text-left hover:bg-panel-hover transition-all"
                >
                  <div className="text-sm font-medium text-slate-100">LLM Chat</div>
                  <div className="mt-1 text-xs text-slate-500">Nœud conversationnel principal.</div>
                </button>
                <button
                  onClick={() => addNode('tool_web_search', { x: 120, y: 260 })}
                  className="rounded-xl border border-panel-border bg-black/20 px-4 py-3 text-left hover:bg-panel-hover transition-all"
                >
                  <div className="text-sm font-medium text-slate-100">Outil web</div>
                  <div className="mt-1 text-xs text-slate-500">Ajoute une capacité externe utile.</div>
                </button>
                <button
                  onClick={() => addNode('chat_output', { x: 360, y: 260 })}
                  className="rounded-xl border border-panel-border bg-black/20 px-4 py-3 text-left hover:bg-panel-hover transition-all"
                >
                  <div className="text-sm font-medium text-slate-100">Sortie chat</div>
                  <div className="mt-1 text-xs text-slate-500">Visualise clairement la réponse finale.</div>
                </button>
              </div>
            </div>
          </div>
        )}

        <TabletopStarterDialog
        open={tabletopDialogOpen}
        onClose={() => setTabletopDialogOpen(false)}
        onLaunch={openGuidedTabletopStarter}
        runtimeSettings={tabletopStarterRuntimeSettings as never}
      />
        <RunPanel />
        <CollabPanel />
        <SidePanelSystem />
      </div>
      <ProjectManager />
    </div>
  );
}
