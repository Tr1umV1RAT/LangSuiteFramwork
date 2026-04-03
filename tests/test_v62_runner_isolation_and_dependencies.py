from __future__ import annotations

import importlib.util
import sys
import tempfile
import types
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api.runner import _cleanup_loaded_graph
from core.runtime_dependencies import find_missing_runtime_dependencies
from core.schemas import GraphPayload
import main


def _minimal_payload(graph_id: str = 'v62_minimal') -> GraphPayload:
    return GraphPayload(graph_id=graph_id, nodes=[], edges=[], tools=[])


def test_cleanup_purges_generated_modules_under_project_dir() -> None:
    with tempfile.TemporaryDirectory(prefix='v62_cleanup_') as tmp_dir:
        project_dir = Path(tmp_dir) / 'graph_proj'
        project_dir.mkdir()

        sentinel = types.ModuleType('graph')
        previous = sys.modules.get('graph')
        sys.modules['graph'] = sentinel

        leaked = types.ModuleType('leaked_generated_module')
        leaked.__file__ = str(project_dir / 'leaked_generated_module.py')
        sys.modules['leaked_generated_module'] = leaked

        runtime_ctx = {
            'tmp_dir': tmp_dir,
            'project_dir': str(project_dir),
            'graph_module_name': None,
            'graph_module': types.ModuleType('_generated_graph'),
            'previous_graph_module': sentinel,
        }
        _cleanup_loaded_graph(runtime_ctx)

    assert 'leaked_generated_module' not in sys.modules
    assert sys.modules.get('graph') is sentinel
    if previous is None:
        sys.modules.pop('graph', None)
    else:
        sys.modules['graph'] = previous


@pytest.mark.skipif(
    all(importlib.util.find_spec(name) is not None for name in ('langgraph', 'langchain', 'langchain_core')),
    reason='dependency preflight path only applies when LangGraph/LangChain runtime deps are absent',
)
def test_runner_reports_missing_runtime_dependencies_before_build() -> None:
    client = TestClient(main.app)
    with client.websocket_connect('/api/ws/run/v62-runtime-deps') as ws:
        ws.send_json({'action': 'start', 'payload': {'graph_id': 'v62-runtime-deps', 'nodes': [], 'edges': [], 'tools': []}})
        message = ws.receive_json()
    assert message['type'] == 'error'
    assert message['stage'] == 'runtime_dependencies'
    assert message.get('missingDependencies')
    packages = {item['package'] for item in message['missingDependencies']}
    assert {'langgraph', 'langchain', 'langchain-core'} & packages


def test_runtime_dependency_preflight_detects_missing_base_packages() -> None:
    missing = find_missing_runtime_dependencies(_minimal_payload('v62-preflight'))
    expected_missing = {name for name in ('langgraph', 'langchain', 'langchain_core') if importlib.util.find_spec(name) is None}
    assert expected_missing <= {item['module'] for item in missing}
