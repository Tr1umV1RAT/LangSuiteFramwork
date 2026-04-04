from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HELPERS = ROOT / 'client' / 'src' / 'memorySurfaceLabels.ts'
BLOCKS_PANEL = ROOT / 'client' / 'src' / 'components' / 'BlocksPanelContent.tsx'
STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'
INSPECTOR = ROOT / 'client' / 'src' / 'components' / 'CapabilityInspectorSection.tsx'
SETTINGS = ROOT / 'client' / 'src' / 'components' / 'SettingsShell.tsx'


def test_memory_helper_defines_lane_model_and_first_success_priority() -> None:
    helper_text = HELPERS.read_text(encoding='utf-8')
    assert "export type MemorySurfaceLaneId" in helper_text
    assert "checkpoint_thread_state: 'Checkpointing / thread state'" in helper_text
    assert "runtime_store_canonical: 'Runtime store — canonical'" in helper_text
    assert "vector_retrieval: 'Local RAG / embeddings'" in helper_text
    assert "memory_checkpoint: 0" in helper_text
    assert "memory_access: 1" in helper_text
    assert "store_put: 2" in helper_text
    assert "rag_retriever_local: 3" in helper_text
    assert 'export function isCanonicalFirstSuccessMemorySurface(' in helper_text


def test_first_success_memory_copy_orders_canonical_lanes_before_legacy_helpers() -> None:
    blocks_text = BLOCKS_PANEL.read_text(encoding='utf-8')
    state_text = STATE_PANEL.read_text(encoding='utf-8')
    inspector_text = INSPECTOR.read_text(encoding='utf-8')
    settings_text = SETTINGS.read_text(encoding='utf-8')
    assert 'Memory first-success path' in blocks_text
    assert 'Checkpoint Marker' in blocks_text
    assert 'Memory Access' in blocks_text
    assert 'Store Put' in blocks_text
    assert 'Local RAG Retrieval' in blocks_text
    assert 'execution-memory lanes earlier' in settings_text
    assert 'Checkpointing / thread state' in state_text
    assert 'Runtime store — canonical' in state_text
    assert 'Local RAG / embeddings' in state_text
    assert 'Memory lane:' in inspector_text
    assert 'Memory lane story:' in inspector_text
