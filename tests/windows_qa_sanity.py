from __future__ import annotations
import importlib.util
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / 'qa' / 'windows'

REQUIRED_PS1 = [
    'Install-LangSuite.ps1',
    'Launch-LangSuite.ps1',
    'Stop-LangSuite.ps1',
    'HardReset-LangSuite.ps1',
    'Uninstall-LangSuite.ps1',
    'CreateShortcuts-LangSuite.ps1',
]
REQUIRED_BAT = ['install.bat', 'launch.bat', 'stop.bat', 'hard-reset.bat', 'uninstall.bat', 'create-shortcuts.bat', 'manager.bat']
REQUIRED_GUI = ['launcher_shell.py', 'LangSuiteLauncher.pyw']


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
    expect(QA.exists(), 'qa/windows directory missing')
    for name in REQUIRED_PS1:
        path = QA / name
        expect(path.exists(), f'missing {name}')
        text = path.read_text(encoding='utf-8')
        expect('Set-StrictMode -Version Latest' in text, f'{name} missing Set-StrictMode')
        expect("Join-Path $PSScriptRoot '..\\..'" in text, f'{name} missing relative project-root resolution')
        expect('-DryRun' in text or '[switch]$DryRun' in text, f'{name} missing dry-run support')
        expect('$LogPath' in text, f'{name} missing log-path support')
        expect('Write-Step' in text, f'{name} missing explicit step logging')
        expect('Initialize-LogFile' in text, f'{name} missing log-file initialization helper')
        expect(not re.search(r'[A-Z]:\\', text), f'{name} contains an absolute Windows drive path')

    install_text = (QA / 'Install-LangSuite.ps1').read_text(encoding='utf-8')
    expect('requirements.txt' in install_text, 'installer does not reference backend requirements')
    expect('npm ci' in install_text or 'npm install' in install_text, 'installer does not install frontend deps')
    expect('npm run build' in install_text, 'installer does not build frontend')
    expect('CreateShortcuts-LangSuite.ps1' in install_text, 'installer does not offer shortcut creation')

    launch_text = (QA / 'Launch-LangSuite.ps1').read_text(encoding='utf-8')
    expect("'uvicorn', 'main:app'" in launch_text or "'uvicorn', 'main:app'," in launch_text, 'launcher does not start backend')
    expect("'run', 'dev'" in launch_text or "'run', 'preview'" in launch_text, 'launcher does not start frontend')
    expect('--strictPort' in launch_text, 'launcher does not force a stable Vite port')
    expect('Wait-ForHttp' in launch_text, 'launcher does not wait for readiness')
    expect('Resolve-NpmLauncher' in launch_text, 'launcher does not resolve npm.cmd explicitly')
    expect('$npmCmd.Source' in launch_text or '$source' in launch_text, 'launcher does not resolve npm executable path for frontend launch')
    expect('Start-Process -FilePath $FilePath' in launch_text, 'launcher does not use direct process launching')
    expect('http://127.0.0.1' in launch_text, 'launcher does not expose a browser URL')

    stop_text = (QA / 'Stop-LangSuite.ps1').read_text(encoding='utf-8')
    expect('Stopping obvious local LangSuite processes' in stop_text, 'stop script does not announce process stop')
    expect('Win32_Process' in stop_text, 'stop script does not inspect Windows processes')
    expect('node(.exe)? .*vite' in stop_text, 'stop script does not cover node/vite descendants')

    uninstall_text = (QA / 'Uninstall-LangSuite.ps1').read_text(encoding='utf-8')
    expect('HardReset-LangSuite.ps1' in uninstall_text, 'uninstaller does not chain through hard reset')
    expect('.venv' in uninstall_text, 'uninstaller does not remove the virtual environment')
    expect('RemoveShortcuts' in uninstall_text, 'uninstaller does not support shortcut cleanup')

    shortcut_text = (QA / 'CreateShortcuts-LangSuite.ps1').read_text(encoding='utf-8')
    expect('WScript.Shell' in shortcut_text, 'shortcut script does not use WScript.Shell')
    expect('LangSuite Manager.lnk' in shortcut_text, 'shortcut script does not create manager shortcut')

    for name in REQUIRED_BAT:
        path = QA / name
        expect(path.exists(), f'missing {name}')
        text = path.read_text(encoding='utf-8').lower()
        if name != 'manager.bat':
            expect('powershell.exe' in text, f'{name} does not invoke powershell.exe')
        expect('.ps1' in text or 'langsuitelauncher.pyw' in text, f'{name} does not target the expected entrypoint')

    for name in REQUIRED_GUI:
        path = QA / name
        expect(path.exists(), f'missing {name}')

    launcher_module = load_module(QA / 'launcher_shell.py', 'launcher_shell_test')
    cmd = launcher_module.build_ps_command('Launch-LangSuite.ps1', '-DryRun')
    expect(cmd[0].lower() == 'powershell.exe', 'launcher shell does not target powershell.exe')
    expect(cmd[1:5] == ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File'], 'launcher shell command prelude changed unexpectedly')
    expect(str(QA / 'Launch-LangSuite.ps1') == cmd[5], 'launcher shell does not point at the expected script path')
    expect(cmd[-1] == '-DryRun', 'launcher shell did not preserve extra flags')

    flags = launcher_module.build_launch_flags(launcher_module.LaunchOptions(preview_build=True, no_browser=True, dry_run=True))
    expect(flags == ['-PreviewBuild', '-NoBrowser', '-DryRun'], 'launcher shell launch flags are out of order')

    install_flags = launcher_module.build_install_flags(dry_run=True, desktop_shortcut=True, start_menu_shortcut=True)
    expect(install_flags == ['-CreateDesktopShortcut', '-CreateStartMenuShortcut', '-DryRun'], 'launcher shell install flags are out of order')

    shortcut_flags = launcher_module.build_shortcut_flags(desktop=True, start_menu=True, dry_run=True)
    expect(shortcut_flags == ['-Desktop', '-StartMenu', '-DryRun'], 'launcher shell shortcut flags are out of order')

    readme = (QA / 'README.md').read_text(encoding='utf-8')
    expect('real local Windows management layer' in readme, 'README missing manager platform wording')
    expect('LangSuiteLauncher.pyw' in readme, 'README missing graphical manager mention')
    expect('CreateShortcuts-LangSuite.ps1' in readme, 'README missing shortcut script mention')
    expect('Stop-LangSuite.ps1' in readme, 'README missing stop script mention')
    expect('Validation status' in readme, 'README missing validation-status explanation')

    expect((ROOT / 'requirements.txt').exists(), 'backend requirements.txt missing')
    expect((ROOT / 'client' / 'package.json').exists(), 'client/package.json missing')
    expect((ROOT / 'main.py').exists(), 'main.py missing')


if __name__ == '__main__':
    run()
