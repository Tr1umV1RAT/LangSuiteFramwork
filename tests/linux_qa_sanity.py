from __future__ import annotations

import importlib.util
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / 'qa' / 'linux'
ROOT_LAUNCHERS = ['LangSuiteLauncher.py', 'LangSuiteLauncher.pyw', 'LangSuiteLauncher.sh', 'LangSuiteLauncher.bat']
REQUIRED_SH = [
    'Install-LangSuite.sh',
    'Launch-LangSuite.sh',
    'Stop-LangSuite.sh',
    'HardReset-LangSuite.sh',
    'Uninstall-LangSuite.sh',
    'CreateShortcuts-LangSuite.sh',
]


def expect(cond: bool, msg: str):
    if not cond:
        raise AssertionError(msg)


def load_module(path: Path, module_name: str):
    spec = importlib.util.spec_from_file_location(module_name, path)
    expect(spec is not None and spec.loader is not None, f'could not load spec for {path.name}')
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def run():
    expect(QA.exists(), 'qa/linux directory missing')
    for name in REQUIRED_SH:
        path = QA / name
        expect(path.exists(), f'missing {name}')
        text = path.read_text(encoding='utf-8')
        expect('set -euo pipefail' in text, f'{name} missing strict shell mode')
        expect('dirname "${BASH_SOURCE[0]}"' in text, f'{name} missing relative project-root resolution')
        expect('--dry-run' in text or 'DRY_RUN=0' in text, f'{name} missing dry-run support')
        expect('LOG_PATH' in text, f'{name} missing log-path support')
        expect('write_step' in text or 'write-step' in text.lower(), f'{name} missing explicit step logging')
        expect(not re.search(r'/home/[^/]+/', text), f'{name} contains a user-home absolute path literal')

    install_text = (QA / 'Install-LangSuite.sh').read_text(encoding='utf-8')
    expect('requirements.txt' in install_text, 'installer does not reference backend requirements')
    expect('npm ci' in install_text or 'npm install' in install_text, 'installer does not install frontend deps')
    expect('npm run build' in install_text, 'installer does not build frontend')
    expect('CreateShortcuts-LangSuite.sh' in install_text, 'installer does not offer shortcut creation')
    expect('ensure_virtualenv' in install_text, 'installer does not repair incomplete virtual environments')
    expect('pip --version' in install_text, 'installer does not verify pip in the virtual environment')

    launch_text = (QA / 'Launch-LangSuite.sh').read_text(encoding='utf-8')
    expect('uvicorn main:app' in launch_text, 'launcher does not start backend')
    expect('npm run dev' in launch_text or 'npm run preview' in launch_text, 'launcher does not start frontend')
    expect('--strictPort' in launch_text, 'launcher does not force a stable Vite port')
    expect('wait_for_http' in launch_text, 'launcher does not wait for readiness')
    expect('nohup' in launch_text, 'launcher does not background real local processes')
    expect('http://127.0.0.1' in launch_text, 'launcher does not expose a browser URL')

    stop_text = (QA / 'Stop-LangSuite.sh').read_text(encoding='utf-8')
    expect('Stopping obvious local LangSuite processes' in stop_text, 'stop script does not announce process stop')
    expect('ps -eo' in stop_text, 'stop script does not inspect local processes')
    expect('node .*vite' in stop_text, 'stop script does not cover node/vite descendants')
    expect('collect_descendants' in stop_text, 'stop script does not collect descendant processes')
    expect('collect_protected_ancestors' in stop_text, 'stop script does not protect its own ancestor processes')
    expect('kill -TERM --' not in stop_text, 'stop script still kills whole process groups')

    hard_reset_text = (QA / 'HardReset-LangSuite.sh').read_text(encoding='utf-8')
    expect('-path "$VENV_DIR" -prune' in hard_reset_text, 'hard reset still descends into .venv __pycache__ trees')

    uninstall_text = (QA / 'Uninstall-LangSuite.sh').read_text(encoding='utf-8')
    expect('HardReset-LangSuite.sh' in uninstall_text, 'uninstaller does not chain through hard reset')
    expect('.venv' in uninstall_text, 'uninstaller does not remove the virtual environment')
    expect('--remove-shortcuts' in uninstall_text, 'uninstaller does not support shortcut cleanup')

    shortcut_text = (QA / 'CreateShortcuts-LangSuite.sh').read_text(encoding='utf-8')
    expect('[Desktop Entry]' in shortcut_text, 'shortcut script does not create desktop entries')
    expect('LangSuite Manager.desktop' in shortcut_text, 'shortcut script does not create manager shortcut')

    for name in ROOT_LAUNCHERS:
        path = ROOT / name
        expect(path.exists(), f'missing root launcher {name}')

    core_module = load_module(ROOT / 'qa' / 'launcher_core.py', 'launcher_core_test')
    cmd = core_module.build_linux_sh_command('Launch-LangSuite.sh', '--dry-run')
    expect(cmd[0] == 'bash', 'linux launcher shell does not target bash')
    expect(str(QA / 'Launch-LangSuite.sh') == cmd[1], 'linux launcher shell does not point at the expected script path')
    expect(cmd[-1] == '--dry-run', 'linux launcher shell did not preserve extra flags')

    flags = core_module.build_launch_flags(core_module.LaunchOptions(preview_build=True, no_browser=True, dry_run=True), platform_name='linux')
    expect(flags[:3] == ['--preview-build', '--no-browser', '--dry-run'], 'launcher core linux launch flags are out of order')
    expect('--backend-port' in flags and '--frontend-port' in flags and '--wait-timeout-seconds' in flags, 'launcher core linux launch flags are missing port/time parameters')

    install_flags = core_module.build_install_flags(dry_run=True, desktop_shortcut=True, start_menu_shortcut=True, reinstall_node_modules=True, skip_frontend_build=True, skip_db_init=True, platform_name='linux')
    expect(install_flags == ['--reinstall-node-modules', '--skip-frontend-build', '--skip-db-init', '--create-desktop-shortcut', '--create-applications-shortcut', '--dry-run'], 'launcher core linux install flags are out of order')

    shortcut_flags = core_module.build_shortcut_flags(desktop=True, start_menu=True, dry_run=True, platform_name='linux')
    expect(shortcut_flags == ['--desktop', '--applications-menu', '--dry-run'], 'launcher core linux shortcut flags are out of order')

    readme = (QA / 'README.md').read_text(encoding='utf-8')
    expect('real local Debian/Linux management layer' in readme, 'README missing manager platform wording')
    expect('LangSuiteLauncher.py' in readme, 'README missing graphical manager mention')
    expect('CreateShortcuts-LangSuite.sh' in readme, 'README missing shortcut script mention')
    expect('Stop-LangSuite.sh' in readme, 'README missing stop script mention')
    expect('Validation status' in readme, 'README missing validation-status explanation')

    expect((ROOT / 'requirements.txt').exists(), 'backend requirements.txt missing')
    expect((ROOT / 'client' / 'package.json').exists(), 'client/package.json missing')
    expect((ROOT / 'main.py').exists(), 'main.py missing')


if __name__ == '__main__':
    run()
