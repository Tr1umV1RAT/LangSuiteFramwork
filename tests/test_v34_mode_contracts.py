from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from core.schemas import GraphNode, GraphPayload, NodeParams, UIContext
from main import app
from core.artifact_registry import save_artifact_manifest


def test_langgraph_advanced_library_lists_explicit_bridge_artifacts() -> None:
    client = TestClient(app)
    response = client.get('/api/artifacts?include_advanced=true&project_mode=langgraph')
    assert response.status_code == 200
    payload = response.json()
    kinds = {item['kind'] for item in payload}
    assert {'graph', 'subgraph', 'agent', 'deep_agent'} <= kinds
    agent_items = [item for item in payload if item['kind'] == 'agent']
    deep_items = [item for item in payload if item['kind'] == 'deep_agent']
    assert agent_items and deep_items
    assert all(item.get('bridgeStatus') == 'supported' for item in agent_items)
    assert all(item.get('bridgeSupportLevel') == 'compile_capable' for item in agent_items)
    assert all(item.get('bridgeStatus') == 'partial' for item in deep_items)
    assert all(item.get('bridgeSupportLevel') == 'editor_package_only' for item in deep_items)


def test_langchain_default_library_stays_mode_local() -> None:
    client = TestClient(app)
    response = client.get('/api/artifacts?project_mode=langchain')
    assert response.status_code == 200
    payload = response.json()
    assert payload
    assert {item['kind'] for item in payload} == {'agent'}
    assert {item['projectMode'] for item in payload} == {'langchain'}


def test_mode_contract_blocks_invalid_langchain_to_langgraph_compile_bridge() -> None:
    save_artifact_manifest({
        'id': 'invalid_nested_agent_bridge',
        'kind': 'agent',
        'title': 'invalid nested agent bridge',
        'artifact': {
            'name': 'invalid nested agent bridge',
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
    with pytest.raises(ValidationError):
        GraphPayload(
            graph_id='v34_invalid_bridge',
            ui_context=UIContext(
                artifact_type='graph',
                execution_profile='langgraph_async',
                project_mode='langgraph',
            ),
            nodes=[
                GraphNode(
                    id='sub_agent_1',
                    type='sub_agent',
                    params=NodeParams(
                        target_subgraph='artifact:agent/invalid_nested_agent_bridge',
                    ),
                )
            ],
            edges=[],
            tools=[],
        )


def test_save_artifact_rejects_mode_mismatch() -> None:
    client = TestClient(app)
    response = client.post(
        '/api/artifacts',
        json={
            'kind': 'graph',
            'title': 'bad graph mode mismatch',
            'artifact': {
                'name': 'bad graph mode mismatch',
                'artifactType': 'graph',
                'executionProfile': 'langgraph_async',
                'projectMode': 'langchain',
                'nodes': [],
                'edges': [],
            },
        },
    )
    assert response.status_code == 422
    assert 'not allowed' in response.json()['detail']


def test_runner_rejects_langchain_editor_only_mode_before_runtime_build() -> None:
    client = TestClient(app)
    with client.websocket_connect('/api/ws/run/test-session') as ws:
        ws.send_json({
            'action': 'start',
            'payload': {
                'graph_id': 'v34_langchain_editor_only',
                'ui_context': {
                    'artifact_type': 'agent',
                    'execution_profile': 'langchain_agent',
                    'project_mode': 'langchain',
                },
                'nodes': [],
                'edges': [],
                'tools': [],
            },
        })
        message = ws.receive_json()
        assert message['type'] == 'error'
        assert message['stage'] == 'before_run'
        assert 'editor-only' in message['message']
