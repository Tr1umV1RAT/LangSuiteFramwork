import { create } from 'zustand';
import {
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import { NODE_DEFS } from './nodeConfig';
import { KNOWN_PROVIDER_VALUES, getProviderMeta, normalizeProvider } from './providerContracts';
import { hydrateArtifactEditorGraph } from './store/artifactHydration';
import { decorateConnectionEdge, validateConnectionAffordance, validateGraph } from './graphUtils';
import {
  type ArtifactType,
  type ExecutionProfile,
  type GraphScopeKind,
  type ProjectMode,
  isArtifactType,
  isExecutionProfile,
  isLegacyExecutionProfile,
  normalizeWorkspaceArtifactType,
  normalizeWorkspaceExecutionProfile,
  normalizeProjectMode,
  inferProjectModeFromSurface,
  projectModeAllowsRuntime,
  getDefaultSurfaceForProjectMode,
  getInteroperabilityBridge,
  inferNodeBlockFamily,
} from './capabilities';
import { getCompileNodeType, getNodeRuntimeMeta, getSuggestedWrapperNodeType, isNodeBackedByRuntime, isNodeCompatibleWithSurface } from './catalog';
import { parseToolObservation, summarizeToolObservation } from './executionTruth';
import { getRuntimeEvent } from './runtimeEvent';
import {
  type CapabilityInspectorTarget,
  type EditorMode,
  type GraphBinding,
  type GraphValidationIssue,
  type GraphValidationResult,
  type ModuleLibraryEntry,
  type ModuleLibraryCategory,
  type ModuleLibraryLineage,
  type ImportDiagnostic,
  type PaletteMode,
  type PalettePreset,
  type Preferences,
  type PromptAssignmentTarget,
  type PromptStripAssignment,
  type PromptStripDefinition,
  type PromptStripMergeMode,
  type ProjectPackageSnapshot,
  type RunLogEntry,
  type RuntimeEdgeLegendSettings,
  type RuntimeFocusRequest,
  type RuntimeHoverTarget,
  type RuntimeNavigationSettings,
  type RuntimeSettings,
  type RunPanelTab,
  type SerializedWorkspaceTab,
  type Tab,
  type UiDensity,
  type ValidationSeverity,
  type WorkspacePreset,
  type WorkspaceTreeSnapshot,
} from './store/types';
import {
  defaultPreferences,
  EDITOR_MODE_STORAGE_KEY,
  getInitialEditorMode,
  PREFERENCES_STORAGE_KEY,
  getInitialPreferences,
  getWorkspacePresetPatch,
  sanitizePreferences,
} from './store/preferences';
export type { ArtifactType, ExecutionProfile, GraphScopeKind, ProjectMode } from './capabilities';
export type {
  CapabilityInspectorTarget,
  EditorMode,
  GraphBinding,
  GraphValidationIssue,
  GraphValidationResult,
  ImportDiagnostic,
  PaletteMode,
  PalettePreset,
  Preferences,
  PromptAssignmentTarget,
  ModuleLibraryEntry,
  ModuleLibraryCategory,
  ModuleLibraryLineage,
  PromptStripAssignment,
  PromptStripDefinition,
  PromptStripMergeMode,
  ProjectPackageSnapshot,
  RunLogEntry,
  RuntimeEdgeLegendSettings,
  RuntimeFocusRequest,
  RuntimeHoverTarget,
  RuntimeNavigationSettings,
  RuntimeSettings,
  RunPanelTab,
  SerializedWorkspaceTab,
  Tab,
  UiDensity,
  ValidationSeverity,
  WorkspacePreset,
  WorkspaceTreeSnapshot,
} from './store/types';

import {
  buildSurfaceTruthSummary,
  buildInvalidImportDiagnostic,
  buildScopePath,
  buildScopedGraphId,
  createImportDiagnostic,
  defaultExecutionProfile,
  defaultRuntimeSettings,
  inferScopeKind,
  isObjectRecord,
  isSubgraphTab,
  makeEmptyRootTab,
  parseWorkspaceSnapshotForImport,
  sanitizeRuntimeSettings,
} from './store/workspace';

let nodeCounter = 0;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
const SYNC_DEBOUNCE_MS = 300;
const AUTOSAVE_DEBOUNCE_MS = 5000;

let tabIdCounter = 0;
function makeTabId(): string {
  tabIdCounter++;
  return `tab_${Date.now()}_${tabIdCounter}`;
}

const defaultTabId = makeTabId();

function getNodeRuntimeContext(node: Node | undefined) {
  const nodeType = typeof node?.data?.nodeType === 'string' ? String(node.data.nodeType) : null;
  if (!nodeType) {
    return { nodeType: null, blockFamily: null, executionPlacement: null, executionFlavor: null } as const;
  }
  const meta = getNodeRuntimeMeta(nodeType);
  return {
    nodeType,
    blockFamily: inferNodeBlockFamily(nodeType, meta),
    executionPlacement: meta.executionPlacement || null,
    executionFlavor: meta.executionFlavor || null,
  } as const;
}

function getRunLogContext(getter: () => AppState, nodeId?: string | null, msg?: Record<string, unknown> | null) {
  const currentNodes = getter().nodes as Node[];
  const directNode = nodeId ? currentNodes.find((node) => node.id === nodeId) : undefined;
  const fallbackNodeType = typeof msg?.node_type === 'string' ? String(msg.node_type) : (typeof msg?.execution_kind === 'string' && String(msg.execution_kind) === 'embedded_native' ? 'sub_agent' : null);
  const runtimeContext = directNode ? getNodeRuntimeContext(directNode) : fallbackNodeType ? (() => { const meta = getNodeRuntimeMeta(fallbackNodeType); return { nodeType: fallbackNodeType, blockFamily: inferNodeBlockFamily(fallbackNodeType, meta), executionPlacement: meta.executionPlacement || null, executionFlavor: meta.executionFlavor || null } as const; })() : { nodeType: null, blockFamily: null, executionPlacement: null, executionFlavor: null } as const;
  const fanoutMeta = msg && typeof msg === 'object' && !Array.isArray(msg) && msg.fanout_meta && typeof msg.fanout_meta === 'object' ? msg.fanout_meta as Record<string, unknown> : null;
  const toolObservation = parseToolObservation(msg);
  return {
    nodeType: runtimeContext.nodeType,
    blockFamily: runtimeContext.blockFamily,
    executionPlacement: runtimeContext.executionPlacement,
    executionFlavor: runtimeContext.executionFlavor,
    integrationModel: typeof msg?.integration_model === 'string' ? String(msg.integration_model) : typeof msg?.execution_kind === 'string' ? String(msg.execution_kind) : null,
    reasonCode: typeof msg?.reasonCode === 'string' ? String(msg.reasonCode) : toolObservation?.reasonCode ?? null,
    fanoutSourceNode: typeof fanoutMeta?.source_node === 'string' ? String(fanoutMeta.source_node) : typeof fanoutMeta?.sourceNode === 'string' ? String(fanoutMeta.sourceNode) : null,
    fanoutIndex: typeof fanoutMeta?.index === 'number' ? Number(fanoutMeta.index) : null,
    fanoutItemsKey: typeof fanoutMeta?.items_key === 'string' ? String(fanoutMeta.items_key) : typeof fanoutMeta?.itemsKey === 'string' ? String(fanoutMeta.itemsKey) : null,
    toolkit: toolObservation?.toolkit ?? null,
    operation: toolObservation?.operation ?? null,
    executionStatus: toolObservation?.status ?? null,
    operationSummary: toolObservation ? summarizeToolObservation(toolObservation) : null,
  } as const;
}

function getNodeParams(data: unknown): Record<string, unknown> {
  if (data && typeof data === 'object' && 'params' in data) {
    const params = (data as { params?: unknown }).params;
    if (params && typeof params === 'object' && !Array.isArray(params)) {
      return params as Record<string, unknown>;
    }
  }
  return {};
}

const SAFE_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SAFE_TYPE_RE = /^[A-Za-z_][A-Za-z0-9_[\], .|]*$/;
const SESSION_ALIAS_STORAGE_KEY = 'langsuite-session-alias';

function makeDefaultSessionAlias(): string {
  return `Guest_${Math.random().toString(36).slice(2, 6)}`;
}

function sanitizeSessionAlias(value: unknown, fallback?: string): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  const compact = raw.replace(/\s+/g, ' ').slice(0, 32);
  return compact || fallback || makeDefaultSessionAlias();
}

function loadStoredSessionAlias(): string {
  try {
    const stored = localStorage.getItem(SESSION_ALIAS_STORAGE_KEY);
    return sanitizeSessionAlias(stored, makeDefaultSessionAlias());
  } catch {
    return makeDefaultSessionAlias();
  }
}

function pushValidationIssue(
  issues: GraphValidationIssue[],
  issue: GraphValidationIssue,
) {
  if (!issues.some((existing) => existing.severity === issue.severity && existing.message === issue.message && existing.nodeId === issue.nodeId)) {
    issues.push(issue);
  }
}

function isBlankString(value: unknown): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

function validateStateSchemaEntries(
  schema: Array<{ name: string; type: string; reducer: string }> | undefined,
  issues: GraphValidationIssue[],
) {
  if (!schema) return;
  const seen = new Set<string>();
  schema.forEach((field, index) => {
    if (!SAFE_IDENTIFIER_RE.test(field.name || '')) {
      pushValidationIssue(issues, {
        severity: 'error',
        code: 'invalid_state_name',
        message: `State field "${field.name || `field_${index + 1}`}" must be a valid Python identifier before compile.`,
      });
    }
    if (!SAFE_TYPE_RE.test(field.type || '')) {
      pushValidationIssue(issues, {
        severity: 'error',
        code: 'invalid_state_type',
        message: `State field "${field.name || `field_${index + 1}`}" uses an unsupported Python type annotation.`,
      });
    }
    if (seen.has(field.name)) {
      pushValidationIssue(issues, {
        severity: 'error',
        code: 'duplicate_state_name',
        message: `State field "${field.name}" is duplicated.`,
      });
    }
    seen.add(field.name);
  });
}

function findReferencedChildTab(nodeId: string, tabs: Tab[]): Tab | undefined {
  return tabs.find((tab) => tab.scopeKind === 'subgraph' && tab.parentNodeId === nodeId);
}

function validateEditorState(state: Pick<AppState, 'nodes' | 'edges' | 'tabs' | 'activeTabId' | 'isAsync'>): GraphValidationResult {
  const base = validateGraph(state.nodes, state.edges);
  const issues: GraphValidationIssue[] = [];
  base.errors.forEach((message) => pushValidationIssue(issues, { severity: 'error', code: 'graph', message }));
  base.warnings.forEach((message) => pushValidationIssue(issues, { severity: 'warning', code: 'graph', message }));
  base.infos.forEach((message) => pushValidationIssue(issues, { severity: 'info', code: 'graph', message }));

  const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);
  const surface = {
    artifactType: activeTab?.artifactType || 'graph',
    executionProfile: activeTab?.executionProfile || (state.isAsync ? 'langgraph_async' : 'langgraph_sync'),
    projectMode: activeTab?.projectMode || 'langgraph',
  };

  if (activeTab?.runtimeSettings) {
    const recursionLimit = Number(activeTab.runtimeSettings.recursionLimit ?? 50);
    if (!Number.isFinite(recursionLimit) || recursionLimit < 1 || recursionLimit > 500) {
      pushValidationIssue(issues, {
        severity: 'error',
        code: 'runtime_recursion_limit',
        message: 'Runtime recursion limit must stay between 1 and 500 before compile/run.',
      });
    }
  }

  validateStateSchemaEntries(activeTab?.customStateSchema, issues);

  const toolIds = new Set(
    state.nodes
      .filter((node) => Boolean(NODE_DEFS[String(node.data?.nodeType || '')]?.isTool))
      .map((node) => node.id),
  );

  state.nodes.forEach((node) => {
    const nodeType = String(node.data?.nodeType || '');
    const nodeLabel = typeof node.data?.label === 'string' && node.data.label.trim() ? node.data.label.trim() : node.id;
    const params = getNodeParams(node.data);
    const nodeDef = NODE_DEFS[nodeType];

    if (!nodeDef && nodeType !== 'memory_store_read') {
      pushValidationIssue(issues, {
        severity: 'error',
        code: 'unknown_node_type',
        nodeId: node.id,
        message: `Node "${nodeLabel}" uses unknown type "${nodeType}" and cannot compile on the current trunk.`,
      });
      return;
    }

    if (!isNodeBackedByRuntime(nodeType)) {
      pushValidationIssue(issues, {
        severity: 'error',
        code: 'metadata_only_node',
        nodeId: node.id,
        message: `Node "${nodeLabel}" is metadata-only in this build and cannot compile/run visibly.`,
      });
    }

    if (!isNodeCompatibleWithSurface(nodeType, surface)) {
      pushValidationIssue(issues, {
        severity: 'warning',
        code: 'surface_mismatch',
        nodeId: node.id,
        message: `Node "${nodeLabel}" is a less natural fit for ${surface.artifactType}/${surface.executionProfile}.`,
      });
    }

    const requiredFields = [
      ...(nodeDef?.fields || []),
      ...(nodeDef?.advancedFields || []),
    ].filter((field) => field.required);
    requiredFields.forEach((field) => {
      const rawValue = params[field.key];
      const isMissing = (typeof rawValue === 'string' && rawValue.trim() === '')
        || rawValue === null
        || rawValue === undefined
        || (Array.isArray(rawValue) && rawValue.length === 0);
      if (isMissing) {
        pushValidationIssue(issues, {
          severity: 'error',
          code: 'missing_required_field',
          nodeId: node.id,
          message: `Node "${nodeLabel}" is missing required field "${field.label}".`,
        });
      }
    });

    const provider = typeof params.provider === 'string' ? params.provider.trim() : '';
    const normalizedProvider = normalizeProvider(provider);
    const providerMeta = getProviderMeta(normalizedProvider);
    if (provider && !KNOWN_PROVIDER_VALUES.has(normalizedProvider)) {
      pushValidationIssue(issues, {
        severity: 'error',
        code: 'invalid_provider',
        nodeId: node.id,
        message: `Node "${nodeLabel}" uses unsupported provider "${provider}".`,
      });
    }
    if (normalizedProvider && providerMeta?.uiSelectable === false) {
      pushValidationIssue(issues, {
        severity: 'warning',
        code: 'provider_surface_not_supported',
        nodeId: node.id,
        message: `Node "${nodeLabel}" uses provider "${normalizedProvider}", but this build does not model it truthfully for the current UI/runtime surface. ${providerMeta.unsupportedReason || ''}`.trim(),
      });
    }
    if (normalizedProvider && providerMeta?.requiresApiKeyEnv && isBlankString(params.api_key_env)) {
      pushValidationIssue(issues, {
        severity: 'warning',
        code: 'missing_api_key_env',
        nodeId: node.id,
        message: `Node "${nodeLabel}" does not declare an API key environment variable for provider "${normalizedProvider}".`,
      });
    }
    if (normalizedProvider && providerMeta?.requiresApiBaseUrl && isBlankString(params.api_base_url)) {
      pushValidationIssue(issues, {
        severity: 'warning',
        code: 'missing_api_base_url',
        nodeId: node.id,
        message: `Node "${nodeLabel}" uses provider "${normalizedProvider}" and should declare API Base URL for truthful runtime execution.`,
      });
    }

    if ((nodeType === 'llm_chat' || nodeType === 'react_agent') && isBlankString(params.model_name)) {
      pushValidationIssue(issues, {
        severity: 'warning',
        code: 'missing_model_name',
        nodeId: node.id,
        message: `Node "${nodeLabel}" has no explicit model name; runtime defaults will be used.`,
      });
    }

    if (nodeType === 'sub_agent' || nodeType === 'subgraph_node') {
      const targetSubgraph = typeof params.target_subgraph === 'string' ? params.target_subgraph.trim() : '';
      const artifactRefKind = typeof params.artifact_ref_kind === 'string' ? params.artifact_ref_kind.trim() : '';
      if (!targetSubgraph) {
        pushValidationIssue(issues, {
          severity: 'error',
          code: nodeType === 'subgraph_node' ? 'missing_subgraph_target' : 'missing_subagent_target',
          nodeId: node.id,
          message: nodeType === 'subgraph_node'
            ? `Node "${nodeLabel}" needs a child subgraph target before compile/run.`
            : `Node "${nodeLabel}" expects a referenced LangChain agent/subagent artifact before compile/run. Use subgraph_node for child subgraphs.`,
        });
      } else if (targetSubgraph.startsWith('artifact:')) {
        const explicitKind = artifactRefKind || targetSubgraph.split(':')[1]?.split('/')[0] || '';
        const explicitId = targetSubgraph.split('/').slice(1).join('/').trim();
        const artifactExecutionKind = typeof params.artifact_execution_kind === 'string' ? params.artifact_execution_kind : undefined;
        const bridge = getInteroperabilityBridge(explicitKind === 'agent' ? 'langchain' : explicitKind === 'deep_agent' ? 'deepagents' : 'langgraph', surface.projectMode as ProjectMode, explicitKind as ArtifactType, artifactExecutionKind as never);
        if (!explicitId) {
          pushValidationIssue(issues, {
            severity: 'error',
            code: 'invalid_subgraph_reference',
            nodeId: node.id,
            message: `Node "${nodeLabel}" points to an invalid artifact reference.`,
          });
        } else if (nodeType === 'subgraph_node' && explicitKind !== 'subgraph') {
          pushValidationIssue(issues, {
            severity: 'error',
            code: 'wrong_reference_family',
            nodeId: node.id,
            message: `Node "${nodeLabel}" is the graph-native subgraph surface and only accepts subgraph references. Use sub_agent for LangChain agent artifacts.`,
          });
        } else if (nodeType === 'sub_agent' && explicitKind !== 'agent') {
          pushValidationIssue(issues, {
            severity: 'error',
            code: 'wrong_reference_family',
            nodeId: node.id,
            message: `Node "${nodeLabel}" is the LangChain subagent surface and expects an agent artifact reference. Use subgraph_node for graph-native child subgraphs.`,
          });
        } else if (explicitKind === 'subgraph') {
          // direct child-graph bridge: valid
        } else if (bridge) {
          pushValidationIssue(issues, {
            severity: bridge.supportLevel === 'editor_package_only' ? 'warning' : 'info',
            code: 'wrapper_reference_bridge',
            nodeId: node.id,
            message: bridge.supportLevel === 'direct'
              ? `Node "${nodeLabel}" uses a supported ${explicitKind} wrapper bridge into ${surface.projectMode}.`
              : bridge.supportLevel === 'compile_capable'
                ? `Node "${nodeLabel}" references a ${explicitKind} artifact through a compile-capable bridge with explicit constraints.`
                : `Node "${nodeLabel}" references a ${explicitKind} artifact through an editor/package-only bridge. Compile/run stays blocked until an executable bridge exists.`,
          });
        } else {
          pushValidationIssue(issues, {
            severity: 'error',
            code: 'invalid_subgraph_reference',
            nodeId: node.id,
            message: `Node "${nodeLabel}" points to an unsupported artifact reference for ${surface.projectMode}.`,
          });
        }
      } else if (nodeType === 'subgraph_node') {
        if (!findReferencedChildTab(node.id, state.tabs)) {
          pushValidationIssue(issues, {
            severity: 'error',
            code: 'missing_child_subgraph',
            nodeId: node.id,
            message: `Node "${nodeLabel}" points to "${targetSubgraph}" but no editable child subgraph tab is attached to it.`,
          });
        }
      } else {
        pushValidationIssue(issues, {
          severity: 'error',
          code: 'subagent_requires_artifact_reference',
          nodeId: node.id,
          message: `Node "${nodeLabel}" is reserved for LangChain-derived subagents and must reference a saved agent artifact. Use subgraph_node for child subgraphs.`,
        });
      }
    }

    if (nodeType === 'memory_store_read') {
      ['namespace_prefix', 'user_id_key', 'output_key'].forEach((key) => {
        if (isBlankString(params[key])) {
          pushValidationIssue(issues, {
            severity: 'error',
            code: 'missing_memory_store_field',
            nodeId: node.id,
            message: `Node "${nodeLabel}" requires "${key}" before compile/run.`,
          });
        }
      });
    }

    const manualTools = Array.isArray(params.tools_linked) ? params.tools_linked.map((value) => String(value)) : [];
    const unknownTools = manualTools.filter((toolId) => !toolIds.has(toolId));
    if (unknownTools.length > 0) {
      pushValidationIssue(issues, {
        severity: 'error',
        code: 'unknown_tool_reference',
        nodeId: node.id,
        message: `Node "${nodeLabel}" references unknown tool ids: ${unknownTools.join(', ')}.`,
      });
    }

    if (nodeType === 'tool_sub_agent') {
      const subagentLibrary = activeTab?.runtimeSettings?.subagentLibrary || [];
      const targetGroup = typeof params.target_group === 'string' && params.target_group.trim() ? params.target_group.trim() : 'default';
      const groupEntry = subagentLibrary.find((group) => group.name === targetGroup);
      if (!groupEntry) {
        pushValidationIssue(issues, {
          severity: 'error',
          code: 'unknown_subagent_group',
          nodeId: node.id,
          message: `Node "${nodeLabel}" targets unknown subagent group "${targetGroup}". Define it in the Subagent Library first.`,
        });
      } else {
        const targetAgent = typeof params.target_agent === 'string' ? params.target_agent.trim() : '';
        if (targetAgent && !groupEntry.agents.some((agent) => agent.name === targetAgent)) {
          pushValidationIssue(issues, {
            severity: 'error',
            code: 'unknown_subagent_agent',
            nodeId: node.id,
            message: `Node "${nodeLabel}" targets unknown subagent "${targetAgent}" in group "${targetGroup}".`,
          });
        }
      }
    }

    if (typeof params.structured_schema_json === 'string' && params.structured_schema_json.trim()) {
      try {
        const parsed = JSON.parse(params.structured_schema_json);
        if (!Array.isArray(parsed)) {
          pushValidationIssue(issues, {
            severity: 'error',
            code: 'structured_schema_shape',
            nodeId: node.id,
            message: `Node "${nodeLabel}" must provide Structured Output schema JSON as an array of field definitions.`,
          });
        }
      } catch {
        pushValidationIssue(issues, {
          severity: 'error',
          code: 'structured_schema_parse',
          nodeId: node.id,
          message: `Node "${nodeLabel}" contains invalid Structured Output schema JSON.`,
        });
      }
    }

    if (nodeType === 'rag_retriever_local' && isBlankString(params.collection_name)) {
      pushValidationIssue(issues, {
        severity: 'warning',
        code: 'rag_collection_name',
        nodeId: node.id,
        message: `Node "${nodeLabel}" has no explicit Chroma collection name; the runtime may fall back awkwardly.`,
      });
    }
  });

  const errors = issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message);
  const warnings = issues.filter((issue) => issue.severity === 'warning').map((issue) => issue.message);
  const infos = issues.filter((issue) => issue.severity === 'info').map((issue) => issue.message);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    infos,
    issues,
    componentCount: base.components.length,
    orphanNodeIds: base.orphanNodeIds,
    secondaryNodeIds: base.secondaryNodeIds,
    detachedNodeIds: base.detachedNodeIds,
    detachedComponentCount: base.detachedComponentCount,
    semanticEdgeSummary: base.semanticEdgeSummary,
    graphScopeMarkerIds: base.graphScopeMarkerIds,
  };
}


function mergeBindings(localBindings: GraphBinding[], inheritedBindings: GraphBinding[]): GraphBinding[] {
  const merged = new Map<string, GraphBinding>();
  for (const binding of inheritedBindings) {
    merged.set(binding.name, binding);
  }
  for (const binding of localBindings) {
    merged.set(binding.name, binding);
  }
  return Array.from(merged.values());
}


function findTabByProjectId(tabs: Tab[], projectId: string | null | undefined): Tab | null {
  if (!projectId) return null;
  return tabs.find((tab) => tab.projectId === projectId) || null;
}

function resolveTabAncestors(tab: Tab | null | undefined, tabs: Tab[]): Tab[] {
  const ancestors: Tab[] = [];
  const seen = new Set<string>();
  let current = tab;
  while (current) {
    const parent = findParentTab(current, tabs);
    if (!parent || seen.has(parent.id)) break;
    ancestors.push(parent);
    seen.add(parent.id);
    current = parent;
  }
  return ancestors;
}

function resolveBindingsForTab(tab: Tab | null | undefined, tabs: Tab[]): GraphBinding[] {
  if (!tab) return [];
  const ancestors = tab.runtimeSettings?.inheritParentBindings ? resolveTabAncestors(tab, tabs).reverse() : [];
  let resolved: GraphBinding[] = [];
  for (const ancestor of ancestors) {
    resolved = mergeBindings(ancestor.graphBindings || [], resolved);
  }
  resolved = mergeBindings(tab.graphBindings || [], resolved);
  return resolved;
}

function buildScopeLineage(tab: Tab | null | undefined, tabs: Tab[]): string[] {
  if (!tab) return [];
  const ancestors = resolveTabAncestors(tab, tabs).reverse();
  return [...ancestors.map((ancestor) => ancestor.scopePath), tab.scopePath].filter(Boolean);
}

function makeScopeKey(tab: Pick<Tab, 'projectId' | 'scopePath' | 'parentNodeId'> | SerializedWorkspaceTab): string {
  return `${tab.projectId ?? 'local'}::${tab.scopePath}::${tab.parentNodeId ?? ''}`;
}

function syncActiveTabIntoTabs(state: Pick<AppState, 'tabs' | 'activeTabId' | 'nodes' | 'edges' | 'projectName' | 'isAsync'>): Tab[] {
  return state.tabs.map((t: Tab) =>
    t.id === state.activeTabId
      ? { ...t, nodes: state.nodes, edges: state.edges, projectName: state.projectName, isAsync: state.isAsync }
      : t,
  );
}

function findParentTab(tab: Tab | null | undefined, tabs: Tab[]): Tab | null {
  if (!tab) return null;
  if (tab.parentProjectId) {
    const byProject = tabs.find((candidate) => candidate.projectId === tab.parentProjectId);
    if (byProject) return byProject;
  }
  if (tab.parentTabId) {
    return tabs.find((candidate) => candidate.id === tab.parentTabId) || null;
  }
  return null;
}

function getRootTab(tab: Tab | null | undefined, tabs: Tab[]): Tab | null {
  if (!tab) return null;
  let current: Tab | null = tab;
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current.id)) break;
    seen.add(current.id);
    const parent = findParentTab(current, tabs);
    if (!parent) return current;
    current = parent;
  }
  return tab;
}

function isDescendantOfRoot(tab: Tab, root: Tab, tabs: Tab[]): boolean {
  if (tab.id === root.id) return false;
  let current: Tab | null = tab;
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current.id)) break;
    seen.add(current.id);
    const parent = findParentTab(current, tabs);
    if (!parent) return false;
    if (parent.id === root.id) return true;
    current = parent;
  }
  return false;
}

function serializeTab(tab: Tab): SerializedWorkspaceTab {
  return {
    projectId: tab.projectId,
    projectName: tab.projectName,
    nodes: tab.nodes,
    edges: tab.edges,
    parentProjectId: tab.parentProjectId ?? null,
    parentNodeId: tab.parentNodeId ?? null,
    customStateSchema: tab.customStateSchema || [],
    graphBindings: tab.graphBindings || [],
    isAsync: tab.isAsync,
    scopeKind: tab.scopeKind,
    scopePath: tab.scopePath,
    artifactType: normalizeWorkspaceArtifactType(tab.artifactType, tab.scopeKind),
    executionProfile: normalizeWorkspaceExecutionProfile(tab.executionProfile, tab.isAsync, tab.scopeKind, normalizeWorkspaceArtifactType(tab.artifactType, tab.scopeKind)),
    projectMode: tab.projectMode || inferProjectModeFromSurface(tab.artifactType, tab.executionProfile),
    runtimeSettings: sanitizeRuntimeSettings(tab.runtimeSettings, tab.projectMode || inferProjectModeFromSurface(tab.artifactType, tab.executionProfile)),
  };
}

function buildProjectPackageFromSnapshot(snapshot: WorkspaceTreeSnapshot): ProjectPackageSnapshot {
  const surfaceTruth = buildSurfaceTruthSummary({
    artifactType: snapshot.root.artifactType,
    executionProfile: snapshot.root.executionProfile,
    projectMode: snapshot.root.projectMode,
  });
  return {
    kind: 'project_package',
    version: 'langsuite.v23.package',
    packageType: 'editable_workspace',
    exportedAt: new Date().toISOString(),
    projectName: snapshot.root.projectName,
    surfaceTruth,
    summary: {
      childSubgraphCount: snapshot.children.length,
      includes: [
        'root graph',
        'known child subgraphs',
        'reopening metadata',
        'saved graph settings',
      ],
      excludes: [
        'runtime DB contents',
        'Chroma/vector store files',
        'external prompt/profile libraries',
        'future memory backends',
      ],
      layoutMetadataIncluded: false,
    },
    workspaceTree: snapshot,
  };
}

function extractWorkspaceSnapshotFromImport(data: unknown): WorkspaceTreeSnapshot | null {
  if (!data || typeof data !== 'object') return null;
  const candidate = data as Record<string, unknown>;
  const direct = candidate.workspaceTree;
  if (direct && typeof direct === 'object' && (direct as { version?: string }).version === 'langsuite.v21.workspace') {
    return direct as WorkspaceTreeSnapshot;
  }
  if (candidate.version === 'langsuite.v21.workspace') {
    return candidate as unknown as WorkspaceTreeSnapshot;
  }
  return null;
}

function buildWorkspaceSnapshotFromState(state: Pick<AppState, 'tabs' | 'activeTabId' | 'nodes' | 'edges' | 'projectName' | 'isAsync'>): WorkspaceTreeSnapshot | null {
  const syncedTabs = syncActiveTabIntoTabs(state);
  const active = syncedTabs.find((tab) => tab.id === state.activeTabId) || syncedTabs[0] || null;
  const root = getRootTab(active, syncedTabs);
  if (!root) return null;
  const children = syncedTabs.filter((tab) => isDescendantOfRoot(tab, root, syncedTabs));
  return {
    version: 'langsuite.v21.workspace',
    root: serializeTab(root),
    children: children.map(serializeTab),
    activeScopeKey: active ? makeScopeKey(active) : null,
    openChildScopeKeys: children.map((tab) => makeScopeKey(tab)),
  };
}

function hydrateWorkspaceSnapshot(snapshot: WorkspaceTreeSnapshot): { tabs: Tab[]; activeTabId: string; nodes: Node[]; edges: Edge[]; projectName: string; isAsync: boolean } {
  const rootTabId = makeTabId();
  const rootProjectMode: ProjectMode = normalizeProjectMode(snapshot.root.projectMode, normalizeWorkspaceArtifactType(snapshot.root.artifactType, 'project'), normalizeWorkspaceExecutionProfile(snapshot.root.executionProfile, typeof snapshot.root.isAsync === 'boolean' ? snapshot.root.isAsync : true, 'project', normalizeWorkspaceArtifactType(snapshot.root.artifactType, 'project')));
  const rootTab: Tab = {
    id: rootTabId,
    projectId: snapshot.root.projectId ?? null,
    projectName: snapshot.root.projectName,
    nodes: snapshot.root.nodes || [],
    edges: snapshot.root.edges || [],
    isDirty: false,
    parentProjectId: null,
    parentTabId: null,
    parentNodeId: null,
    customStateSchema: Array.isArray(snapshot.root.customStateSchema) ? snapshot.root.customStateSchema : [],
    graphBindings: Array.isArray(snapshot.root.graphBindings) ? snapshot.root.graphBindings : [],
    isAsync: typeof snapshot.root.isAsync === 'boolean' ? snapshot.root.isAsync : true,
    scopeKind: 'project',
    scopePath: snapshot.root.scopePath || buildScopePath(snapshot.root.projectName || 'Nouveau Projet'),
    artifactType: normalizeWorkspaceArtifactType(snapshot.root.artifactType, 'project'),
    executionProfile: normalizeWorkspaceExecutionProfile(snapshot.root.executionProfile, typeof snapshot.root.isAsync === 'boolean' ? snapshot.root.isAsync : true, 'project', normalizeWorkspaceArtifactType(snapshot.root.artifactType, 'project')),
    projectMode: rootProjectMode,
    runtimeSettings: sanitizeRuntimeSettings(snapshot.root.runtimeSettings, rootProjectMode),
  };

  const legacyProjectToTabId = new Map<string, string>();
  if (snapshot.root.projectId) legacyProjectToTabId.set(snapshot.root.projectId, rootTab.id);

  const children = (snapshot.children || []).map((child) => {
    const childProjectMode: ProjectMode = normalizeProjectMode(child.projectMode, normalizeWorkspaceArtifactType(child.artifactType, 'subgraph'), normalizeWorkspaceExecutionProfile(child.executionProfile, typeof child.isAsync === 'boolean' ? child.isAsync : true, 'subgraph', normalizeWorkspaceArtifactType(child.artifactType, 'subgraph')));
    const childTab: Tab = {
      id: makeTabId(),
      projectId: child.projectId ?? null,
      projectName: child.projectName,
      nodes: child.nodes || [],
      edges: child.edges || [],
      isDirty: false,
      parentProjectId: child.parentProjectId ?? rootTab.projectId ?? null,
      parentTabId: rootTab.id,
      parentNodeId: child.parentNodeId ?? null,
      customStateSchema: Array.isArray(child.customStateSchema) ? child.customStateSchema : [],
      graphBindings: Array.isArray(child.graphBindings) ? child.graphBindings : [],
      isAsync: typeof child.isAsync === 'boolean' ? child.isAsync : true,
      scopeKind: 'subgraph' as const,
      scopePath: child.scopePath || buildScopePath(child.projectName || 'Subgraph', child.parentNodeId),
      artifactType: normalizeWorkspaceArtifactType(child.artifactType, 'subgraph'),
      executionProfile: normalizeWorkspaceExecutionProfile(child.executionProfile, typeof child.isAsync === 'boolean' ? child.isAsync : true, 'subgraph', normalizeWorkspaceArtifactType(child.artifactType, 'subgraph')),
      projectMode: childProjectMode,
      runtimeSettings: sanitizeRuntimeSettings(child.runtimeSettings, childProjectMode),
    };
    if (child.projectId) legacyProjectToTabId.set(child.projectId, childTab.id);
    return childTab;
  });

  const tabs = [rootTab, ...children].map((tab) => {
    if (!tab.parentProjectId) return tab;
    const parentTabId = legacyProjectToTabId.get(tab.parentProjectId);
    return { ...tab, parentTabId: parentTabId ?? tab.parentTabId ?? rootTab.id };
  });
  const activeTab = tabs.find((tab) => makeScopeKey(tab) === snapshot.activeScopeKey) || rootTab;
  const maxId = tabs.flatMap((tab) => tab.nodes).reduce((max: number, n: Node) => {
    const match = n.id.match(/_(\d+)$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  nodeCounter = maxId;

  return {
    tabs,
    activeTabId: activeTab.id,
    nodes: activeTab.nodes,
    edges: activeTab.edges,
    projectName: activeTab.projectName,
    isAsync: activeTab.isAsync,
  };
}

export interface AppState {
  nodes: Node[];
  edges: Edge[];
  projectName: string;
  isAsync: boolean;
  sidebarOpen: boolean;
  sidebarPosition: 'left' | 'right';
  runPanelOpen: boolean;
  compiling: boolean;
  editorMode: EditorMode;
  preferences: Preferences;

  graphValidation: GraphValidationResult | null;
  capabilityInspectorTarget: CapabilityInspectorTarget | null;

  tabs: Tab[];
  activeTabId: string;

  runLogs: RunLogEntry[];
  isRunning: boolean;
  isPaused: boolean;
  pendingNodeId: string | null;
  runWs: WebSocket | null;
  liveState: Record<string, unknown>;
  liveStateNext: string[];
  runtimeFocusRequest: RuntimeFocusRequest | null;
  runtimeHoverTarget: RuntimeHoverTarget | null;
  runtimeEdgeLegend: RuntimeEdgeLegendSettings;
  runtimeNavigationSettings: RuntimeNavigationSettings;
  activeRightPanel: 'debug' | 'state' | 'collab' | null;
  panelPlacements: Record<'debug' | 'state' | 'collab' | 'blocks', { side: 'left' | 'right'; open: boolean }>;
  debugPanelOpen: boolean;
  _debugUserClosed: boolean;

  projectManagerOpen: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastImportReport: ImportDiagnostic | null;

  sessionId: string | null;
  username: string;
  connectedUsers: string[];
  collabOpen: boolean;
  ws: WebSocket | null;
  _syncing: boolean;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: string, position: { x: number; y: number }) => void;
  addNodeWithParams: (type: string, position: { x: number; y: number }, params: Record<string, unknown>) => string | null;
  addArtifactWrapperNode: (kind: ArtifactType, artifactId: string, title: string, artifactExecutionKind?: 'lowered_bridge' | 'embedded_native') => void;
  updateNodeParam: (nodeId: string, key: string, value: unknown) => void;
  deleteSelected: () => void;
  selectNodesByIds: (ids: string[]) => void;
  toggleSidebar: () => void;
  setSidebarPosition: (pos: 'left' | 'right') => void;
  toggleRunPanel: () => void;
  setProjectName: (name: string) => void;
  setIsAsync: (v: boolean) => void;
  setCompiling: (v: boolean) => void;
  setEditorMode: (mode: EditorMode) => void;
  updatePreferences: (patch: Partial<Preferences>) => void;
  applyWorkspacePreset: (preset: WorkspacePreset) => void;
  resetLayout: () => void;
  saveProject: () => void;
  saveProjectToDb: () => Promise<void>;
  loadProject: (json: string) => ImportDiagnostic;
  loadProjectFromDb: (projectId: string) => Promise<void>;
  exportJson: () => string;
  exportProjectPackage: () => string;
  clearImportReport: () => void;
  runValidation: () => GraphValidationResult;
  clearValidation: () => void;

  openTab: (projectId: string | null, name: string, nodes: Node[], edges: Edge[], customStateSchema?: { name: string; type: string; reducer: string }[], isAsync?: boolean, meta?: { parentProjectId?: string | null; parentTabId?: string | null; parentNodeId?: string | null; scopeKind?: GraphScopeKind; scopePath?: string; graphBindings?: GraphBinding[]; artifactType?: ArtifactType; executionProfile?: ExecutionProfile; projectMode?: ProjectMode; runtimeSettings?: Partial<RuntimeSettings> }) => void;
  closeTab: (tabId: string) => void;
  switchTab: (tabId: string) => void;
  renameTab: (tabId: string, name: string) => void;
  toggleProjectManager: () => void;

  connectRunWebSocket: () => void;
  startRun: (inputs?: Record<string, unknown>) => void;
  sendResume: (response: string) => void;
  stopRun: () => void;
  clearRunLogs: () => void;
  disconnectRunWs: () => void;
  toggleDebugPanel: () => void;

  _markActiveTabDirty: () => void;
  _triggerAutoSave: () => void;

  setActiveRightPanel: (panel: 'debug' | 'state' | 'collab' | null) => void;
  togglePanel: (panel: 'debug' | 'state' | 'collab' | 'blocks') => void;
  setPanelSide: (panel: 'debug' | 'state' | 'collab' | 'blocks', side: 'left' | 'right') => void;
  toggleCollab: () => void;
  setUsername: (name: string) => void;
  createSession: () => Promise<void>;
  joinSession: (sessionId: string) => Promise<void>;
  leaveSession: () => void;
  sendSync: () => void;
  statePanelOpen: boolean;
  toggleStatePanel: () => void;
  updateCustomStateSchema: (schema: { name: string; type: string; reducer: string }[]) => void;
  updateGraphBindings: (bindings: GraphBinding[]) => void;
  updateArtifactType: (artifactType: ArtifactType) => void;
  updateExecutionProfile: (profile: ExecutionProfile) => void;
  updateRuntimeSettings: (settings: Partial<RuntimeSettings>) => void;
  setCapabilityInspectorTarget: (target: CapabilityInspectorTarget | null) => void;
  requestRuntimeFocus: (nodeId: string, source?: RuntimeFocusRequest['source']) => void;
  clearRuntimeFocusRequest: () => void;
  setRuntimeHoverTarget: (nodeId: string, source?: RuntimeHoverTarget['source']) => void;
  clearRuntimeHoverTarget: (source?: RuntimeHoverTarget['source'], nodeId?: string) => void;
  updateRuntimeEdgeLegend: (patch: Partial<RuntimeEdgeLegendSettings>) => void;
  updateRuntimeNavigationSettings: (patch: Partial<RuntimeNavigationSettings>) => void;
  openSubgraphTabFromNode: (nodeId: string) => Promise<void>;
}

function getWsBase(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}`;
}

export const useAppStore = create<AppState>()((set, get) => ({
  nodes: [],
  edges: [],
  projectName: 'Nouveau Projet',
  isAsync: true,
  sidebarOpen: true,
  sidebarPosition: 'left',
  runPanelOpen: false,
  compiling: false,
  editorMode: getInitialEditorMode(),
  preferences: getInitialPreferences(),

  graphValidation: null,
  capabilityInspectorTarget: null,

  tabs: [{ ...makeEmptyRootTab(makeTabId, 'Nouveau Projet'), id: defaultTabId }],
  activeTabId: defaultTabId,

  runLogs: [],
  isRunning: false,
  isPaused: false,
  pendingNodeId: null,
  runWs: null,
  liveState: {},
  liveStateNext: [],
  runtimeFocusRequest: null,
  runtimeHoverTarget: null,
  runtimeEdgeLegend: { showTraversed: true, showScheduled: true, showMuted: true },
  runtimeNavigationSettings: { followActiveNode: false, lockHover: false, autoScrollMatchingLogs: false },
  activeRightPanel: null,
  panelPlacements: {
    blocks: { side: 'left', open: true },
    debug: { side: 'right', open: false },
    state: { side: 'right', open: false },
    collab: { side: 'right', open: false },
  },
  debugPanelOpen: false,
  _debugUserClosed: false,

  projectManagerOpen: false,
  saveStatus: 'idle',
  lastImportReport: null,

  setEditorMode: (mode: EditorMode) => {
    try {
      window.localStorage.setItem(EDITOR_MODE_STORAGE_KEY, mode);
    } catch {
      // ignore storage failures
    }
    set({ editorMode: mode });
  },

  updatePreferences: (patch: Partial<Preferences>) => {
    const current = get().preferences;
    const next = sanitizePreferences({ ...current, ...patch });
    try {
      window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
      if (patch.defaultEditorMode) {
        window.localStorage.setItem(EDITOR_MODE_STORAGE_KEY, next.defaultEditorMode);
      }
    } catch {
      // ignore storage failures
    }
    if (!next.autosaveEnabled && autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
    set((state) => ({
      preferences: next,
      editorMode: patch.defaultEditorMode ? next.defaultEditorMode : state.editorMode,
    }));
  },

  applyWorkspacePreset: (preset: WorkspacePreset) => {
    get().updatePreferences(getWorkspacePresetPatch(preset));
  },

  resetLayout: () => {
    const current = get().preferences;
    const next = sanitizePreferences({
      ...current,
      blocksPanelWidth: 196,
      debugPanelWidth: 184,
      statePanelWidth: 208,
      runPanelHeightPercent: 30,
    });
    try {
      window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage failures
    }
    set({
      preferences: next,
      panelPlacements: {
        blocks: { side: 'left', open: true },
        debug: { side: 'right', open: false },
        state: { side: 'right', open: false },
        collab: { side: 'right', open: false },
      },
      sidebarOpen: true,
      sidebarPosition: 'left',
      runPanelOpen: false,
      collabOpen: false,
      debugPanelOpen: false,
      statePanelOpen: false,
      activeRightPanel: null,
    });
  },

  sessionId: null,
  username: loadStoredSessionAlias(),
  connectedUsers: [],
  collabOpen: false,
  ws: null,
  _syncing: false,

  onNodesChange: (changes: NodeChange[]) => {
    set({ nodes: applyNodeChanges(changes, get().nodes), graphValidation: null });
    get()._markActiveTabDirty();
    if (!get()._syncing) get().sendSync();
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    const removedEdges = changes
      .filter((c) => c.type === 'remove')
      .map((c: EdgeChange) => get().edges.find((e: Edge) => e.id === (c as { id: string }).id))
      .filter(Boolean) as Edge[];

    set({ edges: applyEdgeChanges(changes, get().edges), graphValidation: null });

    for (const edge of removedEdges) {
      if (edge.sourceHandle === 'tool_out' && edge.targetHandle === 'tools_in') {
        const sourceNode = get().nodes.find((n: Node) => n.id === edge.source);
        const targetNode = get().nodes.find((n: Node) => n.id === edge.target);
        if (sourceNode && targetNode) {
          const toolId = sourceNode.id; // <-- CORRECTION ICI
          const linked = (getNodeParams(targetNode.data).tools_linked as string[]) || [];
          const updated = linked.filter((t: string) => t !== toolId);
          get().updateNodeParam(edge.target, 'tools_linked', updated);
        }
      }
    }

    get()._markActiveTabDirty();
    if (!get()._syncing) get().sendSync();
  },

  onConnect: (connection: Connection) => {
    const currentNodes = get().nodes;
    const currentEdges = get().edges;
    const affordance = validateConnectionAffordance(connection, currentNodes, currentEdges);
    if (!affordance.valid) return;
    const decoration = decorateConnectionEdge(connection, currentNodes);
    set({ edges: addEdge({ ...connection, animated: true, ...decoration }, currentEdges), graphValidation: null });

    if (connection.sourceHandle === 'tool_out' && connection.targetHandle === 'tools_in') {
      const sourceNode = currentNodes.find((n: Node) => n.id === connection.source);
      const targetNode = currentNodes.find((n: Node) => n.id === connection.target);
      const sourceDef = sourceNode ? NODE_DEFS[sourceNode.data.nodeType as string] : null;
      const targetDef = targetNode ? NODE_DEFS[targetNode.data.nodeType as string] : null;
      if (sourceNode && targetNode && sourceDef?.isTool && targetDef?.fields?.some((f: { key: string }) => f.key === 'tools_linked')) {
        const toolId = sourceNode.id;
        const linked = (getNodeParams(targetNode.data).tools_linked as string[]) || [];
        if (!linked.includes(toolId)) {
          get().updateNodeParam(connection.target, 'tools_linked', [...linked, toolId]);
        }
      }
    }

    get()._markActiveTabDirty();
    if (!get()._syncing) get().sendSync();
  },

  addNode: (type: string, position: { x: number; y: number }) => {
    get().addNodeWithParams(type, position, {});
  },

  addNodeWithParams: (type: string, position: { x: number; y: number }, paramsOverride: Record<string, unknown>) => {
    const def = NODE_DEFS[type];
    if (!def) return null;
    nodeCounter++;
    const id = `${type}_${nodeCounter}`;
    const newNode: Node = {
      id,
      type: 'custom',
      position,
      data: {
        nodeType: type,
        label: `${def.label} ${nodeCounter}`,
        params: { ...def.defaultParams, ...paramsOverride },
      },
    };
    set({ nodes: [...get().nodes, newNode] });
    get()._markActiveTabDirty();
    if (!get()._syncing) get().sendSync();
    return id;
  },

  addArtifactWrapperNode: (kind: ArtifactType, artifactId: string, title: string, artifactExecutionKind?: 'lowered_bridge' | 'embedded_native') => {
    const wrapperType = getSuggestedWrapperNodeType(kind);
    const def = NODE_DEFS[wrapperType];
    if (!def) return;
    nodeCounter++;
    const id = `${wrapperType}_${nodeCounter}`;
    const offset = get().nodes.length * 24;
    const params: Record<string, unknown> = {
      ...def.defaultParams,
      target_subgraph: `artifact:${kind}/${artifactId}`,
      artifact_ref_kind: kind,
      artifact_ref_id: artifactId,
      artifact_ref_title: title,
      wrapper_mode: kind === 'graph' ? 'semi_opaque' : kind === 'deep_agent' ? 'opaque' : 'transparent',
      ...(artifactExecutionKind ? { artifact_execution_kind: artifactExecutionKind } : {}),
    };
    if (wrapperType === 'sub_agent') {
      params.description = params.description || `Wrapper vers ${title}`;
    }
    if (wrapperType === 'deep_agent_suite') {
      params.description = params.description || `Suite Deep Agents vers ${title}`;
    }
    const newNode: Node = {
      id,
      type: 'custom',
      position: { x: 160 + offset, y: 120 + offset },
      data: {
        nodeType: wrapperType,
        label: `${def.label} ${nodeCounter}`,
        params,
      },
    };
    set({ nodes: [...get().nodes, newNode] });
    get()._markActiveTabDirty();
    if (!get()._syncing) get().sendSync();
  },

  updateNodeParam: (nodeId: string, key: string, value: unknown) => {
    set({
      nodes: get().nodes.map((n: Node) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, params: { ...getNodeParams(n.data), [key]: value } } }
          : n,
      ),
    });
    get()._markActiveTabDirty();
    if (!get()._syncing) get().sendSync();
  },

  deleteSelected: () => {
    set({
      nodes: get().nodes.filter((n: Node) => !n.selected),
      edges: get().edges.filter((e: Edge) => !e.selected),
    });
    get()._markActiveTabDirty();
    if (!get()._syncing) get().sendSync();
  },

  selectNodesByIds: (ids: string[]) => {
    const wanted = new Set(ids);
    set({
      nodes: get().nodes.map((node: Node) => ({ ...node, selected: wanted.has(node.id) })),
      edges: get().edges.map((edge: Edge) => ({ ...edge, selected: false })),
    });
  },

  toggleSidebar: () => {
    const pp = { ...get().panelPlacements };
    pp.blocks = { ...pp.blocks, open: !pp.blocks.open };
    set({ sidebarOpen: pp.blocks.open, panelPlacements: pp });
  },
  setSidebarPosition: (pos: 'left' | 'right') => {
    const pp = { ...get().panelPlacements };
    pp.blocks = { ...pp.blocks, side: pos };
    set({ sidebarPosition: pos, panelPlacements: pp });
  },
  toggleRunPanel: () => set({ runPanelOpen: !get().runPanelOpen }),
  setProjectName: (name: string) => {
    const { tabs, activeTabId } = get();
    set({
      projectName: name,
      tabs: tabs.map((t: Tab) =>
        t.id === activeTabId
          ? { ...t, projectName: name, scopePath: buildScopePath(name, t.parentNodeId) }
          : t,
      ),
    });
    get()._markActiveTabDirty();
    if (!get()._syncing) get().sendSync();
  },
  setIsAsync: (v: boolean) => {
    set((state: AppState) => ({
      isAsync: v,
      tabs: state.tabs.map((t: Tab) => t.id === state.activeTabId ? { ...t, isAsync: v, executionProfile: isLegacyExecutionProfile(t.executionProfile) ? t.executionProfile : defaultExecutionProfile(v, t.artifactType), isDirty: true } : t),
    }));
    get()._markActiveTabDirty();
    if (!get()._syncing) get().sendSync();
  },
  setCompiling: (v: boolean) => set({ compiling: v }),

  saveProject: () => {
    const snapshot = buildWorkspaceSnapshotFromState(get());
    if (!snapshot) return;
    localStorage.setItem('langgraph-builder-project', JSON.stringify({ workspaceTree: snapshot }, null, 2));
    get().saveProjectToDb();
  },

  saveProjectToDb: async () => {
    const snapshot = buildWorkspaceSnapshotFromState(get());
    if (!snapshot) return;

    set({ saveStatus: 'saving' });
    try {
      const syncedTabs = syncActiveTabIntoTabs(get());
      const active = syncedTabs.find((tab) => tab.id === get().activeTabId) || syncedTabs[0] || null;
      const root = getRootTab(active, syncedTabs);
      if (!root) return;
      const descendants = syncedTabs.filter((tab) => isDescendantOfRoot(tab, root, syncedTabs) && Boolean(tab.parentNodeId));
      const workspaceMeta = {
        version: 'langsuite.v21.workspace',
        activeScopeKey: snapshot.activeScopeKey,
        openChildScopeKeys: snapshot.openChildScopeKeys,
      };

      const rootPayload = JSON.stringify({
        nodes: root.nodes,
        edges: root.edges,
        isAsync: root.isAsync,
        customStateSchema: root.customStateSchema || [],
        graphBindings: root.graphBindings || [],
        scopeKind: root.scopeKind,
        scopePath: root.scopePath,
        artifactType: root.artifactType,
        executionProfile: root.executionProfile,
        projectMode: root.projectMode,
        runtimeSettings: root.runtimeSettings,
        workspaceMeta,
      });

      let rootProjectId = root.projectId;
      if (rootProjectId) {
        await fetch(`/api/projects/${rootProjectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: root.projectName, data: rootPayload }),
        });
      } else {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: root.projectName, data: rootPayload, parent_project_id: null, parent_node_id: null }),
        });
        const project = await res.json();
        rootProjectId = project.id;
      }

      const assignedProjectIds = new Map<string, string>();
      if (rootProjectId) assignedProjectIds.set(root.id, rootProjectId);
      const descendantsSorted = [...descendants].sort((a, b) => resolveTabAncestors(a, syncedTabs).length - resolveTabAncestors(b, syncedTabs).length);

      for (const child of descendantsSorted) {
        const parent = findParentTab(child, syncedTabs) || root;
        const parentDbId = parent.projectId || assignedProjectIds.get(parent.id) || rootProjectId || null;
        const childPayload = JSON.stringify({
          nodes: child.nodes,
          edges: child.edges,
          isAsync: child.isAsync,
          customStateSchema: child.customStateSchema || [],
          graphBindings: child.graphBindings || [],
          scopeKind: 'subgraph',
          scopePath: child.scopePath,
          artifactType: child.artifactType,
          executionProfile: child.executionProfile,
          projectMode: child.projectMode,
          runtimeSettings: child.runtimeSettings,
        });

        if (child.projectId) {
          await fetch(`/api/projects/${child.projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: child.projectName, data: childPayload }),
          });
          assignedProjectIds.set(child.id, child.projectId);
        } else {
          const res = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: child.projectName,
              data: childPayload,
              parent_project_id: parentDbId,
              parent_node_id: child.parentNodeId ?? null,
            }),
          });
          const project = await res.json();
          if (project?.id) assignedProjectIds.set(child.id, project.id);
        }
      }

      if (rootProjectId) {
        try {
          const treeRes = await fetch(`/api/projects/${rootProjectId}/tree`);
          if (treeRes.ok) {
            const tree = await treeRes.json();
            const keepIds = new Set<string>([rootProjectId, ...Array.from(assignedProjectIds.values())]);
            const flattenTree = (node: Record<string, unknown> | null | undefined): Array<Record<string, unknown>> => {
              if (!node || typeof node !== 'object') return [];
              const children = Array.isArray((node as { subgraphs?: unknown }).subgraphs) ? (node as { subgraphs: Record<string, unknown>[] }).subgraphs : [];
              return children.flatMap((child) => [child, ...flattenTree(child)]);
            };
            const staleRows = flattenTree(tree).filter((row) => typeof row.id === 'string' && !keepIds.has(row.id));
            for (const row of staleRows) {
              const existingData = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data && typeof row.data === 'object' ? row.data : {});
              const existingMeta = existingData.workspaceMeta && typeof existingData.workspaceMeta === 'object' ? existingData.workspaceMeta : {};
              existingData.workspaceMeta = {
                ...existingMeta,
                staleChild: true,
                hiddenFromProjectTree: true,
                staleMarkedAt: new Date().toISOString(),
                staleFromRootProjectId: rootProjectId,
              };
              await fetch(`/api/projects/${row.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: JSON.stringify(existingData) }),
              });
            }
          }
        } catch (cleanupErr) {
          console.warn('Soft cleanup of stale child rows failed:', cleanupErr);
        }
      }

      set({
        saveStatus: 'saved',
        tabs: syncedTabs.map((tab) => ({
          ...tab,
          projectId: assignedProjectIds.get(tab.id) ?? (tab.id === root.id ? rootProjectId ?? tab.projectId : tab.projectId),
          parentProjectId: tab.id === root.id ? null : (findParentTab(tab, syncedTabs)?.projectId || assignedProjectIds.get(findParentTab(tab, syncedTabs)?.id || '') || tab.parentProjectId || rootProjectId || null),
          isDirty: false,
        })),
      });
      setTimeout(() => set({ saveStatus: 'idle' }), 2000);
    } catch (err) {
      console.error('Save to DB failed:', err);
      set({ saveStatus: 'error' });
      setTimeout(() => set({ saveStatus: 'idle' }), 3000);
    }
  },

  loadProject: (json: string) => {
    let report: ImportDiagnostic;
    try {
      const data = JSON.parse(json);
      const isV23Package = isObjectRecord(data) && data.kind === 'project_package' && data.version === 'langsuite.v23.package';
      if (isV23Package) {
        const rawSurfaceTruth = isObjectRecord((data as Record<string, unknown>).surfaceTruth) ? (data as Record<string, unknown>).surfaceTruth as Record<string, unknown> : null;
        const packageSummary = isObjectRecord((data as Record<string, unknown>).summary) ? (data as Record<string, unknown>).summary as Record<string, unknown> : null;
        const workspaceResult = parseWorkspaceSnapshotForImport((data as Record<string, unknown>).workspaceTree);
        if (workspaceResult.snapshot) {
          const packageSurfaceTruth = buildSurfaceTruthSummary({
            artifactType: typeof rawSurfaceTruth?.artifactType === 'string' ? rawSurfaceTruth.artifactType : workspaceResult.snapshot.root.artifactType,
            executionProfile: typeof rawSurfaceTruth?.executionProfile === 'string' ? rawSurfaceTruth.executionProfile : workspaceResult.snapshot.root.executionProfile,
            projectMode: typeof rawSurfaceTruth?.projectMode === 'string' ? rawSurfaceTruth.projectMode : workspaceResult.snapshot.root.projectMode,
          });
          const hydrated = hydrateWorkspaceSnapshot(workspaceResult.snapshot);
          set({
            tabs: hydrated.tabs,
            activeTabId: hydrated.activeTabId,
            nodes: hydrated.nodes,
            edges: hydrated.edges,
            projectName: hydrated.projectName,
            isAsync: hydrated.isAsync,
            graphValidation: null,
          });
          report = createImportDiagnostic({
            status: workspaceResult.warnings.length > 0 ? 'warning' : 'success',
            format: 'v23_package',
            title: workspaceResult.warnings.length > 0 ? 'Project package imported with warnings' : 'Project package imported',
            message: workspaceResult.warnings.length > 0
              ? `Restored the editable workspace partially. ${workspaceResult.warnings.join(' ')}`
              : 'Restored the editable workspace only from a truthful project package.',
            accepted: ['root graph', ...(workspaceResult.snapshot.children.length > 0 ? ['known child subgraphs'] : []), 'saved graph settings'],
            missing: workspaceResult.missing,
            partialRecovery: workspaceResult.warnings.length > 0,
            surfaceTruth: packageSurfaceTruth,
            packageIncludes: Array.isArray(packageSummary?.includes) ? (packageSummary?.includes as string[]) : [],
            packageExcludes: Array.isArray(packageSummary?.excludes) ? (packageSummary?.excludes as string[]) : [],
          });
          set({ lastImportReport: report });
          return report;
        }
        report = buildInvalidImportDiagnostic('Project package was damaged or missing its editable workspace tree.', workspaceResult.missing.length > 0 ? workspaceResult.missing : ['editable workspace tree']);
        set({ lastImportReport: report });
        return report;
      }

      const workspaceSnapshot = extractWorkspaceSnapshotFromImport(data);
      if (workspaceSnapshot || (isObjectRecord(data) && 'root' in data)) {
        const workspaceResult = parseWorkspaceSnapshotForImport(workspaceSnapshot ?? data);
        if (workspaceResult.snapshot) {
          const hydrated = hydrateWorkspaceSnapshot(workspaceResult.snapshot);
          set({
            tabs: hydrated.tabs,
            activeTabId: hydrated.activeTabId,
            nodes: hydrated.nodes,
            edges: hydrated.edges,
            projectName: hydrated.projectName,
            isAsync: hydrated.isAsync,
            graphValidation: null,
          });
          report = createImportDiagnostic({
            status: 'warning',
            format: 'workspace_tree_fallback',
            title: 'Older workspace-tree JSON imported',
            message: workspaceResult.warnings.length > 0
              ? `Fallback loader used for older workspace-tree JSON. Restored the editable workspace partially. ${workspaceResult.warnings.join(' ')}`
              : 'Fallback loader used for older workspace-tree JSON. Restored the editable workspace only.',
            accepted: ['root graph', ...(workspaceResult.snapshot.children.length > 0 ? ['known child subgraphs'] : []), 'saved graph settings'],
            missing: workspaceResult.missing,
            fallbackUsed: true,
            partialRecovery: workspaceResult.warnings.length > 0,
          });
          set({ lastImportReport: report });
          return report;
        }
      }

      const record = data as Record<string, unknown>;
      const loadedNodes = Array.isArray(record.nodes) ? record.nodes as Node[] : [];
      const loadedEdges = Array.isArray(record.edges) ? record.edges as Edge[] : [];
      const looksLikeSingleGraph = loadedNodes.length > 0 || loadedEdges.length > 0 || typeof record.projectName === 'string';
      if (looksLikeSingleGraph) {
        const maxId = loadedNodes.reduce((max: number, n: Node) => {
          const match = n.id.match(/_(\d+)$/);
          return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);
        nodeCounter = maxId;
        const loadedIsAsync = typeof record.isAsync === 'boolean' ? record.isAsync : true;
        const loadedSchema = Array.isArray(record.customStateSchema) ? record.customStateSchema as Tab['customStateSchema'] : [];
        const loadedBindings = Array.isArray(record.graphBindings) ? record.graphBindings as GraphBinding[] : [];
        const loadedProjectName = typeof record.projectName === 'string' && record.projectName.trim() ? record.projectName : 'Imported Project';
        const loadedArtifactType: ArtifactType = normalizeWorkspaceArtifactType(record.artifactType, record.scopeKind === 'subgraph' ? 'subgraph' : 'project');
        const loadedExecutionProfile: ExecutionProfile = normalizeWorkspaceExecutionProfile(record.executionProfile, loadedIsAsync, record.scopeKind === 'subgraph' ? 'subgraph' : 'project', loadedArtifactType);
        const loadedRuntimeSettings = sanitizeRuntimeSettings(isObjectRecord(record.runtimeSettings) ? record.runtimeSettings as Partial<RuntimeSettings> : undefined);
        set({
          projectName: loadedProjectName,
          nodes: loadedNodes,
          edges: loadedEdges,
          isAsync: loadedIsAsync,
          tabs: get().tabs.map((t: Tab) => t.id === get().activeTabId ? {
            ...t,
            projectName: loadedProjectName,
            nodes: loadedNodes,
            edges: loadedEdges,
            customStateSchema: loadedSchema,
            graphBindings: loadedBindings,
            isAsync: loadedIsAsync,
            scopeKind: record.scopeKind === 'subgraph' ? 'subgraph' : t.scopeKind,
            scopePath: typeof record.scopePath === 'string' && record.scopePath.trim() ? record.scopePath : buildScopePath(loadedProjectName, t.parentNodeId),
            artifactType: normalizeWorkspaceArtifactType(loadedArtifactType, record.scopeKind === 'subgraph' ? 'subgraph' : t.scopeKind),
            executionProfile: normalizeWorkspaceExecutionProfile(loadedExecutionProfile, loadedIsAsync, record.scopeKind === 'subgraph' ? 'subgraph' : t.scopeKind, normalizeWorkspaceArtifactType(loadedArtifactType, record.scopeKind === 'subgraph' ? 'subgraph' : t.scopeKind)),
            runtimeSettings: loadedRuntimeSettings,
            isDirty: false,
          } : t),
          graphValidation: null,
        });
        report = createImportDiagnostic({
          status: 'warning',
          format: 'single_graph_fallback',
          title: 'Single-graph JSON imported',
          message: 'Fallback loader used for older single-graph JSON. Restored the active editable graph only.',
          accepted: ['root graph'],
          missing: ['known child subgraphs'],
          fallbackUsed: true,
          partialRecovery: true,
        });
        set({ lastImportReport: report });
        return report;
      }

      report = buildInvalidImportDiagnostic('Import file was not recognized as a truthful project package or editable project JSON.', ['recognized editable workspace payload']);
      set({ lastImportReport: report });
      return report;
    } catch {
      report = buildInvalidImportDiagnostic('Import file could not be parsed as JSON.', ['valid JSON']);
      console.error('Invalid project file');
      set({ lastImportReport: report });
      return report;
    }
  },


  loadProjectFromDb: async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tree`);
      if (!res.ok) throw new Error('Project tree not found');
      const project = await res.json();
      const parseProjectData = (raw: unknown) => typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
      const rootData = parseProjectData(project.data);
      const workspaceMeta = rootData.workspaceMeta || {};
      const flattenChildren = (items: Array<Record<string, unknown>> | undefined, parentProjectId: string | null): SerializedWorkspaceTab[] => {
        if (!Array.isArray(items)) return [];
        const out: SerializedWorkspaceTab[] = [];
        for (const item of items) {
          const data = parseProjectData(item.data);
          out.push({
            projectId: typeof item.id === 'string' ? item.id : null,
            projectName: typeof item.name === 'string' ? item.name : 'Subgraph',
            nodes: data.nodes || [],
            edges: data.edges || [],
            parentProjectId: parentProjectId,
            parentNodeId: typeof item.parent_node_id === 'string' ? item.parent_node_id : null,
            customStateSchema: Array.isArray(data.customStateSchema) ? data.customStateSchema : [],
            graphBindings: Array.isArray(data.graphBindings) ? data.graphBindings : [],
            isAsync: typeof data.isAsync === 'boolean' ? data.isAsync : true,
            scopeKind: 'subgraph',
            scopePath: typeof data.scopePath === 'string' && data.scopePath.trim() ? data.scopePath : buildScopePath(typeof item.name === 'string' ? item.name : 'Subgraph', typeof item.parent_node_id === 'string' ? item.parent_node_id : null),
            artifactType: normalizeWorkspaceArtifactType(data.artifactType, 'subgraph'),
            executionProfile: normalizeWorkspaceExecutionProfile(data.executionProfile, typeof data.isAsync === 'boolean' ? data.isAsync : true, 'subgraph', normalizeWorkspaceArtifactType(data.artifactType, 'subgraph')),
            projectMode: normalizeProjectMode(data.projectMode, normalizeWorkspaceArtifactType(data.artifactType, 'subgraph'), normalizeWorkspaceExecutionProfile(data.executionProfile, typeof data.isAsync === 'boolean' ? data.isAsync : true, 'subgraph', normalizeWorkspaceArtifactType(data.artifactType, 'subgraph'))),
            runtimeSettings: sanitizeRuntimeSettings(data.runtimeSettings, normalizeProjectMode(data.projectMode, normalizeWorkspaceArtifactType(data.artifactType, 'subgraph'), normalizeWorkspaceExecutionProfile(data.executionProfile, typeof data.isAsync === 'boolean' ? data.isAsync : true, 'subgraph', normalizeWorkspaceArtifactType(data.artifactType, 'subgraph')))),
          });
          out.push(...flattenChildren(item.subgraphs as Array<Record<string, unknown>> | undefined, typeof item.id === 'string' ? item.id : null));
        }
        return out;
      };

      const snapshot: WorkspaceTreeSnapshot = {
        version: 'langsuite.v21.workspace',
        root: {
          projectId: project.id,
          projectName: project.name,
          nodes: rootData.nodes || [],
          edges: rootData.edges || [],
          parentProjectId: null,
          parentNodeId: null,
          customStateSchema: Array.isArray(rootData.customStateSchema) ? rootData.customStateSchema : [],
          graphBindings: Array.isArray(rootData.graphBindings) ? rootData.graphBindings : [],
          isAsync: typeof rootData.isAsync === 'boolean' ? rootData.isAsync : true,
          scopeKind: 'project',
          scopePath: typeof rootData.scopePath === 'string' && rootData.scopePath.trim() ? rootData.scopePath : buildScopePath(project.name || 'Graph'),
          artifactType: normalizeWorkspaceArtifactType(rootData.artifactType, 'project'),
          executionProfile: normalizeWorkspaceExecutionProfile(rootData.executionProfile, typeof rootData.isAsync === 'boolean' ? rootData.isAsync : true, 'project', normalizeWorkspaceArtifactType(rootData.artifactType, 'project')),
          projectMode: normalizeProjectMode(rootData.projectMode, normalizeWorkspaceArtifactType(rootData.artifactType, 'project'), normalizeWorkspaceExecutionProfile(rootData.executionProfile, typeof rootData.isAsync === 'boolean' ? rootData.isAsync : true, 'project', normalizeWorkspaceArtifactType(rootData.artifactType, 'project'))),
          runtimeSettings: sanitizeRuntimeSettings(rootData.runtimeSettings, normalizeProjectMode(rootData.projectMode, normalizeWorkspaceArtifactType(rootData.artifactType, 'project'), normalizeWorkspaceExecutionProfile(rootData.executionProfile, typeof rootData.isAsync === 'boolean' ? rootData.isAsync : true, 'project', normalizeWorkspaceArtifactType(rootData.artifactType, 'project')))),
        },
        children: flattenChildren(project.subgraphs as Array<Record<string, unknown>> | undefined, project.id),
        activeScopeKey: typeof workspaceMeta.activeScopeKey === 'string' ? workspaceMeta.activeScopeKey : null,
        openChildScopeKeys: Array.isArray(workspaceMeta.openChildScopeKeys) ? workspaceMeta.openChildScopeKeys.filter((value: unknown): value is string => typeof value === 'string') : [],
      };

      const hydrated = hydrateWorkspaceSnapshot(snapshot);
      set({
        tabs: hydrated.tabs,
        activeTabId: hydrated.activeTabId,
        nodes: hydrated.nodes,
        edges: hydrated.edges,
        projectName: hydrated.projectName,
        isAsync: hydrated.isAsync,
        graphValidation: null,
      });
    } catch (err) {
      console.error('Load from DB failed:', err);
    }
  },

  exportJson: () => {
    const { nodes, edges, projectName, tabs, activeTabId } = get();
    const activeTab = tabs.find((t: Tab) => t.id === activeTabId);
    const tabForExport: Tab = activeTab ?? {
      id: activeTabId,
      projectId: null,
      projectName,
      nodes,
      edges,
      isDirty: false,
      parentProjectId: null,
      parentNodeId: null,
      customStateSchema: [],
      graphBindings: [],
      isAsync: get().isAsync,
      scopeKind: 'project',
      scopePath: buildScopePath(projectName),
      artifactType: 'graph',
      executionProfile: defaultExecutionProfile(get().isAsync, 'graph'),
      projectMode: 'langgraph',
      runtimeSettings: defaultRuntimeSettings('langgraph'),
    };
    const graphId = buildScopedGraphId(tabForExport);

    const toolTypeMap: Record<string, string> = {
      tool_python_repl: 'python_repl',
      tool_web_search: 'web_search',
      tool_brave_search: 'brave_search',
      tool_duckduckgo_search: 'duckduckgo_search',
      tool_tavily_extract: 'tavily_extract',
      tool_rest_api: 'rest_api',
      tool_python_function: 'python_function',
      tool_api_call: 'api_call',
      tool_requests_get: 'requests_get',
      tool_requests_post: 'requests_post',
      tool_fs_list_dir: 'fs_list_dir',
      tool_fs_read_file: 'fs_read_file',
      tool_fs_glob: 'fs_glob',
      tool_fs_grep: 'fs_grep',
      tool_fs_write_file: 'fs_write_file',
      tool_fs_edit_file: 'fs_edit_file',
      tool_fs_apply_patch: 'fs_apply_patch',
      tool_shell_command: 'shell_command',
      tool_sql_query: 'sql_query',
      tool_sql_list_tables: 'sql_list_tables',
      tool_sql_get_schema: 'sql_get_schema',
      tool_sql_query_check: 'sql_query_check',
      tool_rpg_dice_roller: 'rpg_dice_roller',
      tool_pw_navigate: 'pw_navigate',
      tool_pw_click: 'pw_click',
      tool_pw_extract_text: 'pw_extract_text',
      tool_pw_extract_links: 'pw_extract_links',
      tool_pw_get_elements: 'pw_get_elements',
      tool_pw_current_page: 'pw_current_page',
      tool_pw_fill: 'pw_fill',
      tool_playwright_wait: 'playwright_wait',
      tool_playwright_scroll: 'playwright_scroll',
      tool_playwright_extract_links: 'pw_extract_links',
      tool_playwright_keypress: 'playwright_keypress',
      tool_playwright_screenshot: 'playwright_screenshot',
      tool_github_get_issue: 'github_get_issue',
      tool_github_get_pull_request: 'github_get_pull_request',
      tool_github_read_file: 'github_read_file',
      tool_github_search_issues_prs: 'github_search_issues_prs',
      tool_sub_agent: 'sub_agent_tool',
      subgraph_tool: 'sub_agent_tool',
      tool_llm_worker: 'tool_llm_worker',
      deep_subagent_worker: 'tool_llm_worker',
    };

    const apiTools = nodes
      .filter((n: Node) => {
        const def = NODE_DEFS[n.data.nodeType as string];
        return def?.isTool;
      })
      .map((n: Node) => {
        const params = getNodeParams(n.data);
        const toolType = toolTypeMap[n.data.nodeType as string] || 'python_function';
        const tool: Record<string, unknown> = {
          id: n.id,
          type: toolType,
          description: params.description || '',
        };
        if (toolType === 'python_function') {
          tool.code = params.code || '';
        }
        if (toolType === 'sub_agent_tool') {
          tool.params = {
            target_subgraph: params.target_subgraph || '',
            target_group: params.target_group || 'default',
            target_agent: params.target_agent || '',
            max_invocations: params.max_invocations || 1,
            allow_repeat: params.allow_repeat || '',
            provider: params.provider || 'openai',
            model_name: params.model_name || 'gpt-4o-mini',
            api_key_env: params.api_key_env || '',
            temperature: typeof params.temperature === 'number' ? params.temperature : 0.3,
          };
        }
        if (toolType === 'tool_llm_worker') {
          tool.params = {
            system_prompt: params.system_prompt || 'Tu es un assistant expert.',
            provider: params.provider || 'openai',
            model_name: params.model_name || 'gpt-4o-mini',
          };
        }
        const needsParams = ['rest_api', 'web_search', 'brave_search', 'duckduckgo_search', 'tavily_extract', 'api_call', 'requests_get', 'requests_post', 'fs_list_dir', 'fs_read_file', 'fs_glob', 'fs_grep', 'fs_write_file', 'fs_edit_file', 'fs_apply_patch', 'shell_command', 'sql_query', 'sql_list_tables', 'sql_get_schema', 'sql_query_check'];
        if (needsParams.includes(toolType)) {
          tool.params = {};
          if (toolType === 'rest_api') {
            (tool.params as Record<string, unknown>).url = params.url || '';
            (tool.params as Record<string, unknown>).method = params.method || 'POST';
            try {
              (tool.params as Record<string, unknown>).headers = JSON.parse((params.headers_json as string) || '{}');
            } catch {
              (tool.params as Record<string, unknown>).headers = {};
            }
          }
          if (toolType === 'web_search') {
            (tool.params as Record<string, unknown>).tavily_api_key = params.tavily_api_key || 'TAVILY_API_KEY';
            (tool.params as Record<string, unknown>).max_results = params.max_results || 3;
          }
          if (toolType === 'brave_search') {
            (tool.params as Record<string, unknown>).brave_api_key = params.brave_api_key || 'BRAVE_SEARCH_API_KEY';
            (tool.params as Record<string, unknown>).max_results = params.max_results || 5;
            (tool.params as Record<string, unknown>).timeout_seconds = params.timeout_seconds || 15;
          }
          if (toolType === 'duckduckgo_search') {
            (tool.params as Record<string, unknown>).max_results = params.max_results || 5;
          }
          if (toolType === 'tavily_extract') {
            (tool.params as Record<string, unknown>).tavily_api_key = params.tavily_api_key || 'TAVILY_API_KEY';
            (tool.params as Record<string, unknown>).extract_depth = params.extract_depth || 'basic';
            (tool.params as Record<string, unknown>).include_images = String(params.include_images || 'false') === 'true';
          }
          if (toolType === 'api_call') {
            (tool.params as Record<string, unknown>).url = params.url || '';
            try {
              (tool.params as Record<string, unknown>).headers = JSON.parse((params.headers_json as string) || '{}');
            } catch {
              (tool.params as Record<string, unknown>).headers = {};
            }
          }
          if (toolType === 'requests_get' || toolType === 'requests_post') {
            (tool.params as Record<string, unknown>).base_url = params.base_url || '';
            (tool.params as Record<string, unknown>).allow_full_urls = String(params.allow_full_urls || 'false') === 'true';
            (tool.params as Record<string, unknown>).timeout_seconds = params.timeout_seconds || 15;
            try {
              (tool.params as Record<string, unknown>).headers = JSON.parse((params.headers_json as string) || '{}');
            } catch {
              (tool.params as Record<string, unknown>).headers = {};
            }
          }
          if (['fs_list_dir', 'fs_read_file', 'fs_glob', 'fs_grep', 'fs_write_file', 'fs_edit_file', 'fs_apply_patch', 'shell_command'].includes(toolType)) {
            (tool.params as Record<string, unknown>).root_path = params.root_path || '.';
          }
          if (toolType === 'fs_list_dir' || toolType === 'fs_glob') {
            (tool.params as Record<string, unknown>).include_hidden = String(params.include_hidden || 'false') === 'true';
            (tool.params as Record<string, unknown>).max_results = params.max_results || (toolType === 'fs_list_dir' ? 100 : 200);
          }
          if (toolType === 'fs_read_file') {
            (tool.params as Record<string, unknown>).max_bytes = params.max_bytes || 200000;
          }
          if (toolType === 'fs_grep') {
            (tool.params as Record<string, unknown>).file_glob = params.file_glob || '**/*';
            (tool.params as Record<string, unknown>).case_sensitive = String(params.case_sensitive || 'false') === 'true';
            (tool.params as Record<string, unknown>).include_hidden = String(params.include_hidden || 'false') === 'true';
            (tool.params as Record<string, unknown>).max_matches = params.max_matches || 200;
          }
          if (toolType === 'fs_write_file') {
            (tool.params as Record<string, unknown>).create_dirs = String(params.create_dirs || 'false') === 'true';
            (tool.params as Record<string, unknown>).overwrite_existing = String(params.overwrite_existing || 'false') === 'true';
            (tool.params as Record<string, unknown>).max_bytes = params.max_bytes || 200000;
          }
          if (toolType === 'fs_edit_file') {
            (tool.params as Record<string, unknown>).replace_all = String(params.replace_all || 'false') === 'true';
            (tool.params as Record<string, unknown>).max_bytes = params.max_bytes || 200000;
          }
          if (toolType === 'fs_apply_patch') {
            (tool.params as Record<string, unknown>).allow_create = String(params.allow_create || 'false') === 'true';
            (tool.params as Record<string, unknown>).create_dirs = String(params.create_dirs || 'false') === 'true';
            (tool.params as Record<string, unknown>).max_files = params.max_files || 8;
            (tool.params as Record<string, unknown>).max_bytes = params.max_bytes || 200000;
          }
          if (toolType === 'shell_command') {
            (tool.params as Record<string, unknown>).timeout_seconds = params.timeout_seconds || 20;
            (tool.params as Record<string, unknown>).allowed_commands = Array.isArray(params.allowed_commands) ? params.allowed_commands.filter((item: unknown) => typeof item === 'string' && item.trim().length > 0) : ['python', 'python3', 'pytest', 'ls', 'pwd', 'grep', 'find', 'cat'];
          }
          if (['sql_query', 'sql_list_tables', 'sql_get_schema', 'sql_query_check'].includes(toolType)) {
            (tool.params as Record<string, unknown>).db_path = params.db_path || 'data.db';
          }
          if (toolType === 'sql_query') {
            (tool.params as Record<string, unknown>).read_only = String(params.read_only || 'true') !== 'false';
          }
        }
        return tool;
      });

    const toolNodeIds = new Set(apiTools.map((tool: Record<string, unknown>) => String(tool.id)));
    const incomingToolLinks = new Map<string, string[]>();
    edges.forEach((edge: Edge) => {
      if (edge.sourceHandle === 'tool_out' && edge.targetHandle === 'tools_in' && edge.target) {
        const current = incomingToolLinks.get(edge.target) || [];
        if (!current.includes(edge.source)) {
          current.push(edge.source);
          incomingToolLinks.set(edge.target, current);
        }
      }
    });

    const apiNodes = nodes
      .filter((n: Node) => {
        const def = NODE_DEFS[n.data.nodeType as string];
        return def && !def.isTool;
      })
      .map((n: Node) => {
        const def = NODE_DEFS[n.data.nodeType as string];
        if (!def) return null;
        const inputHandles = def.handles
          .filter((h) => h.type === 'target' && h.id !== 'tools_in')
          .map((h) => h.id.replace('_in', ''));
        const outputHandles = def.handles
          .filter((h) => h.type === 'source' && h.id !== 'tool_out')
          .map((h) => h.id.replace('_out', ''));
        const nodeObj: Record<string, unknown> = {
          id: n.id,
          type: getCompileNodeType(String(n.data.nodeType || '')),
          inputs: inputHandles,
          outputs: outputHandles,
          params: { ...getNodeParams(n.data) },
        };
        const p = nodeObj.params as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(p, 'tools_linked')) {
          const edgeLinked = incomingToolLinks.get(n.id) || [];
          const manualLinked = Array.isArray(p.tools_linked)
            ? (p.tools_linked as unknown[]).map((v) => String(v)).filter((toolId) => toolNodeIds.has(toolId))
            : [];
          p.tools_linked = edgeLinked.length > 0
            ? edgeLinked
            : manualLinked.filter((toolId, idx, arr) => arr.indexOf(toolId) === idx);
        }
        if (p.structured_schema_json && typeof p.structured_schema_json === 'string' && (p.structured_schema_json as string).trim()) {
          try {
            p.structured_schema = JSON.parse(p.structured_schema_json as string);
          } catch {
          }
        }
        delete p.structured_schema_json;
        return nodeObj;
      })
      .filter(Boolean);

    const hasMemoryCheckpoint = nodes.some(
      (n: Node) => n.data.nodeType === 'memory_checkpoint',
    );
    const hasUserInput = nodes.some(
      (n: Node) => n.data.nodeType === 'user_input_node',
    );

    const interruptNodes = nodes
      .filter(
        (n: Node) =>
          n.data.nodeType === 'human_interrupt' ||
          (n.data.params as Record<string, unknown>)?.needs_validation === true,
      )
      .map((n: Node) => n.id);

    const forceCheckpoint = Boolean(activeTab?.runtimeSettings?.checkpointEnabled) || hasMemoryCheckpoint || hasUserInput || interruptNodes.length > 0;

    const routerIds = new Set(
      nodes.filter((n: Node) => n.data.nodeType === 'logic_router').map((n: Node) => n.id),
    );

    const apiEdges = edges.map((e: Edge) => {
      if (routerIds.has(e.source)) {
        return {
          source: e.source,
          target: e.target,
          type: 'conditional',
          router_id: e.source,
          condition: e.sourceHandle || '',
        };
      }
      if (routerIds.has(e.target)) {
        return { source: e.source, target: e.target, type: 'direct' };
      }
      return { source: e.source, target: e.target, type: 'direct' };
    });

    const hasCatchErrors = nodes.some((n: Node) => {
      const params = getNodeParams(n.data);
      return params.catch_errors === 'true';
    });

    const stateSchema: Array<{ name: string; type: string; reducer: string }> = [
      { name: 'messages', type: 'list', reducer: 'add_messages' },
      { name: 'documents', type: 'list', reducer: 'operator.add' },
      { name: 'custom_vars', type: 'dict', reducer: 'update' },
    ];
    if (hasCatchErrors) {
      stateSchema.push({ name: 'last_error', type: 'str', reducer: 'none' });
    }

    const activeTabState = get().tabs.find((t: Tab) => t.id === get().activeTabId);
    if (activeTabState?.customStateSchema) {
      const stateSchemaMap = new Map(stateSchema.map((s) => [s.name, s]));
      activeTabState.customStateSchema.forEach((customVar: { name: string; type: string; reducer: string }) => {
        stateSchemaMap.set(customVar.name, customVar);
      });
      stateSchema.length = 0;
      stateSchemaMap.forEach((v) => stateSchema.push(v));
    }

    const resolvedBindings = resolveBindingsForTab(tabForExport, tabs);
    const scopeLineage = buildScopeLineage(tabForExport, tabs);

    const payload = {
      graph_id: graphId,
      ui_context: {
        project_id: tabForExport.projectId,
        tab_id: tabForExport.id,
        graph_kind: tabForExport.scopeKind,
        graph_scope: tabForExport.scopePath,
        scope_lineage: scopeLineage,
        supergraph_scope: scopeLineage[0] || tabForExport.scopePath,
        parent_project_id: tabForExport.parentProjectId ?? null,
        parent_node_id: tabForExport.parentNodeId ?? null,
        artifact_type: normalizeWorkspaceArtifactType(tabForExport.artifactType, tabForExport.scopeKind),
        execution_profile: normalizeWorkspaceExecutionProfile(tabForExport.executionProfile, tabForExport.isAsync, tabForExport.scopeKind, normalizeWorkspaceArtifactType(tabForExport.artifactType, tabForExport.scopeKind)),
        project_mode: tabForExport.projectMode || inferProjectModeFromSurface(tabForExport.artifactType, tabForExport.executionProfile),
        runtime_settings: tabForExport.runtimeSettings,
        graph_bindings: tabForExport.graphBindings || [],
        resolved_graph_bindings: resolvedBindings,
        ai_node_inventory: apiNodes
          .filter((n): n is Record<string, unknown> => Boolean(n) && ['llm_chat', 'react_agent', 'sub_agent'].includes(String((n as Record<string, unknown>).type)))
          .map((n) => ({
            id: n.id,
            type: n.type,
            provider: (n.params as Record<string, unknown>)?.provider || null,
            model_name: (n.params as Record<string, unknown>)?.model_name || null,
            execution_group: (n.params as Record<string, unknown>)?.execution_group || 'main',
          })),
      },
      config: { persistence_type: 'memory', cross_thread_memory: true },
      state_schema: stateSchema,
      nodes: apiNodes,
      tools: apiTools,
      edges: apiEdges,
      use_checkpoint: forceCheckpoint,
      interrupt_before_nodes: interruptNodes,
      is_async: get().isAsync,
    };

    return JSON.stringify(payload, null, 2);
  },

  exportProjectPackage: () => {
    const snapshot = buildWorkspaceSnapshotFromState(get());
    if (!snapshot) {
      const activeTab = get().tabs.find((tab) => tab.id === get().activeTabId) || null;
      const surfaceTruth = buildSurfaceTruthSummary({
        artifactType: activeTab?.artifactType || 'graph',
        executionProfile: activeTab?.executionProfile || (get().isAsync ? 'langgraph_async' : 'langgraph_sync'),
        projectMode: activeTab?.projectMode || inferProjectModeFromSurface(activeTab?.artifactType || 'graph', activeTab?.executionProfile || (get().isAsync ? 'langgraph_async' : 'langgraph_sync')),
      });
      return JSON.stringify({
        kind: 'project_package',
        version: 'langsuite.v23.package',
        packageType: 'editable_workspace',
        exportedAt: new Date().toISOString(),
        projectName: get().projectName,
        surfaceTruth,
        summary: {
          childSubgraphCount: 0,
          includes: ['root graph'],
          excludes: ['runtime DB contents', 'Chroma/vector store files', 'future memory backends'],
          layoutMetadataIncluded: false,
        },
        workspaceTree: null,
      }, null, 2);
    }
    return JSON.stringify(buildProjectPackageFromSnapshot(snapshot), null, 2);
  },

  clearImportReport: () => set({ lastImportReport: null }),

  runValidation: () => {
    const syncedTabs = syncActiveTabIntoTabs(get());
    const validation = validateEditorState({
      nodes: get().nodes,
      edges: get().edges,
      tabs: syncedTabs,
      activeTabId: get().activeTabId,
      isAsync: get().isAsync,
    });
    set({ graphValidation: validation, tabs: syncedTabs });
    return validation;
  },

  clearValidation: () => set({ graphValidation: null }),

  openTab: (projectId: string | null, name: string, nodes: Node[], edges: Edge[], customStateSchema: { name: string; type: string; reducer: string }[] = [], isAsync: boolean = true, meta?: { parentProjectId?: string | null; parentTabId?: string | null; parentNodeId?: string | null; scopeKind?: GraphScopeKind; scopePath?: string; graphBindings?: GraphBinding[]; artifactType?: ArtifactType; executionProfile?: ExecutionProfile; projectMode?: ProjectMode; runtimeSettings?: Partial<RuntimeSettings> }) => {
    const { tabs, activeTabId } = get();
    const parentProjectId = meta?.parentProjectId ?? null;
    const parentTabId = meta?.parentTabId ?? null;
    const parentNodeId = meta?.parentNodeId ?? null;
    const scopeKind = meta?.scopeKind ?? inferScopeKind(parentProjectId, parentNodeId);
    const existing = tabs.find((t: Tab) => {
      if (projectId && t.projectId === projectId) return true;
      if (!projectId && scopeKind === 'project' && !isSubgraphTab(t) && t.projectId === null && t.projectName === name) return true;
      return false;
    });
    if (existing) {
      get().switchTab(existing.id);
      return;
    }

    const currentTab = tabs.find((t: Tab) => t.id === activeTabId);
    const updatedTabs = currentTab
      ? tabs.map((t: Tab) => t.id === activeTabId ? { ...t, nodes: get().nodes, edges: get().edges, customStateSchema: t.customStateSchema, graphBindings: t.graphBindings, isAsync: get().isAsync, projectName: get().projectName } : t)
      : tabs;

    const maxId = nodes.reduce((max: number, n: Node) => {
      const match = n.id.match(/_(\d+)$/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    nodeCounter = maxId;

    const newTabId = makeTabId();
    const scopePath = meta?.scopePath ?? buildScopePath(name, parentNodeId);
    const inferredArtifactType: ArtifactType = normalizeWorkspaceArtifactType(meta?.artifactType, scopeKind);
    const inferredExecutionProfile: ExecutionProfile = normalizeWorkspaceExecutionProfile(meta?.executionProfile, isAsync, scopeKind, inferredArtifactType);
    const inferredProjectMode: ProjectMode = normalizeProjectMode(meta?.projectMode, inferredArtifactType, inferredExecutionProfile);
    const newTab: Tab = {
      id: newTabId,
      projectId,
      projectName: name,
      nodes,
      edges,
      isDirty: false,
      parentProjectId,
      parentTabId,
      parentNodeId,
      customStateSchema,
      graphBindings: meta?.graphBindings ?? [],
      isAsync,
      scopeKind,
      scopePath,
      artifactType: inferredArtifactType,
      executionProfile: inferredExecutionProfile,
      projectMode: inferredProjectMode,
      runtimeSettings: sanitizeRuntimeSettings(meta?.runtimeSettings, inferredProjectMode),
    };
    const nextTabs = scopeKind === 'subgraph' ? [...updatedTabs, newTab] : [newTab];
    set({
      tabs: nextTabs,
      activeTabId: newTabId,
      nodes,
      edges,
      projectName: name,
      isAsync,
      graphValidation: null,
    });
  },

  closeTab: (tabId: string) => {
    const { tabs, activeTabId } = get();
    const target = tabs.find((t: Tab) => t.id === tabId);
    if (!target) return;

    if (!isSubgraphTab(target)) {
      const emptyRoot = makeEmptyRootTab(makeTabId);
      nodeCounter = 0;
      set({
        tabs: [emptyRoot],
        activeTabId: emptyRoot.id,
        nodes: emptyRoot.nodes,
        edges: emptyRoot.edges,
        projectName: emptyRoot.projectName,
        isAsync: emptyRoot.isAsync,
        graphValidation: null,
      });
      return;
    }

    if (tabs.length <= 1) return;

    const idx = tabs.findIndex((t: Tab) => t.id === tabId);
    const newTabs = tabs.filter((t: Tab) => t.id !== tabId);

    if (tabId === activeTabId) {
      const newActive = newTabs[Math.min(idx, newTabs.length - 1)];
      const maxId = newActive.nodes.reduce((max: number, n: Node) => {
        const match = n.id.match(/_(\d+)$/);
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
      }, 0);
      nodeCounter = maxId;
      set({
        tabs: newTabs,
        activeTabId: newActive.id,
        nodes: newActive.nodes,
        edges: newActive.edges,
        projectName: newActive.projectName,
        isAsync: newActive.isAsync,
        graphValidation: null,
      });
    } else {
      set({ tabs: newTabs });
    }
  },

  switchTab: (tabId: string) => {
    const { tabs, activeTabId, nodes, edges } = get();
    if (tabId === activeTabId) return;

    const target = tabs.find((t: Tab) => t.id === tabId);
    if (!target) return;

    const updatedTabs = tabs.map((t: Tab) =>
      t.id === activeTabId ? { ...t, nodes, edges, customStateSchema: t.customStateSchema, graphBindings: t.graphBindings, isAsync: get().isAsync, projectName: get().projectName } : t,
    );

    const maxId = target.nodes.reduce((max: number, n: Node) => {
      const match = n.id.match(/_(\d+)$/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    nodeCounter = maxId;

    set({
      tabs: updatedTabs,
      activeTabId: tabId,
      nodes: target.nodes,
      edges: target.edges,
      projectName: target.projectName,
      isAsync: target.isAsync,
      graphValidation: null,
    });
  },

  renameTab: (tabId: string, name: string) => {
    set({
      tabs: get().tabs.map((t: Tab) => t.id === tabId ? { ...t, projectName: name, scopePath: buildScopePath(name, t.parentNodeId) } : t),
    });
    if (tabId === get().activeTabId) {
      set({ projectName: name });
    }
  },

  toggleProjectManager: () => set({ projectManagerOpen: !get().projectManagerOpen }),

  connectRunWebSocket: () => {
    const { runWs } = get();
    if (runWs && runWs.readyState === WebSocket.OPEN) return;

    const sessionId = `run_${Date.now()}`;
    const wsUrl = `${getWsBase()}/api/ws/run/${sessionId}`;
    const ws = new WebSocket(wsUrl);
    let logId = 0;

    ws.onopen = () => {
      set({ runWs: ws });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const runtimeEvent = getRuntimeEvent(msg);
        const entry: RunLogEntry = {
          id: `log_${logId++}`,
          timestamp: Date.now(),
          type: msg.type,
          runtimeSchemaVersion: runtimeEvent?.schemaVersion ?? null,
          runtimeKind: runtimeEvent?.kind ?? null,
          truthSource: runtimeEvent?.schemaVersion === 'runtime_event_v1' ? 'runtime_event' : 'legacy',
        };

        if (msg.type === 'state_sync') {
          const updates: Partial<AppState> = {
            liveState: msg.state || {},
            liveStateNext: msg.next || [],
          };
          if (!get()._debugUserClosed && !get().debugPanelOpen) {
            const pp = { ...get().panelPlacements };
            pp.debug = { ...pp.debug, open: true };
            updates.panelPlacements = pp;
            updates.debugPanelOpen = true;
          }
          set(updates);
          return;
        }

        if (msg.type === 'embedded_trace') {
          entry.node = runtimeEvent?.nodeId || (typeof msg.node_id === 'string' ? msg.node_id : undefined);
          entry.message = typeof msg.message === 'string' ? msg.message : undefined;
          entry.data = msg;
          Object.assign(entry, getRunLogContext(get, entry.node, msg));
          set({ runLogs: [...get().runLogs, entry] });
        } else if (msg.type === 'node_update') {
          const nodeNames = runtimeEvent?.nodeIds && runtimeEvent.nodeIds.length > 0 ? runtimeEvent.nodeIds : Object.keys(msg.data || {});
          entry.node = runtimeEvent?.primaryNodeId || nodeNames[0] || 'unknown';
          entry.data = msg.data;
          const nodePayload = nodeNames[0] && typeof msg.data?.[nodeNames[0]] === 'object' ? (msg.data[nodeNames[0]] as Record<string, unknown>) : null;
          Object.assign(entry, getRunLogContext(get, entry.node, nodePayload || msg));
          const rawMemoryMeta = nodePayload && typeof nodePayload.__memory_meta__ === 'object' && nodePayload.__memory_meta__ && !Array.isArray(nodePayload.__memory_meta__)
            ? nodePayload.__memory_meta__ as Record<string, Record<string, unknown>>
            : null;
          const currentMemoryMeta = rawMemoryMeta && entry.node && rawMemoryMeta[String(entry.node)] && typeof rawMemoryMeta[String(entry.node)] === 'object'
            ? rawMemoryMeta[String(entry.node)]
            : rawMemoryMeta ? Object.values(rawMemoryMeta)[0] as Record<string, unknown> : null;
          if (currentMemoryMeta) {
            entry.memorySystem = typeof currentMemoryMeta.memory_system === 'string' ? String(currentMemoryMeta.memory_system) : null;
            entry.memoryOperation = typeof currentMemoryMeta.operation === 'string' ? String(currentMemoryMeta.operation) : null;
            entry.storeBackend = typeof currentMemoryMeta.store_backend === 'string' ? String(currentMemoryMeta.store_backend) : null;
            entry.memoryAccessModel = typeof currentMemoryMeta.access_model === 'string' ? String(currentMemoryMeta.access_model) : null;
          }
          const parsedToolObservation = runtimeEvent?.observation ?? parseToolObservation(nodePayload);
          if (parsedToolObservation) {
            entry.message = summarizeToolObservation(parsedToolObservation);
          }
          set({ runLogs: [...get().runLogs, entry] });
        } else if (msg.type === 'paused') {
          entry.node = runtimeEvent?.nodeId || msg.pending_node;
          entry.message = `En pause — en attente sur ${msg.pending_node}`;
          set({
            runLogs: [...get().runLogs, entry],
            isPaused: true,
            pendingNodeId: msg.pending_node,
            isRunning: false,
          });
        } else if (msg.type === 'completed') {
          entry.message = 'Exécution terminée';
          set({
            runLogs: [...get().runLogs, entry],
            isRunning: false,
            isPaused: false,
            pendingNodeId: null,
          });
        } else if (msg.type === 'error') {
          entry.message = msg.stage ? `${String(msg.stage).replace(/_/g, ' ')}: ${msg.message}` : msg.message;
          entry.data = msg.stage ? { stage: msg.stage } : undefined;
          Object.assign(entry, getRunLogContext(get, runtimeEvent?.nodeId || (typeof msg.node_id === 'string' ? msg.node_id : undefined), msg));
          if (runtimeEvent?.reasonCode) entry.reasonCode = runtimeEvent.reasonCode;
          set({
            runLogs: [...get().runLogs, entry],
            isRunning: false,
            isPaused: false,
          });
        } else if (msg.type === 'started') {
          entry.message = 'Graphe compilé, exécution en cours...';
          entry.integrationModel = typeof msg.execution_kind === 'string' ? String(msg.execution_kind) : null;
          entry.scopePath = runtimeEvent?.graphScope ?? (typeof msg.graph_scope === 'string' ? msg.graph_scope : null);
          entry.scopeLineage = runtimeEvent?.scopeLineage ?? (Array.isArray(msg.scope_lineage) ? msg.scope_lineage : []);
          entry.artifactType = runtimeEvent?.artifactType ?? (typeof msg.artifact_type === 'string' ? msg.artifact_type : null);
          entry.executionProfile = runtimeEvent?.executionProfile ?? (typeof msg.execution_profile === 'string' ? msg.execution_profile : null);
          set({ runLogs: [...get().runLogs, entry] });
        }
      } catch (err) {
        console.error('Run WS parse error:', err);
      }
    };

    ws.onclose = () => {
      set({ runWs: null, isRunning: false });
    };

    ws.onerror = () => {
      console.error('Run WebSocket error');
    };
  },

  startRun: (inputs?: Record<string, unknown>) => {
    const activeTab = get().tabs.find((tab: Tab) => tab.id === get().activeTabId);
    if (activeTab && !projectModeAllowsRuntime(activeTab.projectMode)) {
      const entry: RunLogEntry = {
        id: `log_preflight_${Date.now()}`,
        timestamp: Date.now(),
        type: 'error',
        message: `Run blocked before execution: ${activeTab.projectMode} mode is editor-only in this build.`,
        data: { stage: 'before_run', projectMode: activeTab.projectMode },
      };
      const placements = { ...get().panelPlacements, debug: { ...get().panelPlacements.debug, open: true } };
      set({
        runLogs: [...get().runLogs, entry],
        isRunning: false,
        isPaused: false,
        pendingNodeId: null,
        panelPlacements: placements,
        debugPanelOpen: true,
        _debugUserClosed: false,
      });
      return;
    }
    const validation = get().runValidation();
    if (validation.errors.length > 0) {
      const entry: RunLogEntry = {
        id: `log_preflight_${Date.now()}`,
        timestamp: Date.now(),
        type: 'error',
        message: `Run blocked before execution: ${validation.errors[0]}`,
        data: {
          stage: 'before_run',
          errors: validation.errors,
          warnings: validation.warnings,
        },
      };
      const placements = { ...get().panelPlacements, debug: { ...get().panelPlacements.debug, open: true } };
      set({
        runLogs: [...get().runLogs, entry],
        isRunning: false,
        isPaused: false,
        pendingNodeId: null,
        panelPlacements: placements,
        debugPanelOpen: true,
        _debugUserClosed: false,
      });
      return;
    }

    const { runWs, exportJson } = get();
    if (!runWs || runWs.readyState !== WebSocket.OPEN) {
      get().connectRunWebSocket();
      setTimeout(() => get().startRun(inputs), 500);
      return;
    }

    const json = exportJson();
    const payload = JSON.parse(json);

    set({ isRunning: true, isPaused: false, pendingNodeId: null, _debugUserClosed: false });
    runWs.send(JSON.stringify({
      action: 'start',
      payload,
      inputs: inputs || { messages: [] },
    }));
  },

  sendResume: (response: string) => {
    const { runWs, pendingNodeId } = get();
    if (!runWs || runWs.readyState !== WebSocket.OPEN) return;

    set({ isPaused: false, isRunning: true, pendingNodeId: null });
    runWs.send(JSON.stringify({
      action: 'resume',
      user_response: response,
      node_id: pendingNodeId || '',
    }));
  },

  stopRun: () => {
    const { runWs } = get();
    if (runWs && runWs.readyState === WebSocket.OPEN) {
      runWs.send(JSON.stringify({ action: 'stop' }));
    }
    set({ isRunning: false, isPaused: false, pendingNodeId: null });
  },

  clearRunLogs: () => set({ runLogs: [], liveState: {}, liveStateNext: [] }),

  disconnectRunWs: () => {
    const { runWs } = get();
    if (runWs) {
      runWs.close();
    }
    set({ runWs: null, isRunning: false, isPaused: false, pendingNodeId: null, liveState: {}, liveStateNext: [] });
  },

  toggleDebugPanel: () => {
    const pp = { ...get().panelPlacements };
    pp.debug = { ...pp.debug, open: !pp.debug.open };
    set({
      panelPlacements: pp,
      debugPanelOpen: pp.debug.open,
      _debugUserClosed: !pp.debug.open,
    });
  },

  _markActiveTabDirty: () => {
    const { tabs, activeTabId, _syncing } = get();
    if (_syncing) return;
    const tab = tabs.find((t: Tab) => t.id === activeTabId);
    if (tab && !tab.isDirty) {
      set({ tabs: tabs.map((t) => t.id === activeTabId ? { ...t, isDirty: true } : t) });
    }
    get()._triggerAutoSave();
  },

  _triggerAutoSave: () => {
    if (!get().preferences.autosaveEnabled) return;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      const { tabs, activeTabId, preferences } = get();
      if (!preferences.autosaveEnabled) return;
      const tab = tabs.find((t: Tab) => t.id === activeTabId);
      if (tab?.isDirty && tab.projectId) {
        get().saveProjectToDb();
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  },

  setActiveRightPanel: (panel: 'debug' | 'state' | 'collab' | null) => {
    const pp = { ...get().panelPlacements };
    if (panel) {
      pp[panel] = { ...pp[panel], open: true };
    }
    set({
      activeRightPanel: panel,
      panelPlacements: pp,
      debugPanelOpen: pp.debug.open,
      collabOpen: pp.collab.open,
      statePanelOpen: pp.state.open,
    });
  },

  togglePanel: (panel: 'debug' | 'state' | 'collab' | 'blocks') => {
    const pp = { ...get().panelPlacements };
    pp[panel] = { ...pp[panel], open: !pp[panel].open };
    if (panel === 'debug' && pp[panel].open) {
      set({ _debugUserClosed: false });
    }
    if (panel === 'debug' && !pp[panel].open) {
      set({ _debugUserClosed: true });
    }
    const updates: Partial<AppState> = {
      panelPlacements: pp,
      debugPanelOpen: pp.debug.open,
      collabOpen: pp.collab.open,
      statePanelOpen: pp.state.open,
    };
    if (panel === 'blocks') {
      updates.sidebarOpen = pp.blocks.open;
    }
    set(updates);
  },

  setPanelSide: (panel: 'debug' | 'state' | 'collab' | 'blocks', side: 'left' | 'right') => {
    const pp = { ...get().panelPlacements };
    pp[panel] = { ...pp[panel], side };
    const updates: Partial<AppState> = { panelPlacements: pp };
    if (panel === 'blocks') {
      updates.sidebarPosition = side;
    }
    set(updates);
  },

  toggleCollab: () => {
    const pp = { ...get().panelPlacements };
    pp.collab = { ...pp.collab, open: !pp.collab.open };
    set({
      panelPlacements: pp,
      collabOpen: pp.collab.open,
    });
  },
  setUsername: (name: string) => {
    const next = sanitizeSessionAlias(name, get().username);
    try {
      localStorage.setItem(SESSION_ALIAS_STORAGE_KEY, next);
    } catch {}
    set({ username: next });
  },

  createSession: async () => {
    try {
      await get().saveProjectToDb();
      const stateAfterSave = get();
      const workspaceTree = buildWorkspaceSnapshotFromState(stateAfterSave);
      const syncedTabs = syncActiveTabIntoTabs(stateAfterSave);
      const active = syncedTabs.find((tab) => tab.id === stateAfterSave.activeTabId) || syncedTabs[0] || null;
      const root = getRootTab(active, syncedTabs);
      const projectId = root?.projectId ?? workspaceTree?.root.projectId ?? null;
      if (!projectId || !workspaceTree) {
        throw new Error('No persisted root workspace available for session creation');
      }

      const sRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, workspace_tree: workspaceTree }),
      });
      if (!sRes.ok) {
        throw new Error(`Session creation failed: ${sRes.status}`);
      }
      const session = await sRes.json();

      await get().joinSession(session.id);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  },

  joinSession: async (sessionId: string) => {
    const { ws: existingWs, username } = get();
    if (existingWs) {
      existingWs.close();
    }

    const wsUrl = `${getWsBase()}/api/ws/${sessionId}?username=${encodeURIComponent(username)}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      set({ sessionId, ws });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'users') {
          set({ connectedUsers: msg.users });
        }

        if (msg.type === 'init' && msg.project) {
          const workspaceTree = msg.workspaceTree && typeof msg.workspaceTree === 'object' ? msg.workspaceTree : null;
          if (workspaceTree?.version === 'langsuite.v21.workspace') {
            const hydrated = hydrateWorkspaceSnapshot(workspaceTree as WorkspaceTreeSnapshot);
            set({
              _syncing: true,
              tabs: hydrated.tabs,
              activeTabId: hydrated.activeTabId,
              projectName: hydrated.projectName,
              nodes: hydrated.nodes,
              edges: hydrated.edges,
              isAsync: hydrated.isAsync,
            });
            const loadedNodes = hydrated.tabs.flatMap((tab) => tab.nodes);
            const maxId = loadedNodes.reduce((max: number, n: Node) => {
              const match = n.id.match(/_(\d+)$/);
              return match ? Math.max(max, parseInt(match[1], 10)) : max;
            }, 0);
            nodeCounter = maxId;
            set({ _syncing: false });
          } else {
            const projectData = typeof msg.project.data === 'string' ? JSON.parse(msg.project.data) : msg.project.data;
            const loadedSchema = Array.isArray(projectData.customStateSchema) ? projectData.customStateSchema : [];
            const loadedBindings = Array.isArray(projectData.graphBindings) ? projectData.graphBindings : [];
            const loadedIsAsync = typeof projectData.isAsync === 'boolean' ? projectData.isAsync : get().isAsync;
            set({
              _syncing: true,
              projectName: msg.project.name || get().projectName,
              nodes: projectData.nodes || [],
              edges: projectData.edges || [],
              isAsync: loadedIsAsync,
              tabs: get().tabs.map((t: Tab) => t.id === get().activeTabId ? {
                ...t,
                projectId: msg.project.id || t.projectId,
                projectName: msg.project.name || get().projectName,
                parentProjectId: msg.project.parent_project_id ?? t.parentProjectId ?? null,
                parentNodeId: msg.project.parent_node_id ?? t.parentNodeId ?? null,
                scopeKind: projectData.scopeKind || inferScopeKind(msg.project.parent_project_id ?? t.parentProjectId ?? null, msg.project.parent_node_id ?? t.parentNodeId ?? null),
                scopePath: projectData.scopePath || buildScopePath(msg.project.name || get().projectName, msg.project.parent_node_id ?? t.parentNodeId ?? null),
                nodes: projectData.nodes || [],
                edges: projectData.edges || [],
                customStateSchema: loadedSchema,
                graphBindings: loadedBindings,
                isAsync: loadedIsAsync,
                artifactType: isArtifactType(projectData.artifactType) ? projectData.artifactType : (projectData.scopeKind === 'subgraph' ? 'subgraph' : 'graph'),
                executionProfile: isExecutionProfile(projectData.executionProfile) ? projectData.executionProfile : defaultExecutionProfile(loadedIsAsync, isArtifactType(projectData.artifactType) ? projectData.artifactType : (projectData.scopeKind === 'subgraph' ? 'subgraph' : 'graph')),
                projectMode: normalizeProjectMode(projectData.projectMode, isArtifactType(projectData.artifactType) ? projectData.artifactType : (projectData.scopeKind === 'subgraph' ? 'subgraph' : 'graph'), isExecutionProfile(projectData.executionProfile) ? projectData.executionProfile : defaultExecutionProfile(loadedIsAsync, isArtifactType(projectData.artifactType) ? projectData.artifactType : (projectData.scopeKind === 'subgraph' ? 'subgraph' : 'graph'))),
                runtimeSettings: sanitizeRuntimeSettings(projectData.runtimeSettings, normalizeProjectMode(projectData.projectMode, isArtifactType(projectData.artifactType) ? projectData.artifactType : (projectData.scopeKind === 'subgraph' ? 'subgraph' : 'graph'), isExecutionProfile(projectData.executionProfile) ? projectData.executionProfile : defaultExecutionProfile(loadedIsAsync, isArtifactType(projectData.artifactType) ? projectData.artifactType : (projectData.scopeKind === 'subgraph' ? 'subgraph' : 'graph')))),
              } : t),
            });
            const loadedNodes = projectData.nodes || [];
            const maxId = loadedNodes.reduce((max: number, n: Node) => {
              const match = n.id.match(/_(\d+)$/);
              return match ? Math.max(max, parseInt(match[1], 10)) : max;
            }, 0);
            nodeCounter = maxId;
            set({ _syncing: false });
          }
        }

        if (msg.type === 'sync') {
          const workspaceTree = msg.workspaceTree && typeof msg.workspaceTree === 'object' ? msg.workspaceTree : null;
          if (workspaceTree?.version === 'langsuite.v21.workspace') {
            const hydrated = hydrateWorkspaceSnapshot(workspaceTree as WorkspaceTreeSnapshot);
            set({
              _syncing: true,
              tabs: hydrated.tabs,
              activeTabId: hydrated.activeTabId,
              projectName: hydrated.projectName,
              nodes: hydrated.nodes,
              edges: hydrated.edges,
              isAsync: hydrated.isAsync,
            });
            set({ _syncing: false });
          } else {
            const syncedSchema = Array.isArray(msg.customStateSchema) ? msg.customStateSchema : [];
            const syncedBindings = Array.isArray(msg.graphBindings) ? msg.graphBindings : [];
            const syncedIsAsync = typeof msg.isAsync === 'boolean' ? msg.isAsync : get().isAsync;
            const syncedProjectName = typeof msg.projectName === 'string' && msg.projectName.trim() ? msg.projectName : get().projectName;
            const currentActiveTab = get().tabs.find((tab: Tab) => tab.id === get().activeTabId);
            const syncedParentProjectId = typeof msg.parentProjectId === 'string' ? msg.parentProjectId : currentActiveTab?.parentProjectId ?? null;
            const syncedParentNodeId = typeof msg.parentNodeId === 'string' ? msg.parentNodeId : currentActiveTab?.parentNodeId ?? null;
            const syncedScopeKind: GraphScopeKind = msg.scopeKind === 'subgraph' ? 'subgraph' : inferScopeKind(syncedParentProjectId, syncedParentNodeId);
            const syncedScopePath = typeof msg.scopePath === 'string' && msg.scopePath.trim() ? msg.scopePath : buildScopePath(syncedProjectName, syncedParentNodeId);
            set({
              _syncing: true,
              projectName: syncedProjectName,
              nodes: msg.nodes || [],
              edges: msg.edges || [],
              isAsync: syncedIsAsync,
              tabs: get().tabs.map((t: Tab) => t.id === get().activeTabId ? {
                ...t,
                projectName: syncedProjectName,
                projectId: t.projectId ?? get().tabs.find((tab) => tab.id === get().activeTabId)?.projectId ?? null,
                parentProjectId: syncedParentProjectId,
                parentNodeId: syncedParentNodeId,
                scopeKind: syncedScopeKind,
                scopePath: syncedScopePath,
                nodes: msg.nodes || [],
                edges: msg.edges || [],
                customStateSchema: syncedSchema,
                graphBindings: syncedBindings,
                isAsync: syncedIsAsync,
                artifactType: isArtifactType(msg.artifactType) ? msg.artifactType : syncedScopeKind === 'subgraph' ? 'subgraph' : t.artifactType,
                executionProfile: isExecutionProfile(msg.executionProfile) ? msg.executionProfile : defaultExecutionProfile(syncedIsAsync, isArtifactType(msg.artifactType) ? msg.artifactType : syncedScopeKind === 'subgraph' ? 'subgraph' : t.artifactType),
                projectMode: normalizeProjectMode(msg.projectMode, isArtifactType(msg.artifactType) ? msg.artifactType : syncedScopeKind === 'subgraph' ? 'subgraph' : t.artifactType, isExecutionProfile(msg.executionProfile) ? msg.executionProfile : defaultExecutionProfile(syncedIsAsync, isArtifactType(msg.artifactType) ? msg.artifactType : syncedScopeKind === 'subgraph' ? 'subgraph' : t.artifactType)),
                runtimeSettings: sanitizeRuntimeSettings(msg.runtimeSettings, normalizeProjectMode(msg.projectMode, isArtifactType(msg.artifactType) ? msg.artifactType : syncedScopeKind === 'subgraph' ? 'subgraph' : t.artifactType, isExecutionProfile(msg.executionProfile) ? msg.executionProfile : defaultExecutionProfile(syncedIsAsync, isArtifactType(msg.artifactType) ? msg.artifactType : syncedScopeKind === 'subgraph' ? 'subgraph' : t.artifactType))),
              } : t),
            });
            set({ _syncing: false });
          }
        }
      } catch (err) {
        console.error('WS message parse error:', err);
      }
    };

    ws.onclose = () => {
      set({ sessionId: null, ws: null, connectedUsers: [] });
    };

    ws.onerror = () => {
      console.error('WebSocket error');
    };
  },

  leaveSession: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
    }
    set({ sessionId: null, ws: null, connectedUsers: [] });
  },

  sendSync: () => {
    const { ws, _syncing } = get();
    if (!ws || ws.readyState !== WebSocket.OPEN || _syncing) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      const state = get();
      const { nodes, edges, isAsync, projectName, tabs, activeTabId } = state;
      const activeTab = tabs.find((t: Tab) => t.id === activeTabId);
      const workspaceTree = buildWorkspaceSnapshotFromState(state);
      ws.send(JSON.stringify({
        type: 'sync',
        projectName,
        nodes,
        edges,
        isAsync,
        customStateSchema: activeTab?.customStateSchema || [],
        graphBindings: activeTab?.graphBindings || [],
        scopeKind: activeTab?.scopeKind || 'project',
        scopePath: activeTab?.scopePath || buildScopePath(projectName),
        artifactType: activeTab?.artifactType || 'graph',
        executionProfile: activeTab?.executionProfile || defaultExecutionProfile(isAsync, activeTab?.artifactType || 'graph'),
        projectMode: activeTab?.projectMode || inferProjectModeFromSurface(activeTab?.artifactType || 'graph', activeTab?.executionProfile || defaultExecutionProfile(isAsync, activeTab?.artifactType || 'graph')),
        runtimeSettings: activeTab?.runtimeSettings || defaultRuntimeSettings(activeTab?.projectMode || 'langgraph'),
        parentProjectId: activeTab?.parentProjectId ?? null,
        parentNodeId: activeTab?.parentNodeId ?? null,
        workspaceTree,
      }));
    }, SYNC_DEBOUNCE_MS);
  },
  statePanelOpen: false,
  toggleStatePanel: () => {
    const pp = { ...get().panelPlacements };
    pp.state = { ...pp.state, open: !pp.state.open };
    set({
      panelPlacements: pp,
      statePanelOpen: pp.state.open,
    });
  },

  updateCustomStateSchema: (schema: { name: string; type: string; reducer: string }[]) => {
    set((state: AppState) => {
      if (!state.activeTabId) return state;
      const newTabs = state.tabs.map((t: Tab) =>
        t.id === state.activeTabId ? { ...t, customStateSchema: schema, isDirty: true } : t
      );
      state._triggerAutoSave();
      if (!state._syncing) {
        setTimeout(() => {
          const current = get();
          if (!current._syncing) current.sendSync();
        }, 0);
      }
      return { tabs: newTabs };
    });
  },

  updateGraphBindings: (bindings: GraphBinding[]) => {
    set((state: AppState) => {
      if (!state.activeTabId) return state;
      const sanitized: GraphBinding[] = bindings
        .map((b): GraphBinding => ({
          name: String(b.name || '').trim(),
          value: String(b.value ?? ''),
          kind: b.kind === 'constant' ? 'constant' : 'variable',
        }))
        .filter((b) => b.name);
      const newTabs = state.tabs.map((t: Tab) =>
        t.id === state.activeTabId ? { ...t, graphBindings: sanitized, isDirty: true } : t
      );
      state._triggerAutoSave();
      if (!state._syncing) {
        setTimeout(() => {
          const current = get();
          if (!current._syncing) current.sendSync();
        }, 0);
      }
      return { tabs: newTabs };
    });
  },

  updateArtifactType: (artifactType: ArtifactType) => {
    set((state: AppState) => ({
      tabs: state.tabs.map((t: Tab) => t.id === state.activeTabId
        ? {
            ...t,
            artifactType,
            executionProfile: defaultExecutionProfile(t.isAsync, artifactType),
            scopeKind: artifactType === 'subgraph' ? 'subgraph' : (t.scopeKind === 'subgraph' ? 'project' : t.scopeKind),
            isDirty: true,
          }
        : t),
    }));
    get()._markActiveTabDirty();
    if (!get()._syncing) get().sendSync();
  },

  updateExecutionProfile: (profile: ExecutionProfile) => {
    set((state: AppState) => ({
      isAsync: profile === 'langgraph_sync' ? false : state.isAsync,
      tabs: state.tabs.map((t: Tab) => t.id === state.activeTabId
        ? {
            ...t,
            executionProfile: profile,
            isAsync: profile === 'langgraph_sync' ? false : profile === 'langgraph_async' ? true : t.isAsync,
            isDirty: true,
          }
        : t),
    }));
    const active = get().tabs.find((t) => t.id === get().activeTabId);
    if (active && (profile === 'langgraph_sync' || profile === 'langgraph_async')) {
      set({ isAsync: profile === 'langgraph_async' });
    }
    get()._markActiveTabDirty();
    if (!get()._syncing) get().sendSync();
  },

  updateRuntimeSettings: (settings: Partial<RuntimeSettings>) => {
    set((state: AppState) => ({
      tabs: state.tabs.map((t: Tab) => t.id === state.activeTabId ? { ...t, runtimeSettings: sanitizeRuntimeSettings({ ...t.runtimeSettings, ...settings }), isDirty: true } : t),
    }));
    get()._markActiveTabDirty();
    if (!get()._syncing) get().sendSync();
  },

  setCapabilityInspectorTarget: (target) => {
    set({ capabilityInspectorTarget: target });
    const placements = get().panelPlacements;
    if (!placements.state.open) {
      const nextPlacements = { ...placements, state: { ...placements.state, open: true } };
      set({ panelPlacements: nextPlacements, statePanelOpen: true });
    }
  },

  requestRuntimeFocus: (nodeId, source = 'graph') => {
    if (typeof nodeId !== 'string' || !nodeId.trim()) return;
    set({ runtimeFocusRequest: { nodeId: nodeId.trim(), nonce: Date.now(), source } });
  },

  clearRuntimeFocusRequest: () => {
    set({ runtimeFocusRequest: null });
  },

  setRuntimeHoverTarget: (nodeId, source = 'graph') => {
    if (typeof nodeId !== 'string' || !nodeId.trim()) return;
    set({ runtimeHoverTarget: { nodeId: nodeId.trim(), source } });
  },

  clearRuntimeHoverTarget: (source, nodeId) => {
    set((state: AppState) => {
      if (!state.runtimeHoverTarget) return state;
      if (source && state.runtimeHoverTarget.source !== source) return state;
      if (nodeId && state.runtimeHoverTarget.nodeId !== nodeId) return state;
      return { runtimeHoverTarget: null } as Partial<AppState>;
    });
  },

  updateRuntimeEdgeLegend: (patch) => {
    set((state: AppState) => ({
      runtimeEdgeLegend: {
        ...state.runtimeEdgeLegend,
        ...patch,
      },
    }));
  },

  updateRuntimeNavigationSettings: (patch) => {
    set((state: AppState) => ({
      runtimeNavigationSettings: {
        ...state.runtimeNavigationSettings,
        ...patch,
      },
    }));
  },

  openSubgraphTabFromNode: async (nodeId: string) => {
    const state = get();
    const syncedTabs = syncActiveTabIntoTabs(state);
    const active = syncedTabs.find((tab) => tab.id === state.activeTabId) || null;
    const root = getRootTab(active, syncedTabs);
    const node = state.nodes.find((candidate) => candidate.id === nodeId);
    if (!root || !node) return;
    const params = getNodeParams(node.data);
    const artifactRefKind = typeof params.artifact_ref_kind === 'string' ? params.artifact_ref_kind : null;
    const targetSubgraph = typeof params.target_subgraph === 'string' ? params.target_subgraph : '';
    const explicitKind = artifactRefKind || (targetSubgraph.startsWith('artifact:') ? targetSubgraph.split(':')[1]?.split('/')[0] || null : null);
    const explicitId = typeof params.artifact_ref_id === 'string' ? params.artifact_ref_id : (targetSubgraph.startsWith('artifact:') ? targetSubgraph.split('/').slice(1).join('/') || null : null);

    const existing = syncedTabs.find((tab) => tab.scopeKind === 'subgraph' && tab.parentNodeId === nodeId);
    if (existing) {
      set({ tabs: syncedTabs });
      get().switchTab(existing.id);
      return;
    }

    if (explicitKind && explicitId) {
      const res = await fetch(`/api/artifacts/${explicitKind}/${explicitId}`);
      if (!res.ok) return;
      const manifest = await res.json();
      const artifact = manifest.artifact || {};
      const hydrated = hydrateArtifactEditorGraph(artifact);
      const artifactType = (artifact.artifactType || explicitKind) as ArtifactType;
      const projectMode = normalizeProjectMode(artifact.projectMode, artifactType, artifact.executionProfile || defaultExecutionProfile(typeof artifact.isAsync === 'boolean' ? artifact.isAsync : true, artifactType));
      const isChildSubgraph = artifactType === 'subgraph';
      get().openTab(null, artifact.name || manifest.title || 'Referenced Artifact', hydrated.nodes || [], hydrated.edges || [], artifact.customStateSchema || [], typeof artifact.isAsync === 'boolean' ? artifact.isAsync : true, {
        parentProjectId: isChildSubgraph ? (root.projectId ?? null) : null,
        parentTabId: isChildSubgraph ? root.id : null,
        parentNodeId: isChildSubgraph ? nodeId : null,
        scopeKind: isChildSubgraph ? 'subgraph' : 'project',
        scopePath: buildScopePath(artifact.name || manifest.title || 'Referenced Artifact', isChildSubgraph ? nodeId : undefined),
        graphBindings: artifact.graphBindings || [],
        artifactType,
        executionProfile: artifact.executionProfile || defaultExecutionProfile(typeof artifact.isAsync === 'boolean' ? artifact.isAsync : true, artifactType),
        projectMode,
        runtimeSettings: artifact.runtimeSettings || defaultRuntimeSettings(projectMode),
      });
      return;
    }

    if (String(node.data?.nodeType || '') !== 'subgraph_node') return;

    const title = typeof node.data?.label === 'string' && node.data.label.trim() ? `${node.data.label} Child` : 'Child Subgraph';
    get().openTab(null, title, [], [], [], true, {
      parentProjectId: root.projectId ?? null,
      parentTabId: root.id,
      parentNodeId: nodeId,
      scopeKind: 'subgraph',
      scopePath: buildScopePath(title, nodeId),
      graphBindings: [],
      artifactType: 'subgraph',
      executionProfile: 'langgraph_async',
      runtimeSettings: defaultRuntimeSettings(),
    });
  },

}));
