from __future__ import annotations

import importlib.util
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WINDOWS_QA = ROOT / 'tests' / 'windows_qa_sanity.py'
LINUX_QA = ROOT / 'tests' / 'linux_qa_sanity.py'
CORE = ROOT / 'qa' / 'launcher_core.py'


def _load_module(path: Path, module_name: str):
    spec = importlib.util.spec_from_file_location(module_name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')


def _make_linux_fixture(tmp_path: Path) -> Path:
    repo = tmp_path / 'repo'
    shutil.copytree(ROOT / 'qa', repo / 'qa')
    for name in ['LangSuiteLauncher.py', 'LangSuiteLauncher.pyw', 'LangSuiteLauncher.sh', 'LangSuiteLauncher.bat', 'requirements.txt', 'main.py']:
        shutil.copy2(ROOT / name, repo / name)
    _write(repo / 'client' / 'package.json', '{"name":"langsuite-test"}')
    _write(repo / 'client' / 'package-lock.json', '{}')
    (repo / 'client' / 'node_modules').mkdir(parents=True, exist_ok=True)
    (repo / 'client' / 'dist').mkdir(parents=True, exist_ok=True)
    (repo / '.venv' / 'bin').mkdir(parents=True, exist_ok=True)
    python_real = shutil.which('python3') or shutil.which('python')
    assert python_real is not None
    os.symlink(python_real, repo / '.venv' / 'bin' / 'python')
    return repo


def _run(cmd: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env['HOME'] = str(cwd / 'fake_home')
    (cwd / 'fake_home').mkdir(parents=True, exist_ok=True)
    return subprocess.run(cmd, cwd=cwd, env=env, text=True, capture_output=True, check=True)


def test_windows_and_linux_structural_sanity_wrappers_pass() -> None:
    _load_module(WINDOWS_QA, 'windows_qa_sanity_v95').run()
    _load_module(LINUX_QA, 'linux_qa_sanity_v95').run()


def test_cross_platform_root_and_qa_launchers_exist_and_import() -> None:
    core = _load_module(CORE, 'launcher_core_v95')
    assert (ROOT / 'LangSuiteLauncher.py').exists()
    assert (ROOT / 'qa' / 'LangSuiteLauncher.py').exists()
    assert core.current_platform('windows') == 'windows'
    assert core.current_platform('linux') == 'linux'
    assert core.readme_path('linux').name == 'README.md'


def test_linux_install_launch_stop_reset_uninstall_shortcuts_dry_run_all_work() -> None:
    with tempfile.TemporaryDirectory() as td:
        repo = _make_linux_fixture(Path(td))
        qa_linux = repo / 'qa' / 'linux'
        common_log = 'qa/logs/dryrun.txt'

        result = _run(['bash', str(qa_linux / 'Install-LangSuite.sh'), '--reinstall-node-modules', '--skip-frontend-build', '--skip-db-init', '--create-desktop-shortcut', '--create-applications-shortcut', '--dry-run', '--log-path', common_log], repo)
        assert 'Dry-run mode only validated paths, prerequisites, and intended commands.' in result.stdout

        result = _run(['bash', str(qa_linux / 'Launch-LangSuite.sh'), '--preview-build', '--no-browser', '--dry-run', '--backend-port', '8100', '--frontend-port', '5100', '--wait-timeout-seconds', '15', '--log-path', common_log], repo)
        assert 'Dry-run mode only validated launch prerequisites and command composition.' in result.stdout
        assert 'http://127.0.0.1:5100' in result.stdout

        result = _run(['bash', str(qa_linux / 'Stop-LangSuite.sh'), '--dry-run', '--log-path', common_log], repo)
        assert 'Dry-run mode only described the stop plan.' in result.stdout or 'No obvious LangSuite backend/frontend processes were found.' in result.stdout

        result = _run(['bash', str(qa_linux / 'HardReset-LangSuite.sh'), '--remove-node-modules', '--clean-npm-cache', '--dry-run', '--log-path', common_log], repo)
        assert 'Dry-run mode only described the cleanup plan.' in result.stdout

        result = _run(['bash', str(qa_linux / 'CreateShortcuts-LangSuite.sh'), '--desktop', '--applications-menu', '--dry-run', '--log-path', common_log], repo)
        assert 'Dry-run mode only validated the shortcut plan.' in result.stdout

        result = _run(['bash', str(qa_linux / 'Uninstall-LangSuite.sh'), '--clean-npm-cache', '--remove-shortcuts', '--dry-run', '--log-path', common_log], repo)
        assert 'Dry-run mode only described uninstall cleanup.' in result.stdout


def test_linux_shortcut_script_creates_real_desktop_files() -> None:
    with tempfile.TemporaryDirectory() as td:
        repo = _make_linux_fixture(Path(td))
        qa_linux = repo / 'qa' / 'linux'
        env = os.environ.copy()
        env['HOME'] = str(repo / 'fake_home')
        (repo / 'fake_home' / 'Desktop').mkdir(parents=True, exist_ok=True)
        subprocess.run(['bash', str(qa_linux / 'CreateShortcuts-LangSuite.sh'), '--desktop', '--applications-menu'], cwd=repo, env=env, text=True, capture_output=True, check=True)
        desktop_manager = repo / 'fake_home' / 'Desktop' / 'LangSuite Manager.desktop'
        apps_manager = repo / 'fake_home' / '.local' / 'share' / 'applications' / 'LangSuite Manager.desktop'
        apps_launch = repo / 'fake_home' / '.local' / 'share' / 'applications' / 'LangSuite Launch.desktop'
        assert desktop_manager.exists()
        assert apps_manager.exists()
        assert apps_launch.exists()
        assert 'LangSuiteLauncher.sh' in desktop_manager.read_text(encoding='utf-8')
        assert 'Launch-LangSuite.sh' in apps_launch.read_text(encoding='utf-8')
