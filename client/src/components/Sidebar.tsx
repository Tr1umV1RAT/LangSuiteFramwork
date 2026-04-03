import { type DragEvent } from 'react';
import { useAppStore } from '../store';
import { getNodeRuntimeMeta } from '../catalog';
import { NODE_DEFS, CATEGORIES } from '../nodeConfig';
import {
  PanelLeftClose,
  PanelRightClose,
  ChevronDown,
  ChevronRight,
  ArrowLeftRight,
} from 'lucide-react';
import { useState } from 'react';

export default function Sidebar() {
  const { sidebarOpen, sidebarPosition, toggleSidebar, setSidebarPosition } = useAppStore();
  const [openDrawers, setOpenDrawers] = useState<Set<string>>(
    new Set(CATEGORIES.map((c) => c.id)),
  );
  const [showLegacyMemoryHelpers, setShowLegacyMemoryHelpers] = useState(false);

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

  const isLeft = sidebarPosition === 'left';
  const CloseIcon = isLeft ? PanelLeftClose : PanelRightClose;

  if (!sidebarOpen) {
    return (
      <button
        onClick={toggleSidebar}
        className={`fixed top-16 ${isLeft ? 'left-3' : 'right-3'} z-30
          w-10 h-10 rounded-lg glass border border-panel-border
          flex items-center justify-center text-slate-400
          hover:text-white hover:border-accent-blue transition-all`}
        title="Ouvrir le panneau"
      >
        {isLeft ? <PanelRightClose size={18} /> : <PanelLeftClose size={18} />}
      </button>
    );
  }

  return (
    <div
      className={`fixed top-12 ${isLeft ? 'left-0' : 'right-0'} z-20
        w-64 h-[calc(100%-48px)] glass border-panel-border flex flex-col
        ${isLeft ? 'border-r animate-slide-in-left' : 'border-l animate-slide-in-right'}`}
    >
      <div className="flex items-center justify-between p-3 border-b border-panel-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Composants
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSidebarPosition(isLeft ? 'right' : 'left')}
            className="w-7 h-7 rounded-md flex items-center justify-center
              text-slate-500 hover:text-white hover:bg-panel-hover transition-all"
            title="Changer de côté"
          >
            <ArrowLeftRight size={14} />
          </button>
          <button
            onClick={toggleSidebar}
            className="w-7 h-7 rounded-md flex items-center justify-center
              text-slate-500 hover:text-white hover:bg-panel-hover transition-all"
            title="Fermer"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {!showLegacyMemoryHelpers && Object.values(NODE_DEFS).some((d) => getNodeRuntimeMeta(d.type).legacyHelperSurface) && (
          <div className="mx-1 mb-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[10px] text-slate-400 leading-5">
            Les helpers mémoire legacy sont masqués par défaut ici aussi.
            <button onClick={() => setShowLegacyMemoryHelpers(true)} className="ml-2 px-1.5 py-0.5 rounded border border-amber-500/20 text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 transition-all">Afficher</button>
          </div>
        )}
        {CATEGORIES.map((cat) => {
          const items = Object.values(NODE_DEFS).filter((d) => d.category === cat.id).filter((d) => showLegacyMemoryHelpers || !getNodeRuntimeMeta(d.type).legacyHelperSurface);
          if (items.length === 0) return null;
          const isOpen = openDrawers.has(cat.id);
          const CatIcon = cat.icon;
          return (
            <div key={cat.id}>
              <button
                onClick={() => toggleDrawer(cat.id)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg
                  text-slate-300 hover:bg-panel-hover transition-all text-sm font-medium"
              >
                <CatIcon size={14} className="text-slate-500" />
                <span className="flex-1 text-left">{cat.label}</span>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {isOpen && (
                <div className="ml-2 space-y-1 mt-1 animate-fade-in">
                  {items.map((def) => {
                    const NodeIcon = def.icon;
                    return (
                      <div
                        key={def.type}
                        className="sidebar-item"
                        draggable
                        onDragStart={(e) => onDragStart(e, def.type)}
                      >
                        <div
                          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{ background: def.color + '22', color: def.color }}
                        >
                          <NodeIcon size={14} />
                        </div>
                        <span className="text-sm text-slate-300">{def.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
