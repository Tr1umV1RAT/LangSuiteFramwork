from __future__ import annotations

import io
import json
import zipfile

from fastapi.testclient import TestClient
from pydantic import ValidationError

from core.artifact_registry import save_artifact_manifest
from core.compiler import compile_graph
from core.schemas import GraphNode, GraphPayload, NodeParams, UIContext
from main import app


def _langgraph_wrapper_payload(target_subgraph: str) -> GraphPayload:
    return GraphPayload(
        graph_id='v35_bridge_graph',
        ui_context=UIContext(
            artifact_type='graph',
            execution_profile='langgraph_async',
            project_mode='langgraph',
        ),
        nodes=[
            GraphNode(
                id='sub_agent_1',
                type='sub_agent',
                params=NodeParams(target_subgraph=target_subgraph),
            )
        ],
        edges=[],
        tools=[],
        is_async=True,
    )


def test_langchain_bridge_is_listed_as_compile_capable_for_langgraph() -> None:
    client = TestClient(app)
    response = client.get('/api/artifacts?include_advanced=true&project_mode=langgraph')
    assert response.status_code == 200
    payload = response.json()
    agent = next(item for item in payload if item['kind'] == 'agent' and item['id'] == 'minimal_agent')
    assert agent['bridgeStatus'] == 'supported'
    assert agent['bridgeSupportLevel'] == 'compile_capable'
    assert agent['bridgeTargetMode'] == 'langgraph'


def test_compile_capable_langchain_bridge_generates_lowered_graph_code() -> None:
    payload = _langgraph_wrapper_payload('artifact:agent/minimal_agent')
    zip_buffer = compile_graph(payload)
    with zipfile.ZipFile(io.BytesIO(zip_buffer.getvalue()), 'r') as zf:
        graph_py = zf.read('v35_bridge_graph/graph.py').decode('utf-8')
        nodes_py = zf.read('v35_bridge_graph/nodes.py').decode('utf-8')
    assert 'artifact:agent/minimal_agent' in graph_py
    assert 'build_graph_bridge_minimal_agent' in graph_py
    assert 'bridge_minimal_agent_react_agent_1_node' in nodes_py
    assert 'llm = build_chat_model' in nodes_py


def test_unsupported_langchain_bridge_shape_is_rejected_clearly() -> None:
    save_artifact_manifest({
        'id': 'v35_bad_nested_agent',
        'kind': 'agent',
        'title': 'v35 bad nested agent',
        'artifact': {
            'name': 'v35 bad nested agent',
            'artifactType': 'agent',
            'executionProfile': 'langchain_agent',
            'projectMode': 'langchain',
            'nodes': [
                {
                    'id': 'sub_agent_1',
                    'type': 'custom',
                    'position': {'x': 0, 'y': 0},
                    'data': {
                        'nodeType': 'sub_agent',
                        'label': 'Sub Agent 1',
                        'params': {'target_subgraph': 'artifact:subgraph/empty_subgraph'},
                    },
                }
            ],
            'edges': [],
        },
    })
    try:
        _langgraph_wrapper_payload('artifact:agent/v35_bad_nested_agent')
    except ValidationError as exc:
        assert 'does not support nested artifact wrapper references' in str(exc)
    else:
        raise AssertionError('Expected unsupported LangChain bridge shape to be rejected')


def test_static_langchain_bridge_can_run_through_langgraph_trunk() -> None:
    save_artifact_manifest({
        'id': 'v35_static_bridge_agent',
        'kind': 'agent',
        'title': 'v35 static bridge agent',
        'artifact': {
            'name': 'v35 static bridge agent',
            'artifactType': 'agent',
            'executionProfile': 'langchain_agent',
            'projectMode': 'langchain',
            'nodes': [
                {
                    'id': 'static_text_1',
                    'type': 'custom',
                    'position': {'x': 0, 'y': 0},
                    'data': {
                        'nodeType': 'static_text',
                        'label': 'Static Text 1',
                        'params': {'text': 'hello from bridge', 'output_key': 'messages'},
                    },
                }
            ],
            'edges': [],
        },
    })

    payload = {
        'graph_id': 'v35_bridge_runtime',
        'ui_context': {
            'artifact_type': 'graph',
            'execution_profile': 'langgraph_async',
            'project_mode': 'langgraph',
        },
        'nodes': [
            {
                'id': 'sub_agent_1',
                'type': 'sub_agent',
                'params': {'target_subgraph': 'artifact:agent/v35_static_bridge_agent'},
            }
        ],
        'edges': [],
        'tools': [],
        'is_async': True,
    }

    client = TestClient(app)
    with client.websocket_connect('/api/ws/run/v35-bridge-run') as ws:
        ws.send_json({'action': 'start', 'payload': payload, 'inputs': {'messages': []}})
        saw_started = False
        saw_completed = False
        for _ in range(8):
            msg = ws.receive_json()
            if msg.get('type') == 'started':
                saw_started = True
                continue
            if msg.get('type') == 'completed':
                saw_completed = True
                break
            if msg.get('type') == 'error':
                if msg.get('stage') == 'runtime_dependencies':
                    missing = {item['module'] for item in msg.get('missingDependencies', [])}
                    assert {'langgraph', 'langchain', 'langchain_core'} <= missing
                    return
                raise AssertionError(f"Unexpected runner error: {json.dumps(msg)}")
        assert saw_started
        assert saw_completed
