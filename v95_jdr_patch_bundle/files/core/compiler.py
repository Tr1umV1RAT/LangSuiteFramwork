from __future__ import annotations

import ast
import io
import zipfile
from collections import defaultdict
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from core.schemas import GraphPayload, GraphNode, GraphEdge
from core.provider_contracts import normalize_provider, openai_compatible_provider_families, provider_env_var_map, load_provider_contracts
from core.bridge_lowering import BridgeLoweringError, embed_langchain_agent_reference, lower_langchain_agent_reference
from core.prompt_strips import resolve_prompt_for_node, resolve_prompt_for_subagent, resolve_prompt_for_tool, build_prompt_resolution_provenance
from core.runtime_dependencies import collect_runtime_requirement_specs

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"

TEMPLATE_FILES = {
    "requirements.txt": "requirements.txt.jinja",
    "state.py": "state.py.jinja",
    "tools.py": "tools.py.jinja",
    "nodes.py": "nodes.py.jinja",
    "graph.py": "graph.py.jinja",
    "main.py": "main.py.jinja",
}


def _validate_rendered_python(rendered: dict[str, str]) -> None:
    for filename, content in rendered.items():
        if not filename.endswith('.py'):
            continue
        try:
            ast.parse(content, filename=filename)
        except SyntaxError as exc:
            raise ValueError(f"Generated Python file '{filename}' is syntactically invalid: {exc.msg} at line {exc.lineno}") from exc


def _find_connected_components(
    nodes: list[GraphNode], edges: list[GraphEdge]
) -> list[dict]:
    marker_types = {"logic_router", "memory_checkpoint"}

    adj: dict[str, set[str]] = defaultdict(set)
    node_ids = {n.id for n in nodes}
    for n in nodes:
        adj[n.id] = set()

    for e in edges:
        if e.source in node_ids and e.target in node_ids:
            adj[e.source].add(e.target)
            adj[e.target].add(e.source)

    visited: set[str] = set()
    components: list[dict] = []

    for node in nodes:
        if node.id in visited:
            continue
        queue = [node.id]
        group: set[str] = set()
        while queue:
            current = queue.pop()
            if current in visited:
                continue
            visited.add(current)
            group.add(current)
            for neighbor in adj[current]:
                if neighbor not in visited:
                    queue.append(neighbor)

        comp_nodes = [n for n in nodes if n.id in group]
        comp_edges = [e for e in edges if e.source in group and e.target in group]

        # graph_nodes contient les vrais noeuds (sans les marqueurs visuels)
        graph_nodes = [n for n in comp_nodes if n.type not in marker_types]

        # CORRECTIF : Si le circuit ne contient QUE des marqueurs (ex: memory_checkpoint isolé), on l'ignore
        if not graph_nodes:
            continue

        targets = {e.target for e in comp_edges}
        roots = [n for n in graph_nodes if n.id not in targets]
        entry = roots[0].id if roots else (graph_nodes[0].id if graph_nodes else None)

        components.append({
            "nodes": comp_nodes,
            "graph_nodes": graph_nodes,
            "edges": comp_edges,
            "entry_node_id": entry,
        })

    components.sort(key=lambda c: len(c["nodes"]), reverse=True)
    return components




def _safe_graph_function_suffix(raw: str) -> str:
    chars = []
    for ch in raw:
        chars.append(ch if ch.isalnum() else '_')
    suffix = ''.join(chars).strip('_') or 'graph'
    return suffix[:80]


def _validate_subagent_tool_targets(payload: GraphPayload) -> None:
    runtime_settings = payload.ui_context.runtime_settings if payload.ui_context else None
    library = getattr(runtime_settings, 'subagentLibrary', None) or []
    group_map = {str(group.name): group for group in library}
    for tool in payload.tools:
        if getattr(tool, 'type', None) != 'sub_agent_tool':
            continue
        params = getattr(tool, 'params', None)
        if params is None:
            continue
        target_group = str(getattr(params, 'target_group', None) or 'default').strip() or 'default'
        target_agent = str(getattr(params, 'target_agent', None) or '').strip()
        group = group_map.get(target_group)
        if not group:
            raise ValueError(f"Subagent tool '{tool.id}' targets unknown group '{target_group}'. Define it in the Subagent Library before compile.")
        if target_agent and not any(str(agent.name) == target_agent for agent in getattr(group, 'agents', []) or []):
            raise ValueError(f"Subagent tool '{tool.id}' targets unknown subagent '{target_agent}' in group '{target_group}'.")


def _apply_prompt_strip_phase2(payload: GraphPayload) -> None:
    ui_context = payload.ui_context
    runtime_settings = getattr(ui_context, 'runtime_settings', None) if ui_context else None
    tab_id = getattr(ui_context, 'tab_id', None) if ui_context else None
    if runtime_settings is None:
        return

    for node in payload.nodes:
        resolved = resolve_prompt_for_node(
            runtime_settings=runtime_settings,
            tab_id=tab_id,
            node_id=node.id,
            node_type=node.type,
            params=node.params,
        )
        if not resolved:
            continue
        setattr(node.params, resolved['fieldName'], resolved['resolvedPrompt'])

    for tool in payload.tools:
        resolved = resolve_prompt_for_tool(
            runtime_settings=runtime_settings,
            tab_id=tab_id,
            tool_type=tool.type,
            params=tool.params,
        )
        if not resolved:
            continue
        setattr(tool.params, resolved['fieldName'], resolved['resolvedPrompt'])

    for group in getattr(runtime_settings, 'subagentLibrary', []) or []:
        for agent in getattr(group, 'agents', []) or []:
            resolved = resolve_prompt_for_subagent(
                runtime_settings=runtime_settings,
                tab_id=tab_id,
                group_name=str(getattr(group, 'name', '') or ''),
                agent_name=str(getattr(agent, 'name', '') or ''),
                local_prompt=getattr(agent, 'systemPrompt', ''),
            )
            agent.systemPrompt = resolved['resolvedPrompt']


def _collect_prompt_strip_phase3_metadata(payload: GraphPayload) -> dict:
    ui_context = payload.ui_context
    runtime_settings = getattr(ui_context, 'runtime_settings', None) if ui_context else None
    tab_id = getattr(ui_context, 'tab_id', None) if ui_context else None
    if runtime_settings is None:
        return {'version': 'prompt_strip_runtime_meta_v1', 'graph': None, 'nodes': {}, 'tools': {}, 'subagents': {}, 'library': []}

    graph_target = {'kind': 'graph', 'tabId': tab_id or ''}
    graph_meta = build_prompt_resolution_provenance(
        runtime_settings=runtime_settings,
        target_kind='graph',
        tab_id=tab_id,
        local_prompt='',
        graph_target=graph_target,
        local_target=None,
    )

    node_meta: dict[str, dict] = {}
    for node in payload.nodes:
        resolved = resolve_prompt_for_node(
            runtime_settings=runtime_settings,
            tab_id=tab_id,
            node_id=node.id,
            node_type=node.type,
            params=node.params,
        )
        if not resolved:
            continue
        meta = dict(resolved.get('provenance') or {})
        meta['nodeId'] = node.id
        meta['nodeType'] = node.type
        meta['fieldName'] = resolved.get('fieldName')
        node_meta[node.id] = meta

    tool_meta: dict[str, dict] = {}
    for tool in payload.tools:
        tool_id = str((tool.get('id') if isinstance(tool, dict) else getattr(tool, 'id', None)) or '')
        tool_type = str((tool.get('type') if isinstance(tool, dict) else getattr(tool, 'type', None)) or '')
        params = tool.get('params') if isinstance(tool, dict) else getattr(tool, 'params', None)
        resolved = resolve_prompt_for_tool(
            runtime_settings=runtime_settings,
            tab_id=tab_id,
            tool_type=tool_type,
            params=params,
        )
        if not resolved:
            continue
        meta = dict(resolved.get('provenance') or {})
        meta['toolId'] = tool_id or tool_type
        meta['toolType'] = tool_type
        meta['fieldName'] = resolved.get('fieldName')
        tool_meta[tool_id or tool_type] = meta

    subagent_meta: dict[str, dict] = {}
    for group in getattr(runtime_settings, 'subagentLibrary', []) or []:
        group_name = str(getattr(group, 'name', '') or '')
        for agent in getattr(group, 'agents', []) or []:
            agent_name = str(getattr(agent, 'name', '') or '')
            resolved = resolve_prompt_for_subagent(
                runtime_settings=runtime_settings,
                tab_id=tab_id,
                group_name=group_name,
                agent_name=agent_name,
                local_prompt=getattr(agent, 'systemPrompt', ''),
            )
            meta = dict(resolved.get('provenance') or {})
            meta['groupName'] = group_name
            meta['agentName'] = agent_name
            subagent_meta[f'{group_name}/{agent_name}'] = meta

    library_meta: list[dict] = []
    for strip in getattr(runtime_settings, 'promptStripLibrary', []) or []:
        variables = getattr(strip, 'variables', []) or []
        library_meta.append({
            'id': str(getattr(strip, 'id', '') or ''),
            'name': str(getattr(strip, 'name', '') or ''),
            'origin': str(getattr(strip, 'origin', 'workspace') or 'workspace'),
            'tags': list(getattr(strip, 'tags', []) or []),
            'variableNames': [str(getattr(var, 'name', '') or '') for var in variables if str(getattr(var, 'name', '') or '')],
        })

    return {
        'version': 'prompt_strip_runtime_meta_v1',
        'graph': graph_meta,
        'nodes': node_meta,
        'tools': tool_meta,
        'subagents': subagent_meta,
        'library': library_meta,
    }


def _collect_external_artifact_graphs(payload: GraphPayload) -> list[dict]:
    seen: set[tuple[str, str]] = set()
    external_graphs: list[dict] = []
    for node in payload.nodes:
        if node.type not in {'sub_agent', 'deep_agent_suite'}:
            continue
        target = getattr(node.params, 'target_subgraph', None)
        if not isinstance(target, str) or not target.startswith('artifact:'):
            continue
        execution_kind = str(getattr(node.params, 'artifact_execution_kind', None) or 'lowered_bridge')
        dedupe_key = (target, execution_kind)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        if target.startswith('artifact:agent/'):
            resolved = embed_langchain_agent_reference(target) if execution_kind == 'embedded_native' else lower_langchain_agent_reference(target)
            resolved_nodes = [GraphNode(**entry) for entry in resolved['nodes']]
            resolved_edges = [GraphEdge(**entry) for entry in resolved['edges']]
            components = _find_connected_components(resolved_nodes, resolved_edges)
            if len(components) != 1:
                raise BridgeLoweringError(f"Executable external artifact '{target}' must resolve to exactly one graph component")
            comp = components[0]
            external_graphs.append({
                'graph_key': resolved['graph_key'],
                'function_name': resolved['function_name'],
                'nodes': resolved_nodes,
                'edges': resolved_edges,
                'tools': resolved.get('tools', []),
                'component': comp,
                'source_mode': resolved['source_mode'],
                'contract_id': resolved['contract_id'],
                'integration_model': resolved.get('integration_model', execution_kind),
                'artifact_id': resolved['artifact_id'],
                'artifact_title': resolved['artifact_title'],
            })
    return external_graphs

def _build_context(payload: GraphPayload) -> dict:
    marker_types = {"logic_router", "memory_checkpoint"}
    routers = [n for n in payload.nodes if n.type == "logic_router"]
    router_ids = {n.id for n in routers}
    regular_nodes = [n for n in payload.nodes if n.type not in marker_types]
    base_tools = list(payload.tools)
    has_memory = any(n.type in ("memory_store_read", "memoryreader", "memorywriter", "memory_access", "store_put", "store_search", "store_get", "store_delete") for n in payload.nodes)
    has_rag = any(n.type == "rag_retriever_local" for n in payload.nodes)
    pw_types = {"pw_navigate", "pw_click", "pw_extract_text", "pw_extract_links", "pw_get_elements", "pw_current_page", "pw_fill", "playwright_wait", "playwright_scroll", "playwright_extract_links", "playwright_keypress", "playwright_screenshot"}
    has_retries = any(getattr(n.params, 'retries', None) and getattr(n.params, 'retries', 0) > 0 for n in payload.nodes)

    interrupt_before_nodes = payload.interrupt_before_nodes or [
        n.id for n in payload.nodes if n.type == "human_interrupt"
    ]
    has_user_input_async = (
        payload.is_async
        and any(n.type == "user_input_node" for n in payload.nodes)
    )
    use_checkpoint = (
        payload.use_checkpoint
        or any(n.type == "memory_checkpoint" for n in payload.nodes)
        or len(interrupt_before_nodes) > 0
        or has_user_input_async
    )

    components = _find_connected_components(payload.nodes, payload.edges)
    external_graphs = _collect_external_artifact_graphs(payload)
    prompt_strip_runtime_meta = _collect_prompt_strip_phase3_metadata(payload)
    external_tools = []
    for ext in external_graphs:
        external_tools.extend(ext.get('tools', []))
    all_tools = base_tools + external_tools
    has_tools = len(all_tools) > 0
    compiled_tool_types = {
        str((t.get('type') if isinstance(t, dict) else getattr(t, 'type', None)) or '').strip()
        for t in all_tools
    }
    has_playwright = any(tool_type in pw_types for tool_type in compiled_tool_types)
    has_tavily = any(tool_type in {'web_search', 'tavily_extract'} for tool_type in compiled_tool_types)
    has_brave = any(tool_type in {'brave_search'} for tool_type in compiled_tool_types)
    has_duckduckgo = any(tool_type in {'duckduckgo_search'} for tool_type in compiled_tool_types)
    has_requests_toolkit = any(tool_type in {'requests_get', 'requests_post'} for tool_type in compiled_tool_types)
    has_github = any(tool_type in {'github_get_issue', 'github_get_pull_request', 'github_read_file', 'github_search_issues_prs'} for tool_type in compiled_tool_types)
    providers = set()
    for t in all_tools:
        params = getattr(t, 'params', None) if not isinstance(t, dict) else t.get('params')
        provider = getattr(params, 'provider', None) if params is not None and not isinstance(params, dict) else (params or {}).get('provider') if isinstance(params, dict) else None
        if provider:
            providers.add(normalize_provider(provider))
    providers.update({normalize_provider(getattr(n.params, 'provider', None)) for n in payload.nodes if getattr(n.params, 'provider', None)})

    enriched_components = []
    for idx, comp in enumerate(components):
        comp_interrupt = [
            n.id for n in comp["nodes"] if n.type == "human_interrupt"
        ]
        comp_has_tool_executor = any(
            n.type == "tool_executor" for n in comp["nodes"]
        )
        comp_tool_nodes = [
            n for n in comp["graph_nodes"]
            if n.type in ("llm_chat", "react_agent", "sub_agent")
            and n.params.tools_linked
        ]
        needs_tool_node = has_tools and not comp_has_tool_executor and len(comp_tool_nodes) > 0

        graph_key = f"circuit_{idx}" if idx > 0 else "main"
        enriched_components.append({
            "index": idx,
            "name": graph_key,
            "graph_key": graph_key,
            "function_name": _safe_graph_function_suffix(graph_key),
            "nodes": comp["nodes"],
            "graph_nodes": comp["graph_nodes"],
            "edges": comp["edges"],
            "entry_node_id": comp["entry_node_id"],
            "interrupt_before": comp_interrupt,
            "needs_tool_node": needs_tool_node,
            "bridge_contract_id": None,
            "bridge_source_mode": None,
            "bridge_integration_model": None,
            "bridge_artifact_id": None,
            "bridge_artifact_title": None,
        })

    for ext_idx, ext in enumerate(external_graphs, start=len(enriched_components)):
        comp = ext['component']
        comp_interrupt = [n.id for n in comp['nodes'] if n.type == 'human_interrupt']
        comp_has_tool_executor = any(n.type == 'tool_executor' for n in comp['nodes'])
        comp_tool_nodes = [
            n for n in comp['graph_nodes']
            if n.type in ('llm_chat', 'react_agent', 'sub_agent') and n.params.tools_linked
        ]
        needs_tool_node = has_tools and not comp_has_tool_executor and len(comp_tool_nodes) > 0
        enriched_components.append({
            'index': ext_idx,
            'name': ext['graph_key'],
            'graph_key': ext['graph_key'],
            'function_name': ext['function_name'],
            'nodes': comp['nodes'],
            'graph_nodes': comp['graph_nodes'],
            'edges': comp['edges'],
            'entry_node_id': comp['entry_node_id'],
            'interrupt_before': comp_interrupt,
            'needs_tool_node': needs_tool_node,
            'bridge_contract_id': ext['contract_id'],
            'bridge_source_mode': ext['source_mode'],
            'bridge_integration_model': ext.get('integration_model'),
            'bridge_artifact_id': ext['artifact_id'],
            'bridge_artifact_title': ext['artifact_title'],
        })

    all_nodes = list(payload.nodes)
    for ext in external_graphs:
        all_nodes.extend(ext['nodes'])

    for comp in enriched_components:
        direct_edges_by_source: dict[str, list[str]] = defaultdict(list)
        for edge in comp['edges']:
            if edge.type == 'direct' and edge.target:
                direct_edges_by_source[edge.source].append(edge.target)
        for node in comp['graph_nodes']:
            if node.type not in {'command_node', 'handoff_node', 'send_fanout'}:
                continue
            targets = direct_edges_by_source.get(node.id, [])
            if len(targets) > 1:
                raise ValueError(f"Node '{node.id}' of type '{node.type}' supports at most one direct outgoing edge in the current build")
            if node.type == 'send_fanout' and len(targets) == 0:
                raise ValueError(f"Node '{node.id}' of type '{node.type}' requires exactly one direct outgoing worker edge in the current build")
            setattr(node.params, 'command_goto', targets[0] if targets else '')
            setattr(node.params, 'command_targets', list(targets))
            if node.type == 'send_fanout':
                setattr(node.params, 'send_target', targets[0] if targets else '')

    graph_nodes = [n for n in payload.nodes if n.type not in marker_types]
    first_node_id = graph_nodes[0].id if graph_nodes else None

    ui_context = payload.ui_context
    resolved_bindings = list(ui_context.resolved_graph_bindings or ui_context.graph_bindings or []) if ui_context else []
    local_bindings = list(ui_context.graph_bindings or []) if ui_context else []
    runtime_settings = (ui_context.runtime_settings.model_dump() if ui_context and ui_context.runtime_settings else {
        "recursionLimit": 50,
        "streamMode": "updates",
        "debug": False,
        "inheritParentBindings": True,
        "storeBackend": "in_memory",
        "storePath": "runtime_store.db",
        "shellExecutionEnabled": False,
    })
    external_artifacts = [
        {
            "graph_key": ext['graph_key'],
            "artifactId": ext['artifact_id'],
            "artifactTitle": ext['artifact_title'],
            "contractId": ext['contract_id'],
            "integrationModel": ext.get('integration_model'),
            "sourceMode": ext['source_mode'],
            "providerBacked": bool(ext.get('provider_backed')),
            "providerFamilies": list(ext.get('provider_families') or []),
            "requiredProviderEnvVars": list(ext.get('required_provider_env_vars') or []),
            "acceptedProviderModels": list(ext.get('accepted_provider_models') or []),
        }
        for ext in external_graphs
    ]

    return {
        "graph_id": payload.graph_id,
        "config": payload.config,
        "state_schema": payload.state_schema,
        "nodes": all_nodes,
        "regular_nodes": regular_nodes,
        "routers": routers,
        "router_ids": router_ids,
        "tools": all_tools,
        "edges": payload.edges,
        "has_tools": has_tools,
        "has_memory": has_memory,
        "has_rag": has_rag,
        "has_playwright": has_playwright,
        "has_tavily": has_tavily,
        "has_brave": has_brave,
        "has_duckduckgo": has_duckduckgo,
        "has_requests_toolkit": has_requests_toolkit,
        "has_github": has_github,
        "has_send_nodes": any(n.type == "send_fanout" for n in all_nodes),
        "has_retries": has_retries,
        "has_openai": any(p in providers for p in ("openai", "openai_compat", "lm_studio", "llama_cpp")),
        "has_anthropic": "anthropic" in providers,
        "has_google_genai": "google_genai" in providers,
        "has_google_vertexai": "google_vertexai" in providers,
        "has_ollama": "ollama" in providers,
        "has_mistralai": "mistralai" in providers,
        "use_checkpoint": use_checkpoint,
        "checkpoint_type": payload.config.persistence_type if payload.config else "memory",
        "interrupt_before_nodes": interrupt_before_nodes,
        "first_node_id": first_node_id,
        "components": enriched_components,
        "multi_graph": len(enriched_components) > 1,
        "is_async": payload.is_async,
        "ui_context": ui_context.model_dump() if ui_context else {},
        "artifact_type": getattr(ui_context, 'artifact_type', None) if ui_context else None,
        "execution_profile": getattr(ui_context, 'execution_profile', None) if ui_context else None,
        "runtime_settings": runtime_settings,
        "runtime_settings_repr": repr(runtime_settings),
        "provider_contracts": load_provider_contracts(),
        "provider_env_vars": provider_env_var_map(),
        "runtime_requirement_specs": collect_runtime_requirement_specs(payload),
        "openai_compatible_provider_families": list(openai_compatible_provider_families()),
        "external_artifacts": external_artifacts,
        "external_artifacts_repr": repr(external_artifacts),
        "graph_bindings": local_bindings,
        "graph_bindings_repr": repr(local_bindings),
        "resolved_graph_bindings": resolved_bindings,
        "resolved_graph_bindings_repr": repr(resolved_bindings),
        "ui_context_repr": repr(ui_context.model_dump() if ui_context else {}),
        "prompt_strip_runtime_meta": prompt_strip_runtime_meta,
        "prompt_strip_runtime_meta_repr": repr(prompt_strip_runtime_meta),
    }


def compile_graph(payload: GraphPayload) -> io.BytesIO:
    _apply_prompt_strip_phase2(payload)
    _validate_subagent_tool_targets(payload)
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=select_autoescape([]),
        keep_trailing_newline=True,
        trim_blocks=True,
        lstrip_blocks=True,
    )

    context = _build_context(payload)

    rendered: dict[str, str] = {}
    for output_name, template_name in TEMPLATE_FILES.items():
        template = env.get_template(template_name)
        rendered[output_name] = template.render(**context)

    _validate_rendered_python(rendered)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        project_dir = payload.graph_id
        for filename, content in rendered.items():
            zf.writestr(f"{project_dir}/{filename}", content)
    buf.seek(0)
    return buf
