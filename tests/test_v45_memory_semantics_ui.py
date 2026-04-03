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

CAP_MATRIX = ROOT / 'client' / 'src' / 'capabilityMatrix.json'
STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'
INSPECTOR = ROOT / 'client' / 'src' / 'components' / 'CapabilityInspectorSection.tsx'


def _read_zip_text(buf: io.BytesIO, filename: str, graph_id: str) -> str:
    with zipfile.ZipFile(io.BytesIO(buf.getvalue()), 'r') as zf:
        return zf.read(f"{graph_id}/{filename}").decode('utf-8')


def test_memory_nodes_have_explicit_semantics_metadata() -> None:
    matrix = json.loads(CAP_MATRIX.read_text(encoding='utf-8'))['nodeTypes']

    assert matrix['memoryreader']['memorySystemKind'] == 'runtime_store_read_helper'
    assert matrix['memorywriter']['memoryDurability'] == 'store_runtime_user_selectable_backend'
    assert matrix['store_search']['memoryVisibility'] == 'normalized_search_results'
    assert matrix['llm_chat']['memoryConsumer'] is True
    assert matrix['react_agent']['memoryConsumer'] is True


def test_memory_meta_is_emitted_by_compiled_memory_nodes() -> None:
    payload = GraphPayload(
        graph_id='v45_memory_compile',
        ui_context={'artifact_type': 'graph', 'execution_profile': 'langgraph_async', 'project_mode': 'langgraph'},
        state_schema=[
            {'name': 'messages', 'type': 'list[Any]', 'reducer': 'add_messages'},
            {'name': 'fanout_results', 'type': 'list[Any]', 'reducer': 'operator.add'},
        ],
        nodes=[
            {'id': 'memoryreader_1', 'type': 'memoryreader', 'params': {'memory_key': 'profile', 'output_key': 'memory_data'}},
            {'id': 'store_search_1', 'type': 'store_search', 'params': {'namespace_prefix': 'profiles', 'query_key': 'messages', 'output_key': 'store_results', 'limit': 3}},
            {'id': 'context_trimmer_1', 'type': 'context_trimmer', 'params': {'max_messages': 8}},
        ],
        edges=[
            {'source': 'memoryreader_1', 'target': 'store_search_1', 'type': 'direct'},
            {'source': 'store_search_1', 'target': 'context_trimmer_1', 'type': 'direct'},
        ],
        tools=[],
        is_async=True,
    )
    buf = compile_graph(payload)
    nodes_py = _read_zip_text(buf, 'nodes.py', payload.graph_id)

    assert 'def _memory_meta_update(' in nodes_py
    assert '"__memory_meta__": memory_meta' in nodes_py
    assert 'memory_system="runtime_store_read_helper"' in nodes_py
    assert 'memory_system="runtime_store_search"' in nodes_py
    assert 'memory_system="context_window_trim"' in nodes_py


def test_state_panel_and_inspector_surface_memory_subsections() -> None:
    state_panel_text = STATE_PANEL.read_text(encoding='utf-8')
    inspector_text = INSPECTOR.read_text(encoding='utf-8')

    assert 'Mémoires actives' in state_panel_text
    assert 'Dernière mise à jour' in state_panel_text
    assert 'Dernière entrée' in state_panel_text
    assert 'Memory system' in inspector_text
    assert 'Durability' in inspector_text
