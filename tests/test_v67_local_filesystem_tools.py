
from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.compiler import compile_graph
from core.runtime_preflight import find_runtime_preflight_issues
from core.schemas import GraphPayload

CAP_MATRIX = ROOT / 'client' / 'src' / 'capabilityMatrix.json'
NODE_CONFIG = ROOT / 'client' / 'src' / 'nodeConfig.ts'
STORE_TS = ROOT / 'client' / 'src' / 'store.ts'
HYDRATION_TS = ROOT / 'client' / 'src' / 'store' / 'artifactHydration.ts'
BLOCKS_PANEL = ROOT / 'client' / 'src' / 'components' / 'BlocksPanelContent.tsx'


def _payload_with_tools(*tools: dict) -> GraphPayload:
    return GraphPayload(graph_id='v67_local_filesystem', nodes=[], edges=[], tools=list(tools))


def test_capability_matrix_marks_local_filesystem_surfaces_truthfully() -> None:
    matrix = json.loads(CAP_MATRIX.read_text(encoding='utf-8'))['nodeTypes']
    for key in ['tool_fs_list_dir', 'tool_fs_read_file', 'tool_fs_glob', 'tool_fs_grep']:
        meta = matrix[key]
        assert meta['toolkitBacked'] is True
        assert meta['toolFamily'] == 'filesystem'
        assert meta['permissionLevel'] == 'read_only'
        assert meta['providerBacked'] is False
        assert meta['statefulness'] == 'stateless'


def test_runtime_preflight_reports_invalid_local_filesystem_root() -> None:
    payload = _payload_with_tools({'id': 'fs_list', 'type': 'fs_list_dir', 'params': {'root_path': '/definitely/not/a/real/dir'}})
    issues = find_runtime_preflight_issues(payload)
    assert 'invalid_filesystem_root' in {item['code'] for item in issues}


def test_compile_graph_renders_local_filesystem_runtime_surfaces() -> None:
    payload = _payload_with_tools(
        {'id': 'fs_list', 'type': 'fs_list_dir', 'params': {'root_path': '.', 'include_hidden': False, 'max_results': 20}},
        {'id': 'fs_read', 'type': 'fs_read_file', 'params': {'root_path': '.', 'max_bytes': 4096}},
        {'id': 'fs_glob_tool', 'type': 'fs_glob', 'params': {'root_path': '.', 'include_hidden': False, 'max_results': 50}},
        {'id': 'fs_grep_tool', 'type': 'fs_grep', 'params': {'root_path': '.', 'file_glob': '**/*.py', 'case_sensitive': False, 'include_hidden': False, 'max_matches': 25}},
    )
    buf = compile_graph(payload)
    with zipfile.ZipFile(buf) as zf:
        tools_py = zf.read('v67_local_filesystem/tools.py').decode('utf-8')
    assert 'def _resolve_filesystem_root' in tools_py
    assert 'def _resolve_filesystem_target' in tools_py
    assert 'def _read_text_file_preview' in tools_py
    assert 'def fs_list' in tools_py
    assert 'def fs_read' in tools_py
    assert 'def fs_glob_tool' in tools_py
    assert 'def fs_grep_tool' in tools_py
    assert "'toolkit': 'filesystem'" in tools_py


def test_frontend_wires_local_filesystem_surfaces() -> None:
    node_config_text = NODE_CONFIG.read_text(encoding='utf-8')
    store_text = STORE_TS.read_text(encoding='utf-8')
    hydration_text = HYDRATION_TS.read_text(encoding='utf-8')
    blocks_text = BLOCKS_PANEL.read_text(encoding='utf-8')

    for label in ['FS List Directory', 'FS Read File', 'FS Glob', 'FS Grep']:
        assert label in node_config_text
    for fragment in ["tool_fs_list_dir: 'fs_list_dir'", "tool_fs_read_file: 'fs_read_file'", "tool_fs_glob: 'fs_glob'", "tool_fs_grep: 'fs_grep'"]:
        assert fragment in store_text
    for fragment in ["fs_list_dir: 'tool_fs_list_dir'", "fs_read_file: 'tool_fs_read_file'", "fs_glob: 'tool_fs_glob'", "fs_grep: 'tool_fs_grep'"]:
        assert fragment in hydration_text
    for fragment in [
        'Read-only local filesystem listing from a bounded root path.',
        'Read one local text file from a bounded root path.',
        'Read-only glob search across a bounded local filesystem root.',
        'Read-only grep-style text search across a bounded local filesystem root.',
    ]:
        assert fragment in blocks_text
