const MEMORY_SURFACE_LABELS: Record<string, string> = {
  memory_checkpoint: 'Checkpoint marker',
  memory_store_read: 'Profile store read',
  memoryreader: 'Store read helper',
  memory_access: 'Memory access',
  memorywriter: 'Store write helper',
  store_put: 'Store put',
  store_search: 'Store search',
  store_get: 'Store get',
  store_delete: 'Store delete',
  rag_retriever_local: 'Local RAG retrieval',
  context_trimmer: 'Context trimmer',
};

const MEMORY_ROLE_LABELS: Record<string, string> = {
  canonical_memory_access_surface: 'Canonical memory access surface',
  checkpoint_enabler: 'Checkpoint enabler',
  context_window_manager: 'Context window manager',
  profile_store_reader: 'Profile store reader',
  retrieval_surface: 'Retrieval surface',
  store_crud_surface: 'Runtime store CRUD surface',
  store_read_helper: 'Legacy store read helper',
  store_write_helper: 'Legacy store write helper',
  memory_consumer: 'Memory payload consumer',
  child_subgraph_memory_consumer: 'Child subgraph memory consumer',
  langchain_agent_artifact_memory_consumer: 'LangChain agent artifact memory consumer',
  ephemeral_subagent_tool: 'Ephemeral subagent tool',
};

const MEMORY_SYSTEM_KIND_LABELS: Record<string, string> = {
  checkpoint_graph_marker: 'Graph checkpoint marker',
  context_window_trim: 'Context trimming',
  retrieval_index: 'Local vector index',
  runtime_memory_access_surface: 'Runtime store access surface',
  runtime_store_delete: 'Runtime store delete',
  runtime_store_get: 'Runtime store get',
  runtime_store_profile: 'Runtime store profile lookup',
  runtime_store_put: 'Runtime store put',
  runtime_store_read_helper: 'Legacy runtime store read helper',
  runtime_store_search: 'Runtime store search',
  runtime_store_write_helper: 'Legacy runtime store write helper',
  memory_input_consumer: 'Memory input consumer',
};

const MEMORY_ACCESS_MODEL_LABELS: Record<string, string> = {
  graph_memory_input_payload: 'Graph memory payload input',
  graph_memory_input_payload_forwarded_to_child_subgraph: 'Graph memory payload forwarded to child subgraph',
  graph_memory_input_payload_forwarded_to_langchain_agent_artifact: 'Graph memory payload forwarded to LangChain agent artifact',
  local_vector_index_query: 'Vector-index query',
  runtime_store_helper_key_read: 'Runtime store helper key read',
  runtime_store_helper_key_write: 'Runtime store helper key write',
  runtime_store_lookup_by_user_namespace: 'User-scoped runtime store lookup',
  runtime_store_profile_get_or_search_projection: 'Runtime store profile/get/search projection',
  runtime_store_put: 'Runtime store put',
  runtime_store_search: 'Runtime store search',
  runtime_store_get: 'Runtime store get',
  thread_state_checkpointing: 'Thread-state checkpointing',
  thread_state_message_trimming: 'Thread-state message trimming',
  subagent_library_definition_with_ephemeral_invocation: 'Subagent library definition with ephemeral invocation',
};

const MEMORY_DURABILITY_LABELS: Record<string, string> = {
  depends_on_reference_or_embedded_artifact: 'Depends on referenced or embedded artifact',
  ephemeral_thread_state: 'Ephemeral thread state',
  local_vector_index_persisted_outside_graph_state: 'Persisted vector index outside graph state',
  runtime_checkpoint_graph_scope_marker: 'Graph-scope checkpointing when a checkpointer is configured',
  runtime_dependent: 'Runtime-dependent',
  store_runtime_sqlite_local_user_configurable: 'Runtime store (SQLite local, user-configurable)',
  store_runtime_user_selectable_backend: 'Runtime store (in-memory or SQLite local)',
  depends_on_upstream_memory_surface: 'Depends on upstream memory surface',
};

const MEMORY_OPERATION_LABELS: Record<string, string> = {
  memory_access_get: 'Store get',
  memory_access_profile_read: 'Profile read',
  memory_access_search: 'Store search',
  memory_consume: 'Memory payload consume',
  memory_forward: 'Memory payload forward',
  memory_read: 'Store helper read',
  memory_write: 'Store helper write',
  trim_messages: 'Trim messages',
  trim_noop: 'Trim noop',
};

const STORE_BACKEND_LABELS: Record<string, string> = {
  in_memory: 'In-memory',
  sqlite_local: 'SQLite local',
};

export type MemorySurfaceLaneId =
  | 'checkpoint_thread_state'
  | 'runtime_store_canonical'
  | 'runtime_store_explicit'
  | 'vector_retrieval'
  | 'context_window'
  | 'memory_input'
  | 'runtime_store_legacy'
  | 'other';

const MEMORY_LANE_LABELS: Record<MemorySurfaceLaneId, string> = {
  checkpoint_thread_state: 'Checkpointing / thread state',
  runtime_store_canonical: 'Runtime store — canonical',
  runtime_store_explicit: 'Runtime store — explicit CRUD',
  vector_retrieval: 'Local RAG / embeddings',
  context_window: 'Context window control',
  memory_input: 'Memory payload consumers',
  runtime_store_legacy: 'Runtime store — legacy helpers',
  other: 'Other memory-adjacent surfaces',
};

const MEMORY_LANE_DESCRIPTIONS: Record<MemorySurfaceLaneId, string> = {
  checkpoint_thread_state: 'Per-thread snapshots and checkpoint markers. This lane is about continuation and recovery, not store CRUD and not vector retrieval.',
  runtime_store_canonical: 'Recommended bounded runtime-store access surfaces for first-success authoring. Prefer this lane before helper aliases or lower-level variants.',
  runtime_store_explicit: 'More explicit runtime-store CRUD surfaces. Useful when you want direct get/search/delete/put control after the canonical path is understood.',
  vector_retrieval: 'Embedding-backed retrieval against a persisted vector index. This lane is separate from checkpoint state and from runtime-store key/value memory.',
  context_window: 'Context-shaping helpers that trim or manage message history. Adjacent to execution memory, but not a retrieval or store surface.',
  memory_input: 'Consumers of memory payloads produced elsewhere. They do not own persistence on their own.',
  runtime_store_legacy: 'Older helper aliases kept for compatibility. Still supported, but not the clearest first-success path.',
  other: 'Memory-adjacent behavior that does not fit the main first-success lanes cleanly.',
};

const MEMORY_FIRST_SUCCESS_PRIORITY: Record<string, number> = {
  memory_checkpoint: 0,
  memory_access: 1,
  store_put: 2,
  rag_retriever_local: 3,
  store_get: 4,
  store_search: 5,
  context_trimmer: 6,
  store_delete: 7,
  memoryreader: 20,
  memorywriter: 21,
  memory_store_read: 22,
  deep_memory_skill: 23,
};

function humanize(raw: string): string {
  return raw.replace(/_/g, ' ');
}

export function getMemorySurfaceLabel(nodeType: string, fallback?: string | null): string {
  return MEMORY_SURFACE_LABELS[nodeType] || fallback || humanize(nodeType);
}

export function getMemoryRoleLabel(role?: string | null): string {
  if (!role) return '—';
  return MEMORY_ROLE_LABELS[role] || humanize(role);
}

export function getMemorySystemKindLabel(kind?: string | null): string {
  if (!kind) return '—';
  return MEMORY_SYSTEM_KIND_LABELS[kind] || humanize(kind);
}

export function getMemoryAccessModelLabel(model?: string | null): string {
  if (!model) return '—';
  return MEMORY_ACCESS_MODEL_LABELS[model] || humanize(model);
}

export function getMemoryDurabilityLabel(durability?: string | null): string {
  if (!durability) return '—';
  return MEMORY_DURABILITY_LABELS[durability] || humanize(durability);
}

export function getMemoryOperationLabel(operation?: string | null): string {
  if (!operation) return '—';
  return MEMORY_OPERATION_LABELS[operation] || humanize(operation);
}

export function getStoreBackendLabel(backend?: string | null): string {
  if (!backend) return '—';
  return STORE_BACKEND_LABELS[backend] || humanize(backend);
}

export function getPreferredMemorySurfaceLabel(preferredSurface?: string | boolean | null): string {
  if (preferredSurface === true || preferredSurface === 'this_node') return 'This node';
  if (!preferredSurface) return '—';
  return getMemorySurfaceLabel(String(preferredSurface));
}

export function getMemoryLaneId(
  nodeType: string,
  options?: {
    memorySystemKind?: string | null;
    memoryAccessModel?: string | null;
    memoryRole?: string | null;
    legacyHelperSurface?: boolean | null;
    memoryConsumer?: boolean | null;
  },
): MemorySurfaceLaneId {
  const kind = options?.memorySystemKind || null;
  const accessModel = options?.memoryAccessModel || null;
  const role = options?.memoryRole || null;
  const legacy = options?.legacyHelperSurface === true;
  const consumer = options?.memoryConsumer === true;

  if (
    consumer
    || kind === 'memory_input_consumer'
    || accessModel === 'graph_memory_input_payload'
    || accessModel === 'graph_memory_input_payload_forwarded_to_child_subgraph'
    || accessModel === 'graph_memory_input_payload_forwarded_to_langchain_agent_artifact'
  ) return 'memory_input';

  if (nodeType === 'memory_checkpoint' || accessModel === 'thread_state_checkpointing' || kind === 'checkpoint_graph_marker') {
    return 'checkpoint_thread_state';
  }

  if (nodeType === 'rag_retriever_local' || kind === 'retrieval_index' || accessModel === 'local_vector_index_query') {
    return 'vector_retrieval';
  }

  if (nodeType === 'context_trimmer' || kind === 'context_window_trim' || accessModel === 'thread_state_message_trimming') {
    return 'context_window';
  }

  if (legacy) return 'runtime_store_legacy';

  if (nodeType === 'memory_access' || kind === 'runtime_memory_access_surface' || role === 'canonical_memory_access_surface') {
    return 'runtime_store_canonical';
  }

  if (
    nodeType === 'store_put'
    || nodeType === 'store_get'
    || nodeType === 'store_search'
    || nodeType === 'store_delete'
    || kind === 'runtime_store_put'
    || kind === 'runtime_store_get'
    || kind === 'runtime_store_search'
    || kind === 'runtime_store_delete'
    || kind === 'runtime_store_profile'
  ) {
    return 'runtime_store_explicit';
  }

  return 'other';
}

export function getMemoryLaneLabel(lane: MemorySurfaceLaneId): string {
  return MEMORY_LANE_LABELS[lane];
}

export function getMemoryLaneDescription(lane: MemorySurfaceLaneId): string {
  return MEMORY_LANE_DESCRIPTIONS[lane];
}

export function getMemoryLanePriority(lane: MemorySurfaceLaneId): number {
  switch (lane) {
    case 'checkpoint_thread_state':
      return 0;
    case 'runtime_store_canonical':
      return 1;
    case 'runtime_store_explicit':
      return 2;
    case 'vector_retrieval':
      return 3;
    case 'context_window':
      return 4;
    case 'memory_input':
      return 5;
    case 'runtime_store_legacy':
      return 6;
    case 'other':
    default:
      return 7;
  }
}

export function getMemoryFirstSuccessPriority(
  nodeType: string,
  options?: {
    memorySystemKind?: string | null;
    memoryAccessModel?: string | null;
    memoryRole?: string | null;
    legacyHelperSurface?: boolean | null;
    memoryConsumer?: boolean | null;
  },
): number {
  const direct = MEMORY_FIRST_SUCCESS_PRIORITY[nodeType];
  if (typeof direct === 'number') return direct;
  return 100 + getMemoryLanePriority(getMemoryLaneId(nodeType, options));
}

export function isCanonicalFirstSuccessMemorySurface(
  nodeType: string,
  options?: {
    memorySystemKind?: string | null;
    memoryAccessModel?: string | null;
    memoryRole?: string | null;
    legacyHelperSurface?: boolean | null;
    memoryConsumer?: boolean | null;
  },
): boolean {
  if (nodeType === 'memory_checkpoint' || nodeType === 'memory_access' || nodeType === 'store_put' || nodeType === 'rag_retriever_local') return true;
  const lane = getMemoryLaneId(nodeType, options);
  return lane === 'checkpoint_thread_state' || lane === 'runtime_store_canonical' || lane === 'vector_retrieval';
}
