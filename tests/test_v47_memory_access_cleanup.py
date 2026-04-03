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
DEBUG_PANEL = ROOT / 'client' / 'src' / 'components' / 'DebugPanelContent.tsx'
RUN_PANEL = ROOT / 'client' / 'src' / 'components' / 'RunPanel.tsx'
NODE_CONFIG = ROOT / 'client' / 'src' / 'nodeConfig.ts'
STORE_TS = ROOT / 'client' / 'src' / 'store.ts'
TYPES_TS = ROOT / 'client' / 'src' / 'store' / 'types.ts'


def _read_zip_text(buf: io.BytesIO, filename: str, graph_id: str) -> str:
    with zipfile.ZipFile(io.BytesIO(buf.getvalue()), 'r') as zf:
        return zf.read(f"{graph_id}/{filename}").decode('utf-8')


def test_memory_capability_matrix_rationalizes_roles_and_access_models() -> None:
    matrix = json.loads(CAP_MATRIX.read_text(encoding='utf-8'))['nodeTypes']
    assert matrix['memory_store_read']['memoryRole'] == 'profile_store_reader'
    assert matrix['memory_store_read']['memoryAccessModel'] == 'runtime_store_lookup_by_user_namespace'
    assert matrix['memoryreader']['memoryRole'] == 'store_read_helper'
    assert matrix['memoryreader']['memoryAccessModel'] == 'runtime_store_helper_key_read'
    assert matrix['memorywriter']['memoryRole'] == 'store_write_helper'
    assert matrix['memorywriter']['memoryAccessModel'] == 'runtime_store_helper_key_write'
    assert matrix['sub_agent']['memoryAccessModel'] == 'graph_memory_input_payload_forwarded_to_langchain_agent_artifact'
    assert matrix['rag_retriever_local']['memoryAccessModel'] == 'local_vector_index_query'


def test_memory_ui_surfaces_show_role_and_access_model() -> None:
    state_panel_text = STATE_PANEL.read_text(encoding='utf-8')
    inspector_text = INSPECTOR.read_text(encoding='utf-8')
    debug_panel_text = DEBUG_PANEL.read_text(encoding='utf-8')
    run_panel_text = RUN_PANEL.read_text(encoding='utf-8')
    node_config_text = NODE_CONFIG.read_text(encoding='utf-8')
    types_text = TYPES_TS.read_text(encoding='utf-8')
    store_text = STORE_TS.read_text(encoding='utf-8')

    assert 'Accès:' in state_panel_text
    assert 'Rôle:' in state_panel_text
    assert 'Memory role:' in inspector_text
    assert 'Memory access model:' in inspector_text
    assert 'access_model' in debug_panel_text
    assert 'memoryAccessModel' in run_panel_text
    assert "label: 'Memory Read Helper'" in node_config_text
    assert "label: 'Memory Write Helper'" in node_config_text
    assert 'memoryAccessModel?: string | null;' in types_text
    assert 'entry.memoryAccessModel =' in store_text


def test_llm_and_subgraph_memory_consumption_compile_with_meta_projection() -> None:
    payload = GraphPayload(
        graph_id='v47_memory_consumer_compile',
        ui_context={
            'artifact_type': 'graph',
            'execution_profile': 'langgraph_async',
            'project_mode': 'langgraph',
            'runtime_settings': {'storeBackend': 'sqlite_local', 'storePath': 'memories/runtime.sqlite'},
        },
        state_schema=[
            {'name': 'messages', 'type': 'list[Any]', 'reducer': 'add_messages'},
            {'name': 'memory_data', 'type': 'dict[str, Any]', 'reducer': 'overwrite'},
            {'name': 'documents', 'type': 'list[Any]', 'reducer': 'overwrite'},
        ],
        nodes=[
            {'id': 'user_input_1', 'type': 'user_input_node', 'params': {'prompt_text': 'hi'}},
            {'id': 'memoryreader_1', 'type': 'memoryreader', 'params': {'memory_key': 'profile', 'output_key': 'memory_data'}},
            {'id': 'llm_chat_1', 'type': 'llm_chat', 'inputs': ['messages', 'documents', 'memory'], 'outputs': ['messages'], 'params': {'provider': 'openai', 'model_name': 'gpt-4o-mini', 'system_prompt': 'x'}},
            {'id': 'sub_agent_1', 'type': 'sub_agent', 'inputs': ['messages', 'documents', 'memory'], 'outputs': ['messages'], 'params': {'target_subgraph': 'main'}},
        ],
        edges=[
            {'source': 'user_input_1', 'target': 'llm_chat_1', 'type': 'direct'},
            {'source': 'memoryreader_1', 'target': 'llm_chat_1', 'type': 'direct', 'targetHandle': 'memory_in'},
            {'source': 'user_input_1', 'target': 'sub_agent_1', 'type': 'direct'},
            {'source': 'memoryreader_1', 'target': 'sub_agent_1', 'type': 'direct', 'targetHandle': 'memory_in'},
        ],
        tools=[],
        is_async=True,
    )
    buf = compile_graph(payload)
    nodes_py = _read_zip_text(buf, 'nodes.py', payload.graph_id)
    assert 'operation="memory_consume"' in nodes_py
    assert 'access_model="graph_memory_input_payload"' in nodes_py
    assert 'initial_state[memory_key] = memory_data' in nodes_py
    assert 'operation="memory_forward"' in nodes_py
    assert 'access_model="graph_memory_input_payload_forwarded_to_subgraph"' in nodes_py
