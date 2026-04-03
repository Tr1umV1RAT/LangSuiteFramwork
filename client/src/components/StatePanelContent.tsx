import { useMemo, useState, type ReactNode } from 'react';
import { useAppStore, type GraphBinding, type ArtifactType, type ExecutionProfile, type ModuleLibraryCategory, type ModuleLibraryEntry, type ModuleLibraryLineage, type PromptAssignmentTarget, type PromptStripAssignment, type PromptStripDefinition, type PromptStripMergeMode, type Tab } from '../store';
import { saveArtifactManifest } from '../api/artifacts';
import { Database, Plus, Trash2, Eye, ChevronDown, ChevronRight, Workflow, Cpu, Boxes, LibraryBig, UploadCloud, Lock, LockOpen, BookOpen, Wand2, PackagePlus } from 'lucide-react';
import CapabilityInspectorSection from './CapabilityInspectorSection';
import { ARTIFACT_KIND_META, BLOCK_FAMILY_BADGE_CLASSES, BLOCK_FAMILY_LABELS, EXECUTION_PROFILE_META, getArtifactOptionsForEditor, getExecutionProfileOptionsForEditor, inferNodeBlockFamily, getNodeRuntimeMetaMatrix } from '../capabilities';
import { describeToolObservationCounts, parseToolObservation, summarizeToolObservation } from '../executionTruth';
import { deriveExecutionTimeline } from '../executionTimeline';
import { applyModuleDefinitionToRuntimeSettings, buildModuleLibraryEntryFromRuntimeSettings, buildPromptAssignmentTargetKey, buildSurfaceTruthSummary, extractPromptStripVariables, getLocalPromptForNode, getPromptAssignmentsForTarget, isPromptCapableNodeType, resolvePromptStripsForNodeTarget, resolvePromptStripsForSubagentTarget, resolvePromptStripsForTarget } from '../store/workspace';

const STATE_KEY_PARAMS = [
  'output_key', 'input_key', 'state_key', 'target_key',
  'state_key_to_save', 'input_keys', 'query_key', 'handoff_key',
];

const MEMORY_NODE_TYPES = new Set([
  'memory_store_read',
  'memoryreader',
  'memory_access',
  'memorywriter',
  'store_put',
  'store_search',
  'store_get',
  'store_delete',
  'context_trimmer',
  'rag_retriever_local',
]);

const PROMPT_MERGE_MODE_OPTIONS: { value: PromptStripMergeMode; label: string }[] = [
  { value: 'prepend', label: 'prepend' },
  { value: 'append', label: 'append' },
  { value: 'replace_if_empty', label: 'replace if empty' },
];

const MODULE_CATEGORY_OPTIONS: { value: ModuleLibraryCategory; label: string }[] = [
  { value: 'world', label: 'world' },
  { value: 'rules', label: 'rules' },
  { value: 'persona', label: 'persona' },
  { value: 'party', label: 'party' },
  { value: 'utility', label: 'utility' },
  { value: 'mixed', label: 'mixed' },
];

const MODULE_LINEAGE_OPTIONS: { value: ModuleLibraryLineage; label: string }[] = [
  { value: 'shared', label: 'Shared trunk asset' },
  { value: 'branch_overlay', label: 'Branch overlay' },
];

function summarizePromptBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return 'Prompt vide';
  return trimmed.length > 140 ? `${trimmed.slice(0, 140)}…` : trimmed;
}

type MemorySurfaceSummary = {
  id: string;
  label: string;
  nodeType: string;
  blockFamily: ReturnType<typeof inferNodeBlockFamily>;
  summary: string;
  systemKind: string;
  durability: string;
  visibility: string;
  role?: string;
  accessModel?: string;
  preferredSurface?: string | null;
  legacyHelperSurface?: boolean;
  storeBackend?: string | null;
  storePath?: string | null;
  outputKey?: string;
  stateKey?: string;
  namespaceHint?: string;
  lastUpdatedAt?: number | null;
  lastEntry?: unknown;
  lastOperation?: string | null;
  sourceKind: 'memory_node' | 'memory_consumer';
  sourceLabels?: string[];
};

function formatTimestamp(ts?: number | null): string {
  if (!ts || !Number.isFinite(ts)) return '—';
  return new Date(ts).toLocaleString();
}

function previewValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string') return value.length > 120 ? `${value.slice(0, 120)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `list(${value.length}) ${JSON.stringify(value.slice(0, 2)).slice(0, 120)}`;
  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value);
      return json.length > 120 ? `${json.slice(0, 120)}…` : json;
    } catch {
      return '[object]';
    }
  }
  return String(value);
}


function describeArtifactSaveEffect(surfaceTruth: ReturnType<typeof buildSurfaceTruthSummary>): string {
  if (surfaceTruth.editorOnly) {
    return 'Publishing saves the authored artifact definition only. It stays editor-first in this build and does not publish runtime state, local dependencies, or secrets.';
  }
  if (surfaceTruth.compileSafe && surfaceTruth.runtimeEnabled) {
    return 'Publishing saves the authored artifact definition and its declared compile/runtime surface only. It does not save runtime state, local dependencies, or secrets.';
  }
  return 'Publishing saves the authored artifact definition only.';
}

function deriveMemoryOutputKey(nodeType: string, params: Record<string, unknown>): string | undefined {
  const explicitOutput = typeof params.output_key === 'string' && params.output_key.trim() ? params.output_key.trim() : '';
  if (explicitOutput) return explicitOutput;
  if (nodeType === 'context_trimmer') return 'messages';
  if (nodeType === 'rag_retriever_local') return 'documents';
  if (nodeType === 'memoryreader') return 'memory_data';
  if (nodeType === 'memory_access') return 'memory_payload';
  if (nodeType === 'store_search') return 'store_results';
  if (nodeType === 'store_get') return 'store_value';
  return undefined;
}

function deriveMemoryStateKey(nodeType: string, params: Record<string, unknown>): string | undefined {
  const candidates = ['state_key_to_save', 'query_key', 'input_key', 'items_key'];
  for (const candidate of candidates) {
    const value = params[candidate];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  if (nodeType === 'context_trimmer') return 'messages';
  return undefined;
}

function extractStateKeys(nodes: { id?: string; data: Record<string, unknown> }[]): string[] {
  const keys = new Set<string>();
  keys.add('messages');

  for (const node of nodes) {
    const data = (node.data || {}) as Record<string, unknown>;
    const params = (data.params || {}) as Record<string, unknown>;
    for (const param of STATE_KEY_PARAMS) {
      const val = params[param];
      if (typeof val === 'string' && val.trim()) {
        const base = val.split('.')[0];
        keys.add(base);
      }
      if (Array.isArray(val)) {
        for (const v of val) {
          if (typeof v === 'string' && v.trim()) {
            keys.add(v.split('.')[0]);
          }
        }
      }
    }

    if (data.nodeType === 'data_container' && Array.isArray(params.variables)) {
      for (const v of params.variables as { key: string; value: string }[]) {
        if (v.key && v.key.trim()) {
          keys.add(v.key.split('.')[0]);
        }
      }
    }
  }

  return Array.from(keys).sort();
}

type BindingWithSource = GraphBinding & { source: 'local' | 'inherited'; inheritedFrom?: string };

function resolveAncestorTabs(activeTab: Tab | undefined, tabs: Tab[]): Tab[] {
  const ancestors: Tab[] = [];
  const seen = new Set<string>();
  let current = activeTab;
  while (current) {
    const parentProjectId = current.parentProjectId;
    const parentTabId = current.parentTabId;
    const parent = parentProjectId
      ? tabs.find((tab) => tab.projectId === parentProjectId)
      : parentTabId
        ? tabs.find((tab) => tab.id === parentTabId)
        : undefined;
    if (!parent || seen.has(parent.id)) break;
    ancestors.push(parent);
    seen.add(parent.id);
    current = parent;
  }
  return ancestors;
}


function RuntimeChipLockButton({ nodeId, locked, onLockNode, onUnlockNode }: { nodeId: string; locked: boolean; onLockNode: (nodeId: string) => void; onUnlockNode: (nodeId?: string) => void; }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        if (locked) onUnlockNode(nodeId);
        else onLockNode(nodeId);
      }}
      className={`inline-flex h-6 w-6 items-center justify-center rounded border transition-all ${locked ? 'border-violet-500/20 bg-violet-500/10 text-violet-200 hover:bg-violet-500/15' : 'border-panel-border bg-black/20 text-slate-400 hover:bg-panel-hover hover:text-violet-200'}`}
      title={locked ? `Unlock inspection for #${nodeId}` : `Lock inspection on #${nodeId}`}
      data-testid={locked ? 'state-runtime-unlock' : 'state-runtime-lock'}
    >
      {locked ? <LockOpen size={11} /> : <Lock size={11} />}
    </button>
  );
}


function Section({
  title,
  icon: Icon,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: typeof Database;
  count?: number | string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-panel-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-panel-hover transition-all"
      >
        <Icon size={12} className="text-cyan-400" />
        <span>{title}</span>
        {count !== undefined && <span className="ml-auto text-[10px] text-slate-500">{count}</span>}
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && <div className="px-2.5 pb-2.5 pt-1 space-y-1.5">{children}</div>}
    </div>
  );
}

export default function StatePanelContent() {
  const {
    tabs,
    activeTabId,
    updateCustomStateSchema,
    updateGraphBindings,
    updateArtifactType,
    updateExecutionProfile,
    updateRuntimeSettings,
    setIsAsync,
    nodes,
    edges,
    projectName,
    isAsync,
    liveState,
    runLogs,
    liveStateNext,
    pendingNodeId,
    isRunning,
    isPaused,
    selectNodesByIds,
    addNodeWithParams,
    requestRuntimeFocus,
    setRuntimeHoverTarget,
    clearRuntimeHoverTarget,
    runtimeHoverTarget,
    runtimeNavigationSettings,
    updateRuntimeNavigationSettings,
  } = useAppStore();
  const editorMode = useAppStore((s) => s.editorMode);
  const graphValidation = useAppStore((s) => s.graphValidation);

  const semanticLinkKinds = useMemo(() => Object.entries(graphValidation?.semanticEdgeSummary || {}).filter(([kind, count]) => kind !== 'direct_flow' && count > 0), [graphValidation]);
  const executionTimeline = useMemo(() => deriveExecutionTimeline(edges, runLogs, { isRunning, isPaused, pendingNodeId, scheduledNodeIds: liveStateNext }), [edges, runLogs, isRunning, isPaused, pendingNodeId, liveStateNext]);
  const graphScopeMarkerCount = graphValidation?.graphScopeMarkerIds?.size || 0;
  const lockRuntimeNode = (nodeId: string) => {
    setRuntimeHoverTarget(nodeId, 'state');
    updateRuntimeNavigationSettings({ lockHover: true });
    requestRuntimeFocus(nodeId, 'state');
  };

  const unlockRuntimeNode = (nodeId?: string) => {
    if (nodeId && runtimeHoverTarget?.nodeId && runtimeHoverTarget.nodeId !== nodeId) return;
    clearRuntimeHoverTarget();
    updateRuntimeNavigationSettings({ lockHover: false });
  };
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeArtifactSurface = activeTab?.artifactType ? ARTIFACT_KIND_META[activeTab.artifactType]?.surfaceLevel || 'stable' : 'stable';
  const activeProfileSurface = activeTab?.executionProfile ? EXECUTION_PROFILE_META[activeTab.executionProfile]?.surfaceLevel || 'stable' : 'stable';
  const showNonDefaultRailNotice = activeArtifactSurface !== 'stable' || activeProfileSurface !== 'stable';
  const schema = activeTab?.customStateSchema || [];
  const graphBindings = activeTab?.graphBindings || [];
  const subagentLibrary = activeTab?.runtimeSettings?.subagentLibrary || [];
  const promptStripLibrary = activeTab?.runtimeSettings?.promptStripLibrary || [];
  const promptStripAssignments = activeTab?.runtimeSettings?.promptStripAssignments || [];
  const moduleLibrary = activeTab?.runtimeSettings?.moduleLibrary || [];
  const loadedModuleIds = activeTab?.runtimeSettings?.loadedModuleIds || [];
  const selectedCanvasNode = useMemo(() => (nodes as { id: string; selected?: boolean; data?: Record<string, unknown> }[]).find((node) => Boolean(node.selected)) || null, [nodes]);
  const selectedPromptNode = useMemo(() => {
    if (!selectedCanvasNode) return null;
    const nodeType = String(selectedCanvasNode.data?.nodeType || '');
    return isPromptCapableNodeType(nodeType) ? selectedCanvasNode : null;
  }, [selectedCanvasNode]);
  const selectedPromptNodeType = String(selectedPromptNode?.data?.nodeType || '');
  const selectedPromptNodeParams = (selectedPromptNode?.data?.params || {}) as Record<string, unknown>;
  const selectedPromptNodeLocalPrompt = selectedPromptNode ? getLocalPromptForNode(selectedPromptNodeType, selectedPromptNodeParams) : '';
  const graphPromptTarget = activeTab ? ({ kind: 'graph', tabId: activeTab.id } as const) : null;
  const selectedPromptNodeTarget = activeTab && selectedPromptNode ? ({ kind: 'node', tabId: activeTab.id, nodeId: selectedPromptNode.id } as const) : null;
  const [promptAssignmentDrafts, setPromptAssignmentDrafts] = useState<Record<string, { stripId: string; mergeMode: PromptStripMergeMode }>>({});
  const artifactOptions = useMemo(() => {
    const base = getArtifactOptionsForEditor(activeTab?.scopeKind === 'subgraph' ? 'subgraph' : 'project', editorMode)
      .map((value) => ({ value, label: ARTIFACT_KIND_META[value].label }));
    if (activeTab?.artifactType && !base.some((option) => option.value === activeTab.artifactType)) {
      return [{ value: activeTab.artifactType, label: `Internal or imported surface (${activeTab.artifactType})` }, ...base];
    }
    return base;
  }, [activeTab?.artifactType, activeTab?.scopeKind, editorMode]);
  const profileOptions = useMemo(() => {
    const base = getExecutionProfileOptionsForEditor(editorMode).map((value) => ({ value, label: EXECUTION_PROFILE_META[value].label }));
    if (activeTab?.executionProfile && !base.some((option) => option.value === activeTab.executionProfile)) {
      return [{ value: activeTab.executionProfile, label: `Internal or imported profile (${activeTab.executionProfile})` }, ...base];
    }
    return base;
  }, [activeTab?.executionProfile, editorMode]);

  const detectedKeys = useMemo(() => extractStateKeys(nodes as { id?: string; data: Record<string, unknown> }[]), [nodes]);
  const buildPromptDraftState = (targetKey: string) => promptAssignmentDrafts[targetKey] || { stripId: promptStripLibrary[0]?.id || '', mergeMode: 'prepend' as PromptStripMergeMode };
  const setPromptDraftForTarget = (targetKey: string, patch: Partial<{ stripId: string; mergeMode: PromptStripMergeMode }>) => {
    setPromptAssignmentDrafts((current) => ({
      ...current,
      [targetKey]: {
        ...(current[targetKey] || { stripId: promptStripLibrary[0]?.id || '', mergeMode: 'prepend' as PromptStripMergeMode }),
        ...patch,
      },
    }));
  };
  const updatePromptStripLibrary = (nextLibrary: PromptStripDefinition[]) => updateRuntimeSettings({ promptStripLibrary: nextLibrary });
  const updatePromptStripAssignments = (nextAssignments: PromptStripAssignment[]) => updateRuntimeSettings({ promptStripAssignments: nextAssignments });
  const updateModuleLibrary = (nextLibrary: ModuleLibraryEntry[]) => updateRuntimeSettings({ moduleLibrary: nextLibrary });
  const updateLoadedModuleIds = (nextIds: string[]) => updateRuntimeSettings({ loadedModuleIds: Array.from(new Set(nextIds)) });

  const addModuleLibraryEntry = (seed?: Partial<ModuleLibraryEntry>) => {
    if (!activeTab) return;
    const nextEntry = buildModuleLibraryEntryFromRuntimeSettings(activeTab.runtimeSettings, {
      id: typeof seed?.id === 'string' && seed.id.trim() ? seed.id : `module_${moduleLibrary.length + 1}`,
      name: typeof seed?.name === 'string' && seed.name.trim() ? seed.name : `Module ${moduleLibrary.length + 1}`,
      description: typeof seed?.description === 'string' ? seed.description : '',
      category: (seed?.category || 'mixed') as ModuleLibraryCategory,
      tags: Array.isArray(seed?.tags) ? seed.tags : [],
      origin: seed?.origin === 'artifact' ? 'artifact' : 'workspace',
      artifactRef: seed?.artifactRef || null,
    }, { tabId: activeTab.id });
    updateModuleLibrary([...moduleLibrary, nextEntry]);
  };

  const updateModuleEntry = (moduleId: string, patch: Partial<ModuleLibraryEntry>) => {
    updateModuleLibrary(moduleLibrary.map((entry) => entry.id === moduleId ? {
      ...entry,
      ...patch,
      tags: Array.isArray(patch.tags) ? patch.tags : entry.tags,
    } : entry));
  };

  const removeModuleEntry = (moduleId: string) => {
    updateModuleLibrary(moduleLibrary.filter((entry) => entry.id !== moduleId));
    updateLoadedModuleIds(loadedModuleIds.filter((entryId) => entryId !== moduleId));
  };

  const addStarterArtifactRefToModule = (moduleId: string) => {
    updateModuleLibrary(moduleLibrary.map((entry) => entry.id === moduleId ? {
      ...entry,
      starterArtifacts: [...(entry.starterArtifacts || []), { artifactId: `starter_${(entry.starterArtifacts || []).length + 1}`, artifactKind: 'graph', label: '', description: '' }],
    } : entry));
  };

  const updateStarterArtifactRef = (moduleId: string, artifactIndex: number, patch: Partial<{ artifactId: string; artifactKind: string; label?: string; description?: string }>) => {
    updateModuleLibrary(moduleLibrary.map((entry) => entry.id === moduleId ? {
      ...entry,
      starterArtifacts: (entry.starterArtifacts || []).map((ref, index) => index === artifactIndex ? { ...ref, ...patch } : ref),
    } : entry));
  };

  const removeStarterArtifactRef = (moduleId: string, artifactIndex: number) => {
    updateModuleLibrary(moduleLibrary.map((entry) => entry.id === moduleId ? {
      ...entry,
      starterArtifacts: (entry.starterArtifacts || []).filter((_, index) => index !== artifactIndex),
    } : entry));
  };

  const captureCurrentAssetsIntoModule = (moduleId: string) => {
    if (!activeTab) return;
    updateModuleLibrary(moduleLibrary.map((entry) => entry.id === moduleId ? buildModuleLibraryEntryFromRuntimeSettings(activeTab.runtimeSettings, {
      ...entry,
      id: entry.id,
      name: entry.name,
      description: entry.description,
      category: entry.category,
      tags: entry.tags,
      origin: entry.origin,
      artifactRef: entry.artifactRef || null,
      starterArtifacts: entry.starterArtifacts,
    }, { tabId: activeTab.id }) : entry));
  };

  const loadModuleIntoWorkspace = (moduleId: string) => {
    if (!activeTab) return;
    const entry = moduleLibrary.find((item) => item.id === moduleId);
    if (!entry) return;
    updateRuntimeSettings(applyModuleDefinitionToRuntimeSettings(activeTab.runtimeSettings, entry, { tabId: activeTab.id }));
  };
  const makePromptStripId = () => `prompt_strip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const makePromptAssignmentId = () => `prompt_assignment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const addPromptStrip = (seed?: Partial<PromptStripDefinition>) => {
    const body = typeof seed?.body === 'string' ? seed.body : '';
    updatePromptStripLibrary([
      ...promptStripLibrary,
      {
        id: makePromptStripId(),
        name: typeof seed?.name === 'string' && seed.name.trim() ? seed.name : `Prompt Strip ${promptStripLibrary.length + 1}`,
        description: typeof seed?.description === 'string' ? seed.description : '',
        body,
        tags: Array.isArray(seed?.tags) ? seed.tags : [],
        variables: Array.isArray(seed?.variables) && seed.variables.length > 0 ? seed.variables : extractPromptStripVariables(body),
        origin: seed?.origin === 'artifact' ? 'artifact' : 'workspace',
        artifactRef: seed?.artifactRef || null,
      },
    ]);
  };
  const addPromptStripFromSelectedNode = () => {
    if (!selectedPromptNode) return;
    addPromptStrip({
      name: `${typeof selectedPromptNode.data?.label === 'string' ? selectedPromptNode.data.label : selectedPromptNodeType} prompt`,
      description: 'Imported from the currently selected prompt-capable node.',
      body: selectedPromptNodeLocalPrompt,
      tags: [selectedPromptNodeType],
    });
  };
  const updatePromptStrip = (stripId: string, patch: Partial<PromptStripDefinition>) => {
    updatePromptStripLibrary(promptStripLibrary.map((strip) => {
      if (strip.id !== stripId) return strip;
      const nextBody = typeof patch.body === 'string' ? patch.body : strip.body;
      return {
        ...strip,
        ...patch,
        body: nextBody,
        tags: Array.isArray(patch.tags) ? patch.tags : strip.tags,
        variables: Array.isArray(patch.variables) ? patch.variables : extractPromptStripVariables(nextBody),
      };
    }));
  };
  const removePromptStrip = (stripId: string) => {
    updatePromptStripLibrary(promptStripLibrary.filter((strip) => strip.id !== stripId));
    updatePromptStripAssignments(promptStripAssignments.filter((assignment) => assignment.stripId !== stripId));
  };
  const addPromptAssignment = (target: PromptAssignmentTarget, stripId: string, mergeMode: PromptStripMergeMode) => {
    if (!stripId) return;
    const matchingAssignments = getPromptAssignmentsForTarget(promptStripAssignments, target);
    updatePromptStripAssignments([
      ...promptStripAssignments,
      {
        id: makePromptAssignmentId(),
        stripId,
        target,
        mergeMode,
        order: matchingAssignments.length,
        enabled: true,
      },
    ]);
  };
  const updatePromptAssignment = (assignmentId: string, patch: Partial<PromptStripAssignment>) => {
    updatePromptStripAssignments(promptStripAssignments.map((assignment) => assignment.id === assignmentId ? { ...assignment, ...patch } : assignment));
  };
  const removePromptAssignment = (assignmentId: string) => {
    updatePromptStripAssignments(promptStripAssignments.filter((assignment) => assignment.id !== assignmentId));
  };
  const graphPromptPreview = useMemo(() => graphPromptTarget ? resolvePromptStripsForTarget({
    localPrompt: '',
    library: promptStripLibrary,
    assignments: getPromptAssignmentsForTarget(promptStripAssignments, graphPromptTarget),
  }) : null, [graphPromptTarget, promptStripAssignments, promptStripLibrary]);
  const nodePromptPreview = useMemo(() => selectedPromptNodeTarget && graphPromptTarget ? resolvePromptStripsForNodeTarget({
    localPrompt: selectedPromptNodeLocalPrompt,
    library: promptStripLibrary,
    assignments: promptStripAssignments,
    graphTarget: graphPromptTarget,
    nodeTarget: selectedPromptNodeTarget,
  }) : null, [graphPromptTarget, selectedPromptNodeLocalPrompt, selectedPromptNodeTarget, promptStripAssignments, promptStripLibrary]);

  const livePromptStripMeta = useMemo(() => {
    const raw = liveState['__prompt_strip_meta__'];
    return raw && typeof raw === 'object' && !Array.isArray(raw)
      ? raw as Record<string, unknown>
      : null;
  }, [liveState]);

  const selectedNodeRuntimePromptMeta = useMemo(() => {
    if (!selectedPromptNode) return null;
    const nodeMap = livePromptStripMeta?.nodes;
    if (!nodeMap || typeof nodeMap !== 'object' || Array.isArray(nodeMap)) return null;
    const entry = (nodeMap as Record<string, unknown>)[selectedPromptNode.id];
    return entry && typeof entry === 'object' && !Array.isArray(entry)
      ? entry as Record<string, unknown>
      : null;
  }, [livePromptStripMeta, selectedPromptNode]);

  const renderPromptAssignmentsForTarget = (target: PromptAssignmentTarget, localPrompt: string, label: string) => {
    const targetKey = buildPromptAssignmentTargetKey(target);
    const draft = buildPromptDraftState(targetKey);
    const assignments = getPromptAssignmentsForTarget(promptStripAssignments, target).sort((a, b) => a.order - b.order);
    const inheritedGraphAssignments = graphPromptTarget && target.kind !== 'graph'
      ? getPromptAssignmentsForTarget(promptStripAssignments, graphPromptTarget).sort((a, b) => a.order - b.order)
      : [];
    const preview = target.kind === 'node' && graphPromptTarget
      ? resolvePromptStripsForNodeTarget({
          localPrompt,
          library: promptStripLibrary,
          assignments: promptStripAssignments,
          graphTarget: graphPromptTarget,
          nodeTarget: target,
        })
      : target.kind === 'subagent' && graphPromptTarget
        ? resolvePromptStripsForSubagentTarget({
            localPrompt,
            library: promptStripLibrary,
            assignments: promptStripAssignments,
            graphTarget: graphPromptTarget,
            subagentTarget: target,
          })
        : resolvePromptStripsForTarget({ localPrompt, library: promptStripLibrary, assignments });
    return (
      <div className="rounded-lg border border-panel-border bg-black/20 p-2 space-y-2">
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-medium text-slate-200">{label}</div>
          <div className="ml-auto text-[10px] text-slate-500">{assignments.length} assignment{assignments.length === 1 ? '' : 's'}</div>
        </div>
        {promptStripLibrary.length === 0 ? (
          <div className="text-[10px] text-slate-500">Create a prompt strip first, then assign it explicitly to this target.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <select
              value={draft.stripId}
              onChange={(e) => setPromptDraftForTarget(targetKey, { stripId: e.target.value })}
              className="flex-1 min-w-[160px] bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
            >
              {promptStripLibrary.map((strip) => (
                <option key={strip.id} value={strip.id}>{strip.name}</option>
              ))}
            </select>
            <select
              value={draft.mergeMode}
              onChange={(e) => setPromptDraftForTarget(targetKey, { mergeMode: e.target.value as PromptStripMergeMode })}
              className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
            >
              {PROMPT_MERGE_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => addPromptAssignment(target, draft.stripId, draft.mergeMode)}
              className="px-2 py-1 rounded border border-panel-border text-[11px] text-slate-200 hover:bg-panel-hover"
            >
              Assign strip
            </button>
          </div>
        )}
        {assignments.length > 0 && (
          <div className="space-y-1.5">
            {assignments.map((assignment) => {
              const strip = promptStripLibrary.find((entry) => entry.id === assignment.stripId) || null;
              return (
                <div key={assignment.id} className="rounded border border-panel-border bg-panel-hover/20 px-2 py-1.5 text-[10px] text-slate-300">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-slate-200">{strip?.name || assignment.stripId}</div>
                    <div className="ml-auto flex items-center gap-2">
                      <select
                        value={assignment.mergeMode}
                        onChange={(e) => updatePromptAssignment(assignment.id, { mergeMode: e.target.value as PromptStripMergeMode })}
                        className="bg-black/20 border border-panel-border rounded px-1.5 py-0.5 text-[10px] text-slate-200 outline-none focus:border-blue-500"
                      >
                        {PROMPT_MERGE_MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-[10px] text-slate-400">
                        <input
                          type="checkbox"
                          checked={assignment.enabled}
                          onChange={(e) => updatePromptAssignment(assignment.id, { enabled: e.target.checked })}
                        />
                        enabled
                      </label>
                      <button type="button" onClick={() => removePromptAssignment(assignment.id)} className="text-red-300 hover:text-red-200">Remove</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="rounded-lg border border-panel-border bg-black/10 p-2 text-[10px] text-slate-400 space-y-1">
          <div><strong className="text-slate-200">Local prompt:</strong> {localPrompt.trim() ? 'present' : 'empty'}</div>
          {inheritedGraphAssignments.length > 0 && target.kind !== 'graph' && (
            <div><strong className="text-slate-200">Inherited graph defaults:</strong> {inheritedGraphAssignments.length} assignment{inheritedGraphAssignments.length === 1 ? '' : 's'}</div>
          )}
          <div><strong className="text-slate-200">Resolved preview:</strong></div>
          <pre className="whitespace-pre-wrap break-words text-[10px] text-slate-300" data-testid="prompt-strip-preview">{preview.resolvedPrompt || '— no resolved prompt yet —'}</pre>
        </div>
      </div>
    );
  };

  const ancestorTabs = useMemo(() => resolveAncestorTabs(activeTab, tabs), [activeTab, tabs]);

  const inheritedBindings = useMemo<BindingWithSource[]>(() => {
    if (!activeTab) return [];
    const localNames = new Set(graphBindings.map((b) => b.name));
    const merged = new Map<string, BindingWithSource>();
    [...ancestorTabs].reverse().forEach((ancestor) => {
      (ancestor.graphBindings || []).forEach((binding) => {
        if (!localNames.has(binding.name)) {
          merged.set(binding.name, { ...binding, source: 'inherited' as const, inheritedFrom: ancestor.scopePath || ancestor.projectName });
        }
      });
    });
    return Array.from(merged.values());
  }, [activeTab, ancestorTabs, graphBindings]);

  const localBindings = useMemo<BindingWithSource[]>(
    () => graphBindings.map((b) => ({ ...b, source: 'local' as const })),
    [graphBindings],
  );

  const aiNodes = useMemo(() => {
    return (nodes as { id: string; data: Record<string, unknown> }[])
      .filter((n) => ['llm_chat', 'react_agent', 'sub_agent'].includes(String(n.data.nodeType || '')))
      .map((n) => {
        const params = (n.data.params || {}) as Record<string, unknown>;
        const type = String(n.data.nodeType || '');
        const runtimeMeta = getNodeRuntimeMetaMatrix(type);
        const structuredOutputKey = typeof params.structured_output_key === 'string' && params.structured_output_key.trim()
          ? params.structured_output_key
          : (typeof params.structured_schema_json === 'string' && params.structured_schema_json.trim() ? `${n.id}_data` : '');
        return {
          id: n.id,
          type,
          provider: String(params.provider || '—'),
          model: String(params.model_name || '—'),
          executionGroup: String(params.execution_group || 'main'),
          toolsLinked: Array.isArray(params.tools_linked) ? params.tools_linked.length : 0,
          blockFamily: inferNodeBlockFamily(type, runtimeMeta),
          structuredOutputKey,
        };
      });
  }, [nodes]);

  const providerSummary = useMemo(() => {
    const groups = new Map<string, number>();
    aiNodes.forEach((node) => {
      groups.set(node.provider, (groups.get(node.provider) || 0) + 1);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [aiNodes]);

  const memorySurfaces = useMemo<MemorySurfaceSummary[]>(() => {
    const edgeList = edges as { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }[];
    const liveMemoryMeta = liveState['__memory_meta__'];
    const memoryMeta = liveMemoryMeta && typeof liveMemoryMeta === 'object' && !Array.isArray(liveMemoryMeta)
      ? liveMemoryMeta as Record<string, Record<string, unknown>>
      : {};

    const byId = new Map((nodes as { id: string; data: Record<string, unknown> }[]).map((node) => [node.id, node]));
    const summaries: MemorySurfaceSummary[] = [];

    (nodes as { id: string; data: Record<string, unknown> }[]).forEach((node) => {
      const nodeType = String(node.data.nodeType || '');
      const params = (node.data.params || {}) as Record<string, unknown>;
      const meta = getNodeRuntimeMetaMatrix(nodeType);
      if (!MEMORY_NODE_TYPES.has(nodeType)) return;

      const runtimeMeta = memoryMeta[node.id] || null;
      const outputKey = deriveMemoryOutputKey(nodeType, params);
      const stateKey = deriveMemoryStateKey(nodeType, params);
      const namespaceHint = typeof params.namespace_prefix === 'string' && params.namespace_prefix.trim()
        ? params.namespace_prefix.trim()
        : typeof params.memory_key === 'string' && params.memory_key.trim()
          ? `memory/${params.memory_key.trim()}`
          : undefined;

      const lastUpdatedFromLogs = [...runLogs].reverse().find((entry) => entry.node === node.id)?.timestamp ?? null;
      const runtimeValue = runtimeMeta?.last_entry;
      const stateValue = outputKey ? liveState[outputKey] : undefined;
      const fallbackWritePreview = stateKey ? liveState[stateKey] : undefined;

      summaries.push({
        id: node.id,
        label: typeof node.data.label === 'string' && node.data.label.trim() ? node.data.label : nodeType,
        nodeType,
        blockFamily: inferNodeBlockFamily(nodeType, meta),
        summary: meta.summary || 'Memory surface',
        systemKind: meta.memorySystemKind || 'memory_surface',
        durability: meta.memoryDurability || 'runtime_dependent',
        visibility: meta.memoryVisibility || 'normalized_state_projection',
        role: typeof meta.memoryRole === 'string' ? meta.memoryRole : undefined,
        accessModel: typeof meta.memoryAccessModel === 'string' ? meta.memoryAccessModel : undefined,
        preferredSurface: typeof meta.preferredSurface === 'string' ? meta.preferredSurface : (meta.preferredSurface === true ? 'this_node' : undefined),
        legacyHelperSurface: Boolean(meta.legacyHelperSurface),
        outputKey,
        stateKey,
        namespaceHint,
        lastUpdatedAt: typeof runtimeMeta?.updated_at === 'number' ? Number(runtimeMeta.updated_at) * 1000 : lastUpdatedFromLogs,
        lastEntry: runtimeValue ?? stateValue ?? fallbackWritePreview,
        lastOperation: typeof runtimeMeta?.operation === 'string' ? String(runtimeMeta.operation) : null,
        storeBackend: typeof runtimeMeta?.store_backend === 'string' ? String(runtimeMeta.store_backend) : (activeTab?.runtimeSettings?.storeBackend || null),
        storePath: typeof runtimeMeta?.store_path === 'string' ? String(runtimeMeta.store_path) : (activeTab?.runtimeSettings?.storeBackend === 'sqlite_local' ? activeTab?.runtimeSettings?.storePath || null : null),
        sourceKind: 'memory_node',
      });
    });

    aiNodes.forEach((node) => {
      const sourceLabels = edgeList
        .filter((edge) => edge.target === node.id && edge.targetHandle === 'memory_in')
        .map((edge) => {
          const sourceNode = byId.get(edge.source);
          return typeof sourceNode?.data?.label === 'string' && String(sourceNode.data.label).trim()
            ? String(sourceNode.data.label)
            : edge.source;
        });
      if (sourceLabels.length === 0) return;
      const meta = getNodeRuntimeMetaMatrix(node.type);
      summaries.push({
        id: `${node.id}::memory_consumer`,
        label: `${node.id} memory_in`,
        nodeType: node.type,
        blockFamily: node.blockFamily,
        summary: `${node.type} consumes memory payloads through memory_in rather than a tool call handle.`,
        systemKind: meta.memorySystemKind || 'memory_input_consumer',
        durability: meta.memoryDurability || 'depends_on_upstream_memory_surface',
        visibility: meta.memoryVisibility || 'consumes_memory_input_handle',
        role: typeof meta.memoryRole === 'string' ? meta.memoryRole : 'memory_consumer',
        accessModel: typeof meta.memoryAccessModel === 'string' ? meta.memoryAccessModel : 'graph_memory_input_payload',
        preferredSurface: typeof meta.preferredSurface === 'string' ? meta.preferredSurface : (meta.preferredSurface === true ? 'this_node' : undefined),
        legacyHelperSurface: Boolean(meta.legacyHelperSurface),
        lastUpdatedAt: [...runLogs].reverse().find((entry) => entry.node === node.id)?.timestamp ?? null,
        lastEntry: sourceLabels,
        sourceKind: 'memory_consumer',
        sourceLabels,
        storeBackend: activeTab?.runtimeSettings?.storeBackend || null,
        storePath: activeTab?.runtimeSettings?.storeBackend === 'sqlite_local' ? activeTab?.runtimeSettings?.storePath || null : null,
      });
    });

    return summaries.sort((a, b) => {
      const aLegacy = a.legacyHelperSurface ? 1 : 0;
      const bLegacy = b.legacyHelperSurface ? 1 : 0;
      if (aLegacy !== bLegacy) return aLegacy - bLegacy;
      const aTs = a.lastUpdatedAt || 0;
      const bTs = b.lastUpdatedAt || 0;
      if (aTs !== bTs) return bTs - aTs;
      return a.label.localeCompare(b.label);
    });
  }, [activeTab?.runtimeSettings?.storeBackend, activeTab?.runtimeSettings?.storePath, aiNodes, edges, liveState, nodes, runLogs]);

  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);

  const handleAddSchema = () => {
    updateCustomStateSchema([...schema, { name: 'nouvelle_variable', type: 'str', reducer: 'none' }]);
  };

  const handleUpdateSchema = (index: number, key: string, value: string) => {
    const newSchema = [...schema];
    newSchema[index] = { ...newSchema[index], [key]: value };
    updateCustomStateSchema(newSchema);
  };

  const handleRemoveSchema = (index: number) => {
    updateCustomStateSchema(schema.filter((_, i) => i !== index));
  };

  const updateBindingAt = (index: number, patch: Partial<GraphBinding>) => {
    const updated = graphBindings.map((binding, i) => (i === index ? { ...binding, ...patch } : binding));
    updateGraphBindings(updated);
  };

  const removeBindingAt = (index: number) => {
    updateGraphBindings(graphBindings.filter((_, i) => i !== index));
  };

  const addBinding = (kind: 'variable' | 'constant') => {
    updateGraphBindings([...graphBindings, { name: kind === 'constant' ? 'NEW_CONST' : 'new_var', value: '', kind }]);
  };


  const updateSubagentLibrary = (nextLibrary: typeof subagentLibrary) => {
    updateRuntimeSettings({ subagentLibrary: nextLibrary });
  };
  const runtimeContextEntries = activeTab?.runtimeSettings?.runtimeContext || [];

  const updateRuntimeContextEntries = (nextEntries: typeof runtimeContextEntries) => {
    updateRuntimeSettings({ runtimeContext: nextEntries });
  };

  const addRuntimeContextEntry = () => {
    updateRuntimeContextEntries([...runtimeContextEntries, { key: `context_${runtimeContextEntries.length + 1}`, value: '' }]);
  };

  const updateRuntimeContextEntry = (index: number, patch: Partial<{ key: string; value: string }>) => {
    updateRuntimeContextEntries(runtimeContextEntries.map((entry, i) => i === index ? { ...entry, ...patch } : entry));
  };

  const removeRuntimeContextEntry = (index: number) => {
    updateRuntimeContextEntries(runtimeContextEntries.filter((_, i) => i !== index));
  };


  const insertSubagentToolBlock = (groupName: string, agentName = '') => {
    const offset = nodes.length * 28;
    const nodeId = addNodeWithParams('tool_sub_agent', { x: 180 + offset, y: 140 + offset }, {
      target_group: groupName || 'default',
      target_agent: agentName,
      description: agentName
        ? `Appelle le sous-agent ${agentName} du groupe ${groupName || 'default'}.`
        : `Dispatch borné sur le groupe ${groupName || 'default'}.`,
    });
    if (nodeId) selectNodesByIds([nodeId]);
  };

  const addSubagentGroup = () => {
    const name = window.prompt('Nom du groupe de sous-agents', subagentLibrary.length === 0 ? 'default' : `group_${subagentLibrary.length + 1}`)?.trim();
    if (!name) return;
    if (subagentLibrary.some((group) => group.name === name)) return;
    updateSubagentLibrary([...subagentLibrary, { name, agents: [] }]);
  };

  const removeSubagentGroup = (groupName: string) => {
    updateSubagentLibrary(subagentLibrary.filter((group) => group.name !== groupName));
  };

  const addSubagentToGroup = (groupName: string) => {
    const agentName = window.prompt('Nom du sous-agent', 'subagent_1')?.trim();
    if (!agentName) return;
    updateSubagentLibrary(subagentLibrary.map((group) => {
      if (group.name !== groupName) return group;
      if (group.agents.some((agent) => agent.name === agentName)) return group;
      return { ...group, agents: [...group.agents, { name: agentName, systemPrompt: '', tools: [], description: '' }] };
    }));
  };

  const updateSubagentEntry = (groupName: string, agentName: string, patch: Record<string, unknown>) => {
    updateSubagentLibrary(subagentLibrary.map((group) => {
      if (group.name !== groupName) return group;
      return {
        ...group,
        agents: group.agents.map((agent) => agent.name !== agentName ? agent : { ...agent, ...patch }),
      };
    }));
  };

  const removeSubagentEntry = (groupName: string, agentName: string) => {
    updateSubagentLibrary(subagentLibrary.map((group) => {
      if (group.name !== groupName) return group;
      return { ...group, agents: group.agents.filter((agent) => agent.name !== agentName) };
    }));
  };

  const publishCurrentArtifact = async () => {
    if (!activeTab) return;
    setPublishing(true);
    setPublishMessage(null);
    try {
      await saveArtifactManifest({
        kind: activeTab.artifactType,
        title: activeTab.projectName,
        description: `${activeTab.artifactType} enregistré depuis l'éditeur`,
        artifact: {
          name: activeTab.projectName,
          nodes: activeTab.nodes,
          edges: activeTab.edges,
          customStateSchema: activeTab.customStateSchema,
          graphBindings: activeTab.graphBindings,
          isAsync: activeTab.isAsync,
          artifactType: activeTab.artifactType,
          executionProfile: activeTab.executionProfile,
          projectMode: activeTab.projectMode,
          runtimeSettings: activeTab.runtimeSettings,
        },
      });
      setPublishMessage('Artefact enregistré dans la bibliothèque.');
    } catch (err) {
      console.error('Failed to publish artifact', err);
      setPublishMessage('Échec de publication dans la bibliothèque.');
    } finally {
      setPublishing(false);
    }
  };

  const simpleMode = editorMode === 'simple';
  const activeSurfaceTruth = useMemo(() => buildSurfaceTruthSummary({ artifactType: activeTab?.artifactType || 'graph', executionProfile: activeTab?.executionProfile || 'langgraph_async', projectMode: activeTab?.projectMode || 'langgraph' }), [activeTab?.artifactType, activeTab?.executionProfile, activeTab?.projectMode]);
  const publishEffectSummary = useMemo(() => describeArtifactSaveEffect(activeSurfaceTruth), [activeSurfaceTruth]);

  return (
    <>
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-panel-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Database size={13} className="text-amber-400 shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 truncate">
              {projectName || 'Variables'}
            </span>
            <span className="text-[9px] text-slate-600">
              {simpleMode ? 'Variables, état et exécution utile' : 'État, scope et runtime'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2.5 space-y-2.5 scrollbar-thin">
        {simpleMode ? (
          <>
            {showNonDefaultRailNotice && (
              <div className="px-1 text-[11px] text-amber-300/90">
                Advanced or imported rail loaded: {activeTab?.artifactType} / {activeTab?.executionProfile}. Execution still depends on the current LangGraph trunk unless a rail explicitly proves more.
              </div>
            )}

            <Section title="Vue rapide" icon={Workflow}>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <button
                  onClick={() => setIsAsync(!isAsync)}
                  className="p-1.5 rounded-lg bg-panel-hover/30 border border-panel-border text-left hover:bg-panel-hover/50 transition-all"
                >
                  <div className="text-slate-500 text-[10px] uppercase mb-1">Mode LangGraph</div>
                  <div className={`font-medium ${isAsync ? 'text-emerald-300' : 'text-amber-300'}`}>{isAsync ? 'Async' : 'Sync'}</div>
                  <div className="text-slate-500 mt-1">Basculer rapidement</div>
                </button>
                <div className="p-1.5 rounded-lg bg-black/20 border border-panel-border">
                  <div className="text-slate-500 text-[10px] uppercase mb-1">Profil d'exécution</div>
                  <div className="text-slate-200 font-medium">{activeTab?.executionProfile || (isAsync ? 'langgraph_async' : 'langgraph_sync')}</div>
                  <div className="text-slate-500 mt-1">stream {activeTab?.runtimeSettings?.streamMode || 'updates'} · recursion {activeTab?.runtimeSettings?.recursionLimit ?? 50}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="p-1.5 rounded-lg bg-black/20 border border-panel-border">
                  <div className="text-slate-500 text-[10px] uppercase mb-1">Variables d'état</div>
                  <div className="text-slate-200 font-medium">{schema.length}</div>
                </div>
                <div className="p-1.5 rounded-lg bg-black/20 border border-panel-border">
                  <div className="text-slate-500 text-[10px] uppercase mb-1">Bindings</div>
                  <div className="text-slate-200 font-medium">{localBindings.length + inheritedBindings.length}</div>
                </div>
                <div className="p-1.5 rounded-lg bg-black/20 border border-panel-border">
                  <div className="text-slate-500 text-[10px] uppercase mb-1">Nœuds IA</div>
                  <div className="text-slate-200 font-medium">{aiNodes.length}</div>
                </div>
              </div>
            </Section>

            <Section title="Variables détectées" icon={Eye} count={detectedKeys.length} defaultOpen={detectedKeys.length <= 6}>
              {detectedKeys.length === 0 ? (
                <p className="text-[10px] text-slate-600 py-1">Aucun nœud dans le graphe</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {detectedKeys.map((key) => (
                    <span key={key} className="px-2 py-1 rounded-full text-[11px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/20">
                      {key}
                    </span>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Mémoires actives" icon={Database} count={memorySurfaces.length} defaultOpen={memorySurfaces.length > 0}>
              <MemorySurfaceList memorySurfaces={memorySurfaces} />
            </Section>

            <Section title="Schéma personnalisé" icon={Database} count={schema.length} defaultOpen={schema.length > 0}>
              <div className="space-y-2">
                {schema.map((v, i) => (
                  <div key={i} className="p-2 bg-panel-hover/30 rounded-lg border border-panel-border space-y-1.5 relative group">
                    <button
                      onClick={() => handleRemoveSchema(i)}
                      className="absolute top-2 right-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                    <div className="flex flex-col gap-1 text-xs">
                      <label className="text-slate-500 text-[10px]">Nom</label>
                      <input type="text" value={v.name} onChange={(e) => handleUpdateSchema(i, 'name', e.target.value)} className="bg-black/20 border border-panel-border rounded px-2 py-1 text-emerald-300 text-[11px] outline-none focus:border-blue-500" />
                    </div>
                    <div className="flex gap-2 text-xs">
                      <div className="flex flex-col gap-1 w-1/2">
                        <label className="text-slate-500 text-[10px]">Type</label>
                        <select value={v.type} onChange={(e) => handleUpdateSchema(i, 'type', e.target.value)} className="bg-black/20 border border-panel-border rounded px-2 py-1 text-slate-200 text-[11px] outline-none focus:border-blue-500">
                          <option value="str">String</option>
                          <option value="int">Integer</option>
                          <option value="list">List</option>
                          <option value="dict">Dictionary</option>
                          <option value="bool">Boolean</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1 w-1/2">
                        <label className="text-slate-500 text-[10px]">Reducer</label>
                        <select value={v.reducer} onChange={(e) => handleUpdateSchema(i, 'reducer', e.target.value)} className="bg-black/20 border border-panel-border rounded px-2 py-1 text-slate-200 text-[11px] outline-none focus:border-blue-500">
                          <option value="none">Écrase</option>
                          <option value="operator.add">Ajoute</option>
                          <option value="add_messages">Messages</option>
                          <option value="update">Mise à jour</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={handleAddSchema} className="w-full mt-1.5 py-1.5 border border-dashed border-panel-border text-slate-400 hover:text-white hover:bg-panel-hover rounded-lg flex items-center justify-center gap-2 text-xs transition-all">
                <Plus size={12} /> Ajouter une variable d'état
              </button>
            </Section>

            <Section title="Bindings du graphe" icon={Boxes} count={localBindings.length + inheritedBindings.length} defaultOpen={localBindings.length + inheritedBindings.length > 0}>
              <div className="flex gap-2">
                <button onClick={() => addBinding('variable')} className="flex-1 py-1.5 rounded-lg border border-dashed border-panel-border text-[11px] text-slate-300 hover:bg-panel-hover transition-all flex items-center justify-center gap-1">
                  <Plus size={11} /> Variable locale
                </button>
                <button onClick={() => addBinding('constant')} className="flex-1 py-1.5 rounded-lg border border-dashed border-panel-border text-[11px] text-slate-300 hover:bg-panel-hover transition-all flex items-center justify-center gap-1">
                  <Plus size={11} /> Constante locale
                </button>
              </div>

              <div className="space-y-2">
                {localBindings.map((binding, i) => (
                  <div key={`local-${i}`} className="p-2 bg-panel-hover/30 rounded-lg border border-panel-border space-y-1.5 relative group">
                    <button
                      onClick={() => removeBindingAt(i)}
                      className="absolute top-2 right-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide">
                      <span className={`px-1.5 py-0.5 rounded ${binding.kind === 'constant' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{binding.kind}</span>
                      <span className="text-slate-500">local</span>
                    </div>
                    <div className="grid grid-cols-[1fr_110px] gap-2">
                      <input
                        type="text"
                        value={binding.name}
                        onChange={(e) => updateBindingAt(i, { name: e.target.value })}
                        className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                        placeholder="nom"
                      />
                      <select
                        value={binding.kind}
                        onChange={(e) => updateBindingAt(i, { kind: e.target.value as 'variable' | 'constant' })}
                        className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                      >
                        <option value="variable">variable</option>
                        <option value="constant">constant</option>
                      </select>
                    </div>
                    <textarea
                      value={binding.value}
                      onChange={(e) => updateBindingAt(i, { value: e.target.value })}
                      className="w-full bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                      rows={2}
                      placeholder="valeur, JSON, texte, etc."
                    />
                  </div>
                ))}

                {inheritedBindings.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">Hérités du parent ouvert</div>
                    {inheritedBindings.map((binding, i) => (
                      <div key={`inherited-${i}`} className="p-2 rounded-lg bg-black/20 border border-panel-border/70">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide mb-1">
                          <span className={`px-1.5 py-0.5 rounded ${binding.kind === 'constant' ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{binding.kind}</span>
                          <span className="text-slate-500">hérité</span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-200">{binding.name}</div>
                        <div className="text-[10px] text-slate-600">depuis {binding.inheritedFrom || 'parent'}</div>
                        <div className="text-[11px] text-slate-500 break-words">{binding.value || '∅'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>


            <Section title="Chemin d'exécution" icon={Workflow} count={executionTimeline.steps.length} defaultOpen={executionTimeline.steps.length > 0 && executionTimeline.steps.length <= 6}>
              {executionTimeline.steps.length === 0 ? (
                <div className="text-[10px] text-slate-600">Aucune exécution observée pour ce scope.</div>
              ) : (
                <div className="space-y-2" data-testid="state-execution-path">
                  <div className="flex flex-wrap gap-1.5">
                    {executionTimeline.steps.slice(-6).map((step) => {
                      const isLocked = runtimeNavigationSettings.lockHover && runtimeHoverTarget?.nodeId === step.nodeId;
                      return (
                      <span key={`${step.order}-${step.nodeId}`} className="inline-flex items-center gap-1">
                        <button onClick={() => requestRuntimeFocus(step.nodeId, 'state')} onDoubleClick={() => lockRuntimeNode(step.nodeId)} onMouseEnter={() => setRuntimeHoverTarget(step.nodeId, 'state')} onMouseLeave={() => { if (!runtimeNavigationSettings.lockHover) clearRuntimeHoverTarget('state', step.nodeId); }} className={`px-2 py-1 rounded-full text-[10px] border transition-all ${runtimeHoverTarget?.nodeId === step.nodeId ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200' : 'border-panel-border bg-black/20 text-slate-300 hover:bg-panel-hover'}`} data-testid="state-focus-step">
                          <span className="text-cyan-300">{step.order}</span> #{step.nodeId}{isLocked ? ' · locked' : ''}
                        </button>
                        <RuntimeChipLockButton nodeId={step.nodeId} locked={isLocked} onLockNode={lockRuntimeNode} onUnlockNode={unlockRuntimeNode} />
                      </span>
                    );})}
                  </div>
                  {executionTimeline.scheduledNodeIds.length > 0 && (
                    <div className="text-[10px] text-amber-300 flex flex-wrap items-center gap-1.5">Prévu ensuite : {executionTimeline.scheduledNodeIds.map((nodeId) => {
                      const isLocked = runtimeNavigationSettings.lockHover && runtimeHoverTarget?.nodeId === nodeId;
                      return (<span key={nodeId} className="inline-flex items-center gap-1"><button onClick={() => requestRuntimeFocus(nodeId, 'state')} onDoubleClick={() => lockRuntimeNode(nodeId)} onMouseEnter={() => setRuntimeHoverTarget(nodeId, 'state')} onMouseLeave={() => { if (!runtimeNavigationSettings.lockHover) clearRuntimeHoverTarget('state', nodeId); }} className={`px-1.5 py-0.5 rounded border text-[10px] font-mono transition-all ${runtimeHoverTarget?.nodeId === nodeId ? 'border-amber-400/40 bg-amber-500/20 text-amber-200' : 'border-amber-500/20 text-amber-300 bg-amber-500/10 hover:bg-amber-500/15'}`} data-testid="state-focus-scheduled">#{nodeId}</button><RuntimeChipLockButton nodeId={nodeId} locked={isLocked} onLockNode={lockRuntimeNode} onUnlockNode={unlockRuntimeNode} /></span>);
                    })}</div>
                  )}
                  <div className="text-[10px] text-slate-500">Edges mis en avant: {executionTimeline.emphasisedEdgeIds.length}</div>
                </div>
              )}
            </Section>

            {liveState && typeof liveState['__fanout_meta__'] === 'object' && liveState['__fanout_meta__'] !== null && !Array.isArray(liveState['__fanout_meta__']) && (
              <Section title="Fanout runtime" icon={Workflow} defaultOpen={false}>
                <div className="p-2 rounded-lg bg-black/20 border border-panel-border text-[11px] text-slate-300 space-y-1">
                  {typeof (liveState['__fanout_meta__'] as Record<string, unknown>).source_node === 'string' && <div>Source: <span className="text-sky-300 font-mono">{String((liveState['__fanout_meta__'] as Record<string, unknown>).source_node)}</span></div>}
                  {typeof (liveState['__fanout_meta__'] as Record<string, unknown>).index === 'number' && <div>Worker index: <span className="text-slate-100">{Number((liveState['__fanout_meta__'] as Record<string, unknown>).index)}</span></div>}
                  {typeof (liveState['__fanout_meta__'] as Record<string, unknown>).items_key === 'string' && <div>Items key: <span className="text-slate-100">{String((liveState['__fanout_meta__'] as Record<string, unknown>).items_key)}</span></div>}
                </div>
              </Section>
            )}

            <Section title="Nœuds IA" icon={Cpu} count={aiNodes.length} defaultOpen={false}>
              <div className="flex flex-wrap gap-1.5 pb-1">
                {providerSummary.map(([provider, count]) => (
                  <span key={provider} className="px-2 py-1 rounded-full text-[10px] text-blue-300 bg-blue-500/10 border border-blue-500/20">
                    {provider} · {count}
                  </span>
                ))}
              </div>
              <div className="space-y-2">
                {aiNodes.map((node) => (
                  <div key={node.id} className="p-2 rounded-lg bg-black/20 border border-panel-border text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-slate-200">{node.id}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 uppercase">{node.type}</span>
                        <span className={`px-1.5 py-0.5 rounded border text-[10px] ${BLOCK_FAMILY_BADGE_CLASSES[node.blockFamily]}`}>{BLOCK_FAMILY_LABELS[node.blockFamily]}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-1 text-slate-400">
                      <div>Provider: <span className="text-slate-200">{node.provider}</span></div>
                      <div>Model: <span className="text-slate-200">{node.model}</span></div>
                      <div>Groupe: <span className="text-slate-200">{node.executionGroup}</span></div>
                      <div>Tools: <span className="text-slate-200">{node.toolsLinked}</span></div>
                      <div>Structured: <span className="text-slate-200">{node.structuredOutputKey || '—'}</span></div>
                    </div>
                  </div>
                ))}
                {aiNodes.length === 0 && <div className="text-[10px] text-slate-600">Aucun nœud IA dans ce scope.</div>}
              </div>
            </Section>

            <div className="rounded-lg border border-panel-border bg-black/10 p-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] text-slate-300 font-medium">Réglages avancés</div>
                  <div className="text-[10px] text-slate-500">Scope, profil runtime, publication d’artefact et paramètres détaillés.</div>
                </div>
                <button
                  onClick={() => setShowAdvancedTools((v) => !v)}
                  className="px-2 py-1 rounded border border-panel-border text-[11px] text-slate-300 hover:bg-panel-hover transition-all"
                >
                  {showAdvancedTools ? 'Masquer' : 'Afficher'}
                </button>
              </div>
            </div>

            {showAdvancedTools && (
              <>
                <Section title="Scope & exécution" icon={Workflow}>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-panel-hover/30 border border-panel-border">
                      <div className="text-slate-500 text-[10px] uppercase mb-1">Scope</div>
                      <div className="text-slate-200 font-medium">{activeTab?.scopeKind === 'subgraph' ? 'Subgraph' : 'Graph'}</div>
                      <div className="text-slate-500 mt-1 font-mono break-all">{activeTab?.scopePath || '—'}</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-black/20 border border-panel-border">
                      <div className="text-slate-500 text-[10px] uppercase mb-1">Identité runtime</div>
                      <div className="font-mono text-slate-300 break-all">{activeTab?.projectId || 'local-only'}</div>
                      <div className="text-slate-500 mt-1 break-all">parent: {activeTab?.parentNodeId || '—'}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-500 text-[10px] uppercase">Type d'artefact</label>
                      <select
                        value={activeTab?.artifactType || 'graph'}
                        onChange={(e) => updateArtifactType(e.target.value as ArtifactType)}
                        className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                      >
                        {artifactOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-500 text-[10px] uppercase">Profil runtime</label>
                      <select
                        value={activeTab?.executionProfile || (isAsync ? 'langgraph_async' : 'langgraph_sync')}
                        onChange={(e) => updateExecutionProfile(e.target.value as ExecutionProfile)}
                        className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                      >
                        {profileOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </Section>

                <Section title="Paramètres d'exécution" icon={Workflow}>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-500 text-[10px] uppercase">Recursion limit</label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={activeTab?.runtimeSettings?.recursionLimit ?? 50}
                        onChange={(e) => updateRuntimeSettings({ recursionLimit: Number(e.target.value || 50) })}
                        className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-500 text-[10px] uppercase">Stream mode</label>
                      <select
                        value={activeTab?.runtimeSettings?.streamMode || 'updates'}
                        onChange={(e) => updateRuntimeSettings({ streamMode: e.target.value as 'updates' | 'values' | 'debug' })}
                        className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                      >
                        <option value="updates">updates</option>
                        <option value="values">values</option>
                        <option value="debug">debug</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-[11px]">
                    <label className="flex items-start gap-2 p-2 rounded-lg bg-black/20 border border-panel-border text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(activeTab?.runtimeSettings?.checkpointEnabled)}
                        onChange={(e) => updateRuntimeSettings({ checkpointEnabled: e.target.checked })}
                      />
                      <span>
                        <span className="font-medium text-slate-200">Checkpointing du graphe</span>
                        <span className="block mt-0.5 text-[10px] text-slate-500">Active un checkpointer au compile. LangGraph sauvegarde alors un snapshot d'état à chaque super-step pour le thread courant.</span>
                      </span>
                    </label>
                    {graphValidation?.graphScopeMarkerIds?.size ? (
                      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2 py-1.5 text-[10px] text-cyan-200">
                        {graphValidation.graphScopeMarkerIds.size} marker(s) memory_checkpoint hérités restent présents dans le graphe. Ils agissent comme des marqueurs de portée graphe et n'ont pas besoin d'arêtes.
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-500 text-[10px] uppercase">Store backend</label>
                      <select
                        value={activeTab?.runtimeSettings?.storeBackend || 'in_memory'}
                        onChange={(e) => updateRuntimeSettings({ storeBackend: e.target.value as 'in_memory' | 'sqlite_local' })}
                        className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                      >
                        <option value="in_memory">in-memory</option>
                        <option value="sqlite_local">sqlite local</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-500 text-[10px] uppercase">Store path</label>
                      <input
                        type="text"
                        value={activeTab?.runtimeSettings?.storePath || 'runtime_store.db'}
                        onChange={(e) => updateRuntimeSettings({ storePath: e.target.value || 'runtime_store.db' })}
                        disabled={(activeTab?.runtimeSettings?.storeBackend || 'in_memory') !== 'sqlite_local'}
                        className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 text-[11px]">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-500 text-[10px] uppercase">Runtime context</label>
                      <button
                        type="button"
                        onClick={addRuntimeContextEntry}
                        className="px-2 py-0.5 rounded border border-panel-border text-slate-300 hover:bg-white/5"
                      >
                        + Ajouter
                      </button>
                    </div>
                    {runtimeContextEntries.length === 0 ? (
                      <div className="rounded-lg border border-panel-border bg-black/20 px-2 py-1.5 text-[10px] text-slate-500">Aucune entrée de contexte runtime. Les nœuds <code>runtime_context_read</code> liront ce contexte à l'exécution.</div>
                    ) : (
                      <div className="space-y-2">
                        {runtimeContextEntries.map((entry, index) => (
                          <div key={`${entry.key}-${index}`} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center">
                            <input
                              type="text"
                              value={entry.key}
                              onChange={(e) => updateRuntimeContextEntry(index, { key: e.target.value })}
                              placeholder="user_id"
                              className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                            />
                            <input
                              type="text"
                              value={entry.value}
                              onChange={(e) => updateRuntimeContextEntry(index, { value: e.target.value })}
                              placeholder="42"
                              className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => removeRuntimeContextEntry(index)}
                              className="px-2 py-1 rounded border border-panel-border text-slate-300 hover:bg-white/5"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-black/20 border border-panel-border text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(activeTab?.runtimeSettings?.inheritParentBindings)}
                        onChange={(e) => updateRuntimeSettings({ inheritParentBindings: e.target.checked })}
                      />
                      Hériter les bindings du parent
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-black/20 border border-panel-border text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(activeTab?.runtimeSettings?.debug)}
                        onChange={(e) => updateRuntimeSettings({ debug: e.target.checked })}
                      />
                      Debug runtime étendu
                    </label>
                  </div>
                </Section>

                <Section title="Module Library" icon={PackagePlus} count={moduleLibrary.length} defaultOpen={moduleLibrary.length > 0}>
                  <div className="rounded-lg border border-panel-border bg-black/20 p-2 text-[11px] text-slate-400 leading-5" data-testid="module-library-phase1">
                    Workspace-owned <strong>bounded bundles</strong> of authoring assets. Phase 2 modules can now package <strong>prompt strips</strong>, <strong>subagent groups</strong>, <strong>runtime context</strong>, <strong>starter references</strong>, and <strong>graph/subagent prompt-assignment presets</strong>. They can also carry <strong>branch/profile metadata</strong> so main can stay generic while a future domain branch (for example a tabletop RPG demo) adds overlays without forking the runtime model. Loading still merges assets additively into the current workspace and materializes only the module&apos;s bounded prompt presets for the active tab. This is <strong>not yet</strong> a general plugin system, a separate runtime, or artifact/module publishing.
                  </div>
                  <div className="rounded-lg border border-panel-border bg-black/10 px-2 py-1.5 text-[10px] text-slate-500 leading-5">
                    Current load semantics stay explicit and non-destructive: loading a module merges missing assets into the workspace and records that the module was loaded once for this workspace. Starter references are descriptive only in phase 2: they help modules point to recommended artifacts or scenario starters, but they do not auto-open, auto-install, or mutate the host environment. Prompt-assignment presets are limited to <strong>graph defaults</strong> and <strong>subagent targets</strong>; node-target presets remain outside this phase. Branch metadata is advisory in v94: it helps trunk and a future demo/domain branch stay retro-compatible without adding a new runtime rail.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => addModuleLibraryEntry({ promptStrips: [], promptAssignments: [], subagentGroups: [], starterArtifacts: [], runtimeContext: [] } as Partial<ModuleLibraryEntry>)} className="px-2 py-1.5 rounded-lg border border-dashed border-panel-border text-[11px] text-slate-300 hover:bg-panel-hover transition-all flex items-center gap-1">
                      <Plus size={11} /> Nouveau module
                    </button>
                    <button onClick={() => addModuleLibraryEntry({ name: `Captured Module ${moduleLibrary.length + 1}` })} disabled={!activeTab} className="px-2 py-1.5 rounded-lg border border-panel-border text-[11px] text-slate-300 hover:bg-panel-hover transition-all flex items-center gap-1 disabled:opacity-50">
                      <PackagePlus size={11} /> Capturer les assets courants
                    </button>
                  </div>
                  {moduleLibrary.length === 0 ? (
                    <div className="text-[10px] text-slate-500">Aucun module défini. Phase 2 vise des bundles réutilisables de prompts, sous-agents, presets d&apos;assignation et starter refs — utiles plus tard pour des univers, règles, cast lists, persona packs ou kits de démonstration.</div>
                  ) : (
                    <div className="space-y-2">
                      {moduleLibrary.map((entry) => {
                        const isLoaded = loadedModuleIds.includes(entry.id);
                        return (
                          <div key={entry.id} className="rounded-lg border border-panel-border bg-black/20 p-2 space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={entry.name}
                                onChange={(e) => updateModuleEntry(entry.id, { name: e.target.value })}
                                className="flex-1 bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                              />
                              {isLoaded && <span className="px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-200">loaded</span>}
                              <button type="button" onClick={() => removeModuleEntry(entry.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={12} /></button>
                            </div>
                            <input
                              type="text"
                              value={entry.description || ''}
                              onChange={(e) => updateModuleEntry(entry.id, { description: e.target.value })}
                              placeholder="Description courte"
                              className="w-full bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                value={entry.category}
                                onChange={(e) => updateModuleEntry(entry.id, { category: e.target.value as ModuleLibraryCategory })}
                                className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                              >
                                {MODULE_CATEGORY_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={Array.isArray(entry.tags) ? entry.tags.join(', ') : ''}
                                onChange={(e) => updateModuleEntry(entry.id, { tags: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })}
                                placeholder="tags (comma separated)"
                                className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                value={entry.lineage || 'shared'}
                                onChange={(e) => updateModuleEntry(entry.id, { lineage: e.target.value as ModuleLibraryLineage })}
                                className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                              >
                                {MODULE_LINEAGE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={Array.isArray(entry.branchTargets) ? entry.branchTargets.join(', ') : ''}
                                onChange={(e) => updateModuleEntry(entry.id, { branchTargets: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })}
                                placeholder="branch targets (main, jdr_demo)"
                                className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={entry.recommendedProfile || ''}
                                onChange={(e) => updateModuleEntry(entry.id, { recommendedProfile: e.target.value })}
                                placeholder="recommended profile (optional)"
                                className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                              />
                              <input
                                type="text"
                                value={Array.isArray(entry.themeHints) ? entry.themeHints.join(', ') : ''}
                                onChange={(e) => updateModuleEntry(entry.id, { themeHints: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })}
                                placeholder="theme hints (paper, fantasy, noir)"
                                className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                              />
                            </div>
                            <textarea
                              value={entry.compatibilityNotes || ''}
                              onChange={(e) => updateModuleEntry(entry.id, { compatibilityNotes: e.target.value })}
                              placeholder="Compatibility notes for trunk / future domain branches"
                              rows={2}
                              className="w-full bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                            />
                            <div className="flex flex-wrap gap-1 text-[10px]">
                              <span className="px-1.5 py-0.5 rounded border border-panel-border text-slate-300">category: {entry.category}</span>
                              <span className="px-1.5 py-0.5 rounded border border-panel-border text-slate-300">lineage: {entry.lineage || 'shared'}</span>
                              <span className="px-1.5 py-0.5 rounded border border-panel-border text-slate-300">prompt strips: {entry.promptStrips.length}</span>
                              <span className="px-1.5 py-0.5 rounded border border-panel-border text-slate-300">subagent groups: {entry.subagentGroups.length}</span>
                              <span className="px-1.5 py-0.5 rounded border border-panel-border text-slate-300">prompt presets: {entry.promptAssignments.length}</span>
                              <span className="px-1.5 py-0.5 rounded border border-panel-border text-slate-300">starter refs: {entry.starterArtifacts.length}</span>
                              <span className="px-1.5 py-0.5 rounded border border-panel-border text-slate-300">runtime context: {entry.runtimeContext.length}</span>
                              {entry.tags.map((tag) => <span key={tag} className="px-1.5 py-0.5 rounded border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">#{tag}</span>)}
                              {(entry.branchTargets || []).map((tag) => <span key={`branch-${tag}`} className="px-1.5 py-0.5 rounded border border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-200">branch:{tag}</span>)}
                              {(entry.themeHints || []).map((tag) => <span key={`theme-${tag}`} className="px-1.5 py-0.5 rounded border border-amber-500/20 bg-amber-500/10 text-amber-200">theme:{tag}</span>)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Contains prompt strips: {entry.promptStrips.slice(0, 3).map((item) => item.name).join(', ') || '—'} · subagent groups: {entry.subagentGroups.slice(0, 3).map((item) => item.name).join(', ') || '—'} · prompt presets: {entry.promptAssignments.slice(0, 3).map((item) => item.targetKind === 'graph' ? `${item.stripId}→graph` : `${item.stripId}→${item.groupName}/${item.agentName}`).join(', ') || '—'} · profile: {entry.recommendedProfile || '—'}
                            </div>
                            <div className="rounded-lg border border-panel-border bg-black/10 p-2 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-[10px] text-slate-400">Starter references (descriptive only in phase 2)</div>
                                <button onClick={() => addStarterArtifactRefToModule(entry.id)} className="px-2 py-1 rounded border border-panel-border text-[10px] text-slate-200 hover:bg-panel-hover">Ajouter un starter ref</button>
                              </div>
                              {(entry.starterArtifacts || []).length === 0 ? (
                                <div className="text-[10px] text-slate-500">No starter refs yet. Use these to point at recommended artifacts, scene starters, or bounded templates without auto-opening them.</div>
                              ) : (
                                <div className="space-y-2">
                                  {(entry.starterArtifacts || []).map((ref, refIndex) => (
                                    <div key={`${entry.id}-starter-${refIndex}`} className="grid grid-cols-12 gap-2 items-center">
                                      <input value={ref.artifactKind || 'graph'} onChange={(e) => updateStarterArtifactRef(entry.id, refIndex, { artifactKind: e.target.value })} className="col-span-2 bg-black/20 border border-panel-border rounded px-2 py-1 text-[10px] text-slate-200 outline-none focus:border-blue-500" placeholder="kind" />
                                      <input value={ref.artifactId} onChange={(e) => updateStarterArtifactRef(entry.id, refIndex, { artifactId: e.target.value })} className="col-span-4 bg-black/20 border border-panel-border rounded px-2 py-1 text-[10px] text-slate-200 outline-none focus:border-blue-500" placeholder="artifact id" />
                                      <input value={ref.label || ''} onChange={(e) => updateStarterArtifactRef(entry.id, refIndex, { label: e.target.value })} className="col-span-3 bg-black/20 border border-panel-border rounded px-2 py-1 text-[10px] text-slate-200 outline-none focus:border-blue-500" placeholder="label" />
                                      <input value={ref.description || ''} onChange={(e) => updateStarterArtifactRef(entry.id, refIndex, { description: e.target.value })} className="col-span-2 bg-black/20 border border-panel-border rounded px-2 py-1 text-[10px] text-slate-200 outline-none focus:border-blue-500" placeholder="note" />
                                      <button type="button" onClick={() => removeStarterArtifactRef(entry.id, refIndex)} className="col-span-1 text-slate-500 hover:text-red-400"><Trash2 size={12} /></button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            {entry.compatibilityNotes ? (
                              <div className="rounded-lg border border-panel-border bg-black/10 p-2 text-[10px] text-slate-400 leading-5">
                                <strong className="text-slate-200">Compatibility:</strong> {entry.compatibilityNotes}
                              </div>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                              <button onClick={() => captureCurrentAssetsIntoModule(entry.id)} className="px-2 py-1 rounded border border-panel-border text-[10px] text-slate-200 hover:bg-panel-hover">Recapturer depuis le workspace</button>
                              <button onClick={() => loadModuleIntoWorkspace(entry.id)} className="px-2 py-1 rounded border border-emerald-500/20 text-[10px] text-emerald-200 hover:bg-emerald-500/10">Charger dans le workspace</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Section>

                <Section title="Prompt Strips" icon={BookOpen} count={promptStripLibrary.length} defaultOpen={promptStripLibrary.length > 0}>
                  <div className="rounded-lg border border-panel-border bg-black/20 p-2 text-[11px] text-slate-400 leading-5" data-testid="prompt-strip-library-phase1">
                    Workspace-owned reusable prompt assets with <strong>explicit assignments</strong>. Phase 2 now resolves graph defaults plus node/subagent-local prompt strips on supported prompt-bearing surfaces during compile/runtime, while project save/open and package import/export still preserve them as authoring data. Artifact publishing and broader prompt-surface propagation are <strong>not yet active</strong>.
                  </div>
                  {livePromptStripMeta && (
                    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2 text-[11px] text-slate-300 leading-5" data-testid="prompt-strip-runtime-provenance">
                      <div><strong className="text-slate-100">Compiled/runtime provenance:</strong> prompt-strip resolution metadata is now exported into <code>__prompt_strip_meta__</code> during compile/bootstrap so runtime state can show which graph defaults and local assignments shaped supported prompt-bearing surfaces.</div>
                      {typeof (livePromptStripMeta.graph as Record<string, unknown> | undefined)?.graphAssignmentCount === 'number' && (
                        <div className="mt-1 text-slate-400">Graph defaults currently resolved at runtime: {Number((livePromptStripMeta.graph as Record<string, unknown>).graphAssignmentCount)} assignment(s).</div>
                      )}
                      {selectedNodeRuntimePromptMeta && (
                        <div className="mt-1 text-slate-400">Selected node provenance: {Number(selectedNodeRuntimePromptMeta.localAssignmentCount || 0)} local assignment(s), {Number(selectedNodeRuntimePromptMeta.graphAssignmentCount || 0)} inherited graph assignment(s), preview length {Number(selectedNodeRuntimePromptMeta.resolvedPromptLength || 0)}.</div>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => addPromptStrip()} className="px-2 py-1.5 rounded-lg border border-dashed border-panel-border text-[11px] text-slate-300 hover:bg-panel-hover transition-all flex items-center gap-1">
                      <Plus size={11} /> Nouveau strip
                    </button>
                    <button
                      onClick={addPromptStripFromSelectedNode}
                      disabled={!selectedPromptNode || !selectedPromptNodeLocalPrompt.trim()}
                      className="px-2 py-1.5 rounded-lg border border-panel-border text-[11px] text-slate-300 hover:bg-panel-hover transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                      <Wand2 size={11} /> Créer depuis le nœud sélectionné
                    </button>
                  </div>
                  {promptStripLibrary.length === 0 ? (
                    <div className="text-[10px] text-slate-500">Aucun prompt strip défini. Crée d'abord des assets réutilisables, puis assigne-les explicitement à un graphe, un nœud ou un sous-agent.</div>
                  ) : (
                    <div className="space-y-2">
                      {promptStripLibrary.map((strip) => (
                        <div key={strip.id} className="rounded-lg border border-panel-border bg-black/20 p-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={strip.name}
                              onChange={(e) => updatePromptStrip(strip.id, { name: e.target.value })}
                              className="flex-1 bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                            />
                            <button type="button" onClick={() => removePromptStrip(strip.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={12} /></button>
                          </div>
                          <input
                            type="text"
                            value={strip.description || ''}
                            onChange={(e) => updatePromptStrip(strip.id, { description: e.target.value })}
                            placeholder="Description courte"
                            className="w-full bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                          />
                          <textarea
                            value={strip.body}
                            onChange={(e) => updatePromptStrip(strip.id, { body: e.target.value })}
                            placeholder="Body du prompt réutilisable"
                            className="w-full min-h-[96px] bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                          />
                          <input
                            type="text"
                            value={Array.isArray(strip.tags) ? strip.tags.join(', ') : ''}
                            onChange={(e) => updatePromptStrip(strip.id, { tags: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })}
                            placeholder="tags (comma separated)"
                            className="w-full bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                          />
                          <div className="flex flex-wrap gap-1 text-[10px]">
                            <span className="px-1.5 py-0.5 rounded border border-panel-border text-slate-300">origin: {strip.origin}</span>
                            {strip.tags.map((tag) => <span key={tag} className="px-1.5 py-0.5 rounded border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">#{tag}</span>)}
                            {(strip.variables || []).map((variable) => <span key={variable.name} className="px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-200">{'{{'}{variable.name}{'}}'}</span>)}
                          </div>
                          <div className="text-[10px] text-slate-500">{summarizePromptBody(strip.body)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    {graphPromptTarget && renderPromptAssignmentsForTarget(graphPromptTarget, '', `Graph default (${activeTab?.projectName || 'active tab'})`)}
                    {selectedPromptNodeTarget ? (
                      renderPromptAssignmentsForTarget(selectedPromptNodeTarget, selectedPromptNodeLocalPrompt, `Selected node (${typeof selectedPromptNode?.data?.label === 'string' ? selectedPromptNode.data.label : selectedPromptNodeType})`)
                    ) : (
                      <div className="rounded-lg border border-panel-border bg-black/20 p-2 text-[10px] text-slate-500">
                        Select a prompt-capable node to assign strips to it directly. Current phase-1 targets stay explicit: graph default, selected node, and named subagents.
                      </div>
                    )}
                  </div>
                </Section>

                <Section title="Bibliothèque de sous-agents" icon={Boxes} count={subagentLibrary.reduce((sum, group) => sum + group.agents.length, 0)} defaultOpen={subagentLibrary.length > 0}>
              <div className="rounded-lg border border-panel-border bg-black/20 p-2 text-[11px] text-slate-400" data-testid="subagent-library-boundary">
                Définis ici les sous-agents canoniques utilisés comme <strong>outils d'agent</strong>. Un bloc <code>Subagent</code> sur le canvas référence ensuite une entrée de cette bibliothèque. Les sous-agents n'ont pas de mémoire persistante propre par défaut. Cette surface ne vaut pas encore <strong>module library</strong> générale et n'implémente pas un <strong>prompt-strip panel</strong> global : les prompts ici restent attachés à chaque sous-agent.
              </div>
              <div className="flex gap-2">
                <button onClick={addSubagentGroup} className="flex-1 py-1.5 rounded-lg border border-dashed border-panel-border text-[11px] text-slate-300 hover:bg-panel-hover transition-all flex items-center justify-center gap-1">
                  <Plus size={11} /> Ajouter un groupe
                </button>
              </div>
              {subagentLibrary.length === 0 ? (
                <div className="text-[10px] text-slate-500">Aucun sous-agent défini. Crée d'abord un groupe puis ajoute des sous-agents nommés avec prompt système et tools.</div>
              ) : (
                <div className="space-y-2">
                  {subagentLibrary.map((group) => (
                    <div key={group.name} className="rounded-lg border border-panel-border bg-black/20 p-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="text-[11px] font-medium text-slate-200">Groupe <span className="font-mono">{group.name}</span></div>
                        <div className="ml-auto flex gap-2">
                          <button onClick={() => addSubagentToGroup(group.name)} className="px-2 py-1 rounded border border-panel-border text-[10px] text-slate-200 hover:bg-panel-hover">Ajouter un sous-agent</button>
                          <button onClick={() => insertSubagentToolBlock(group.name)} className="px-2 py-1 rounded border border-panel-border text-[10px] text-emerald-200 hover:bg-emerald-500/10">Insérer bloc groupe</button>
                          <button onClick={() => removeSubagentGroup(group.name)} className="px-2 py-1 rounded border border-red-500/20 text-[10px] text-red-300 hover:bg-red-500/10">Supprimer groupe</button>
                        </div>
                      </div>
                      {group.agents.length === 0 ? (
                        <div className="text-[10px] text-slate-500">Ce groupe est vide. Un groupe de 1 est un cas parfaitement valide.</div>
                      ) : group.agents.map((agent) => (
                        <div key={agent.name} className="rounded-lg border border-panel-border bg-panel-hover/20 p-2 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <div className="text-[11px] font-medium text-slate-100">{agent.name}</div>
                            <div className="ml-auto flex items-center gap-2">
                              <button onClick={() => insertSubagentToolBlock(group.name, agent.name)} className="px-2 py-0.5 rounded border border-panel-border text-[10px] text-emerald-200 hover:bg-emerald-500/10">Insérer bloc</button>
                              <button onClick={() => removeSubagentEntry(group.name, agent.name)} className="text-slate-500 hover:text-red-400"><Trash2 size={12} /></button>
                            </div>
                          </div>
                          <input type="text" value={agent.description || ''} onChange={(e) => updateSubagentEntry(group.name, agent.name, { description: e.target.value })} placeholder="Description courte" className="w-full bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500" />
                          <textarea value={agent.systemPrompt || ''} onChange={(e) => updateSubagentEntry(group.name, agent.name, { systemPrompt: e.target.value })} placeholder="Prompt système du sous-agent" className="w-full min-h-[84px] bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500" />
                          <input type="text" value={Array.isArray(agent.tools) ? agent.tools.join(', ') : ''} onChange={(e) => updateSubagentEntry(group.name, agent.name, { tools: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="tools (ids séparés par des virgules)" className="w-full bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500" />
                          {activeTab && renderPromptAssignmentsForTarget({ kind: 'subagent', tabId: activeTab.id, groupName: group.name, agentName: agent.name }, agent.systemPrompt || '', `Prompt strips · ${group.name}/${agent.name}`)}
                          <div className="text-[10px] text-slate-500">Usage canonique : un bloc <code>Subagent</code> référence ce groupe et, si besoin, un sous-agent précis. Laisser le sous-agent vide permet un dispatch borné sur le groupe.</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Bibliothèque d'artefacts" icon={LibraryBig} defaultOpen={false}>
                  <div className="space-y-2 text-[11px]">
                    <div className="rounded-lg border border-panel-border bg-black/20 p-2 text-slate-400">
                      Enregistrer ce {activeTab?.artifactType || 'graph'} dans le registre filesystem pour le réutiliser comme starter, wrapper ou brique de compilation.
                    </div>
                    <button
                      onClick={publishCurrentArtifact}
                      disabled={publishing || !activeTab}
                      className="w-full py-2 rounded-lg border border-panel-border text-slate-200 hover:bg-panel-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <UploadCloud size={12} /> {publishing ? 'Publication...' : 'Publier dans la bibliothèque'}
                    </button>
                    <div className="rounded-lg border border-panel-border bg-black/20 px-2.5 py-2 text-[10px] leading-5 text-slate-400" data-testid="artifact-publish-truth">
                      <div className="flex flex-wrap gap-2 mb-1.5">
                        <span className={`px-1.5 py-0.5 rounded border ${activeSurfaceTruth.compileSafe ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-red-500/20 bg-red-500/10 text-red-200'}`}>{activeSurfaceTruth.compileSafe ? 'compile-safe' : 'not compile-safe'}</span>
                        <span className={`px-1.5 py-0.5 rounded border ${activeSurfaceTruth.editorOnly ? 'border-amber-500/20 bg-amber-500/10 text-amber-200' : 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200'}`}>{activeSurfaceTruth.editorOnly ? 'editor-first' : 'runtime-enabled'}</span>
                        <span className="px-1.5 py-0.5 rounded border border-panel-border text-slate-300">mode: {activeSurfaceTruth.projectMode}</span>
                      </div>
                      <div>{publishEffectSummary}</div>
                    </div>
                {publishMessage && <div className="text-[10px] text-slate-500">{publishMessage}</div>}
                  </div>
                </Section>
              </>
            )}
          </>
        ) : (
          <>
            <Section title="Scope & exécution" icon={Workflow}>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-panel-hover/30 border border-panel-border">
                  <div className="text-slate-500 text-[10px] uppercase mb-1">Scope</div>
                  <div className="text-slate-200 font-medium">{activeTab?.scopeKind === 'subgraph' ? 'Subgraph' : 'Graph'}</div>
                  <div className="text-slate-500 mt-1 font-mono break-all">{activeTab?.scopePath || '—'}</div>
                </div>
                <button
                  onClick={() => setIsAsync(!isAsync)}
                  className="p-1.5 rounded-lg bg-panel-hover/30 border border-panel-border text-left hover:bg-panel-hover/50 transition-all"
                >
                  <div className="text-slate-500 text-[10px] uppercase mb-1">Mode d'exécution</div>
                  <div className={`font-medium ${isAsync ? 'text-emerald-300' : 'text-amber-300'}`}>{isAsync ? 'Async' : 'Sync'}</div>
                  <div className="text-slate-500 mt-1">Basculer rapidement le runtime LangGraph</div>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-1.5 rounded-lg bg-black/20 border border-panel-border">
                  <div className="text-slate-500 text-[10px] uppercase mb-1">Project ID</div>
                  <div className="font-mono text-slate-300 break-all">{activeTab?.projectId || 'local-only'}</div>
                </div>
                <div className="p-1.5 rounded-lg bg-black/20 border border-panel-border">
                  <div className="text-slate-500 text-[10px] uppercase mb-1">Node parent</div>
                  <div className="font-mono text-slate-300 break-all">{activeTab?.parentNodeId || '—'}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-500 text-[10px] uppercase">Type d'artefact</label>
                  <select
                    value={activeTab?.artifactType || 'graph'}
                    onChange={(e) => updateArtifactType(e.target.value as ArtifactType)}
                    className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                  >
                    {artifactOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-slate-500 text-[10px] uppercase">Profil runtime</label>
                  <select
                    value={activeTab?.executionProfile || (isAsync ? 'langgraph_async' : 'langgraph_sync')}
                    onChange={(e) => updateExecutionProfile(e.target.value as ExecutionProfile)}
                    className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                  >
                    {profileOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Section>

            <Section title="Sémantique du canvas" icon={Workflow} count={`${graphValidation?.detachedComponentCount || 0}/${graphScopeMarkerCount}/${semanticLinkKinds.length}`} defaultOpen={(graphValidation?.detachedComponentCount || 0) > 0 || graphScopeMarkerCount > 0 || semanticLinkKinds.length > 0}>
              <div className="space-y-2 text-[11px]">
                <div className="rounded-lg border border-panel-border bg-black/20 p-2 text-slate-300 leading-5">
                  Le canvas est un langage d'auteur. Certaines poignées et puces représentent des attaches sémantiques ou des réglages de portée graphe plutôt qu'un edge runtime littéral un-à-un.
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 rounded-lg bg-black/20 border border-panel-border">
                    <div className="text-slate-500 text-[10px] uppercase">Detached</div>
                    <div className="mt-1 text-slate-200 font-medium">{graphValidation?.detachedComponentCount || 0}</div>
                    <div className="mt-1 text-[10px] text-slate-500">Circuits interactifs secondaires.</div>
                  </div>
                  <div className="p-2 rounded-lg bg-black/20 border border-panel-border">
                    <div className="text-slate-500 text-[10px] uppercase">Graph scope</div>
                    <div className="mt-1 text-slate-200 font-medium">{graphScopeMarkerCount}</div>
                    <div className="mt-1 text-[10px] text-slate-500">Marqueurs de portée compile/runtime.</div>
                  </div>
                  <div className="p-2 rounded-lg bg-black/20 border border-panel-border">
                    <div className="text-slate-500 text-[10px] uppercase">Semantic links</div>
                    <div className="mt-1 text-slate-200 font-medium">{semanticLinkKinds.length}</div>
                    <div className="mt-1 text-[10px] text-slate-500">Familles de liens d'auteur présentes.</div>
                  </div>
                </div>
                {semanticLinkKinds.length > 0 && (
                  <div className="rounded-lg border border-panel-border bg-black/20 p-2">
                    <div className="text-slate-500 text-[10px] uppercase mb-1">Semantic link kinds</div>
                    <div className="flex flex-wrap gap-1.5">
                      {semanticLinkKinds.map(([kind, count]) => (
                        <span key={kind} className="px-2 py-0.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">{kind} · {count}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="text-[10px] text-slate-500 leading-5">Les outils, la mémoire, le contexte, le fanout et certains wrappers peuvent compiler en structures runtime synthétisées. Les graph-scope markers n'ont pas besoin d'arêtes pour rester valides.</div>
                {((graphValidation?.detachedComponentCount || 0) > 0) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => selectNodesByIds(Array.from(graphValidation?.detachedNodeIds || []))}
                      className="inline-flex items-center gap-1 rounded-md border border-fuchsia-500/20 bg-fuchsia-500/10 px-2.5 py-1.5 text-[11px] font-medium text-fuchsia-200 hover:bg-fuchsia-500/20"
                    >
                      Sélectionner les détachés
                    </button>
                    <button
                      onClick={() => selectNodesByIds([])}
                      className="inline-flex items-center gap-1 rounded-md border border-panel-border bg-black/20 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-panel-hover"
                    >
                      Effacer la sélection
                    </button>
                  </div>
                )}
              </div>
            </Section>

            <Section title="Mémoires actives" icon={Database} count={memorySurfaces.length} defaultOpen={memorySurfaces.length > 0}>
              <MemorySurfaceList memorySurfaces={memorySurfaces} />
            </Section>

            <Section title="Paramètres d'exécution" icon={Workflow}>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-500 text-[10px] uppercase">Recursion limit</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={activeTab?.runtimeSettings?.recursionLimit ?? 50}
                    onChange={(e) => updateRuntimeSettings({ recursionLimit: Number(e.target.value || 50) })}
                    className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-slate-500 text-[10px] uppercase">Stream mode</label>
                  <select
                    value={activeTab?.runtimeSettings?.streamMode || 'updates'}
                    onChange={(e) => updateRuntimeSettings({ streamMode: e.target.value as 'updates' | 'values' | 'debug' })}
                    className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                  >
                    <option value="updates">updates</option>
                    <option value="values">values</option>
                    <option value="debug">debug</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 text-[11px]">
                <label className="flex items-start gap-2 p-2 rounded-lg bg-black/20 border border-panel-border text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(activeTab?.runtimeSettings?.checkpointEnabled)}
                    onChange={(e) => updateRuntimeSettings({ checkpointEnabled: e.target.checked })}
                  />
                  <span>
                    <span className="font-medium text-slate-200">Checkpointing du graphe</span>
                    <span className="block mt-0.5 text-[10px] text-slate-500">Compile le graphe avec un checkpointer. LangGraph persiste ensuite un snapshot d'état à chaque super-step du thread courant.</span>
                  </span>
                </label>
                {graphValidation?.graphScopeMarkerIds?.size ? (
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2 py-1.5 text-[10px] text-cyan-200">
                    {graphValidation.graphScopeMarkerIds.size} marker(s) memory_checkpoint hérités restent présents comme marqueurs de portée graphe.
                  </div>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <label className="flex items-center gap-2 p-2 rounded-lg bg-black/20 border border-panel-border text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(activeTab?.runtimeSettings?.inheritParentBindings)}
                    onChange={(e) => updateRuntimeSettings({ inheritParentBindings: e.target.checked })}
                  />
                  Hériter les bindings du parent
                </label>
                <label className="flex items-center gap-2 p-2 rounded-lg bg-black/20 border border-panel-border text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(activeTab?.runtimeSettings?.debug)}
                    onChange={(e) => updateRuntimeSettings({ debug: e.target.checked })}
                  />
                  Debug runtime étendu
                </label>
              </div>
              <div className="text-[10px] text-slate-500">
                Ces paramètres sont désormais exportés au compile, visibles en collaboration, et les bindings peuvent amorcer le runtime généré. Le backend de store peut maintenant être choisi entre mémoire volatile et SQLite local persistant. Le checkpointing est un réglage de portée graphe, pas un nœud de step ordinaire.
              </div>
            </Section>

            <Section title="Bibliothèque d'artefacts" icon={LibraryBig} defaultOpen={false}>
              <div className="space-y-2 text-[11px]">
                <div className="rounded-lg border border-panel-border bg-black/20 p-2 text-slate-400">
                  Enregistrer ce {activeTab?.artifactType || 'graph'} dans le registre filesystem pour le réutiliser comme starter, wrapper ou brique de compilation.
                </div>
                <button
                  onClick={publishCurrentArtifact}
                  disabled={publishing || !activeTab}
                  className="w-full py-2 rounded-lg border border-panel-border text-slate-200 hover:bg-panel-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <UploadCloud size={12} /> {publishing ? 'Publication...' : 'Publier dans la bibliothèque'}
                </button>
                {publishMessage && <div className="text-[10px] text-slate-500">{publishMessage}</div>}
                <div className="text-[10px] text-slate-500">
                  Dossier cible : artifact_registry/{ARTIFACT_KIND_META[activeTab?.artifactType || 'graph'].artifactDirectory}
                </div>
              </div>
            </Section>

            <Section title="Variables détectées" icon={Eye} count={detectedKeys.length} defaultOpen={detectedKeys.length <= 6}>
              {detectedKeys.length === 0 ? (
                <p className="text-[10px] text-slate-600 py-1">Aucun nœud dans le graphe</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {detectedKeys.map((key) => (
                    <span key={key} className="px-2 py-1 rounded-full text-[11px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/20">
                      {key}
                    </span>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Bindings du graphe" icon={Boxes} count={localBindings.length + inheritedBindings.length} defaultOpen={localBindings.length > 0 && localBindings.length <= 1 && inheritedBindings.length === 0}>
              <div className="flex gap-2">
                <button onClick={() => addBinding('variable')} className="flex-1 py-1.5 rounded-lg border border-dashed border-panel-border text-[11px] text-slate-300 hover:bg-panel-hover transition-all flex items-center justify-center gap-1">
                  <Plus size={11} /> Variable locale
                </button>
                <button onClick={() => addBinding('constant')} className="flex-1 py-1.5 rounded-lg border border-dashed border-panel-border text-[11px] text-slate-300 hover:bg-panel-hover transition-all flex items-center justify-center gap-1">
                  <Plus size={11} /> Constante locale
                </button>
              </div>

              <div className="space-y-2">
                {localBindings.map((binding, i) => (
                  <div key={`local-${i}`} className="p-2 bg-panel-hover/30 rounded-lg border border-panel-border space-y-1.5 relative group">
                    <button
                      onClick={() => removeBindingAt(i)}
                      className="absolute top-2 right-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide">
                      <span className={`px-1.5 py-0.5 rounded ${binding.kind === 'constant' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{binding.kind}</span>
                      <span className="text-slate-500">local</span>
                    </div>
                    <div className="grid grid-cols-[1fr_110px] gap-2">
                      <input
                        type="text"
                        value={binding.name}
                        onChange={(e) => updateBindingAt(i, { name: e.target.value })}
                        className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                        placeholder="nom"
                      />
                      <select
                        value={binding.kind}
                        onChange={(e) => updateBindingAt(i, { kind: e.target.value as 'variable' | 'constant' })}
                        className="bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                      >
                        <option value="variable">variable</option>
                        <option value="constant">constant</option>
                      </select>
                    </div>
                    <textarea
                      value={binding.value}
                      onChange={(e) => updateBindingAt(i, { value: e.target.value })}
                      className="w-full bg-black/20 border border-panel-border rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                      rows={2}
                      placeholder="valeur, JSON, texte, etc."
                    />
                  </div>
                ))}

                {inheritedBindings.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">Hérités du parent ouvert</div>
                    {inheritedBindings.map((binding, i) => (
                      <div key={`inherited-${i}`} className="p-2 rounded-lg bg-black/20 border border-panel-border/70">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide mb-1">
                          <span className={`px-1.5 py-0.5 rounded ${binding.kind === 'constant' ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{binding.kind}</span>
                          <span className="text-slate-500">hérité</span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-200">{binding.name}</div>
                        <div className="text-[10px] text-slate-600">depuis {binding.inheritedFrom || 'parent'}</div>
                        <div className="text-[11px] text-slate-500 break-words">{binding.value || '∅'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>

            <Section title="Schéma personnalisé" icon={Database} count={schema.length} defaultOpen={schema.length > 0}>
              <div className="space-y-2">
                {schema.map((v, i) => (
                  <div key={i} className="p-2 bg-panel-hover/30 rounded-lg border border-panel-border space-y-1.5 relative group">
                    <button
                      onClick={() => handleRemoveSchema(i)}
                      className="absolute top-2 right-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                    <div className="flex flex-col gap-1 text-xs">
                      <label className="text-slate-500 text-[10px]">Nom</label>
                      <input type="text" value={v.name} onChange={(e) => handleUpdateSchema(i, 'name', e.target.value)} className="bg-black/20 border border-panel-border rounded px-2 py-1 text-emerald-300 text-[11px] outline-none focus:border-blue-500" />
                    </div>
                    <div className="flex gap-2 text-xs">
                      <div className="flex flex-col gap-1 w-1/2">
                        <label className="text-slate-500 text-[10px]">Type</label>
                        <select value={v.type} onChange={(e) => handleUpdateSchema(i, 'type', e.target.value)} className="bg-black/20 border border-panel-border rounded px-2 py-1 text-slate-200 text-[11px] outline-none focus:border-blue-500">
                          <option value="str">String</option>
                          <option value="int">Integer</option>
                          <option value="list">List</option>
                          <option value="dict">Dictionary</option>
                          <option value="bool">Boolean</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1 w-1/2">
                        <label className="text-slate-500 text-[10px]">Reducer</label>
                        <select value={v.reducer} onChange={(e) => handleUpdateSchema(i, 'reducer', e.target.value)} className="bg-black/20 border border-panel-border rounded px-2 py-1 text-slate-200 text-[11px] outline-none focus:border-blue-500">
                          <option value="none">Écrase</option>
                          <option value="operator.add">Ajoute</option>
                          <option value="add_messages">Messages</option>
                          <option value="update">Mise à jour</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={handleAddSchema} className="w-full mt-1.5 py-1.5 border border-dashed border-panel-border text-slate-400 hover:text-white hover:bg-panel-hover rounded-lg flex items-center justify-center gap-2 text-xs transition-all">
                <Plus size={12} /> Ajouter une variable d'état
              </button>
            </Section>


            <Section title="Chemin d'exécution" icon={Workflow} count={executionTimeline.steps.length} defaultOpen={executionTimeline.steps.length > 0 && executionTimeline.steps.length <= 6}>
              {executionTimeline.steps.length === 0 ? (
                <div className="text-[10px] text-slate-600">Aucune exécution observée pour ce scope.</div>
              ) : (
                <div className="space-y-2" data-testid="state-execution-path">
                  <div className="flex flex-wrap gap-1.5">
                    {executionTimeline.steps.slice(-6).map((step) => {
                      const isLocked = runtimeNavigationSettings.lockHover && runtimeHoverTarget?.nodeId === step.nodeId;
                      return (
                      <span key={`${step.order}-${step.nodeId}`} className="inline-flex items-center gap-1">
                        <button onClick={() => requestRuntimeFocus(step.nodeId, 'state')} onDoubleClick={() => lockRuntimeNode(step.nodeId)} onMouseEnter={() => setRuntimeHoverTarget(step.nodeId, 'state')} onMouseLeave={() => { if (!runtimeNavigationSettings.lockHover) clearRuntimeHoverTarget('state', step.nodeId); }} className={`px-2 py-1 rounded-full text-[10px] border transition-all ${runtimeHoverTarget?.nodeId === step.nodeId ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200' : 'border-panel-border bg-black/20 text-slate-300 hover:bg-panel-hover'}`} data-testid="state-focus-step">
                          <span className="text-cyan-300">{step.order}</span> #{step.nodeId}{isLocked ? ' · locked' : ''}
                        </button>
                        <RuntimeChipLockButton nodeId={step.nodeId} locked={isLocked} onLockNode={lockRuntimeNode} onUnlockNode={unlockRuntimeNode} />
                      </span>
                    );})}
                  </div>
                  {executionTimeline.scheduledNodeIds.length > 0 && (
                    <div className="text-[10px] text-amber-300 flex flex-wrap items-center gap-1.5">Prévu ensuite : {executionTimeline.scheduledNodeIds.map((nodeId) => {
                      const isLocked = runtimeNavigationSettings.lockHover && runtimeHoverTarget?.nodeId === nodeId;
                      return (<span key={nodeId} className="inline-flex items-center gap-1"><button onClick={() => requestRuntimeFocus(nodeId, 'state')} onDoubleClick={() => lockRuntimeNode(nodeId)} onMouseEnter={() => setRuntimeHoverTarget(nodeId, 'state')} onMouseLeave={() => { if (!runtimeNavigationSettings.lockHover) clearRuntimeHoverTarget('state', nodeId); }} className={`px-1.5 py-0.5 rounded border text-[10px] font-mono transition-all ${runtimeHoverTarget?.nodeId === nodeId ? 'border-amber-400/40 bg-amber-500/20 text-amber-200' : 'border-amber-500/20 text-amber-300 bg-amber-500/10 hover:bg-amber-500/15'}`} data-testid="state-focus-scheduled">#{nodeId}</button><RuntimeChipLockButton nodeId={nodeId} locked={isLocked} onLockNode={lockRuntimeNode} onUnlockNode={unlockRuntimeNode} /></span>);
                    })}</div>
                  )}
                  <div className="text-[10px] text-slate-500">Edges mis en avant: {executionTimeline.emphasisedEdgeIds.length}</div>
                </div>
              )}
            </Section>

            {liveState && typeof liveState['__fanout_meta__'] === 'object' && liveState['__fanout_meta__'] !== null && !Array.isArray(liveState['__fanout_meta__']) && (
              <Section title="Fanout runtime" icon={Workflow} defaultOpen={false}>
                <div className="p-2 rounded-lg bg-black/20 border border-panel-border text-[11px] text-slate-300 space-y-1">
                  {typeof (liveState['__fanout_meta__'] as Record<string, unknown>).source_node === 'string' && <div>Source: <span className="text-sky-300 font-mono">{String((liveState['__fanout_meta__'] as Record<string, unknown>).source_node)}</span></div>}
                  {typeof (liveState['__fanout_meta__'] as Record<string, unknown>).index === 'number' && <div>Worker index: <span className="text-slate-100">{Number((liveState['__fanout_meta__'] as Record<string, unknown>).index)}</span></div>}
                  {typeof (liveState['__fanout_meta__'] as Record<string, unknown>).items_key === 'string' && <div>Items key: <span className="text-slate-100">{String((liveState['__fanout_meta__'] as Record<string, unknown>).items_key)}</span></div>}
                </div>
              </Section>
            )}

            <Section title="Nœuds IA" icon={Cpu} count={aiNodes.length} defaultOpen={false}>
              <div className="flex flex-wrap gap-1.5 pb-1">
                {providerSummary.map(([provider, count]) => (
                  <span key={provider} className="px-2 py-1 rounded-full text-[10px] text-blue-300 bg-blue-500/10 border border-blue-500/20">
                    {provider} · {count}
                  </span>
                ))}
              </div>
              <div className="space-y-2">
                {aiNodes.map((node) => (
                  <div key={node.id} className="p-2 rounded-lg bg-black/20 border border-panel-border text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-slate-200">{node.id}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 uppercase">{node.type}</span>
                        <span className={`px-1.5 py-0.5 rounded border text-[10px] ${BLOCK_FAMILY_BADGE_CLASSES[node.blockFamily]}`}>{BLOCK_FAMILY_LABELS[node.blockFamily]}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-1 text-slate-400">
                      <div>Provider: <span className="text-slate-200">{node.provider}</span></div>
                      <div>Model: <span className="text-slate-200">{node.model}</span></div>
                      <div>Groupe: <span className="text-slate-200">{node.executionGroup}</span></div>
                      <div>Tools: <span className="text-slate-200">{node.toolsLinked}</span></div>
                      <div>Structured: <span className="text-slate-200">{node.structuredOutputKey || '—'}</span></div>
                    </div>
                  </div>
                ))}
                {aiNodes.length === 0 && <div className="text-[10px] text-slate-600">Aucun nœud IA dans ce scope.</div>}
              </div>
            </Section>
          </>
        )}
      </div>
    </>
  );
}

function MemorySurfaceList({ memorySurfaces }: { memorySurfaces: MemorySurfaceSummary[] }) {
  if (memorySurfaces.length === 0) {
    return <div className="text-[10px] text-slate-600">Aucune surface mémoire détectée dans ce scope.</div>;
  }

  const primarySurfaces = memorySurfaces.filter((surface) => !surface.legacyHelperSurface);
  const legacySurfaces = memorySurfaces.filter((surface) => surface.legacyHelperSurface);

  const renderSurface = (surface: MemorySurfaceSummary) => (
    <div key={surface.id} className="rounded-lg border border-panel-border bg-black/20 p-2 space-y-1.5 text-[11px]">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium text-slate-100">{surface.label}</span>
        <span className={`px-1.5 py-0.5 rounded border text-[10px] ${BLOCK_FAMILY_BADGE_CLASSES[surface.blockFamily]}`}>{BLOCK_FAMILY_LABELS[surface.blockFamily]}</span>
        <span className="px-1.5 py-0.5 rounded border text-[10px] text-cyan-300 bg-cyan-500/10 border-cyan-500/20">{surface.systemKind.replace(/_/g, ' ')}</span>
        {surface.legacyHelperSurface && (
          <span className="px-1.5 py-0.5 rounded border text-[10px] text-amber-300 bg-amber-500/10 border-amber-500/20">Legacy helper</span>
        )}
        {surface.preferredSurface && surface.preferredSurface !== 'this_node' && (
          <span className="px-1.5 py-0.5 rounded border text-[10px] text-emerald-300 bg-emerald-500/10 border-emerald-500/20">Préférer {surface.preferredSurface}</span>
        )}
        {surface.preferredSurface === 'this_node' && !surface.legacyHelperSurface && (
          <span className="px-1.5 py-0.5 rounded border text-[10px] text-emerald-300 bg-emerald-500/10 border-emerald-500/20">Surface recommandée</span>
        )}
      </div>
      <div className="text-[10px] text-slate-400 leading-5">{surface.summary}</div>
      {surface.legacyHelperSurface && surface.preferredSurface && surface.preferredSurface !== 'this_node' && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 text-[10px] text-slate-300 leading-5">
          Cette surface reste utilisable, mais elle fait partie des helpers historiques. Pour un usage plus clair dans l’éditeur actuel, préfère <code>{surface.preferredSurface}</code>.
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500">
        <div>Durabilité: <span className="text-slate-300">{surface.durability.replace(/_/g, ' ')}</span></div>
        <div>Projection: <span className="text-slate-300">{surface.visibility.replace(/_/g, ' ')}</span></div>
        <div>Rôle: <span className="text-slate-300">{surface.role ? surface.role.replace(/_/g, ' ') : '—'}</span></div>
        <div>Accès: <span className="text-slate-300">{surface.accessModel ? surface.accessModel.replace(/_/g, ' ') : '—'}</span></div>
        <div>Surface conseillée: <span className="text-slate-300">{surface.preferredSurface ? (surface.preferredSurface === 'this_node' ? 'this node' : surface.preferredSurface) : '—'}</span></div>
        <div>Dernière mise à jour: <span className="text-slate-300">{formatTimestamp(surface.lastUpdatedAt)}</span></div>
        <div>Dernière opération: <span className="text-slate-300">{surface.lastOperation ? surface.lastOperation.replace(/_/g, ' ') : '—'}</span></div>
        {surface.outputKey && <div>Clé sortie: <span className="text-slate-300 font-mono">{surface.outputKey}</span></div>}
        {surface.stateKey && <div>Clé source: <span className="text-slate-300 font-mono">{surface.stateKey}</span></div>}
        {surface.namespaceHint && <div className="col-span-2">Namespace / hint: <span className="text-slate-300 font-mono break-all">{surface.namespaceHint}</span></div>}
        {surface.storeBackend && <div>Backend store: <span className="text-slate-300">{surface.storeBackend}</span></div>}
        {surface.storePath && <div className="col-span-2">Store path: <span className="text-slate-300 font-mono break-all">{surface.storePath}</span></div>}
      </div>
      {surface.sourceKind === 'memory_consumer' && surface.sourceLabels && surface.sourceLabels.length > 0 && (
        <div className="text-[10px] text-slate-400">
          Sources reliées à <code>memory_in</code> : <span className="text-slate-200">{surface.sourceLabels.join(', ')}</span>
        </div>
      )}
      <div className="rounded-md border border-panel-border bg-black/10 px-2 py-1.5 text-[10px] text-slate-400">
        <span className="text-slate-500">Dernière entrée :</span>{' '}
        <span className="text-slate-200 break-all">{previewValue(surface.lastEntry)}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="text-[10px] text-slate-500 leading-5">
        Les mémoires affichées ici reflètent les <strong className="text-slate-300">surfaces runtime</strong> réellement présentes dans le scope: checkpoint thread, store, retrieval, trimming de contexte, ou consommation via <code>memory_in</code>. Les surfaces primaires sont affichées d’abord, puis les helpers legacy quand ils existent encore dans le graphe.
      </div>
      {primarySurfaces.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Surfaces principales</div>
          {primarySurfaces.map(renderSurface)}
        </div>
      )}
      {legacySurfaces.length > 0 && (
        <div className="space-y-2">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 text-[10px] text-slate-400 leading-5">
            Les surfaces ci-dessous restent supportées, mais elles recouvrent des cas déjà mieux exprimés par les surfaces principales. Elles sont gardées pour compatibilité, pas comme premier choix par défaut.
          </div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Helpers / legacy</div>
          {legacySurfaces.map(renderSurface)}
        </div>
      )}
    </div>
  );
}

function StateNode({
  label,
  value,
  path,
  expandedKeys,
  toggleKey,
  depth,
}: {
  label: string;
  value: unknown;
  path: string;
  expandedKeys: Set<string>;
  toggleKey: (key: string) => void;
  depth: number;
}) {
  const isObject = value && typeof value === 'object';
  const isArray = Array.isArray(value);
  const isExpandable = Boolean(isObject);
  const isExpanded = expandedKeys.has(path);
  const paddingLeft = depth * 12;
  const toolObservation = parseToolObservation(value);
  const toolCounts = toolObservation ? describeToolObservationCounts(toolObservation) : [];
  const toolTone = toolObservation?.status === 'preview' ? 'text-cyan-300 border-cyan-500/20 bg-cyan-500/10'
    : toolObservation?.status === 'applied' || toolObservation?.status === 'succeeded' ? 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10'
    : toolObservation?.status === 'partially_applied' || toolObservation?.status === 'blocked' ? 'text-amber-300 border-amber-500/20 bg-amber-500/10'
    : toolObservation ? 'text-red-300 border-red-500/20 bg-red-500/10'
    : '';

  return (
    <div>
      <button
        type="button"
        onClick={() => isExpandable && toggleKey(path)}
        className="w-full flex items-start gap-1.5 rounded px-1.5 py-1 hover:bg-panel-hover/40 transition-all text-left"
        style={{ paddingLeft }}
      >
        <span className="mt-0.5 text-slate-500 w-3 shrink-0">
          {isExpandable ? (isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />) : null}
        </span>
        <span className="font-mono text-[11px] text-cyan-300 shrink-0">{label}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-slate-400 break-all">
            {toolObservation
              ? summarizeToolObservation(toolObservation)
              : isObject
                ? isArray
                  ? `Array(${(value as unknown[]).length})`
                  : `Object(${Object.keys(value as Record<string, unknown>).length})`
                : previewValue(value)}
          </div>
          {toolObservation && (
            <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
              <span className={`px-1.5 py-0.5 rounded border ${toolTone}`}>{toolObservation.status.replace(/_/g, ' ')}</span>
              <span className="px-1.5 py-0.5 rounded border border-panel-border text-sky-300 bg-sky-500/10">{toolObservation.toolkit}.{toolObservation.operation}</span>
              {toolObservation.mode && <span className="px-1.5 py-0.5 rounded border border-panel-border text-cyan-300">mode:{toolObservation.mode}</span>}
              {toolObservation.path && <span className="px-1.5 py-0.5 rounded border border-panel-border text-slate-300 font-mono">{toolObservation.path}</span>}
              {toolCounts.slice(0, 3).map((item) => <span key={item} className="px-1.5 py-0.5 rounded border border-panel-border text-slate-500">{item}</span>)}
              {toolObservation.reasonCode && <span className="px-1.5 py-0.5 rounded border border-amber-500/20 text-amber-300">{toolObservation.reasonCode}</span>}
            </div>
          )}
        </div>
      </button>
      {isExpandable && isExpanded && (
        <div className="space-y-0.5">
          {isArray
            ? (value as unknown[]).map((item, index) => (
                <StateNode
                  key={`${path}[${index}]`}
                  label={`[${index}]`}
                  value={item}
                  path={`${path}[${index}]`}
                  expandedKeys={expandedKeys}
                  toggleKey={toggleKey}
                  depth={depth + 1}
                />
              ))
            : Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => (
                <StateNode
                  key={`${path}.${childKey}`}
                  label={childKey}
                  value={childValue}
                  path={`${path}.${childKey}`}
                  expandedKeys={expandedKeys}
                  toggleKey={toggleKey}
                  depth={depth + 1}
                />
              ))}
        </div>
      )}
    </div>
  );
}
