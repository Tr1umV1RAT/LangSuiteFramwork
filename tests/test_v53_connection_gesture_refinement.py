from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GRAPH_UTILS = ROOT / 'client' / 'src' / 'graphUtils.ts'
APP = ROOT / 'client' / 'src' / 'App.tsx'
STORE = ROOT / 'client' / 'src' / 'store.ts'
HYDRATION = ROOT / 'client' / 'src' / 'store' / 'artifactHydration.ts'
CSS = ROOT / 'client' / 'src' / 'index.css'


def test_graph_utils_exports_connection_validation_and_semantic_edge_decoration() -> None:
    text = GRAPH_UTILS.read_text(encoding='utf-8')
    assert 'validateConnectionAffordance' in text
    assert 'decorateConnectionEdge' in text
    assert 'duplicate_edge_not_supported' in text
    assert 'self_loop_not_supported' in text
    assert 'fanout_requires_worker_step_before_reduce' in text
    assert "sourceType === 'send_fanout' && targetType === 'reduce_join'" in text
    assert 'getEdgeSemanticKind(edge, nodes)' in text


def test_app_and_store_use_connection_affordance_and_semantic_edge_decoration() -> None:
    app_text = APP.read_text(encoding='utf-8')
    store_text = STORE.read_text(encoding='utf-8')
    hydration_text = HYDRATION.read_text(encoding='utf-8')
    assert 'validateConnectionAffordance(connection, currentNodes, currentEdges)' in app_text
    assert 'decorateConnectionEdge(connection, currentNodes)' in store_text
    assert 'validateConnectionAffordance(connection, currentNodes, currentEdges)' in store_text
    assert 'decorateConnectionEdge(connection, nextNodes)' in hydration_text


def test_semantic_edge_classes_exist_for_visual_affordance() -> None:
    css_text = CSS.read_text(encoding='utf-8')
    assert '.edge-semantic-tool_attachment .react-flow__edge-path' in css_text
    assert '.edge-semantic-memory_feed .react-flow__edge-path' in css_text
    assert '.edge-semantic-fanout_dispatch .react-flow__edge-path' in css_text
    assert '.edge-semantic-worker_reduce .react-flow__edge-path' in css_text
