from __future__ import annotations

import asyncio
import json
import sys
import types
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.compiler import compile_graph
from core.schemas import GraphPayload, RuntimeSettings, UIContext


def _payload_with_tools(*tools: dict, shell_enabled: bool = False) -> GraphPayload:
    return GraphPayload(
        graph_id='v70_local_mutation_trust',
        nodes=[],
        edges=[],
        tools=list(tools),
        ui_context=UIContext(runtime_settings=RuntimeSettings(shellExecutionEnabled=shell_enabled)),
    )


def _invoke_tool(fn, *args):
    value = fn(*args)
    if asyncio.iscoroutine(value):
        return asyncio.run(value)
    return value


def _compiled_tools_namespace(payload: GraphPayload) -> tuple[dict, str]:
    buf = compile_graph(payload)
    with zipfile.ZipFile(buf) as zf:
        tools_py = zf.read('v70_local_mutation_trust/tools.py').decode('utf-8')

    fake_pkg = types.ModuleType('langchain_core')
    fake_tools = types.ModuleType('langchain_core.tools')

    def _tool(fn=None, **_kwargs):
        if fn is None:
            return lambda inner: inner
        return fn

    fake_tools.tool = _tool
    fake_pkg.tools = fake_tools
    previous_core = sys.modules.get('langchain_core')
    previous_tools = sys.modules.get('langchain_core.tools')
    sys.modules['langchain_core'] = fake_pkg
    sys.modules['langchain_core.tools'] = fake_tools
    namespace: dict = {'__name__': 'compiled_tools'}
    try:
        exec(tools_py, namespace)
    finally:
        if previous_core is not None:
            sys.modules['langchain_core'] = previous_core
        else:
            sys.modules.pop('langchain_core', None)
        if previous_tools is not None:
            sys.modules['langchain_core.tools'] = previous_tools
        else:
            sys.modules.pop('langchain_core.tools', None)
    return namespace, tools_py


def test_write_preview_is_default_and_does_not_mutate_or_create_dirs(tmp_path: Path) -> None:
    payload = _payload_with_tools(
        {'id': 'fs_write', 'type': 'fs_write_file', 'params': {'root_path': str(tmp_path), 'create_dirs': True, 'overwrite_existing': False, 'max_bytes': 4096}},
    )
    namespace, _ = _compiled_tools_namespace(payload)
    result = _invoke_tool(namespace['fs_write'], 'nested/file.txt', 'hello world')
    payload_out = json.loads(result)
    assert payload_out['status'] == 'preview'
    assert payload_out['mode'] == 'preview'
    assert payload_out['would_create'] is True
    assert payload_out['would_create_dirs'] is True
    assert not (tmp_path / 'nested').exists()
    assert not (tmp_path / 'nested' / 'file.txt').exists()


def test_write_apply_mutates_when_valid(tmp_path: Path) -> None:
    payload = _payload_with_tools(
        {'id': 'fs_write', 'type': 'fs_write_file', 'params': {'root_path': str(tmp_path), 'create_dirs': True, 'overwrite_existing': False, 'max_bytes': 4096}},
    )
    namespace, _ = _compiled_tools_namespace(payload)
    result = _invoke_tool(namespace['fs_write'], 'nested/file.txt', 'hello world', 'apply')
    payload_out = json.loads(result)
    assert payload_out['status'] == 'applied'
    assert payload_out['created'] is True
    assert (tmp_path / 'nested' / 'file.txt').read_text(encoding='utf-8') == 'hello world'


def test_write_blocks_root_escape_attempt(tmp_path: Path) -> None:
    payload = _payload_with_tools(
        {'id': 'fs_write', 'type': 'fs_write_file', 'params': {'root_path': str(tmp_path), 'create_dirs': False, 'overwrite_existing': False, 'max_bytes': 4096}},
    )
    namespace, _ = _compiled_tools_namespace(payload)
    result = _invoke_tool(namespace['fs_write'], '../escape.txt', 'nope', 'apply')
    payload_out = json.loads(result)
    assert payload_out['status'] == 'blocked'
    assert payload_out['reason_code'] == 'root_escape_attempt'
    assert not (tmp_path.parent / 'escape.txt').exists()


def test_write_overwrite_denial_is_explicit(tmp_path: Path) -> None:
    target = tmp_path / 'sample.txt'
    target.write_text('alpha', encoding='utf-8')
    payload = _payload_with_tools(
        {'id': 'fs_write', 'type': 'fs_write_file', 'params': {'root_path': str(tmp_path), 'create_dirs': False, 'overwrite_existing': False, 'max_bytes': 4096}},
    )
    namespace, _ = _compiled_tools_namespace(payload)
    result = _invoke_tool(namespace['fs_write'], 'sample.txt', 'beta', 'apply')
    payload_out = json.loads(result)
    assert payload_out['status'] == 'blocked'
    assert payload_out['reason_code'] == 'overwrite_not_allowed'
    assert target.read_text(encoding='utf-8') == 'alpha'


def test_edit_preview_does_not_mutate_and_reports_match_count(tmp_path: Path) -> None:
    target = tmp_path / 'sample.txt'
    target.write_text('alpha beta beta', encoding='utf-8')
    payload = _payload_with_tools(
        {'id': 'fs_edit', 'type': 'fs_edit_file', 'params': {'root_path': str(tmp_path), 'replace_all': True, 'max_bytes': 4096}},
    )
    namespace, _ = _compiled_tools_namespace(payload)
    result = _invoke_tool(namespace['fs_edit'], 'sample.txt', 'beta', 'BETA', 'preview')
    payload_out = json.loads(result)
    assert payload_out['status'] == 'preview'
    assert payload_out['matches_found'] == 2
    assert payload_out['replacements_planned'] == 2
    assert target.read_text(encoding='utf-8') == 'alpha beta beta'


def test_edit_no_match_is_explicit(tmp_path: Path) -> None:
    target = tmp_path / 'sample.txt'
    target.write_text('alpha beta', encoding='utf-8')
    payload = _payload_with_tools(
        {'id': 'fs_edit', 'type': 'fs_edit_file', 'params': {'root_path': str(tmp_path), 'replace_all': False, 'max_bytes': 4096}},
    )
    namespace, _ = _compiled_tools_namespace(payload)
    result = _invoke_tool(namespace['fs_edit'], 'sample.txt', 'gamma', 'GAMMA', 'apply')
    payload_out = json.loads(result)
    assert payload_out['status'] == 'blocked'
    assert payload_out['reason_code'] == 'edit_match_missing'
    assert target.read_text(encoding='utf-8') == 'alpha beta'


def test_patch_preview_reports_create_and_modify_without_mutating(tmp_path: Path) -> None:
    existing = tmp_path / 'sample.txt'
    existing.write_text('alpha\nbeta\ngamma\n', encoding='utf-8')
    payload = _payload_with_tools(
        {'id': 'fs_patch', 'type': 'fs_apply_patch', 'params': {'root_path': str(tmp_path), 'allow_create': True, 'create_dirs': True, 'max_files': 8, 'max_bytes': 4096}},
    )
    namespace, _ = _compiled_tools_namespace(payload)
    patch_text = """--- a/sample.txt
+++ b/sample.txt
@@ -1,3 +1,3 @@
 alpha
-beta
+BETTA
 gamma
--- /dev/null
+++ b/nested/new.txt
@@ -0,0 +1 @@
+hello
"""
    result = _invoke_tool(namespace['fs_patch'], patch_text, 'preview')
    payload_out = json.loads(result)
    assert payload_out['status'] == 'preview'
    assert payload_out['mode'] == 'preview'
    assert len(payload_out['files_to_modify']) == 1
    assert len(payload_out['files_to_create']) == 1
    assert payload_out['files_rejected'] == []
    assert existing.read_text(encoding='utf-8') == 'alpha\nbeta\ngamma\n'
    assert not (tmp_path / 'nested').exists()


def test_patch_invalid_patch_is_explicit(tmp_path: Path) -> None:
    payload = _payload_with_tools(
        {'id': 'fs_patch', 'type': 'fs_apply_patch', 'params': {'root_path': str(tmp_path), 'allow_create': False, 'create_dirs': False, 'max_files': 8, 'max_bytes': 4096}},
    )
    namespace, _ = _compiled_tools_namespace(payload)
    result = _invoke_tool(namespace['fs_patch'], 'not a unified diff', 'preview')
    payload_out = json.loads(result)
    assert payload_out['status'] == 'blocked'
    assert payload_out['reason_code'] == 'invalid_patch'


def test_patch_root_escape_is_blocked_explicitly(tmp_path: Path) -> None:
    payload = _payload_with_tools(
        {'id': 'fs_patch', 'type': 'fs_apply_patch', 'params': {'root_path': str(tmp_path), 'allow_create': True, 'create_dirs': True, 'max_files': 8, 'max_bytes': 4096}},
    )
    namespace, _ = _compiled_tools_namespace(payload)
    patch_text = """--- /dev/null
+++ b/../escape.txt
@@ -0,0 +1 @@
+nope
"""
    result = _invoke_tool(namespace['fs_patch'], patch_text, 'preview')
    payload_out = json.loads(result)
    assert payload_out['status'] == 'blocked'
    assert payload_out['reason_code'] == 'root_escape_attempt'
    assert not (tmp_path.parent / 'escape.txt').exists()


def test_shell_blocked_state_is_explicit_when_not_armed() -> None:
    payload = _payload_with_tools(
        {'id': 'shell_tool', 'type': 'shell_command', 'params': {'root_path': '.', 'timeout_seconds': 10, 'allowed_commands': ['python']}},
        shell_enabled=False,
    )
    namespace, _ = _compiled_tools_namespace(payload)
    result = _invoke_tool(namespace['shell_tool'], 'python -V')
    payload_out = json.loads(result)
    assert payload_out['status'] == 'blocked'
    assert payload_out['reason_code'] == 'shell_not_armed'


def test_shell_command_not_allowed_is_explicit() -> None:
    payload = _payload_with_tools(
        {'id': 'shell_tool', 'type': 'shell_command', 'params': {'root_path': '.', 'timeout_seconds': 10, 'allowed_commands': ['pytest']}},
        shell_enabled=True,
    )
    namespace, _ = _compiled_tools_namespace(payload)
    result = _invoke_tool(namespace['shell_tool'], 'python -V')
    payload_out = json.loads(result)
    assert payload_out['status'] == 'blocked'
    assert payload_out['reason_code'] == 'shell_command_not_allowed'
