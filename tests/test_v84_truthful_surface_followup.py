from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.artifact_registry import get_artifact, list_artifacts

ARTIFACT_LIBRARY = ROOT / 'client' / 'src' / 'components' / 'artifacts' / 'ArtifactLibrarySection.tsx'
STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'
APP = ROOT / 'client' / 'src' / 'App.tsx'
RUN_PANEL = ROOT / 'client' / 'src' / 'components' / 'RunPanel.tsx'


def test_artifact_registry_surfaces_open_and_save_effect_truth() -> None:
    graph_items = [item for item in list_artifacts(kind='graph') if item['id'] == 'core_echo_starter']
    assert graph_items
    item = graph_items[0]
    assert 'openEffectSummary' in item
    assert 'saveEffectSummary' in item
    assert 'editable copy' in item['openEffectSummary']
    manifest = get_artifact('graph', 'core_echo_starter')
    assert manifest is not None
    assert manifest['surfaceTruth']['compileSafe'] is True
    assert 'openEffectSummary' in manifest


def test_artifact_library_and_state_panel_explain_open_and_publish_consequences() -> None:
    lib_text = ARTIFACT_LIBRARY.read_text(encoding='utf-8')
    state_text = STATE_PANEL.read_text(encoding='utf-8')
    assert 'data-testid="artifact-open-effect-summary"' in lib_text
    assert 'Open editable copy' in lib_text
    assert 'data-testid="artifact-publish-truth"' in state_text
    assert 'Publishing saves the authored artifact definition' in state_text


def test_empty_state_exposes_compile_safe_starters() -> None:
    text = APP.read_text(encoding='utf-8')
    assert 'data-testid="empty-state-starters"' in text
    assert 'Open compile-safe starter' in text
    assert 'Open static debug starter' in text


def test_run_panel_lists_likely_blockers_before_first_run() -> None:
    text = RUN_PANEL.read_text(encoding='utf-8')
    assert 'data-testid="runtime-likely-blockers"' in text
    assert 'Likely blockers before first successful run' in text
    assert 'Add an API Base URL on the affected provider-backed node before running.' in text
    assert 'The UI does not guess installed Python packages.' in text
