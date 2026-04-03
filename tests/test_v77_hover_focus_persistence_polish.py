from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STORE = ROOT / 'client' / 'src' / 'store.ts'
STORE_TYPES = ROOT / 'client' / 'src' / 'store' / 'types.ts'
APP = ROOT / 'client' / 'src' / 'App.tsx'
RUN_PANEL = ROOT / 'client' / 'src' / 'components' / 'RunPanel.tsx'
DEBUG_PANEL = ROOT / 'client' / 'src' / 'components' / 'DebugPanelContent.tsx'
STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'


def test_store_and_graph_surface_expose_optional_auto_scroll_for_matching_logs() -> None:
    types = STORE_TYPES.read_text(encoding='utf-8')
    store = STORE.read_text(encoding='utf-8')
    app = APP.read_text(encoding='utf-8')

    assert 'autoScrollMatchingLogs: boolean;' in types
    assert "runtimeNavigationSettings: { followActiveNode: false, lockHover: false, autoScrollMatchingLogs: false }," in store
    assert 'toggle-auto-scroll-matching-logs' in app
    assert "auto-scroll logs {runtimeNavigationSettings.autoScrollMatchingLogs ? 'on' : 'off'}" in app
    assert 'updateRuntimeNavigationSettings({ autoScrollMatchingLogs: !runtimeNavigationSettings.autoScrollMatchingLogs })' in app


def test_run_panel_supports_inline_lock_unlock_and_graph_correlated_log_autoscroll() -> None:
    run_panel = RUN_PANEL.read_text(encoding='utf-8')

    assert 'function RuntimeLockButton' in run_panel
    assert 'runtime-entry-unlock' in run_panel
    assert 'runtime-entry-lock' in run_panel
    assert 'const unlockRuntimeNode = (nodeId?: string) => {' in run_panel
    assert 'const selectedGraphNodeId = useMemo(() => nodes.find((node) => node.selected)?.id || null, [nodes]);' in run_panel
    assert "const graphCorrelatedNodeId = runtimeHoverTarget?.source === 'graph' ? runtimeHoverTarget.nodeId : selectedGraphNodeId;" in run_panel
    assert 'matchingLogRefs' in run_panel
    assert 'runtimeNavigationSettings.autoScrollMatchingLogs' in run_panel
    assert "matchingLogRefs.current[graphCorrelatedNodeId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });" in run_panel
    assert 'lockedNodeId={runtimeNavigationSettings.lockHover ? runtimeHoverTarget?.nodeId || null : null}' in run_panel
    assert 'onUnlockNode={(nodeId) => unlockRuntimeNode(nodeId)}' in run_panel
    assert 'entryRef={entry.node ? (element) => { matchingLogRefs.current[entry.node!] = element; } : undefined}' in run_panel


def test_debug_and_state_runtime_chips_get_click_to_lock_and_inline_unlock_affordances() -> None:
    debug_panel = DEBUG_PANEL.read_text(encoding='utf-8')
    state_panel = STATE_PANEL.read_text(encoding='utf-8')

    assert 'function RuntimeChipLockButton' in debug_panel
    assert 'debug-runtime-unlock' in debug_panel
    assert 'debug-runtime-lock' in debug_panel
    assert 'const lockRuntimeNode = (nodeId: string) => {' in debug_panel
    assert 'const unlockRuntimeNode = (nodeId?: string) => {' in debug_panel
    assert 'onDoubleClick={() => lockRuntimeNode(nodeId)}' in debug_panel
    assert 'onDoubleClick={() => lockRuntimeNode(step.nodeId)}' in debug_panel
    assert 'RuntimeChipLockButton nodeId={nodeId}' in debug_panel
    assert 'RuntimeChipLockButton nodeId={step.nodeId}' in debug_panel

    assert 'function RuntimeChipLockButton' in state_panel
    assert 'state-runtime-unlock' in state_panel
    assert 'state-runtime-lock' in state_panel
    assert 'const lockRuntimeNode = (nodeId: string) => {' in state_panel
    assert 'const unlockRuntimeNode = (nodeId?: string) => {' in state_panel
    assert 'onDoubleClick={() => lockRuntimeNode(nodeId)}' in state_panel
    assert 'onDoubleClick={() => lockRuntimeNode(step.nodeId)}' in state_panel
    assert 'RuntimeChipLockButton nodeId={nodeId}' in state_panel
    assert 'RuntimeChipLockButton nodeId={step.nodeId}' in state_panel
