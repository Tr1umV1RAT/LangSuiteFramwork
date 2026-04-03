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
        graph_id='v36_bridge_graph',
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


def test_v1_bridge_still_compiles() -> None:
    zip_buffer = compile_graph(_langgraph_wrapper_payload('artifact:agent/minimal_agent'))
    with zipfile.ZipFile(io.BytesIO(zip_buffer.getvalue()), 'r') as zf:
        graph_py = zf.read('v36_bridge_graph/graph.py').decode('utf-8')
    assert 'langchain_agent_to_langgraph_v1' in graph_py
    assert 'artifact:agent/minimal_agent' in graph_py


def test_v2_tool_enabled_bridge_is_listed_as_compile_capable() -> None:
    client = TestClient(app)
    response = client.get('/api/artifacts?include_advanced=true&project_mode=langgraph')
    assert response.status_code == 200
    payload = response.json()
    agent = next(item for item in payload if item['kind'] == 'agent' and item['id'] == 'dice_agent')
    assert agent['bridgeStatus'] == 'supported'
    assert agent['bridgeSupportLevel'] == 'compile_capable'
    assert 'langchain_agent_to_langgraph_v2' in (agent.get('bridgeContractIds') or [])
    assert any('rpg_dice_roller' in entry for entry in (agent.get('bridgeConstraints') or []))


def test_v2_tool_enabled_bridge_generates_lowered_tools() -> None:
    payload = _langgraph_wrapper_payload('artifact:agent/dice_agent')
    zip_buffer = compile_graph(payload)
    with zipfile.ZipFile(io.BytesIO(zip_buffer.getvalue()), 'r') as zf:
        graph_py = zf.read('v36_bridge_graph/graph.py').decode('utf-8')
        nodes_py = zf.read('v36_bridge_graph/nodes.py').decode('utf-8')
        tools_py = zf.read('v36_bridge_graph/tools.py').decode('utf-8')
    assert 'langchain_agent_to_langgraph_v2' in graph_py
    assert 'build_graph_bridge_dice_agent' in graph_py
    assert 'bridge_dice_agent_react_agent_2_node' in nodes_py
    assert 'bridge_dice_agent_dice_tool_1' in tools_py
    assert 'Jet de' in tools_py


def test_unsupported_langchain_tool_bridge_shape_is_rejected_clearly() -> None:
    save_artifact_manifest({
        'id': 'v36_bad_tool_agent',
        'kind': 'agent',
        'title': 'v36 bad tool agent',
        'artifact': {
            'name': 'v36 bad tool agent',
            'artifactType': 'agent',
            'executionProfile': 'langchain_agent',
            'projectMode': 'langchain',
            'nodes': [
                {
                    'id': 'react_agent_1',
                    'type': 'custom',
                    'position': {'x': 0, 'y': 0},
                    'data': {
                        'nodeType': 'react_agent',
                        'label': 'React Agent 1',
                        'params': {'provider': 'openai', 'model_name': 'gpt-4o', 'tools_linked': ['tool_python_1']},
                    },
                }
            ],
            'edges': [],
            'tools': [
                {'id': 'tool_python_1', 'type': 'python_function', 'code': 'def x():\n    return 1'}
            ],
        },
    })
    with pytest.raises(ValidationError) as exc:
        _langgraph_wrapper_payload('artifact:agent/v36_bad_tool_agent')
    assert 'allowed shared tools' in str(exc.value)


def test_nested_bridge_chain_still_rejected() -> None:
    save_artifact_manifest({
        'id': 'v36_nested_tool_agent',
        'kind': 'agent',
        'title': 'v36 nested tool agent',
        'artifact': {
            'name': 'v36 nested tool agent',
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
                        'params': {'target_subgraph': 'artifact:agent/minimal_agent'},
                    },
                }
            ],
            'edges': [],
        },
    })
    with pytest.raises(ValidationError) as exc:
        _langgraph_wrapper_payload('artifact:agent/v36_nested_tool_agent')
    assert 'nested artifact wrapper references' in str(exc.value)
