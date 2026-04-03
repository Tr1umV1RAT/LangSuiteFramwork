import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import ast
import io
import zipfile

from fastapi.testclient import TestClient

from core.compiler import compile_graph
from core.schemas import GraphPayload
from main import app


def _zip_text_map(buffer: io.BytesIO) -> dict[str, str]:
    with zipfile.ZipFile(buffer) as zf:
        return {name: zf.read(name).decode("utf-8") for name in zf.namelist()}


def _assert_python_files_parse(files: dict[str, str]) -> None:
    for name, content in files.items():
        if name.endswith('.py'):
            ast.parse(content, filename=name)


def test_minimal_compile_graph_payload_generates_valid_python_artifacts():
    payload = GraphPayload(graph_id='minimal_graph')

    assert [field.name for field in payload.state_schema][:3] == ['messages', 'documents', 'custom_vars']

    bundle = _zip_text_map(compile_graph(payload))
    _assert_python_files_parse(bundle)

    state_py = bundle['minimal_graph/state.py']
    graph_py = bundle['minimal_graph/graph.py']

    assert 'class AgentState(TypedDict):' in state_py
    assert 'messages: Annotated[list[AnyMessage], add_messages]' in state_py
    assert 'documents: Annotated[list[Any], operator.add]' in state_py
    assert 'custom_vars: Annotated[dict[str, Any], update_dict]' in state_py
    assert 'def build_graph_main():' in graph_py
    assert '__empty_passthrough__' in graph_py


def test_compile_endpoint_accepts_minimal_body_without_frontend_export_shaping():
    client = TestClient(app)
    response = client.post('/compile', json={'graph_id': 'api_minimal'})

    assert response.status_code == 200
    bundle = _zip_text_map(io.BytesIO(response.content))
    _assert_python_files_parse(bundle)
    assert 'def build_graph_main():' in bundle['api_minimal/graph.py']


def test_ui_context_shorthand_profiles_are_normalized_server_side():
    payload = GraphPayload(graph_id='profile_norm', ui_context={'execution_profile': 'async', 'artifact_type': 'graph'})
    assert payload.ui_context is not None
    assert payload.ui_context.execution_profile == 'langgraph_async'
    assert payload.ui_context.artifact_type == 'graph'


def test_artifact_library_defaults_to_visible_kinds_but_can_include_hidden_ones():
    client = TestClient(app)

    visible_response = client.get('/api/artifacts')
    assert visible_response.status_code == 200
    visible_kinds = {item['kind'] for item in visible_response.json()}
    assert visible_kinds <= {'graph', 'subgraph'}
    assert 'graph' in visible_kinds
    assert 'subgraph' in visible_kinds

    expanded_response = client.get('/api/artifacts?include_hidden=true')
    assert expanded_response.status_code == 200
    expanded_kinds = {item['kind'] for item in expanded_response.json()}
    assert {'graph', 'subgraph', 'agent', 'deep_agent'} <= expanded_kinds
