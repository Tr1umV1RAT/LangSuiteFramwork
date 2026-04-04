import { X, ExternalLink, Layers3 } from 'lucide-react';
import { useMemo } from 'react';
import { useAppStore } from '../store';
import { applyModuleDefinitionToRuntimeSettings } from '../store/workspace';
import type { ModuleLibraryCategory, ModuleLibraryEntry } from '../store/types';

interface TabletopModuleBrowserProps {
  open: boolean;
  onClose: () => void;
  onOpenStarter: (artifactKind: string, artifactId: string) => void;
}

const CATEGORY_ORDER: ModuleLibraryCategory[] = ['world', 'rules', 'persona', 'party', 'utility', 'mixed'];

function groupByCategory(entries: ModuleLibraryEntry[]): Array<{ category: ModuleLibraryCategory; entries: ModuleLibraryEntry[] }> {
  return CATEGORY_ORDER.map((category) => ({
    category,
    entries: entries.filter((entry) => entry.category === category).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((section) => section.entries.length > 0);
}

export default function TabletopModuleBrowser({ open, onClose, onOpenStarter }: TabletopModuleBrowserProps) {
  const activeTab = useAppStore((s) => s.tabs.find((tab) => tab.id === s.activeTabId) || null);
  const activeTabId = activeTab?.id || null;
  const updateRuntimeSettings = useAppStore((s) => s.updateRuntimeSettings);
  const runtimeSettings = activeTab?.runtimeSettings || null;
  const loadedIds = new Set(runtimeSettings?.loadedModuleIds || []);
  const grouped = useMemo(() => groupByCategory(runtimeSettings?.moduleLibrary || []), [runtimeSettings]);

  if (!open) return null;

  const handleLoad = (entry: ModuleLibraryEntry) => {
    if (!runtimeSettings) return;
    if (loadedIds.has(entry.id)) return;
    const next = applyModuleDefinitionToRuntimeSettings(runtimeSettings, entry, { tabId: activeTabId || 'active_tab' });
    updateRuntimeSettings(next);
  };

  return (
    <div className="fixed inset-0 z-[71] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl max-h-[88vh] overflow-hidden rounded-2xl border border-panel-border bg-[#0f1320]/95 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4 border-b border-panel-border px-5 py-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-fuchsia-200"><Layers3 size={12} />Tabletop modules</div>
            <h2 className="mt-3 text-xl font-semibold text-slate-100">Module library</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">JDR stays module-driven here: world, rules, persona, party, and utility packs remain bounded authoring bundles on the shared rails.</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-panel-border bg-black/20 p-2 text-slate-400 hover:bg-panel-hover hover:text-white transition-all" aria-label="Close module browser">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[calc(88vh-80px)] overflow-auto px-5 py-5 space-y-5">
          {grouped.length === 0 && <div className="rounded-xl border border-panel-border bg-black/20 px-4 py-3 text-sm text-slate-400">No bounded module library is loaded on the active tab.</div>}
          {grouped.map((section) => (
            <section key={section.category} className="space-y-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{section.category}</div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {section.entries.map((entry) => {
                  const loaded = loadedIds.has(entry.id);
                  return (
                    <div key={entry.id} className="rounded-2xl border border-panel-border bg-black/20 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-slate-100">{entry.name}</div>
                          <div className="mt-1 text-[11px] leading-5 text-slate-400">{entry.description || entry.compatibilityNotes || 'Branch overlay module.'}</div>
                        </div>
                        <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide ${loaded ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-panel-border bg-black/20 text-slate-400'}`}>{loaded ? 'loaded' : 'available'}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 text-[10px] text-slate-300">
                        <span className="rounded-full border border-panel-border bg-black/20 px-2 py-1">{entry.lineage}</span>
                        {(entry.branchTargets || []).map((target) => <span key={target} className="rounded-full border border-panel-border bg-black/20 px-2 py-1">{target}</span>)}
                        {(entry.themeHints || []).map((hint) => <span key={hint} className="rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 px-2 py-1 text-fuchsia-100">{hint}</span>)}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                        <div>Prompt strips: <span className="text-slate-200">{entry.promptStrips.length}</span></div>
                        <div>Subagent groups: <span className="text-slate-200">{entry.subagentGroups.length}</span></div>
                      </div>
                      {entry.runtimeContext.length > 0 && (
                        <div className="rounded-xl border border-panel-border bg-black/10 px-3 py-2 text-[10px] leading-5 text-slate-400">
                          {entry.runtimeContext.map((item) => <div key={`${entry.id}:${item.key}`}>{item.key}: <span className="text-slate-300">{item.value}</span></div>)}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {!loaded && (
                          <button onClick={() => handleLoad(entry)} className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/10 px-3 py-2 text-[11px] font-medium text-fuchsia-100 hover:bg-fuchsia-500/20 transition-all">
                            Load module
                          </button>
                        )}
                        {(entry.starterArtifacts || []).map((starter) => (
                          <button
                            key={`${entry.id}:${starter.artifactKind}:${starter.artifactId}`}
                            onClick={() => onOpenStarter(starter.artifactKind, starter.artifactId)}
                            className="rounded-lg border border-panel-border bg-black/20 px-3 py-2 text-[11px] text-slate-300 hover:bg-panel-hover transition-all"
                          >
                            <span className="inline-flex items-center gap-1">{starter.label || 'Open starter'} <ExternalLink size={12} /></span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
