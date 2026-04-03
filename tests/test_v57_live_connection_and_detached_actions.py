from pathlib import Path

APP = Path('client/src/App.tsx').read_text()
TOOLBAR = Path('client/src/components/Toolbar.tsx').read_text()
STATE = Path('client/src/components/StatePanelContent.tsx').read_text()
GRAPH = Path('client/src/graphUtils.ts').read_text()
STORE = Path('client/src/store.ts').read_text()


def test_app_exposes_live_connection_feedback_and_hooks():
    assert 'connectionFeedback' in APP
    assert 'handleConnectStart' in APP
    assert 'handleConnectEnd' in APP
    assert 'onConnectStart={handleConnectStart}' in APP
    assert 'onConnectEnd={handleConnectEnd}' in APP
    assert 'describeConnectionReason' in APP
    assert 'describeSemanticKind' in APP


def test_graph_utils_has_human_reason_descriptions():
    assert 'CONNECTION_REASON_DESCRIPTIONS' in GRAPH
    assert 'tool_handle_requires_tools_in' in GRAPH
    assert 'fanout_requires_worker_step_before_reduce' in GRAPH
    assert 'describeConnectionReason' in GRAPH


def test_toolbar_and_state_panel_expose_detached_actions():
    assert 'toolbar-detached-actions' in TOOLBAR
    assert 'detached-actions-popover' in TOOLBAR
    assert 'Select detached' in TOOLBAR
    assert 'Sélectionner les détachés' in STATE


def test_store_supports_selection_actions():
    assert 'selectNodesByIds: (ids: string[]) => void;' in STORE
    assert 'selectNodesByIds: (ids: string[]) => {' in STORE
