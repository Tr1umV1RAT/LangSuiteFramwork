from __future__ import annotations

import asyncio
import io
import sys
import zipfile
from pathlib import Path

from fastapi.testclient import TestClient
from langchain_core.messages import HumanMessage

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api.runner import _cleanup_loaded_graph, _extract_and_load_graph
from core.artifact_registry import list_artifacts
from core.compiler import compile_graph
from core.schemas import GraphPayload, UIContext
from main import app


def test_advanced_artifact_library_surface_is_opt_in() -> None:
    visible = list_artifacts()
    assert {item['kind'] for item in visible} <= {'graph', 'subgraph'}

    advanced = list_artifacts(include_advanced=True)
    kinds = {item['kind'] for item in advanced}
    assert {'graph', 'subgraph', 'agent', 'deep_agent'} <= kinds

    agent_item = next(item for item in advanced if item['kind'] == 'agent')
    assert agent_item['surfaceLevel'] == 'advanced'
    assert agent_item['trunkDependent'] is True
    assert agent_item['adapterBacked'] is True


def test_advanced_artifact_api_surface_is_opt_in_and_described() -> None:
    client = TestClient(app)

    default_response = client.get('/api/artifacts')
    assert default_response.status_code == 200
    assert all(item['kind'] in {'graph', 'subgraph'} for item in default_response.json())

    advanced_response = client.get('/api/artifacts?include_advanced=true')
    assert advanced_response.status_code == 200
    payload = advanced_response.json()
    assert {'graph', 'subgraph', 'agent', 'deep_agent'} <= {item['kind'] for item in payload}
    deep_item = next(item for item in payload if item['kind'] == 'deep_agent')
    assert deep_item['surfaceLevel'] == 'advanced'
    assert deep_item['rail'] == 'adapter'


def test_agent_shell_payload_compiles_and_imports_as_trunk_dependent_surface() -> None:
    payload = GraphPayload(
        graph_id='v32_agent_shell',
        ui_context=UIContext(artifact_type='agent', execution_profile='langchain_agent'),
        nodes=[
            {
                'id': 'react_agent_1',
                'type': 'react_agent',
                'params': {
                    'provider': 'openai',
                    'model_name': 'gpt-4o-mini',
                    'system_prompt': 'You are helpful.',
                    'tools_linked': [],
                },
            }
        ],
        edges=[],
        tools=[],
    )
    archive = compile_graph(payload)
    with zipfile.ZipFile(io.BytesIO(archive.getvalue()), 'r') as zf:
        names = set(zf.namelist())
        assert f'{payload.graph_id}/graph.py' in names
        assert f'{payload.graph_id}/nodes.py' in names
        nodes_py = zf.read(f'{payload.graph_id}/nodes.py').decode('utf-8')
        assert 'react_agent_1_node' in nodes_py

    runtime_ctx = _extract_and_load_graph(payload)
    try:
        assert runtime_ctx['graph'] is not None
        assert callable(runtime_ctx['bootstrap_state'])
    finally:
        _cleanup_loaded_graph(runtime_ctx)


def test_deep_agent_suite_runs_through_alias_backed_trunk_path() -> None:
    payload = GraphPayload(
        graph_id='v32_deep_agent_suite',
        ui_context=UIContext(artifact_type='deep_agent', execution_profile='deepagents'),
        nodes=[
            {
                'id': 'suite_1',
                'type': 'deep_agent_suite',
                'outputs': ['messages'],
                'params': {'target_subgraph': 'missing_subgraph'},
            }
        ],
        edges=[],
        tools=[],
    )
    runtime_ctx = _extract_and_load_graph(payload)
    try:
        result = asyncio.run(runtime_ctx['graph'].ainvoke(runtime_ctx['bootstrap_state']({'messages': [HumanMessage(content='hello rail')]})))
        assert 'messages' in result
        assert result['messages']
        assert getattr(result['messages'][0], 'content', '') in {'hello rail', "Sous-circuit 'missing_subgraph' introuvable. Circuits disponibles: main"}
    finally:
        _cleanup_loaded_graph(runtime_ctx)
