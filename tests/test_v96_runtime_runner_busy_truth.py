from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUN_PANEL = ROOT / 'client' / 'src' / 'components' / 'RunPanel.tsx'


def test_run_panel_surfaces_runner_busy_as_process_level_session_limit() -> None:
    text = RUN_PANEL.read_text(encoding='utf-8')
    assert "label: 'Active run ownership'" in text
    assert "value: 'one active Run session / backend process'" in text
    assert 'Async branches inside one graph are still fine.' in text
    assert 'multiple separate Run sessions sharing the same backend process' in text
    assert 'another tab or project using this backend will get runner_busy until the active session finishes or stops.' in text


def test_run_panel_actionable_hint_explains_runner_busy_without_claiming_async_is_broken() -> None:
    text = RUN_PANEL.read_text(encoding='utf-8')
    assert "if (code === 'runner_busy')" in text
    assert 'Wait for the active runtime session to finish or stop it before starting another one.' in text
    assert 'Async branches inside one graph run are still valid here.' in text
    assert 'not about fan-out inside a single graph.' in text
