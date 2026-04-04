import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { BLOCK_FAMILY_BADGE_CLASSES, BLOCK_FAMILY_LABELS, projectModeAllowsRuntime } from '../capabilities';
import { describeToolObservationCounts, parseToolObservation, summarizeToolObservation } from '../executionTruth';
import { deriveExecutionTimeline } from '../executionTimeline';
import { getNodeRuntimeMeta } from '../catalog';
import { useAppStore, type RunLogEntry } from '../store';
import {
  ChevronDown,
  Copy,
  Code2,
  Play,
  Square,
  Send,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  PauseCircle,
  Zap,
  SlidersHorizontal,
  RotateCcw,
  BookmarkPlus,
  Clock3,
  ListChecks,
  Unplug,
  Bookmark,
  Lock,
  LockOpen,
} from 'lucide-react';

type RunTab = 'inputs' | 'execution' | 'json';
type InputMode = 'message' | 'json';

type RunInputPreset = {
  id: string;
  name: string;
  mode: InputMode;
  value: string;
};

const RUN_PRESETS_STORAGE_KEY = 'langgraph-builder-run-input-presets-v1';
const PRIMARY_OUTPUT_PRIORITY = ['final_answer', 'answer', 'result', 'output', 'summary', 'response'];

const FILESYSTEM_SENSITIVE_NODE_TYPES = new Set(['tool_fs_list_dir', 'tool_fs_read_file', 'tool_fs_glob', 'tool_fs_grep', 'tool_fs_write_file', 'tool_fs_edit_file', 'tool_fs_apply_patch']);
const REQUESTS_SENSITIVE_NODE_TYPES = new Set(['tool_requests_get', 'tool_requests_post']);
const SEARCH_PROVIDER_NODE_TYPES = new Set(['tool_web_search', 'tool_tavily_extract', 'tool_brave_search', 'tool_duckduckgo_search']);
const GITHUB_SENSITIVE_NODE_TYPES = new Set(['tool_github_get_issue', 'tool_github_get_pull_request', 'tool_github_read_file', 'tool_github_search_issues_prs']);
const SQL_SENSITIVE_NODE_TYPES = new Set(['tool_sql_query', 'tool_sql_list_tables', 'tool_sql_get_schema', 'tool_sql_query_check']);

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-xs flex items-center gap-1.5 transition-all ${
        active ? 'bg-blue-500/15 text-blue-300' : 'text-slate-400 hover:text-white hover:bg-panel-hover'
      }`}
    >
      {children}
    </button>
  );
}

function StatusPill({
  kind,
  children,
}: {
  kind: 'idle' | 'running' | 'paused' | 'error' | 'ok';
  children: ReactNode;
}) {
  const classes =
    kind === 'running'
      ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
      : kind === 'paused'
        ? 'text-amber-300 bg-amber-500/10 border-amber-500/20'
        : kind === 'error'
          ? 'text-red-300 bg-red-500/10 border-red-500/20'
          : kind === 'ok'
            ? 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20'
            : 'text-slate-300 bg-black/20 border-panel-border';
  return <span className={`px-2 py-1 rounded-full border text-[10px] ${classes}`}>{children}</span>;
}

function ReadinessBadge({ tone, label }: { tone: 'ready' | 'attention' | 'blocked' | 'info'; label: string }) {
  const classes =
    tone === 'ready'
      ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
      : tone === 'attention'
        ? 'text-amber-300 bg-amber-500/10 border-amber-500/20'
        : tone === 'blocked'
          ? 'text-red-300 bg-red-500/10 border-red-500/20'
          : 'text-slate-300 bg-slate-500/10 border-slate-500/20';
  return <span className={`px-2 py-1 rounded-full border text-[10px] ${classes}`}>{label}</span>;
}

function ReadinessRow({ label, tone, value, help }: { label: string; tone: 'ready' | 'attention' | 'blocked' | 'info'; value: string; help: string }) {
  return (
    <div className="rounded-lg border border-panel-border bg-black/20 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] text-slate-200">{label}</div>
        <ReadinessBadge tone={tone} label={value} />
      </div>
      <div className="mt-1 text-[10px] leading-5 text-slate-500">{help}</div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-panel-border bg-black/20 p-3">
      <div className="flex items-center gap-2 text-[11px] text-slate-500 uppercase tracking-wide">
        <Icon size={12} className="text-slate-400" />
        <span>{label}</span>
      </div>
      <div className="mt-2 text-sm text-slate-100">{value}</div>
    </div>
  );
}

function ToolStatusBadge({ status }: { status: string }) {
  const classes =
    status === 'preview' ? 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20' :
    status === 'applied' || status === 'succeeded' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' :
    status === 'partially_applied' ? 'text-amber-300 bg-amber-500/10 border-amber-500/20' :
    'text-red-300 bg-red-500/10 border-red-500/20';
  return <span className={`px-1.5 py-0.5 rounded border text-[10px] ${classes}`}>{status.replace(/_/g, ' ')}</span>;
}

function getActionableIssueHint(entry: RunLogEntry): { title: string; lines: string[] } | null {
  const code = entry.reasonCode || null;
  const data = entry.data && typeof entry.data === 'object' ? entry.data as Record<string, unknown> : null;
  if (code === 'missing_runtime_dependencies') {
    const missing = Array.isArray(data?.missingDependencies) ? data?.missingDependencies as Array<Record<string, unknown>> : [];
    const packages = missing.map((item) => String(item.package || '')).filter(Boolean);
    return {
      title: 'Install the missing runtime packages in the Python environment that runs LangSuite.',
      lines: [
        packages.length > 0 ? `Missing packages: ${packages.join(', ')}` : 'One or more runtime packages are missing.',
        'Then rerun the graph from the same environment.',
      ],
    };
  }
  if (code === 'missing_provider_config') {
    return {
      title: 'Choose a provider and model before running this authored session.',
      lines: [
        'The graph is assembled and editable, but one or more provider-backed nodes still have no provider configured.',
        'Open the affected node/tool settings, choose a truthful provider surface, then rerun.',
      ],
    };
  }
  if (code === 'missing_provider_api_base_url') {
    return {
      title: 'Set a provider base URL on the affected node or tool.',
      lines: [
        'Local OpenAI-compatible providers usually need an explicit base URL such as LM Studio or llama.cpp /v1 endpoints.',
        'Then rerun once the node settings are saved.',
      ],
    };
  }
  if (code === 'missing_provider_api_key' || code === 'missing_tavily_api_key' || code === 'missing_brave_api_key' || code === 'missing_github_configuration') {
    return {
      title: 'Add the required environment variables before running again.',
      lines: [
        'Set the missing key or provider config in the shell/environment that launches LangSuite.',
        'Restart the backend if needed so the new environment is visible to runtime preflight.',
      ],
    };
  }
  if (code === 'provider_surface_not_supported') {
    return {
      title: 'Switch this node to a truthfully modeled provider or keep the flow editor-first.',
      lines: [
        'The current provider surface is not claimed as supported by this build.',
        'Use a supported provider family or rely on compile/export instead of in-app runtime for this lane.',
      ],
    };
  }
  if (code === 'requests_target_not_configured') {
    return {
      title: 'Configure a request target before rerunning.',
      lines: [
        'Set a base_url for bounded requests or explicitly allow full URLs.',
      ],
    };
  }
  if (code === 'invalid_filesystem_root') {
    return {
      title: 'Point the filesystem tool to an existing directory.',
      lines: [
        'Update root_path to a real local directory visible to the LangSuite process.',
      ],
    };
  }
  if (code === 'shell_not_armed' || code === 'shell_execution_not_armed') {
    return {
      title: 'Arm shell execution explicitly for this graph.',
      lines: [
        'Turn on the shell toggle in the runtime settings for this graph.',
        'Shell tools stay blocked until the graph is explicitly armed.',
      ],
    };
  }
  if (code === 'missing_shell_allowlist') {
    return {
      title: 'Add one or more allowed shell commands.',
      lines: [
        'The shell surface is bounded: it needs a non-empty allowed_commands list.',
      ],
    };
  }
  if (code === 'sql_mutation_disabled') {
    return {
      title: 'Keep SQL in read-only mode for this product surface.',
      lines: [
        'This build only claims truthful support for read-only SQL execution.',
      ],
    };
  }
  return null;
}



function describeValidationIssue(issue: { code?: string; message: string }): string {
  switch (issue.code) {
    case 'missing_provider_config':
      return 'Choose a provider/model on the affected provider-backed node before running.';
    case 'missing_api_base_url':
      return 'Add an API Base URL on the affected provider-backed node before running.';
    case 'missing_api_key_env':
      return 'Declare the provider API key environment variable on the node, then launch LangSuite from an environment where it is actually set.';
    case 'provider_surface_not_supported':
      return 'This provider surface is not claimed as truthful for in-app runtime here. Prefer a supported provider or keep this lane compile/editor-first.';
    case 'invalid_provider':
      return 'Switch the node to a modeled provider family before running.';
    case 'missing_required_field':
      return 'Fill the required node field that is still empty before running.';
    case 'unknown_tool_reference':
      return 'Fix the broken tool reference before running.';
    default:
      return issue.message;
  }
}

function RuntimeLockButton({ nodeId, locked, onLockNode, onUnlockNode, compact = false }: { nodeId: string; locked: boolean; onLockNode: (nodeId: string) => void; onUnlockNode: (nodeId?: string) => void; compact?: boolean; }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        if (locked) onUnlockNode(nodeId);
        else onLockNode(nodeId);
      }}
      className={`inline-flex items-center justify-center rounded-md border transition-all ${compact ? 'w-6 h-6' : 'px-2 py-1 text-[10px]'} ${locked ? 'border-violet-500/20 bg-violet-500/10 text-violet-200 hover:bg-violet-500/15' : 'border-panel-border bg-black/20 text-slate-400 hover:bg-panel-hover hover:text-violet-200'}`}
      title={locked ? `Unlock inspection for #${nodeId}` : `Lock inspection on #${nodeId}`}
      data-testid={locked ? 'runtime-entry-unlock' : 'runtime-entry-lock'}
    >
      {locked ? <LockOpen size={compact ? 11 : 12} /> : <Lock size={compact ? 11 : 12} />}
      {!compact && <span className="ml-1">{locked ? 'unlock' : 'lock'}</span>}
    </button>
  );
}

function PatchPlanCard({ toolObservation }: { toolObservation: NonNullable<ReturnType<typeof parseToolObservation>> }) {
  if (toolObservation.operation !== 'apply_patch') return null;
  return (
    <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-2 text-[11px] space-y-2" data-testid="patch-plan-card">
      <div className="flex flex-wrap items-center gap-1.5 text-slate-300">
        <span className="font-medium text-violet-200">Patch plan</span>
        {toolObservation.root && <span className="px-1.5 py-0.5 rounded border border-panel-border text-[10px] text-slate-400 font-mono">root:{toolObservation.root}</span>}
        {toolObservation.mode && <span className="px-1.5 py-0.5 rounded border border-panel-border text-[10px] text-cyan-300">mode:{toolObservation.mode}</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="rounded-md border border-panel-border bg-black/20 p-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Modify</div>
          <div className="mt-1 space-y-1">
            {toolObservation.filesToModify.length > 0 ? toolObservation.filesToModify.slice(0, 6).map((path) => (
              <div key={path} className="text-[10px] text-slate-200 font-mono break-all">{path}</div>
            )) : <div className="text-[10px] text-slate-500">—</div>}
          </div>
        </div>
        <div className="rounded-md border border-panel-border bg-black/20 p-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Create</div>
          <div className="mt-1 space-y-1">
            {toolObservation.filesToCreate.length > 0 ? toolObservation.filesToCreate.slice(0, 6).map((path) => (
              <div key={path} className="text-[10px] text-emerald-200 font-mono break-all">{path}</div>
            )) : <div className="text-[10px] text-slate-500">—</div>}
          </div>
        </div>
        <div className="rounded-md border border-panel-border bg-black/20 p-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Rejected</div>
          <div className="mt-1 space-y-1">
            {toolObservation.filesRejected.length > 0 ? toolObservation.filesRejected.slice(0, 6).map((item, index) => (
              <div key={`${item.path || 'rejected'}-${index}`} className="text-[10px] text-amber-200 break-all">
                <span className="font-mono">{item.path || 'unknown path'}</span>
                {item.reason_code ? <span className="text-amber-300"> · {item.reason_code}</span> : null}
              </div>
            )) : <div className="text-[10px] text-slate-500">—</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExecutionTimelineCard({ steps, scheduledNodeIds, activeNodeId, hoveredNodeId, lockedNodeId, onFocusNode, onHoverNode, onClearHover, onLockNode, onUnlockNode }: { steps: Array<{ order: number; nodeId: string; summary: string | null; executionStatus: string | null }>; scheduledNodeIds: string[]; activeNodeId: string | null; hoveredNodeId: string | null; lockedNodeId: string | null; onFocusNode: (nodeId: string) => void; onHoverNode: (nodeId: string) => void; onClearHover: (nodeId: string) => void; onLockNode: (nodeId: string) => void; onUnlockNode: (nodeId?: string) => void; }) {
  if (steps.length === 0 && scheduledNodeIds.length === 0) return null;
  const visibleSteps = steps.slice(-8);
  return (
    <div className="rounded-xl border border-panel-border bg-black/20 p-4 space-y-3" data-testid="execution-timeline-card">
      <div>
        <div className="text-sm font-medium text-white">Execution timeline</div>
        <div className="text-[11px] text-slate-500">Authored graph nodes in the order the runtime actually reported them.</div>
      </div>
      {visibleSteps.length > 0 && (
        <div className="space-y-2">
          {visibleSteps.map((step) => {
            const isLocked = lockedNodeId === step.nodeId;
            return (
              <div key={`${step.order}-${step.nodeId}`} className="flex items-start gap-2">
                <button onClick={() => onFocusNode(step.nodeId)} onDoubleClick={() => onLockNode(step.nodeId)} onMouseEnter={() => onHoverNode(step.nodeId)} onMouseLeave={() => onClearHover(step.nodeId)} className={`flex-1 text-left rounded-lg border px-3 py-2 transition-all ${hoveredNodeId === step.nodeId ? 'border-cyan-500/30 bg-cyan-500/10' : 'border-panel-border bg-black/20 hover:bg-panel-hover'}`} data-testid="timeline-focus-step">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                    <span className="px-1.5 py-0.5 rounded border border-panel-border text-cyan-300">step {step.order}</span>
                    <span className="font-mono text-slate-100">#{step.nodeId}</span>
                    {step.executionStatus && <ToolStatusBadge status={step.executionStatus} />}
                    {activeNodeId === step.nodeId && <span className="px-1.5 py-0.5 rounded border border-emerald-500/20 text-[10px] text-emerald-300 bg-emerald-500/10">current</span>}
                    {isLocked && <span className="px-1.5 py-0.5 rounded border border-violet-500/20 text-[10px] text-violet-200 bg-violet-500/10">locked</span>}
                  </div>
                  {step.summary && <div className="mt-1 text-[11px] text-slate-400 break-words">{step.summary}</div>}
                </button>
                <RuntimeLockButton nodeId={step.nodeId} locked={isLocked} onLockNode={onLockNode} onUnlockNode={onUnlockNode} compact />
              </div>
            );
          })}
        </div>
      )}
      {scheduledNodeIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Scheduled next</span>
          {scheduledNodeIds.map((nodeId) => {
            const isLocked = lockedNodeId === nodeId;
            return (
              <span key={nodeId} className="inline-flex items-center gap-1">
                <button onClick={() => onFocusNode(nodeId)} onDoubleClick={() => onLockNode(nodeId)} onMouseEnter={() => onHoverNode(nodeId)} onMouseLeave={() => onClearHover(nodeId)} className={`px-1.5 py-0.5 rounded border text-[10px] font-mono transition-all ${hoveredNodeId === nodeId ? 'border-amber-400/40 bg-amber-500/20 text-amber-200' : 'border-amber-500/20 text-amber-300 bg-amber-500/10 hover:bg-amber-500/15'}`} data-testid="timeline-focus-scheduled">#{nodeId}</button>
                <RuntimeLockButton nodeId={nodeId} locked={isLocked} onLockNode={onLockNode} onUnlockNode={onUnlockNode} compact />
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LogEntryCard({ entry, hoveredNodeId, lockedNodeId, onFocusNode, onHoverNode, onClearHover, onLockNode, onUnlockNode, entryRef }: { entry: RunLogEntry; hoveredNodeId: string | null; lockedNodeId: string | null; onFocusNode: (nodeId: string) => void; onHoverNode: (nodeId: string) => void; onClearHover: (nodeId: string) => void; onLockNode: (nodeId: string) => void; onUnlockNode: (nodeId?: string) => void; entryRef?: (element: HTMLDivElement | null) => void; }) {
  const icon =
    entry.type === 'error' ? <AlertCircle size={13} className="text-red-400" /> :
    entry.type === 'completed' ? <CheckCircle2 size={13} className="text-emerald-400" /> :
    entry.type === 'paused' ? <PauseCircle size={13} className="text-amber-400" /> :
    entry.type === 'started' ? <Play size={13} className="text-cyan-400" /> :
    entry.type === 'embedded_trace' ? <Code2 size={13} className="text-violet-300" /> :
    <Zap size={13} className="text-slate-400" />;

  const toolObservation = parseToolObservation(entry.data);
  const toolSummary = toolObservation ? (entry.operationSummary || summarizeToolObservation(toolObservation)) : null;
  const toolCounts = toolObservation ? describeToolObservationCounts(toolObservation) : [];
  const actionableHint = getActionableIssueHint(entry);

  const isHoveredMatch = Boolean(entry.node && hoveredNodeId === entry.node);
  const isLockedMatch = Boolean(entry.node && lockedNodeId === entry.node);
  const factLabel = entry.truthSource === 'runtime_event' ? 'runtime emitted' : entry.truthSource === 'legacy' ? 'legacy fallback' : 'UI inferred';
  const factTone = entry.truthSource === 'runtime_event' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : entry.truthSource === 'legacy' ? 'text-amber-300 bg-amber-500/10 border-amber-500/20' : 'text-slate-300 bg-slate-500/10 border-slate-500/20';

  return (
    <div ref={entryRef} className={`rounded-lg border p-3 space-y-1 transition-all ${isHoveredMatch ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-panel-border bg-black/20'}`} onMouseEnter={() => { if (entry.node) onHoverNode(entry.node); }} onMouseLeave={() => { if (entry.node) onClearHover(entry.node); }} onDoubleClick={() => { if (entry.node) onLockNode(entry.node); }} data-testid="run-log-card">
      <div className="flex items-center gap-2 text-xs flex-wrap">
        {icon}
        <span className="font-medium text-slate-200 uppercase tracking-wide">{entry.type}</span>
        {entry.node && <button onClick={() => onFocusNode(entry.node!)} onDoubleClick={() => onLockNode(entry.node!)} onMouseEnter={() => onHoverNode(entry.node!)} onMouseLeave={() => onClearHover(entry.node!)} className={`font-mono transition-all ${isHoveredMatch ? 'text-cyan-200' : 'text-slate-300 hover:text-cyan-300'}`} data-testid="run-log-focus-node">#{entry.node}</button>}
        {entry.node && <RuntimeLockButton nodeId={entry.node} locked={isLockedMatch} onLockNode={onLockNode} onUnlockNode={onUnlockNode} compact />}
        {entry.blockFamily && <span className={`px-1.5 py-0.5 rounded border text-[10px] ${BLOCK_FAMILY_BADGE_CLASSES[entry.blockFamily]}`}>{BLOCK_FAMILY_LABELS[entry.blockFamily]}</span>}
        <span className={`px-1.5 py-0.5 rounded border text-[10px] ${factTone}`}>{factLabel}</span>
        {entry.runtimeKind && <span className="px-1.5 py-0.5 rounded border text-[10px] text-cyan-300 bg-cyan-500/10 border-cyan-500/20">{entry.runtimeKind.replace(/_/g, ' ')}</span>}
        {entry.integrationModel && <span className="px-1.5 py-0.5 rounded border text-[10px] text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/20">{entry.integrationModel.replace(/_/g, ' ')}</span>}
        {entry.toolkit && <span className="px-1.5 py-0.5 rounded border text-[10px] text-sky-300 bg-sky-500/10 border-sky-500/20">{entry.toolkit}</span>}
        {entry.operation && <span className="px-1.5 py-0.5 rounded border text-[10px] text-slate-300 bg-slate-500/10 border-slate-500/20">{entry.operation.replace(/_/g, ' ')}</span>}
        {entry.executionStatus && <ToolStatusBadge status={entry.executionStatus} />}
        {isLockedMatch && <span className="px-1.5 py-0.5 rounded border text-[10px] text-violet-200 bg-violet-500/10 border-violet-500/20">locked</span>}
        {entry.reasonCode && <span className="px-1.5 py-0.5 rounded border text-[10px] text-amber-300 bg-amber-500/10 border-amber-500/20">{entry.reasonCode}</span>}
        {entry.memorySystem && <span className="px-1.5 py-0.5 rounded border text-[10px] text-emerald-300 bg-emerald-500/10 border-emerald-500/20">{entry.memorySystem.replace(/_/g, ' ')}</span>}
        {entry.memoryOperation && <span className="px-1.5 py-0.5 rounded border text-[10px] text-emerald-300 bg-emerald-500/10 border-emerald-500/20">{entry.memoryOperation.replace(/_/g, ' ')}</span>}
        {entry.fanoutSourceNode && <span className="px-1.5 py-0.5 rounded border text-[10px] text-sky-300 bg-sky-500/10 border-sky-500/20">fanout:{entry.fanoutSourceNode}</span>}
        {typeof entry.fanoutIndex === 'number' && <span className="px-1.5 py-0.5 rounded border text-[10px] text-sky-300 bg-sky-500/10 border-sky-500/20">worker #{entry.fanoutIndex}</span>}
      </div>
      {(entry.nodeType || entry.executionPlacement || entry.executionFlavor || entry.memoryAccessModel || entry.storeBackend) && (
        <div className="text-[10px] text-slate-500 flex flex-wrap gap-2">
          {entry.nodeType && <span>type: {entry.nodeType}</span>}
          {entry.executionPlacement && <span>placement: {entry.executionPlacement}</span>}
          {entry.executionFlavor && <span>flavor: {entry.executionFlavor}</span>}
          {entry.memoryAccessModel && <span>memory: {entry.memoryAccessModel}</span>}
          {entry.storeBackend && <span>store: {entry.storeBackend}</span>}
        </div>
      )}
      {toolObservation && (
        <div className="rounded-lg border border-panel-border bg-black/25 p-2 text-[11px] text-slate-300 space-y-1">
          <div className="font-medium text-slate-100">{toolSummary}</div>
          <div className="flex flex-wrap gap-1">
            {toolObservation.path && <span className="px-1.5 py-0.5 rounded border border-panel-border text-[10px] text-slate-300 font-mono">{toolObservation.path}</span>}
            {toolCounts.map((item) => <span key={item} className="px-1.5 py-0.5 rounded border border-panel-border text-[10px] text-slate-400">{item}</span>)}
            {toolObservation.mode && <span className="px-1.5 py-0.5 rounded border border-panel-border text-[10px] text-cyan-300">mode:{toolObservation.mode}</span>}
          </div>
          {toolObservation.message && toolObservation.message !== toolSummary && <div className="text-[11px] text-slate-400 whitespace-pre-wrap break-words">{toolObservation.message}</div>}
          <PatchPlanCard toolObservation={toolObservation} />
        </div>
      )}
      {!toolObservation && entry.message && <div className="text-sm text-slate-200 whitespace-pre-wrap break-words">{entry.message}</div>}
      {actionableHint && (
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2 text-[11px] leading-5 text-cyan-100" data-testid="run-log-actionable-hint">
          <div className="font-medium text-cyan-200">{actionableHint.title}</div>
          <ul className="mt-1 space-y-1">
            {actionableHint.lines.map((line) => <li key={line}>• {line}</li>)}
          </ul>
        </div>
      )}
      {entry.data !== undefined && (
        <pre className="text-[11px] text-slate-400 whitespace-pre-wrap break-words font-mono">
          {JSON.stringify(entry.data, null, 2)}
        </pre>
      )}
    </div>
  );
}


function summarizeValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.length > 220 ? `${value.slice(0, 217)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? '' : 's'}`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    return keys.length === 0 ? 'Empty object' : `${keys.length} key${keys.length === 1 ? '' : 's'} · ${keys.slice(0, 4).join(', ')}`;
  }
  return '—';
}

function derivePrimaryOutput(liveState: Record<string, unknown>): { key: string; value: unknown } | null {
  const keys = Object.keys(liveState || {});
  if (keys.length === 0) return null;

  const filtered = keys.filter((key) => !['messages', '__interrupt__', '__metadata__'].includes(key));
  const source = filtered.length > 0 ? filtered : keys;

  const exact = PRIMARY_OUTPUT_PRIORITY.find((key) => source.includes(key));
  if (exact) return { key: exact, value: liveState[exact] };

  const fuzzy = source.find((key) => PRIMARY_OUTPUT_PRIORITY.some((candidate) => key.toLowerCase().includes(candidate)));
  if (fuzzy) return { key: fuzzy, value: liveState[fuzzy] };

  const scalar = source.find((key) => {
    const value = liveState[key];
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
  });
  if (scalar) return { key: scalar, value: liveState[scalar] };

  const first = source[0];
  return first ? { key: first, value: liveState[first] } : null;
}

function parseJsonInputs(raw: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(raw || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Run inputs JSON must be an object.' };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid JSON.' };
  }
}

function formatDuration(startedAt: number | null, endedAt: number | null): string {
  if (!startedAt) return '—';
  const end = endedAt ?? Date.now();
  const diff = Math.max(0, end - startedAt);
  if (diff < 1000) return `${diff} ms`;
  return `${(diff / 1000).toFixed(diff < 10_000 ? 1 : 0)} s`;
}

export default function RunPanel() {
  const {
    runPanelOpen,
    toggleRunPanel,
    exportJson,
    runLogs,
    isRunning,
    isPaused,
    pendingNodeId,
    startRun,
    sendResume,
    stopRun,
    clearRunLogs,
    preferences,
    liveState,
    editorMode,
    edges,
    nodes,
    liveStateNext,
    requestRuntimeFocus,
    setRuntimeHoverTarget,
    clearRuntimeHoverTarget,
    runtimeHoverTarget,
    runtimeNavigationSettings,
    updateRuntimeNavigationSettings,
    runValidation,
    tabs,
    activeTabId,
  } = useAppStore();

  const simpleMode = editorMode === 'simple';
  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeTabId) || null, [tabs, activeTabId]);
  const validation = useMemo(() => runValidation(), [runValidation, nodes, edges, activeTab?.artifactType, activeTab?.executionProfile, activeTab?.projectMode, activeTab?.runtimeSettings]);
  const runtimeEnabled = projectModeAllowsRuntime(activeTab?.projectMode || 'langgraph');
  const validationCodes = validation.issues.map((issue) => issue.code || '');
  const providerSensitiveNodeCount = useMemo(() => nodes.filter((node) => { const nodeType = typeof node.data?.nodeType === 'string' ? String(node.data.nodeType) : ''; const meta = nodeType ? getNodeRuntimeMeta(nodeType) : null; return Boolean(meta?.providerBacked); }).length, [nodes]);
  const dependencySensitiveNodeCount = useMemo(() => nodes.filter((node) => { const nodeType = typeof node.data?.nodeType === 'string' ? String(node.data.nodeType) : ''; const meta = nodeType ? getNodeRuntimeMeta(nodeType) : null; return Boolean(meta?.providerBacked || meta?.toolkitBacked || meta?.configRequired); }).length, [nodes]);
  const requiresShellArming = useMemo(() => nodes.some((node) => String(node.data?.nodeType || '') === 'tool_shell_command'), [nodes]);
  const providerBlocked = validationCodes.includes('invalid_provider');
  const providerNeedsAttention = providerBlocked || validationCodes.includes('missing_provider_config') || validationCodes.includes('missing_api_key_env') || validationCodes.includes('missing_api_base_url') || validationCodes.includes('provider_surface_not_supported');
  const likelyBlockers = useMemo(() => validation.issues.filter((issue) => issue.severity !== 'info').slice(0, 4).map((issue) => ({ id: `${issue.code || 'issue'}:${issue.nodeId || issue.message}`, text: describeValidationIssue(issue) })), [validation.issues]);
  const hasFilesystemSensitiveNodes = useMemo(() => nodes.some((node) => FILESYSTEM_SENSITIVE_NODE_TYPES.has(String(node.data?.nodeType || ''))), [nodes]);
  const hasRequestsSensitiveNodes = useMemo(() => nodes.some((node) => REQUESTS_SENSITIVE_NODE_TYPES.has(String(node.data?.nodeType || ''))), [nodes]);
  const hasSearchProviderNodes = useMemo(() => nodes.some((node) => SEARCH_PROVIDER_NODE_TYPES.has(String(node.data?.nodeType || ''))), [nodes]);
  const hasGithubSensitiveNodes = useMemo(() => nodes.some((node) => GITHUB_SENSITIVE_NODE_TYPES.has(String(node.data?.nodeType || ''))), [nodes]);
  const hasSqlSensitiveNodes = useMemo(() => nodes.some((node) => SQL_SENSITIVE_NODE_TYPES.has(String(node.data?.nodeType || ''))), [nodes]);
  const runPathSteps = useMemo(() => {
    const steps: Array<{ id: string; title: string; body: string }> = [];
    steps.push({
      id: 'local-validation',
      title: '1. Local graph validation',
      body: validation.valid ? 'The editor can already see a compile/run-shaped graph: required fields and graph structure look clear enough locally.' : 'The editor already sees graph or required-field blockers. Fix those first, before expecting backend runtime checks to help.',
    });
    steps.push({
      id: 'mode-gate',
      title: '2. Project-mode gate',
      body: runtimeEnabled ? `This ${activeTab?.projectMode || 'langgraph'} surface is allowed to execute in-app in this build.` : `This ${activeTab?.projectMode || 'langgraph'} surface is editor-only here, so Run stops before dependency or environment preflight.`,
    });
    if (runtimeEnabled && dependencySensitiveNodeCount > 0) {
      steps.push({
        id: 'dependency-preflight',
        title: '3. Backend dependency preflight',
        body: 'On Run, the backend checks the real Python environment for the packages required by the provider- or toolkit-backed nodes present in this graph.',
      });
    }
    if (runtimeEnabled) {
      const preflightFragments: string[] = [];
      if (providerSensitiveNodeCount > 0) preflightFragments.push('provider base URLs and env vars');
      if (hasSearchProviderNodes) preflightFragments.push('search-provider keys');
      if (hasGithubSensitiveNodes) preflightFragments.push('GitHub repository/config wiring');
      if (hasRequestsSensitiveNodes) preflightFragments.push('bounded request targets');
      if (hasFilesystemSensitiveNodes) preflightFragments.push('filesystem root paths');
      if (requiresShellArming) preflightFragments.push('shell arming and allowlists');
      if (hasSqlSensitiveNodes) preflightFragments.push('SQL safety mode');
      if (preflightFragments.length > 0) {
        steps.push({
          id: 'runtime-preflight',
          title: dependencySensitiveNodeCount > 0 ? '4. Runtime preflight' : '3. Runtime preflight',
          body: `Right before execution, backend preflight re-checks ${preflightFragments.join(', ')} against the real runtime context instead of trusting UI copy alone.`,
        });
      }
    }
    return steps;
  }, [validation.valid, runtimeEnabled, activeTab?.projectMode, dependencySensitiveNodeCount, providerSensitiveNodeCount, hasSearchProviderNodes, hasGithubSensitiveNodes, hasRequestsSensitiveNodes, hasFilesystemSensitiveNodes, requiresShellArming, hasSqlSensitiveNodes]);
  const readinessRows = [
    {
      label: 'Graph validity',
      tone: validation.valid ? 'ready' as const : 'blocked' as const,
      value: validation.valid ? 'ready' : `${validation.errors.length} blocking issue${validation.errors.length === 1 ? '' : 's'}`,
      help: validation.valid ? 'No blocking graph or required-field errors were found in the current workspace.' : validation.errors[0] || 'Fix blocking validation errors before running.',
    },
    {
      label: 'Execution mode',
      tone: runtimeEnabled ? 'ready' as const : 'blocked' as const,
      value: runtimeEnabled ? `${activeTab?.projectMode || 'langgraph'} enabled` : `${activeTab?.projectMode || 'langgraph'} editor-only`,
      help: runtimeEnabled ? 'This project mode is allowed to execute in-app in the current build.' : 'This mode can still be authored, saved, and exported, but in-app runtime is intentionally disabled.',
    },
    {
      label: 'Provider configuration',
      tone: providerSensitiveNodeCount === 0 ? 'info' as const : providerNeedsAttention ? (providerBlocked ? 'blocked' as const : 'attention' as const) : 'ready' as const,
      value: providerSensitiveNodeCount === 0 ? 'not needed' : providerNeedsAttention ? 'needs review' : 'configured',
      help: providerSensitiveNodeCount === 0 ? 'No provider-backed node is currently present in the graph.' : providerNeedsAttention ? 'The local validator found provider-related warnings or missing-provider states. Review provider choice, env var, base URL, or provider surface truth before running.' : 'No provider warning is currently raised by the local validator.',
    },
    {
      label: 'Dependencies / env',
      tone: dependencySensitiveNodeCount === 0 ? 'ready' as const : 'info' as const,
      value: dependencySensitiveNodeCount === 0 ? 'core nodes only' : 'checked on Run',
      help: dependencySensitiveNodeCount === 0 ? 'The graph currently stays on low-friction core surfaces.' : 'The UI does not guess installed Python packages. Backend preflight checks real dependency and environment availability right before execution.',
    },
    {
      label: 'Shell arming',
      tone: !requiresShellArming ? 'info' as const : activeTab?.runtimeSettings?.shellExecutionEnabled ? 'ready' as const : 'attention' as const,
      value: !requiresShellArming ? 'not needed' : activeTab?.runtimeSettings?.shellExecutionEnabled ? 'armed' : 'off',
      help: !requiresShellArming ? 'No explicit shell tool is present in the current graph.' : activeTab?.runtimeSettings?.shellExecutionEnabled ? 'Bounded shell execution is armed for this graph.' : 'Shell tools stay blocked until the graph runtime setting explicitly arms them.',
    },
  ];

  const resolveDefaultTab = (): RunTab => (
    preferences.defaultRunPanelTab === 'json' && !preferences.showJsonTab
      ? 'inputs'
      : preferences.defaultRunPanelTab
  );

  const [runTab, setRunTab] = useState<RunTab>(resolveDefaultTab);
  const [copied, setCopied] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [rawInputsJson, setRawInputsJson] = useState('{\n  "messages": []\n}');
  const [inputMode, setInputMode] = useState<InputMode>('message');
  const [inputError, setInputError] = useState<string | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<{ mode: InputMode; value: string; inputs: Record<string, unknown> } | null>(null);
  const [runPresets, setRunPresets] = useState<RunInputPreset[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const matchingLogRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const hasError = runLogs.some((log) => log.type === 'error');
  const lastDone = [...runLogs].reverse().find((log) => log.type === 'completed');
  const latestError = [...runLogs].reverse().find((log) => log.type === 'error');
  const latestStarted = [...runLogs].reverse().find((log) => log.type === 'started');
  const primaryOutput = useMemo(() => derivePrimaryOutput(liveState), [liveState]);

  const executionTimeline = useMemo(() => deriveExecutionTimeline(edges, runLogs, { isRunning, isPaused, pendingNodeId, scheduledNodeIds: liveStateNext }), [edges, runLogs, isRunning, isPaused, pendingNodeId, liveStateNext]);

  const executionSummary = useMemo(() => {
    const startedAt = runLogs.find((log) => log.type === 'started')?.timestamp ?? null;
    const endedAt = [...runLogs].reverse().find((log) => log.type === 'completed' || log.type === 'error')?.timestamp ?? null;
    return {
      nodeUpdates: runLogs.filter((log) => log.type === 'node_update').length,
      errors: runLogs.filter((log) => log.type === 'error').length,
      pauses: runLogs.filter((log) => log.type === 'paused').length,
      logs: runLogs.length,
      duration: formatDuration(startedAt, endedAt),
      scope: latestStarted?.scopePath || '—',
    };
  }, [latestStarted?.scopePath, runLogs]);

  const lockRuntimeNode = (nodeId: string, source: 'timeline' | 'run_log' = 'timeline') => {
    setRuntimeHoverTarget(nodeId, source);
    updateRuntimeNavigationSettings({ lockHover: true });
    requestRuntimeFocus(nodeId, source);
  };

  const unlockRuntimeNode = (nodeId?: string) => {
    if (nodeId && runtimeHoverTarget?.nodeId && runtimeHoverTarget.nodeId !== nodeId) return;
    clearRuntimeHoverTarget();
    updateRuntimeNavigationSettings({ lockHover: false });
  };

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RUN_PRESETS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRunPresets(parsed.filter((item) => item && typeof item === 'object'));
        }
      }
    } catch {
      // ignore local storage failures
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(RUN_PRESETS_STORAGE_KEY, JSON.stringify(runPresets));
    } catch {
      // ignore local storage failures
    }
  }, [runPresets]);

  useEffect(() => {
    if (preferences.autoScrollLogs) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [preferences.autoScrollLogs, runLogs]);

  const selectedGraphNodeId = useMemo(() => nodes.find((node) => node.selected)?.id || null, [nodes]);
  const graphCorrelatedNodeId = runtimeHoverTarget?.source === 'graph' ? runtimeHoverTarget.nodeId : selectedGraphNodeId;

  useEffect(() => {
    if (!runtimeNavigationSettings.autoScrollMatchingLogs) return;
    if (!graphCorrelatedNodeId) return;
    if (!runLogs.some((entry) => entry.node === graphCorrelatedNodeId)) return;
    if (runTab !== 'execution') setRunTab('execution');
    window.requestAnimationFrame(() => {
      matchingLogRefs.current[graphCorrelatedNodeId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [runtimeNavigationSettings.autoScrollMatchingLogs, graphCorrelatedNodeId, runLogs, runTab]);

  useEffect(() => {
    if (isRunning || isPaused || runLogs.length > 0) {
      setRunTab('execution');
      return;
    }
    if (runPanelOpen) {
      setRunTab(resolveDefaultTab());
    }
  }, [isPaused, isRunning, runLogs.length, runPanelOpen, preferences.defaultRunPanelTab, preferences.showJsonTab]);

  useEffect(() => {
    if (!preferences.showJsonTab && runTab === 'json') {
      setRunTab('inputs');
    }
  }, [runTab, preferences.showJsonTab]);

  if (!runPanelOpen) return null;

  const json = exportJson();

  const handleCopy = () => {
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resolveInputsFromEditor = (): Record<string, unknown> | null => {
    if (inputMode === 'message') {
      setInputError(null);
      return initialMessage.trim()
        ? { messages: [{ role: 'user', content: initialMessage.trim() }] }
        : { messages: [] };
    }

    const parsed = parseJsonInputs(rawInputsJson);
    if (!parsed.ok) {
      setInputError(parsed.error);
      return null;
    }
    setInputError(null);
    return parsed.value;
  };

  const handleStart = () => {
    const inputs = resolveInputsFromEditor();
    if (!inputs) return;
    startRun(inputs);
    setLastSubmitted({
      mode: inputMode,
      value: inputMode === 'message' ? initialMessage : rawInputsJson,
      inputs,
    });
    setRunTab('execution');
  };

  const handleReplay = () => {
    if (!lastSubmitted) return;
    startRun(lastSubmitted.inputs);
    setRunTab('execution');
  };

  const handleResume = () => {
    if (!userInput.trim()) return;
    sendResume(userInput.trim());
    setUserInput('');
    setRunTab('execution');
  };

  const handleSavePreset = () => {
    const value = inputMode === 'message' ? initialMessage : rawInputsJson;
    const suggestedName = inputMode === 'message' ? 'Prompt run' : 'JSON run';
    const name = window.prompt('Preset name', suggestedName)?.trim();
    if (!name) return;

    setRunPresets((prev) => [
      {
        id: `preset_${Date.now()}`,
        name,
        mode: inputMode,
        value,
      },
      ...prev,
    ].slice(0, 12));
  };

  const applyPreset = (preset: RunInputPreset) => {
    setInputMode(preset.mode);
    if (preset.mode === 'message') {
      setInitialMessage(preset.value);
    } else {
      setRawInputsJson(preset.value || '{\n  "messages": []\n}');
    }
    setInputError(null);
    setRunTab('inputs');
  };

  const removePreset = (presetId: string) => {
    setRunPresets((prev) => prev.filter((preset) => preset.id !== presetId));
  };

  return (
    <div
      className="absolute bottom-0 left-0 right-0 glass border-t border-panel-border z-40"
      style={{
        height: `${preferences.runPanelHeightPercent}%`,
        minHeight: 280,
        maxHeight: '72%',
      }}
    >
      <div className="h-10 border-b border-panel-border flex items-center justify-between px-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Run</span>
          <div className="flex bg-panel rounded-md p-0.5 gap-0.5">
            <TabButton active={runTab === 'inputs'} onClick={() => setRunTab('inputs')}>
              <SlidersHorizontal size={12} /> Inputs
            </TabButton>
            <TabButton active={runTab === 'execution'} onClick={() => setRunTab('execution')}>
              <Zap size={12} /> Execution
            </TabButton>
            {preferences.showJsonTab && (
              <TabButton active={runTab === 'json'} onClick={() => setRunTab('json')}>
                <Code2 size={12} /> {simpleMode && preferences.deEmphasizeJsonInSimpleMode ? 'JSON · debug' : 'JSON'}
              </TabButton>
            )}
          </div>
          <div className="hidden md:flex items-center gap-1.5">
            <StatusPill kind={isRunning ? 'running' : isPaused ? 'paused' : hasError ? 'error' : lastDone ? 'ok' : 'idle'}>
              {isRunning ? 'Running' : isPaused ? 'Paused' : hasError ? 'Errors' : lastDone ? 'Completed' : 'Idle'}
            </StatusPill>
            {pendingNodeId && <StatusPill kind="paused">pause #{pendingNodeId}</StatusPill>}
            {runLogs.length > 0 && <StatusPill kind="idle">{runLogs.length} logs</StatusPill>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {runTab === 'json' && preferences.showJsonTab && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-slate-400 hover:text-white hover:bg-panel-hover transition-all"
            >
              <Copy size={12} />
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
          {runTab === 'execution' && (
            <button
              onClick={clearRunLogs}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-slate-400 hover:text-white hover:bg-panel-hover transition-all"
              title="Clear logs"
            >
              <Trash2 size={12} />
            </button>
          )}
          <button
            onClick={toggleRunPanel}
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-white hover:bg-panel-hover transition-all"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      <div className="h-[calc(100%-40px)] overflow-hidden flex flex-col">
        {runTab === 'inputs' && (
          <div className="flex-1 overflow-auto p-4 space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
              <div className="rounded-xl border border-panel-border bg-black/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-white">Run inputs</div>
                    <div className="text-[11px] text-slate-500">Choose a friendly user message or send a raw JSON input object.</div>
                  </div>
                  <div className="flex rounded-lg border border-panel-border bg-black/20 p-0.5">
                    <button
                      onClick={() => setInputMode('message')}
                      className={`px-2.5 py-1 rounded-md text-[11px] transition-all ${inputMode === 'message' ? 'bg-blue-500/15 text-blue-300' : 'text-slate-400 hover:text-white hover:bg-panel-hover'}`}
                    >
                      User message
                    </button>
                    <button
                      onClick={() => setInputMode('json')}
                      className={`px-2.5 py-1 rounded-md text-[11px] transition-all ${inputMode === 'json' ? 'bg-blue-500/15 text-blue-300' : 'text-slate-400 hover:text-white hover:bg-panel-hover'}`}
                    >
                      Raw JSON
                    </button>
                  </div>
                </div>

                {inputMode === 'message' ? (
                  <textarea
                    value={initialMessage}
                    onChange={(e) => setInitialMessage(e.target.value)}
                    placeholder="Example: summarize this graph run and point out risky branches."
                    className="w-full min-h-[130px] px-3 py-2 bg-panel border border-panel-border rounded-md text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                ) : (
                  <textarea
                    value={rawInputsJson}
                    onChange={(e) => setRawInputsJson(e.target.value)}
                    placeholder='{"messages": []}'
                    className="w-full min-h-[160px] px-3 py-2 bg-panel border border-panel-border rounded-md text-sm text-white placeholder:text-slate-500 font-mono focus:outline-none focus:border-blue-500"
                  />
                )}

                {inputError && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
                    {inputError}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleStart}
                    disabled={isRunning}
                    className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50"
                  >
                    {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                    Run
                  </button>
                  <button
                    onClick={handleReplay}
                    disabled={!lastSubmitted || isRunning}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border border-panel-border text-slate-200 hover:bg-panel-hover transition-all disabled:opacity-50"
                  >
                    <RotateCcw size={14} />
                    Replay last input
                  </button>
                  <button
                    onClick={handleSavePreset}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border border-panel-border text-slate-200 hover:bg-panel-hover transition-all"
                  >
                    <BookmarkPlus size={14} />
                    Save preset
                  </button>
                  {(isRunning || isPaused) && (
                    <button
                      onClick={stopRun}
                      className="ml-auto flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-red-600/80 hover:bg-red-500 text-white transition-all"
                    >
                      <Square size={14} />
                      Stop
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-panel-border bg-black/20 p-4 space-y-3" data-testid="runtime-readiness-checklist">
                  <div>
                    <div className="text-sm font-medium text-white">Runtime readiness</div>
                    <div className="text-[11px] text-slate-500">Graph truth is checked locally first. Dependency and environment checks are confirmed by backend preflight on Run.</div>
                  </div>
                  <div className="space-y-2">
                    {readinessRows.map((row) => (
                      <ReadinessRow key={row.label} label={row.label} tone={row.tone} value={row.value} help={row.help} />
                    ))}
                  </div>
                  {likelyBlockers.length > 0 && (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2" data-testid="runtime-likely-blockers">
                      <div className="text-[11px] font-medium text-amber-100">Likely blockers before first successful run</div>
                      <ul className="mt-2 space-y-1 text-[10px] leading-5 text-amber-50">
                        {likelyBlockers.map((item) => (
                          <li key={item.id}>• {item.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="rounded-lg border border-panel-border bg-black/20 px-3 py-2" data-testid="runtime-run-path">
                    <div className="text-[11px] font-medium text-slate-100">What Run checks, in order</div>
                    <ul className="mt-2 space-y-2 text-[10px] leading-5 text-slate-300">
                      {runPathSteps.map((step) => (
                        <li key={step.id}>
                          <div className="text-slate-100">{step.title}</div>
                          <div className="text-slate-500">{step.body}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="rounded-xl border border-panel-border bg-black/20 p-4 space-y-3">
                  <div>
                    <div className="text-sm font-medium text-white">Validation surface</div>
                    <div className="text-[11px] text-slate-500">Compact run summary once execution starts.</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill kind={isRunning ? 'running' : 'idle'}>{isRunning ? 'Runtime active' : 'Runtime idle'}</StatusPill>
                    {isPaused && <StatusPill kind="paused">Waiting for resume</StatusPill>}
                    {hasError && <StatusPill kind="error">At least one error</StatusPill>}
                    {lastDone && !hasError && !isRunning && !isPaused && <StatusPill kind="ok">Last run completed</StatusPill>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                    <div>Logs: <span className="text-slate-200">{executionSummary.logs}</span></div>
                    <div>Node updates: <span className="text-slate-200">{executionSummary.nodeUpdates}</span></div>
                    <div>Pending node: <span className="text-slate-200">{pendingNodeId || '—'}</span></div>
                    <div>Duration: <span className="text-slate-200">{executionSummary.duration}</span></div>
                  </div>
                  {lastSubmitted && (
                    <div className="rounded-lg border border-panel-border bg-black/20 px-3 py-2 text-[11px] text-slate-400">
                      Last replayable input: <span className="text-slate-200">{lastSubmitted.mode === 'message' ? 'User message' : 'Raw JSON'}</span>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-panel-border bg-black/20 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-white">Input presets</div>
                      <div className="text-[11px] text-slate-500">Reusable run inputs for quick graph checks.</div>
                    </div>
                    <span className="text-[11px] text-slate-500">{runPresets.length}/12</span>
                  </div>
                  {runPresets.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-panel-border px-3 py-4 text-[12px] text-slate-500 text-center">
                      No saved presets yet.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-auto pr-1 scrollbar-thin">
                      {runPresets.map((preset) => (
                        <div key={preset.id} className="rounded-lg border border-panel-border bg-black/20 px-3 py-2 flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm text-slate-100">
                              <Bookmark size={12} className="text-slate-400" />
                              <span className="truncate">{preset.name}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                              {preset.mode === 'message' ? 'User message' : 'Raw JSON'} · {preset.value.trim() ? preset.value.trim().slice(0, 90) : 'empty input'}
                            </div>
                          </div>
                          <button
                            onClick={() => applyPreset(preset)}
                            className="px-2 py-1 rounded-md text-[11px] border border-panel-border text-slate-200 hover:bg-panel-hover transition-all"
                          >
                            Use
                          </button>
                          <button
                            onClick={() => removePreset(preset.id)}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-red-300 hover:bg-red-500/10 transition-all"
                            title="Delete preset"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {runTab === 'json' && preferences.showJsonTab && (
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {simpleMode && preferences.deEmphasizeJsonInSimpleMode && (
              <div className="rounded-xl border border-panel-border bg-black/20 p-3 text-[12px] text-slate-400">
                Raw JSON remains useful for debugging and export inspection, but it is not the primary testing surface in simple mode.
              </div>
            )}
            <pre className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">{json}</pre>
          </div>
        )}

        {runTab === 'execution' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-panel-border flex items-center gap-2 flex-wrap">
              <StatusPill kind={isRunning ? 'running' : isPaused ? 'paused' : hasError ? 'error' : lastDone ? 'ok' : 'idle'}>
                {isRunning ? 'Execution in progress' : isPaused ? 'Interrupted — waiting' : hasError ? 'Errors detected' : lastDone ? 'Run completed' : 'No run yet'}
              </StatusPill>
              {pendingNodeId && <StatusPill kind="paused">node #{pendingNodeId}</StatusPill>}
              {!isRunning && !isPaused && (
                <button
                  onClick={handleReplay}
                  disabled={!lastSubmitted}
                  className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border border-panel-border text-slate-200 hover:bg-panel-hover transition-all disabled:opacity-50"
                >
                  <RotateCcw size={12} />
                  Replay
                </button>
              )}
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={Clock3} label="Duration" value={executionSummary.duration} />
                <StatCard icon={ListChecks} label="Node updates" value={String(executionSummary.nodeUpdates)} />
                <StatCard icon={AlertCircle} label="Errors" value={String(executionSummary.errors)} />
                <StatCard icon={Unplug} label="Paused events" value={String(executionSummary.pauses)} />
              </div>

              <ExecutionTimelineCard
                steps={executionTimeline.steps}
                scheduledNodeIds={executionTimeline.scheduledNodeIds}
                activeNodeId={executionTimeline.activeNodeId}
                hoveredNodeId={runtimeHoverTarget?.nodeId || null}
                lockedNodeId={runtimeNavigationSettings.lockHover ? runtimeHoverTarget?.nodeId || null : null}
                onFocusNode={(nodeId) => requestRuntimeFocus(nodeId, 'timeline')}
                onHoverNode={(nodeId) => setRuntimeHoverTarget(nodeId, 'timeline')}
                onClearHover={(nodeId) => { if (!runtimeNavigationSettings.lockHover) clearRuntimeHoverTarget('timeline', nodeId); }}
                onLockNode={(nodeId) => lockRuntimeNode(nodeId, 'timeline')}
                onUnlockNode={(nodeId) => unlockRuntimeNode(nodeId)}
              />

              <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-4">
                <div className="rounded-xl border border-panel-border bg-black/20 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-white">Primary output</div>
                      <div className="text-[11px] text-slate-500">Best-effort read from the latest live graph state.</div>
                    </div>
                    {primaryOutput && <StatusPill kind="ok">{primaryOutput.key}</StatusPill>}
                  </div>
                  {primaryOutput ? (
                    <>
                      <div className="text-[11px] text-slate-500">{summarizeValue(primaryOutput.value)}</div>
                      <pre className="text-xs text-slate-300 whitespace-pre-wrap break-words font-mono rounded-lg border border-panel-border bg-black/20 p-3 max-h-[220px] overflow-auto">{typeof primaryOutput.value === 'string' ? primaryOutput.value : JSON.stringify(primaryOutput.value, null, 2)}</pre>
                    </>
                  ) : (
                    <div className="rounded-lg border border-dashed border-panel-border px-3 py-6 text-center text-sm text-slate-500">
                      No primary output detected yet. Run the graph to surface live state.
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-panel-border bg-black/20 p-4 space-y-2">
                    <div>
                      <div className="text-sm font-medium text-white">Execution summary</div>
                      <div className="text-[11px] text-slate-500">Fast signal before the detailed event stream.</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                      <div>Logs: <span className="text-slate-200">{executionSummary.logs}</span></div>
                      <div>Scope: <span className="text-slate-200">{executionSummary.scope}</span></div>
                      <div>Status: <span className="text-slate-200">{isRunning ? 'running' : isPaused ? 'paused' : hasError ? 'error' : lastDone ? 'completed' : 'idle'}</span></div>
                      <div>Pending node: <span className="text-slate-200">{pendingNodeId || '—'}</span></div>
                    </div>
                  </div>

                  {(latestError || isPaused) && (
                    <div className={`rounded-xl border p-4 space-y-2 ${latestError ? 'border-red-500/25 bg-red-500/10' : 'border-amber-500/25 bg-amber-500/10'}`}>
                      <div className="flex items-center gap-2 text-sm font-medium text-white">
                        {latestError ? <AlertCircle size={14} className="text-red-300" /> : <PauseCircle size={14} className="text-amber-300" />}
                        <span>{latestError ? 'Latest issue' : 'Awaiting resume input'}</span>
                      </div>
                      <div className="text-[12px] text-slate-200 whitespace-pre-wrap break-words">
                        {latestError?.message || `The runtime is waiting for a response on node ${pendingNodeId || '—'}.`}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {runLogs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-panel-border p-6 text-center text-sm text-slate-500">
                  Launch a run to inspect runtime events, pauses and state changes.
                </div>
              ) : (
                <div className="space-y-3">
                  {runLogs.map((entry, index) => <LogEntryCard key={`${entry.type}-${index}`} entry={entry} hoveredNodeId={runtimeHoverTarget?.nodeId || null} lockedNodeId={runtimeNavigationSettings.lockHover ? runtimeHoverTarget?.nodeId || null : null} onFocusNode={(nodeId) => requestRuntimeFocus(nodeId, 'run_log')} onHoverNode={(nodeId) => setRuntimeHoverTarget(nodeId, 'run_log')} onClearHover={(nodeId) => { if (!runtimeNavigationSettings.lockHover) clearRuntimeHoverTarget('run_log', nodeId); }} onLockNode={(nodeId) => lockRuntimeNode(nodeId, 'run_log')} onUnlockNode={(nodeId) => unlockRuntimeNode(nodeId)} entryRef={entry.node ? (element) => { matchingLogRefs.current[entry.node!] = element; } : undefined} />)}
                </div>
              )}
              <div ref={logsEndRef} />
            </div>

            {isPaused && (
              <div className="border-t border-panel-border p-4 bg-black/20">
                <div className="text-xs font-medium text-white mb-2">User response required</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Answer the interruption..."
                    className="flex-1 px-3 py-2 bg-panel border border-panel-border rounded-md text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleResume()}
                  />
                  <button
                    onClick={handleResume}
                    disabled={!userInput.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-50"
                  >
                    <Send size={14} />
                    Resume
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
