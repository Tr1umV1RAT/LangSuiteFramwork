from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'
BLOCKS = ROOT / 'client' / 'src' / 'components' / 'BlocksPanelContent.tsx'
SETTINGS = ROOT / 'client' / 'src' / 'components' / 'SettingsShell.tsx'
STORE = ROOT / 'client' / 'src' / 'store.ts'
WORKSPACE = ROOT / 'client' / 'src' / 'store' / 'workspace.ts'
CAPS = ROOT / 'client' / 'src' / 'capabilityMatrix.json'
WIN_LAUNCH = ROOT / 'qa' / 'windows' / 'Launch-LangSuite.ps1'
WIN_STOP = ROOT / 'qa' / 'windows' / 'Stop-LangSuite.ps1'
LINUX_STOP = ROOT / 'qa' / 'linux' / 'Stop-LangSuite.sh'
WIN_QA = ROOT / 'tests' / 'windows_qa_sanity.py'
LINUX_QA = ROOT / 'tests' / 'linux_qa_sanity.py'


def _load_module(path: Path, module_name: str):
    spec = importlib.util.spec_from_file_location(module_name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def test_frontend_hotfixes_are_present() -> None:
    state = STATE_PANEL.read_text(encoding='utf-8')
    assert "{'{{'}{variable.name}{'}}'}" in state

    blocks = BLOCKS.read_text(encoding='utf-8')
    assert "const railKey = (capability.rail && capability.rail in RAIL_LABELS ? capability.rail : 'trunk')" in blocks
    assert 'const railLabel = (RAIL_LABELS[railKey] || RAIL_LABELS.trunk)' in blocks
    assert 'RAIL_BADGE_CLASSES[railKey]' in blocks

    settings = SETTINGS.read_text(encoding='utf-8')
    assert 'const projectPersistence = buildProjectPersistenceSummary();' in settings

    store = STORE.read_text(encoding='utf-8')
    assert 'PromptStripMergeMode' in store

    workspace = WORKSPACE.read_text(encoding='utf-8')
    assert 'ModuleLibraryLineage' in workspace
    assert 'flatMap<ModulePromptAssignmentPreset>' in workspace


def test_capability_matrix_uses_only_known_rails_for_recent_fixups() -> None:
    text = CAPS.read_text(encoding='utf-8')
    for key in ('runtime_context_read', 'structured_output_extract', 'structured_output_router'):
        marker = f'"{key}": {{'
        assert marker in text
        tail = text.split(marker, 1)[1][:900]
        assert '"rail": "trunk"' in tail
    assert '"rail": "context"' not in text
    assert '"rail": "logic"' not in text


def test_windows_launcher_and_stop_hotfixes_are_present() -> None:
    launch = WIN_LAUNCH.read_text(encoding='utf-8')
    assert 'Write-Step ("[dry-run] Would run in {0}: {1}" -f $WorkingDirectory, $display) \'Yellow\'' in launch
    assert "return @{ FilePath = $npmCmd.Source; PrefixArgs = @() ; Display = 'npm.cmd' }" in launch
    assert "if ($extension -in @('.cmd', '.bat', '.exe'))" in launch

    stop = WIN_STOP.read_text(encoding='utf-8')
    assert 'node(.exe)? .*vite' in stop
    assert 'npm(.cmd)? run dev' in stop


def test_linux_stop_script_kills_process_groups_and_reports_truthfully() -> None:
    text = LINUX_STOP.read_text(encoding='utf-8')
    assert 'ps -eo pid=,pgid=,args=' in text
    assert 'node .*vite' in text
    assert 'Would stop process group' in text
    assert 'kill -TERM -- "-$pgid"' in text
    assert 'kill -KILL -- "-$pgid"' in text
    assert 'kill -0 "$pid"' in text
    assert 'Stopped process $pid' in text


def test_platform_sanity_wrappers_still_pass_after_cumulative_hotfixes() -> None:
    _load_module(WIN_QA, 'windows_qa_sanity_v951').run()
    _load_module(LINUX_QA, 'linux_qa_sanity_v951').run()
