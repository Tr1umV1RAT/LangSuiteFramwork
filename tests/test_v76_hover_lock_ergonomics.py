from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'client' / 'src' / 'App.tsx'
RUN_PANEL = ROOT / 'client' / 'src' / 'components' / 'RunPanel.tsx'


def test_app_supports_escape_to_clear_locked_hover_and_richer_hover_legend() -> None:
    app = APP.read_text(encoding='utf-8')

    assert "event.key !== 'Escape'" in app
    assert 'window.addEventListener(\'keydown\', onKeyDown)' in app
    assert 'updateRuntimeNavigationSettings({ lockHover: false });' in app
    assert 'runtime-hover-predecessor-ids' in app
    assert 'runtime-hover-successor-ids' in app
    assert 'Predecessor node ids' in app
    assert 'Successor node ids' in app
    assert 'runtime-hover-lock-hint' in app
    assert 'Double-click any runtime chip to lock the inspected node without keeping the pointer pressed.' in app


def test_run_panel_supports_click_to_lock_runtime_chips() -> None:
    run_panel = RUN_PANEL.read_text(encoding='utf-8')

    assert 'const lockRuntimeNode = (nodeId: string, source: \'timeline\' | \'run_log\' = \'timeline\') => {' in run_panel
    assert 'updateRuntimeNavigationSettings({ lockHover: true });' in run_panel
    assert 'onDoubleClick={() => onLockNode(step.nodeId)}' in run_panel
    assert 'onDoubleClick={() => onLockNode(nodeId)}' in run_panel
    assert 'onDoubleClick={() => { if (entry.node) onLockNode(entry.node); }}' in run_panel
    assert 'onDoubleClick={() => onLockNode(entry.node!)}' in run_panel
    assert "onLockNode={(nodeId) => lockRuntimeNode(nodeId, 'timeline')}" in run_panel
    assert "onLockNode={(nodeId) => lockRuntimeNode(nodeId, 'run_log')}" in run_panel
