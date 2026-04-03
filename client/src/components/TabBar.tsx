import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store';
import { ARTIFACT_KIND_META, EXECUTION_PROFILE_META, PROJECT_MODE_META, type ProjectMode } from '../capabilities';
import { X, Plus } from 'lucide-react';

function colorFromScope(scopePath: string): string {
  let hash = 0;
  for (let i = 0; i < scopePath.length; i++) hash = ((hash << 5) - hash) + scopePath.charCodeAt(i);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 65% 55%)`;
}

function getArtifactBadge(tab: { artifactType: string; scopeKind: string }) {
  const meta = ARTIFACT_KIND_META[tab.artifactType as keyof typeof ARTIFACT_KIND_META];
  if (tab.artifactType === 'subgraph' || tab.scopeKind === 'subgraph') {
    return { label: 'SGR', className: 'bg-fuchsia-500/15 text-fuchsia-300' };
  }
  if (tab.artifactType === 'graph') {
    return { label: 'GR', className: 'bg-slate-500/15 text-slate-300' };
  }
  if (tab.artifactType === 'agent') {
    return { label: 'AG', className: 'bg-sky-500/15 text-sky-300' };
  }
  if (tab.artifactType === 'deep_agent') {
    return { label: 'DAG', className: 'bg-violet-500/15 text-violet-300' };
  }
  return { label: meta?.surfaceLevel === 'internal' ? 'INT' : 'ADV', className: 'bg-amber-500/15 text-amber-300' };
}


function getModeBadge(tab: { projectMode: ProjectMode }) {
  const meta = PROJECT_MODE_META[tab.projectMode];
  if (tab.projectMode === 'langgraph') return { label: 'LG', className: 'bg-cyan-500/15 text-cyan-300', title: meta.label };
  if (tab.projectMode === 'langchain') return { label: 'LC', className: 'bg-sky-500/15 text-sky-300', title: meta.label };
  return { label: 'DA', className: 'bg-violet-500/15 text-violet-300', title: meta.label };
}

function getProfileBadge(tab: { executionProfile: string; isAsync: boolean }) {
  const meta = EXECUTION_PROFILE_META[tab.executionProfile as keyof typeof EXECUTION_PROFILE_META];
  if (tab.executionProfile === 'langgraph_sync') {
    return { label: 'sync', className: 'bg-amber-500/15 text-amber-300' };
  }
  if (tab.executionProfile === 'langgraph_async') {
    return { label: 'async', className: 'bg-emerald-500/15 text-emerald-300' };
  }
  if (tab.executionProfile === 'langchain_agent') {
    return { label: 'agent', className: 'bg-sky-500/15 text-sky-300' };
  }
  if (tab.executionProfile === 'deepagents') {
    return { label: 'adapter', className: 'bg-violet-500/15 text-violet-300' };
  }
  return { label: meta?.surfaceLevel === 'internal' ? 'internal' : 'advanced', className: 'bg-amber-500/15 text-amber-300' };
}

export default function TabBar() {
  const {
    tabs,
    activeTabId,
    switchTab,
    closeTab,
    openTab,
    renameTab,
    editorMode,
    preferences,
  } = useAppStore();
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const simpleMode = editorMode === 'simple';
  const hideTechnicalBadges = simpleMode && preferences.reducedTechnicalBadgesInSimpleMode;
  const showArtifactBadge = !simpleMode || preferences.showArtifactBadgesInSimpleMode;
  const showScopePath = !simpleMode || preferences.showScopePathInSimpleMode;

  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  const handleDoubleClick = (tabId: string, currentName: string) => {
    setEditingTabId(tabId);
    setEditValue(currentName);
  };

  const commitRename = () => {
    if (editingTabId && editValue.trim()) {
      renameTab(editingTabId, editValue.trim());
    }
    setEditingTabId(null);
  };

  const handleNewTab = () => {
    openTab(null, 'Nouveau Projet', [], [], [], true, { projectMode: 'langgraph' });
  };

  return (
    <div className="h-10 glass border-b border-panel-border flex items-center px-1 gap-1 z-30 overflow-x-auto scrollbar-none">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const accent = colorFromScope(tab.scopePath || tab.projectName || tab.id);
        const artifactBadge = getArtifactBadge(tab);
        const modeBadge = getModeBadge(tab);
        const profileBadge = getProfileBadge(tab);
        const titleLines = [
          `${tab.artifactType} · ${tab.scopePath}`,
          `mode=${tab.projectMode}`,
          `profile=${profileBadge.label}`,
        ];
        if (tab.projectId) titleLines.push(`project_id=${tab.projectId}`);

        return (
          <div
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            onDoubleClick={() => handleDoubleClick(tab.id, tab.projectName)}
            title={titleLines.join('\n')}
            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all shrink-0 max-w-[260px] select-none border ${isActive ? 'bg-panel-light text-white border-panel-border' : 'text-slate-500 hover:text-slate-300 hover:bg-panel-hover border-transparent'}`}
            style={{ boxShadow: isActive ? `inset 3px 0 0 ${accent}` : undefined }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accent, opacity: tab.isDirty ? 1 : 0.6 }} />

            {editingTabId === tab.id ? (
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setEditingTabId(null);
                }}
                className="bg-transparent border-none outline-none text-xs text-white w-24"
              />
            ) : (
              <div className="min-w-0 flex items-center gap-1.5">
                <span className="truncate max-w-[120px]">{tab.projectName}</span>
                {!hideTechnicalBadges && !simpleMode && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${tab.scopeKind === 'subgraph' ? 'bg-fuchsia-500/15 text-fuchsia-300' : 'bg-slate-500/15 text-slate-300'}`}>
                    {tab.scopeKind === 'subgraph' ? 'SG' : 'G'}
                  </span>
                )}
                {!simpleMode && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${modeBadge.className}`} title={modeBadge.title}>
                    {modeBadge.label}
                  </span>
                )}
                {showArtifactBadge && !simpleMode && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${artifactBadge.className}`}>
                    {artifactBadge.label}
                  </span>
                )}
                <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${profileBadge.className}`}>
                  {profileBadge.label}
                </span>
              </div>
            )}

            {showScopePath && (
              <span className="truncate text-[10px] text-slate-500 max-w-[80px]">{tab.scopePath}</span>
            )}

            {tabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all shrink-0"
              >
                <X size={10} />
              </button>
            )}
          </div>
        );
      })}

      <button
        onClick={handleNewTab}
        className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-panel-hover transition-all shrink-0 ml-1"
        title="Nouveau projet racine"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
