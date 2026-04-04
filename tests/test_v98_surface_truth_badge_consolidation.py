from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BADGES = ROOT / 'client' / 'src' / 'components' / 'SurfaceTruthBadges.tsx'
TOOLBAR = ROOT / 'client' / 'src' / 'components' / 'Toolbar.tsx'
STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'


def test_shared_surface_truth_badges_component_carries_core_truth_labels() -> None:
    text = BADGES.read_text(encoding='utf-8')
    assert 'compile-safe' in text
    assert 'not compile-safe' in text
    assert 'editor-first' in text
    assert 'runtime-enabled' in text
    assert 'mode:' in text
    assert 'artifact:' in text


def test_toolbar_and_state_panel_use_shared_surface_truth_badges_component() -> None:
    toolbar_text = TOOLBAR.read_text(encoding='utf-8')
    state_text = STATE_PANEL.read_text(encoding='utf-8')
    assert "import SurfaceTruthBadges from './SurfaceTruthBadges';" in toolbar_text
    assert '<SurfaceTruthBadges surfaceTruth={currentSurfaceTruth}' in toolbar_text
    assert "import SurfaceTruthBadges from './SurfaceTruthBadges';" in state_text
    assert '<SurfaceTruthBadges surfaceTruth={activeSurfaceTruth}' in state_text


def test_inline_surface_truth_badge_markup_no_longer_drifts_in_toolbar_or_state_panel() -> None:
    toolbar_text = TOOLBAR.read_text(encoding='utf-8')
    state_text = STATE_PANEL.read_text(encoding='utf-8')
    assert 'mode: {currentSurfaceTruth.projectMode}' not in toolbar_text
    assert 'mode: {activeSurfaceTruth.projectMode}' not in state_text
    assert 'currentSurfaceTruth.compileSafe ? \'compile-safe\'' not in toolbar_text
    assert 'activeSurfaceTruth.compileSafe ? \'compile-safe\'' not in state_text
