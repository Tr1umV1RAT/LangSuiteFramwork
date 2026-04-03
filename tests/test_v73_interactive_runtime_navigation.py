from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'client' / 'src' / 'App.tsx'
STORE = ROOT / 'client' / 'src' / 'store.ts'
STORE_TYPES = ROOT / 'client' / 'src' / 'store' / 'types.ts'
RUN_PANEL = ROOT / 'client' / 'src' / 'components' / 'RunPanel.tsx'
DEBUG_PANEL = ROOT / 'client' / 'src' / 'components' / 'DebugPanelContent.tsx'
STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'


def test_store_exposes_runtime_focus_requests_and_edge_legend_settings() -> None:
    store = STORE.read_text(encoding='utf-8')
    types = STORE_TYPES.read_text(encoding='utf-8')

    assert 'export interface RuntimeFocusRequest' in types
    assert 'export interface RuntimeEdgeLegendSettings' in types
    assert 'runtimeFocusRequest: RuntimeFocusRequest | null;' in store
    assert 'runtimeEdgeLegend: RuntimeEdgeLegendSettings;' in store
    assert 'requestRuntimeFocus:' in store
    assert 'clearRuntimeFocusRequest:' in store
    assert 'updateRuntimeEdgeLegend:' in store


def test_app_turns_runtime_focus_requests_into_real_graph_selection_and_centering() -> None:
    app = APP.read_text(encoding='utf-8')

    assert 'runtimeFocusRequest' in app
    assert 'selectNodesByIds([targetNode.id])' in app
    assert "setCapabilityInspectorTarget({ source: 'node'" in app
    assert 'rfInstance.current?.setCenter(centerX, centerY' in app
    assert 'data-testid="runtime-edge-legend"' in app
    assert 'toggle-traversed-edges' in app
    assert 'toggle-scheduled-edges' in app
    assert 'toggle-muted-edges' in app


def test_run_debug_and_state_surfaces_offer_click_to_focus_runtime_navigation() -> None:
    run_panel = RUN_PANEL.read_text(encoding='utf-8')
    debug_panel = DEBUG_PANEL.read_text(encoding='utf-8')
    state_panel = STATE_PANEL.read_text(encoding='utf-8')

    assert 'timeline-focus-step' in run_panel
    assert 'timeline-focus-scheduled' in run_panel
    assert 'run-log-focus-node' in run_panel
    assert "requestRuntimeFocus(nodeId, 'timeline')" in run_panel
    assert "requestRuntimeFocus(nodeId, 'run_log')" in run_panel

    assert 'debug-focus-step' in debug_panel
    assert 'debug-focus-scheduled' in debug_panel
    assert "requestRuntimeFocus(step.nodeId, 'debug')" in debug_panel

    assert 'state-focus-step' in state_panel
    assert 'state-focus-scheduled' in state_panel
    assert "requestRuntimeFocus(step.nodeId, 'state')" in state_panel
