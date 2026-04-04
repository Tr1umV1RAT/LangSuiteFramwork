import type { Edge, Node } from '@xyflow/react';
import { decorateConnectionEdge } from '../graphUtils';

type ArtifactTool = {
  id?: string;
  type?: string;
  description?: string;
  code?: string;
  params?: Record<string, unknown>;
  ui_meta?: Record<string, unknown>;
};

type ArtifactPayload = {
  nodes?: unknown[];
  edges?: unknown[];
  tools?: unknown[];
};

const TOOL_TYPE_TO_NODE_TYPE: Record<string, string> = {
  python_repl: 'tool_python_repl',
  web_search: 'tool_web_search',
  brave_search: 'tool_brave_search',
  duckduckgo_search: 'tool_duckduckgo_search',
  tavily_extract: 'tool_tavily_extract',
  rest_api: 'tool_rest_api',
  python_function: 'tool_python_function',
  api_call: 'tool_api_call',
  requests_get: 'tool_requests_get',
  requests_post: 'tool_requests_post',
  fs_list_dir: 'tool_fs_list_dir',
  fs_read_file: 'tool_fs_read_file',
  fs_glob: 'tool_fs_glob',
  fs_grep: 'tool_fs_grep',
  fs_write_file: 'tool_fs_write_file',
  fs_edit_file: 'tool_fs_edit_file',
  fs_apply_patch: 'tool_fs_apply_patch',
  shell_command: 'tool_shell_command',
  sql_query: 'tool_sql_query',
  sql_list_tables: 'tool_sql_list_tables',
  sql_get_schema: 'tool_sql_get_schema',
  sql_query_check: 'tool_sql_query_check',
  rpg_dice_roller: 'tool_rpg_dice_roller',
  pw_navigate: 'tool_pw_navigate',
  pw_click: 'tool_pw_click',
  pw_extract_text: 'tool_pw_extract_text',
  pw_extract_links: 'tool_pw_extract_links',
  pw_get_elements: 'tool_pw_get_elements',
  pw_current_page: 'tool_pw_current_page',
  pw_fill: 'tool_pw_fill',
  playwright_wait: 'tool_playwright_wait',
  playwright_scroll: 'tool_playwright_scroll',
  playwright_extract_links: 'tool_playwright_extract_links',
  playwright_keypress: 'tool_playwright_keypress',
  playwright_screenshot: 'tool_playwright_screenshot',
  github_get_issue: 'tool_github_get_issue',
  github_get_pull_request: 'tool_github_get_pull_request',
  github_read_file: 'tool_github_read_file',
  github_search_issues_prs: 'tool_github_search_issues_prs',
  sub_agent_tool: 'tool_sub_agent',
  tool_llm_worker: 'tool_llm_worker',
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function parseToolNodeParams(tool: ArtifactTool): Record<string, unknown> {
  const params = asRecord(tool.params);
  const base: Record<string, unknown> = { description: tool.description || '' };
  switch (tool.type) {
    case 'python_function':
      base.code = tool.code || '';
      break;
    case 'sub_agent_tool':
      base.target_subgraph = params.target_subgraph || '';
      base.target_group = params.target_group || 'default';
      base.target_agent = params.target_agent || '';
      base.max_invocations = params.max_invocations || 1;
      base.allow_repeat = params.allow_repeat || '';
      base.provider = params.provider || 'openai';
      base.model_name = params.model_name || 'gpt-4o-mini';
      base.api_key_env = params.api_key_env || '';
      base.api_base_url = params.api_base_url || '';
      base.temperature = typeof params.temperature === 'number' ? params.temperature : 0.3;
      break;
    case 'tool_llm_worker':
      base.system_prompt = params.system_prompt || 'Tu es un assistant expert.';
      base.provider = params.provider || 'openai';
      base.model_name = params.model_name || 'gpt-4o-mini';
      base.api_key_env = params.api_key_env || '';
      base.api_base_url = params.api_base_url || '';
      base.temperature = typeof params.temperature === 'number' ? params.temperature : 0;
      break;
    case 'rest_api':
      base.url = params.url || '';
      base.method = params.method || 'POST';
      base.headers_json = JSON.stringify(asRecord(params.headers));
      break;
    case 'web_search':
      base.tavily_api_key = params.tavily_api_key || 'TAVILY_API_KEY';
      base.max_results = params.max_results || 3;
      break;
    case 'brave_search':
      base.brave_api_key = params.brave_api_key || 'BRAVE_SEARCH_API_KEY';
      base.max_results = params.max_results || 5;
      base.timeout_seconds = params.timeout_seconds || 15;
      break;
    case 'duckduckgo_search':
      base.max_results = params.max_results || 5;
      break;
    case 'tavily_extract':
      base.tavily_api_key = params.tavily_api_key || 'TAVILY_API_KEY';
      base.extract_depth = params.extract_depth || 'basic';
      base.include_images = params.include_images ? 'true' : 'false';
      break;
    case 'api_call':
      base.url = params.url || '';
      base.headers_json = JSON.stringify(asRecord(params.headers));
      break;
    case 'requests_get':
    case 'requests_post':
      base.base_url = params.base_url || '';
      base.allow_full_urls = params.allow_full_urls ? 'true' : 'false';
      base.timeout_seconds = params.timeout_seconds || 15;
      base.headers_json = JSON.stringify(asRecord(params.headers));
      break;
    case 'fs_list_dir':
      base.root_path = params.root_path || '.';
      base.include_hidden = params.include_hidden ? 'true' : 'false';
      base.max_results = params.max_results || 100;
      break;
    case 'fs_read_file':
      base.root_path = params.root_path || '.';
      base.max_bytes = params.max_bytes || 200000;
      break;
    case 'fs_glob':
      base.root_path = params.root_path || '.';
      base.include_hidden = params.include_hidden ? 'true' : 'false';
      base.max_results = params.max_results || 200;
      break;
    case 'fs_grep':
      base.root_path = params.root_path || '.';
      base.file_glob = params.file_glob || '**/*';
      base.case_sensitive = params.case_sensitive ? 'true' : 'false';
      base.include_hidden = params.include_hidden ? 'true' : 'false';
      base.max_matches = params.max_matches || 200;
      break;
    case 'fs_write_file':
      base.root_path = params.root_path || '.';
      base.create_dirs = params.create_dirs ? 'true' : 'false';
      base.overwrite_existing = params.overwrite_existing ? 'true' : 'false';
      base.max_bytes = params.max_bytes || 200000;
      break;
    case 'fs_edit_file':
      base.root_path = params.root_path || '.';
      base.replace_all = params.replace_all ? 'true' : 'false';
      base.max_bytes = params.max_bytes || 200000;
      break;
    case 'fs_apply_patch':
      base.root_path = params.root_path || '.';
      base.allow_create = params.allow_create ? 'true' : 'false';
      base.create_dirs = params.create_dirs ? 'true' : 'false';
      base.max_files = params.max_files || 8;
      base.max_bytes = params.max_bytes || 200000;
      break;
    case 'shell_command':
      base.root_path = params.root_path || '.';
      base.timeout_seconds = params.timeout_seconds || 20;
      base.allowed_commands = Array.isArray(params.allowed_commands) ? params.allowed_commands : ['python', 'python3', 'pytest', 'ls', 'pwd', 'grep', 'find', 'cat'];
      break;
    case 'sql_query':
      base.db_path = params.db_path || 'data.db';
      base.read_only = params.read_only === false ? 'false' : 'true';
      break;
    case 'sql_list_tables':
    case 'sql_get_schema':
    case 'sql_query_check':
      base.db_path = params.db_path || 'data.db';
      break;
    default:
      break;
  }
  return base;
}

function inferToolPosition(tool: ArtifactTool, linkedNode: Node | undefined, index: number): { x: number; y: number } {
  const uiMeta = asRecord(tool.ui_meta);
  const pos = asRecord(uiMeta.position);
  const x = Number(pos.x);
  const y = Number(pos.y);
  if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  if (linkedNode?.position) return { x: linkedNode.position.x - 220, y: linkedNode.position.y + index * 24 };
  return { x: 80, y: 240 + index * 36 };
}

export function hydrateArtifactEditorGraph(artifact: ArtifactPayload): { nodes: Node[]; edges: Edge[] } {
  const nodes = Array.isArray(artifact.nodes) ? (artifact.nodes as Node[]) : [];
  const edges = Array.isArray(artifact.edges) ? (artifact.edges as Edge[]) : [];
  const tools = Array.isArray(artifact.tools) ? (artifact.tools as ArtifactTool[]) : [];
  if (tools.length === 0) return { nodes, edges };

  const nodeMap = new Map(nodes.map((node) => [String(node.id), node]));
  const linkedToolTargets = new Map<string, string[]>();
  for (const node of nodes) {
    const params = asRecord(asRecord(node.data).params);
    const linked = Array.isArray(params.tools_linked) ? params.tools_linked.map((value) => String(value)) : [];
    for (const toolId of linked) {
      const current = linkedToolTargets.get(toolId) || [];
      if (!current.includes(String(node.id))) current.push(String(node.id));
      linkedToolTargets.set(toolId, current);
    }
  }

  const nextNodes = [...nodes];
  const nextEdges = [...edges];
  const edgeKeys = new Set(nextEdges.map((edge) => `${edge.source}:${edge.target}:${edge.sourceHandle || ''}:${edge.targetHandle || ''}`));

  tools.forEach((tool, index) => {
    const toolId = String(tool.id || '').trim();
    const toolType = String(tool.type || '').trim();
    if (!toolId || nodeMap.has(toolId)) return;
    const linkedTargets = linkedToolTargets.get(toolId) || [];
    const linkedNode = linkedTargets.length > 0 ? nodeMap.get(linkedTargets[0]) : undefined;
    const uiMeta = asRecord(tool.ui_meta);
    const nodeType = String(uiMeta.nodeType || TOOL_TYPE_TO_NODE_TYPE[toolType] || 'tool_python_function');
    const label = String(uiMeta.label || tool.description || toolId);
    const toolNode: Node = {
      id: toolId,
      type: 'custom',
      position: inferToolPosition(tool, linkedNode, index),
      data: { nodeType, label, params: parseToolNodeParams(tool) },
    };
    nextNodes.push(toolNode);
    nodeMap.set(toolId, toolNode);
    for (const targetId of linkedTargets) {
      const edgeKey = `${toolId}:${targetId}:tool_out:tools_in`;
      if (edgeKeys.has(edgeKey)) continue;
      const connection = { source: toolId, target: targetId, sourceHandle: 'tool_out', targetHandle: 'tools_in' };
      nextEdges.push({ id: `edge_${toolId}_${targetId}_tool`, ...connection, animated: true, type: 'default', ...decorateConnectionEdge(connection, nextNodes) } as Edge);
      edgeKeys.add(edgeKey);
    }
  });

  return { nodes: nextNodes, edges: nextEdges };
}
