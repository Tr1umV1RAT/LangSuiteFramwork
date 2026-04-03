from __future__ import annotations

import io
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.compiler import compile_graph
from core.schemas import GraphPayload

CAP_MATRIX = ROOT / "client" / "src" / "capabilityMatrix.json"
STATE_PANEL = ROOT / "client" / "src" / "components" / "StatePanelContent.tsx"
INSPECTOR = ROOT / "client" / "src" / "components" / "CapabilityInspectorSection.tsx"


def _read_zip_text(buf: io.BytesIO, filename: str, graph_id: str) -> str:
    with zipfile.ZipFile(io.BytesIO(buf.getvalue()), 'r') as zf:
        return zf.read(f"{graph_id}/{filename}").decode('utf-8')


WORKSPACE_TS = ROOT / 'client' / 'src' / 'store' / 'workspace.ts'


def test_runtime_settings_allow_store_backend_choice() -> None:
    workspace_text = WORKSPACE_TS.read_text(encoding='utf-8')
    assert "storeBackend: 'in_memory'" in workspace_text
    assert "storePath: 'runtime_store.db'" in workspace_text
    assert "settings?.storeBackend === 'sqlite_local' ? 'sqlite_local' : defaults.storeBackend" in workspace_text


def test_sqlite_local_store_backend_is_compiled_when_selected() -> None:
    payload = GraphPayload(
        graph_id='v46_store_backend_compile',
        ui_context={
            'artifact_type': 'graph',
            'execution_profile': 'langgraph_async',
            'project_mode': 'langgraph',
            'runtime_settings': {'storeBackend': 'sqlite_local', 'storePath': 'memories/runtime.sqlite'},
        },
        state_schema=[{'name': 'messages', 'type': 'list[Any]', 'reducer': 'add_messages'}],
        nodes=[
            {'id': 'memoryreader_1', 'type': 'memoryreader', 'params': {'memory_key': 'profile', 'output_key': 'memory_data'}},
            {'id': 'store_put_1', 'type': 'store_put', 'params': {'namespace_prefix': 'profiles', 'store_item_key': 'summary', 'state_key_to_save': 'messages', 'output_key': 'store_receipt'}},
        ],
        edges=[{'source': 'memoryreader_1', 'target': 'store_put_1', 'type': 'direct'}],
        tools=[],
        is_async=True,
    )
    buf = compile_graph(payload)
    graph_py = _read_zip_text(buf, 'graph.py', payload.graph_id)
    nodes_py = _read_zip_text(buf, 'nodes.py', payload.graph_id)
    assert 'class SQLiteRuntimeStore:' in graph_py
    assert 'store = SQLiteRuntimeStore("memories/runtime.sqlite")' in graph_py
    assert 'GRAPH_STORE_BACKEND = "sqlite_local"' in nodes_py
    assert 'GRAPH_STORE_DURABILITY = "store_runtime_sqlite_local_user_configurable"' in nodes_py


def test_memory_ui_surfaces_store_backend_choice_and_memory_access_notes() -> None:
    matrix = json.loads(CAP_MATRIX.read_text(encoding='utf-8'))['nodeTypes']
    assert matrix['memoryreader']['memoryBackendSelectable'] is True
    assert matrix['store_put']['memoryBackendOptions'] == ['in_memory', 'sqlite_local']
    assert matrix['llm_chat']['toolRuntimeMemoryAccessMode'] == 'memory_input_handle_only_in_current_build'

    state_panel_text = STATE_PANEL.read_text(encoding='utf-8')
    inspector_text = INSPECTOR.read_text(encoding='utf-8')
    assert 'Store backend' in state_panel_text
    assert 'Store path' in state_panel_text
    assert 'Store backend:' in state_panel_text or 'Store backend' in state_panel_text
    assert 'Store backend' in inspector_text
