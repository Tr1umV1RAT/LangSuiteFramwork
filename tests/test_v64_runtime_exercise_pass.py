from __future__ import annotations

import importlib.util
import json
import os
import sys
import tempfile
import types
import zipfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.compiler import compile_graph
from core.runtime_preflight import find_runtime_preflight_issues
from core.schemas import GraphPayload

CAP_MATRIX = ROOT / 'client' / 'src' / 'capabilityMatrix.json'
BLOCKS_PANEL = ROOT / 'client' / 'src' / 'components' / 'BlocksPanelContent.tsx'


def _payload_with_tools(*tools: dict) -> GraphPayload:
    return GraphPayload(graph_id='v64_runtime_exercise', nodes=[], edges=[], tools=list(tools))


def test_compile_graph_renders_runtime_exercise_helpers() -> None:
    payload = _payload_with_tools(
        {'id': 'sql_tool', 'type': 'sql_query', 'params': {'db_path': 'data.db', 'read_only': 'true'}},
        {'id': 'gh_issue', 'type': 'github_get_issue', 'params': {}},
        {'id': 'extract_tool', 'type': 'tavily_extract', 'params': {'tavily_api_key': 'TAVILY_API_KEY', 'include_images': 'false'}},
    )
    buf = compile_graph(payload)
    with zipfile.ZipFile(buf) as zf:
        tools_py = zf.read('v64_runtime_exercise/tools.py').decode('utf-8')

    assert 'def _coerce_bool' in tools_py
    assert 'def _load_github_tool' in tools_py
    assert 'def _invoke_sync_tool' in tools_py
    assert 'def _normalize_positive_int' in tools_py
    assert 'def _normalize_repo_relative_path' in tools_py
    assert 'include_images=_coerce_bool' in tools_py
    assert "read_only = _coerce_bool" in tools_py


def test_runtime_preflight_rejects_invalid_github_repository(monkeypatch) -> None:
    monkeypatch.setenv('GITHUB_APP_ID', '123456')
    monkeypatch.setenv('GITHUB_APP_PRIVATE_KEY', 'dummy-key')
    monkeypatch.setenv('GITHUB_REPOSITORY', 'not a repo')

    payload = _payload_with_tools({'id': 'gh_issue', 'type': 'github_get_issue', 'params': {}})
    issues = find_runtime_preflight_issues(payload)
    codes = {item['code'] for item in issues}
    assert 'invalid_github_repository' in codes


def test_playwright_family_permissions_are_more_precise() -> None:
    matrix = json.loads(CAP_MATRIX.read_text(encoding='utf-8'))['nodeTypes']
    assert matrix['tool_pw_extract_text']['permissionLevel'] == 'read_only'
    assert matrix['tool_playwright_screenshot']['permissionLevel'] == 'read_only'
    assert matrix['tool_pw_click']['permissionLevel'] == 'mixed'
    assert matrix['tool_pw_fill']['permissionLevel'] == 'mixed'


def test_blocks_panel_shows_truth_chips_for_tool_families() -> None:
    text = BLOCKS_PANEL.read_text(encoding='utf-8')
    assert 'paletteTruthChips' in text
    for fragment in ['meta.toolFamilyLabel', "meta.sessionBacked ? 'session' : null", 'meta.permissionLevel', "meta.configRequired ? 'config' : null"]:
        assert fragment in text


LIVE_SMOKE_ENABLED = os.getenv('LANGSUITE_ENABLE_LIVE_SMOKE') == '1'
PLAYWRIGHT_AVAILABLE = importlib.util.find_spec('playwright') is not None


def _load_generated_tools_module(payload: GraphPayload):
    buf = compile_graph(payload)
    tmp_dir = tempfile.TemporaryDirectory(prefix='v64_live_smoke_')
    with zipfile.ZipFile(buf) as zf:
        zf.extractall(tmp_dir.name)
    project_dir = Path(tmp_dir.name) / payload.graph_id
    tools_path = project_dir / 'tools.py'
    spec = importlib.util.spec_from_file_location(f'{payload.graph_id}_tools', tools_path)
    if spec is None or spec.loader is None:
        tmp_dir.cleanup()
        raise RuntimeError('Unable to load generated tools module.')
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    try:
        spec.loader.exec_module(module)
    except Exception:
        tmp_dir.cleanup()
        raise
    return tmp_dir, module


@pytest.mark.skipif(not (LIVE_SMOKE_ENABLED and PLAYWRIGHT_AVAILABLE), reason='optional live smoke only')
def test_optional_playwright_generated_tool_smoke() -> None:
    payload = _payload_with_tools(
        {'id': 'navigate_tool', 'type': 'pw_navigate', 'params': {}},
        {'id': 'text_tool', 'type': 'pw_extract_text', 'params': {}},
    )
    tmp_dir, module = _load_generated_tools_module(payload)
    try:
        nav_result = module.navigate_tool.invoke('data:text/html,<html><body><h1>LangSuite Smoke</h1></body></html>')
        assert 'Succès' in str(nav_result) or 'Success' in str(nav_result)
        text_result = module.text_tool.invoke('body')
        assert 'LangSuite Smoke' in str(text_result)
    finally:
        tmp_dir.cleanup()
