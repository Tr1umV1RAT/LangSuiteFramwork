from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAP_MATRIX = ROOT / 'client' / 'src' / 'capabilityMatrix.json'
BLOCKS_PANEL = ROOT / 'client' / 'src' / 'components' / 'BlocksPanelContent.tsx'
SIDEBAR = ROOT / 'client' / 'src' / 'components' / 'Sidebar.tsx'
STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'
INSPECTOR = ROOT / 'client' / 'src' / 'components' / 'CapabilityInspectorSection.tsx'


def test_memory_helper_surfaces_keep_recommended_targets() -> None:
    matrix = json.loads(CAP_MATRIX.read_text(encoding='utf-8'))['nodeTypes']
    assert matrix['memory_access']['preferredSurface'] is True
    assert matrix['memoryreader']['legacyHelperSurface'] is True
    assert matrix['memoryreader']['preferredSurface'] == 'memory_access'
    assert matrix['memorywriter']['legacyHelperSurface'] is True
    assert matrix['memorywriter']['preferredSurface'] == 'store_put'


def test_palette_and_sidebar_hide_legacy_memory_helpers_by_default() -> None:
    blocks_panel_text = BLOCKS_PANEL.read_text(encoding='utf-8')
    sidebar_text = SIDEBAR.read_text(encoding='utf-8')
    assert 'showLegacyMemoryHelpers' in blocks_panel_text
    assert 'Helpers mémoire legacy masqués par défaut' in blocks_panel_text
    assert 'legacyHelperSurface' in blocks_panel_text
    assert 'showLegacyMemoryHelpers' in sidebar_text
    assert 'helpers mémoire legacy sont masqués par défaut' in sidebar_text.lower()


def test_state_panel_and_inspector_surface_legacy_vs_primary_memory_story() -> None:
    state_panel_text = STATE_PANEL.read_text(encoding='utf-8')
    inspector_text = INSPECTOR.read_text(encoding='utf-8')
    assert 'Surfaces principales' in state_panel_text
    assert 'Helpers / legacy' in state_panel_text
    assert 'Cette surface reste utilisable, mais elle fait partie des helpers historiques.' in state_panel_text
    assert 'legacy helper surface' in inspector_text.lower()
    assert 'recommended primary memory surface' in inspector_text.lower()
