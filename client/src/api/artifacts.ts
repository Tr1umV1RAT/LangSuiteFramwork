import type { ArtifactType, BridgeIntegrationModel, ExecutionProfile, PackagingEligibility, ProjectMode, RailId, SurfaceLevel } from '../capabilities';

export type ArtifactKind = ArtifactType;

export interface ArtifactBridgeModelSummary {
  id: string;
  integrationModel?: BridgeIntegrationModel | null;
  executionKind?: BridgeIntegrationModel | null;
  supportLevel?: 'direct' | 'compile_capable' | 'editor_package_only' | null;
  status?: 'supported' | 'partial' | 'unsupported' | null;
  summary?: string | null;
  bridgeContractIds?: string[] | null;
  bridgeConstraints?: string[] | null;
  bridgeAllowedToolFamilies?: string[] | null;
  bridgeAcceptedSourceShape?: string | null;
  bridgeRejectedReasonCodes?: string[] | null;
  bridgeConstraintSummary?: Record<string, unknown> | null;
  bridgeIntegrationModel?: BridgeIntegrationModel | null;
  bridgeExecutionKind?: BridgeIntegrationModel | null;
  bridgeModels?: ArtifactBridgeModelSummary[] | null;
}

export interface ArtifactManifestSummary {
  id: string;
  kind: ArtifactKind;
  title: string;
  description: string;
  built_in: boolean;
  executionProfile: string | null;
  artifactType: string | null;
  path: string;
  rail?: RailId;
  surfaceLevel?: SurfaceLevel;
  packagingEligibility?: PackagingEligibility;
  trunkDependent?: boolean;
  adapterBacked?: boolean;
  compileSafe?: boolean;
  runtimeEnabled?: boolean;
  editorOnly?: boolean;
  surfaceSummary?: string;
  surfaceTruth?: {
    artifactType: string | null;
    executionProfile: string | null;
    projectMode: string | null;
    compileSafe: boolean;
    runtimeEnabled: boolean;
    editorOnly: boolean;
    summary: string;
  } | null;
  openEffectSummary?: string | null;
  saveEffectSummary?: string | null;
  projectMode?: ProjectMode | null;
  bridgeTargetMode?: ProjectMode | null;
  bridgeStatus?: 'supported' | 'partial' | 'unsupported' | null;
  bridgeSupportLevel?: 'direct' | 'compile_capable' | 'editor_package_only' | null;
  bridgeWrapperNodeType?: string | null;
  bridgeSummary?: string | null;
  bridgeContractIds?: string[] | null;
  bridgeConstraints?: string[] | null;
  bridgeAllowedToolFamilies?: string[] | null;
  bridgeAcceptedSourceShape?: string | null;
  bridgeRejectedReasonCodes?: string[] | null;
  bridgeConstraintSummary?: Record<string, unknown> | null;
  bridgeIntegrationModel?: BridgeIntegrationModel | null;
  bridgeExecutionKind?: BridgeIntegrationModel | null;
  bridgeModels?: ArtifactBridgeModelSummary[] | null;
}

export interface ArtifactManifest {
  id: string;
  kind: ArtifactKind;
  title: string;
  description: string;
  built_in: boolean;
  surfaceTruth?: {
    artifactType: string | null;
    executionProfile: string | null;
    projectMode: string | null;
    compileSafe: boolean;
    runtimeEnabled: boolean;
    editorOnly: boolean;
    summary: string;
  } | null;
  openEffectSummary?: string | null;
  saveEffectSummary?: string | null;
  artifact: {
    name: string;
    nodes: unknown[];
    edges: unknown[];
    customStateSchema?: { name: string; type: string; reducer: string }[];
    graphBindings?: { name: string; value: string; kind: 'variable' | 'constant' }[];
    isAsync?: boolean;
    artifactType?: ArtifactKind;
    executionProfile?: ExecutionProfile;
    runtimeSettings?: Record<string, unknown> | { recursionLimit: number; streamMode: string; debug: boolean; inheritParentBindings: boolean; storeBackend: string; storePath: string };
    projectMode?: ProjectMode;
  };
}

const API_BASE = '/api/artifacts';

export async function fetchArtifactLibrary(kind?: ArtifactKind, options: { includeAdvanced?: boolean; projectMode?: ProjectMode } = {}): Promise<ArtifactManifestSummary[]> {
  const params = new URLSearchParams();
  if (kind) params.set('kind', kind);
  if (options.includeAdvanced) params.set('include_advanced', 'true');
  if (options.projectMode) params.set('project_mode', options.projectMode);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}${suffix}`);
  if (!res.ok) throw new Error('Failed to fetch artifact library');
  return res.json();
}

export async function fetchArtifactManifest(kind: ArtifactKind, id: string): Promise<ArtifactManifest> {
  const res = await fetch(`${API_BASE}/${kind}/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Artifact not found');
  return res.json();
}

export async function saveArtifactManifest(body: {
  id?: string;
  kind: ArtifactKind;
  title: string;
  description?: string;
  artifact: ArtifactManifest['artifact'];
}): Promise<ArtifactManifest> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to save artifact manifest');
  return res.json();
}
