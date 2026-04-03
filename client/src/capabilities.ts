import matrix from './capabilityMatrix.json';

export type RailId = keyof typeof matrix.rails;
export type ProjectMode = keyof typeof matrix.projectModes;
export type SurfaceLevel = 'stable' | 'advanced' | 'internal';
export type SupportStatus = keyof typeof matrix.supportStatusLegend;
export type PackagingEligibility = 'stable' | 'experimental' | 'none';
export type ArtifactType = keyof typeof matrix.artifactKinds;
export type ExecutionProfile = keyof typeof matrix.executionProfiles;
export type GraphScopeKind = 'project' | 'subgraph';
export type BuilderArtifactKind = 'primitive' | 'composite' | 'suite' | 'reference';
export type RuntimeOrigin = 'shared' | 'langgraph' | 'langchain' | 'deepagents';
export type ExecutionPlacement = 'graph' | 'tool' | 'subgraph' | 'suite' | 'memory' | 'runtime';
export type ExecutionFlavor = 'inherit' | 'sync' | 'async' | 'tool-call';
export type BlockFamily = 'native' | 'structured' | 'embedded' | 'code';
export type CompileStrategy = 'canonical' | 'alias' | 'reference_only';

export interface RailMeta {
  label: string;
  description: string;
}

export interface SupportStatusMeta {
  label: string;
  description: string;
}

export type BridgeSupportLevel = 'direct' | 'compile_capable' | 'editor_package_only';
export type BridgeStatus = 'supported' | 'partial' | 'unsupported';
export type BridgeIntegrationModel = 'direct_reference' | 'lowered_bridge' | 'embedded_native';

export interface ProjectModeMeta {
  label: string;
  description: string;
  visible: boolean;
  surfaceLevel: SurfaceLevel;
  runtimeEnabled: boolean;
  compileEnabled: boolean;
  advanced: boolean;
  defaultArtifactType: ArtifactType;
  defaultExecutionProfile: ExecutionProfile;
  defaultAsync: boolean;
  defaultStreamMode: 'updates' | 'values' | 'debug';
  trunkDependent: boolean;
  adapterBacked: boolean;
}

export interface ArtifactKindMeta {
  label: string;
  visible: boolean;
  libraryVisible: boolean;
  advancedLibraryVisible?: boolean;
  scopeKind: GraphScopeKind;
  artifactDirectory: string;
  defaultExecutionProfile: ExecutionProfile;
  defaultAsync: boolean;
  legacy: boolean;
  futureHook: boolean;
  internalOnly: boolean;
  description: string;
  rail: RailId;
  surfaceLevel: SurfaceLevel;
  packagingEligibility: PackagingEligibility;
  trunkDependent: boolean;
  adapterBacked: boolean;
  wrapperBacked: boolean;
  directCompile: boolean;
  directRun: boolean;
}

export interface ExecutionProfileMeta {
  label: string;
  visible: boolean;
  legacy: boolean;
  futureHook: boolean;
  description: string;
  isAsync: boolean;
  rail: RailId;
  surfaceLevel: SurfaceLevel;
  advancedVisible?: boolean;
  directRun: boolean;
  trunkDependent: boolean;
  adapterBacked: boolean;
}


export interface ModeContractMeta {
  label: string;
  allowedArtifactKinds: ArtifactType[];
  allowedExecutionProfiles: ExecutionProfile[];
  compileEnabled: boolean;
  runtimeEnabled: boolean;
  defaultLibraryKinds: ArtifactType[];
  advancedLibraryKinds: ArtifactType[];
  bridgeTargets: ProjectMode[];
  editorOnly: boolean;
}

export interface InteroperabilityBridgeMeta {
  id: string;
  sourceMode: ProjectMode;
  targetMode: ProjectMode;
  sourceArtifactKinds: ArtifactType[];
  targetArtifactKinds: ArtifactType[];
  wrapperNodeType: string;
  status: BridgeStatus;
  supportLevel: BridgeSupportLevel;
  integrationModel?: BridgeIntegrationModel;
  executionKind?: BridgeIntegrationModel;
  adapterBacked: boolean;
  summary: string;
  bridgeContractIds?: string[];
  bridgeConstraints?: string[];
  bridgeAllowedToolFamilies?: string[];
  bridgeAcceptedSourceShape?: string;
  bridgeRejectedReasonCodes?: string[];
  bridgeConstraintSummary?: Record<string, unknown>;
}

export interface NodeRuntimeMeta {
  blockFamilyHint?: BlockFamily;
  kind: BuilderArtifactKind;
  origin: RuntimeOrigin;
  summary?: string;
  executionPlacement?: ExecutionPlacement;
  executionFlavor?: ExecutionFlavor;
  compileStrategy?: CompileStrategy;
  compileAliasType?: string;
  fauxNode?: boolean;
  quickProps?: string[];
  autoLinkTargets?: string[];
  naturalArtifactTypes?: ArtifactType[];
  naturalProfiles?: ExecutionProfile[];
  allowedEditorContexts?: GraphScopeKind[];
  futureHook?: boolean;
  internalOnly?: boolean;
  paletteHidden?: boolean;
  rail?: RailId;
  surfaceLevel?: SurfaceLevel;
  advancedVisible?: boolean;
  trunkDependent?: boolean;
  adapterBacked?: boolean;
  wrapperBacked?: boolean;
  directCompile?: boolean;
  directRun?: boolean;
  allowedProjectModes?: ProjectMode[];
  interactionModel?: string;
  providerBacked?: boolean;
  providerKind?: string;
  providerLabel?: string;
  toolkitBacked?: boolean;
  toolFamily?: string;
  toolFamilyLabel?: string;
  sessionBacked?: boolean;
  statefulness?: 'stateless' | 'session' | 'stateful';
  permissionLevel?: 'read_only' | 'mutating' | 'mixed';
  configRequired?: boolean;
  toolProvisioningModel?: 'author_linked' | 'explicit_step' | 'tool_surface';
  toolSelectionAuthority?: 'circuit_creator' | 'bounded_model_choice' | 'runtime_step' | 'not_applicable';
  toolAccessScope?: 'linked_tools_only' | 'explicit_tool_step' | 'single_tool_surface';
  toolResultModel?: 'tool_observation_loop' | 'state_transition' | 'returned_tool_payload';
  linkSemantics?: string[];
  uiAbstractionNotes?: string[];
  structuredOutputCapable?: boolean;
  graphAbstractionKind?: string;
  linkMultiplicity?: string[];
  uiSemanticHandles?: string[];
  compiledGraphRelation?: string;
  debugProjection?: string[];
  memorySystemKind?: string;
  memoryDurability?: string;
  memoryVisibility?: string;
  memoryLastEntryKey?: string;
  memoryConsumer?: boolean;
  memoryRole?: string;
  memoryAccessModel?: string;
  toolRuntimeMemoryAccessMode?: string;
  preferredSurface?: string | boolean;
  consolidationGroup?: string;
  consolidates?: string[];
  legacyHelperSurface?: boolean;
  graphScopeMarker?: boolean;
  detachedAllowed?: boolean;
  graphScopeExplanation?: string;
}



export const CAPABILITY_MATRIX = matrix;
export const RAIL_META = matrix.rails as Record<RailId, RailMeta>;
export const SUPPORT_STATUS_META = matrix.supportStatusLegend as Record<SupportStatus, SupportStatusMeta>;
export const PROJECT_MODE_META = matrix.projectModes as Record<ProjectMode, ProjectModeMeta>;
export const MODE_CONTRACT_META = matrix.modeContracts as Record<ProjectMode, ModeContractMeta>;
export const INTEROPERABILITY_BRIDGES = matrix.interoperabilityBridges as InteroperabilityBridgeMeta[];
export const ARTIFACT_KIND_META = matrix.artifactKinds as Record<ArtifactType, ArtifactKindMeta>;
export const EXECUTION_PROFILE_META = matrix.executionProfiles as Record<ExecutionProfile, ExecutionProfileMeta>;

export const VISIBLE_ARTIFACT_TYPES = (Object.keys(ARTIFACT_KIND_META) as ArtifactType[]).filter((kind) => ARTIFACT_KIND_META[kind].visible);
export const VISIBLE_PROJECT_MODES = (Object.keys(PROJECT_MODE_META) as ProjectMode[]).filter((mode) => PROJECT_MODE_META[mode].visible);
export const VISIBLE_LIBRARY_ARTIFACT_TYPES = (Object.keys(ARTIFACT_KIND_META) as ArtifactType[]).filter((kind) => ARTIFACT_KIND_META[kind].libraryVisible);
export const ADVANCED_LIBRARY_ARTIFACT_TYPES = (Object.keys(ARTIFACT_KIND_META) as ArtifactType[]).filter((kind) => Boolean(ARTIFACT_KIND_META[kind].advancedLibraryVisible));
export const ADVANCED_ARTIFACT_TYPES = (Object.keys(ARTIFACT_KIND_META) as ArtifactType[]).filter((kind) => ARTIFACT_KIND_META[kind].surfaceLevel === 'advanced');
export const VISIBLE_EXECUTION_PROFILES = (Object.keys(EXECUTION_PROFILE_META) as ExecutionProfile[]).filter((profile) => EXECUTION_PROFILE_META[profile].visible);
export const ADVANCED_EXECUTION_PROFILES = (Object.keys(EXECUTION_PROFILE_META) as ExecutionProfile[]).filter((profile) => EXECUTION_PROFILE_META[profile].surfaceLevel === 'advanced');
export const LEGACY_ARTIFACT_TYPES = (Object.keys(ARTIFACT_KIND_META) as ArtifactType[]).filter((kind) => ARTIFACT_KIND_META[kind].legacy);
export const LEGACY_EXECUTION_PROFILES = (Object.keys(EXECUTION_PROFILE_META) as ExecutionProfile[]).filter((profile) => EXECUTION_PROFILE_META[profile].legacy);

export const BLOCK_FAMILY_LABELS: Record<BlockFamily, string> = {
  native: 'Native',
  structured: 'Structured',
  embedded: 'Embedded',
  code: 'Code',
};

export const BLOCK_FAMILY_BADGE_CLASSES: Record<BlockFamily, string> = {
  native: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  structured: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  embedded: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
  code: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
};

export const DEFAULT_NODE_RUNTIME_META: NodeRuntimeMeta = {
  kind: matrix.nodeDefaults.kind as BuilderArtifactKind,
  origin: matrix.nodeDefaults.origin as RuntimeOrigin,
  executionPlacement: matrix.nodeDefaults.executionPlacement as ExecutionPlacement,
  executionFlavor: matrix.nodeDefaults.executionFlavor as ExecutionFlavor,
  compileStrategy: matrix.nodeDefaults.compileStrategy as CompileStrategy,
  quickProps: [...matrix.nodeDefaults.quickProps],
  autoLinkTargets: [...matrix.nodeDefaults.autoLinkTargets],
  naturalArtifactTypes: [...matrix.nodeDefaults.naturalArtifactTypes] as ArtifactType[],
  naturalProfiles: [...matrix.nodeDefaults.naturalProfiles] as ExecutionProfile[],
  allowedEditorContexts: [...matrix.nodeDefaults.allowedEditorContexts] as GraphScopeKind[],
  futureHook: Boolean(matrix.nodeDefaults.futureHook),
  internalOnly: Boolean(matrix.nodeDefaults.internalOnly),
  rail: matrix.nodeDefaults.rail as RailId,
  surfaceLevel: matrix.nodeDefaults.surfaceLevel as SurfaceLevel,
  advancedVisible: Boolean(matrix.nodeDefaults.advancedVisible),
  trunkDependent: Boolean(matrix.nodeDefaults.trunkDependent),
  adapterBacked: Boolean(matrix.nodeDefaults.adapterBacked),
  wrapperBacked: Boolean(matrix.nodeDefaults.wrapperBacked),
  directCompile: Boolean(matrix.nodeDefaults.directCompile),
  directRun: Boolean(matrix.nodeDefaults.directRun),
  allowedProjectModes: [...matrix.nodeDefaults.allowedProjectModes] as ProjectMode[],
};

const RUNTIME_BACKED_NODE_TYPES = new Set<string>(matrix.runtimeBackedNodeTypes);
const PALETTE_HIDDEN_NODE_TYPES = new Set<string>(matrix.paletteHiddenNodeTypes);
const NODE_RUNTIME_OVERRIDES = matrix.nodeTypes as Record<string, Partial<NodeRuntimeMeta>>;

export function inferNodeBlockFamily(nodeType: string, meta?: NodeRuntimeMeta): BlockFamily {
  const resolved = meta || getNodeRuntimeMetaMatrix(nodeType);
  if (resolved.blockFamilyHint) return resolved.blockFamilyHint;
  if (nodeType === 'python_executor_node' || nodeType === 'tool_python_repl' || nodeType === 'tool_python_function') return 'code';
  if (resolved.wrapperBacked || resolved.executionPlacement === 'subgraph' || resolved.executionPlacement === 'suite') return 'embedded';
  if (resolved.executionPlacement === 'tool' || nodeType.startsWith('tool_')) return 'structured';
  return 'native';
}

export function getArtifactKindMeta(kind: ArtifactType): ArtifactKindMeta {
  return ARTIFACT_KIND_META[kind];
}

export function getExecutionProfileMeta(profile: ExecutionProfile): ExecutionProfileMeta {
  return EXECUTION_PROFILE_META[profile];
}

export function isArtifactType(value: unknown): value is ArtifactType {
  return typeof value === 'string' && value in ARTIFACT_KIND_META;
}

export function isExecutionProfile(value: unknown): value is ExecutionProfile {
  return typeof value === 'string' && value in EXECUTION_PROFILE_META;
}

export function isLegacyArtifactType(value: unknown): value is ArtifactType {
  return typeof value === 'string' && (LEGACY_ARTIFACT_TYPES as string[]).includes(value);
}

export function isLegacyExecutionProfile(value: unknown): value is ExecutionProfile {
  return typeof value === 'string' && (LEGACY_EXECUTION_PROFILES as string[]).includes(value);
}

export function isVisibleArtifactType(value: unknown): value is ArtifactType {
  return typeof value === 'string' && (VISIBLE_ARTIFACT_TYPES as string[]).includes(value);
}

export function isVisibleExecutionProfile(value: unknown): value is ExecutionProfile {
  return typeof value === 'string' && (VISIBLE_EXECUTION_PROFILES as string[]).includes(value);
}

export function getDefaultExecutionProfileForArtifact(kind: ArtifactType): ExecutionProfile {
  return getArtifactKindMeta(kind).defaultExecutionProfile;
}

export function normalizeVisibleArtifactType(value: unknown, scopeKind: GraphScopeKind): ArtifactType {
  if (scopeKind === 'subgraph') return 'subgraph';
  return value === 'subgraph' ? 'subgraph' : 'graph';
}

export function normalizeVisibleExecutionProfile(value: unknown, isAsync: boolean): ExecutionProfile {
  if (value === 'langgraph_sync' || value === 'langgraph_async') return value;
  return isAsync ? 'langgraph_async' : 'langgraph_sync';
}

export function normalizeWorkspaceArtifactType(value: unknown, scopeKind: GraphScopeKind): ArtifactType {
  if (scopeKind === 'subgraph') return 'subgraph';
  if (isArtifactType(value)) return value;
  return 'graph';
}

export function normalizeWorkspaceExecutionProfile(value: unknown, isAsync: boolean, scopeKind: GraphScopeKind, artifactType: ArtifactType = 'graph'): ExecutionProfile {
  if (scopeKind === 'subgraph') {
    return normalizeVisibleExecutionProfile(value, isAsync);
  }
  if (isExecutionProfile(value)) return value;
  return getDefaultExecutionProfileForArtifact(artifactType);
}

export function getArtifactKindsForLibrarySurface(surface: 'default' | 'advanced' | 'internal' = 'default'): ArtifactType[] {
  if (surface === 'internal') return Object.keys(ARTIFACT_KIND_META) as ArtifactType[];
  if (surface === 'advanced') {
    return [...VISIBLE_LIBRARY_ARTIFACT_TYPES, ...ADVANCED_LIBRARY_ARTIFACT_TYPES.filter((kind) => !VISIBLE_LIBRARY_ARTIFACT_TYPES.includes(kind))];
  }
  return [...VISIBLE_LIBRARY_ARTIFACT_TYPES];
}

export function getArtifactOptionsForEditor(scopeKind: GraphScopeKind, mode: 'simple' | 'advanced'): ArtifactType[] {
  if (scopeKind === 'subgraph') return ['subgraph'];
  return mode === 'advanced'
    ? ['graph', ...ADVANCED_ARTIFACT_TYPES.filter((kind) => kind !== 'subgraph' && kind !== 'graph')]
    : ['graph'];
}

export function getExecutionProfileOptionsForEditor(mode: 'simple' | 'advanced'): ExecutionProfile[] {
  return mode === 'advanced'
    ? [...VISIBLE_EXECUTION_PROFILES, ...ADVANCED_EXECUTION_PROFILES.filter((profile) => !VISIBLE_EXECUTION_PROFILES.includes(profile))]
    : [...VISIBLE_EXECUTION_PROFILES];
}

export function getNodeRuntimeMetaMatrix(nodeType: string): NodeRuntimeMeta {
  const raw = NODE_RUNTIME_OVERRIDES[nodeType] || {};
  return {
    ...DEFAULT_NODE_RUNTIME_META,
    ...raw,
    quickProps: [...(raw.quickProps || DEFAULT_NODE_RUNTIME_META.quickProps || [])],
    autoLinkTargets: [...(raw.autoLinkTargets || DEFAULT_NODE_RUNTIME_META.autoLinkTargets || [])],
    naturalArtifactTypes: [...(raw.naturalArtifactTypes || DEFAULT_NODE_RUNTIME_META.naturalArtifactTypes || [])] as ArtifactType[],
    naturalProfiles: [...(raw.naturalProfiles || DEFAULT_NODE_RUNTIME_META.naturalProfiles || [])] as ExecutionProfile[],
    allowedEditorContexts: [...(raw.allowedEditorContexts || DEFAULT_NODE_RUNTIME_META.allowedEditorContexts || [])] as GraphScopeKind[],
    allowedProjectModes: [...(raw.allowedProjectModes || DEFAULT_NODE_RUNTIME_META.allowedProjectModes || [])] as ProjectMode[],
    linkSemantics: [...(raw.linkSemantics || [])],
    uiAbstractionNotes: [...(raw.uiAbstractionNotes || [])],
    linkMultiplicity: [...(raw.linkMultiplicity || [])],
    uiSemanticHandles: [...(raw.uiSemanticHandles || [])],
    debugProjection: [...(raw.debugProjection || [])],
  };
}

export function isRuntimeBackedNodeType(nodeType: string): boolean {
  return RUNTIME_BACKED_NODE_TYPES.has(nodeType);
}

export function isPaletteHiddenNodeType(nodeType: string): boolean {
  const meta = NODE_RUNTIME_OVERRIDES[nodeType];
  return Boolean(meta?.paletteHidden) || PALETTE_HIDDEN_NODE_TYPES.has(nodeType);
}

export function getProjectModeMeta(mode: ProjectMode): ProjectModeMeta {
  return PROJECT_MODE_META[mode];
}

export function isProjectMode(value: unknown): value is ProjectMode {
  return typeof value === 'string' && value in PROJECT_MODE_META;
}

export function inferProjectModeFromSurface(artifactType?: ArtifactType | null, executionProfile?: ExecutionProfile | null): ProjectMode {
  if (artifactType === 'deep_agent' || executionProfile === 'deepagents') return 'deepagents';
  if (artifactType === 'agent' || executionProfile === 'langchain_agent') return 'langchain';
  return 'langgraph';
}

export function normalizeProjectMode(value: unknown, artifactType?: ArtifactType | null, executionProfile?: ExecutionProfile | null): ProjectMode {
  if (isProjectMode(value)) return value;
  return inferProjectModeFromSurface(artifactType || null, executionProfile || null);
}

export function getDefaultSurfaceForProjectMode(mode: ProjectMode): { artifactType: ArtifactType; executionProfile: ExecutionProfile; isAsync: boolean; defaultStreamMode: 'updates' | 'values' | 'debug' } {
  const meta = getProjectModeMeta(mode);
  return {
    artifactType: meta.defaultArtifactType,
    executionProfile: meta.defaultExecutionProfile,
    isAsync: meta.defaultAsync,
    defaultStreamMode: meta.defaultStreamMode,
  };
}

export function projectModeAllowsRuntime(mode: ProjectMode): boolean {
  return Boolean(getProjectModeMeta(mode).runtimeEnabled);
}

export function projectModeAllowsCompile(mode: ProjectMode): boolean {
  return Boolean(getProjectModeMeta(mode).compileEnabled);
}

export function getModeContract(mode: ProjectMode): ModeContractMeta {
  return MODE_CONTRACT_META[mode];
}

export function getAllowedArtifactKindsForMode(mode: ProjectMode, includeAdvanced = false): ArtifactType[] {
  const contract = getModeContract(mode);
  const kinds = [...contract.defaultLibraryKinds] as ArtifactType[];
  if (includeAdvanced) {
    for (const kind of contract.advancedLibraryKinds) {
      if (!kinds.includes(kind)) kinds.push(kind);
    }
    for (const bridge of getInteroperabilityBridgesForTargetMode(mode)) {
      for (const kind of bridge.sourceArtifactKinds) {
        if (!kinds.includes(kind)) kinds.push(kind);
      }
    }
  }
  return kinds;
}

export function getAllowedExecutionProfilesForMode(mode: ProjectMode): ExecutionProfile[] {
  return [...getModeContract(mode).allowedExecutionProfiles] as ExecutionProfile[];
}

export function getInteroperabilityBridgesForTargetMode(mode: ProjectMode): InteroperabilityBridgeMeta[] {
  return INTEROPERABILITY_BRIDGES.filter((bridge) => bridge.targetMode === mode);
}

export function getInteroperabilityBridges(sourceMode: ProjectMode, targetMode: ProjectMode, sourceArtifactKind: ArtifactType): InteroperabilityBridgeMeta[] {
  return INTEROPERABILITY_BRIDGES.filter((bridge) => bridge.sourceMode === sourceMode && bridge.targetMode === targetMode && bridge.sourceArtifactKinds.includes(sourceArtifactKind));
}

export function getInteroperabilityBridge(sourceMode: ProjectMode, targetMode: ProjectMode, sourceArtifactKind: ArtifactType, integrationModel?: BridgeIntegrationModel): InteroperabilityBridgeMeta | null {
  const candidates = getInteroperabilityBridges(sourceMode, targetMode, sourceArtifactKind);
  if (integrationModel) {
    return candidates.find((bridge) => bridge.integrationModel === integrationModel) || null;
  }
  return candidates[0] || null;
}

export function artifactTypeBelongsToProjectMode(kind: ArtifactType, mode: ProjectMode): boolean {
  return getModeContract(mode).allowedArtifactKinds.includes(kind);
}

export function executionProfileBelongsToProjectMode(profile: ExecutionProfile, mode: ProjectMode): boolean {
  return getModeContract(mode).allowedExecutionProfiles.includes(profile);
}
