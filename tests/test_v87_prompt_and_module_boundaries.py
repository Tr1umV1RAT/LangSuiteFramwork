from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BLOCKS_PANEL = ROOT / 'client' / 'src' / 'components' / 'BlocksPanelContent.tsx'
STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'
CAPABILITY_INSPECTOR = ROOT / 'client' / 'src' / 'components' / 'CapabilityInspectorSection.tsx'


def test_blocks_panel_distinguishes_palette_library_and_prompt_boundaries() -> None:
    text = BLOCKS_PANEL.read_text(encoding='utf-8')
    assert text.count('data-testid="palette-library-boundary"') == 2
    assert text.count('data-testid="prompt-surface-boundary"') == 2
    assert "n'équivalent pas encore à une <strong>module library</strong> générale" in text
    assert 'Ils ne forment pas encore un <strong>prompt-strip panel</strong> dédié' in text


def test_state_panel_subagent_library_stays_bounded() -> None:
    text = STATE_PANEL.read_text(encoding='utf-8')
    assert 'data-testid="subagent-library-boundary"' in text
    assert 'Cette surface ne vaut pas encore <strong>module library</strong> générale' in text
    assert 'les prompts ici restent attachés à chaque sous-agent' in text


def test_capability_inspector_clarifies_prompt_template_scope() -> None:
    text = CAPABILITY_INSPECTOR.read_text(encoding='utf-8')
    assert 'data-testid="prompt-template-boundary"' in text
    assert 'Local prompt-composition surface.' in text
    assert 'does <strong>not</strong> imply a reusable global prompt-strip registry' in text
