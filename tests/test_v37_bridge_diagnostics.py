from __future__ import annotations

import io
import zipfile

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from core.artifact_registry import save_artifact_manifest
from core.compiler import compile_graph
from core.schemas import GraphNode, GraphPayload, NodeParams, UIContext
from main import app


def _langgraph_wrapper_payload(target_subgraph: str) -> GraphPayload:
    return GraphPayload(
        graph_id='v37_bridge_graph',
        ui_context=UIContext(artifact_type='graph', execution_profile='langgraph_async', project_mode='langgraph'),
        nodes=[GraphNode(id='sub_agent_1', type='sub_agent', params=NodeParams(target_subgraph=target_subgraph))],
        edges=[],
        tools=[],
        is_async=True,
    )


def test_v1_bridge_still_works() -> None:
    zip_buffer = compile_graph(_langgraph_wrapper_payload('artifact:agent/minimal_agent'))
    with zipfile.ZipFile(io.BytesIO(zip_buffer.getvalue()), 'r') as zf:
        graph_py = zf.read('v37_bridge_graph/graph.py').decode('utf-8')
    assert 'langchain_agent_to_langgraph_v1' in graph_py


def test_v2_dice_bridge_still_works() -> None:
    zip_buffer = compile_graph(_langgraph_wrapper_payload('artifact:agent/dice_agent'))
    with zipfile.ZipFile(io.BytesIO(zip_buffer.getvalue()), 'r') as zf:
        graph_py = zf.read('v37_bridge_graph/graph.py').decode('utf-8')
        tools_py = zf.read('v37_bridge_graph/tools.py').decode('utf-8')
    assert 'langchain_agent_to_langgraph_v2' in graph_py
    assert 'bridge_dice_agent_dice_tool_1' in tools_py


def test_v2_sql_tool_bridge_compiles_with_read_only_guard() -> None:
    zip_buffer = compile_graph(_langgraph_wrapper_payload('artifact:agent/sql_lookup_agent'))
    with zipfile.ZipFile(io.BytesIO(zip_buffer.getvalue()), 'r') as zf:
        graph_py = zf.read('v37_bridge_graph/graph.py').decode('utf-8')
        tools_py = zf.read('v37_bridge_graph/tools.py').decode('utf-8')
    assert 'langchain_agent_to_langgraph_v2' in graph_py
    assert 'bridge_sql_lookup_agent_sql_lookup_1' in tools_py
    assert 'read-only mode only allows SELECT/WITH/PRAGMA' in tools_py


def test_bridge_library_metadata_exposes_second_tool_family_and_codes() -> None:
    client = TestClient(app)
    response = client.get('/api/artifacts?include_advanced=true&project_mode=langgraph')
    assert response.status_code == 200
    payload = response.json()
    agent = next(item for item in payload if item['kind'] == 'agent' and item['id'] == 'sql_lookup_agent')
    assert agent['bridgeStatus'] == 'supported'
    assert agent['bridgeSupportLevel'] == 'compile_capable'
    assert 'langchain_agent_to_langgraph_v2' in (agent.get('bridgeContractIds') or [])
    assert set(agent.get('bridgeAllowedToolFamilies') or []) == {'rpg_dice_roller', 'sql_query'}
    assert 'mixed_tool_families_not_supported' in (agent.get('bridgeRejectedReasonCodes') or [])


def test_mixed_tool_families_are_rejected_clearly() -> None:
    save_artifact_manifest({
        'id': 'v37_mixed_tool_agent', 'kind': 'agent', 'title': 'v37 mixed tool agent',
        'artifact': {
            'name': 'v37 mixed tool agent', 'artifactType': 'agent', 'executionProfile': 'langchain_agent', 'projectMode': 'langchain',
            'nodes': [{
                'id': 'react_agent_1', 'type': 'custom', 'position': {'x': 0, 'y': 0},
                'data': {'nodeType': 'react_agent', 'label': 'React Agent 1', 'params': {'provider': 'openai', 'model_name': 'gpt-4o', 'tools_linked': ['dice_tool_1', 'sql_lookup_1']}},
            }],
            'edges': [],
            'tools': [
                {'id': 'dice_tool_1', 'type': 'rpg_dice_roller'},
                {'id': 'sql_lookup_1', 'type': 'sql_query', 'params': {'db_path': 'bridge_lookup.db'}},
            ],
        },
    })
    with pytest.raises(ValidationError) as exc:
        _langgraph_wrapper_payload('artifact:agent/v37_mixed_tool_agent')
    assert 'mixed_tool_families_not_supported' in str(exc.value)


def test_compile_endpoint_returns_reason_codes_for_bad_bridge() -> None:
    save_artifact_manifest({
        'id': 'v37_bad_tool_agent', 'kind': 'agent', 'title': 'v37 bad tool agent',
        'artifact': {
            'name': 'v37 bad tool agent', 'artifactType': 'agent', 'executionProfile': 'langchain_agent', 'projectMode': 'langchain',
            'nodes': [{
                'id': 'react_agent_1', 'type': 'custom', 'position': {'x': 0, 'y': 0},
                'data': {'nodeType': 'react_agent', 'label': 'React Agent 1', 'params': {'provider': 'openai', 'model_name': 'gpt-4o', 'tools_linked': ['bad_tool_1']}},
            }],
            'edges': [],
            'tools': [{'id': 'bad_tool_1', 'type': 'web_search'}],
        },
    })
    client = TestClient(app)
    payload = {'graph_id': 'v37_bridge_graph', 'ui_context': {'artifact_type': 'graph', 'execution_profile': 'langgraph_async', 'project_mode': 'langgraph'}, 'nodes': [{'id': 'sub_agent_1', 'type': 'sub_agent', 'params': {'target_subgraph': 'artifact:agent/v37_bad_tool_agent'}}], 'edges': [], 'tools': [], 'is_async': True}
    response = client.post('/compile', json=payload)
    assert response.status_code == 422
    body = response.json()
    assert body['stage'] == 'payload_validation'
    assert body['errors'][0]['reasonCode'] == 'unsupported_tool_family'


def test_nested_bridge_chain_still_rejected_with_reason_code() -> None:
    save_artifact_manifest({
        'id': 'v37_nested_tool_agent', 'kind': 'agent', 'title': 'v37 nested tool agent',
        'artifact': {
            'name': 'v37 nested tool agent', 'artifactType': 'agent', 'executionProfile': 'langchain_agent', 'projectMode': 'langchain',
            'nodes': [{
                'id': 'sub_agent_1', 'type': 'custom', 'position': {'x': 0, 'y': 0},
                'data': {'nodeType': 'sub_agent', 'label': 'Sub Agent 1', 'params': {'target_subgraph': 'artifact:agent/minimal_agent'}},
            }],
            'edges': [],
        },
    })
    with pytest.raises(ValidationError) as exc:
        _langgraph_wrapper_payload('artifact:agent/v37_nested_tool_agent')
    assert 'nested_bridge_chain_not_supported' in str(exc.value)
