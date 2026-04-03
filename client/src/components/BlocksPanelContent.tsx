import { type DragEvent, useMemo, useState } from 'react';
import { NODE_DEFS, CATEGORIES, type NodeTypeDef } from '../nodeConfig';
import { ChevronDown, ChevronRight, LayoutGrid, Filter, Shapes, Sparkles, LibraryBig, Info } from 'lucide-react';
import ArtifactLibrarySection from './artifacts/ArtifactLibrarySection';
import { useAppStore } from '../store';
import { getNodeRuntimeMeta, getNodeCapabilityInfo, inferNodeMaturity, isNodeCompatibleWithSurface, isNodeBackedByRuntime, isNodePaletteHiddenByPolicy, BLOCK_FAMILY_BADGE_CLASSES, BLOCK_FAMILY_LABELS, KIND_BADGE_CLASSES, ORIGIN_BADGE_CLASSES, KIND_LABELS, ORIGIN_LABELS, KIND_ORDER, SURFACE_BADGE_CLASSES, SURFACE_LABELS, RAIL_BADGE_CLASSES, RAIL_LABELS, SUPPORT_STATUS_BADGE_CLASSES, SUPPORT_STATUS_LABELS, MATURITY_BADGE_CLASSES, MATURITY_LABELS } from '../catalog';

const SIMPLE_QUICK_START = ['user_input_node', 'llm_chat', 'tool_web_search', 'chat_output', 'debug_print'] as const;
const QUICK_INSERT_HELP: Record<string, string> = {
  user_input_node: 'Point de départ lisible pour saisir une demande.',
  llm_chat: 'Nœud central pour la réponse conversationnelle.',
  tool_web_search: 'Tavily-backed search tool for current web information.',
  tool_brave_search: 'Brave provider-backed search with its own web index.',
  tool_duckduckgo_search: 'DuckDuckGo-based search with no API-key setup.',
  tool_tavily_extract: 'Tavily-backed URL extraction for provided pages.',
  tool_requests_get: 'Requests toolkit GET surface for stateless HTTP reads.',
  tool_requests_post: 'Requests toolkit POST surface for stateless HTTP writes.',
  tool_fs_list_dir: 'Read-only local filesystem listing from a bounded root path.',
  tool_fs_read_file: 'Read one local text file from a bounded root path.',
  tool_fs_glob: 'Read-only glob search across a bounded local filesystem root.',
  tool_fs_grep: 'Read-only grep-style text search across a bounded local filesystem root.',
  tool_fs_write_file: 'Preview or apply one local text file under a bounded root path with explicit create-vs-overwrite guards.',
  tool_fs_edit_file: 'Preview or apply one local text file edit under a bounded root path with explicit match guards.',
  tool_fs_apply_patch: 'Preview or apply one bounded unified diff patch under a local root path with touched-file and rejection guards.',
  tool_shell_command: 'User-armed bounded local shell subprocess surface with cwd and command allowlist guards and explicit blocked/failed/succeeded statuses.',
  chat_output: 'Montre clairement la réponse finale ou le dernier message.',
  debug_print: 'Inspecte vite un état ou une variable pendant les tests.',
};
const PRESET_HELP: Record<'minimal' | 'graph' | 'memory_rag' | 'advanced' | 'debug', string> = {
  minimal: 'Le strict utile pour démarrer sans bruit.',
  graph: 'Mise en avant du flux principal : entrée, logique, LLM, sortie.',
  memory_rag: 'Pousse mémoire, recherche, documents et récupération.',
  advanced: 'Montre toute la bibliothèque sans filtre fort.',
  debug: 'Favorise inspection, logique et blocs de test.',
};
const COMMON_NODE_TYPES = new Set([
  ...SIMPLE_QUICK_START,
  'static_text',
  'conditional_router',
  'data_container',
  'tool_http_request',
  'tool_json_extract',
  'prompt_template',
]);

type GroupMode = 'category' | 'abstraction';

function QuickInsertButton({ nodeType }: { nodeType: string }) {
  const addNode = useAppStore((s) => s.addNode);
  const nodes = useAppStore((s) => s.nodes);
  const def = NODE_DEFS[nodeType];
  if (!def) return null;
  const Icon = def.icon;
  const capability = getNodeCapabilityInfo(nodeType, {});
  return (
    <button
      onClick={() => {
        const offset = nodes.length * 24;
        addNode(nodeType, { x: 120 + (offset % 220), y: 120 + (offset % 180) });
      }}
      className="flex items-start gap-3 px-3 py-3 rounded-lg border border-panel-border bg-black/20 text-slate-200 hover:bg-panel-hover transition-all text-[11px]"
      title={`Ajouter ${def.label}`}
    >
      <div
        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
        style={{ background: def.color + '22', color: def.color }}
      >
        <Icon size={12} />
      </div>
      <div className="min-w-0 text-left">
        <div className="leading-snug whitespace-normal text-slate-100">{def.label}</div>
        <div className="mt-1 flex items-center gap-1 flex-wrap">
          <span className={`px-1.5 py-0.5 rounded border text-[10px] ${BLOCK_FAMILY_BADGE_CLASSES[capability.blockFamily]}`}>{BLOCK_FAMILY_LABELS[capability.blockFamily]}</span>
          <span className="text-[10px] text-slate-500">{def.category}</span>
        </div>
      </div>
    </button>
  );
}

function matchesPalettePreset(def: NodeTypeDef, preset: 'minimal' | 'graph' | 'memory_rag' | 'advanced' | 'debug') {
  const key = `${def.type} ${def.label}`.toLowerCase();

  switch (preset) {
    case 'minimal':
      return COMMON_NODE_TYPES.has(def.type) || def.category === 'IO' || def.category === 'LLM';
    case 'graph':
      return ['IO', 'LLM', 'Logic', 'Flow'].includes(def.category) || COMMON_NODE_TYPES.has(def.type);
    case 'memory_rag':
      return def.category === 'Memory'
        || key.includes('memory')
        || key.includes('rag')
        || key.includes('search')
        || key.includes('retriev')
        || key.includes('document')
        || key.includes('file')
        || key.includes('vector')
        || def.type === 'tool_web_search';
    case 'debug':
      return def.type.includes('debug')
        || def.type.includes('python')
        || def.type.includes('validator')
        || def.type.includes('router')
        || def.category === 'Logic'
        || def.category === 'IO';
    case 'advanced':
    default:
      return true;
  }
}

export default function BlocksPanelContent() {
  const activeTab = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const artifactType = activeTab?.artifactType || 'graph';
  const executionProfile = activeTab?.executionProfile || 'langgraph_async';
  const projectMode = activeTab?.projectMode || 'langgraph';
  const editorMode = useAppStore((s) => s.editorMode);
  const preferences = useAppStore((s) => s.preferences);
  const updatePreferences = useAppStore((s) => s.updatePreferences);
  const setCapabilityInspectorTarget = useAppStore((s) => s.setCapabilityInspectorTarget);
  const simpleMode = editorMode === 'simple';

  const [groupMode, setGroupMode] = useState<GroupMode>('category');
  const [showLibrary, setShowLibrary] = useState(false);
  const [showLegacyMemoryHelpers, setShowLegacyMemoryHelpers] = useState(false);
  const [openDrawers, setOpenDrawers] = useState<Set<string>>(
    new Set<string>([...CATEGORIES.map((c) => c.id), ...KIND_ORDER]),
  );

  const compactPalette = preferences.compactPalette;
  const showIncompatibleBlocks = preferences.showIncompatibleBlocks;
  const showQuickStart = simpleMode && preferences.showQuickStart;
  const paletteMode = preferences.paletteMode;
  const palettePreset = preferences.palettePreset;
  const helperPadding = compactPalette ? 'p-2.5' : 'p-3';
  const listSpacing = compactPalette ? 'space-y-2.5' : 'space-y-3.5';
  const quickStartGridClass = compactPalette ? 'grid grid-cols-1 gap-2.5' : 'grid grid-cols-1 gap-3';
  const rowPaddingClass = compactPalette ? 'px-2.5 py-1.5' : 'px-3 py-2';

  const toggleDrawer = (id: string) => {
    setOpenDrawers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onDragStart = (e: DragEvent, nodeType: string) => {
    e.dataTransfer.setData('application/langgraph-node', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  };

  const allNodeDefs = useMemo(() => {
    return Object.values(NODE_DEFS).filter((d) => {
      if (!isNodeBackedByRuntime(d.type) || isNodePaletteHiddenByPolicy(d.type)) return false;
      const capability = getNodeCapabilityInfo(d.type, { artifactType, executionProfile, projectMode });
      return simpleMode ? capability.visibleInSimpleMode : capability.visibleInAdvancedMode;
    });
  }, [artifactType, executionProfile, simpleMode]);

  const effectiveGroupMode: GroupMode = simpleMode ? 'category' : groupMode;

  const filteredNodeDefs = useMemo(() => {
    const base = [...allNodeDefs]
      .filter((def) => showIncompatibleBlocks || isNodeCompatibleWithSurface(def.type, { artifactType, executionProfile, projectMode }))
      .filter((def) => matchesPalettePreset(def, palettePreset))
      .filter((def) => paletteMode === 'all' || (paletteMode === 'common' && (COMMON_NODE_TYPES.has(def.type) || matchesPalettePreset(def, 'minimal'))) || (paletteMode === 'quickstart' && SIMPLE_QUICK_START.includes(def.type as typeof SIMPLE_QUICK_START[number])))
      .filter((def) => {
        const meta = getNodeRuntimeMeta(def.type);
        if (showLegacyMemoryHelpers) return true;
        return !meta.legacyHelperSurface;
      })
      .sort((a, b) => {
        const aCompat = isNodeCompatibleWithSurface(a.type, { artifactType, executionProfile, projectMode }) ? 1 : 0;
        const bCompat = isNodeCompatibleWithSurface(b.type, { artifactType, executionProfile, projectMode }) ? 1 : 0;
        if (aCompat !== bCompat) return bCompat - aCompat;
        return a.label.localeCompare(b.label);
      });

    return base;
  }, [allNodeDefs, artifactType, executionProfile, projectMode, paletteMode, palettePreset, showIncompatibleBlocks, showLegacyMemoryHelpers]);

  const grouped = useMemo(() => {
    if (effectiveGroupMode === 'abstraction') {
      return KIND_ORDER.map((kind) => ({
        id: kind,
        label: KIND_LABELS[kind],
        items: filteredNodeDefs.filter((def) => getNodeRuntimeMeta(def.type).kind === kind),
      })).filter((group) => group.items.length > 0);
    }

    return CATEGORIES.map((cat) => ({
      id: cat.id,
      label: cat.label,
      icon: cat.icon,
      items: filteredNodeDefs.filter((def) => def.category === cat.id),
    })).filter((group) => group.items.length > 0);
  }, [filteredNodeDefs, effectiveGroupMode]);

  const visibleBlockCount = filteredNodeDefs.length;

  const hiddenLegacyMemoryHelperCount = useMemo(() => {
    if (showLegacyMemoryHelpers) return 0;
    return allNodeDefs.filter((def) => Boolean(getNodeRuntimeMeta(def.type).legacyHelperSurface)).length;
  }, [allNodeDefs, showLegacyMemoryHelpers]);

  const showQuickStartCards = simpleMode && (preferences.showQuickStart || paletteMode === 'quickstart');
  const shouldRenderGroupedList = !(simpleMode && paletteMode === 'quickstart');

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-panel-border shrink-0">
        <div className="flex items-center gap-2">
          <LayoutGrid size={13} className="text-violet-400" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {simpleMode ? 'Palette' : 'Composants'}
            </span>
            <span className="text-[9px] text-slate-600">
              {simpleMode ? 'Insertion rapide et palette' : 'Bibliothèque et blocs'}
            </span>
          </div>
        </div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wide">
          {simpleMode ? `${paletteMode === 'quickstart' ? 'Quickstart' : paletteMode === 'common' ? 'Common' : 'All'} · ${visibleBlockCount}` : `${artifactType} · ${executionProfile}`}
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto p-2 scrollbar-thin ${listSpacing}`}>
        {hiddenLegacyMemoryHelperCount > 0 && (
          <div className={`rounded-lg border border-amber-500/20 bg-amber-500/5 ${helperPadding} space-y-2`}>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-amber-200">Helpers mémoire legacy masqués par défaut</div>
                <div className="text-[10px] leading-5 text-slate-400">
                  Pour éviter de noyer l’utilisateur dans des surfaces mémoire qui se recouvrent, les helpers legacy sont cachés tant que tu n’ouvres pas explicitement cette couche. La surface recommandée est <code>memory_access</code> pour la lecture et <code>store_put</code> pour l’écriture bornée.
                </div>
              </div>
              <button
                onClick={() => setShowLegacyMemoryHelpers(true)}
                className="shrink-0 px-2 py-1 rounded border border-amber-500/20 text-[10px] text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 transition-all"
              >
                Afficher ({hiddenLegacyMemoryHelperCount})
              </button>
            </div>
          </div>
        )}
        {simpleMode ? (
          <div className={`rounded-lg border border-panel-border bg-black/10 ${helperPadding} space-y-3.5`}>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-400">
                  <Sparkles size={11} className="text-blue-300" />
                  <span>Vue rapide</span>
                </div>
                <div className="text-[10px] leading-none text-slate-500">{visibleBlockCount} blocs</div>
              </div>
              <p className="text-[10px] leading-5 text-slate-500 pr-1">Quickstart d'abord, puis Common ou All si tu as besoin d'ouvrir davantage la palette.</p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Portée</div>
                <div className="flex rounded-lg border border-panel-border bg-black/20 p-0.5 w-full">
                  <button
                    onClick={() => updatePreferences({ paletteMode: 'quickstart' })}
                    className={`flex-1 px-2.5 py-1.5 rounded-md text-[11px] transition-all ${paletteMode === 'quickstart' ? 'bg-blue-500/15 text-blue-300' : 'text-slate-400 hover:text-white hover:bg-panel-hover'}`}
                  >
                    Quickstart
                  </button>
                  <button
                    onClick={() => updatePreferences({ paletteMode: 'common' })}
                    className={`flex-1 px-2.5 py-1.5 rounded-md text-[11px] transition-all ${paletteMode === 'common' ? 'bg-blue-500/15 text-blue-300' : 'text-slate-400 hover:text-white hover:bg-panel-hover'}`}
                  >
                    Common
                  </button>
                  <button
                    onClick={() => updatePreferences({ paletteMode: 'all' })}
                    className={`flex-1 px-2.5 py-1.5 rounded-md text-[11px] transition-all ${paletteMode === 'all' ? 'bg-blue-500/15 text-blue-300' : 'text-slate-400 hover:text-white hover:bg-panel-hover'}`}
                  >
                    All
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="grid grid-cols-[auto,1fr] items-center gap-2 text-[11px] text-slate-400">
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">Preset</span>
                  <select
                    value={palettePreset}
                    onChange={(e) => updatePreferences({ palettePreset: e.target.value as typeof palettePreset })}
                    className="min-w-0 bg-black/20 border border-panel-border rounded-md px-2 py-1.5 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                  >
                    <option value="minimal">Minimal</option>
                    <option value="graph">Graph</option>
                    <option value="memory_rag">Mémoire / RAG</option>
                    <option value="debug">Debug</option>
                    <option value="advanced">Avancé</option>
                  </select>
                </label>
                <p className="text-[10px] leading-5 text-slate-500 pr-1">{paletteMode === 'quickstart' ? 'Le preset affine surtout les vues Common et All.' : PRESET_HELP[palettePreset]}</p>
              </div>

              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Compatibilité</div>
                <button
                  onClick={() => updatePreferences({ showIncompatibleBlocks: !showIncompatibleBlocks })}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-[11px] border transition-all text-left ${showIncompatibleBlocks ? 'border-amber-500/40 text-amber-300 bg-amber-500/10' : 'border-panel-border text-slate-400 hover:bg-panel-hover'}`}
                  title="Show blocks that are less natural for the current surface"
                >
                  {showIncompatibleBlocks ? 'Toutes surfaces' : "Compatibles d'abord"}
                </button>
                <p className="text-[10px] leading-5 text-slate-500 pr-1">Affiche surtout les blocs naturels pour la surface courante, ou ouvre la vanne plus large.</p>
              </div>
            </div>

            {showQuickStartCards && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Quickstart</div>
                  <div className="text-[10px] text-slate-600">insertion directe</div>
                </div>
                <div className={quickStartGridClass}>
                  {SIMPLE_QUICK_START.map((nodeType) => (
                    <QuickInsertButton key={nodeType} nodeType={nodeType} />
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowLibrary((v) => !v)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-panel-border text-[11px] text-slate-300 hover:bg-panel-hover transition-all"
            >
              <LibraryBig size={12} className="text-slate-400" />
              <span className="flex-1 text-left">Artifact library</span>
              {showLibrary ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            <div className="rounded-lg border border-panel-border bg-black/20 px-2.5 py-2 text-[10px] leading-5 text-slate-400" data-testid="palette-library-boundary">
              La palette insère des <strong>blocs</strong> sur le canvas. L'Artifact library ouvre des <strong>artefacts sauvegardés</strong> comme starters, wrappers ou briques réutilisables. La <strong>Subagent Library</strong> du panneau d'état configure des groupes de sous-agents bornés. Ces surfaces voisines n'équivalent pas encore à une <strong>module library</strong> générale avec chargement par catégorie.
            </div>
            <div className="rounded-lg border border-panel-border bg-black/10 px-2.5 py-2 text-[10px] leading-5 text-slate-500" data-testid="prompt-surface-boundary">
              Le bloc <code>prompt_template</code> et les champs <code>system_prompt</code> restent des surfaces d'auteur locales. Ils n'implémentent pas encore un <strong>prompt-strip panel</strong> dédié avec assignation centrale.
            </div>
            {showLibrary && (
              <div className="rounded-lg border border-panel-border overflow-hidden bg-black/20">
                <ArtifactLibrarySection />
              </div>
            )}
          </div>
        ) : (
          <>
            <button
              onClick={() => setShowLibrary((v) => !v)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-panel-border text-[11px] text-slate-300 hover:bg-panel-hover transition-all"
            >
              <LibraryBig size={12} className="text-slate-400" />
              <span className="flex-1 text-left">Bibliothèque & starters</span>
              {showLibrary ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            <div className="rounded-lg border border-panel-border bg-black/20 px-2.5 py-2 text-[10px] leading-5 text-slate-400" data-testid="palette-library-boundary">
              La palette expose des <strong>blocs</strong> compatibles avec la surface courante. La bibliothèque d'artefacts ouvre des <strong>artefacts sauvegardés</strong>. La <strong>Subagent Library</strong> reste un registre borné de sous-agents. Ensemble, ces surfaces n'équivalent pas encore à une <strong>module library</strong> générale avec chargement par catégorie ou extensibilité arbitraire.
            </div>
            <div className="rounded-lg border border-panel-border bg-black/10 px-2.5 py-2 text-[10px] leading-5 text-slate-500" data-testid="prompt-surface-boundary">
              Les nœuds de prompt et les champs <code>system_prompt</code> restent des paramètres locaux au graphe ou au sous-agent. Ils ne forment pas encore un <strong>prompt-strip panel</strong> dédié avec assignation centrale.
            </div>
            {showLibrary && (
              <div className="rounded-lg border border-panel-border overflow-hidden bg-black/10">
                <ArtifactLibrarySection />
              </div>
            )}

            <div className={`rounded-lg border border-panel-border bg-black/10 ${helperPadding} space-y-3`}>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-500">
                  <Filter size={11} />
                  <span>Vue du catalogue</span>
                </div>
                <p className="text-[10px] leading-5 text-slate-500">Catégories = angle de lecture. Abstraction = regroupement produit, pas promesse d'un runtime séparé.</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setGroupMode('category')}
                    className={`px-2 py-1 rounded text-[11px] border transition-all ${groupMode === 'category' ? 'border-blue-500/40 text-blue-300 bg-blue-500/10' : 'border-panel-border text-slate-400 hover:bg-panel-hover'}`}
                  >
                    By category
                  </button>
                  <button
                    onClick={() => setGroupMode('abstraction')}
                    className={`px-2 py-1 rounded text-[11px] border transition-all ${groupMode === 'abstraction' ? 'border-violet-500/40 text-violet-300 bg-violet-500/10' : 'border-panel-border text-slate-400 hover:bg-panel-hover'}`}
                  >
                    By abstraction
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => updatePreferences({ paletteMode: 'quickstart' })}
                      className={`px-2 py-1 rounded text-[11px] border transition-all ${paletteMode === 'quickstart' ? 'border-blue-500/40 text-blue-300 bg-blue-500/10' : 'border-panel-border text-slate-400 hover:bg-panel-hover'}`}
                    >
                      Quickstart
                    </button>
                    <button
                      onClick={() => updatePreferences({ paletteMode: 'common' })}
                      className={`px-2 py-1 rounded text-[11px] border transition-all ${paletteMode === 'common' ? 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10' : 'border-panel-border text-slate-400 hover:bg-panel-hover'}`}
                    >
                      Courants
                    </button>
                    <button
                      onClick={() => updatePreferences({ paletteMode: 'all' })}
                      className={`px-2 py-1 rounded text-[11px] border transition-all ${paletteMode === 'all' ? 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10' : 'border-panel-border text-slate-400 hover:bg-panel-hover'}`}
                    >
                      Tous
                    </button>
                  </div>
                  <button
                    onClick={() => updatePreferences({ showIncompatibleBlocks: !showIncompatibleBlocks })}
                    className={`px-2 py-1 rounded text-[11px] border transition-all ${showIncompatibleBlocks ? 'border-amber-500/40 text-amber-300 bg-amber-500/10' : 'border-panel-border text-slate-400 hover:bg-panel-hover'}`}
                  >
                    {showIncompatibleBlocks ? 'Toutes surfaces' : "Compatibles d'abord"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {shouldRenderGroupedList && grouped.map((group) => {
          const isOpen = openDrawers.has(group.id);
          const GroupIcon = 'icon' in group && group.icon ? group.icon : Shapes;
          return (
            <div key={group.id}>
              <button
                onClick={() => toggleDrawer(group.id)}
                className={`w-full flex items-center gap-2 rounded-lg text-slate-300 hover:bg-panel-hover transition-all text-sm font-medium ${rowPaddingClass}`}
              >
                <GroupIcon size={14} className="text-slate-500" />
                <span className="flex-1 text-left">{group.label}</span>
                <span className="text-[10px] text-slate-500">{group.items.length}</span>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {isOpen && (
                <div className="ml-2 space-y-1 mt-1 animate-fade-in">
                  {group.items.map((def) => {
                    const NodeIcon = def.icon;
                    const meta = getNodeRuntimeMeta(def.type);
                    const capability = getNodeCapabilityInfo(def.type, { artifactType, executionProfile });
                    const maturity = inferNodeMaturity(def.type, { artifactType, executionProfile });
                    const compatible = isNodeCompatibleWithSurface(def.type, { artifactType, executionProfile });
                    const paletteTruthChips = [
                      meta.providerLabel,
                      meta.toolFamilyLabel,
                      meta.toolProvisioningModel === 'author_linked' ? 'author-wired' : null,
                      meta.toolSelectionAuthority === 'bounded_model_choice' ? 'bounded-choice' : null,
                      meta.toolProvisioningModel === 'explicit_step' ? 'explicit-step' : null,
                      meta.sessionBacked ? 'session' : null,
                      meta.permissionLevel ? meta.permissionLevel.replace(/_/g, '-') : null,
                      meta.configRequired ? 'config' : null,
                    ].filter(Boolean) as string[];
                    return (
                      <div
                        key={def.type}
                        className={`sidebar-item ${compatible ? '' : 'opacity-70'}`}
                        draggable
                        onDragStart={(e) => onDragStart(e, def.type)}
                      >
                        <div className="sidebar-item-icon" style={{ background: def.color + '22', color: def.color }}>
                          <NodeIcon size={13} />
                        </div>
                        <div className="sidebar-item-content">
                          <div className="sidebar-item-label-row">
                            <span className="sidebar-item-label" data-testid={`palette-item-${def.type}`}>{def.label}</span>
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                type="button"
                                title="Inspect capability"
                                data-testid={`palette-inspect-${def.type}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setCapabilityInspectorTarget({ source: 'catalog', nodeType: def.type });
                                }}
                                className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all"
                              >
                                <Info size={11} />
                              </button>
                              {!simpleMode && (
                                <div className="flex flex-wrap gap-1 justify-end">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] border ${KIND_BADGE_CLASSES[meta.kind]}`}>{KIND_LABELS[meta.kind]}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] border ${ORIGIN_BADGE_CLASSES[meta.origin]}`}>{ORIGIN_LABELS[meta.origin]}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] border ${SURFACE_BADGE_CLASSES[capability.surfaceLevel]}`}>{SURFACE_LABELS[capability.surfaceLevel]}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] border ${MATURITY_BADGE_CLASSES[maturity]}`}>{MATURITY_LABELS[maturity]}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] border ${RAIL_BADGE_CLASSES[capability.rail]}`}>{RAIL_LABELS[capability.rail].replace('Rail 0 · ', '').replace('Rail 1 · ', '').replace('Rail 2 · ', '').replace('Rail 3 · ', '').replace('Rail 4 · ', '')}</span>
                                  <span data-testid={`palette-support-${def.type}`} className={`px-1.5 py-0.5 rounded text-[9px] border ${SUPPORT_STATUS_BADGE_CLASSES[capability.supportStatus]}`}>{SUPPORT_STATUS_LABELS[capability.supportStatus]}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="sidebar-item-description">
                            {meta.summary || def.category}
                            {!compatible && <span className="text-amber-300"> · less natural here</span>}
                            {capability.trunkDependent && !simpleMode && <span className="text-slate-500"> · trunk-dependent</span>}
                            {capability.adapterBacked && !simpleMode && <span className="text-slate-500"> · adapter-backed</span>}
                            {!simpleMode && <span className="text-slate-500"> · {SUPPORT_STATUS_LABELS[capability.supportStatus].toLowerCase()}</span>}
                          </div>
                          {paletteTruthChips.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {paletteTruthChips.map((chip) => (
                                <span key={chip} className="px-1.5 py-0.5 rounded text-[9px] border border-panel-border text-slate-400 bg-black/20">{chip}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
