from __future__ import annotations

import asyncio

import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient
from langchain_core.messages import HumanMessage

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import main
from api.runner import _cleanup_loaded_graph, _extract_and_load_graph
from core.compiler import compile_graph
from core.schemas import GraphPayload
from core.artifact_registry import REGISTRY_ROOT, KIND_DIRS


def _embedded_payload(target_subgraph: str) -> GraphPayload:
    return GraphPayload(
        graph_id='v38_embedded_host',
        ui_context={'artifact_type': 'graph', 'execution_profile': 'langgraph_async', 'project_mode': 'langgraph'},
        nodes=[
            {
                'id': 'sub_agent_1',
                'type': 'sub_agent',
                'params': {
                    'target_subgraph': target_subgraph,
                    'artifact_ref_kind': 'agent',
                    'artifact_ref_id': target_subgraph.split('/', 1)[1],
                    'artifact_execution_kind': 'embedded_native',
                },
            }
        ],
        edges=[],
        tools=[],
        is_async=True,
    )


def test_embedded_native_bridge_compiles_and_marks_metadata() -> None:
    payload = _embedded_payload('artifact:agent/embedded_debug_agent')
    zip_buffer = compile_graph(payload)
    import zipfile

    with zipfile.ZipFile(zip_buffer, 'r') as zf:
        graph_py = zf.read(f'{payload.graph_id}/graph.py').decode('utf-8')
        assert 'langchain_agent_embedded_v1' in graph_py
        assert 'embedded_native' in graph_py
        assert 'artifact:agent/embedded_debug_agent' in graph_py


def test_embedded_native_runtime_invokes_provider_free_artifact() -> None:
    payload = _embedded_payload('artifact:agent/embedded_debug_agent')
    runtime_ctx = _extract_and_load_graph(payload)
    try:
        result = asyncio.run(runtime_ctx['graph'].ainvoke(
            runtime_ctx['bootstrap_state']({'messages': [HumanMessage(content='hello embedded artifact')]})
        ))
        assert 'messages' in result
        assert len(result['messages']) == 1
        assert getattr(result['messages'][0], 'content', '') == 'hello embedded artifact'
    finally:
        _cleanup_loaded_graph(runtime_ctx)


def test_runner_websocket_completes_for_embedded_native_artifact() -> None:
    client = TestClient(main.app)
    payload = {
        'graph_id': 'v38_ws_embedded',
        'ui_context': {'artifact_type': 'graph', 'execution_profile': 'langgraph_async', 'project_mode': 'langgraph'},
        'nodes': [
            {
                'id': 'sub_agent_1',
                'type': 'sub_agent',
                'params': {
                    'target_subgraph': 'artifact:agent/embedded_debug_agent',
                    'artifact_ref_kind': 'agent',
                    'artifact_ref_id': 'embedded_debug_agent',
                    'artifact_execution_kind': 'embedded_native',
                },
            }
        ],
        'edges': [],
        'tools': [],
        'is_async': True,
    }
    with client.websocket_connect('/api/ws/run/v38_ws_embedded') as ws:
        ws.send_text(json.dumps({'action': 'start', 'payload': payload, 'inputs': {'messages': ['browser embedded hello']}}))
        terminal = None
        node_update = None
        for _ in range(16):
            msg = ws.receive_json()
            if msg.get('type') == 'node_update':
                node_update = msg
            if msg.get('type') in ('completed', 'error'):
                terminal = msg
                break
        assert terminal is not None
        assert terminal.get('type') == 'completed'
        assert node_update is not None
        payload = node_update.get('data', {})
        update = payload.get('sub_agent_1') or {}
        messages = update.get('messages', []) if isinstance(update, dict) else []
        assert messages and messages[0].get('content') == 'browser embedded hello'


def test_embedded_native_bridge_rejects_nested_wrapper_chains() -> None:
    agents_dir = REGISTRY_ROOT / KIND_DIRS['agent']
    bad_path = agents_dir / 'v38_bad_embedded_nested.json'
    bad_path.write_text(
        json.dumps(
            {
                'id': 'v38_bad_embedded_nested',
                'kind': 'agent',
                'title': 'Bad Embedded Nested Agent',
                'artifact': {
                    'name': 'Bad Embedded Nested Agent',
                    'nodes': [
                        {
                            'id': 'sub_agent_1',
                            'type': 'custom',
                            'position': {'x': 20, 'y': 20},
                            'data': {'nodeType': 'sub_agent', 'label': 'Nested Wrapper', 'params': {'target_subgraph': 'artifact:agent/minimal_agent'}},
                        }
                    ],
                    'edges': [],
                    'tools': [],
                    'artifactType': 'agent',
                    'executionProfile': 'langchain_agent',
                    'projectMode': 'langchain',
                    'isAsync': True,
                },
            },
            indent=2,
        ),
        encoding='utf-8',
    )
    try:
        try:
            GraphPayload(**{
                'graph_id': 'v38_bad_embedded',
                'ui_context': {'artifact_type': 'graph', 'execution_profile': 'langgraph_async', 'project_mode': 'langgraph'},
                'nodes': [
                    {
                        'id': 'sub_agent_1',
                        'type': 'sub_agent',
                        'params': {
                            'target_subgraph': 'artifact:agent/v38_bad_embedded_nested',
                            'artifact_ref_kind': 'agent',
                            'artifact_ref_id': 'v38_bad_embedded_nested',
                            'artifact_execution_kind': 'embedded_native',
                        },
                    }
                ],
                'edges': [],
                'tools': [],
                'is_async': True,
            })
        except Exception as exc:
            assert 'nested_bridge_chain_not_supported' in str(exc)
        else:
            raise AssertionError('Expected embedded nested wrapper validation to fail')
    finally:
        bad_path.unlink(missing_ok=True)


def test_artifact_library_exposes_embedded_native_model_for_langchain_agents() -> None:
    client = TestClient(main.app)
    response = client.get('/api/artifacts', params={'include_advanced': 'true', 'project_mode': 'langgraph'})
    assert response.status_code == 200
    payload = response.json()
    entry = next(item for item in payload if item['kind'] == 'agent' and item['id'] == 'embedded_debug_agent')
    models = entry.get('bridgeModels') or []
    embedded = next((item for item in models if item.get('integrationModel') == 'embedded_native'), None)
    assert embedded is not None
    assert embedded.get('supportLevel') == 'compile_capable'
    assert 'langchain_agent_embedded_v1' in (embedded.get('bridgeContractIds') or [])
