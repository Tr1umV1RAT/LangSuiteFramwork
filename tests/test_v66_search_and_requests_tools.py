from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.compiler import compile_graph
from core.runtime_dependencies import collect_runtime_dependency_requirements
from core.runtime_preflight import find_runtime_preflight_issues
from core.schemas import GraphPayload

CAP_MATRIX = ROOT / 'client' / 'src' / 'capabilityMatrix.json'
NODE_CONFIG = ROOT / 'client' / 'src' / 'nodeConfig.ts'
STORE_TS = ROOT / 'client' / 'src' / 'store.ts'
HYDRATION_TS = ROOT / 'client' / 'src' / 'store' / 'artifactHydration.ts'
BLOCKS_PANEL = ROOT / 'client' / 'src' / 'components' / 'BlocksPanelContent.tsx'


def _payload_with_tools(*tools: dict) -> GraphPayload:
    return GraphPayload(graph_id='v66_search_requests', nodes=[], edges=[], tools=list(tools))


def test_capability_matrix_marks_new_search_and_requests_surfaces_truthfully() -> None:
    matrix = json.loads(CAP_MATRIX.read_text(encoding='utf-8'))['nodeTypes']

    brave = matrix['tool_brave_search']
    assert brave['providerBacked'] is True
    assert brave['providerLabel'] == 'Brave Search'
    assert brave['configRequired'] is True
    assert brave['permissionLevel'] == 'read_only'

    ddg = matrix['tool_duckduckgo_search']
    assert ddg['providerBacked'] is True
    assert ddg['providerLabel'] == 'DuckDuckGo'
    assert ddg['configRequired'] is False
    assert ddg['statefulness'] == 'stateless'

    requests_get = matrix['tool_requests_get']
    assert requests_get['toolkitBacked'] is True
    assert requests_get['toolFamily'] == 'requests'
    assert requests_get['permissionLevel'] == 'read_only'

    requests_post = matrix['tool_requests_post']
    assert requests_post['toolkitBacked'] is True
    assert requests_post['toolFamily'] == 'requests'
    assert requests_post['permissionLevel'] == 'mutating'


def test_runtime_dependency_collection_covers_new_canonical_tool_types() -> None:
    payload = _payload_with_tools(
        {'id': 'brave_tool', 'type': 'brave_search', 'params': {'brave_api_key': 'BRAVE_SEARCH_API_KEY'}},
        {'id': 'ddg_tool', 'type': 'duckduckgo_search', 'params': {'max_results': 5}},
        {'id': 'http_get', 'type': 'requests_get', 'params': {'base_url': 'https://example.com'}},
        {'id': 'http_post', 'type': 'requests_post', 'params': {'base_url': 'https://example.com'}},
    )
    requirements = collect_runtime_dependency_requirements(payload)
    modules = {item['module'] for item in requirements}
    packages = {item['package'] for item in requirements}

    assert 'requests' in modules
    assert 'duckduckgo_search' in modules
    assert 'requests' in packages
    assert 'duckduckgo-search' in packages


def test_runtime_preflight_reports_missing_brave_config_and_unscoped_requests() -> None:
    payload = _payload_with_tools(
        {'id': 'brave_tool', 'type': 'brave_search', 'params': {'brave_api_key': 'BRAVE_SEARCH_API_KEY'}},
        {'id': 'http_get', 'type': 'requests_get', 'params': {'base_url': '', 'allow_full_urls': False}},
    )
    issues = find_runtime_preflight_issues(payload)
    codes = {item['code'] for item in issues}
    assert 'missing_brave_api_key' in codes
    assert 'requests_target_not_configured' in codes


def test_compile_graph_renders_brave_ddg_and_requests_runtime_surfaces() -> None:
    payload = _payload_with_tools(
        {'id': 'brave_tool', 'type': 'brave_search', 'params': {'brave_api_key': 'BRAVE_SEARCH_API_KEY', 'max_results': 4}},
        {'id': 'ddg_tool', 'type': 'duckduckgo_search', 'params': {'max_results': 4}},
        {'id': 'http_get', 'type': 'requests_get', 'params': {'base_url': 'https://example.com', 'allow_full_urls': False, 'timeout_seconds': 12, 'headers': {'Accept': 'application/json'}}},
        {'id': 'http_post', 'type': 'requests_post', 'params': {'base_url': 'https://example.com', 'allow_full_urls': False, 'timeout_seconds': 12, 'headers': {'Content-Type': 'application/json'}}},
    )
    buf = compile_graph(payload)
    with zipfile.ZipFile(buf) as zf:
        tools_py = zf.read('v66_search_requests/tools.py').decode('utf-8')
        requirements = zf.read('v66_search_requests/requirements.txt').decode('utf-8')

    assert 'def _resolve_requests_target' in tools_py
    assert 'def _requests_preview_payload' in tools_py
    assert "https://api.search.brave.com/res/v1/web/search" in tools_py
    assert 'from duckduckgo_search import DDGS' in tools_py
    assert "def brave_tool" in tools_py
    assert "def ddg_tool" in tools_py
    assert "def http_get" in tools_py
    assert "def http_post" in tools_py
    assert 'requests>=2.31.0' in requirements
    assert 'duckduckgo-search>=8.1.1' in requirements


def test_frontend_wires_new_search_and_requests_surfaces() -> None:
    node_config_text = NODE_CONFIG.read_text(encoding='utf-8')
    store_text = STORE_TS.read_text(encoding='utf-8')
    hydration_text = HYDRATION_TS.read_text(encoding='utf-8')
    blocks_text = BLOCKS_PANEL.read_text(encoding='utf-8')

    for label in ['Brave Search', 'DuckDuckGo Search', 'Requests GET', 'Requests POST']:
        assert label in node_config_text

    for fragment in ["tool_brave_search: 'brave_search'", "tool_duckduckgo_search: 'duckduckgo_search'", "tool_requests_get: 'requests_get'", "tool_requests_post: 'requests_post'"]:
        assert fragment in store_text

    for fragment in ["brave_search: 'tool_brave_search'", "duckduckgo_search: 'tool_duckduckgo_search'", "requests_get: 'tool_requests_get'", "requests_post: 'tool_requests_post'"]:
        assert fragment in hydration_text

    for fragment in ['Brave provider-backed search with its own web index.', 'DuckDuckGo-based search with no API-key setup.', 'Requests toolkit GET surface for stateless HTTP reads.', 'Requests toolkit POST surface for stateless HTTP writes.']:
        assert fragment in blocks_text
