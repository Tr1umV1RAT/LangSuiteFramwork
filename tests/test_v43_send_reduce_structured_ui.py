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
RUNNER = ROOT / "api" / "runner.py"


def _read_zip_text(buf: io.BytesIO, filename: str, graph_id: str) -> str:
    with zipfile.ZipFile(io.BytesIO(buf.getvalue()), 'r') as zf:
        return zf.read(f"{graph_id}/{filename}").decode('utf-8')


def test_v43_reduce_join_and_ui_semantics_are_present() -> None:
    matrix = json.loads(CAP_MATRIX.read_text(encoding='utf-8'))['nodeTypes']
    node_config_text = NODE_CONFIG.read_text(encoding='utf-8')

    assert 'reduce_join: {' in node_config_text
    assert 'structured_output_key' in node_config_text
    assert matrix['reduce_join']['quickProps'] == ['reduce', 'join', 'fanout']
    assert matrix['send_fanout']['interactionModel'] == 'dispatch_fanout'
    assert matrix['llm_chat']['structuredOutputCapable'] is True
    assert 'Graphical abstraction notes' in (ROOT / 'client' / 'src' / 'components' / 'CapabilityInspectorSection.tsx').read_text(encoding='utf-8')


def test_reduce_join_and_structured_output_key_compile() -> None:
    payload = GraphPayload(
        graph_id='v43_reduce_compile',
        ui_context={'artifact_type': 'graph', 'execution_profile': 'langgraph_async', 'project_mode': 'langgraph'},
        state_schema=[
            {'name': 'documents', 'type': 'list[Any]', 'reducer': 'operator.add'},
            {'name': 'fanout_results', 'type': 'list[Any]', 'reducer': 'operator.add'},
        ],
        nodes=[
            {'id': 'llm_1', 'type': 'llm_chat', 'params': {'provider': 'ollama', 'model_name': 'llama3', 'structured_schema': [{'name': 'score', 'type': 'int', 'description': 'score'}], 'structured_output_key': 'analysis_struct'}},
            {'id': 'send_1', 'type': 'send_fanout', 'params': {'items_key': 'documents', 'item_state_key': 'current_item', 'copy_messages': 'false'}},
            {'id': 'worker_1', 'type': 'debug_print', 'params': {'input_key': 'current_item'}},
            {'id': 'reduce_1', 'type': 'reduce_join', 'params': {'results_key': 'fanout_results', 'output_key': 'joined_text', 'join_mode': 'text_join', 'separator': ' | ', 'progress_key': 'fanout_progress'}},
        ],
        edges=[
            {'source': 'llm_1', 'target': 'send_1', 'type': 'direct'},
            {'source': 'send_1', 'target': 'worker_1', 'type': 'direct'},
            {'source': 'worker_1', 'target': 'reduce_1', 'type': 'direct'},
        ],
        tools=[],
        is_async=True,
    )
    buf = compile_graph(payload)
    nodes_py = _read_zip_text(buf, 'nodes.py', payload.graph_id)
    assert 'structured_output_key = "analysis_struct"' in nodes_py
    assert 'def reduce_1_node(state: AgentState) -> dict[str, Any]:' in nodes_py
    assert 'join_mode = "text_join"' in nodes_py
    assert 'result["fanout_progress"] = {' in nodes_py


def test_runner_projects_fanout_meta_on_node_updates() -> None:
    runner_text = RUNNER.read_text(encoding='utf-8')
    assert 'fanout_meta' in runner_text
    assert 'state_values.get("__fanout_meta__")' in runner_text
