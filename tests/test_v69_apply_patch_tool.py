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
from core.runtime_preflight import find_runtime_preflight_issues
from core.schemas import GraphPayload, RuntimeSettings, UIContext

CAP_MATRIX = ROOT / 'client' / 'src' / 'capabilityMatrix.json'
NODE_CONFIG = ROOT / 'client' / 'src' / 'nodeConfig.ts'
STORE_TS = ROOT / 'client' / 'src' / 'store.ts'
HYDRATION_TS = ROOT / 'client' / 'src' / 'store' / 'artifactHydration.ts'
BLOCKS_PANEL = ROOT / 'client' / 'src' / 'components' / 'BlocksPanelContent.tsx'


def _payload_with_tools(*tools: dict) -> GraphPayload:
    return GraphPayload(
        graph_id='v69_apply_patch',
        nodes=[],
        edges=[],
        tools=list(tools),
        ui_context=UIContext(runtime_settings=RuntimeSettings(shellExecutionEnabled=False)),
    )


def _invoke_tool(fn, *args):
    value = fn(*args)
    if asyncio.iscoroutine(value):
        return asyncio.run(value)
    return value


def _compiled_tools_namespace(payload: GraphPayload) -> tuple[dict, str]:
    buf = compile_graph(payload)
    with zipfile.ZipFile(buf) as zf:
        tools_py = zf.read('v69_apply_patch/tools.py').decode('utf-8')

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


def test_capability_matrix_marks_apply_patch_as_preview_and_apply_bounded_filesystem_mutation() -> None:
    matrix = json.loads(CAP_MATRIX.read_text(encoding='utf-8'))['nodeTypes']
    entry = matrix['tool_fs_apply_patch']
    assert entry['toolFamily'] == 'filesystem'
    assert entry['permissionLevel'] == 'mutating'
    assert entry['statefulness'] == 'stateless'
    assert 'Preview or apply' in entry['summary']
    assert 'preview+apply' in entry['quickProps']
    assert "mode='preview'|'apply'" in entry['compiledGraphRelation']


def test_runtime_preflight_rejects_invalid_max_files_for_apply_patch() -> None:
    payload = _payload_with_tools(
        {'id': 'fs_patch', 'type': 'fs_apply_patch', 'params': {'root_path': '.', 'allow_create': False, 'create_dirs': False, 'max_files': 0, 'max_bytes': 4096}},
    )
    issues = find_runtime_preflight_issues(payload)
    assert any(item['code'] == 'invalid_filesystem_max_files' for item in issues)


def test_compile_graph_renders_apply_patch_runtime_surface_with_review_contract() -> None:
    payload = _payload_with_tools(
        {'id': 'fs_patch', 'type': 'fs_apply_patch', 'params': {'root_path': '.', 'allow_create': False, 'create_dirs': False, 'max_files': 8, 'max_bytes': 4096}},
    )
    _, tools_py = _compiled_tools_namespace(payload)
    assert 'def fs_patch' in tools_py
    assert '_parse_unified_patch' in tools_py
    assert '_apply_unified_patch_to_text' in tools_py
    assert '_normalize_mutation_mode' in tools_py
    assert "mode: str = 'preview'" in tools_py
    assert "'status': status" in tools_py


def test_frontend_wires_apply_patch_surface_with_preview_apply_copy() -> None:
    node_config_text = NODE_CONFIG.read_text(encoding='utf-8')
    store_text = STORE_TS.read_text(encoding='utf-8')
    hydration_text = HYDRATION_TS.read_text(encoding='utf-8')
    blocks_text = BLOCKS_PANEL.read_text(encoding='utf-8')

    assert 'FS Apply Patch' in node_config_text
    assert 'Preview or apply a bounded unified diff patch under a local root path' in node_config_text
    assert "tool_fs_apply_patch: 'fs_apply_patch'" in store_text
    assert "fs_apply_patch: 'tool_fs_apply_patch'" in hydration_text
    assert 'Preview or apply one bounded unified diff patch under a local root path with touched-file and rejection guards.' in blocks_text


def test_compiled_apply_patch_tool_modifies_existing_file_in_apply_mode(tmp_path: Path) -> None:
    target = tmp_path / 'sample.txt'
    target.write_text('alpha\nbeta\ngamma\n', encoding='utf-8')
    payload = _payload_with_tools(
        {'id': 'fs_patch', 'type': 'fs_apply_patch', 'params': {'root_path': str(tmp_path), 'allow_create': False, 'create_dirs': False, 'max_files': 4, 'max_bytes': 4096}},
    )
    namespace, _ = _compiled_tools_namespace(payload)
    patch_text = """--- a/sample.txt
+++ b/sample.txt
@@ -1,3 +1,3 @@
 alpha
-beta
+BETTA
 gamma
"""
    result = _invoke_tool(namespace['fs_patch'], patch_text, 'apply')
    payload_out = json.loads(result)
    assert payload_out['operation'] == 'apply_patch'
    assert payload_out['status'] == 'applied'
    assert payload_out['mode'] == 'apply'
    assert payload_out['files_changed'] == 1
    assert payload_out['files'][0]['created'] is False
    assert payload_out['files'][0]['path'] == 'sample.txt'
    assert target.read_text(encoding='utf-8') == 'alpha\nBETTA\ngamma\n'


def test_compiled_apply_patch_tool_can_create_new_file_when_enabled_in_apply_mode(tmp_path: Path) -> None:
    payload = _payload_with_tools(
        {'id': 'fs_patch', 'type': 'fs_apply_patch', 'params': {'root_path': str(tmp_path), 'allow_create': True, 'create_dirs': True, 'max_files': 4, 'max_bytes': 4096}},
    )
    namespace, _ = _compiled_tools_namespace(payload)
    patch_text = """--- /dev/null
+++ b/nested/new.txt
@@ -0,0 +1,2 @@
+hello
+world
"""
    result = _invoke_tool(namespace['fs_patch'], patch_text, 'apply')
    payload_out = json.loads(result)
    created = tmp_path / 'nested' / 'new.txt'
    assert payload_out['status'] == 'applied'
    assert payload_out['files'][0]['created'] is True
    assert payload_out['files'][0]['path'] == 'nested/new.txt'
    assert created.read_text(encoding='utf-8') == 'hello\nworld\n'


def test_compiled_apply_patch_tool_blocks_create_when_disabled(tmp_path: Path) -> None:
    payload = _payload_with_tools(
        {'id': 'fs_patch', 'type': 'fs_apply_patch', 'params': {'root_path': str(tmp_path), 'allow_create': False, 'create_dirs': False, 'max_files': 4, 'max_bytes': 4096}},
    )
    namespace, _ = _compiled_tools_namespace(payload)
    patch_text = """--- /dev/null
+++ b/blocked.txt
@@ -0,0 +1 @@
+blocked
"""
    result = _invoke_tool(namespace['fs_patch'], patch_text, 'apply')
    payload_out = json.loads(result)
    assert payload_out['status'] == 'blocked'
    assert payload_out['reason_code'] == 'patch_creation_not_allowed'
    assert not (tmp_path / 'blocked.txt').exists()
