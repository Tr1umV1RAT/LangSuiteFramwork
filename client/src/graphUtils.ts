import type { Connection, Edge, Node } from '@xyflow/react';

export interface GraphComponent {
  id: number;
  nodeIds: Set<string>;
  nodes: Node[];
  edges: Edge[];
  entryNodeId: string | null;
}

export type EdgeSemanticKind =
  | 'direct_flow'
  | 'tool_attachment'
  | 'memory_feed'
  | 'context_feed'
  | 'document_feed'
  | 'state_flow'
  | 'message_flow'
  | 'data_flow'
  | 'fanout_dispatch'
  | 'worker_reduce';

export interface EdgeSemanticDecoration {
  semanticKind: EdgeSemanticKind;
  className: string;
  semanticSummary: string;
}

export interface ConnectionValidationResult {
  valid: boolean;
  reasonCode?: string;
  semanticKind?: EdgeSemanticKind;
}


export interface ConnectionReasonDescription {
  title: string;
  message: string;
  suggestion?: string;
}

const CONNECTION_REASON_DESCRIPTIONS: Record<string, ConnectionReasonDescription> = {
  missing_connection_endpoints: {
    title: 'Connexion incomplète',
    message: 'La connexion n’a pas de source ou de cible complète.',
    suggestion: 'Relâche le lien sur une pastille compatible.',
  },
  self_loop_not_supported: {
    title: 'Boucle directe refusée',
    message: 'Ce geste créerait une auto-boucle triviale sur le même bloc.',
    suggestion: 'Passe par un routeur, un worker ou un état intermédiaire si c’est réellement voulu.',
  },
  duplicate_edge_not_supported: {
    title: 'Connexion déjà présente',
    message: 'Ce lien exact existe déjà sur le canvas.',
    suggestion: 'Réutilise le lien existant ou change de poignée si la sémantique est différente.',
  },
  missing_connection_node: {
    title: 'Bloc introuvable',
    message: 'La connexion vise un bloc qui n’est plus présent sur le canvas.',
    suggestion: 'Actualise la sélection ou recrée le bloc cible.',
  },
  tool_handle_requires_tools_in: {
    title: 'Lien tool incomplet',
    message: 'Une sortie tool doit arriver sur la pastille tools du bloc cible.',
    suggestion: 'Relie tool_out vers tools_in.',
  },
  tools_in_requires_tool_out: {
    title: 'Pastille tools protégée',
    message: 'La pastille tools n’accepte qu’un lien issu de tool_out.',
    suggestion: 'Pars d’un bloc tool ou d’un bloc qui expose tool_out.',
  },
  fanout_requires_worker_step_before_reduce: {
    title: 'Fanout incomplet',
    message: 'send_fanout doit passer par un worker avant reduce_join.',
    suggestion: 'Insère un ou plusieurs blocs worker entre le fanout et le reduce.',
  },
};

export function describeConnectionReason(reasonCode?: string | null): ConnectionReasonDescription | null {
  if (!reasonCode) return null;
  return CONNECTION_REASON_DESCRIPTIONS[reasonCode] || {
    title: 'Connexion refusée',
    message: reasonCode,
  };
}

export function describeSemanticKind(kind?: EdgeSemanticKind | null): string | null {
  if (!kind) return null;
  return EDGE_DECORATION_MAP[kind]?.semanticSummary || null;
}

const EDGE_DECORATION_MAP: Record<EdgeSemanticKind, EdgeSemanticDecoration> = {
  direct_flow: {
    semanticKind: 'direct_flow',
    className: 'edge-semantic-direct_flow',
    semanticSummary: 'Direct graph/data-flow edge.',
  },
  tool_attachment: {
    semanticKind: 'tool_attachment',
    className: 'edge-semantic-tool_attachment',
    semanticSummary: 'Many-to-one tool attachment semantic exposed through the canvas.',
  },
  memory_feed: {
    semanticKind: 'memory_feed',
    className: 'edge-semantic-memory_feed',
    semanticSummary: 'Memory payload feed into a memory-aware block.',
  },
  context_feed: {
    semanticKind: 'context_feed',
    className: 'edge-semantic-context_feed',
    semanticSummary: 'Context payload feed into a context-aware block.',
  },
  document_feed: {
    semanticKind: 'document_feed',
    className: 'edge-semantic-document_feed',
    semanticSummary: 'Document/retrieval payload feed into a downstream block.',
  },
  state_flow: {
    semanticKind: 'state_flow',
    className: 'edge-semantic-state_flow',
    semanticSummary: 'State-shaped direct flow edge.',
  },
  message_flow: {
    semanticKind: 'message_flow',
    className: 'edge-semantic-message_flow',
    semanticSummary: 'Messages-shaped direct flow edge.',
  },
  data_flow: {
    semanticKind: 'data_flow',
    className: 'edge-semantic-data_flow',
    semanticSummary: 'Generic data payload flow edge.',
  },
  fanout_dispatch: {
    semanticKind: 'fanout_dispatch',
    className: 'edge-semantic-fanout_dispatch',
    semanticSummary: 'One visible worker edge may fan out into many runtime sends.',
  },
  worker_reduce: {
    semanticKind: 'worker_reduce',
    className: 'edge-semantic-worker_reduce',
    semanticSummary: 'Many worker results may converge into one visual reduce edge.',
  },
};

const GRAPH_SCOPE_MARKER_TYPES = new Set<string>(['memory_checkpoint']);

function nodeTypeOf(node: Node | undefined): string | null {
  const raw = node?.data?.nodeType;
  return typeof raw === 'string' ? raw : null;
}

function buildNodeMap(nodes: Node[]): Map<string, Node> {
  return new Map(nodes.map((node) => [node.id, node]));
}

export function findConnectedComponents(
  nodes: Node[],
  edges: Edge[],
): GraphComponent[] {
  const adj: Record<string, Set<string>> = {};
  for (const n of nodes) {
    adj[n.id] = new Set();
  }
  for (const e of edges) {
    if (adj[e.source] && adj[e.target]) {
      adj[e.source].add(e.target);
      adj[e.target].add(e.source);
    }
  }

  const visited = new Set<string>();
  const components: GraphComponent[] = [];
  let compId = 0;

  for (const node of nodes) {
    if (visited.has(node.id)) continue;

    const queue = [node.id];
    const group = new Set<string>();
    while (queue.length > 0) {
      const current = queue.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      group.add(current);
      for (const neighbor of adj[current] || []) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }

    const compNodes = nodes.filter((n) => group.has(n.id));
    const compEdges = edges.filter(
      (e) => group.has(e.source) && group.has(e.target),
    );

    const hasIncoming = new Set(compEdges.map((e) => e.target));
    const roots = compNodes.filter((n) => !hasIncoming.has(n.id));
    const entryNodeId = roots.length > 0 ? roots[0].id : compNodes[0]?.id ?? null;

    components.push({
      id: compId++,
      nodeIds: group,
      nodes: compNodes,
      edges: compEdges,
      entryNodeId,
    });
  }

  components.sort((a, b) => b.nodes.length - a.nodes.length);
  components.forEach((c, i) => (c.id = i));

  return components;
}

export interface GraphValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  infos: string[];
  components: GraphComponent[];
  orphanNodeIds: Set<string>;
  secondaryNodeIds: Set<string>;
  detachedNodeIds: Set<string>;
  detachedComponentCount: number;
  semanticEdgeSummary: Record<string, number>;
  graphScopeMarkerIds: Set<string>;
}

export function getEdgeSemanticKind(edge: { source: string | null; target: string | null; sourceHandle?: string | null; targetHandle?: string | null; data?: unknown }, nodes?: Node[]): EdgeSemanticKind {
  const explicit = edge.data && typeof edge.data === 'object' && !Array.isArray(edge.data)
    ? (edge.data as Record<string, unknown>).semanticKind
    : null;
  if (typeof explicit === 'string') return explicit as EdgeSemanticKind;

  const nodeMap = nodes ? buildNodeMap(nodes) : null;
  const sourceType = edge.source ? nodeTypeOf(nodeMap?.get(edge.source)) : null;
  const targetType = edge.target ? nodeTypeOf(nodeMap?.get(edge.target)) : null;

  if (edge.sourceHandle === 'tool_out' && edge.targetHandle === 'tools_in') return 'tool_attachment';
  if (edge.targetHandle === 'memory_in') return 'memory_feed';
  if (edge.targetHandle === 'context_in') return 'context_feed';
  if (edge.targetHandle === 'documents_in' || edge.sourceHandle === 'documents_out') return 'document_feed';
  if (sourceType === 'send_fanout') return 'fanout_dispatch';
  if (targetType === 'reduce_join') return 'worker_reduce';
  if (edge.sourceHandle === 'state_out' && edge.targetHandle === 'state_in') return 'state_flow';
  if (edge.sourceHandle === 'messages_out' && edge.targetHandle === 'messages_in') return 'message_flow';
  if (edge.sourceHandle === 'data_out' && edge.targetHandle === 'data_in') return 'data_flow';
  return 'direct_flow';
}

export function getEdgeSemanticDecoration(edge: { source: string | null; target: string | null; sourceHandle?: string | null; targetHandle?: string | null; data?: unknown }, nodes?: Node[]): EdgeSemanticDecoration {
  const semanticKind = getEdgeSemanticKind(edge, nodes);
  return EDGE_DECORATION_MAP[semanticKind];
}

export function decorateConnectionEdge(connection: { source: string | null; target: string | null; sourceHandle?: string | null; targetHandle?: string | null }, nodes: Node[]): Pick<Edge, 'className' | 'data'> {
  const decoration = getEdgeSemanticDecoration({ ...connection, data: undefined }, nodes);
  return {
    className: decoration.className,
    data: {
      semanticKind: decoration.semanticKind,
      semanticSummary: decoration.semanticSummary,
    },
  };
}

export function validateConnectionAffordance(
  connection: { source: string | null; target: string | null; sourceHandle?: string | null; targetHandle?: string | null },
  nodes: Node[],
  edges: Edge[],
): ConnectionValidationResult {
  if (!connection.source || !connection.target) return { valid: false, reasonCode: 'missing_connection_endpoints' };
  if (connection.source === connection.target) return { valid: false, reasonCode: 'self_loop_not_supported' };
  if (edges.some((edge) => edge.source === connection.source && edge.target === connection.target && (edge.sourceHandle || '') === (connection.sourceHandle || '') && (edge.targetHandle || '') === (connection.targetHandle || ''))) {
    return { valid: false, reasonCode: 'duplicate_edge_not_supported' };
  }

  const nodeMap = buildNodeMap(nodes);
  const sourceNode = nodeMap.get(connection.source);
  const targetNode = nodeMap.get(connection.target);
  const sourceType = nodeTypeOf(sourceNode);
  const targetType = nodeTypeOf(targetNode);

  if (!sourceNode || !targetNode) return { valid: false, reasonCode: 'missing_connection_node' };

  if (connection.sourceHandle === 'tool_out' && connection.targetHandle !== 'tools_in') {
    return { valid: false, reasonCode: 'tool_handle_requires_tools_in' };
  }
  if (connection.targetHandle === 'tools_in' && connection.sourceHandle !== 'tool_out') {
    return { valid: false, reasonCode: 'tools_in_requires_tool_out' };
  }
  if (sourceType === 'send_fanout' && targetType === 'reduce_join') {
    return { valid: false, reasonCode: 'fanout_requires_worker_step_before_reduce' };
  }

  return { valid: true, semanticKind: getEdgeSemanticKind({ ...connection, data: undefined }, nodes) };
}

export function validateGraph(nodes: Node[], edges: Edge[]): GraphValidation {
  const components = findConnectedComponents(nodes, edges);
  const errors: string[] = [];
  const warnings: string[] = [];
  const infos: string[] = [];
  const orphanNodeIds = new Set<string>();
  const secondaryNodeIds = new Set<string>();
  const detachedNodeIds = new Set<string>();
  const nodeIds = new Set(nodes.map((node) => node.id));
  const semanticEdgeSummary: Record<string, number> = {};
  const graphScopeMarkerIds = new Set<string>();

  if (nodes.length === 0) {
    errors.push('Le graphe est vide.');
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Lien invalide: la source "${edge.source}" ne correspond à aucun nœud visible.`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Lien invalide: la cible "${edge.target}" ne correspond à aucun nœud visible.`);
    }
  }

  const graphScopeOnlyComponents = components.filter((comp) => comp.nodes.every((n) => GRAPH_SCOPE_MARKER_TYPES.has(nodeTypeOf(n) || '')));
  for (const comp of graphScopeOnlyComponents) {
    for (const node of comp.nodes) {
      graphScopeMarkerIds.add(node.id);
    }
  }

  const detachedInteractiveComponents = components.filter((comp, idx) => idx > 0 && !comp.nodes.every((n) => GRAPH_SCOPE_MARKER_TYPES.has(nodeTypeOf(n) || '')));
  if (detachedInteractiveComponents.length > 0) {
    warnings.push(
      `${detachedInteractiveComponents.length + 1} circuits détectés. Chaque circuit interactif sera compilé comme un graphe indépendant.`,
    );
    infos.push('Le premier circuit reste le principal; les autres sont traités comme des composants détachés jusqu’à fusion explicite.');
    detachedInteractiveComponents.forEach((comp, i) => {
      for (const nid of comp.nodeIds) {
        secondaryNodeIds.add(nid);
        detachedNodeIds.add(nid);
      }
      const entry = comp.nodes.find((n) => n.id === comp.entryNodeId);
      infos.push(`Composant détaché ${i + 1}: entrée "${entry?.data?.label || entry?.id || comp.entryNodeId}".`);
    });
  }

  if (graphScopeOnlyComponents.length > 0) {
    infos.push('Graph-scope markers detected: these detached markers affect compile/runtime scope without needing direct graph edges.');
  }

  for (const edge of edges) {
    const kind = getEdgeSemanticKind(edge, nodes);
    semanticEdgeSummary[kind] = (semanticEdgeSummary[kind] || 0) + 1;
  }

  const semanticKinds = Object.entries(semanticEdgeSummary).filter(([k, v]) => k !== 'direct_flow' && v > 0);
  if (semanticKinds.length > 0) {
    infos.push(`Liens sémantiques détectés: ${semanticKinds.map(([k, v]) => `${k}×${v}`).join(', ')}.`);
  }

  for (const comp of components) {
    const isolatedNodes = comp.nodes.filter((n) => {
      const hasEdge = comp.edges.some(
        (e) => e.source === n.id || e.target === n.id,
      );
      return !hasEdge && comp.nodes.length > 1;
    });
    for (const n of isolatedNodes) {
      warnings.push(`Nœud "${n.data.label || n.id}" isolé dans le circuit ${comp.id}.`);
      orphanNodeIds.add(n.id);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    infos,
    components,
    orphanNodeIds,
    secondaryNodeIds,
    detachedNodeIds,
    detachedComponentCount: detachedInteractiveComponents.length,
    semanticEdgeSummary,
    graphScopeMarkerIds,
  };
}
