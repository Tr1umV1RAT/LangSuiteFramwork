import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Sparkles, Castle, Users, Dice5, X, PlayCircle, Wrench } from 'lucide-react';
import {
  buildTabletopCatalogFromRuntimeSettings,
  getDefaultTabletopCatalog,
  getDefaultTabletopSelection,
  type TabletopCatalog,
  type TabletopStarterSelection,
} from '../store/tabletopStarter';
import type { RuntimeSettings } from '../store/types';

interface TabletopStarterDialogProps {
  open: boolean;
  onClose: () => void;
  onLaunch: (selection: TabletopStarterSelection) => void;
  runtimeSettings?: Partial<RuntimeSettings> | null;
}

function OptionCard<T extends string>({
  selected,
  label,
  description,
  onClick,
  icon,
}: {
  selected: boolean;
  label: string;
  description: string;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition-all ${selected ? 'border-fuchsia-500/30 bg-fuchsia-500/12 shadow-lg shadow-fuchsia-950/20' : 'border-panel-border bg-black/20 hover:bg-panel-hover'}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-lg border p-2 ${selected ? 'border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-200' : 'border-panel-border bg-black/20 text-slate-400'}`}>
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium text-slate-100">{label}</div>
          <div className="mt-1 text-[11px] leading-5 text-slate-400">{description}</div>
        </div>
      </div>
    </button>
  );
}

function buildDialogCatalog(runtimeSettings?: Partial<RuntimeSettings> | null): TabletopCatalog {
  if (!runtimeSettings) return getDefaultTabletopCatalog();
  return buildTabletopCatalogFromRuntimeSettings(runtimeSettings);
}

export default function TabletopStarterDialog({ open, onClose, onLaunch, runtimeSettings }: TabletopStarterDialogProps) {
  const catalog = useMemo(() => buildDialogCatalog(runtimeSettings), [runtimeSettings]);
  const [selection, setSelection] = useState<TabletopStarterSelection>(getDefaultTabletopSelection(catalog));

  useEffect(() => {
    if (!open) return;
    setSelection(getDefaultTabletopSelection(catalog));
  }, [open, catalog]);

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
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm" data-testid="tabletop-starter-dialog">
      <div className="w-full max-w-5xl rounded-2xl border border-panel-border bg-[#0f1320]/95 shadow-2xl shadow-black/50 overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-panel-border px-5 py-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-fuchsia-200">
              <Sparkles size={12} />
              Guided session setup
            </div>
            <h2 className="mt-3 text-xl font-semibold text-slate-100">Assemble a tabletop session</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Choose a setting, cast, rules stance, and tone. LangSuite will open a standard editable LangGraph session with the matching world,
              rules, persona/cast, and utility packs composed from the bounded module library.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-panel-border bg-black/20 p-2 text-slate-400 hover:bg-panel-hover hover:text-white transition-all" aria-label="Close tabletop setup">
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-5 px-5 py-5 lg:grid-cols-[1.2fr,1.2fr,1fr] max-h-[78vh] overflow-auto">
          <div className="space-y-5">
            <section>
              <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">1. Choose a setting pack</div>
              <div className="grid gap-2">
                {catalog.settings.map((option) => (
                  <OptionCard
                    key={option.id}
                    selected={selection.settingId === option.id}
                    label={option.label}
                    description={option.description}
                    onClick={() => setSelection((current) => ({ ...current, settingId: option.id }))}
                    icon={<Castle size={16} />}
                  />
                ))}
              </div>
            </section>

            <section>
              <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">2. Choose a cast pack</div>
              <div className="grid gap-2">
                {catalog.casts.map((option) => (
                  <OptionCard
                    key={option.id}
                    selected={selection.castId === option.id}
                    label={option.label}
                    description={option.description}
                    onClick={() => setSelection((current) => ({ ...current, castId: option.id }))}
                    icon={<Users size={16} />}
                  />
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section>
              <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">3. Choose a rules pack</div>
              <div className="grid gap-2">
                {catalog.rules.map((option) => (
                  <OptionCard
                    key={option.id}
                    selected={selection.rulesId === option.id}
                    label={option.label}
                    description={option.description}
                    onClick={() => setSelection((current) => ({ ...current, rulesId: option.id }))}
                    icon={<Dice5 size={16} />}
                  />
                ))}
              </div>
            </section>

            <section>
              <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">4. Choose a tone pack</div>
              <div className="grid gap-2">
                {catalog.tones.map((option) => (
                  <OptionCard
                    key={option.id}
                    selected={selection.toneId === option.id}
                    label={option.label}
                    description={option.description}
                    onClick={() => setSelection((current) => ({ ...current, toneId: option.id }))}
                    icon={<Sparkles size={16} />}
                  />
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section className="rounded-2xl border border-panel-border bg-black/20 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">5. What happens next</div>
              <div className="mt-3 space-y-3 text-[11px] leading-5 text-slate-300">
                <div className="flex gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                  <PlayCircle size={14} className="mt-0.5 shrink-0 text-emerald-300" />
                  <div>
                    <div className="font-medium text-emerald-200">Session ready for editing</div>
                    <div className="text-slate-300/90">The builder opens a normal editable LangGraph session with the selected packs already loaded.</div>
                  </div>
                </div>
                <div className="flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                  <Wrench size={14} className="mt-0.5 shrink-0 text-amber-300" />
                  <div>
                    <div className="font-medium text-amber-200">Runtime setup comes later</div>
                    <div className="text-slate-300/90">Provider, model, environment variables, and local base URLs are intentionally deferred. Configure them only when you are actually ready to click Run.</div>
                  </div>
                </div>
                <div className="rounded-xl border border-panel-border bg-black/10 px-3 py-2 text-slate-400">
                  Session creation stays focused on authoring. Run validation and backend preflight still decide when execution is allowed.
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-panel-border bg-black/20 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Selection summary</div>
              <div className="mt-3 space-y-2 text-[11px] text-slate-300">
                <div><span className="text-slate-500">Setting:</span> {catalog.settings.find((option) => option.id === selection.settingId)?.label}</div>
                <div><span className="text-slate-500">Cast:</span> {catalog.casts.find((option) => option.id === selection.castId)?.label}</div>
                <div><span className="text-slate-500">Rules:</span> {catalog.rules.find((option) => option.id === selection.rulesId)?.label}</div>
                <div><span className="text-slate-500">Tone:</span> {catalog.tones.find((option) => option.id === selection.toneId)?.label}</div>
              </div>
            </section>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-panel-border bg-black/20 px-5 py-4">
          <div className="text-[11px] leading-5 text-slate-500">
            Build the session now. Configure runtime later from the graph or Run panel.
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg border border-panel-border px-3 py-2 text-[11px] text-slate-300 hover:bg-panel-hover transition-all">
              Cancel
            </button>
            <button
              onClick={() => onLaunch(selection)}
              className="rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/15 px-3 py-2 text-[11px] font-medium text-fuchsia-100 hover:bg-fuchsia-500/20 transition-all"
            >
              Create session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
