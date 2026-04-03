from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

CAP_MATRIX = ROOT / 'client' / 'src' / 'capabilityMatrix.json'
EXECUTION_TRUTH = ROOT / 'client' / 'src' / 'executionTruth.ts'
STORE = ROOT / 'client' / 'src' / 'store.ts'
RUN_PANEL = ROOT / 'client' / 'src' / 'components' / 'RunPanel.tsx'
DEBUG_PANEL = ROOT / 'client' / 'src' / 'components' / 'DebugPanelContent.tsx'
CUSTOM_NODE = ROOT / 'client' / 'src' / 'components' / 'CustomNode.tsx'
STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'
INDEX_CSS = ROOT / 'client' / 'src' / 'index.css'


def test_capability_matrix_exposes_runtime_truth_projection_for_local_mutation_and_shell() -> None:
    matrix = json.loads(CAP_MATRIX.read_text(encoding='utf-8'))['nodeTypes']

    for node_type in ('tool_fs_write_file', 'tool_fs_edit_file', 'tool_fs_apply_patch', 'tool_shell_command'):
        entry = matrix[node_type]
        assert isinstance(entry.get('debugProjection'), list) and entry['debugProjection']
        assert isinstance(entry.get('uiAbstractionNotes'), list) and entry['uiAbstractionNotes']
        assert isinstance(entry.get('linkSemantics'), list) and entry['linkSemantics']

    assert 'preview from apply' in ' '.join(matrix['tool_fs_write_file']['debugProjection']).lower()
    assert 'match counts' in ' '.join(matrix['tool_fs_edit_file']['debugProjection']).lower()
    assert 'files to modify' in ' '.join(matrix['tool_fs_apply_patch']['debugProjection']).lower()
    assert 'user-armed' in ' '.join(matrix['tool_shell_command']['debugProjection']).lower()


def test_shared_execution_truth_layer_exists_and_is_used_by_runtime_ui_surfaces() -> None:
    execution_truth = EXECUTION_TRUTH.read_text(encoding='utf-8')
    store_text = STORE.read_text(encoding='utf-8')
    run_panel_text = RUN_PANEL.read_text(encoding='utf-8')
    debug_panel_text = DEBUG_PANEL.read_text(encoding='utf-8')
    custom_node_text = CUSTOM_NODE.read_text(encoding='utf-8')
    state_panel_text = STATE_PANEL.read_text(encoding='utf-8')

    assert 'export function parseToolObservation' in execution_truth
    assert 'export function summarizeToolObservation' in execution_truth
    assert 'export function describeToolObservationCounts' in execution_truth

    assert 'executionStatus' in store_text
    assert 'operationSummary' in store_text
    assert 'parseToolObservation' in store_text

    assert 'parseToolObservation' in run_panel_text
    assert 'ToolStatusBadge' in run_panel_text
    assert 'mode:' in run_panel_text

    assert 'debug-runtime-correspondence' in debug_panel_text
    assert 'debug-tool-activity' in debug_panel_text
    assert 'last tool status' in debug_panel_text.lower()

    assert 'node-runtime-status-' in custom_node_text
    assert 'node-runtime-summary' in custom_node_text
    assert 'runtime-running' in custom_node_text
    assert 'runtime-queued' in custom_node_text

    assert 'summarizeToolObservation(toolObservation)' in state_panel_text
    assert 'toolObservation.reasonCode' in state_panel_text


def test_runtime_truth_styles_exist_for_graph_node_execution_feedback() -> None:
    css = INDEX_CSS.read_text(encoding='utf-8')
    assert '.custom-node.runtime-queued' in css
    assert '.custom-node.runtime-running' in css
    assert '.custom-node.runtime-paused' in css
    assert '.custom-node.runtime-failed' in css
    assert '.custom-node.runtime-blocked' in css
    assert '.node-runtime-row' in css
    assert '.node-runtime-summary' in css
    assert '.node-chip-runtime-detail' in css
