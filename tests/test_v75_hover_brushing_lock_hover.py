from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STORE = ROOT / 'client' / 'src' / 'store.ts'
STORE_TYPES = ROOT / 'client' / 'src' / 'store' / 'types.ts'
APP = ROOT / 'client' / 'src' / 'App.tsx'
CUSTOM_NODE = ROOT / 'client' / 'src' / 'components' / 'CustomNode.tsx'
RUN_PANEL = ROOT / 'client' / 'src' / 'components' / 'RunPanel.tsx'
DEBUG_PANEL = ROOT / 'client' / 'src' / 'components' / 'DebugPanelContent.tsx'
STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'
INDEX_CSS = ROOT / 'client' / 'src' / 'index.css'


def test_store_exposes_shared_runtime_hover_and_navigation_settings() -> None:
    store = STORE.read_text(encoding='utf-8')
    types = STORE_TYPES.read_text(encoding='utf-8')

    assert 'export interface RuntimeHoverTarget' in types
    assert 'export interface RuntimeNavigationSettings' in types
    assert 'runtimeHoverTarget: RuntimeHoverTarget | null;' in store
    assert 'runtimeNavigationSettings: RuntimeNavigationSettings;' in store
    assert 'setRuntimeHoverTarget:' in store
    assert 'clearRuntimeHoverTarget:' in store
    assert 'updateRuntimeNavigationSettings:' in store


def test_graph_surface_renders_hover_brushing_legend_and_edge_semantics() -> None:
    app = APP.read_text(encoding='utf-8')
    css = INDEX_CSS.read_text(encoding='utf-8')

    assert 'runtime-hover-legend' in app
    assert 'toggle-lock-hover' in app
    assert 'toggle-follow-active' in app
    assert 'clear-runtime-hover' in app
    assert 'runtime-edge-hover-inbound' in app
    assert 'runtime-edge-hover-outbound' in app
    assert 'runtime-edge-hover-muted' in app
    assert 'Inbound edges flow into the inspected node. Outbound edges leave it toward authored successors.' in app

    assert '.runtime-edge-hover-inbound .react-flow__edge-path' in css
    assert '.runtime-edge-hover-outbound .react-flow__edge-path' in css
    assert '.runtime-edge-hover-muted .react-flow__edge-path' in css


def test_canvas_nodes_publish_hover_target_and_softly_brush_predecessors_and_successors() -> None:
    custom_node = CUSTOM_NODE.read_text(encoding='utf-8')
    css = INDEX_CSS.read_text(encoding='utf-8')

    assert 'runtimeHoverTarget' in custom_node
    assert 'setRuntimeHoverTarget' in custom_node
    assert 'clearRuntimeHoverTarget' in custom_node
    assert 'runtime-hover-predecessor' in custom_node
    assert 'runtime-hover-successor' in custom_node
    assert 'runtime-hover-muted' in custom_node
    assert "onMouseEnter={() => setRuntimeHoverTarget(id, 'graph')}" in custom_node
    assert "clearRuntimeHoverTarget('graph', id)" in custom_node

    assert '.custom-node.runtime-hovered' in css
    assert '.custom-node.runtime-hover-predecessor' in css
    assert '.custom-node.runtime-hover-successor' in css
    assert '.custom-node.runtime-hover-muted' in css


def test_run_debug_and_state_surfaces_join_the_same_hover_channel() -> None:
    run_panel = RUN_PANEL.read_text(encoding='utf-8')
    debug_panel = DEBUG_PANEL.read_text(encoding='utf-8')
    state_panel = STATE_PANEL.read_text(encoding='utf-8')

    assert 'hoveredNodeId={runtimeHoverTarget?.nodeId || null}' in run_panel
    assert "setRuntimeHoverTarget(nodeId, 'timeline')" in run_panel
    assert "clearRuntimeHoverTarget('timeline', nodeId)" in run_panel
    assert "setRuntimeHoverTarget(nodeId, 'run_log')" in run_panel
    assert "clearRuntimeHoverTarget('run_log', nodeId)" in run_panel
    assert 'isHoveredMatch' in run_panel

    assert "setRuntimeHoverTarget(step.nodeId, 'debug')" in debug_panel
    assert "clearRuntimeHoverTarget('debug', step.nodeId)" in debug_panel
    assert "setRuntimeHoverTarget(nodeId, 'debug')" in debug_panel

    assert "setRuntimeHoverTarget(step.nodeId, 'state')" in state_panel
    assert "clearRuntimeHoverTarget('state', step.nodeId)" in state_panel
    assert "setRuntimeHoverTarget(nodeId, 'state')" in state_panel
