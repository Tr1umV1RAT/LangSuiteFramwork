from __future__ import annotations

import io
import json
import sys
import zipfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.compiler import compile_graph
from core.schemas import GraphPayload

NODE_CONFIG = ROOT / 'client' / 'src' / 'nodeConfig.ts'
CAP_MATRIX = ROOT / 'client' / 'src' / 'capabilityMatrix.json'


def _read_zip_text(buf: io.BytesIO, filename: str, graph_id: str) -> str:
    with zipfile.ZipFile(io.BytesIO(buf.getvalue()), 'r') as zf:
        return zf.read(f'{graph_id}/{filename}').decode('utf-8')


def test_new_node_families_have_explicit_runtime_metadata() -> None:
    matrix = json.loads(CAP_MATRIX.read_text(encoding='utf-8'))['nodeTypes']
    node_config_text = NODE_CONFIG.read_text(encoding='utf-8')

    for node_type in ['command_node', 'handoff_node', 'store_put', 'store_search']:
        assert f"{node_type}: {{" in node_config_text
        assert node_type in matrix

    assert matrix['command_node']['blockFamilyHint'] == 'native'
    assert matrix['handoff_node']['surfaceLevel'] == 'advanced'
    assert matrix['store_put']['executionPlacement'] == 'memory'
    assert matrix['store_search']['quickProps'] == ['store', 'search', 'memory']


def test_command_and_handoff_nodes_compile_to_command_with_direct_goto() -> None:
    payload = GraphPayload(
        graph_id='v41_command_compile',
        ui_context={'artifact_type': 'graph', 'execution_profile': 'langgraph_sync', 'project_mode': 'langgraph'},
        nodes=[
            {'id': 'command_1', 'type': 'command_node', 'params': {'target_key': 'route_state', 'new_value': 'approved'}},
            {'id': 'handoff_1', 'type': 'handoff_node', 'params': {'handoff_key': 'active_agent', 'handoff_value': 'research_agent'}},
            {'id': 'chat_output_1', 'type': 'chat_output', 'params': {'input_key': 'messages'}},
        ],
        edges=[
            {'source': 'command_1', 'target': 'handoff_1', 'type': 'direct'},
            {'source': 'handoff_1', 'target': 'chat_output_1', 'type': 'direct'},
        ],
        tools=[],
        is_async=False,
    )
    buf = compile_graph(payload)
    nodes_py = _read_zip_text(buf, 'nodes.py', payload.graph_id)
    graph_py = _read_zip_text(buf, 'graph.py', payload.graph_id)

    assert 'return Command(update=update_payload, goto="handoff_1")' in nodes_py
    assert 'return Command(update=update_payload, goto="chat_output_1")' in nodes_py
    assert 'builder.add_node("command_1", command_1_node, ends=["handoff_1"])' in graph_py
    assert 'builder.add_node("handoff_1", handoff_1_node, ends=["chat_output_1"])' in graph_py


def test_store_nodes_compile_with_runtime_store_access() -> None:
    payload = GraphPayload(
        graph_id='v41_store_compile',
        ui_context={'artifact_type': 'graph', 'execution_profile': 'langgraph_async', 'project_mode': 'langgraph'},
        nodes=[
            {'id': 'store_put_1', 'type': 'store_put', 'params': {'namespace_prefix': 'profiles', 'store_item_key': 'summary', 'state_key_to_save': 'messages', 'output_key': 'store_receipt'}},
            {'id': 'store_search_1', 'type': 'store_search', 'params': {'namespace_prefix': 'profiles', 'query_key': 'messages', 'output_key': 'store_results', 'limit': 3}},
        ],
        edges=[{'source': 'store_put_1', 'target': 'store_search_1', 'type': 'direct'}],
        tools=[],
        is_async=True,
    )
    buf = compile_graph(payload)
    nodes_py = _read_zip_text(buf, 'nodes.py', payload.graph_id)

    assert 'await store.aput(namespace, item_key, payload)' in nodes_py
    assert 'return {"store_receipt": {"namespace": list(namespace), "key": item_key, "stored": True}, "__memory_meta__": memory_meta}' in nodes_py
    assert 'search_fn = getattr(store, "asearch", None)' in nodes_py
    assert 'return {output_key: results, "__memory_meta__": memory_meta}' in nodes_py


def test_command_like_nodes_reject_multiple_direct_outgoing_edges() -> None:
    payload = GraphPayload(
        graph_id='v41_bad_command',
        ui_context={'artifact_type': 'graph', 'execution_profile': 'langgraph_sync', 'project_mode': 'langgraph'},
        nodes=[
            {'id': 'command_1', 'type': 'command_node', 'params': {'target_key': 'route_state', 'new_value': 'approved'}},
            {'id': 'chat_output_a', 'type': 'chat_output', 'params': {'input_key': 'messages'}},
            {'id': 'chat_output_b', 'type': 'chat_output', 'params': {'input_key': 'messages'}},
        ],
        edges=[
            {'source': 'command_1', 'target': 'chat_output_a', 'type': 'direct'},
            {'source': 'command_1', 'target': 'chat_output_b', 'type': 'direct'},
        ],
        tools=[],
        is_async=False,
    )
    with pytest.raises(ValueError) as exc:
        compile_graph(payload)
    assert "supports at most one direct outgoing edge" in str(exc.value)
