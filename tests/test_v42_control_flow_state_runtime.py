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


def test_v42_nodes_have_explicit_runtime_metadata() -> None:
    matrix = json.loads(CAP_MATRIX.read_text(encoding='utf-8'))['nodeTypes']
    node_config_text = NODE_CONFIG.read_text(encoding='utf-8')

    for node_type in ['send_fanout', 'store_get', 'store_delete']:
        assert f"{node_type}: {{" in node_config_text
        assert node_type in matrix

    assert matrix['send_fanout']['quickProps'] == ['send', 'fanout', 'workers']
    assert matrix['store_get']['executionPlacement'] == 'memory'
    assert matrix['store_delete']['blockFamilyHint'] == 'structured'


def test_send_fanout_compiles_to_send_api_dispatch() -> None:
    payload = GraphPayload(
        graph_id='v42_send_compile',
        ui_context={'artifact_type': 'graph', 'execution_profile': 'langgraph_async', 'project_mode': 'langgraph'},
        state_schema=[
            {'name': 'documents', 'type': 'list[Any]', 'reducer': 'operator.add'},
            {'name': 'fanout_results', 'type': 'list[Any]', 'reducer': 'operator.add'},
        ],
        nodes=[
            {'id': 'send_1', 'type': 'send_fanout', 'params': {'items_key': 'documents', 'item_state_key': 'current_item', 'passthrough_state_keys': ['topic'], 'copy_custom_vars': 'true', 'copy_messages': 'false', 'fanout_count_key': 'fanout_count'}},
            {'id': 'debug_1', 'type': 'debug_print', 'params': {'input_key': 'current_item'}},
        ],
        edges=[{'source': 'send_1', 'target': 'debug_1', 'type': 'direct'}],
        tools=[],
        is_async=True,
    )
    buf = compile_graph(payload)
    nodes_py = _read_zip_text(buf, 'nodes.py', payload.graph_id)
    graph_py = _read_zip_text(buf, 'graph.py', payload.graph_id)

    assert 'def send_1_dispatch(state: AgentState):' in nodes_py
    assert 'payloads.append(Send(target, worker_state))' in nodes_py
    assert 'worker_state = {"current_item": item}' in nodes_py
    assert 'worker_state["__fanout_meta__"]' in nodes_py
    assert 'return {"fanout_count": len(_send_1_fanout_items(state))}' in nodes_py
    assert 'from langgraph.types import Send' in graph_py
    assert 'builder.add_conditional_edges(' in graph_py
    assert 'send_1_dispatch' in graph_py


def test_store_get_and_delete_compile_with_runtime_store_access() -> None:
    payload = GraphPayload(
        graph_id='v42_store_runtime',
        ui_context={'artifact_type': 'graph', 'execution_profile': 'langgraph_async', 'project_mode': 'langgraph'},
        nodes=[
            {'id': 'store_get_1', 'type': 'store_get', 'params': {'namespace_prefix': 'profiles', 'store_item_key': 'summary', 'output_key': 'store_value'}},
            {'id': 'store_delete_1', 'type': 'store_delete', 'params': {'namespace_prefix': 'profiles', 'store_item_key': 'summary', 'output_key': 'store_delete_receipt'}},
        ],
        edges=[{'source': 'store_get_1', 'target': 'store_delete_1', 'type': 'direct'}],
        tools=[],
        is_async=True,
    )
    buf = compile_graph(payload)
    nodes_py = _read_zip_text(buf, 'nodes.py', payload.graph_id)
    graph_py = _read_zip_text(buf, 'graph.py', payload.graph_id)

    assert 'get_fn = getattr(store, "aget", None)' in nodes_py
    assert 'return {output_key: value, "__memory_meta__": memory_meta}' in nodes_py
    assert 'delete_fn = getattr(store, "adelete", None)' in nodes_py
    assert 'return {"store_delete_receipt": {"namespace": list(namespace), "key": item_key, "deleted": deleted}, "__memory_meta__": memory_meta}' in nodes_py
    assert 'store = InMemoryStore()' in graph_py


def test_send_fanout_requires_exactly_one_direct_worker_edge() -> None:
    payload = GraphPayload(
        graph_id='v42_bad_send',
        ui_context={'artifact_type': 'graph', 'execution_profile': 'langgraph_sync', 'project_mode': 'langgraph'},
        nodes=[
            {'id': 'send_1', 'type': 'send_fanout', 'params': {'items_key': 'documents', 'item_state_key': 'current_item'}},
            {'id': 'debug_a', 'type': 'debug_print', 'params': {'input_key': 'current_item'}},
            {'id': 'debug_b', 'type': 'debug_print', 'params': {'input_key': 'current_item'}},
        ],
        edges=[
            {'source': 'send_1', 'target': 'debug_a', 'type': 'direct'},
            {'source': 'send_1', 'target': 'debug_b', 'type': 'direct'},
        ],
        tools=[],
        is_async=False,
    )
    with pytest.raises(ValueError) as exc:
        compile_graph(payload)
    assert 'supports at most one direct outgoing edge' in str(exc.value)
