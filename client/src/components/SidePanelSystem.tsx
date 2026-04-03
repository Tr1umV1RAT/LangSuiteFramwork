import { useRef, useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../store';
import { Bug, Database, LayoutGrid } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import DebugPanelContent from './DebugPanelContent';
import StatePanelContent from './StatePanelContent';
import BlocksPanelContent from './BlocksPanelContent';

type PanelId = 'blocks' | 'debug' | 'state';

function getPanelDefs(editorMode: 'simple' | 'advanced'): {
  id: PanelId;
  icon: LucideIcon;
  label: string;
}[] {
  return [
    { id: 'blocks', icon: LayoutGrid, label: editorMode === 'simple' ? 'Blocs' : 'Composants' },
    { id: 'debug', icon: Bug, label: 'Debugger' },
    { id: 'state', icon: Database, label: editorMode === 'simple' ? 'Variables' : 'État & Scope' },
  ];
}

const DRAG_THRESHOLD = 8;
const APP_TOP_OFFSET = 88;

function getPanelWidth(id: PanelId, preferences: ReturnType<typeof useAppStore.getState>['preferences']): number {
  if (id === 'debug') return preferences.debugPanelWidth;
  if (id === 'state') return preferences.statePanelWidth;
  return preferences.blocksPanelWidth;
}

function PanelContent({ id }: { id: PanelId }) {
  if (id === 'blocks') return <BlocksPanelContent />;
  if (id === 'debug') return <DebugPanelContent />;
  if (id === 'state') return <StatePanelContent />;
  return null;
}

export default function SidePanelSystem() {
  const panelPlacements = useAppStore((s) => s.panelPlacements);
  const editorMode = useAppStore((s) => s.editorMode);
  const togglePanel = useAppStore((s) => s.togglePanel);
  const setPanelSide = useAppStore((s) => s.setPanelSide);
  const preferences = useAppStore((s) => s.preferences);
  const runLogs = useAppStore((s) => s.runLogs);
  const isRunning = useAppStore((s) => s.isRunning);
  const isPaused = useAppStore((s) => s.isPaused);

  const [dragging, setDragging] = useState<PanelId | null>(null);
  const [isDraggingActive, setIsDraggingActive] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [dropSide, setDropSide] = useState<'left' | 'right' | null>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const [openOrder, setOpenOrder] = useState<PanelId[]>(['blocks']);

  const panelDefs = getPanelDefs(editorMode);
  const hasErrors = runLogs.some((l) => l.type === 'error');
  const isActive = isRunning || isPaused;

  useEffect(() => {
    setOpenOrder((prev) => {
      const nowOpen = panelDefs.filter((d) => panelPlacements[d.id].open).map((d) => d.id);
      const kept = prev.filter((id) => nowOpen.includes(id));
      const added = nowOpen.filter((id) => !kept.includes(id));
      return [...kept, ...added];
    });
  }, [panelDefs, panelPlacements]);

  const getTabAccent = (id: PanelId, active: boolean) => {
    if (id === 'debug' && hasErrors) {
      return active
        ? 'bg-red-500/25 text-red-300 border-red-500/50'
        : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border-transparent animate-pulse';
    }
    if (id === 'debug' && isActive) {
      return active
        ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50'
        : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-transparent';
    }
    if (id === 'blocks') {
      return active
        ? 'bg-violet-500/20 text-violet-300 border-violet-500/50'
        : 'glass text-slate-500 hover:text-violet-300 hover:bg-panel-hover border-transparent';
    }
    return active
      ? 'bg-blue-500/20 text-blue-300 border-blue-500/50'
      : 'glass text-slate-500 hover:text-slate-300 hover:bg-panel-hover border-transparent';
  };

  const onMouseDown = useCallback((e: React.MouseEvent, id: PanelId) => {
    e.preventDefault();
    startPos.current = { x: e.clientX, y: e.clientY };
    setDragging(id);
    setIsDraggingActive(false);
    setDragX(e.clientX);
    setDragY(e.clientY);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setDragX(e.clientX);
      setDragY(e.clientY);
      const dx = Math.abs(e.clientX - startPos.current.x);
      const dy = Math.abs(e.clientY - startPos.current.y);
      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
        setIsDraggingActive(true);
        const mid = window.innerWidth / 2;
        setDropSide(e.clientX < mid ? 'left' : 'right');
      }
    };
    const onUp = () => {
      if (isDraggingActive && dragging && dropSide) {
        const current = panelPlacements[dragging].side;
        if (current !== dropSide) {
          setPanelSide(dragging, dropSide);
        }
      } else if (dragging && !isDraggingActive) {
        togglePanel(dragging);
      }
      setDragging(null);
      setIsDraggingActive(false);
      setDropSide(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, isDraggingActive, dropSide, panelPlacements, setPanelSide, togglePanel]);

  const buildSide = (side: 'left' | 'right') => {
    const allTabs = panelDefs.filter((d) => panelPlacements[d.id].side === side);
    if (allTabs.length === 0) return null;

    const openTabs = allTabs.filter((d) => panelPlacements[d.id].open);
    const orderedOpen = openOrder
      .filter((id) => openTabs.some((t) => t.id === id))
      .map((id) => panelDefs.find((d) => d.id === id)!);

    const panelWidths = orderedOpen.map((def) => getPanelWidth(def.id, preferences));
    const totalPanelWidth = panelWidths.reduce((acc, width) => acc + width, 0);

    return (
      <div key={side}>
        <div
          className="fixed z-40 flex flex-col gap-1 transition-all duration-200"
          style={{ [side]: totalPanelWidth, top: `calc(${APP_TOP_OFFSET}px + ((100vh - ${APP_TOP_OFFSET}px) / 2))`, transform: 'translateY(-50%)' }}
        >
          {allTabs.map((def) => {
            const Icon = def.icon;
            const isOpen = panelPlacements[def.id].open;
            const isDraggingThis = dragging === def.id && isDraggingActive;
            const roundedClass = side === 'right' ? 'rounded-l-lg border-r-0' : 'rounded-r-lg border-l-0';

            return (
              <div
                key={def.id}
                onMouseDown={(e) => onMouseDown(e, def.id)}
                className={`w-8 py-3 flex flex-col items-center justify-center gap-1.5
                  transition-all duration-200 border ${roundedClass} ${getTabAccent(def.id, isOpen)}
                  ${isDraggingThis ? 'opacity-30' : ''} cursor-grab active:cursor-grabbing select-none`}
                title={`${def.label} — cliquer: ouvrir/fermer, glisser: déplacer`}
              >
                <Icon size={14} />
                {def.id === 'debug' && hasErrors && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                )}
                {def.id === 'debug' && isActive && !hasErrors && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </div>
            );
          })}
        </div>

        {orderedOpen.map((def, panelIndex) => {
          const offset = panelWidths.slice(0, panelIndex).reduce((acc, width) => acc + width, 0);
          const panelWidth = panelWidths[panelIndex] ?? getPanelWidth(def.id, preferences);
          const borderClass = side === 'right' ? 'border-l' : 'border-r';
          return (
            <div
              key={def.id}
              className={`fixed glass ${borderClass} border-panel-border
                transition-all duration-200 ease-in-out flex flex-col overflow-hidden`}
              style={{
                width: panelWidth,
                [side]: offset,
                top: APP_TOP_OFFSET,
                height: `calc(100vh - ${APP_TOP_OFFSET}px)`,
                zIndex: 30 - panelIndex,
              }}
            >
              <PanelContent id={def.id} />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {buildSide('left')}
      {buildSide('right')}

      {isDraggingActive && dragging && (
        <>
          <div
            className="fixed z-50 pointer-events-none"
            style={{ left: dragX - 16, top: dragY - 24 }}
          >
            <div className="w-8 py-3 rounded-lg bg-blue-500/30 border border-blue-500/50
              flex flex-col items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20 backdrop-blur-sm">
              {(() => {
                const def = panelDefs.find((d) => d.id === dragging);
                if (!def) return null;
                const Icon = def.icon;
                return <Icon size={14} className="text-blue-300" />;
              })()}
            </div>
          </div>

          <div
            className={`fixed z-[45] pointer-events-none transition-opacity duration-150
              ${dropSide === 'left' ? 'opacity-100' : 'opacity-0'}`}
            style={{ left: 0, top: APP_TOP_OFFSET, bottom: 0, width: 4 }}
          >
            <div className="w-full h-full bg-blue-500 shadow-lg shadow-blue-500/50" />
          </div>
          <div
            className={`fixed z-[45] pointer-events-none transition-opacity duration-150
              ${dropSide === 'right' ? 'opacity-100' : 'opacity-0'}`}
            style={{ right: 0, top: APP_TOP_OFFSET, bottom: 0, width: 4 }}
          >
            <div className="w-full h-full bg-blue-500 shadow-lg shadow-blue-500/50" />
          </div>
        </>
      )}
    </>
  );
}
