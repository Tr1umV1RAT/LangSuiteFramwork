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
NODE_CONFIG = ROOT / "client" / "src" / "nodeConfig.ts"
INSPECTOR = ROOT / "client" / "src" / "components" / "CapabilityInspectorSection.tsx"
STATE_PANEL = ROOT / "client" / "src" / "components" / "StatePanelContent.tsx"


def _read_zip_text(buf: io.BytesIO, filename: str, graph_id: str) -> str:
    with zipfile.ZipFile(io.BytesIO(buf.getvalue()), "r") as zf:
        return zf.read(f"{graph_id}/{filename}").decode("utf-8")


def test_memory_access_surface_exists_and_consolidates_legacy_family() -> None:
    matrix = json.loads(CAP_MATRIX.read_text(encoding="utf-8"))["nodeTypes"]
    assert matrix["memory_access"]["toolRuntimeMemoryReady"] is True
    assert matrix["memory_access"]["preferredSurface"] is True
    assert "memoryreader" in matrix["memory_access"]["consolidates"]
    assert matrix["memoryreader"]["preferredSurface"] == "memory_access"
    assert matrix["store_get"]["preferredSurface"] == "memory_access"
    node_config_text = NODE_CONFIG.read_text(encoding="utf-8")
    assert "memory_access:" in node_config_text
    assert "label: 'Memory Access'" in node_config_text


def test_memory_access_ui_surfaces_show_preferred_and_runtime_access() -> None:
    inspector_text = INSPECTOR.read_text(encoding="utf-8")
    state_panel_text = STATE_PANEL.read_text(encoding="utf-8")
    assert 'Preferred memory surface:' in inspector_text
    assert 'Canonical bounded runtime-store access surface' in inspector_text
    assert 'Surface conseillée:' in state_panel_text


def test_memory_access_compiles_profile_get_and_search_modes() -> None:
    payload = GraphPayload(
        graph_id='v48_memory_access_compile',
        ui_context={
            'artifact_type': 'graph',
            'execution_profile': 'langgraph_async',
            'project_mode': 'langgraph',
            'runtime_settings': {'storeBackend': 'sqlite_local', 'storePath': 'memories/runtime.sqlite'},
        },
        state_schema=[
            {'name': 'messages', 'type': 'list[Any]', 'reducer': 'add_messages'},
            {'name': 'memory_payload', 'type': 'dict[str, Any]', 'reducer': 'overwrite'},
        ],
        nodes=[
            {'id': 'memory_access_profile', 'type': 'memory_access', 'params': {'access_mode': 'profile_read', 'namespace_prefix': 'profiles', 'user_id_key': 'custom_vars.user_id', 'store_item_key': 'profile', 'output_key': 'memory_payload'}},
            {'id': 'memory_access_get', 'type': 'memory_access', 'params': {'access_mode': 'get', 'namespace_prefix': 'memory', 'store_item_key': 'profile', 'output_key': 'memory_payload'}},
            {'id': 'memory_access_search', 'type': 'memory_access', 'params': {'access_mode': 'search', 'namespace_prefix': 'memory', 'query_key': 'messages', 'output_key': 'memory_payload', 'limit': 3}},
        ],
        edges=[],
        tools=[],
        is_async=True,
    )
    buf = compile_graph(payload)
    nodes_py = _read_zip_text(buf, 'nodes.py', payload.graph_id)
    assert 'memory_access_profile_read' in nodes_py
    assert 'memory_access_get' in nodes_py
    assert 'memory_access_search' in nodes_py
    assert 'runtime_memory_access_surface' in nodes_py
