import { useEffect, useMemo, useState } from 'react';
import { Boxes, Sparkles, FolderPlus, Bot, BrainCircuit, GitBranch, RefreshCw, WrapText, ShieldCheck, Beaker, Waypoints } from 'lucide-react';
import { useAppStore, type RuntimeSettings } from '../../store';
import { fetchArtifactLibrary, fetchArtifactManifest, type ArtifactManifestSummary, type ArtifactKind } from '../../api/artifacts';
import { hydrateArtifactEditorGraph } from '../../store/artifactHydration';
import {
  type ArtifactType,
  type ExecutionProfile,
  type ProjectMode,
  type SurfaceLevel,
  ARTIFACT_KIND_META,
  getAllowedArtifactKindsForMode,
} from '../../capabilities';
import { RAIL_BADGE_CLASSES, RAIL_LABELS, SURFACE_BADGE_CLASSES, SURFACE_LABELS } from '../../catalog';

const KIND_META: Record<ArtifactType, { label: string; icon: typeof GitBranch; accent: string; defaultProfile: ExecutionProfile; defaultAsync: boolean }> = {
  graph: { label: ARTIFACT_KIND_META.graph.label, icon: GitBranch, accent: 'text-slate-300 bg-slate-500/10 border-slate-500/20', defaultProfile: ARTIFACT_KIND_META.graph.defaultExecutionProfile, defaultAsync: ARTIFACT_KIND_META.graph.defaultAsync },
  subgraph: { label: ARTIFACT_KIND_META.subgraph.label, icon: Boxes, accent: 'text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/20', defaultProfile: ARTIFACT_KIND_META.subgraph.defaultExecutionProfile, defaultAsync: ARTIFACT_KIND_META.subgraph.defaultAsync },
  agent: { label: ARTIFACT_KIND_META.agent.label, icon: Bot, accent: 'text-sky-300 bg-sky-500/10 border-sky-500/20', defaultProfile: ARTIFACT_KIND_META.agent.defaultExecutionProfile, defaultAsync: ARTIFACT_KIND_META.agent.defaultAsync },
  deep_agent: { label: ARTIFACT_KIND_META.deep_agent.label, icon: BrainCircuit, accent: 'text-violet-300 bg-violet-500/10 border-violet-500/20', defaultProfile: ARTIFACT_KIND_META.deep_agent.defaultExecutionProfile, defaultAsync: ARTIFACT_KIND_META.deep_agent.defaultAsync },
};

function SurfacePill({ level }: { level: SurfaceLevel }) {
  const Icon = level === 'stable' ? ShieldCheck : Beaker;
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide border inline-flex items-center gap-1 ${SURFACE_BADGE_CLASSES[level]}`}>
      <Icon size={10} />
      {SURFACE_LABELS[level]}
    </span>
  );
}


function formatBridgeSupportLevel(level?: string | null): string | null {
  if (!level) return null;
  if (level === 'compile_capable') return 'compile-capable';
  if (level === 'editor_package_only') return 'editor/package-only';
  return level;
}


function formatIntegrationModel(model?: string | null): string {
  if (model === 'embedded_native') return 'embedded native';
  if (model === 'lowered_bridge') return 'lowered bridge';
  if (model === 'direct_reference') return 'direct reference';
  return model || 'bridge';
}

function EmptyArtifactButton({ kind, projectMode }: { kind: ArtifactType; projectMode: ProjectMode }) {
  const openTab = useAppStore((s) => s.openTab);
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  return (
    <button
      onClick={() => openTab(null, `New ${meta.label}`, [], [], [], meta.defaultAsync, {
        artifactType: kind,
        scopeKind: kind === 'subgraph' ? 'subgraph' : 'project',
        executionProfile: meta.defaultProfile,
        projectMode,
      })}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[11px] ${meta.accent} hover:bg-white/5 transition-all`}
    >
      <FolderPlus size={12} />
      <Icon size={12} />
      <span>New {meta.label}</span>
    </button>
  );
}

export default function ArtifactLibrarySection() {
  const editorMode = useAppStore((s) => s.editorMode);
  const openTab = useAppStore((s) => s.openTab);
  const addArtifactWrapperNode = useAppStore((s) => s.addArtifactWrapperNode);
  const activeArtifactType = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.artifactType || 'graph');
  const activeProjectMode = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.projectMode || 'langgraph');
  const includeAdvanced = editorMode === 'advanced';
  const [items, setItems] = useState<ArtifactManifestSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const manifests = await fetchArtifactLibrary(undefined, { includeAdvanced, projectMode: activeProjectMode });
      setItems(manifests);
    } catch (err) {
      console.error('Failed to load artifact library', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [includeAdvanced, activeProjectMode]);

  const grouped = useMemo(() => {
    const allowedKinds = getAllowedArtifactKindsForMode(activeProjectMode, includeAdvanced);
    const filtered = items.filter((item) => {
      const hay = `${item.title} ${item.description} ${item.kind}`.toLowerCase();
      return hay.includes(query.toLowerCase()) && allowedKinds.includes(item.kind as ArtifactType);
    });
    const orderedKinds: ArtifactType[] = [activeArtifactType as ArtifactType, ...allowedKinds].filter((value, index, arr) => arr.indexOf(value) === index && allowedKinds.includes(value as ArtifactType)) as ArtifactType[];
    return orderedKinds.map((kind) => ({ kind, items: filtered.filter((item) => item.kind === kind) })).filter((group) => group.items.length > 0);
  }, [items, query, activeArtifactType, includeAdvanced, activeProjectMode]);

  const openArtifact = async (kind: ArtifactKind, id: string) => {
    try {
      const manifest = await fetchArtifactManifest(kind, id);
      const artifact = manifest.artifact;
      const hydrated = hydrateArtifactEditorGraph(artifact);
      openTab(null, artifact.name || manifest.title, (hydrated.nodes as never[]) || [], (hydrated.edges as never[]) || [], artifact.customStateSchema || [], artifact.isAsync ?? true, {
        graphBindings: artifact.graphBindings || [],
        artifactType: (artifact.artifactType || manifest.kind) as ArtifactType,
        executionProfile: (artifact.executionProfile || KIND_META[(artifact.artifactType || manifest.kind) as ArtifactType]?.defaultProfile || 'langgraph_async') as ExecutionProfile,
        runtimeSettings: (artifact.runtimeSettings || {}) as Partial<RuntimeSettings>,
        projectMode: (artifact.projectMode || activeProjectMode) as ProjectMode,
        scopeKind: (artifact.artifactType || manifest.kind) === 'subgraph' ? 'subgraph' : 'project',
      });
    } catch (err) {
      console.error('Failed to open artifact manifest', err);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-3 py-2 border-b border-panel-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Artifacts & starters</span>
        </div>
        <button onClick={() => void load()} className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-panel-hover transition-all" title="Refresh">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="px-3 space-y-2">
        <div className="rounded-lg border border-panel-border bg-black/20 p-2 text-[11px] leading-5 text-slate-400">
          {activeProjectMode === 'langchain'
            ? 'LangChain mode is editor-first: author, save, and export/package bounded agent artifacts here. In-app runtime stays disabled.'
            : includeAdvanced
              ? 'Advanced mode adds bounded rail starters and bridgeable artifacts. They remain trunk-dependent unless a bridge or contract explicitly proves more.'
              : 'Default mode keeps the library on the proven mode surface.'}
        </div>
        {includeAdvanced && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-2 text-[10px] leading-5 text-amber-100" data-testid="artifact-library-advanced-note">
            Advanced library view is for bounded starters, wrappers, and bridgeable artifacts. It does not imply peer native runtime parity with the LangGraph trunk.
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <EmptyArtifactButton kind="graph" projectMode={activeProjectMode} />
          <EmptyArtifactButton kind="subgraph" projectMode={activeProjectMode} />
          {includeAdvanced && (
            <>
              <EmptyArtifactButton kind="agent" projectMode="langchain" />
              <EmptyArtifactButton kind="deep_agent" projectMode="deepagents" />
            </>
          )}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter the library..."
          className="w-full bg-black/20 border border-panel-border rounded px-2 py-1.5 text-[11px] text-white placeholder:text-slate-600 outline-none focus:border-blue-500"
        />
      </div>

      <div className="px-3 pb-3 space-y-3 overflow-auto max-h-[340px] scrollbar-thin">
        {grouped.map((group) => {
          const meta = KIND_META[group.kind];
          const Icon = meta.icon;
          return (
            <div key={group.kind} className="space-y-2">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-500 px-1">
                <Icon size={11} />
                <span>{meta.label}</span>
              </div>
              <div className="space-y-2">
                {group.items.map((item) => {
                  const surfaceLevel = (item.surfaceLevel || 'stable') as SurfaceLevel;
                  const bridgeModels = Array.isArray(item.bridgeModels) && item.bridgeModels.length > 0
                    ? item.bridgeModels
                    : item.bridgeStatus
                      ? [{
                          id: `${item.kind}:${item.id}:primary`,
                          integrationModel: item.bridgeIntegrationModel || item.bridgeExecutionKind || 'lowered_bridge',
                          supportLevel: item.bridgeSupportLevel || null,
                          summary: item.bridgeSummary || null,
                          bridgeContractIds: item.bridgeContractIds || [],
                          bridgeAllowedToolFamilies: item.bridgeAllowedToolFamilies || [],
                          bridgeAcceptedSourceShape: item.bridgeAcceptedSourceShape || null,
                          bridgeRejectedReasonCodes: item.bridgeRejectedReasonCodes || [],
                        }]
                      : [];
                  const embeddedBridge = bridgeModels.find((bridge) => bridge.integrationModel === 'embedded_native' && bridge.supportLevel === 'compile_capable');
                  const loweredBridge = bridgeModels.find((bridge) => bridge.integrationModel === 'lowered_bridge' && bridge.supportLevel === 'compile_capable');
                  return (
                    <div
                      key={`${item.kind}:${item.id}`}
                      className="w-full text-left p-2.5 rounded-lg border border-panel-border bg-panel-hover/20 hover:bg-panel-hover/40 transition-all"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide border ${meta.accent}`}>{item.kind}</span>
                        <SurfacePill level={surfaceLevel} />
                        {item.rail && <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide border inline-flex items-center gap-1 ${RAIL_BADGE_CLASSES[item.rail]}`}><Waypoints size={10} />{RAIL_LABELS[item.rail]}</span>}
                        {item.built_in && <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">starter</span>}
                        {typeof item.compileSafe === 'boolean' && <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide border ${item.compileSafe ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-red-500/10 text-red-300 border-red-500/20'}`}>{item.compileSafe ? 'compile-safe' : 'not compile-safe'}</span>}
                        {typeof item.editorOnly === 'boolean' && <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide border ${item.editorOnly ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'}`}>{item.editorOnly ? 'editor-first' : 'runtime-enabled'}</span>}
                        {item.bridgeStatus && <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide bg-amber-500/10 text-amber-300 border border-amber-500/20">bridge {item.bridgeStatus}</span>}
                      </div>
                      <div className="mt-1 text-sm text-slate-200 font-medium">{item.title}</div>
                      <div className="mt-1 text-[11px] text-slate-500 line-clamp-2">{item.description || 'No description'}</div>
                      {item.surfaceSummary && <div className="mt-1 text-[10px] leading-5 text-slate-400">{item.surfaceSummary}</div>}
                      {item.openEffectSummary && <div className="mt-1 text-[10px] leading-5 text-slate-500" data-testid="artifact-open-effect-summary">{item.openEffectSummary}</div>}
                      {item.built_in && item.compileSafe && item.kind === 'graph' && (
                        <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1.5 text-[10px] leading-5 text-emerald-100">
                          Good first success path: open, compile, then run without needing a provider-backed node.
                        </div>
                      )}
                      {bridgeModels.map((bridge) => (
                        <div key={bridge.id || `${item.kind}:${item.id}:${bridge.integrationModel || 'bridge'}`} className="mt-2 rounded-lg border border-panel-border/70 bg-black/10 p-2 text-[10px] text-slate-400 leading-5">
                          <div className="text-slate-200">{formatIntegrationModel(bridge.integrationModel)} · {formatBridgeSupportLevel(bridge.supportLevel) || 'bounded'}</div>
                          {bridge.summary && <div className="mt-1 text-amber-200/80">{bridge.summary}</div>}
                          {Array.isArray(bridge.bridgeAllowedToolFamilies) && bridge.bridgeAllowedToolFamilies.length > 0 && (
                            <div className="mt-1 text-cyan-200/80">Allowed shared tools: {bridge.bridgeAllowedToolFamilies.join(', ')}</div>
                          )}
                          {typeof bridge.bridgeAcceptedSourceShape === 'string' && bridge.bridgeAcceptedSourceShape && (
                            <div className="mt-1 text-slate-400">Accepted shape: {bridge.bridgeAcceptedSourceShape}</div>
                          )}
                          {Array.isArray(bridge.bridgeRejectedReasonCodes) && bridge.bridgeRejectedReasonCodes.length > 0 && (
                            <div className="mt-1 text-slate-500">Rejects: {bridge.bridgeRejectedReasonCodes.slice(0, 4).join(', ')}</div>
                          )}
                        </div>
                      ))}
                      <div className="mt-1 text-[10px] text-slate-500 leading-5">
                        {item.trunkDependent ? 'Trunk-dependent' : 'Standalone'}{item.adapterBacked ? ' · adapter-backed' : ''}{item.packagingEligibility ? ` · packaging ${item.packagingEligibility}` : ''}{item.bridgeSupportLevel ? ` · primary bridge ${formatBridgeSupportLevel(item.bridgeSupportLevel)}` : ''}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          onClick={() => void openArtifact(item.kind, item.id)}
                          className="px-2 py-1 rounded text-[11px] border border-panel-border text-slate-200 hover:bg-white/5 transition-all"
                        >
                          Open editable copy
                        </button>
                        {embeddedBridge && activeProjectMode === 'langgraph' && item.kind === 'agent' && (
                          <button
                            onClick={() => addArtifactWrapperNode(item.kind as ArtifactType, item.id, item.title, 'embedded_native')}
                            className="px-2 py-1 rounded text-[11px] border border-emerald-500/20 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all flex items-center gap-1"
                          >
                            <WrapText size={11} />
                            Insert embedded
                          </button>
                        )}
                        {loweredBridge && (
                          <button
                            onClick={() => addArtifactWrapperNode(item.kind as ArtifactType, item.id, item.title, 'lowered_bridge')}
                            className="px-2 py-1 rounded text-[11px] border border-cyan-500/20 text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 transition-all flex items-center gap-1"
                          >
                            <WrapText size={11} />
                            Insert lowered
                          </button>
                        )}
                        {!embeddedBridge && !loweredBridge && (
                          <button
                            onClick={() => addArtifactWrapperNode(item.kind as ArtifactType, item.id, item.title)}
                            className="px-2 py-1 rounded text-[11px] border border-cyan-500/20 text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 transition-all flex items-center gap-1"
                          >
                            <WrapText size={11} />
                            Insert as wrapper
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {!loading && grouped.length === 0 && (
          <div className="px-2 py-6 text-center text-[11px] text-slate-500">
            No artifact matches this filter.
          </div>
        )}
      </div>
    </div>
  );
}
