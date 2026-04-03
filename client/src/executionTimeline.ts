import type { Edge } from '@xyflow/react';
import type { RunLogEntry } from './store/types';
import { parseToolObservation, summarizeToolObservation } from './executionTruth';

export interface ExecutionStep {
  order: number;
  nodeId: string;
  timestamp: number;
  entryType: RunLogEntry['type'];
  summary: string | null;
  executionStatus: string | null;
  reasonCode: string | null;
}

export interface ExecutionTimeline {
  steps: ExecutionStep[];
  latestNodeId: string | null;
  activeNodeId: string | null;
  awaitingNodeId: string | null;
  scheduledNodeIds: string[];
  firstStepByNodeId: Record<string, number>;
  lastStepByNodeId: Record<string, number>;
  visitCountByNodeId: Record<string, number>;
  traversedEdgeIds: string[];
  activePathEdgeIds: string[];
  scheduledPathEdgeIds: string[];
  emphasisedEdgeIds: string[];
  edgeStateById: Record<string, 'idle' | 'traversed' | 'active' | 'scheduled' | 'muted'>;
}

function pushNodeStep(steps: ExecutionStep[], entry: RunLogEntry, nodeId: string, summary: string | null, executionStatus: string | null, reasonCode: string | null): void {
  steps.push({
    order: steps.length + 1,
    nodeId,
    timestamp: entry.timestamp,
    entryType: entry.type,
    summary,
    executionStatus,
    reasonCode,
  });
}

function edgeKey(source: string, target: string): string {
  return `${source}→${target}`;
}

export function deriveExecutionTimeline(
  edges: Edge[],
  runLogs: RunLogEntry[],
  runtime: {
    isRunning?: boolean;
    isPaused?: boolean;
    pendingNodeId?: string | null;
    scheduledNodeIds?: string[];
  } = {},
): ExecutionTimeline {
  const steps: ExecutionStep[] = [];

  runLogs.forEach((entry) => {
    if (entry.type === 'node_update' || entry.type === 'embedded_trace') {
      if (!entry.node) return;
      const observation = parseToolObservation(entry.data);
      pushNodeStep(
        steps,
        entry,
        entry.node,
        observation ? (entry.operationSummary || summarizeToolObservation(observation)) : (entry.message || null),
        observation?.status || entry.executionStatus || null,
        observation?.reasonCode || entry.reasonCode || null,
      );
      return;
    }
    if (entry.type === 'paused' && entry.node) {
      pushNodeStep(steps, entry, entry.node, entry.message || 'Awaiting user input', 'paused', entry.reasonCode || null);
    }
  });

  const firstStepByNodeId: Record<string, number> = {};
  const lastStepByNodeId: Record<string, number> = {};
  const visitCountByNodeId: Record<string, number> = {};
  steps.forEach((step) => {
    if (firstStepByNodeId[step.nodeId] == null) firstStepByNodeId[step.nodeId] = step.order;
    lastStepByNodeId[step.nodeId] = step.order;
    visitCountByNodeId[step.nodeId] = (visitCountByNodeId[step.nodeId] || 0) + 1;
  });

  const pairToEdges = new Map<string, string[]>();
  edges.forEach((edge) => {
    const key = edgeKey(edge.source, edge.target);
    const current = pairToEdges.get(key) || [];
    current.push(edge.id);
    pairToEdges.set(key, current);
  });

  const traversedEdgeIds = new Set<string>();
  for (let i = 0; i < steps.length - 1; i += 1) {
    const source = steps[i]?.nodeId;
    const target = steps[i + 1]?.nodeId;
    if (!source || !target || source === target) continue;
    (pairToEdges.get(edgeKey(source, target)) || []).forEach((id) => traversedEdgeIds.add(id));
  }

  const scheduledNodeIds = Array.from(new Set((runtime.scheduledNodeIds || []).filter((value): value is string => typeof value === 'string' && value.trim().length > 0)));
  const latestNodeId = steps.length > 0 ? steps[steps.length - 1].nodeId : null;
  const awaitingNodeId = runtime.isPaused && runtime.pendingNodeId ? runtime.pendingNodeId : null;
  const activeNodeId = awaitingNodeId || ((runtime.isRunning || runtime.isPaused) ? latestNodeId : null);

  const activePathEdgeIds = new Set<string>();
  if (activeNodeId && steps.length >= 2) {
    const latestIndex = [...steps].reverse().findIndex((step) => step.nodeId === activeNodeId);
    const activeStepIndex = latestIndex >= 0 ? steps.length - 1 - latestIndex : -1;
    const prevStep = activeStepIndex > 0 ? steps[activeStepIndex - 1] : null;
    if (prevStep && prevStep.nodeId !== activeNodeId) {
      (pairToEdges.get(edgeKey(prevStep.nodeId, activeNodeId)) || []).forEach((id) => activePathEdgeIds.add(id));
    }
  }

  const scheduledPathEdgeIds = new Set<string>();
  if (activeNodeId && scheduledNodeIds.length > 0) {
    scheduledNodeIds.forEach((nodeId) => {
      (pairToEdges.get(edgeKey(activeNodeId, nodeId)) || []).forEach((id) => scheduledPathEdgeIds.add(id));
    });
  }

  const emphasisedEdgeIds = new Set<string>([
    ...traversedEdgeIds,
    ...activePathEdgeIds,
    ...scheduledPathEdgeIds,
  ]);

  const edgeStateById: Record<string, 'idle' | 'traversed' | 'active' | 'scheduled' | 'muted'> = {};
  edges.forEach((edge) => {
    if (activePathEdgeIds.has(edge.id)) edgeStateById[edge.id] = 'active';
    else if (scheduledPathEdgeIds.has(edge.id)) edgeStateById[edge.id] = 'scheduled';
    else if (traversedEdgeIds.has(edge.id)) edgeStateById[edge.id] = 'traversed';
    else if ((runtime.isRunning || runtime.isPaused) && emphasisedEdgeIds.size > 0) edgeStateById[edge.id] = 'muted';
    else edgeStateById[edge.id] = 'idle';
  });

  return {
    steps,
    latestNodeId,
    activeNodeId,
    awaitingNodeId,
    scheduledNodeIds,
    firstStepByNodeId,
    lastStepByNodeId,
    visitCountByNodeId,
    traversedEdgeIds: Array.from(traversedEdgeIds),
    activePathEdgeIds: Array.from(activePathEdgeIds),
    scheduledPathEdgeIds: Array.from(scheduledPathEdgeIds),
    emphasisedEdgeIds: Array.from(emphasisedEdgeIds),
    edgeStateById,
  };
}
