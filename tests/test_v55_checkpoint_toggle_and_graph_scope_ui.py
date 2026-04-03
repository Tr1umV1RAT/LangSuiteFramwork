from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_runtime_settings_expose_checkpoint_toggle() -> None:
    text = (ROOT / "client/src/store/types.ts").read_text()
    assert "checkpointEnabled: boolean;" in text
    ws = (ROOT / "client/src/store/workspace.ts").read_text()
    assert "checkpointEnabled: false" in ws


def test_store_export_uses_runtime_checkpoint_toggle() -> None:
    text = (ROOT / "client/src/store.ts").read_text()
    assert "runtimeSettings?.checkpointEnabled" in text


def test_quickstart_no_longer_surfaces_memory_checkpoint() -> None:
    blocks = (ROOT / "client/src/components/BlocksPanelContent.tsx").read_text()
    assert "memory_checkpoint" not in blocks.split("const COMMON_NODE_TYPES", 1)[0]
    app = (ROOT / "client/src/App.tsx").read_text()
    assert "Mémoire / checkpoint" not in app
    assert "Sortie chat" in app


def test_state_panel_exposes_checkpointing_as_graph_scope_setting() -> None:
    text = (ROOT / "client/src/components/StatePanelContent.tsx").read_text()
    assert "Checkpointing du graphe" in text
    assert "graphScopeMarkerIds" in text
    assert "snapshot d'état à chaque super-step" in text
