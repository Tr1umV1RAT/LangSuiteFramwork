from __future__ import annotations

import io
import zipfile

from fastapi.testclient import TestClient

from core.compiler import compile_graph
from core.schemas import GraphPayload, UIContext
from main import app


def test_artifact_api_can_filter_by_project_mode() -> None:
    client = TestClient(app)

    langgraph = client.get('/api/artifacts?project_mode=langgraph')
    assert langgraph.status_code == 200
    assert {item['kind'] for item in langgraph.json()} <= {'graph', 'subgraph'}
    assert {item.get('projectMode') for item in langgraph.json()} <= {'langgraph'}

    deepagents = client.get('/api/artifacts?include_advanced=true&project_mode=deepagents')
    assert deepagents.status_code == 200
    payload = deepagents.json()
    assert payload
    assert {item['kind'] for item in payload} == {'deep_agent'}
    assert {item.get('projectMode') for item in payload} == {'deepagents'}


def test_deepagents_payload_preserves_values_stream_default_in_generated_graph() -> None:
    payload = GraphPayload(
        graph_id='v33_deepagents_mode',
        ui_context=UIContext(
            artifact_type='deep_agent',
            execution_profile='deepagents',
            project_mode='deepagents',
            runtime_settings={
                'recursionLimit': 75,
                'streamMode': 'values',
                'debug': True,
                'inheritParentBindings': True,
            },
        ),
        nodes=[],
        edges=[],
        tools=[],
    )
    archive = compile_graph(payload)
    with zipfile.ZipFile(io.BytesIO(archive.getvalue()), 'r') as zf:
        graph_py = zf.read('v33_deepagents_mode/graph.py').decode('utf-8')
        assert "'streamMode': 'values'" in graph_py or '"streamMode": "values"' in graph_py
        assert "'project_mode': 'deepagents'" in graph_py or '"project_mode": "deepagents"' in graph_py
