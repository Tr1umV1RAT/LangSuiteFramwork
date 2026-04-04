from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'client' / 'src' / 'App.tsx'
ARTIFACT_LIBRARY = ROOT / 'client' / 'src' / 'components' / 'artifacts' / 'ArtifactLibrarySection.tsx'


def test_empty_state_points_bridge_ready_agents_back_to_graph_first_path() -> None:
    text = APP.read_text(encoding='utf-8')
    assert 'data-testid="empty-state-bridge-agent-note"' in text
    assert 'bounded LangChain agent inside a LangGraph workflow' in text
    assert 'bridge-ready agent inserts' in text


def test_artifact_library_exposes_a_curated_bridge_ready_agent_shelf_in_default_langgraph_mode() -> None:
    text = ARTIFACT_LIBRARY.read_text(encoding='utf-8')
    assert 'data-testid="artifact-library-bridge-ready-agents"' in text
    assert 'Bridge-ready agent inserts' in text
    assert 'already have compile-capable bridge contracts into the LangGraph trunk' in text
    assert "item.kind !== 'agent' || !item.built_in || item.projectMode !== 'langchain'" in text
    assert "bridge.integrationModel === 'embedded_native'" in text
    assert "bridge.integrationModel === 'lowered_bridge'" in text


def test_artifact_library_reuses_shared_bridge_model_helper_for_curated_and_grouped_views() -> None:
    text = ARTIFACT_LIBRARY.read_text(encoding='utf-8')
    assert 'function getBridgeModels(item: ArtifactManifestSummary)' in text
    assert 'const bridgeModels = getBridgeModels(item);' in text
    assert 'const bridges = getBridgeModels(item);' in text
