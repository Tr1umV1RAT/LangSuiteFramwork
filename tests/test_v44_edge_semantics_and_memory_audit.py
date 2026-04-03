from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

CAP_MATRIX = ROOT / 'client' / 'src' / 'capabilityMatrix.json'
CUSTOM_NODE = ROOT / 'client' / 'src' / 'components' / 'CustomNode.tsx'
INSPECTOR = ROOT / 'client' / 'src' / 'components' / 'CapabilityInspectorSection.tsx'
INDEX_CSS = ROOT / 'client' / 'src' / 'index.css'


def test_v44_capability_matrix_exposes_edge_semantics_for_key_abstractions() -> None:
    matrix = json.loads(CAP_MATRIX.read_text(encoding='utf-8'))['nodeTypes']

    assert matrix['llm_chat']['graphAbstractionKind'] == 'semantic_tool_loop'
    assert 'ToolNode loop' in matrix['llm_chat']['compiledGraphRelation']
    assert matrix['send_fanout']['graphAbstractionKind'] == 'one_to_many_runtime_dispatch'
    assert matrix['reduce_join']['graphAbstractionKind'] == 'many_to_one_runtime_reduction'
    assert matrix['sub_agent']['graphAbstractionKind'] == 'langchain_agent_artifact_reference'
    assert matrix['memoryreader']['graphAbstractionKind'] == 'memory_reader_abstraction'
    assert matrix['store_search']['graphAbstractionKind'] == 'bounded_store_query'


def test_v44_ui_surfaces_render_semantic_metadata() -> None:
    custom_text = CUSTOM_NODE.read_text(encoding='utf-8')
    inspector_text = INSPECTOR.read_text(encoding='utf-8')
    css_text = INDEX_CSS.read_text(encoding='utf-8')

    assert 'node-chip-semantic' in custom_text
    assert 'Graph abstraction:' in custom_text
    assert 'Graph abstraction kind:' in inspector_text
    assert 'Link multiplicity:' in inspector_text
    assert 'Compiled graph relation:' in inspector_text
    assert 'Debug / state projection:' in inspector_text
    assert '.node-chip-semantic' in css_text
