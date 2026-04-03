from pathlib import Path


def test_graph_scope_marker_metadata_present() -> None:
    text = Path("client/src/capabilityMatrix.json").read_text()
    assert '"memory_checkpoint"' in text
    assert '"graphScopeMarker": true' in text
    assert '"detachedAllowed": true' in text


def test_graph_validation_tracks_graph_scope_markers_without_counting_detached() -> None:
    text = Path("client/src/graphUtils.ts").read_text()
    assert 'graphScopeMarkerIds' in text
    assert 'Graph-scope markers detected' in text
    assert 'detachedComponentCount: detachedInteractiveComponents.length' in text


def test_memory_checkpoint_edges_rejected_server_side() -> None:
    text = Path("core/schemas.py").read_text()
    assert 'graph_scope_marker_cannot_connect' in text
    assert "memory_checkpoint is a graph-scope marker" in text


def test_compiler_still_enables_checkpoint_from_marker_presence() -> None:
    text = Path("core/compiler.py").read_text()
    assert 'any(n.type == "memory_checkpoint" for n in payload.nodes)' in text
