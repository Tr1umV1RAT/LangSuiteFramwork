import {
  type ArtifactType,
  type BlockFamily,
  type BuilderArtifactKind,
  type CompileStrategy,
  type ProjectMode,
  type ExecutionFlavor,
  type ExecutionPlacement,
  type ExecutionProfile,
  type GraphScopeKind,
  type NodeRuntimeMeta,
  type RailId,
  type RuntimeOrigin,
  type SurfaceLevel,
  type SupportStatus,
  BLOCK_FAMILY_BADGE_CLASSES,
  BLOCK_FAMILY_LABELS,
  DEFAULT_NODE_RUNTIME_META,
  getNodeRuntimeMetaMatrix,
  inferNodeBlockFamily,
  isPaletteHiddenNodeType,
  isRuntimeBackedNodeType,
  VISIBLE_ARTIFACT_TYPES,
  VISIBLE_EXECUTION_PROFILES,
  RAIL_META,
  SUPPORT_STATUS_META,
} from './capabilities';

export type {
  ArtifactType,
  BlockFamily,
  BuilderArtifactKind,
  CompileStrategy,
  ExecutionFlavor,
  ExecutionPlacement,
  ExecutionProfile,
  GraphScopeKind,
  NodeRuntimeMeta,
  RailId,
  RuntimeOrigin,
  SurfaceLevel,
};

export type NodeMaturity = 'supported' | 'advanced' | 'experimental' | 'legacy';
export { VISIBLE_ARTIFACT_TYPES, VISIBLE_EXECUTION_PROFILES };

export interface SurfaceContext {
  artifactType?: string | null;
  executionProfile?: string | null;
  projectMode?: ProjectMode | null;
}

export interface NodeCapabilityInfo {
  canonicalNodeType: string;
  compileTargetType: string;
  runtimeBacked: boolean;
  aliasBacked: boolean;
  wrapper: boolean;
  abstraction: boolean;
  legacySurface: boolean;
  supportedExecutionProfiles: ExecutionProfile[];
  blockFamily: BlockFamily;
  visibleInSimpleMode: boolean;
  visibleInAdvancedMode: boolean;
  opensSubgraphEditor: boolean;
  hiddenFromPalette: boolean;
  hiddenReason: string | null;
  supportStatus: SupportStatus;
  oneLine: string;
  allowedEditorContexts: GraphScopeKind[];
  futureHook: boolean;
  internalOnly: boolean;
  rail: RailId;
  surfaceLevel: SurfaceLevel;
  trunkDependent: boolean;
  adapterBacked: boolean;
  wrapperBacked: boolean;
  directCompile: boolean;
  directRun: boolean;
  supportedProjectModes: ProjectMode[];
}

export const DEFAULT_RUNTIME_META: NodeRuntimeMeta = DEFAULT_NODE_RUNTIME_META;

export const KIND_LABELS: Record<BuilderArtifactKind, string> = { primitive: 'Primitive', composite: 'Composite', suite: 'Suite', reference: 'Reference' };
export const ORIGIN_LABELS: Record<RuntimeOrigin, string> = { shared: 'Shared', langgraph: 'LangGraph', langchain: 'LangChain-backed', deepagents: 'DeepAgents-backed' };
export const EXECUTION_PLACEMENT_LABELS: Record<ExecutionPlacement, string> = { graph: 'Graph', tool: 'Tool', subgraph: 'Subgraph', suite: 'Suite', memory: 'Memory', runtime: 'Runtime' };
export const EXECUTION_FLAVOR_LABELS: Record<ExecutionFlavor, string> = { inherit: 'Inherit', sync: 'Sync', async: 'Async', 'tool-call': 'ToolCall' };
export const KIND_BADGE_CLASSES: Record<BuilderArtifactKind, string> = { primitive: 'text-blue-300 bg-blue-500/10 border-blue-500/20', composite: 'text-violet-300 bg-violet-500/10 border-violet-500/20', suite: 'text-amber-300 bg-amber-500/10 border-amber-500/20', reference: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' };
export const ORIGIN_BADGE_CLASSES: Record<RuntimeOrigin, string> = { shared: 'text-slate-300 bg-slate-500/10 border-slate-500/20', langgraph: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20', langchain: 'text-violet-300 bg-violet-500/10 border-violet-500/20', deepagents: 'text-amber-300 bg-amber-500/10 border-amber-500/20' };
export const PLACEMENT_BADGE_CLASSES: Record<ExecutionPlacement, string> = { graph: 'text-slate-200 bg-slate-500/10 border-slate-500/20', tool: 'text-orange-300 bg-orange-500/10 border-orange-500/20', subgraph: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20', suite: 'text-amber-300 bg-amber-500/10 border-amber-500/20', memory: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20', runtime: 'text-pink-300 bg-pink-500/10 border-pink-500/20' };
export const FLAVOR_BADGE_CLASSES: Record<ExecutionFlavor, string> = { inherit: 'text-slate-300 bg-slate-500/10 border-slate-500/20', sync: 'text-amber-300 bg-amber-500/10 border-amber-500/20', async: 'text-violet-300 bg-violet-500/10 border-violet-500/20', 'tool-call': 'text-orange-300 bg-orange-500/10 border-orange-500/20' };
export const SURFACE_LABELS: Record<SurfaceLevel, string> = { stable: 'Stable', advanced: 'Advanced', internal: 'Internal' };
export const SURFACE_BADGE_CLASSES: Record<SurfaceLevel, string> = { stable: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20', advanced: 'text-amber-300 bg-amber-500/10 border-amber-500/20', internal: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
export const MATURITY_LABELS: Record<NodeMaturity, string> = {
  supported: 'Supported',
  advanced: 'Advanced',
  experimental: 'Experimental',
  legacy: 'Legacy',
};
export const MATURITY_BADGE_CLASSES: Record<NodeMaturity, string> = {
  supported: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  advanced: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  experimental: 'text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/20',
  legacy: 'text-slate-300 bg-slate-500/10 border-slate-500/20',
};

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  trunk_runtime: SUPPORT_STATUS_META.trunk_runtime.label,
  bridge_backed_runtime: SUPPORT_STATUS_META.bridge_backed_runtime.label,
  editor_only: SUPPORT_STATUS_META.editor_only.label,
  alias_backed: SUPPORT_STATUS_META.alias_backed.label,
};
export const SUPPORT_STATUS_BADGE_CLASSES: Record<SupportStatus, string> = {
  trunk_runtime: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  bridge_backed_runtime: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  editor_only: 'text-slate-300 bg-slate-500/10 border-slate-500/20',
  alias_backed: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
};
export const RAIL_LABELS: Record<RailId, string> = {
  trunk: RAIL_META.trunk.label,
  composition: RAIL_META.composition.label,
  agentic: RAIL_META.agentic.label,
  adapter: RAIL_META.adapter.label,
  services: RAIL_META.services.label,
};
export const RAIL_BADGE_CLASSES: Record<RailId, string> = {
  trunk: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  composition: 'text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/20',
  agentic: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
  adapter: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  services: 'text-slate-300 bg-slate-500/10 border-slate-500/20',
};

export function normalizeRailId(value: unknown): RailId {
  return typeof value === 'string' && value in RAIL_LABELS ? (value as RailId) : 'trunk';
}

export function getRailLabel(value: unknown): string {
  return RAIL_LABELS[normalizeRailId(value)] || RAIL_LABELS.trunk;
}

export function getRailBadgeClass(value: unknown): string {
  return RAIL_BADGE_CLASSES[normalizeRailId(value)] || RAIL_BADGE_CLASSES.trunk;
}

export const KIND_ORDER: BuilderArtifactKind[] = ['primitive', 'composite', 'suite', 'reference'];
export { BLOCK_FAMILY_BADGE_CLASSES, BLOCK_FAMILY_LABELS };

export function getNodeRuntimeMeta(nodeType: string): NodeRuntimeMeta {
  return getNodeRuntimeMetaMatrix(nodeType);
}

export function getCompileNodeType(nodeType: string): string {
  const meta = getNodeRuntimeMeta(nodeType);
  if (meta.compileStrategy === 'alias' && meta.compileAliasType) return meta.compileAliasType;
  return nodeType;
}

export function isNodeCompatibleWithSurface(nodeType: string, surface: SurfaceContext): boolean {
  const meta = getNodeRuntimeMeta(nodeType);
  const artifactType = (surface.artifactType || 'graph') as ArtifactType;
  const executionProfile = (surface.executionProfile || 'langgraph_async') as ExecutionProfile;
  const projectMode = (surface.projectMode || 'langgraph') as ProjectMode;
  return (meta.naturalArtifactTypes || []).includes(artifactType) && (meta.naturalProfiles || []).includes(executionProfile) && (meta.allowedProjectModes || ['langgraph', 'langchain', 'deepagents']).includes(projectMode);
}

export function isNodeBackedByRuntime(nodeType: string): boolean {
  return isRuntimeBackedNodeType(nodeType);
}

export function isNodePaletteHiddenByPolicy(nodeType: string): boolean {
  return isPaletteHiddenNodeType(nodeType);
}

export function isNodeVisibleInSimpleMode(nodeType: string, surface: SurfaceContext): boolean {
  const meta = getNodeRuntimeMeta(nodeType);
  return meta.surfaceLevel !== 'advanced'
    && meta.surfaceLevel !== 'internal'
    && isNodeBackedByRuntime(nodeType)
    && !isNodePaletteHiddenByPolicy(nodeType)
    && isNodeCompatibleWithSurface(nodeType, surface);
}

export function isNodeVisibleInAdvancedMode(nodeType: string, surface: SurfaceContext): boolean {
  const meta = getNodeRuntimeMeta(nodeType);
  return isNodeBackedByRuntime(nodeType)
    && !Boolean(meta.internalOnly)
    && !isNodePaletteHiddenByPolicy(nodeType)
    && (meta.surfaceLevel !== 'internal')
    && (isNodeCompatibleWithSurface(nodeType, surface) || Boolean(meta.advancedVisible));
}

export function getNodeHiddenReason(nodeType: string, surface: SurfaceContext): string | null {
  const meta = getNodeRuntimeMeta(nodeType);
  if (!isNodeBackedByRuntime(nodeType)) {
    return 'Loaded from older metadata only; no current runtime implementation is exposed in the palette.';
  }
  if (Boolean(meta.internalOnly)) {
    return 'Internal-only rail surface kept for compatibility or plumbing, not direct authoring.';
  }
  if (isNodePaletteHiddenByPolicy(nodeType)) {
    return 'Opened through wrappers or artifact flows rather than direct palette insertion.';
  }
  if (!isNodeCompatibleWithSurface(nodeType, surface)) {
    return 'Not a natural fit for the current project mode / artifact / profile surface; still available only when advanced gating permits it.';
  }
  return null;
}

export function inferNodeSupportStatus(nodeType: string, surface: SurfaceContext = {}): SupportStatus {
  const meta = getNodeRuntimeMeta(nodeType);
  const compileTargetType = getCompileNodeType(nodeType);
  const runtimeBacked = isNodeBackedByRuntime(nodeType);
  const aliasBacked = meta.compileStrategy === 'alias' && compileTargetType !== nodeType;

  if (aliasBacked) return 'alias_backed';
  if (!runtimeBacked || Boolean(meta.internalOnly) || (!Boolean(meta.directCompile) && !Boolean(meta.directRun) && meta.compileStrategy === 'reference_only')) {
    return 'editor_only';
  }
  if (Boolean(meta.adapterBacked) || Boolean(meta.wrapperBacked) || meta.executionPlacement === 'subgraph' || meta.compileStrategy === 'reference_only') {
    return 'bridge_backed_runtime';
  }
  return 'trunk_runtime';
}

export function inferNodeMaturity(nodeType: string, surface: SurfaceContext = {}): NodeMaturity {
  const capability = getNodeCapabilityInfo(nodeType, surface);
  if (capability.legacySurface) return 'legacy';
  if (capability.futureHook) return 'experimental';
  if (capability.surfaceLevel === 'advanced') return 'advanced';
  return 'supported';
}

export function getNodeCapabilityInfo(nodeType: string, surface: SurfaceContext = {}): NodeCapabilityInfo {
  const meta = getNodeRuntimeMeta(nodeType);
  const compileTargetType = getCompileNodeType(nodeType);
  const runtimeBacked = isNodeBackedByRuntime(nodeType);
  const aliasBacked = meta.compileStrategy === 'alias' && compileTargetType !== nodeType;
  const wrapper = Boolean(meta.wrapperBacked) || meta.executionPlacement === 'subgraph' || Boolean(meta.quickProps?.includes('wrapper')) || meta.compileStrategy === 'reference_only';
  const blockFamily = inferNodeBlockFamily(nodeType, meta);
  const legacySurface = meta.origin === 'langchain' || meta.origin === 'deepagents';
  const abstraction = !wrapper && (meta.kind !== 'primitive' || aliasBacked || Boolean(meta.fauxNode));
  const visibleInSimpleMode = isNodeVisibleInSimpleMode(nodeType, surface);
  const visibleInAdvancedMode = isNodeVisibleInAdvancedMode(nodeType, surface);
  const hiddenReason = getNodeHiddenReason(nodeType, surface);
  const supportStatus = inferNodeSupportStatus(nodeType, surface);

  return {
    canonicalNodeType: nodeType,
    compileTargetType,
    runtimeBacked,
    aliasBacked,
    wrapper,
    abstraction,
    legacySurface,
    supportedExecutionProfiles: meta.naturalProfiles || [],
    blockFamily,
    supportedProjectModes: meta.allowedProjectModes || ['langgraph', 'langchain', 'deepagents'],
    visibleInSimpleMode,
    visibleInAdvancedMode,
    opensSubgraphEditor: nodeType === 'subgraph_node' || (meta.executionPlacement === 'subgraph' && !aliasBacked),
    hiddenFromPalette: Boolean(hiddenReason),
    hiddenReason,
    supportStatus,
    oneLine: meta.summary || 'Catalog surface without extra runtime notes.',
    allowedEditorContexts: meta.allowedEditorContexts || ['project', 'subgraph'],
    futureHook: Boolean(meta.futureHook),
    internalOnly: Boolean(meta.internalOnly),
    rail: meta.rail || 'trunk',
    surfaceLevel: meta.surfaceLevel || 'stable',
    trunkDependent: Boolean(meta.trunkDependent),
    adapterBacked: Boolean(meta.adapterBacked),
    wrapperBacked: Boolean(meta.wrapperBacked),
    directCompile: Boolean(meta.directCompile),
    directRun: Boolean(meta.directRun),
  };
}

export function getSuggestedWrapperNodeType(kind: ArtifactType): string {
  if (kind === 'deep_agent') return 'deep_agent_suite';
  if (kind === 'graph' || kind === 'subgraph') return 'subgraph_node';
  return 'sub_agent';
}
