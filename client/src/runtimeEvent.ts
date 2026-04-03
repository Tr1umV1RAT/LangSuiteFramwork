import { parseToolObservation, type ToolObservation } from './executionTruth';

export interface RuntimeEventRecord {
  schemaVersion: string;
  eventType: string;
  kind: string;
  primaryNodeId: string | null;
  nodeIds: string[];
  nodeId: string | null;
  nextNodes: string[];
  phase: string | null;
  stage: string | null;
  status: string | null;
  reasonCode: string | null;
  graphScope: string | null;
  scopeLineage: string[];
  artifactType: string | null;
  executionProfile: string | null;
  observation: ToolObservation | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function parseEmbeddedObservationFromUpdate(value: unknown): ToolObservation | null {
  const record = asRecord(value);
  if (!record) return null;
  for (const child of Object.values(record)) {
    const parsed = parseToolObservation(child);
    if (parsed) return parsed;
  }
  return null;
}

function deriveRuntimeEvent(msg: Record<string, unknown>): RuntimeEventRecord {
  const type = typeof msg.type === 'string' ? msg.type : 'unknown';
  const runtime: RuntimeEventRecord = {
    schemaVersion: 'legacy_fallback',
    eventType: type,
    kind: 'opaque',
    primaryNodeId: null,
    nodeIds: [],
    nodeId: null,
    nextNodes: [],
    phase: null,
    stage: typeof msg.stage === 'string' ? msg.stage : null,
    status: null,
    reasonCode: typeof msg.reasonCode === 'string' ? msg.reasonCode : null,
    graphScope: typeof msg.graph_scope === 'string' ? msg.graph_scope : null,
    scopeLineage: asStringArray(msg.scope_lineage),
    artifactType: typeof msg.artifact_type === 'string' ? msg.artifact_type : null,
    executionProfile: typeof msg.execution_profile === 'string' ? msg.execution_profile : null,
    observation: null,
  };

  if (type === 'node_update') {
    const data = asRecord(msg.data) || {};
    const nodeIds = Object.keys(data);
    const primaryNodeId = nodeIds[0] || null;
    runtime.kind = 'runtime_update';
    runtime.nodeIds = nodeIds;
    runtime.primaryNodeId = primaryNodeId;
    runtime.nodeId = primaryNodeId;
    runtime.observation = primaryNodeId ? parseToolObservation(data[primaryNodeId]) : null;
  } else if (type === 'state_sync') {
    runtime.kind = 'state';
    runtime.nextNodes = asStringArray(msg.next);
  } else if (type === 'embedded_trace') {
    runtime.kind = 'trace';
    runtime.nodeId = typeof msg.node_id === 'string' ? msg.node_id : null;
    runtime.phase = typeof msg.phase === 'string' ? msg.phase : null;
    runtime.observation = parseEmbeddedObservationFromUpdate(msg.update);
  } else if (type === 'error') {
    runtime.kind = 'error';
  } else if (type === 'started' || type === 'paused' || type === 'completed' || type === 'stopped') {
    runtime.kind = 'lifecycle';
    runtime.status = type;
    runtime.nodeId = typeof msg.pending_node === 'string' ? msg.pending_node : null;
  }

  return runtime;
}

export function getRuntimeEvent(msg: unknown): RuntimeEventRecord | null {
  const record = asRecord(msg);
  if (!record) return null;
  const runtime = asRecord(record.runtime);
  if (runtime && runtime.schemaVersion === 'runtime_event_v1') {
    return {
      schemaVersion: 'runtime_event_v1',
      eventType: typeof runtime.eventType === 'string' ? runtime.eventType : (typeof record.type === 'string' ? record.type : 'unknown'),
      kind: typeof runtime.kind === 'string' ? runtime.kind : 'opaque',
      primaryNodeId: typeof runtime.primaryNodeId === 'string' ? runtime.primaryNodeId : null,
      nodeIds: asStringArray(runtime.nodeIds),
      nodeId: typeof runtime.nodeId === 'string' ? runtime.nodeId : null,
      nextNodes: asStringArray(runtime.nextNodes),
      phase: typeof runtime.phase === 'string' ? runtime.phase : null,
      stage: typeof runtime.stage === 'string' ? runtime.stage : (typeof record.stage === 'string' ? record.stage : null),
      status: typeof runtime.status === 'string' ? runtime.status : null,
      reasonCode: typeof runtime.reasonCode === 'string' ? runtime.reasonCode : (typeof record.reasonCode === 'string' ? record.reasonCode : null),
      graphScope: typeof runtime.graphScope === 'string' ? runtime.graphScope : (typeof record.graph_scope === 'string' ? record.graph_scope : null),
      scopeLineage: asStringArray(runtime.scopeLineage).length > 0 ? asStringArray(runtime.scopeLineage) : asStringArray(record.scope_lineage),
      artifactType: typeof runtime.artifactType === 'string' ? runtime.artifactType : (typeof record.artifact_type === 'string' ? record.artifact_type : null),
      executionProfile: typeof runtime.executionProfile === 'string' ? runtime.executionProfile : (typeof record.execution_profile === 'string' ? record.execution_profile : null),
      observation: parseToolObservation(runtime.observation),
    };
  }
  return deriveRuntimeEvent(record);
}
