import { useState, useEffect, useMemo } from 'react';
import { BLOCK_FAMILY_BADGE_CLASSES, BLOCK_FAMILY_LABELS } from '../capabilities';
import { describeToolObservationCounts, parseToolObservation, summarizeToolObservation } from '../executionTruth';
import { deriveExecutionTimeline } from '../executionTimeline';
import { useAppStore } from '../store';
import {
  Bug,
  Copy,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  AlertTriangle,
  Activity,
  Layers,
  Lock,
  LockOpen,
} from 'lucide-react';

function ToolStatusBadge({ status }: { status: string }) {
  const classes =
    status === 'preview' ? 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20' :
    status === 'applied' || status === 'succeeded' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' :
    status === 'partially_applied' ? 'text-amber-300 bg-amber-500/10 border-amber-500/20' :
    'text-red-300 bg-red-500/10 border-red-500/20';
  return <span className={`px-1.5 py-0.5 rounded border text-[10px] ${classes}`}>{status.replace(/_/g, ' ')}</span>;
}

function RuntimeChipLockButton({ nodeId, locked, onLockNode, onUnlockNode }: { nodeId: string; locked: boolean; onLockNode: (nodeId: string) => void; onUnlockNode: (nodeId?: string) => void; }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        if (locked) onUnlockNode(nodeId);
        else onLockNode(nodeId);
      }}
      className={`inline-flex h-6 w-6 items-center justify-center rounded border transition-all ${locked ? 'border-violet-500/20 bg-violet-500/10 text-violet-200 hover:bg-violet-500/15' : 'border-panel-border bg-black/20 text-slate-400 hover:bg-panel-hover hover:text-violet-200'}`}
      title={locked ? `Unlock inspection for #${nodeId}` : `Lock inspection on #${nodeId}`}
      data-testid={locked ? 'debug-runtime-unlock' : 'debug-runtime-lock'}
    >
      {locked ? <LockOpen size={11} /> : <Lock size={11} />}
    </button>
  );
}

export default function DebugPanelContent() {
  const {
    liveState,
    liveStateNext,
    isRunning,
    isPaused,
    runLogs,
    pendingNodeId,
    edges,
    requestRuntimeFocus,
    setRuntimeHoverTarget,
    clearRuntimeHoverTarget,
    runtimeHoverTarget,
    runtimeNavigationSettings,
    updateRuntimeNavigationSettings,
  } = useAppStore();

  const [copied, setCopied] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');

  const hasErrors = runLogs.some((l) => l.type === 'error');
  const hasState = Object.keys(liveState).length > 0;
  const isActive = isRunning || isPaused;
  const currentRunContext = [...runLogs].reverse().find((l) => l.type === 'started');
  const fanoutMeta = useMemo(() => {
    const meta = liveState['__fanout_meta__'];
    return meta && typeof meta === 'object' && !Array.isArray(meta) ? meta as Record<string, unknown> : null;
  }, [liveState]);
  const memoryMetaEntries = useMemo(() => {
    const raw = liveState['__memory_meta__'];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [] as Array<[string, Record<string, unknown>]>;
    return Object.entries(raw as Record<string, Record<string, unknown>>).sort((a, b) => {
      const aTs = typeof a[1]?.updated_at === 'number' ? Number(a[1].updated_at) : 0;
      const bTs = typeof b[1]?.updated_at === 'number' ? Number(b[1].updated_at) : 0;
      return bTs - aTs;
    });
  }, [liveState]);

  const familyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    runLogs.forEach((entry) => {
      if (entry.blockFamily) counts.set(entry.blockFamily, (counts.get(entry.blockFamily) || 0) + 1);
    });
    return Array.from(counts.entries());
  }, [runLogs]);

  const executionTimeline = useMemo(() => deriveExecutionTimeline(edges, runLogs, { isRunning, isPaused, pendingNodeId, scheduledNodeIds: liveStateNext }), [edges, runLogs, isRunning, isPaused, pendingNodeId, liveStateNext]);
  const latestExecutionNode = useMemo(() => [...runLogs].reverse().find((entry) => entry.type === 'node_update' || entry.type === 'embedded_trace'), [runLogs]);
  const toolActivity = useMemo(() => {
    return [...runLogs]
      .reverse()
      .map((entry) => ({ entry, observation: parseToolObservation(entry.data) }))
      .filter((item) => item.observation)
      .slice(0, 6);
  }, [runLogs]);

  const lockRuntimeNode = (nodeId: string) => {
    setRuntimeHoverTarget(nodeId, 'debug');
    updateRuntimeNavigationSettings({ lockHover: true });
    requestRuntimeFocus(nodeId, 'debug');
  };

  const unlockRuntimeNode = (nodeId?: string) => {
    if (nodeId && runtimeHoverTarget?.nodeId && runtimeHoverTarget.nodeId !== nodeId) return;
    clearRuntimeHoverTarget();
    updateRuntimeNavigationSettings({ lockHover: false });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(liveState, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggleKey = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    const keys = new Set<string>();
    const walk = (obj: unknown, prefix: string) => {
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        keys.add(prefix);
        Object.keys(obj as Record<string, unknown>).forEach((k) =>
          walk((obj as Record<string, unknown>)[k], `${prefix}.${k}`),
        );
      } else if (Array.isArray(obj)) {
        keys.add(prefix);
        obj.forEach((item, i) => walk(item, `${prefix}[${i}]`));
      }
    };
    Object.keys(liveState).forEach((k) => {
      keys.add(k);
      walk(liveState[k], k);
    });
    setExpandedKeys(keys);
  };

  const collapseAll = () => setExpandedKeys(new Set());

  const filteredState = filter
    ? Object.fromEntries(
        Object.entries(liveState).filter(([k]) =>
          k.toLowerCase().includes(filter.toLowerCase()),
        ),
      )
    : liveState;

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-panel-border shrink-0">
        <div className="flex items-center gap-2">
          <Bug size={13} className={hasErrors ? 'text-red-400' : 'text-blue-400'} />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Debugger
          </span>
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </div>
      </div>

      {liveStateNext.length > 0 && (
        <div className="px-3 py-2 border-b border-amber-500/30 bg-amber-500/5 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-amber-400 flex-wrap">
            <AlertTriangle size={10} />
            <span className="font-medium">Next:</span>
            {liveStateNext.map((nodeId) => {
              const isLocked = runtimeNavigationSettings.lockHover && runtimeHoverTarget?.nodeId === nodeId;
              return (
              <span key={nodeId} className="inline-flex items-center gap-1">
                <button
                  onClick={() => requestRuntimeFocus(nodeId, 'debug')}
                  onDoubleClick={() => lockRuntimeNode(nodeId)}
                  onMouseEnter={() => setRuntimeHoverTarget(nodeId, 'debug')}
                  onMouseLeave={() => { if (!runtimeNavigationSettings.lockHover) clearRuntimeHoverTarget('debug', nodeId); }}
                  className={`px-1.5 py-0.5 rounded border text-[10px] font-mono transition-all ${runtimeHoverTarget?.nodeId === nodeId ? 'border-amber-400/40 bg-amber-500/20 text-amber-200' : 'border-amber-500/20 text-amber-300 bg-amber-500/10 hover:bg-amber-500/15'}`}
                  data-testid="debug-focus-scheduled"
                >
                  #{nodeId}
                </button>
                <RuntimeChipLockButton nodeId={nodeId} locked={isLocked} onLockNode={lockRuntimeNode} onUnlockNode={unlockRuntimeNode} />
              </span>
            );})}
          </div>
        </div>
      )}

      {currentRunContext?.scopePath && (
        <div className="px-3 py-2 border-b border-panel-border shrink-0 bg-cyan-500/5">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Scope runtime</div>
          <div className="mt-1 text-xs text-cyan-300 font-mono break-all">{currentRunContext.scopePath}</div>
          {currentRunContext.scopeLineage && currentRunContext.scopeLineage.length > 1 && (
            <div className="mt-1 text-[10px] text-slate-500">{currentRunContext.scopeLineage.join(' → ')}</div>
          )}
          <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
            {currentRunContext.artifactType && <span>{currentRunContext.artifactType}</span>}
            {currentRunContext.executionProfile && <span>{currentRunContext.executionProfile}</span>}
          </div>
        </div>
      )}

      {(latestExecutionNode || liveStateNext.length > 0) && (
        <div className="px-3 py-2 border-b border-panel-border shrink-0 bg-violet-500/5" data-testid="debug-runtime-correspondence">
          {executionTimeline.steps.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]" data-testid="debug-execution-path">
              {executionTimeline.steps.slice(-8).map((step) => {
                const isLocked = runtimeNavigationSettings.lockHover && runtimeHoverTarget?.nodeId === step.nodeId;
                return (
                <span key={`${step.order}-${step.nodeId}`} className="inline-flex items-center gap-1">
                  <button onClick={() => requestRuntimeFocus(step.nodeId, 'debug')} onDoubleClick={() => lockRuntimeNode(step.nodeId)} onMouseEnter={() => setRuntimeHoverTarget(step.nodeId, 'debug')} onMouseLeave={() => { if (!runtimeNavigationSettings.lockHover) clearRuntimeHoverTarget('debug', step.nodeId); }} className={`px-1.5 py-0.5 rounded border transition-all ${runtimeHoverTarget?.nodeId === step.nodeId ? 'border-cyan-500/30 text-cyan-200 bg-cyan-500/10' : 'border-panel-border text-slate-300 bg-black/20 hover:bg-panel-hover'}`} data-testid="debug-focus-step">
                    <span className="text-cyan-300">{step.order}</span> #{step.nodeId}{isLocked ? ' · locked' : ''}
                  </button>
                  <RuntimeChipLockButton nodeId={step.nodeId} locked={isLocked} onLockNode={lockRuntimeNode} onUnlockNode={unlockRuntimeNode} />
                </span>
              );})}
            </div>
          )}
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Execution correspondence</div>
          <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-300">
            {liveStateNext.length > 0 && <span>scheduled: <span className="text-amber-300">{liveStateNext.map((nodeId) => `#${nodeId}`).join(', ')}</span></span>}
            {latestExecutionNode?.node && <span>last node: <span className="font-mono text-violet-300">{latestExecutionNode.node}</span></span>}
            {latestExecutionNode?.nodeType && <span>type: {latestExecutionNode.nodeType}</span>}
            {latestExecutionNode?.executionStatus && <span>last tool status: <ToolStatusBadge status={latestExecutionNode.executionStatus} /></span>}
          </div>
          {latestExecutionNode?.operationSummary && <div className="mt-1 text-[10px] text-slate-400">{latestExecutionNode.operationSummary}</div>}
        </div>
      )}

      {toolActivity.length > 0 && (
        <div className="px-3 py-2 border-b border-panel-border shrink-0 bg-black/10" data-testid="debug-tool-activity">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Local operation activity</div>
          <div className="mt-1 space-y-1 text-[10px]">
            {toolActivity.map(({ entry, observation }) => observation && (
              <div key={entry.id} className="rounded-lg border border-panel-border bg-black/20 px-2 py-1.5">
                <div className="flex flex-wrap items-center gap-1.5 text-slate-300">
                  {entry.node && <span className="font-mono text-slate-400">#{entry.node}</span>}
                  <span>{summarizeToolObservation(observation)}</span>
                  <ToolStatusBadge status={observation.status} />
                  {observation.reasonCode && <span className="px-1 py-0.5 rounded border border-amber-500/20 text-amber-300">{observation.reasonCode}</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {observation.path && <span className="px-1.5 py-0.5 rounded border border-panel-border text-slate-300 font-mono">{observation.path}</span>}
                  {describeToolObservationCounts(observation).map((item) => <span key={item} className="px-1.5 py-0.5 rounded border border-panel-border text-slate-500">{item}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {fanoutMeta && (
        <div className="px-3 py-2 border-b border-panel-border shrink-0 bg-sky-500/5">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Fanout worker context</div>
          <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-300">
            {typeof fanoutMeta.source_node === 'string' && <span>source: <span className="text-sky-300 font-mono">{fanoutMeta.source_node}</span></span>}
            {typeof fanoutMeta.index === 'number' && <span>worker #{fanoutMeta.index}</span>}
            {typeof fanoutMeta.items_key === 'string' && <span>items: <span className="text-slate-200">{fanoutMeta.items_key}</span></span>}
          </div>
        </div>
      )}

      {memoryMetaEntries.length > 0 && (
        <div className="px-3 py-2 border-b border-panel-border shrink-0 bg-emerald-500/5">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Memory activity</div>
          <div className="mt-1 space-y-1 text-[10px] text-slate-300">
            {memoryMetaEntries.slice(0, 4).map(([nodeId, meta]) => (
              <div key={nodeId} className="flex flex-wrap gap-x-3 gap-y-1">
                <span className="font-mono text-emerald-300">{nodeId}</span>
                {typeof meta.operation === 'string' && <span>{String(meta.operation).replace(/_/g, ' ')}</span>}
                {typeof meta.memory_system === 'string' && <span className="text-slate-400">{String(meta.memory_system).replace(/_/g, ' ')}</span>}
                {typeof meta.access_model === 'string' && <span className="text-slate-500">{String(meta.access_model).replace(/_/g, ' ')}</span>}
                {typeof meta.store_backend === 'string' && <span className="text-slate-500">store:{String(meta.store_backend)}</span>}
                {typeof meta.updated_at === 'number' && <span className="text-slate-500">{new Date(Number(meta.updated_at) * 1000).toLocaleTimeString()}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {familyCounts.length > 0 && (
        <div className="px-3 py-2 border-b border-panel-border shrink-0 bg-black/10">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Run event mix</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {familyCounts.map(([family, count]) => (
              <span key={family} className={`px-1.5 py-0.5 rounded border text-[10px] ${BLOCK_FAMILY_BADGE_CLASSES[family as keyof typeof BLOCK_FAMILY_BADGE_CLASSES]}`}>
                {BLOCK_FAMILY_LABELS[family as keyof typeof BLOCK_FAMILY_LABELS]} · {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasErrors && (
        <div className="px-3 py-2 border-b border-red-500/30 bg-red-500/5 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-red-400">
            <AlertTriangle size={10} />
            <span className="font-medium">
              {runLogs.filter((l) => l.type === 'error').length} erreur(s)
            </span>
          </div>
        </div>
      )}

      <div className="px-3 py-2 border-b border-panel-border shrink-0 flex items-center gap-1.5">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrer les clés..."
          className="flex-1 px-2 py-1 bg-panel border border-panel-border rounded text-xs text-white
            placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={handleCopy}
          title="Copier l'état"
          className="w-6 h-6 rounded flex items-center justify-center
            text-slate-500 hover:text-white hover:bg-panel-hover transition-all"
        >
          <Copy size={10} />
        </button>
      </div>

      {hasState && (
        <div className="px-3 py-1 border-b border-panel-border shrink-0 flex items-center gap-1">
          <button
            onClick={expandAll}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]
              text-slate-500 hover:text-white hover:bg-panel-hover transition-all"
          >
            <ChevronDown size={8} /> Tout
          </button>
          <button
            onClick={collapseAll}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]
              text-slate-500 hover:text-white hover:bg-panel-hover transition-all"
          >
            <ChevronUp size={8} /> Replier
          </button>
          <div className="ml-auto flex items-center gap-1 text-[10px] text-slate-600">
            <Layers size={8} />
            {Object.keys(liveState).length} clés
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-2 scrollbar-thin">
        {!hasState && (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 text-xs">
            <Activity size={20} className="mb-2 opacity-50" />
            <p>Aucun état reçu</p>
            <p className="text-[10px] mt-1 text-slate-700">
              Lancez un run pour voir l'état
            </p>
          </div>
        )}

        {hasState && (
          <div className="space-y-0.5">
            {Object.entries(filteredState).map(([key, value]) => (
              <StateNode
                key={key}
                label={key}
                value={value}
                path={key}
                expandedKeys={expandedKeys}
                toggleKey={toggleKey}
                depth={0}
              />
            ))}
          </div>
        )}
      </div>

      {copied && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-md
          bg-emerald-500/20 text-emerald-400 text-xs font-medium">
          Copié !
        </div>
      )}
    </>
  );
}

function StateNode({
  label,
  value,
  path,
  expandedKeys,
  toggleKey,
  depth,
}: {
  label: string;
  value: unknown;
  path: string;
  expandedKeys: Set<string>;
  toggleKey: (key: string) => void;
  depth: number;
}) {
  const isExpanded = expandedKeys.has(path);
  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);

  if (!isObject) {
    return (
      <div
        className="flex items-start gap-1 py-0.5 text-[11px] font-mono"
        style={{ paddingLeft: depth * 12 }}
      >
        <span className="text-blue-300 shrink-0">{label}:</span>
        <span className={getValueColor(value)}>{formatValue(value)}</span>
      </div>
    );
  }

  const entries = isArray
    ? (value as unknown[]).map((v, i) => [`[${i}]`, v] as [string, unknown])
    : Object.entries(value as Record<string, unknown>);
  const count = entries.length;
  const typeLabel = isArray ? `Array(${count})` : `{${count}}`;

  return (
    <div>
      <button
        onClick={() => toggleKey(path)}
        className="flex items-center gap-1 py-0.5 text-[11px] font-mono w-full text-left
          hover:bg-panel-hover/50 rounded px-1"
        style={{ paddingLeft: depth * 12 }}
      >
        {isExpanded ? (
          <ChevronDown size={10} className="text-slate-500 shrink-0" />
        ) : (
          <ChevronRight size={10} className="text-slate-500 shrink-0" />
        )}
        <span className="text-blue-300">{label}</span>
        <span className="text-slate-600 text-[10px]">{typeLabel}</span>
      </button>

      {isExpanded && (
        <div>
          {entries.map(([k, v]) => (
            <StateNode
              key={`${path}.${k}`}
              label={k}
              value={v}
              path={`${path}.${k}`}
              expandedKeys={expandedKeys}
              toggleKey={toggleKey}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getValueColor(value: unknown): string {
  if (value === null || value === undefined) return 'text-slate-500 italic';
  if (typeof value === 'string') return 'text-emerald-300';
  if (typeof value === 'number') return 'text-amber-300';
  if (typeof value === 'boolean') return 'text-violet-300';
  return 'text-slate-300';
}

function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') {
    if (value.length > 80) return `"${value.slice(0, 77)}…"`;
    return `"${value}"`;
  }
  return String(value);
}
