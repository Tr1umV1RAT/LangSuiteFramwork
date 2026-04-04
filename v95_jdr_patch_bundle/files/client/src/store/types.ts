import type { Edge, Node } from '@xyflow/react';
import type { ArtifactType, BlockFamily, ExecutionFlavor, ExecutionPlacement, ExecutionProfile, GraphScopeKind, ProjectMode } from '../capabilities';

export type EditorMode = 'simple' | 'advanced';
export type UiDensity = 'compact' | 'standard' | 'comfortable';
export type RunPanelTab = 'inputs' | 'execution' | 'json';
export type PaletteMode = 'quickstart' | 'common' | 'all';
export type PalettePreset = 'minimal' | 'graph' | 'memory_rag' | 'advanced' | 'debug';
export type WorkspacePreset = 'graph_simple' | 'graph_memory' | 'debug_build' | 'advanced_authoring' | 'tabletop_demo';
export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface Preferences {
  defaultEditorMode: EditorMode;
  autosaveEnabled: boolean;
  confirmBeforeCloseUnsavedWork: boolean;
  showMinimap: boolean;
  snapToGrid: boolean;
  uiDensity: UiDensity;
  showQuickStart: boolean;
  showIncompatibleBlocks: boolean;
  compactPalette: boolean;
  paletteMode: PaletteMode;
  palettePreset: PalettePreset;
  defaultRunPanelTab: RunPanelTab;
  showJsonTab: boolean;
  autoScrollLogs: boolean;
  deEmphasizeJsonInSimpleMode: boolean;
  reducedTechnicalBadgesInSimpleMode: boolean;
  showArtifactBadgesInSimpleMode: boolean;
  showScopePathInSimpleMode: boolean;
  blocksPanelWidth: number;
  debugPanelWidth: number;
  statePanelWidth: number;
  runPanelHeightPercent: number;
}


export interface SubagentDefinition {
  name: string;
  systemPrompt: string;
  tools: string[];
  description?: string;
}

export interface SubagentGroupDefinition {
  name: string;
  agents: SubagentDefinition[];
}

export interface PromptStripVariableDefinition {
  name: string;
  required: boolean;
  defaultValue?: string;
}

export interface PromptStripDefinition {
  id: string;
  name: string;
  description?: string;
  body: string;
  tags: string[];
  variables: PromptStripVariableDefinition[];
  origin: 'workspace' | 'artifact';
  artifactRef?: string | null;
}

export type PromptAssignmentTarget =
  | { kind: 'graph'; tabId: string }
  | { kind: 'node'; tabId: string; nodeId: string }
  | { kind: 'subagent'; tabId: string; groupName: string; agentName: string };

export type PromptStripMergeMode = 'prepend' | 'append' | 'replace_if_empty';

export interface PromptStripAssignment {
  id: string;
  stripId: string;
  target: PromptAssignmentTarget;
  mergeMode: PromptStripMergeMode;
  order: number;
  enabled: boolean;
}

export type ModuleLibraryCategory = 'world' | 'rules' | 'persona' | 'party' | 'utility' | 'mixed';
export type ModuleLibraryLineage = 'shared' | 'branch_overlay';

export interface ModulePromptAssignmentPreset {
  id: string;
  stripId: string;
  targetKind: 'graph' | 'subagent';
  groupName?: string;
  agentName?: string;
  mergeMode: PromptStripMergeMode;
  order: number;
  enabled: boolean;
}

export interface ModuleStarterArtifactRef {
  artifactId: string;
  artifactKind: string;
  label?: string;
  description?: string;
}

export interface ModuleLibraryEntry {
  id: string;
  name: string;
  description?: string;
  category: ModuleLibraryCategory;
  tags: string[];
  lineage: ModuleLibraryLineage;
  branchTargets: string[];
  recommendedProfile?: string;
  themeHints: string[];
  compatibilityNotes?: string;
  origin: 'workspace' | 'artifact';
  artifactRef?: string | null;
  promptStrips: PromptStripDefinition[];
  promptAssignments: ModulePromptAssignmentPreset[];
  subagentGroups: SubagentGroupDefinition[];
  starterArtifacts: ModuleStarterArtifactRef[];
  runtimeContext: { key: string; value: string }[];
}

export interface RuntimeSettings {
  recursionLimit: number;
  streamMode: 'updates' | 'values' | 'debug';
  debug: boolean;
  inheritParentBindings: boolean;
  storeBackend: 'in_memory' | 'sqlite_local';
  storePath: string;
  checkpointEnabled: boolean;
  subagentLibrary: SubagentGroupDefinition[];
  promptStripLibrary: PromptStripDefinition[];
  promptStripAssignments: PromptStripAssignment[];
  moduleLibrary: ModuleLibraryEntry[];
  loadedModuleIds: string[];
  runtimeContext: { key: string; value: string }[];
  shellExecutionEnabled: boolean;
}

export interface GraphValidationIssue {
  severity: ValidationSeverity;
  message: string;
  code?: string;
  nodeId?: string;
}

export interface GraphValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  infos: string[];
  issues: GraphValidationIssue[];
  componentCount: number;
  orphanNodeIds: Set<string>;
  secondaryNodeIds: Set<string>;
  detachedNodeIds: Set<string>;
  detachedComponentCount: number;
  semanticEdgeSummary: Record<string, number>;
  graphScopeMarkerIds: Set<string>;
}

export interface GraphBinding {
  name: string;
  value: string;
  kind: 'variable' | 'constant';
}

export interface RunLogEntry {
  id: string;
  timestamp: number;
  type: 'node_update' | 'paused' | 'completed' | 'error' | 'started' | 'stopped' | 'embedded_trace';
  node?: string;
  data?: unknown;
  message?: string;
  scopePath?: string | null;
  scopeLineage?: string[];
  artifactType?: string | null;
  executionProfile?: string | null;
  nodeType?: string | null;
  blockFamily?: BlockFamily | null;
  executionPlacement?: ExecutionPlacement | null;
  executionFlavor?: ExecutionFlavor | null;
  integrationModel?: string | null;
  reasonCode?: string | null;
  fanoutSourceNode?: string | null;
  fanoutIndex?: number | null;
  fanoutItemsKey?: string | null;
  memorySystem?: string | null;
  memoryOperation?: string | null;
  memoryAccessModel?: string | null;
  storeBackend?: string | null;
  toolkit?: string | null;
  operation?: string | null;
  executionStatus?: string | null;
  operationSummary?: string | null;
  runtimeSchemaVersion?: string | null;
  runtimeKind?: string | null;
  truthSource?: 'runtime_event' | 'legacy';
}


export interface RuntimeFocusRequest {
  nodeId: string;
  nonce: number;
  source: 'timeline' | 'run_log' | 'debug' | 'state' | 'graph';
}

export interface RuntimeHoverTarget {
  nodeId: string;
  source: 'timeline' | 'run_log' | 'debug' | 'state' | 'graph';
}

export interface RuntimeEdgeLegendSettings {
  showTraversed: boolean;
  showScheduled: boolean;
  showMuted: boolean;
}

export interface RuntimeNavigationSettings {
  followActiveNode: boolean;
  lockHover: boolean;
  autoScrollMatchingLogs: boolean;
}


export interface Tab {
  id: string;
  projectId: string | null;
  projectName: string;
  nodes: Node[];
  edges: Edge[];
  isDirty: boolean;
  parentProjectId?: string | null;
  parentTabId?: string | null;
  parentNodeId?: string | null;
  customStateSchema: { name: string; type: string; reducer: string }[];
  graphBindings: GraphBinding[];
  isAsync: boolean;
  scopeKind: GraphScopeKind;
  scopePath: string;
  artifactType: ArtifactType;
  executionProfile: ExecutionProfile;
  projectMode: ProjectMode;
  runtimeSettings: RuntimeSettings;
}

export interface CapabilityInspectorTarget {
  source: 'node' | 'catalog';
  nodeType: string;
  nodeId?: string | null;
}

export interface SerializedWorkspaceTab {
  projectId: string | null;
  projectName: string;
  nodes: Node[];
  edges: Edge[];
  parentProjectId?: string | null;
  parentNodeId?: string | null;
  customStateSchema: { name: string; type: string; reducer: string }[];
  graphBindings: GraphBinding[];
  isAsync: boolean;
  scopeKind: GraphScopeKind;
  scopePath: string;
  artifactType: ArtifactType;
  executionProfile: ExecutionProfile;
  projectMode: ProjectMode;
  runtimeSettings: RuntimeSettings;
}

export interface WorkspaceTreeSnapshot {
  version: 'langsuite.v21.workspace';
  root: SerializedWorkspaceTab;
  children: SerializedWorkspaceTab[];
  activeScopeKey: string | null;
  openChildScopeKeys: string[];
}

export interface ProjectPackageSnapshot {
  kind: 'project_package';
  version: 'langsuite.v23.package';
  packageType: 'editable_workspace';
  exportedAt: string;
  projectName: string;
  surfaceTruth?: SurfaceTruthSummary;
  summary: {
    childSubgraphCount: number;
    includes: string[];
    excludes: string[];
    layoutMetadataIncluded: boolean;
  };
  workspaceTree: WorkspaceTreeSnapshot;
}

export interface SurfaceTruthSummary {
  artifactType: string | null;
  executionProfile: string | null;
  projectMode: string | null;
  compileSafe: boolean;
  runtimeEnabled: boolean;
  editorOnly: boolean;
  summary: string;
}

export interface ImportDiagnostic {
  status: 'success' | 'warning' | 'error';
  format: 'v23_package' | 'workspace_tree_fallback' | 'single_graph_fallback' | 'invalid';
  title: string;
  message: string;
  accepted: string[];
  missing: string[];
  fallbackUsed: boolean;
  partialRecovery: boolean;
  surfaceTruth?: SurfaceTruthSummary | null;
  packageIncludes?: string[];
  packageExcludes?: string[];
}
