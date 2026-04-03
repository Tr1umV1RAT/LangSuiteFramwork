from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.artifact_registry import list_artifacts
from core.runtime_dependencies import format_missing_runtime_dependency_message
from core.runtime_preflight import find_runtime_preflight_issues, format_runtime_preflight_message
from core.schemas import GraphPayload

TOOLBAR = ROOT / 'client' / 'src' / 'components' / 'Toolbar.tsx'
RUN_PANEL = ROOT / 'client' / 'src' / 'components' / 'RunPanel.tsx'
STORE = ROOT / 'client' / 'src' / 'store.ts'
WORKSPACE = ROOT / 'client' / 'src' / 'store' / 'workspace.ts'


def test_graph_artifact_library_exposes_compile_safe_starters_with_surface_truth() -> None:
    items = [item for item in list_artifacts(kind='graph') if item['id'] in {'core_echo_starter', 'static_debug_starter'}]
    ids = {item['id'] for item in items}
    assert ids == {'core_echo_starter', 'static_debug_starter'}
    for item in items:
        assert item['compileSafe'] is True
        assert item['runtimeEnabled'] is True
        assert item['editorOnly'] is False
        assert 'Compile-safe' in item['surfaceSummary'] or 'compile-safe' in item['surfaceSummary']


def test_package_export_import_code_tracks_surface_truth_metadata() -> None:
    store_text = STORE.read_text(encoding='utf-8')
    workspace_text = WORKSPACE.read_text(encoding='utf-8')
    assert 'surfaceTruth' in store_text
    assert 'packageIncludes' in store_text
    assert 'packageExcludes' in store_text
    assert 'buildSurfaceTruthSummary' in workspace_text
    assert 'Compile-capable, but in-app runtime stays disabled on this surface.' in workspace_text


def test_toolbar_package_dialog_explains_surface_truth_and_consequences() -> None:
    text = TOOLBAR.read_text(encoding='utf-8')
    assert 'data-testid="package-surface-truth"' in text
    assert 'compile-safe' in text
    assert 'editor-first' in text
    assert 'Preserves this surface truth' in text
    assert 'Shows after import whether the package claimed a compile-safe surface or an editor-first one.' in text


def test_run_panel_surfaces_actionable_hints_for_runtime_failures() -> None:
    text = RUN_PANEL.read_text(encoding='utf-8')
    assert 'data-testid="run-log-actionable-hint"' in text
    assert 'Install the missing runtime packages in the Python environment that runs LangSuite.' in text
    assert 'Set a provider base URL on the affected node or tool.' in text
    assert 'Arm shell execution explicitly for this graph.' in text


def test_runtime_messages_are_actionable_not_merely_technical() -> None:
    dependency_message = format_missing_runtime_dependency_message([
        {'module': 'langgraph', 'package': 'langgraph', 'reason': 'generated graph runtime'},
    ])
    assert 'Run blocked before build.' in dependency_message
    assert 'Install the missing runtime packages' in dependency_message

    payload = GraphPayload(
        graph_id='v83_provider_help',
        nodes=[{'id': 'llm_1', 'type': 'llm_chat', 'params': {'provider': 'lm_studio', 'model_name': 'demo'}}],
        edges=[],
        tools=[],
    )
    issues = find_runtime_preflight_issues(payload)
    api_base_issue = next(item for item in issues if item['code'] == 'missing_provider_api_base_url')
    assert 'Set the provider base URL on the node or tool' in api_base_issue['message']
    summary = format_runtime_preflight_message(issues)
    assert 'Run blocked by runtime preflight.' in summary
    assert 'Fix the reported configuration issues, then rerun' in summary
