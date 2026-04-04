import { X, Download } from 'lucide-react';
import { useMemo } from 'react';
import { buildObsidianGraph } from '../jdr/obsidianGraph';
import type { RuntimeSettings } from '../store/types';

interface ObsidianGraphPanelProps {
  open: boolean;
  onClose: () => void;
  runtimeSettings?: RuntimeSettings | null;
  graphName?: string | null;
  onExportVault?: (() => void) | null;
}

function nodeClasses(group: string): string {
  switch (group) {
    case 'hub':
      return 'border-cyan-500/20 bg-cyan-500/10 text-cyan-100';
    case 'scene':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100';
    case 'module':
      return 'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-100';
    case 'prompt':
      return 'border-violet-500/20 bg-violet-500/10 text-violet-100';
    case 'cast':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-100';
    default:
      return 'border-panel-border bg-black/30 text-slate-200';
  }
}

export default function ObsidianGraphPanel({ open, onClose, runtimeSettings, graphName, onExportVault }: ObsidianGraphPanelProps) {
  const graph = useMemo(() => buildObsidianGraph(runtimeSettings, graphName || 'Tabletop Session'), [runtimeSettings, graphName]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[92vw] max-h-[88vh] overflow-hidden rounded-2xl border border-panel-border bg-[#0f1320]/95 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4 border-b border-panel-border px-5 py-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-cyan-200">Obsidian companion graph</div>
            <h2 className="mt-3 text-xl font-semibold text-slate-100">Linked note map</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Graph-powered tabletop notes rendered as a bounded Obsidian companion view. The runtime graph remains the source of truth.</p>
          </div>
          <div className="flex items-center gap-2">
            {onExportVault && (
              <button onClick={onExportVault} className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-[11px] font-medium text-cyan-100 hover:bg-cyan-500/20 transition-all">
                <span className="inline-flex items-center gap-1"><Download size={14} />Export vault</span>
              </button>
            )}
            <button onClick={onClose} className="rounded-lg border border-panel-border bg-black/20 p-2 text-slate-400 hover:bg-panel-hover hover:text-white transition-all" aria-label="Close Obsidian graph">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="max-h-[calc(88vh-80px)] overflow-auto bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_40%),radial-gradient(circle_at_bottom,_rgba(217,70,239,0.08),_transparent_35%)]">
          <div className="relative" style={{ width: graph.width, height: graph.height }}>
            <svg className="absolute inset-0" width={graph.width} height={graph.height}>
              {graph.edges.map((edge) => {
                const source = graph.nodes.find((node) => node.id === edge.source);
                const target = graph.nodes.find((node) => node.id === edge.target);
                if (!source || !target) return null;
                return (
                  <line
                    key={`${edge.source}-${edge.target}`}
                    x1={source.x + 84}
                    y1={source.y + 48}
                    x2={target.x + 84}
                    y2={target.y + 20}
                    stroke="rgba(148, 163, 184, 0.32)"
                    strokeWidth="1.5"
                  />
                );
              })}
            </svg>
            {graph.nodes.map((node) => (
              <div
                key={node.id}
                className={`absolute w-40 rounded-xl border px-3 py-2 shadow-lg shadow-black/25 backdrop-blur-sm ${nodeClasses(node.group)}`}
                style={{ left: node.x, top: node.y }}
              >
                <div className="text-[11px] font-medium leading-5">{node.label}</div>
                <div className="mt-1 text-[10px] leading-4 opacity-80">{node.path}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
