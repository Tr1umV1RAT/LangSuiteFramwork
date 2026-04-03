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
from core.schemas import GraphPayload, RuntimeSettings, UIContext

CAP_MATRIX = ROOT / 'client' / 'src' / 'capabilityMatrix.json'
NODE_CONFIG = ROOT / 'client' / 'src' / 'nodeConfig.ts'
STORE_TS = ROOT / 'client' / 'src' / 'store.ts'
HYDRATION_TS = ROOT / 'client' / 'src' / 'store' / 'artifactHydration.ts'
BLOCKS_PANEL = ROOT / 'client' / 'src' / 'components' / 'BlocksPanelContent.tsx'
TOOLBAR = ROOT / 'client' / 'src' / 'components' / 'Toolbar.tsx'
TYPES_TS = ROOT / 'client' / 'src' / 'store' / 'types.ts'
WORKSPACE_TS = ROOT / 'client' / 'src' / 'store' / 'workspace.ts'


def _payload_with_tools(*tools: dict, shell_enabled: bool = False) -> GraphPayload:
    return GraphPayload(
        graph_id='v68_local_mutation_and_shell',
        nodes=[],
        edges=[],
        tools=list(tools),
        ui_context=UIContext(runtime_settings=RuntimeSettings(shellExecutionEnabled=shell_enabled)),
    )


def test_capability_matrix_marks_local_mutation_and_shell_surfaces_truthfully() -> None:
    matrix = json.loads(CAP_MATRIX.read_text(encoding='utf-8'))['nodeTypes']

    assert matrix['tool_fs_write_file']['toolFamily'] == 'filesystem'
    assert matrix['tool_fs_write_file']['permissionLevel'] == 'mutating'
    assert matrix['tool_fs_edit_file']['permissionLevel'] == 'mutating'
    assert matrix['tool_shell_command']['toolFamily'] == 'shell'
    assert matrix['tool_shell_command']['configRequired'] is True
    assert matrix['tool_shell_command']['permissionLevel'] == 'mutating'
    assert 'blocked/failed/succeeded statuses' in matrix['tool_shell_command']['summary']
    assert 'Not OS-container isolated' in matrix['tool_shell_command']['summary']


def test_runtime_settings_and_toolbar_expose_shell_arming() -> None:
    types_text = TYPES_TS.read_text(encoding='utf-8')
    workspace_text = WORKSPACE_TS.read_text(encoding='utf-8')
    toolbar_text = TOOLBAR.read_text(encoding='utf-8')

    assert 'shellExecutionEnabled: boolean;' in types_text
    assert 'shellExecutionEnabled: false' in workspace_text
    assert 'settings?.shellExecutionEnabled === true' in workspace_text
    assert 'toolbar-shell-arming' in toolbar_text
    assert 'Shell armed' in toolbar_text
    assert 'does not provide OS container isolation' in toolbar_text


def test_runtime_preflight_blocks_shell_until_user_arms_it() -> None:
    payload = _payload_with_tools(
        {'id': 'shell_tool', 'type': 'shell_command', 'params': {'root_path': '.', 'timeout_seconds': 10, 'allowed_commands': ['python']}},
        shell_enabled=False,
    )
    issues = find_runtime_preflight_issues(payload)
    codes = {item['code'] for item in issues}
    assert 'shell_execution_not_armed' in codes
    assert 'missing_shell_allowlist' not in codes


def test_runtime_preflight_accepts_armed_shell_with_allowlist() -> None:
    payload = _payload_with_tools(
        {'id': 'shell_tool', 'type': 'shell_command', 'params': {'root_path': '.', 'timeout_seconds': 10, 'allowed_commands': ['python', 'pytest']}},
        shell_enabled=True,
    )
    issues = find_runtime_preflight_issues(payload)
    codes = {item['code'] for item in issues}
    assert 'shell_execution_not_armed' not in codes
    assert 'missing_shell_allowlist' not in codes


def test_compile_graph_renders_mutation_and_shell_runtime_surfaces() -> None:
    payload = _payload_with_tools(
        {'id': 'fs_write', 'type': 'fs_write_file', 'params': {'root_path': '.', 'create_dirs': False, 'overwrite_existing': False, 'max_bytes': 4096}},
        {'id': 'fs_edit', 'type': 'fs_edit_file', 'params': {'root_path': '.', 'replace_all': False, 'max_bytes': 4096}},
        {'id': 'shell_tool', 'type': 'shell_command', 'params': {'root_path': '.', 'timeout_seconds': 10, 'allowed_commands': ['python', 'pytest']}},
        shell_enabled=True,
    )
    buf = compile_graph(payload)
    with zipfile.ZipFile(buf) as zf:
        tools_py = zf.read('v68_local_mutation_and_shell/tools.py').decode('utf-8')
    assert 'SHELL_EXECUTION_ENABLED = True' in tools_py
    assert 'def fs_write' in tools_py
    assert 'def fs_edit' in tools_py
    assert 'def shell_tool' in tools_py
    assert '_resolve_filesystem_target_for_write' in tools_py
    assert '_normalize_shell_command' in tools_py
    assert "reason_code='shell_not_armed'" in tools_py
    assert 'Arm shell execution from the top toolbar for this graph before running shell tools.' in tools_py


def test_frontend_wires_mutation_and_shell_surfaces() -> None:
    node_config_text = NODE_CONFIG.read_text(encoding='utf-8')
    store_text = STORE_TS.read_text(encoding='utf-8')
    hydration_text = HYDRATION_TS.read_text(encoding='utf-8')
    blocks_text = BLOCKS_PANEL.read_text(encoding='utf-8')

    for label in ['FS Write File', 'FS Edit File', 'Shell Command']:
        assert label in node_config_text
    for fragment in ["tool_fs_write_file: 'fs_write_file'", "tool_fs_edit_file: 'fs_edit_file'", "tool_shell_command: 'shell_command'"]:
        assert fragment in store_text
    for fragment in ["fs_write_file: 'tool_fs_write_file'", "fs_edit_file: 'tool_fs_edit_file'", "shell_command: 'tool_shell_command'"]:
        assert fragment in hydration_text
    for fragment in [
        'Preview or apply one local text file under a bounded root path with explicit create-vs-overwrite guards.',
        'Preview or apply one local text file edit under a bounded root path with explicit match guards.',
        'User-armed bounded local shell subprocess surface with cwd and command allowlist guards and explicit blocked/failed/succeeded statuses.',
    ]:
        assert fragment in blocks_text
