from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'client' / 'src' / 'App.tsx'
EXECUTION_TIMELINE = ROOT / 'client' / 'src' / 'executionTimeline.ts'
RUN_PANEL = ROOT / 'client' / 'src' / 'components' / 'RunPanel.tsx'
DEBUG_PANEL = ROOT / 'client' / 'src' / 'components' / 'DebugPanelContent.tsx'
CUSTOM_NODE = ROOT / 'client' / 'src' / 'components' / 'CustomNode.tsx'
STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'
INDEX_CSS = ROOT / 'client' / 'src' / 'index.css'


def test_shared_execution_timeline_layer_exists_and_tracks_real_runtime_signals() -> None:
    text = EXECUTION_TIMELINE.read_text(encoding='utf-8')
    assert 'export interface ExecutionStep' in text
    assert 'export interface ExecutionTimeline' in text
    assert 'deriveExecutionTimeline' in text
    assert 'traversedEdgeIds' in text
    assert 'activePathEdgeIds' in text
    assert 'scheduledPathEdgeIds' in text
    assert "entry.type === 'node_update'" in text
    assert "entry.type === 'embedded_trace'" in text
    assert "entry.type === 'paused'" in text


def test_graph_surface_uses_execution_timeline_to_decorate_real_edges() -> None:
    app = APP.read_text(encoding='utf-8')
    css = INDEX_CSS.read_text(encoding='utf-8')

    assert 'deriveExecutionTimeline' in app
    assert 'renderedEdges' in app
    assert 'runtime-edge-traversed' in app
    assert 'runtime-edge-active' in app
    assert 'runtime-edge-scheduled' in app
    assert 'runtime-edge-muted' in app
    assert 'edges={renderedEdges}' in app

    assert '.runtime-edge-traversed .react-flow__edge-path' in css
    assert '.runtime-edge-active .react-flow__edge-path' in css
    assert '.runtime-edge-scheduled .react-flow__edge-path' in css
    assert '.runtime-edge-muted .react-flow__edge-path' in css


def test_run_debug_and_state_surfaces_render_timeline_and_patch_cards() -> None:
    run_panel = RUN_PANEL.read_text(encoding='utf-8')
    debug_panel = DEBUG_PANEL.read_text(encoding='utf-8')
    custom_node = CUSTOM_NODE.read_text(encoding='utf-8')
    state_panel = STATE_PANEL.read_text(encoding='utf-8')

    assert 'ExecutionTimelineCard' in run_panel
    assert 'execution-timeline-card' in run_panel
    assert 'PatchPlanCard' in run_panel
    assert 'patch-plan-card' in run_panel
    assert 'Authored graph nodes in the order the runtime actually reported them.' in run_panel

    assert 'debug-execution-path' in debug_panel
    assert 'deriveExecutionTimeline(edges, runLogs' in debug_panel

    assert 'node-runtime-order-' in custom_node
    assert 'Observed on execution timeline' in custom_node
    assert 'visits ' in custom_node

    assert "Section title=\"Chemin d'exécution\"" in state_panel
    assert 'state-execution-path' in state_panel
    assert 'Edges mis en avant' in state_panel
