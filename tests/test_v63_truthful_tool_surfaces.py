from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import main
from core.compiler import compile_graph
from core.runtime_dependencies import collect_runtime_dependency_requirements
from core.runtime_preflight import find_runtime_preflight_issues
from core.schemas import GraphPayload

CAP_MATRIX = ROOT / 'client' / 'src' / 'capabilityMatrix.json'
INSPECTOR_TS = ROOT / 'client' / 'src' / 'components' / 'CapabilityInspectorSection.tsx'
NODE_CONFIG = ROOT / 'client' / 'src' / 'nodeConfig.ts'
CUSTOM_NODE = ROOT / 'client' / 'src' / 'components' / 'CustomNode.tsx'


def _payload_with_tools(*tools: dict) -> GraphPayload:
    return GraphPayload(graph_id='v63_tools', nodes=[], edges=[], tools=list(tools))


def test_capability_matrix_marks_provider_toolkit_state_permission_truth() -> None:
    matrix = json.loads(CAP_MATRIX.read_text(encoding='utf-8'))['nodeTypes']

    tavily = matrix['tool_web_search']
    assert tavily['providerBacked'] is True
    assert tavily['providerLabel'] == 'Tavily'
    assert tavily['configRequired'] is True
    assert tavily['permissionLevel'] == 'read_only'

    playwright = matrix['tool_pw_extract_links']
    assert playwright['toolFamily'] == 'playwright'
    assert playwright['sessionBacked'] is True
    assert playwright['statefulness'] == 'session'

    sql = matrix['tool_sql_query']
    assert sql['toolFamily'] == 'sql'
    assert sql['permissionLevel'] == 'read_only'

    github = matrix['tool_github_get_issue']
    assert github['providerBacked'] is True
    assert github['providerLabel'] == 'GitHub'
    assert github['toolkitBacked'] is True


def test_runtime_dependency_preflight_covers_canonical_tool_types() -> None:
    payload = _payload_with_tools(
        {'id': 'search_tool', 'type': 'web_search', 'params': {'tavily_api_key': 'TAVILY_API_KEY'}},
        {'id': 'extract_tool', 'type': 'tavily_extract', 'params': {'tavily_api_key': 'TAVILY_API_KEY'}},
        {'id': 'schema_tool', 'type': 'sql_get_schema', 'params': {'db_path': 'data.db'}},
        {'id': 'gh_tool', 'type': 'github_get_issue', 'params': {}},
        {'id': 'pw_tool', 'type': 'pw_extract_links', 'params': {}},
    )
    requirements = collect_runtime_dependency_requirements(payload)
    modules = {item['module'] for item in requirements}
    packages = {item['package'] for item in requirements}

    assert 'langchain_tavily' in modules
    assert 'langchain_community' in modules
    assert 'github' in modules
    assert 'playwright' in modules
    assert 'langchain-tavily' in packages
    assert 'pygithub' in packages


def test_runtime_preflight_reports_missing_provider_config_and_unsafe_sql(monkeypatch) -> None:
    for name in ['TAVILY_API_KEY', 'GITHUB_APP_ID', 'GITHUB_APP_PRIVATE_KEY', 'GITHUB_REPOSITORY']:
        monkeypatch.delenv(name, raising=False)

    payload = _payload_with_tools(
        {'id': 'search_tool', 'type': 'web_search', 'params': {'tavily_api_key': 'TAVILY_API_KEY'}},
        {'id': 'extract_tool', 'type': 'tavily_extract', 'params': {'tavily_api_key': 'TAVILY_API_KEY'}},
        {'id': 'sql_tool', 'type': 'sql_query', 'params': {'db_path': 'data.db', 'read_only': False}},
        {'id': 'gh_tool', 'type': 'github_get_issue', 'params': {}},
    )
    issues = find_runtime_preflight_issues(payload)
    codes = {item['code'] for item in issues}
    assert 'missing_tavily_api_key' in codes
    assert 'sql_mutation_disabled' in codes
    assert 'missing_github_configuration' in codes


def test_runner_surfaces_runtime_preflight_before_build(monkeypatch) -> None:
    for name in ['TAVILY_API_KEY', 'GITHUB_APP_ID', 'GITHUB_APP_PRIVATE_KEY', 'GITHUB_REPOSITORY']:
        monkeypatch.delenv(name, raising=False)

    client = TestClient(main.app)
    payload = {
        'graph_id': 'v63-runtime-preflight',
        'nodes': [],
        'edges': [],
        'tools': [
            {'id': 'search_tool', 'type': 'web_search', 'params': {'tavily_api_key': 'TAVILY_API_KEY'}},
        ],
    }
    with client.websocket_connect('/api/ws/run/v63-runtime-preflight') as ws:
        ws.send_json({'action': 'start', 'payload': payload})
        message = ws.receive_json()
    if message.get('stage') == 'runtime_dependencies':
        # Environment without LangGraph runtime deps: dependency failure is still honest and earlier.
        assert message.get('missingDependencies')
    else:
        assert message['type'] == 'error'
        assert message['stage'] == 'runtime_preflight'
        assert any(item['code'] == 'missing_tavily_api_key' for item in message['issues'])


def test_compile_graph_renders_new_tool_surfaces_without_breaking_trunk() -> None:
    payload = _payload_with_tools(
        {'id': 'search_tool', 'type': 'web_search', 'params': {'tavily_api_key': 'TAVILY_API_KEY', 'max_results': 2}},
        {'id': 'extract_tool', 'type': 'tavily_extract', 'params': {'tavily_api_key': 'TAVILY_API_KEY', 'extract_depth': 'basic', 'include_images': False}},
        {'id': 'sql_tool', 'type': 'sql_list_tables', 'params': {'db_path': 'data.db'}},
        {'id': 'gh_tool', 'type': 'github_get_issue', 'params': {}},
        {'id': 'pw_tool', 'type': 'pw_extract_links', 'params': {}},
    )
    buf = compile_graph(payload)
    with zipfile.ZipFile(buf) as zf:
        tools_py = zf.read('v63_tools/tools.py').decode('utf-8')
        requirements = zf.read('v63_tools/requirements.txt').decode('utf-8')

    assert 'TavilyExtract' in tools_py
    assert "def search_tool" in tools_py
    assert "def extract_tool" in tools_py
    assert "def sql_tool" in tools_py
    assert "def gh_tool" in tools_py
    assert '_load_github_tool' in tools_py
    assert '_sql_read_only_guard' in tools_py
    assert 'langchain-tavily' in requirements
    assert 'pygithub' in requirements
    assert 'playwright>=' in requirements


def test_frontend_surfaces_compact_truth_labels() -> None:
    inspector_text = INSPECTOR_TS.read_text(encoding='utf-8')
    node_config_text = NODE_CONFIG.read_text(encoding='utf-8')
    custom_node_text = CUSTOM_NODE.read_text(encoding='utf-8')

    for label in ['Provider', 'Tool family', 'Statefulness', 'Permission', 'Config required', 'Session-backed']:
        assert label in inspector_text

    assert 'Tavily Search' in node_config_text
    assert 'Tavily Extract' in node_config_text
    assert 'GitHub Get Issue' in node_config_text
    assert 'SQL Query Check' in node_config_text
    assert 'truthChips' in custom_node_text
