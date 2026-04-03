from __future__ import annotations

import io
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.compiler import compile_graph
from core.schemas import GraphPayload

NODE_CONFIG = ROOT / 'client' / 'src' / 'nodeConfig.ts'
CAP_MATRIX = ROOT / 'client' / 'src' / 'capabilityMatrix.json'
RUNNER = ROOT / 'api' / 'runner.py'
STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'
CUSTOM_NODE = ROOT / 'client' / 'src' / 'components' / 'CustomNode.tsx'
GRAPH_TEMPLATE = ROOT / 'templates' / 'graph.py.jinja'


def _read_zip_text(buf: io.BytesIO, filename: str, graph_id: str) -> str:
    with zipfile.ZipFile(io.BytesIO(buf.getvalue()), 'r') as zf:
        return zf.read(f"{graph_id}/{filename}").decode('utf-8')


def test_v61_ui_surfaces_include_runtime_context_and_structured_blocks() -> None:
    node_config_text = NODE_CONFIG.read_text(encoding='utf-8')
    matrix = json.loads(CAP_MATRIX.read_text(encoding='utf-8'))['nodeTypes']
    state_panel_text = STATE_PANEL.read_text(encoding='utf-8')
    custom_node_text = CUSTOM_NODE.read_text(encoding='utf-8')

    assert 'runtime_context_read: {' in node_config_text
    assert 'structured_output_extract: {' in node_config_text
    assert 'structured_output_router: {' in node_config_text
    assert matrix['runtime_context_read']['graphAbstractionKind'] == 'runtime_context_reader'
    assert matrix['structured_output_extract']['preferredSurface'] is True
    assert matrix['structured_output_router']['interactionModel'] == 'structured_output_conditional_routing'
    assert 'Runtime context' in state_panel_text
    assert 'Canonical subagent tool:' in custom_node_text
    assert 'Structured output active:' in custom_node_text


def test_v61_compile_supports_runtime_context_and_structured_output_blocks() -> None:
    payload = GraphPayload(
        graph_id='v61_runtime_structured_graph',
        ui_context={
            'artifact_type': 'graph',
            'execution_profile': 'langgraph_async',
            'project_mode': 'langgraph',
            'runtime_settings': {
                'runtimeContext': [
                    {'key': 'user_id', 'value': 'alice'},
                    {'key': 'region', 'value': 'eu-west'},
                ]
            },
        },
        state_schema=[
            {'name': 'messages', 'type': 'list[Any]', 'reducer': 'operator.add'},
            {'name': 'custom_vars', 'type': 'dict', 'reducer': 'update'},
        ],
        nodes=[
            {'id': 'llm_1', 'type': 'llm_chat', 'params': {'provider': 'ollama', 'model_name': 'llama3', 'structured_schema': [{'name': 'status', 'type': 'str', 'description': 'status'}], 'structured_output_key': 'analysis_struct'}},
            {'id': 'ctx_1', 'type': 'runtime_context_read', 'params': {'context_key': 'user_id', 'output_key': 'runtime_user'}},
            {'id': 'extract_1', 'type': 'structured_output_extract', 'params': {'source_key': 'analysis_struct', 'field_name': 'status', 'output_key': 'analysis_status'}},
            {'id': 'router_1', 'type': 'structured_output_router', 'params': {'source_key': 'analysis_struct', 'field_name': 'status', 'routes': [{'value': 'ok', 'handle_id': 'ok'}], 'fallback_handle': 'fallback'}},
            {'id': 'debug_1', 'type': 'debug_print', 'params': {'input_key': 'analysis_status'}},
        ],
        edges=[
            {'source': 'llm_1', 'target': 'extract_1', 'type': 'direct'},
            {'source': 'extract_1', 'target': 'router_1', 'type': 'direct'},
            {'source': 'router_1', 'target': 'debug_1', 'type': 'conditional', 'condition': 'ok', 'router_id': 'router_1'},
        ],
        tools=[],
        is_async=True,
    )
    buf = compile_graph(payload)
    nodes_py = _read_zip_text(buf, 'nodes.py', payload.graph_id)
    graph_py = _read_zip_text(buf, 'graph.py', payload.graph_id)

    assert 'def ctx_1_node(state: AgentState, runtime: Runtime | None = None)' in nodes_py
    assert 'context_key = "user_id"' in nodes_py
    assert 'def extract_1_node(state: AgentState) -> dict[str, Any]:' in nodes_py
    assert 'def router_1_route(state: AgentState) -> str:' in nodes_py
    assert 'builder = StateGraph(AgentState, context_schema=GraphRuntimeContext)' in graph_py
    assert 'runtimeContext' in graph_py or 'GRAPH_RUNTIME_SETTINGS' in graph_py


def test_v61_runner_passes_runtime_context_and_subagent_hints_are_polished() -> None:
    runner_text = RUNNER.read_text(encoding='utf-8')
    assert 'runtime_context' in runner_text
    assert 'context' in runner_text

    payload = GraphPayload(
        graph_id='v61_subagent_hint_graph',
        ui_context={
            'artifact_type': 'agent',
            'execution_profile': 'langchain_agent',
            'project_mode': 'langchain',
            'runtime_settings': {
                'subagentLibrary': [
                    {
                        'name': 'research',
                        'agents': [
                            {
                                'name': 'writer',
                                'systemPrompt': 'You are a writing subagent.',
                                'tools': [],
                                'description': 'Writes concise drafts.',
                            }
                        ],
                    }
                ]
            },
        },
        state_schema=[{'name': 'messages', 'type': 'list[Any]', 'reducer': 'operator.add'}],
        nodes=[{'id': 'agent_1', 'type': 'react_agent', 'params': {'provider': 'ollama', 'model_name': 'llama3', 'tools_linked': ['sub_tool']}}],
        tools=[{'id': 'sub_tool', 'type': 'sub_agent_tool', 'description': 'Delegate to the writer subagent.', 'params': {'target_group': 'research', 'target_agent': 'writer', 'provider': 'ollama', 'model_name': 'llama3', 'max_invocations': 1, 'allow_repeat': ''}}],
        edges=[],
        is_async=True,
    )
    buf = compile_graph(payload)
    tools_py = _read_zip_text(buf, 'tools.py', payload.graph_id)
    nodes_py = _read_zip_text(buf, 'nodes.py', payload.graph_id)
    assert 'runs ephemerally with its configured system prompt and tools' in tools_py
    assert 'delegate a focused task' in nodes_py
