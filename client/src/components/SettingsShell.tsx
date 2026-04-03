import { useEffect, type ReactNode } from 'react';
import { X, Settings2, Sparkles, RotateCcw, Package } from 'lucide-react';
import {
  useAppStore,
  type EditorMode,
  type PaletteMode,
  type PalettePreset,
  type RunPanelTab,
  type UiDensity,
  type WorkspacePreset,
} from '../store';
import { buildProjectPersistenceSummary } from '../store/workspace';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-panel-border bg-black/20 p-3 space-y-2">
      <div>
        <div className="text-sm text-slate-200">{label}</div>
        {hint && <div className="text-[11px] text-slate-500 mt-1">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, labelOn = 'Enabled', labelOff = 'Disabled' }: { checked: boolean; onChange: (v: boolean) => void; labelOn?: string; labelOff?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-sm transition-all ${checked ? 'border-blue-500/40 bg-blue-500/10 text-blue-300' : 'border-panel-border text-slate-300 hover:bg-panel-hover'}`}
    >
      <span>{checked ? labelOn : labelOff}</span>
      <span className={`w-10 h-5 rounded-full p-0.5 transition-all ${checked ? 'bg-blue-500/30' : 'bg-slate-700/60'}`}>
        <span className={`block w-4 h-4 rounded-full bg-white transition-all ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </span>
    </button>
  );
}

function ChoiceGroup<T extends string>({ value, onChange, options }: { value: T; onChange: (value: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`px-3 py-2 rounded-lg border text-sm transition-all ${value === option.value ? 'border-blue-500/40 bg-blue-500/10 text-blue-300' : 'border-panel-border text-slate-300 hover:bg-panel-hover'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const PRESETS: { value: WorkspacePreset; label: string; hint: string }[] = [
  { value: 'graph_simple', label: 'Graph Simple', hint: 'Compact graph-first editing with a calm palette and restrained metadata.' },
  { value: 'graph_memory', label: 'Graph + Memory', hint: 'Keeps the graph workflow simple while surfacing memory/RAG building blocks earlier.' },
  { value: 'debug_build', label: 'Debug Build', hint: 'Execution-first preset with broader palette exposure and visible technical cues.' },
  { value: 'advanced_authoring', label: 'Advanced Authoring', hint: 'Keeps the richer suite/editor semantics visible for deeper authoring.' },
];

export default function SettingsShell({ open, onClose }: { open: boolean; onClose: () => void }) {
  const preferences = useAppStore((s) => s.preferences);
  const updatePreferences = useAppStore((s) => s.updatePreferences);
  const applyWorkspacePreset = useAppStore((s) => s.applyWorkspacePreset);
  const resetLayout = useAppStore((s) => s.resetLayout);
  const projectPersistence = buildProjectPersistenceSummary();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm flex items-start justify-center p-4">
      <div className="w-full max-w-5xl max-h-[88vh] overflow-hidden rounded-2xl border border-panel-border bg-canvas shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-panel-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-300">
              <Settings2 size={16} />
            </div>
            <div>
              <div className="text-lg font-semibold text-white">Workspace preferences</div>
              <div className="text-[12px] text-slate-500">Persistent defaults for the editor shell — not a mausoleum of internal component switches.</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-panel-hover transition-all"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-auto max-h-[calc(88vh-73px)] p-5 space-y-6">
          <Section title="Workspace presets">
            <div className="md:col-span-2 rounded-xl border border-panel-border bg-black/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <Sparkles size={15} className="text-violet-300" />
                <span>Apply a small opinionated preset</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => applyWorkspacePreset(preset.value)}
                    className="text-left rounded-xl border border-panel-border bg-black/20 p-3 hover:bg-panel-hover transition-all"
                  >
                    <div className="text-sm text-slate-100">{preset.label}</div>
                    <div className="text-[11px] text-slate-500 mt-1">{preset.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          </Section>

          <Section title="General">
            <Field label="Default editor mode" hint="Used as your persistent starting point and applied immediately when changed here.">
              <ChoiceGroup<EditorMode>
                value={preferences.defaultEditorMode}
                onChange={(value) => updatePreferences({ defaultEditorMode: value })}
                options={[
                  { value: 'simple', label: 'Simple' },
                  { value: 'advanced', label: 'Advanced' },
                ]}
              />
            </Field>
            <Field label="Autosave" hint="Persist local edits in DB after changes to an already-saved project.">
              <Toggle checked={preferences.autosaveEnabled} onChange={(value) => updatePreferences({ autosaveEnabled: value })} />
            </Field>
            <Field label="Confirm before close" hint="Adds a small guardrail when a tab still has unsaved changes.">
              <Toggle checked={preferences.confirmBeforeCloseUnsavedWork} onChange={(value) => updatePreferences({ confirmBeforeCloseUnsavedWork: value })} />
            </Field>
          </Section>

          <Section title="Editor">
            <Field label="Minimap">
              <Toggle checked={preferences.showMinimap} onChange={(value) => updatePreferences({ showMinimap: value })} />
            </Field>
            <Field label="Snap to grid">
              <Toggle checked={preferences.snapToGrid} onChange={(value) => updatePreferences({ snapToGrid: value })} />
            </Field>
            <Field label="UI density" hint="Adjusts the global amount of breathing room in the canvas and node chrome.">
              <ChoiceGroup<UiDensity>
                value={preferences.uiDensity}
                onChange={(value) => updatePreferences({ uiDensity: value })}
                options={[
                  { value: 'compact', label: 'Compact' },
                  { value: 'standard', label: 'Standard' },
                  { value: 'comfortable', label: 'Comfortable' },
                ]}
              />
            </Field>
          </Section>

          <Section title="Layout">
            <div className="md:col-span-2 rounded-xl border border-panel-border bg-black/20 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-white">Reset to calm defaults</div>
                <div className="text-[11px] text-slate-500 mt-1">Reopens only the block panel, closes the noisier rails, and restores the quieter width/height defaults from this pass.</div>
              </div>
              <button
                type="button"
                onClick={resetLayout}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-panel-border text-sm text-slate-200 hover:bg-panel-hover transition-all"
              >
                <RotateCcw size={14} />
                Reset layout
              </button>
            </div>
            <Field label="Blocks panel width" hint="Controls the content palette rail. Smaller values keep the canvas breathing instead of eating the top chrome like a greedy goblin.">
              <div className="space-y-2">
                <input
                  type="range"
                  min={180}
                  max={360}
                  step={4}
                  value={preferences.blocksPanelWidth}
                  onChange={(event) => updatePreferences({ blocksPanelWidth: Number(event.target.value) })}
                  className="w-full"
                />
                <div className="text-[11px] text-slate-500">{preferences.blocksPanelWidth}px</div>
              </div>
            </Field>
            <Field label="Debug panel width" hint="Used for the debugger rail when it is open.">
              <div className="space-y-2">
                <input
                  type="range"
                  min={180}
                  max={340}
                  step={4}
                  value={preferences.debugPanelWidth}
                  onChange={(event) => updatePreferences({ debugPanelWidth: Number(event.target.value) })}
                  className="w-full"
                />
                <div className="text-[11px] text-slate-500">{preferences.debugPanelWidth}px</div>
              </div>
            </Field>
            <Field label="State panel width" hint="Controls the variables / state rail.">
              <div className="space-y-2">
                <input
                  type="range"
                  min={200}
                  max={360}
                  step={4}
                  value={preferences.statePanelWidth}
                  onChange={(event) => updatePreferences({ statePanelWidth: Number(event.target.value) })}
                  className="w-full"
                />
                <div className="text-[11px] text-slate-500">{preferences.statePanelWidth}px</div>
              </div>
            </Field>
            <Field label="Run panel height" hint="Persistent default height for the bottom run surface.">
              <div className="space-y-2">
                <input
                  type="range"
                  min={26}
                  max={68}
                  step={1}
                  value={preferences.runPanelHeightPercent}
                  onChange={(event) => updatePreferences({ runPanelHeightPercent: Number(event.target.value) })}
                  className="w-full"
                />
                <div className="text-[11px] text-slate-500">{preferences.runPanelHeightPercent}% of editor height</div>
              </div>
            </Field>
          </Section>

          <Section title="Block Palette">
            <Field label="Quick start" hint="Shows or hides the fast starter strip in simple mode.">
              <Toggle checked={preferences.showQuickStart} onChange={(value) => updatePreferences({ showQuickStart: value })} />
            </Field>
            <Field label="Default palette mode" hint="Quickstart is the lightest default. Common keeps the list lean. All exposes the broader catalog for the current surface.">
              <ChoiceGroup<PaletteMode>
                value={preferences.paletteMode}
                onChange={(value) => updatePreferences({ paletteMode: value })}
                options={[
                  { value: 'quickstart', label: 'Quickstart' },
                  { value: 'common', label: 'Common' },
                  { value: 'all', label: 'All' },
                ]}
              />
            </Field>
            <Field label="Default palette preset" hint="A light preset filter for day-to-day authoring. Advanced leaves the catalog broadly open.">
              <ChoiceGroup<PalettePreset>
                value={preferences.palettePreset}
                onChange={(value) => updatePreferences({ palettePreset: value })}
                options={[
                  { value: 'minimal', label: 'Minimal' },
                  { value: 'graph', label: 'Graph' },
                  { value: 'memory_rag', label: 'Memory / RAG' },
                  { value: 'debug', label: 'Debug' },
                  { value: 'advanced', label: 'Advanced' },
                ]}
              />
            </Field>
            <Field label="Surface vocabulary" hint="Subgraph = child graph tab. Wrapper = node reference to a saved artifact. Abstraction = catalog grouping, not a separate runtime. Tiny ontology, less nonsense.">
              <div className="text-[11px] leading-relaxed text-slate-400">
                The shell stays LangGraph-first. These labels keep the editor honest without over-explaining every runtime nuance inline.
              </div>
            </Field>
            <Field label="Show incompatible blocks" hint="Allows blocks that are less natural for the current surface to remain visible.">
              <Toggle checked={preferences.showIncompatibleBlocks} onChange={(value) => updatePreferences({ showIncompatibleBlocks: value })} labelOn="All visible" labelOff="Compatible only" />
            </Field>
            <Field label="Compact palette" hint="Reduces spacing and card height in the palette.">
              <Toggle checked={preferences.compactPalette} onChange={(value) => updatePreferences({ compactPalette: value })} />
            </Field>
          </Section>

          <Section title="Persistence and export">
            <Field label="Save project in app" hint="Updates the saved project tree in the local app database. Useful for collaboration/session work and the project manager tree.">
              <div className="text-[11px] leading-relaxed text-slate-400">
                This persists the editable workspace structure the app actually knows today: root graph, known child subgraphs, reopening metadata, and saved graph settings.
              </div>
            </Field>
            <Field label="Project package" hint="Portable JSON package for the editable workspace only.">
              <div className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
                <Package size={14} className="mt-0.5 text-blue-300 shrink-0" />
                <span>Export/import packages do not include runtime DB contents, vector stores, or hidden environment snapshots. They are honest workspace packages, not magical freeze-dried universes.</span>
              </div>
            </Field>
            <Field label="Open saved project from app" hint="Rehydrates the saved editable workspace tree from the local app database.">
              <div className="text-[11px] leading-relaxed text-slate-400">
                {projectPersistence.openEffectSummary}
              </div>
            </Field>
            <Field label="Compiled Python export" hint="Separate from save-in-app and separate from project packages.">
              <div className="text-[11px] leading-relaxed text-slate-400">
                Compile produces runnable Python output from the current graph. It is not a full project snapshot and it does not bundle local runtime data stores.
              </div>
            </Field>
          </Section>

          <Section title="Execution">
            <Field label="Default RunPanel tab">
              <ChoiceGroup<RunPanelTab>
                value={preferences.defaultRunPanelTab}
                onChange={(value) => updatePreferences({ defaultRunPanelTab: value })}
                options={[
                  { value: 'inputs', label: 'Inputs' },
                  { value: 'execution', label: 'Execution' },
                  { value: 'json', label: 'JSON' },
                ]}
              />
            </Field>
            <Field label="Show JSON tab">
              <Toggle checked={preferences.showJsonTab} onChange={(value) => updatePreferences({ showJsonTab: value })} />
            </Field>
            <Field label="De-emphasize JSON in simple mode" hint="Keeps the raw graph payload available, but visually frames it as an advanced/debug view.">
              <Toggle checked={preferences.deEmphasizeJsonInSimpleMode} onChange={(value) => updatePreferences({ deEmphasizeJsonInSimpleMode: value })} />
            </Field>
            <Field label="Auto-scroll logs">
              <Toggle checked={preferences.autoScrollLogs} onChange={(value) => updatePreferences({ autoScrollLogs: value })} />
            </Field>
          </Section>

          <Section title="Appearance">
            <Field label="Reduce technical badges in simple mode" hint="Keeps tabs and nodes quieter on the graph-first path.">
              <Toggle checked={preferences.reducedTechnicalBadgesInSimpleMode} onChange={(value) => updatePreferences({ reducedTechnicalBadgesInSimpleMode: value })} />
            </Field>
            <Field label="Show artifact badges in simple mode">
              <Toggle checked={preferences.showArtifactBadgesInSimpleMode} onChange={(value) => updatePreferences({ showArtifactBadgesInSimpleMode: value })} />
            </Field>
            <Field label="Show scopePath in simple mode">
              <Toggle checked={preferences.showScopePathInSimpleMode} onChange={(value) => updatePreferences({ showScopePathInSimpleMode: value })} />
            </Field>
          </Section>
        </div>
      </div>
    </div>
  );
}
