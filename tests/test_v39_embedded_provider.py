from __future__ import annotations

import asyncio
import io
import json
import zipfile

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage, HumanMessage

from api.runner import _cleanup_loaded_graph, _extract_and_load_graph
from core.compiler import compile_graph
from core.schemas import GraphNode, GraphPayload, NodeParams, UIContext
import langchain.chat_models as lc_chat_models
import main


def _embedded_payload(target_subgraph: str) -> GraphPayload:
    return GraphPayload(
        graph_id='v39_embedded_provider',
        ui_context=UIContext(artifact_type='graph', execution_profile='langgraph_async', project_mode='langgraph'),
        nodes=[GraphNode(id='sub_agent_1', type='sub_agent', params=NodeParams(target_subgraph=target_subgraph, artifact_execution_kind='embedded_native'))],
        edges=[],
        tools=[],
        is_async=True,
    )


class _FakeProviderModel:
    def bind_tools(self, _tools):
        return self

    def with_retry(self, *args, **kwargs):
        return self

    def with_structured_output(self, *args, **kwargs):
        return self

    async def ainvoke(self, messages):
        content = messages[-1].content if messages else ''
        return AIMessage(content=f'embedded provider echo: {content}')

    def invoke(self, messages):
        content = messages[-1].content if messages else ''
        return AIMessage(content=f'embedded provider echo: {content}')


def _fake_init_chat_model(**_kwargs):
    return _FakeProviderModel()


def test_embedded_provider_artifact_exposes_metadata_and_compiles() -> None:
    payload = _embedded_payload('artifact:agent/embedded_provider_agent')
    zip_buffer = compile_graph(payload)
    with zipfile.ZipFile(io.BytesIO(zip_buffer.getvalue()), 'r') as zf:
        graph_py = zf.read('v39_embedded_provider/graph.py').decode('utf-8')
        nodes_py = zf.read('v39_embedded_provider/nodes.py').decode('utf-8')
    assert 'langchain_agent_embedded_v1' in graph_py
    assert 'embedded_native' in graph_py
    assert 'embedded_provider_agent' in graph_py
    assert 'OPENAI_API_KEY' in nodes_py


def test_embedded_provider_runtime_runs_with_stubbed_provider(monkeypatch) -> None:
    monkeypatch.setenv('OPENAI_API_KEY', 'test-key')
    monkeypatch.setattr(lc_chat_models, 'init_chat_model', _fake_init_chat_model)
    payload = _embedded_payload('artifact:agent/embedded_provider_agent')
    runtime_ctx = _extract_and_load_graph(payload)
    try:
        result = asyncio.run(runtime_ctx['graph'].ainvoke(
            runtime_ctx['bootstrap_state']({'messages': [HumanMessage(content='hello provider embedded')]})))
        assert 'messages' in result
        assert result['messages']
        assert getattr(result['messages'][-1], 'content', '') == 'embedded provider echo: hello provider embedded'
    finally:
        _cleanup_loaded_graph(runtime_ctx)


def test_embedded_provider_runtime_fails_clearly_without_api_key(monkeypatch) -> None:
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    payload = _embedded_payload('artifact:agent/embedded_provider_agent')
    runtime_ctx = _extract_and_load_graph(payload)
    try:
        with pytest.raises(RuntimeError) as exc:
            asyncio.run(runtime_ctx['graph'].ainvoke(
                runtime_ctx['bootstrap_state']({'messages': [HumanMessage(content='hello provider embedded')]})))
        assert 'provider_config_missing' in str(exc.value)
        assert 'OPENAI_API_KEY' in str(exc.value)
    finally:
        _cleanup_loaded_graph(runtime_ctx)


def test_runner_projects_embedded_trace_events_for_provider_artifact(monkeypatch) -> None:
    monkeypatch.setenv('OPENAI_API_KEY', 'test-key')
    monkeypatch.setattr(lc_chat_models, 'init_chat_model', _fake_init_chat_model)
    client = TestClient(main.app)
    payload = {
        'graph_id': 'v39_ws_embedded_provider',
        'ui_context': {'artifact_type': 'graph', 'execution_profile': 'langgraph_async', 'project_mode': 'langgraph'},
        'nodes': [
            {
                'id': 'sub_agent_1',
                'type': 'sub_agent',
                'params': {
                    'target_subgraph': 'artifact:agent/embedded_provider_agent',
                    'artifact_ref_kind': 'agent',
                    'artifact_ref_id': 'embedded_provider_agent',
                    'artifact_execution_kind': 'embedded_native',
                },
            }
        ],
        'edges': [],
        'tools': [],
        'is_async': True,
    }
    with client.websocket_connect('/api/ws/run/v39_ws_embedded_provider') as ws:
        ws.send_text(json.dumps({'action': 'start', 'payload': payload, 'inputs': {'messages': ['hello provider embedded']}}))
        terminal = None
        phases: list[str] = []
        started = None
        for _ in range(24):
            msg = ws.receive_json()
            if msg.get('type') == 'started':
                started = msg
            if msg.get('type') == 'embedded_trace':
                phases.append(msg.get('phase'))
            if msg.get('type') in ('completed', 'error'):
                terminal = msg
                break
        assert started is not None
        assert terminal is not None and terminal.get('type') == 'completed'
        assert 'started' in phases and 'running' in phases and 'completed' in phases


def test_runner_reports_provider_missing_with_embedded_trace_failure(monkeypatch) -> None:
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    client = TestClient(main.app)
    payload = {
        'graph_id': 'v39_ws_embedded_provider_fail',
        'ui_context': {'artifact_type': 'graph', 'execution_profile': 'langgraph_async', 'project_mode': 'langgraph'},
        'nodes': [
            {
                'id': 'sub_agent_1',
                'type': 'sub_agent',
                'params': {
                    'target_subgraph': 'artifact:agent/embedded_provider_agent',
                    'artifact_ref_kind': 'agent',
                    'artifact_ref_id': 'embedded_provider_agent',
                    'artifact_execution_kind': 'embedded_native',
                },
            }
        ],
        'edges': [],
        'tools': [],
        'is_async': True,
    }
    with client.websocket_connect('/api/ws/run/v39_ws_embedded_provider_fail') as ws:
        ws.send_text(json.dumps({'action': 'start', 'payload': payload, 'inputs': {'messages': ['hello provider embedded']}}))
        terminal = None
        failed = None
        for _ in range(24):
            msg = ws.receive_json()
            if msg.get('type') == 'embedded_trace' and msg.get('phase') == 'failed':
                failed = msg
            if msg.get('type') in ('completed', 'error'):
                terminal = msg
                break
        assert failed is not None
        assert failed.get('reasonCode') == 'provider_config_missing'
        assert terminal is not None and terminal.get('type') == 'error'
        assert 'provider_config_missing' in terminal.get('message', '')


def test_artifact_library_exposes_embedded_provider_metadata() -> None:
    client = TestClient(main.app)
    response = client.get('/api/artifacts', params={'include_advanced': 'true', 'project_mode': 'langgraph'})
    assert response.status_code == 200
    payload = response.json()
    entry = next(item for item in payload if item['kind'] == 'agent' and item['id'] == 'embedded_provider_agent')
    models = entry.get('bridgeModels') or []
    embedded = next((item for item in models if item.get('integrationModel') == 'embedded_native'), None)
    assert embedded is not None
    summary = embedded.get('bridgeConstraintSummary') or {}
    assert summary.get('acceptedProviderFamilies') == ['openai']
    assert 'OPENAI_API_KEY' in (summary.get('requiredProviderEnvVars') or [])
