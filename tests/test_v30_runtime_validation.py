from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient
from langchain_core.messages import HumanMessage

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api.runner import _cleanup_loaded_graph, _extract_and_load_graph
from core.schemas import GraphPayload
import main


def _runtime_payload(graph_id: str, *, nodes: list[dict], edges: list[dict] | None = None) -> GraphPayload:
    return GraphPayload(graph_id=graph_id, nodes=nodes, edges=edges or [], tools=[])


def test_generated_runtime_minimal_imports_and_invokes() -> None:
    payload = _runtime_payload('v30_runtime_min', nodes=[])
    runtime_ctx = _extract_and_load_graph(payload)
    try:
        result = runtime_ctx['graph'].invoke(runtime_ctx['bootstrap_state']({'messages': []}))
        assert result['messages'] == []
        assert result['documents'] == []
        assert result['custom_vars'] == {}
    finally:
        _cleanup_loaded_graph(runtime_ctx)


def test_generated_runtime_non_empty_debug_graph_imports_entrypoints_and_invokes() -> None:
    payload = _runtime_payload(
        'v30_runtime_debug',
        nodes=[
            {
                'id': 'dbg',
                'type': 'debug_print',
                'inputs': ['messages'],
                'outputs': ['messages'],
                'params': {'input_key': 'messages'},
            }
        ],
    )
    runtime_ctx = _extract_and_load_graph(payload)
    try:
        result = runtime_ctx['graph'].invoke(
            runtime_ctx['bootstrap_state']({'messages': [HumanMessage(content='hello runtime smoke')]})
        )
        assert 'messages' in result
        assert len(result['messages']) == 1
        assert getattr(result['messages'][0], 'content', '') == 'hello runtime smoke'
    finally:
        tmp_dir = Path(runtime_ctx['tmp_dir'])
        project_dir = tmp_dir / payload.graph_id
        graph_py = project_dir / 'graph.py'
        main_py = project_dir / 'main.py'
        assert graph_py.exists()
        assert main_py.exists()

        sys.path.insert(0, str(project_dir))
        try:
            graph_spec = importlib.util.spec_from_file_location('generated_graph_module_v30', graph_py)
            graph_mod = importlib.util.module_from_spec(graph_spec)
            assert graph_spec.loader is not None
            graph_spec.loader.exec_module(graph_mod)
            assert hasattr(graph_mod, 'graph')
            assert hasattr(graph_mod, 'run_graph')

            main_spec = importlib.util.spec_from_file_location('generated_main_module_v30', main_py)
            main_mod = importlib.util.module_from_spec(main_spec)
            assert main_spec.loader is not None
            main_spec.loader.exec_module(main_mod)
            assert hasattr(main_mod, 'main')
        finally:
            if str(project_dir) in sys.path:
                sys.path.remove(str(project_dir))

        _cleanup_loaded_graph(runtime_ctx)


def test_runner_websocket_completes_for_minimal_and_non_empty_graphs() -> None:
    client = TestClient(main.app)

    cases = [
        ('v30_ws_min', {'graph_id': 'v30_ws_min', 'nodes': [], 'edges': [], 'tools': []}),
        (
            'v30_ws_debug',
            {
                'graph_id': 'v30_ws_debug',
                'nodes': [
                    {
                        'id': 'dbg',
                        'type': 'debug_print',
                        'inputs': ['messages'],
                        'outputs': ['messages'],
                        'params': {'input_key': 'messages'},
                    }
                ],
                'edges': [],
                'tools': [],
            },
        ),
    ]

    for session_id, payload in cases:
        with client.websocket_connect(f'/api/ws/run/{session_id}') as ws:
            ws.send_text(json.dumps({'action': 'start', 'payload': payload, 'inputs': {'messages': []}}))
            terminal = None
            started = False
            for _ in range(12):
                msg = ws.receive_json()
                if msg.get('type') == 'started':
                    started = True
                if msg.get('type') in ('completed', 'error'):
                    terminal = msg
                    break
            assert started is True
            assert terminal is not None
            assert terminal.get('type') == 'completed'
