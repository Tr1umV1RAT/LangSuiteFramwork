from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAP_MATRIX = ROOT / 'client' / 'src' / 'capabilityMatrix.json'
NODE_CONFIG = ROOT / 'client' / 'src' / 'nodeConfig.ts'
BLOCKS_PANEL = ROOT / 'client' / 'src' / 'components' / 'BlocksPanelContent.tsx'
STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'
INSPECTOR = ROOT / 'client' / 'src' / 'components' / 'CapabilityInspectorSection.tsx'
RUN_PANEL = ROOT / 'client' / 'src' / 'components' / 'RunPanel.tsx'
HELPERS = ROOT / 'client' / 'src' / 'memorySurfaceLabels.ts'
SETTINGS = ROOT / 'client' / 'src' / 'components' / 'SettingsShell.tsx'


def test_memory_and_rag_labels_converge_on_runtime_store_vs_checkpoint_vs_vector_language() -> None:
    node_config_text = NODE_CONFIG.read_text(encoding='utf-8')
    helper_text = HELPERS.read_text(encoding='utf-8')
    assert "label: 'Store Read Helper'" in node_config_text
    assert "label: 'Store Write Helper'" in node_config_text
    assert "label: 'Checkpoint Marker'" in node_config_text
    assert "label: 'Local RAG Retrieval'" in node_config_text
    assert "memory_checkpoint: 'Checkpoint marker'" in helper_text
    assert "rag_retriever_local: 'Local RAG retrieval'" in helper_text
    assert "runtime_store_profile: 'Runtime store profile lookup'" in helper_text
    assert "local_vector_index_query: 'Vector-index query'" in helper_text


def test_memory_ui_copy_explicitly_separates_store_checkpoint_and_vector_layers() -> None:
    blocks_panel_text = BLOCKS_PANEL.read_text(encoding='utf-8')
    state_panel_text = STATE_PANEL.read_text(encoding='utf-8')
    inspector_text = INSPECTOR.read_text(encoding='utf-8')
    settings_text = SETTINGS.read_text(encoding='utf-8')
    assert 'runtime store' in blocks_panel_text
    assert 'local RAG/vector retrieval' in blocks_panel_text
    assert 'Checkpointing' in state_panel_text
    assert 'runtime store' in state_panel_text
    assert 'index vectoriel avec embeddings' in state_panel_text
    assert 'configured embedding model' in inspector_text
    assert 'not a store read/write node and it is not vector retrieval' in inspector_text
    assert 'execution-memory lanes earlier' in settings_text


def test_memory_runtime_and_rag_summaries_stay_truthful_in_matrix_and_runtime_panel() -> None:
    matrix = json.loads(CAP_MATRIX.read_text(encoding='utf-8'))['nodeTypes']
    run_panel_text = RUN_PANEL.read_text(encoding='utf-8')
    assert 'separate embedding model' in matrix['rag_retriever_local']['summary']
    assert 'distinct from runtime-store memory and local vector retrieval' in matrix['memory_checkpoint']['summary']
    assert 'bounded runtime-store key read' in matrix['memoryreader']['summary']
    assert 'Canonical bounded runtime-store access surface' in matrix['memory_access']['summary']
    assert 'getMemorySystemKindLabel(entry.memorySystem)' in run_panel_text
    assert 'getMemoryAccessModelLabel(entry.memoryAccessModel)' in run_panel_text
    assert 'getStoreBackendLabel(entry.storeBackend)' in run_panel_text
