import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useAppStore } from '../store';
import { PROJECT_MODE_META, type ProjectMode } from '../capabilities';
import { X, FolderOpen, Trash2, Copy, Search, Plus, GitBranch, Clock, Loader2, ChevronDown, ChevronRight, ExternalLink, Boxes, Bot, BrainCircuit } from 'lucide-react';
import { LEGACY_ARTIFACT_TYPES } from '../capabilities';
import { fetchProjects, fetchProjectTree, deleteProject, duplicateProject, type ProjectSummary, type ProjectTreeNode } from '../api';
import { buildProjectPersistenceSummary } from '../store/workspace';

function parseProjectData(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function describeTreeNode(tree: ProjectTreeNode, isRoot: boolean): { label: string; tone: string; note?: string } {
  const data = parseProjectData(tree.data);
  const artifactType = typeof data.artifactType === 'string' ? data.artifactType : null;
  const scopeKind = typeof data.scopeKind === 'string' ? data.scopeKind : null;

  if (isRoot) {
    const workspaceTree = data.workspaceTree && typeof data.workspaceTree === 'object' ? data.workspaceTree as Record<string, unknown> : null;
    const openChildScopeKeys = workspaceTree && Array.isArray(workspaceTree.openChildScopeKeys) ? workspaceTree.openChildScopeKeys.length : 0;
    return {
      label: 'Root graph',
      tone: 'text-slate-300 bg-slate-500/10 border-slate-500/20',
      note: openChildScopeKeys > 0 ? `reopens ${openChildScopeKeys} child tab${openChildScopeKeys > 1 ? 's' : ''}` : 'single root workspace entry',
    };
  }

  if (artifactType === 'subgraph' || scopeKind === 'subgraph') {
    return {
      label: 'Editable subgraph',
      tone: 'text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/20',
      note: 'persisted child tab',
    };
  }

  if (artifactType && LEGACY_ARTIFACT_TYPES.includes(artifactType as never)) {
    return {
      label: 'Legacy-linked surface',
      tone: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
      note: 'retained metadata, not a separate runtime mode',
    };
  }

  return {
    label: 'Child entry',
    tone: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
    note: 'known persisted child row',
  };
}

function TreeNodeRow({ tree, depth, rootId, onOpenRoot }: { tree: ProjectTreeNode; depth: number; rootId: string; onOpenRoot: (projectId: string) => void }) {
  const isRoot = depth === 0;
  const kind = describeTreeNode(tree, isRoot);
  const hasChildren = tree.subgraphs.length > 0;
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-panel-border bg-black/15 px-3 py-2.5" style={{ marginLeft: depth * 16 }} data-testid={isRoot ? `project-tree-root-${tree.id}` : `project-tree-child-${tree.id}`}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isRoot ? 'bg-blue-500/15 text-blue-400' : 'bg-fuchsia-500/10 text-fuchsia-300'}`}>
            {isRoot ? <FolderOpen size={14} /> : <GitBranch size={13} />}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm font-medium text-white truncate">{tree.name}</div>
              <span className={`px-1.5 py-0.5 rounded text-[10px] border ${kind.tone}`}>{kind.label}</span>
              {tree.parent_node_id && <span className="px-1.5 py-0.5 rounded text-[10px] border border-panel-border text-slate-400">parent node: {tree.parent_node_id}</span>}
            </div>
            {kind.note && <div className="text-[11px] text-slate-500 leading-5">{kind.note}</div>}
            {hasChildren && <div className="text-[10px] text-slate-500">{tree.subgraphs.length} persisted child subgraph{tree.subgraphs.length > 1 ? 's' : ''}</div>}
          </div>
          {isRoot ? (
            <button onClick={(e) => { e.stopPropagation(); onOpenRoot(rootId); }} className="px-2.5 py-1.5 rounded-lg text-[11px] border border-blue-500/20 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 transition-all">Open root</button>
          ) : (
            <div className="text-[10px] text-slate-500 pt-1">Opens with root</div>
          )}
        </div>
      </div>
      {hasChildren && <div className="space-y-2 border-l border-panel-border/70 ml-3 pl-2">{tree.subgraphs.map((child) => <TreeNodeRow key={child.id} tree={child} depth={depth + 1} rootId={rootId} onOpenRoot={onOpenRoot} />)}</div>}
    </div>
  );
}

export default function ProjectManager() {
  const projectPersistence = buildProjectPersistenceSummary();
  const { projectManagerOpen, toggleProjectManager, loadProjectFromDb, openTab } = useAppStore();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [trees, setTrees] = useState<Record<string, ProjectTreeNode | null>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [treeLoading, setTreeLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => { if (projectManagerOpen) void loadProjects(); }, [projectManagerOpen]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const list = await fetchProjects();
      setProjects(list);
      setExpanded(Object.fromEntries(list.map((project) => [project.id, true])));
      setTreeLoading(true);
      const entries = await Promise.all(list.map(async (project) => {
        try {
          return [project.id, await fetchProjectTree(project.id)] as const;
        } catch (err) {
          console.error('Failed to load project tree:', project.id, err);
          return [project.id, null] as const;
        }
      }));
      setTrees(Object.fromEntries(entries));
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
      setTreeLoading(false);
    }
  };

  const handleOpen = (projectId: string) => { void loadProjectFromDb(projectId); toggleProjectManager(); };

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setTrees((prev) => { const next = { ...prev }; delete next[id]; return next; });
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleDuplicate = async (id: string) => { try { await duplicateProject(id); await loadProjects(); } catch (err) { console.error('Duplicate failed:', err); } };

  const handleRename = async (id: string) => {
    if (!renameValue.trim()) return;
    try {
      await fetch(`/api/projects/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: renameValue.trim() }) });
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name: renameValue.trim() } : p)));
      setTrees((prev) => ({ ...prev, [id]: prev[id] ? { ...prev[id]!, name: renameValue.trim() } : prev[id] }));
      const { tabs } = useAppStore.getState();
      const openTabForProject = tabs.find((t) => t.projectId === id);
      if (openTabForProject) useAppStore.getState().renameTab(openTabForProject.id, renameValue.trim());
      setRenamingId(null);
    } catch (err) {
      console.error('Rename failed:', err);
    }
  };

  const handleNewProject = (projectMode: ProjectMode) => {
    const meta = PROJECT_MODE_META[projectMode];
    openTab(null, meta.label, [], [], [], meta.defaultAsync, { projectMode, artifactType: meta.defaultArtifactType, executionProfile: meta.defaultExecutionProfile });
    toggleProjectManager();
  };
  const filtered = useMemo(() => projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())), [projects, search]);
  if (!projectManagerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={toggleProjectManager} />
      <div className="relative w-full max-w-4xl max-h-[84vh] glass rounded-xl border border-panel-border shadow-2xl flex flex-col overflow-hidden" data-testid="project-manager-modal">
        <div className="flex items-center justify-between px-5 py-4 border-b border-panel-border">
          <div>
            <h2 className="text-lg font-semibold text-white">Projects saved in app</h2>
            <p className="text-[11px] text-slate-500 mt-1">This tree reflects the persisted root graph plus known child subgraphs saved in the app. Project packages are a separate portable export/import flow, and wrapper references still live on nodes instead of pretending to be extra roots.</p>
            <p className="text-[11px] text-slate-400 mt-1" data-testid="project-manager-open-truth">{projectPersistence.openEffectSummary}</p>
            <p className="text-[11px] text-amber-200/80 mt-1" data-testid="project-manager-mode-note">LangGraph is the default path. LangChain and DeepAgents entries remain advanced/editor-first authoring surfaces, not equal runtime guarantees.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <button onClick={() => handleNewProject('langgraph')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-all"><GitBranch size={12} />LangGraph <span className="text-[10px] text-emerald-200/90">recommended</span></button>
              <button onClick={() => handleNewProject('langchain')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-sky-500/20 bg-sky-500/10 hover:bg-sky-500/20 text-sky-100 transition-all"><Bot size={12} />LangChain <span className="text-[10px] text-slate-300">advanced</span></button>
              <button onClick={() => handleNewProject('deepagents')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-500/20 bg-violet-500/10 hover:bg-violet-500/20 text-violet-100 transition-all"><BrainCircuit size={12} />DeepAgents <span className="text-[10px] text-slate-300">experimental</span></button>
            </div>
            <button onClick={toggleProjectManager} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-panel-hover transition-all"><X size={16} /></button>
          </div>
        </div>
        <div className="px-5 py-3 border-b border-panel-border space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search saved root projects..." className="w-full pl-9 pr-3 py-2 bg-panel border border-panel-border rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500" />
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-2"><Boxes size={12} className="text-slate-400" /><span>Known children come from persisted project rows plus reopening metadata already saved with the workspace tree. This is not arbitrary graph archaeology or a second runtime map.</span></div>
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-3">
          {(loading || treeLoading) && <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 size={20} className="animate-spin mr-2" />Loading project tree...</div>}
          {!loading && filtered.length === 0 && <div className="flex flex-col items-center justify-center py-12 text-slate-500"><FolderOpen size={32} className="mb-2 opacity-50" /><p className="text-sm">{search ? 'No matching root project' : 'No saved project yet'}</p>{!search && <p className="text-xs mt-1 text-slate-600">Save a project to see its root + child tree here.</p>}</div>}
          {!loading && filtered.map((project) => {
            const tree = trees[project.id] || null;
            const isExpanded = expanded[project.id] ?? true;
            return (
              <div key={project.id} className="rounded-xl border border-panel-border bg-black/10 overflow-hidden">
                <div className="group flex items-center gap-3 px-4 py-3 hover:bg-panel-hover/60 transition-all">
                  <button className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-black/20 transition-all" onClick={() => setExpanded((prev) => ({ ...prev, [project.id]: !isExpanded }))} aria-label={isExpanded ? 'Collapse tree' : 'Expand tree'}>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
                  <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0"><FolderOpen size={16} className="text-blue-400" /></div>
                  <div className="flex-1 min-w-0" onClick={() => handleOpen(project.id)}>
                    {renamingId === project.id ? (
                      <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onBlur={() => void handleRename(project.id)} onKeyDown={(e) => { if (e.key === 'Enter') void handleRename(project.id); if (e.key === 'Escape') setRenamingId(null); }} onClick={(e) => e.stopPropagation()} className="bg-transparent border border-blue-500 rounded px-1 py-0.5 text-sm text-white outline-none w-full" autoFocus />
                    ) : (
                      <p className="text-sm font-medium text-white truncate">{project.name}</p>
                    )}
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap"><span className="flex items-center gap-1 text-xs text-slate-500"><Clock size={10} />{formatDate(project.updated_at)}</span><span className="flex items-center gap-1 text-xs text-violet-400"><GitBranch size={10} />{project.subgraph_count} child subgraph{project.subgraph_count > 1 ? 's' : ''}</span></div>
                  </div>
                  <button onClick={() => handleOpen(project.id)} className="px-2.5 py-1.5 rounded-lg text-[11px] border border-blue-500/20 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 transition-all" data-testid={`open-project-${project.id}`}>Open</button>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ActionButton icon={Copy} title="Duplicate" onClick={(e) => { e.stopPropagation(); void handleDuplicate(project.id); }} />
                    <ActionButton icon={ExternalLink} title="Rename" onClick={(e) => { e.stopPropagation(); setRenamingId(project.id); setRenameValue(project.name); }} />
                    <ActionButton icon={Trash2} title="Delete" variant="danger" onClick={(e) => { e.stopPropagation(); void handleDelete(project.id); }} />
                  </div>
                </div>
                {isExpanded && tree && <div className="px-4 pb-4 pt-1 border-t border-panel-border/60 space-y-3 bg-black/10"><TreeNodeRow tree={tree} depth={0} rootId={project.id} onOpenRoot={handleOpen} /></div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, title, onClick, variant }: { icon: LucideIcon; title: string; onClick: (e: React.MouseEvent) => void; variant?: 'danger' }) {
  return <button onClick={onClick} title={title} className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${variant === 'danger' ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/15' : 'text-slate-500 hover:text-white hover:bg-panel-hover'}`}><Icon size={13} /></button>;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'Z');
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}
