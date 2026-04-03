from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GRAPH_UTILS = ROOT / 'client' / 'src' / 'graphUtils.ts'
STORE_TYPES = ROOT / 'client' / 'src' / 'store' / 'types.ts'
TOOLBAR = ROOT / 'client' / 'src' / 'components' / 'Toolbar.tsx'
CUSTOM_NODE = ROOT / 'client' / 'src' / 'components' / 'CustomNode.tsx'


def test_graph_validation_tracks_detached_components_and_semantic_edge_summary() -> None:
    text = GRAPH_UTILS.read_text(encoding='utf-8')
    assert 'detachedComponentCount' in text
    assert 'semanticEdgeSummary' in text
    assert "tool_attachment" in text
    assert "fanout_dispatch" in text
    assert 'Composant détaché' in text


def test_store_types_expose_detached_and_semantic_edge_fields() -> None:
    text = STORE_TYPES.read_text(encoding='utf-8')
    assert 'detachedNodeIds: Set<string>;' in text
    assert 'detachedComponentCount: number;' in text
    assert 'semanticEdgeSummary: Record<string, number>;' in text


def test_toolbar_and_custom_node_surface_detached_component_and_handle_affordances() -> None:
    toolbar = TOOLBAR.read_text(encoding='utf-8')
    custom = CUSTOM_NODE.read_text(encoding='utf-8')
    assert 'detached' in toolbar
    assert 'semantic link kinds' in toolbar
    assert 'Handle affordances' in custom
    assert 'Detached component' in custom
    assert 'Tools handle: many tools may attach here' in custom
