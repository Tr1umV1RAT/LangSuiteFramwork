import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { type ImportDiagnostic, useAppStore } from '../store';
import { getModeContract, projectModeAllowsCompile, projectModeAllowsRuntime } from '../capabilities';
import SettingsShell from './SettingsShell';
import { buildProjectPersistenceSummary, buildSurfaceTruthSummary } from '../store/workspace';
import ProjectPersistenceTruthBlock from './ProjectPersistenceTruthBlock';
import SurfaceTruthBadges from './SurfaceTruthBadges';
import {
  Save,
  FolderKanban,
  Download,
  Play,
  Loader2,
  Trash2,
  Users,
  AlertTriangle,
  X,
  Zap,
  Timer,
  Check,
  AlertCircle,
  GitBranch,
  Link,
  Boxes,
  Settings2,
  Package,
  Upload,
  Info,
  MousePointerClick,
  TerminalSquare,
} from 'lucide-react';

function slugifyFilePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'langsuite_project';
}


function buildImportDetailLines(report: ImportDiagnostic): string[] {
  const lines: string[] = [];
  if (report.accepted.length > 0) lines.push(`Recovered: ${report.accepted.join(', ')}`);
  if (report.missing.length > 0) lines.push(`Missing: ${report.missing.join(', ')}`);
  if (report.surfaceTruth) {
    lines.push(`Imported surface: ${report.surfaceTruth.summary}`);
    if (report.surfaceTruth.projectMode) lines.push(`Imported mode: ${report.surfaceTruth.projectMode}`);
    if (report.surfaceTruth.artifactType) lines.push(`Imported artifact type: ${report.surfaceTruth.artifactType}`);
    if (report.surfaceTruth.executionProfile) lines.push(`Imported execution profile: ${report.surfaceTruth.executionProfile}`);
  }
  if (report.packageIncludes && report.packageIncludes.length > 0) lines.push(`Package keeps: ${report.packageIncludes.join(', ')}`);
  if (report.packageExcludes && report.packageExcludes.length > 0) lines.push(`Package excludes: ${report.packageExcludes.join(', ')}`);
  if (report.partialRecovery) lines.push('Partial recovery only.');
  if (report.fallbackUsed) lines.push('Fallback loader used.');
  return lines;
}


type CompileNotice = {
  tone: 'error' | 'warning' | 'info';
  stage: 'before_compile' | 'during_compile' | 'compile_request';
  title: string;
  message: string;
  details: string[];
};

function normalizeCompileDetails(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          if (typeof record.msg === 'string') {
            const code = typeof record.reasonCode === 'string' ? record.reasonCode : null;
            return code ? `[${code}] ${record.msg}` : record.msg;
          }
          if (typeof record.message === 'string') {
            const code = typeof record.reasonCode === 'string' ? record.reasonCode : null;
            return code ? `[${code}] ${record.message}` : record.message;
          }
        }
        return null;
      })
      .filter((item): item is string => Boolean(item));
  }
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.errors)) return normalizeCompileDetails(record.errors);
    if (typeof record.message === 'string') return [record.message];
    if (typeof record.detail === 'string') return [record.detail];
  }
  return [];
}

export default function Toolbar() {
  const projectPersistence = buildProjectPersistenceSummary();

  const {
    projectName,
    setProjectName,
    isAsync,
    setIsAsync,
    saveProject,
    loadProject,
    exportJson,
    exportProjectPackage,
    clearImportReport,
    compiling,
    setCompiling,
    editorMode,
    setEditorMode,
    toggleRunPanel,
    deleteSelected,
    toggleProjectManager,
    toggleCollab,
    sessionId,
    connectedUsers,
    runValidation,
    clearValidation,
    graphValidation,
    saveStatus,
    lastImportReport,
    selectNodesByIds,
    updateRuntimeSettings,
    tabs,
    activeTabId,
  } = useAppStore();

  const packageInputRef = useRef<HTMLInputElement>(null);
  const packageMenuRef = useRef<HTMLDivElement>(null);
  const canvasHelpRef = useRef<HTMLDivElement>(null);
  const detachedActionsRef = useRef<HTMLDivElement>(null);
  const [showWarnings, setShowWarnings] = useState(false);
  const [pendingCompile, setPendingCompile] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [packageMenuOpen, setPackageMenuOpen] = useState(false);
  const [showPackageHelp, setShowPackageHelp] = useState(false);
  const [packageActionConfirm, setPackageActionConfirm] = useState<'export' | 'import' | null>(null);
  const [showCanvasHelp, setShowCanvasHelp] = useState(false);
  const [showDetachedActions, setShowDetachedActions] = useState(false);
  const [compileNotice, setCompileNotice] = useState<CompileNotice | null>(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const shellExecutionEnabled = Boolean(activeTab?.runtimeSettings?.shellExecutionEnabled);
  const currentSurfaceTruth = buildSurfaceTruthSummary({
    artifactType: activeTab?.artifactType || 'graph',
    executionProfile: activeTab?.executionProfile || (isAsync ? 'langgraph_async' : 'langgraph_sync'),
    projectMode: activeTab?.projectMode || 'langgraph',
  });

  const semanticLinkKinds = Object.entries(graphValidation?.semanticEdgeSummary || {}).filter(([kind, count]) => kind !== 'direct_flow' && count > 0);
  const graphScopeMarkerCount = graphValidation?.graphScopeMarkerIds?.size || 0;

  useEffect(() => {
    if (!packageMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!packageMenuRef.current?.contains(event.target as Node)) {
        setPackageMenuOpen(false);
        setShowPackageHelp(false);
        setPackageActionConfirm(null);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [packageMenuOpen]);

  useEffect(() => {
    if (!showDetachedActions) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!detachedActionsRef.current?.contains(event.target as Node)) setShowDetachedActions(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [showDetachedActions]);

  useEffect(() => {
    if (!showCanvasHelp) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!canvasHelpRef.current?.contains(event.target as Node)) {
        setShowCanvasHelp(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [showCanvasHelp]);

  const proceedImportPackage = () => {
    clearImportReport();
    packageInputRef.current?.click();
    setPackageActionConfirm(null);
  };

  const handleImportPackage = () => {
    setPackageActionConfirm('import');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const report = loadProject(String(reader.result ?? ''));
      if (report.status === 'error') {
        setPackageMenuOpen(true);
        alert(`${report.title}: ${report.message}`);
      } else if (report.status === 'warning') {
        setPackageMenuOpen(true);
      } else {
        setPackageMenuOpen(false);
        setPackageActionConfirm(null);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const proceedExportPackage = () => {
    try {
      const json = exportProjectPackage();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slugifyFilePart(projectName)}.langsuite-project.json`;
      a.click();
      URL.revokeObjectURL(url);
      setPackageMenuOpen(false);
      setPackageActionConfirm(null);
    } catch (err) {
      alert(`Package export error: ${err}`);
    }
  };

  const handleExportPackage = () => {
    setPackageActionConfirm('export');
  };

  const doCompile = async () => {
    setCompiling(true);
    setShowWarnings(false);
    setPendingCompile(false);
    setCompileNotice(null);
    try {
      const json = exportJson();
      const res = await fetch('/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: json,
      });
      if (!res.ok) {
        let errPayload: unknown = null;
        try {
          errPayload = await res.json();
        } catch {
          errPayload = null;
        }
        const payloadRecord = errPayload && typeof errPayload === 'object' ? errPayload as Record<string, unknown> : null;
        const details = normalizeCompileDetails(payloadRecord?.errors ?? payloadRecord?.detail ?? errPayload);
        const summary = typeof payloadRecord?.summary === 'string'
          ? payloadRecord.summary
          : typeof payloadRecord?.message === 'string'
            ? payloadRecord.message
            : res.status === 422
              ? 'Payload validation failed before Python export generation.'
              : 'Python export generation failed.';
        setCompileNotice({
          tone: 'error',
          stage: 'during_compile',
          title: res.status === 422 ? 'Compile blocked during payload validation' : 'Compile failed during generation',
          message: summary,
          details,
        });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const parsed = JSON.parse(json);
      a.download = `${parsed.graph_id}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      clearValidation();
    } catch (err) {
      setCompileNotice({
        tone: 'error',
        stage: 'compile_request',
        title: 'Compile request failed',
        message: err instanceof Error ? err.message : String(err),
        details: [],
      });
    } finally {
      setCompiling(false);
    }
  };

  const handleCompile = async () => {
    setCompileNotice(null);
    const validation = runValidation();
    if (validation.errors.length > 0) {
      setShowWarnings(false);
      setPendingCompile(false);
      setCompileNotice({
        tone: 'error',
        stage: 'before_compile',
        title: 'Compile blocked before request',
        message: validation.errors[0],
        details: [...validation.errors.slice(1), ...validation.warnings.slice(0, 3), ...validation.infos.slice(0, 2)],
      });
      return;
    }
    if (validation.warnings.length > 0) {
      setShowWarnings(true);
      setPendingCompile(true);
      return;
    }
    doCompile();
  };

  return (
    <>
      <div className="h-12 glass border-b border-panel-border flex items-center px-3 gap-2 z-30 relative">
        <div className="flex items-center gap-2 mr-1 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
          >
            <span className="text-white font-bold text-xs">LG</span>
          </div>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="bg-transparent border-none outline-none text-sm font-semibold text-slate-200 w-36 md:w-44 focus:text-white"
          />
        </div>

        <div className="rounded-lg border border-panel-border bg-panel/70 p-0.5 flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => setEditorMode('simple')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 ${
              editorMode === 'simple'
                ? 'bg-blue-500/15 text-blue-300'
                : 'text-slate-400 hover:text-white hover:bg-panel-hover'
            }`}
            title="Recenters the editor on the main LangGraph workflow."
          >
            <GitBranch size={12} />
            Graph
            <span className="hidden xl:inline text-[10px] text-emerald-300/80">recommended</span>
          </button>
          <button
            onClick={() => setEditorMode('advanced')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 ${
              editorMode === 'advanced'
                ? 'bg-violet-500/15 text-violet-300'
                : 'text-slate-400 hover:text-white hover:bg-panel-hover'
            }`}
            title="Shows advanced metadata and side panels on the same LangGraph trunk."
          >
            <Boxes size={12} />
            Advanced
            <span className="hidden xl:inline text-[10px] text-slate-400">optional</span>
          </button>
        </div>

        <div className="h-5 w-px bg-panel-border shrink-0" />

        {editorMode === 'advanced' && (
          <div className="hidden 2xl:flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200 shrink-0" data-testid="advanced-mode-toolbar-note">
            Advanced authoring overlays the LangGraph trunk; it is not a separate guaranteed runtime lane.
          </div>
        )}

        <ToolbarButton icon={Save} label="Save in app" onClick={saveProject} />
        <div className="relative" ref={packageMenuRef}>
          <ToolbarButton
            icon={Package}
            label="Package"
            onClick={() => {
              setPackageMenuOpen((open) => {
                const next = !open;
                if (!next) {
                  setShowPackageHelp(false);
                  setPackageActionConfirm(null);
                }
                return next;
              });
            }}
            dataTestId="toolbar-open-package-menu"
            active={packageMenuOpen}
          />
          {packageMenuOpen && (
            <div className="absolute left-0 top-10 w-80 rounded-xl border border-panel-border bg-[#0f1422]/95 shadow-2xl shadow-black/40 backdrop-blur-md p-3 space-y-3" data-testid="package-menu">
              <div className="space-y-1 relative">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <span>Portable package</span>
                  <button
                    type="button"
                    onClick={() => setShowPackageHelp((v) => !v)}
                    className="w-4 h-4 rounded-full border border-panel-border text-[10px] text-slate-400 hover:text-white hover:bg-panel-hover transition-all flex items-center justify-center"
                    title="What the package keeps"
                  >
                    ?
                  </button>
                </div>
                <div className="text-[11px] leading-5 text-slate-400">Workspace only: graph tree, saved graph settings, reopening metadata, and honest surface truth.</div>
                {showPackageHelp && (
                  <div className="absolute z-20 top-10 left-0 w-80 rounded-lg border border-panel-border bg-[#0b0e16] shadow-2xl px-3 py-2 text-[11px] leading-5 text-slate-300">
                    Packages move the editable workspace only. They preserve the graph tree, saved settings, and the package&apos;s declared surface truth. They do not bundle runtime DB contents, vector stores, secrets, installed Python packages, or hidden environment state.
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleExportPackage}
                  className="flex items-center justify-center gap-2 rounded-lg border border-panel-border bg-panel-hover/30 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-panel-hover transition-all"
                  data-testid="package-export-button"
                >
                  <Download size={13} />
                  Export package
                </button>
                <button
                  onClick={handleImportPackage}
                  className="flex items-center justify-center gap-2 rounded-lg border border-panel-border bg-panel-hover/30 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-panel-hover transition-all"
                  data-testid="package-import-button"
                >
                  <Upload size={13} />
                  Import package
                </button>
              </div>
              <div className="rounded-lg border border-panel-border bg-black/20 px-2.5 py-2 text-[10px] leading-5 text-slate-500">{projectPersistence.contrastSummary} Current surface: {currentSurfaceTruth.summary}</div>
              <ProjectPersistenceTruthBlock
                summary={projectPersistence}
                className="text-[10px]"
                showContrast={false}
                testIdPrefix="project-save-open"
              />
              <div className="rounded-lg border border-panel-border bg-black/20 px-2.5 py-2 text-[10px] leading-5 text-slate-400" data-testid="package-surface-truth">
                <SurfaceTruthBadges surfaceTruth={currentSurfaceTruth} />
              </div>
              {packageActionConfirm && (
                <div className={`rounded-lg border px-3 py-3 text-[11px] leading-5 ${packageActionConfirm === 'export' ? 'border-cyan-500/25 bg-cyan-500/10 text-cyan-100' : 'border-amber-500/25 bg-amber-500/10 text-amber-100'}`} data-testid="package-consequence-dialog">
                  <div className="font-medium text-white">{packageActionConfirm === 'export' ? 'Before exporting this package' : 'Before importing this package'}</div>
                  <ul className="mt-2 space-y-1 text-[11px]">
                    {packageActionConfirm === 'export' ? (
                      <>
                        <li>• Preserves the editable workspace tree, saved graph settings, and reopening metadata.</li>
                        <li>• Preserves this surface truth: {currentSurfaceTruth.summary}</li>
                        <li>• Excludes runtime DB contents, vector stores, secrets, installed dependencies, and hidden environment snapshots.</li>
                        <li>• Does not replace compiled Python export; compile remains the runnable-code path.</li>
                      </>
                    ) : (
                      <>
                        <li>• Replaces the current editor workspace with the imported package contents.</li>
                        <li>• Restores only the editable workspace fields the current build still understands.</li>
                        <li>• Shows after import whether the package claimed a compile-safe surface or an editor-first one.</li>
                        <li>• Cannot recreate missing local runtime state that was never part of the package.</li>
                      </>
                    )}
                  </ul>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => setPackageActionConfirm(null)}
                      className="px-2.5 py-1.5 rounded-md border border-panel-border bg-black/20 text-[11px] text-slate-200 hover:bg-panel-hover transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={packageActionConfirm === 'export' ? proceedExportPackage : proceedImportPackage}
                      className={`px-2.5 py-1.5 rounded-md border text-[11px] transition-all ${packageActionConfirm === 'export' ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20' : 'border-amber-500/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20'}`}
                    >
                      {packageActionConfirm === 'export' ? 'Export workspace package' : 'Import package into editor'}
                    </button>
                  </div>
                </div>
              )}
              {lastImportReport && (
                <div
                  className={`rounded-lg border px-2.5 py-2 text-[11px] leading-5 ${lastImportReport.status === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : lastImportReport.status === 'warning' ? 'border-amber-500/30 bg-amber-500/10 text-amber-100' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'}`}
                  data-testid="package-import-report"
                >
                  <div className="font-medium">{lastImportReport.title}</div>
                  <div className="mt-1 opacity-90">{lastImportReport.message}</div>
                  {buildImportDetailLines(lastImportReport).length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer select-none text-[10px] opacity-80">Details</summary>
                      <div className="mt-1 space-y-1 text-[10px] opacity-85">
                        {buildImportDetailLines(lastImportReport).map((line) => (
                          <div key={line}>{line}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          title="Workspace preferences"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-panel-hover transition-all shrink-0"
        >
          <Settings2 size={15} />
        </button>
        {saveStatus === 'saving' && <Loader2 size={12} className="animate-spin text-blue-400 shrink-0" />}
        {saveStatus === 'saved' && <Check size={12} className="text-green-400 shrink-0" />}
        {saveStatus === 'error' && <AlertCircle size={12} className="text-red-400 shrink-0" />}
        <ToolbarButton icon={FolderKanban} label="Projects" onClick={toggleProjectManager} dataTestId="toolbar-open-projects" />
        <ToolbarButton icon={Trash2} label="Delete" onClick={deleteSelected} variant="danger" />

        <div className="h-5 w-px bg-panel-border shrink-0" />

        <button
          onClick={toggleCollab}
          title="Collaboration"
          className={`relative w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
            sessionId
              ? 'text-green-400 bg-green-500/10 hover:bg-green-500/20'
              : 'text-slate-400 hover:text-white hover:bg-panel-hover'
          }`}
        >
          <Users size={16} />
          {sessionId && connectedUsers.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 text-white text-[9px] font-bold flex items-center justify-center">
              {connectedUsers.length}
            </span>
          )}
        </button>

        <div className="h-5 w-px bg-panel-border shrink-0" />

        <button
          onClick={() => setIsAsync(!isAsync)}
          title={isAsync ? 'Async LangGraph execution profile' : 'Sync LangGraph execution profile'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 ${
            isAsync
              ? 'text-violet-300 bg-violet-500/15 hover:bg-violet-500/25'
              : 'text-amber-300 bg-amber-500/15 hover:bg-amber-500/25'
          }`}
        >
          {isAsync ? <Zap size={12} /> : <Timer size={12} />}
          {isAsync ? 'Async' : 'Sync'}
        </button>

        {graphValidation && graphValidation.componentCount > 1 && (
          <div className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/15 text-amber-400 text-xs font-medium shrink-0">
            <AlertTriangle size={12} />
            <span>{graphValidation.componentCount} circuits</span>
          </div>
        )}

        {graphValidation && graphValidation.detachedComponentCount > 0 && (
          <div className="relative hidden xl:block shrink-0" ref={detachedActionsRef}>
            <button
              onClick={() => setShowDetachedActions((open) => !open)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-fuchsia-500/15 text-fuchsia-300 text-xs font-medium hover:bg-fuchsia-500/20"
              title="Detached workflow actions"
              data-testid="toolbar-detached-actions"
            >
              <GitBranch size={12} />
              <span>{graphValidation.detachedComponentCount} detached</span>
            </button>
            {showDetachedActions && (
              <div className="absolute right-0 top-9 z-40 w-72 rounded-xl border border-panel-border bg-[#0f1422]/95 shadow-2xl shadow-black/40 backdrop-blur-md p-3 space-y-2 text-[11px] text-slate-300" data-testid="detached-actions-popover">
                <div className="text-sm font-semibold text-white">Detached workflows</div>
                <div className="text-slate-400 leading-5">Detached interactive circuits compile as independent graphs. Focus them first, then decide whether to merge or keep them separate.</div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => {
                      selectNodesByIds(Array.from(graphValidation.detachedNodeIds || []));
                      setShowDetachedActions(false);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-fuchsia-500/20 bg-fuchsia-500/10 px-2.5 py-1.5 text-[11px] font-medium text-fuchsia-200 hover:bg-fuchsia-500/20"
                  >
                    <MousePointerClick size={12} />
                    Select detached
                  </button>
                  <button
                    onClick={() => {
                      selectNodesByIds([]);
                      setShowDetachedActions(false);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-panel-border bg-black/20 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-panel-hover"
                  >
                    Clear selection
                  </button>
                </div>
                <div className="text-[10px] leading-5 text-slate-500">Detached nodes are valid authoring surfaces. The first circuit stays primary unless you explicitly merge or rebuild the graph structure.</div>
              </div>
            )}
          </div>
        )}

        {graphValidation && Object.entries(graphValidation.semanticEdgeSummary || {}).some(([kind, count]) => kind !== 'direct_flow' && count > 0) && (
          <div className="hidden xl:flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-500/15 text-cyan-300 text-xs font-medium shrink-0">
            <Link size={12} />
            <span>{semanticLinkKinds.length} semantic link kinds</span>
          </div>
        )}

        <div className="relative shrink-0" ref={canvasHelpRef}>
          <button
            onClick={() => setShowCanvasHelp((open) => !open)}
            title="Canvas semantics guidance"
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${showCanvasHelp ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-400 hover:text-white hover:bg-panel-hover'}`}
            data-testid="toolbar-canvas-help"
          >
            <Info size={15} />
          </button>
          {showCanvasHelp && (
            <div className="absolute right-0 top-10 z-40 w-80 rounded-xl border border-panel-border bg-[#0f1422]/95 shadow-2xl shadow-black/40 backdrop-blur-md p-3 space-y-2 text-[11px] text-slate-300" data-testid="canvas-help-popover">
              <div className="text-sm font-semibold text-white">Canvas semantics</div>
              <div className="text-slate-400 leading-5">The canvas is an authoring language. Some handles and chips represent semantic attachments or graph-scope settings rather than literal one-to-one runtime edges.</div>
              <ul className="space-y-1.5 text-slate-300 leading-5">
                <li>• Tools, memory, context, and fanout handles may compile into synthesized runtime structure.</li>
                <li>• Detached interactive circuits compile as independent graphs; graph-scope markers do not count as detached circuits.</li>
                <li>• Embedded and lowered artifact references remain distinct integration models.</li>
              </ul>
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div className="rounded-lg border border-panel-border bg-black/20 px-2 py-1.5">
                  <div className="text-slate-500 uppercase">Detached</div>
                  <div className="mt-1 text-slate-100 font-medium">{graphValidation?.detachedComponentCount || 0}</div>
                </div>
                <div className="rounded-lg border border-panel-border bg-black/20 px-2 py-1.5">
                  <div className="text-slate-500 uppercase">Graph scope</div>
                  <div className="mt-1 text-slate-100 font-medium">{graphScopeMarkerCount}</div>
                </div>
                <div className="rounded-lg border border-panel-border bg-black/20 px-2 py-1.5">
                  <div className="text-slate-500 uppercase">Semantic links</div>
                  <div className="mt-1 text-slate-100 font-medium">{semanticLinkKinds.length}</div>
                </div>
              </div>
              {semanticLinkKinds.length > 0 && (
                <div className="rounded-lg border border-panel-border bg-black/20 px-2.5 py-2">
                  <div className="text-[10px] uppercase text-slate-500 mb-1">Kinds present</div>
                  <div className="flex flex-wrap gap-1">
                    {semanticLinkKinds.map(([kind, count]) => (
                      <span key={kind} className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-200 border border-cyan-500/20">{kind} · {count}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1" />

        <ToolbarButton icon={Play} label="Run panel" onClick={toggleRunPanel} />

        <button
          onClick={() => updateRuntimeSettings({ shellExecutionEnabled: !shellExecutionEnabled })}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all shrink-0 ${shellExecutionEnabled ? 'bg-orange-500/20 text-orange-200 border border-orange-400/30 hover:bg-orange-500/30' : 'bg-black/20 text-slate-300 border border-panel-border hover:bg-panel-hover'}`}
          title={shellExecutionEnabled ? 'Bounded shell execution is armed for this graph. This only enables explicit shell tools and does not provide OS container isolation.' : 'Arm bounded shell execution for this graph. Required before shell tools can run.'}
          data-testid="toolbar-shell-arming"
        >
          <TerminalSquare size={14} />
          {shellExecutionEnabled ? 'Shell armed' : 'Shell off'}
        </button>

        <button
          onClick={handleCompile}
          disabled={compiling}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium bg-accent-blue hover:bg-blue-600 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          title="Compile a runnable Python export from the current graph."
        >
          {compiling ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Compile Python
        </button>

        <input
          ref={packageInputRef}
          type="file"
          accept=".json,.langsuite-project.json"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <SettingsShell open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {compileNotice && (
        <div className="validation-banner">
          <div className={`validation-banner-content ${compileNotice.tone === 'error' ? 'validation-banner-error' : compileNotice.tone === 'warning' ? 'validation-banner-warning' : 'validation-banner-info'}`}>
            <div className="validation-banner-header">
              <AlertCircle size={16} className={compileNotice.tone === 'error' ? 'text-red-400' : compileNotice.tone === 'warning' ? 'text-amber-400' : 'text-cyan-400'} />
              <span className="validation-banner-title">{compileNotice.title}</span>
              <button onClick={() => setCompileNotice(null)} className="validation-banner-close">
                <X size={14} />
              </button>
            </div>
            <div className="text-xs text-slate-200 leading-5">{compileNotice.message}</div>
            {compileNotice.details.length > 0 && (
              <ul className="validation-banner-list mt-3">
                {compileNotice.details.map((detail, index) => (
                  <li key={`${compileNotice.stage}-${index}`}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {showWarnings && pendingCompile && graphValidation && graphValidation.warnings.length > 0 && (
        <div className="validation-banner">
          <div className="validation-banner-content">
            <div className="validation-banner-header">
              <AlertTriangle size={16} className="text-amber-400" />
              <span className="validation-banner-title">Graph validation</span>
              <button onClick={() => { setShowWarnings(false); setPendingCompile(false); }} className="validation-banner-close">
                <X size={14} />
              </button>
            </div>
            <ul className="validation-banner-list">
              {graphValidation.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            {graphValidation.infos.length > 0 && (
              <div className="mt-3 text-[11px] text-slate-400 space-y-1">
                {graphValidation.infos.slice(0, 5).map((info, i) => (
                  <div key={`info-${i}`}>• {info}</div>
                ))}
              </div>
            )}
            <div className="validation-banner-actions">
              <button onClick={() => { setShowWarnings(false); setPendingCompile(false); }} className="validation-btn-cancel">
                Cancel
              </button>
              <button onClick={doCompile} className="validation-btn-confirm">
                Compile anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  variant,
  dataTestId,
  active,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: 'danger';
  dataTestId?: string;
  active?: boolean;
}) {
  const hoverClass =
    variant === 'danger'
      ? 'hover:text-red-400 hover:bg-red-500/10'
      : active
        ? 'text-blue-300 bg-blue-500/10 hover:bg-blue-500/20'
        : 'hover:text-white hover:bg-panel-hover';
  return (
    <button
      onClick={onClick}
      title={label}
      data-testid={dataTestId}
      className={`w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 transition-all ${hoverClass}`}
    >
      <Icon size={16} />
    </button>
  );
}
