from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
import json
import os
import queue
import shutil
import subprocess
import sys
import threading
import webbrowser
from typing import Sequence

QA_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = QA_DIR.parent
WINDOWS_QA_DIR = QA_DIR / 'windows'
LINUX_QA_DIR = QA_DIR / 'linux'
PREFS_PATH = QA_DIR / '.manager_prefs.json'
WINDOWS_README_PATH = WINDOWS_QA_DIR / 'README.md'
LINUX_README_PATH = LINUX_QA_DIR / 'README.md'
DEFAULT_FRONTEND_URL = 'http://127.0.0.1:5000'
POWERSHELL_EXE = 'powershell.exe'


@dataclass(frozen=True)
class LaunchOptions:
    preview_build: bool = False
    no_browser: bool = False
    dry_run: bool = False
    backend_port: int = 8000
    frontend_port: int = 5000
    wait_timeout_seconds: int = 35


@dataclass(frozen=True)
class InstallOptions:
    dry_run: bool = False
    desktop_shortcut: bool = False
    start_menu_shortcut: bool = False
    reinstall_node_modules: bool = False
    skip_frontend_build: bool = False
    skip_db_init: bool = False


@dataclass(frozen=True)
class ResetOptions:
    dry_run: bool = False
    remove_node_modules: bool = False
    clean_npm_cache: bool = False


@dataclass(frozen=True)
class UninstallOptions:
    dry_run: bool = False
    clean_npm_cache: bool = False
    remove_shortcuts: bool = True


@dataclass(frozen=True)
class ShortcutOptions:
    desktop: bool = True
    start_menu: bool = False
    dry_run: bool = False


@dataclass(frozen=True)
class ManagerPrefs:
    preview_build: bool = False
    no_browser: bool = False
    dry_run: bool = False
    desktop_shortcut: bool = True
    start_menu_shortcut: bool = False
    reinstall_node_modules: bool = False
    skip_frontend_build: bool = False
    skip_db_init: bool = False
    backend_port: int = 8000
    frontend_port: int = 5000
    wait_timeout_seconds: int = 35
    remove_node_modules: bool = False
    clean_npm_cache: bool = False
    remove_shortcuts: bool = True


def current_platform(force_platform: str | None = None) -> str:
    if force_platform:
        return force_platform
    return 'windows' if os.name == 'nt' else 'linux'


def readme_path(platform_name: str | None = None) -> Path:
    return WINDOWS_README_PATH if current_platform(platform_name) == 'windows' else LINUX_README_PATH


def shortcut_labels(platform_name: str | None = None) -> tuple[str, str]:
    if current_platform(platform_name) == 'windows':
        return ('Desktop shortcuts', 'Start-menu shortcuts')
    return ('Desktop shortcuts', 'Applications-menu shortcuts')


def build_ps_command(script_name: str, *flags: str) -> list[str]:
    return [
        POWERSHELL_EXE,
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', str(WINDOWS_QA_DIR / script_name),
        *flags,
    ]


def build_linux_sh_command(script_name: str, *flags: str) -> list[str]:
    return ['bash', str(LINUX_QA_DIR / script_name), *flags]


def build_launch_flags(options: LaunchOptions, platform_name: str | None = None) -> list[str]:
    is_windows = current_platform(platform_name) == 'windows'
    flags: list[str] = []
    if options.preview_build:
        flags.append('-PreviewBuild' if is_windows else '--preview-build')
    if options.no_browser:
        flags.append('-NoBrowser' if is_windows else '--no-browser')
    if options.dry_run:
        flags.append('-DryRun' if is_windows else '--dry-run')
    flags.extend((['-BackendPort', str(options.backend_port), '-FrontendPort', str(options.frontend_port), '-WaitTimeoutSeconds', str(options.wait_timeout_seconds)] if is_windows else ['--backend-port', str(options.backend_port), '--frontend-port', str(options.frontend_port), '--wait-timeout-seconds', str(options.wait_timeout_seconds)]))
    return flags


def build_install_flags(*, dry_run: bool, desktop_shortcut: bool = False, start_menu_shortcut: bool = False, reinstall_node_modules: bool = False, skip_frontend_build: bool = False, skip_db_init: bool = False, platform_name: str | None = None) -> list[str]:
    is_windows = current_platform(platform_name) == 'windows'
    flags: list[str] = []
    if reinstall_node_modules:
        flags.append('-ReinstallNodeModules' if is_windows else '--reinstall-node-modules')
    if skip_frontend_build:
        flags.append('-SkipFrontendBuild' if is_windows else '--skip-frontend-build')
    if skip_db_init:
        flags.append('-SkipDbInit' if is_windows else '--skip-db-init')
    if desktop_shortcut:
        flags.append('-CreateDesktopShortcut' if is_windows else '--create-desktop-shortcut')
    if start_menu_shortcut:
        flags.append('-CreateStartMenuShortcut' if is_windows else '--create-applications-shortcut')
    if dry_run:
        flags.append('-DryRun' if is_windows else '--dry-run')
    return flags


def build_shortcut_flags(*, desktop: bool, start_menu: bool, dry_run: bool, platform_name: str | None = None) -> list[str]:
    is_windows = current_platform(platform_name) == 'windows'
    flags: list[str] = []
    if desktop:
        flags.append('-Desktop' if is_windows else '--desktop')
    if start_menu:
        flags.append('-StartMenu' if is_windows else '--applications-menu')
    if dry_run:
        flags.append('-DryRun' if is_windows else '--dry-run')
    return flags


def build_reset_flags(*, remove_node_modules: bool, clean_npm_cache: bool, dry_run: bool, platform_name: str | None = None) -> list[str]:
    is_windows = current_platform(platform_name) == 'windows'
    flags: list[str] = []
    if remove_node_modules:
        flags.append('-RemoveNodeModules' if is_windows else '--remove-node-modules')
    if clean_npm_cache:
        flags.append('-CleanNpmCache' if is_windows else '--clean-npm-cache')
    if dry_run:
        flags.append('-DryRun' if is_windows else '--dry-run')
    return flags


def build_uninstall_flags(*, clean_npm_cache: bool, remove_shortcuts: bool, dry_run: bool, platform_name: str | None = None) -> list[str]:
    is_windows = current_platform(platform_name) == 'windows'
    flags: list[str] = []
    if clean_npm_cache:
        flags.append('-CleanNpmCache' if is_windows else '--clean-npm-cache')
    if remove_shortcuts:
        flags.append('-RemoveShortcuts' if is_windows else '--remove-shortcuts')
    if dry_run:
        flags.append('-DryRun' if is_windows else '--dry-run')
    return flags


def script_command(script_name: str, flags: Sequence[str] = (), *, platform_name: str | None = None) -> list[str]:
    if current_platform(platform_name) == 'windows':
        return build_ps_command(script_name, *flags)
    return build_linux_sh_command(script_name, *flags)


def launch_script(script_name: str, flags: Sequence[str] = (), *, capture_output: bool = False, platform_name: str | None = None) -> subprocess.Popen[str]:
    platform_name = current_platform(platform_name)
    kwargs = dict(cwd=str(PROJECT_ROOT), text=True)
    if capture_output:
        kwargs['stdout'] = subprocess.PIPE
        kwargs['stderr'] = subprocess.STDOUT
    command = script_command(script_name, flags, platform_name=platform_name)
    if platform_name == 'windows' and hasattr(subprocess, 'CREATE_NO_WINDOW'):
        kwargs['creationflags'] = subprocess.CREATE_NO_WINDOW
    return subprocess.Popen(command, **kwargs)


def load_prefs() -> ManagerPrefs:
    try:
        data = json.loads(PREFS_PATH.read_text(encoding='utf-8'))
    except Exception:
        return ManagerPrefs()
    defaults = asdict(ManagerPrefs())
    merged = {**defaults, **data}
    return ManagerPrefs(**merged)


def save_prefs(prefs: ManagerPrefs) -> None:
    PREFS_PATH.write_text(json.dumps(asdict(prefs), indent=2), encoding='utf-8')


def validate_environment(platform_name: str | None = None) -> list[str]:
    platform_name = current_platform(platform_name)
    readme = readme_path(platform_name)
    lines = [
        f'Project root: {PROJECT_ROOT}',
        f'QA directory: {QA_DIR}',
        f'Platform profile: {platform_name}',
        f'Readme present: {readme.exists()}',
        f'Backend main.py present: {(PROJECT_ROOT / "main.py").exists()}',
        f'Client package.json present: {(PROJECT_ROOT / "client" / "package.json").exists()}',
        f'Backend requirements.txt present: {(PROJECT_ROOT / "requirements.txt").exists()}',
        f'Python executable present in PATH: {bool(shutil.which("python3") or shutil.which("python") or shutil.which("py"))}',
        f'npm present in PATH: {bool(shutil.which("npm") or shutil.which("npm.cmd"))}',
    ]
    if platform_name == 'windows':
        lines.extend([
            f'Windows install script present: {(WINDOWS_QA_DIR / "Install-LangSuite.ps1").exists()}',
            f'Windows launch script present: {(WINDOWS_QA_DIR / "Launch-LangSuite.ps1").exists()}',
            f'Windows stop script present: {(WINDOWS_QA_DIR / "Stop-LangSuite.ps1").exists()}',
            f'Running on Windows: {os.name == "nt"}',
        ])
    else:
        lines.extend([
            f'Linux install script present: {(LINUX_QA_DIR / "Install-LangSuite.sh").exists()}',
            f'Linux launch script present: {(LINUX_QA_DIR / "Launch-LangSuite.sh").exists()}',
            f'Linux stop script present: {(LINUX_QA_DIR / "Stop-LangSuite.sh").exists()}',
            f'xdg-open present in PATH: {bool(shutil.which("xdg-open"))}',
        ])
    return lines


def launch_gui(force_platform: str | None = None) -> None:
    import tkinter as tk
    from tkinter import ttk

    platform_name = current_platform(force_platform)
    readme = readme_path(platform_name)
    root = tk.Tk()
    root.title(f'LangSuite {platform_name.capitalize()} Manager')
    root.geometry('1080x760')
    root.minsize(960, 680)

    prefs = load_prefs()
    preview_var = tk.BooleanVar(value=prefs.preview_build)
    no_browser_var = tk.BooleanVar(value=prefs.no_browser)
    dry_run_var = tk.BooleanVar(value=prefs.dry_run)
    desktop_shortcut_var = tk.BooleanVar(value=prefs.desktop_shortcut)
    start_menu_shortcut_var = tk.BooleanVar(value=prefs.start_menu_shortcut)
    reinstall_node_modules_var = tk.BooleanVar(value=prefs.reinstall_node_modules)
    skip_frontend_build_var = tk.BooleanVar(value=prefs.skip_frontend_build)
    skip_db_init_var = tk.BooleanVar(value=prefs.skip_db_init)
    backend_port_var = tk.StringVar(value=str(prefs.backend_port))
    frontend_port_var = tk.StringVar(value=str(prefs.frontend_port))
    wait_timeout_var = tk.StringVar(value=str(prefs.wait_timeout_seconds))
    remove_node_modules_var = tk.BooleanVar(value=prefs.remove_node_modules)
    clean_npm_cache_var = tk.BooleanVar(value=prefs.clean_npm_cache)
    remove_shortcuts_var = tk.BooleanVar(value=prefs.remove_shortcuts)

    platform_label = 'Windows PowerShell-backed' if platform_name == 'windows' else 'Debian/Linux shell-backed'
    status_var = tk.StringVar(value=f'Real local {platform_label} manager for LangSuite: install, launch, stop, reset, uninstall, shortcuts, and log capture. Honest scope only.')
    log_queue: queue.Queue[str] = queue.Queue()

    def push_log(line: str) -> None:
        log_queue.put(line.rstrip('\n'))

    def flush_log_queue() -> None:
        try:
            while True:
                line = log_queue.get_nowait()
                log_text.configure(state='normal')
                log_text.insert('end', line + '\n')
                log_text.see('end')
                log_text.configure(state='disabled')
        except queue.Empty:
            pass
        root.after(120, flush_log_queue)

    def parse_int(var: tk.StringVar, default: int) -> int:
        try:
            value = int(var.get().strip())
        except Exception:
            return default
        return value

    def current_prefs_obj() -> ManagerPrefs:
        return ManagerPrefs(
            preview_build=preview_var.get(),
            no_browser=no_browser_var.get(),
            dry_run=dry_run_var.get(),
            desktop_shortcut=desktop_shortcut_var.get(),
            start_menu_shortcut=start_menu_shortcut_var.get(),
            reinstall_node_modules=reinstall_node_modules_var.get(),
            skip_frontend_build=skip_frontend_build_var.get(),
            skip_db_init=skip_db_init_var.get(),
            backend_port=parse_int(backend_port_var, 8000),
            frontend_port=parse_int(frontend_port_var, 5000),
            wait_timeout_seconds=parse_int(wait_timeout_var, 35),
            remove_node_modules=remove_node_modules_var.get(),
            clean_npm_cache=clean_npm_cache_var.get(),
            remove_shortcuts=remove_shortcuts_var.get(),
        )

    def persist_prefs(*_args: object) -> None:
        save_prefs(current_prefs_obj())

    for var in (
        preview_var, no_browser_var, dry_run_var, desktop_shortcut_var, start_menu_shortcut_var,
        reinstall_node_modules_var, skip_frontend_build_var, skip_db_init_var,
        backend_port_var, frontend_port_var, wait_timeout_var,
        remove_node_modules_var, clean_npm_cache_var, remove_shortcuts_var,
    ):
        var.trace_add('write', persist_prefs)

    def run_script(script_name: str, flags: Sequence[str], friendly_name: str) -> None:
        command = ' '.join(script_command(script_name, flags, platform_name=platform_name))
        status_var.set(f'{friendly_name} started.')
        push_log(f'>>> {friendly_name}')
        push_log(command)

        def worker() -> None:
            try:
                proc = launch_script(script_name, flags, capture_output=True, platform_name=platform_name)
                if proc.stdout is not None:
                    for line in proc.stdout:
                        push_log(line)
                return_code = proc.wait()
                status = 'completed' if return_code == 0 else f'failed (exit {return_code})'
                push_log(f'<<< {friendly_name} {status}')
                status_var.set(f'{friendly_name} {status}.')
            except Exception as exc:
                push_log(f'!! {friendly_name} error: {exc}')
                status_var.set(f'{friendly_name} failed to start.')

        threading.Thread(target=worker, daemon=True).start()

    def do_preflight() -> None:
        push_log('>>> Preflight scan')
        for line in validate_environment(platform_name):
            push_log(line)
        status_var.set('Preflight scan written to the log.')

    def do_install() -> None:
        flags = build_install_flags(
            dry_run=dry_run_var.get(),
            desktop_shortcut=desktop_shortcut_var.get(),
            start_menu_shortcut=start_menu_shortcut_var.get(),
            reinstall_node_modules=reinstall_node_modules_var.get(),
            skip_frontend_build=skip_frontend_build_var.get(),
            skip_db_init=skip_db_init_var.get(),
            platform_name=platform_name,
        )
        script_name = 'Install-LangSuite.ps1' if platform_name == 'windows' else 'Install-LangSuite.sh'
        run_script(script_name, flags, 'Install / Setup')

    def do_launch() -> None:
        flags = build_launch_flags(LaunchOptions(
            preview_build=preview_var.get(),
            no_browser=no_browser_var.get(),
            dry_run=dry_run_var.get(),
            backend_port=parse_int(backend_port_var, 8000),
            frontend_port=parse_int(frontend_port_var, 5000),
            wait_timeout_seconds=parse_int(wait_timeout_var, 35),
        ), platform_name=platform_name)
        script_name = 'Launch-LangSuite.ps1' if platform_name == 'windows' else 'Launch-LangSuite.sh'
        run_script(script_name, flags, 'Launch')

    def do_stop() -> None:
        flags = ['-DryRun'] if platform_name == 'windows' and dry_run_var.get() else (['--dry-run'] if dry_run_var.get() else [])
        script_name = 'Stop-LangSuite.ps1' if platform_name == 'windows' else 'Stop-LangSuite.sh'
        run_script(script_name, flags, 'Stop app')

    def do_reset() -> None:
        flags = build_reset_flags(
            remove_node_modules=remove_node_modules_var.get(),
            clean_npm_cache=clean_npm_cache_var.get(),
            dry_run=dry_run_var.get(),
            platform_name=platform_name,
        )
        script_name = 'HardReset-LangSuite.ps1' if platform_name == 'windows' else 'HardReset-LangSuite.sh'
        run_script(script_name, flags, 'Hard reset')

    def do_uninstall() -> None:
        flags = build_uninstall_flags(
            clean_npm_cache=clean_npm_cache_var.get(),
            remove_shortcuts=remove_shortcuts_var.get(),
            dry_run=dry_run_var.get(),
            platform_name=platform_name,
        )
        script_name = 'Uninstall-LangSuite.ps1' if platform_name == 'windows' else 'Uninstall-LangSuite.sh'
        run_script(script_name, flags, 'Uninstall / Cleanup')

    def do_shortcuts() -> None:
        flags = build_shortcut_flags(
            desktop=desktop_shortcut_var.get(),
            start_menu=start_menu_shortcut_var.get(),
            dry_run=dry_run_var.get(),
            platform_name=platform_name,
        )
        script_name = 'CreateShortcuts-LangSuite.ps1' if platform_name == 'windows' else 'CreateShortcuts-LangSuite.sh'
        run_script(script_name, flags, 'Create shortcuts')

    def open_readme() -> None:
        try:
            if os.name == 'nt':
                os.startfile(str(readme))  # type: ignore[attr-defined]
            else:
                webbrowser.open(readme.as_uri())
            status_var.set('Opened the platform README.')
        except Exception as exc:
            push_log(f'!! Could not open README: {exc}')

    def open_project_root() -> None:
        try:
            if os.name == 'nt':
                os.startfile(str(PROJECT_ROOT))  # type: ignore[attr-defined]
            else:
                webbrowser.open(PROJECT_ROOT.as_uri())
            status_var.set('Opened the project root.')
        except Exception as exc:
            push_log(f'!! Could not open project root: {exc}')

    def open_browser() -> None:
        webbrowser.open(f'http://127.0.0.1:{parse_int(frontend_port_var, 5000)}')
        status_var.set(f'Browser opened at http://127.0.0.1:{parse_int(frontend_port_var, 5000)}.')

    header = ttk.Frame(root, padding=14)
    header.pack(fill='x')
    ttk.Label(header, text=f'LangSuite {platform_name.capitalize()} Manager', font=('Segoe UI', 14, 'bold')).pack(anchor='w')
    ttk.Label(
        header,
        text='Real local installer-manager for this repo: install, launch, stop, reset, uninstall, shortcuts, and log capture. Honest scope only; no fake packaging empire.',
        wraplength=1020,
        justify='left',
    ).pack(anchor='w', pady=(5, 0))

    body = ttk.Frame(root, padding=(14, 0, 14, 14))
    body.pack(fill='both', expand=True)
    body.columnconfigure(0, weight=0)
    body.columnconfigure(1, weight=1)
    body.rowconfigure(0, weight=1)

    controls = ttk.Frame(body)
    controls.grid(row=0, column=0, sticky='nsw', padx=(0, 14))

    launch_box = ttk.LabelFrame(controls, text='Launch options', padding=10)
    launch_box.pack(fill='x')
    ttk.Checkbutton(launch_box, text='Use built frontend preview server instead of default dev server', variable=preview_var).pack(anchor='w')
    ttk.Checkbutton(launch_box, text='Do not open browser automatically', variable=no_browser_var).pack(anchor='w', pady=(4, 0))
    ttk.Checkbutton(launch_box, text='Dry run only', variable=dry_run_var).pack(anchor='w', pady=(4, 0))
    ports = ttk.Frame(launch_box)
    ports.pack(fill='x', pady=(8, 0))
    ttk.Label(ports, text='Backend port').grid(row=0, column=0, sticky='w')
    ttk.Entry(ports, textvariable=backend_port_var, width=8).grid(row=0, column=1, sticky='w', padx=(8, 0))
    ttk.Label(ports, text='Frontend port').grid(row=1, column=0, sticky='w', pady=(6, 0))
    ttk.Entry(ports, textvariable=frontend_port_var, width=8).grid(row=1, column=1, sticky='w', padx=(8, 0), pady=(6, 0))
    ttk.Label(ports, text='Wait timeout (s)').grid(row=2, column=0, sticky='w', pady=(6, 0))
    ttk.Entry(ports, textvariable=wait_timeout_var, width=8).grid(row=2, column=1, sticky='w', padx=(8, 0), pady=(6, 0))

    install_box = ttk.LabelFrame(controls, text='Install options', padding=10)
    install_box.pack(fill='x', pady=(12, 0))
    ttk.Checkbutton(install_box, text='Reinstall frontend node_modules', variable=reinstall_node_modules_var).pack(anchor='w')
    ttk.Checkbutton(install_box, text='Skip frontend build', variable=skip_frontend_build_var).pack(anchor='w', pady=(4, 0))
    ttk.Checkbutton(install_box, text='Skip database initialization', variable=skip_db_init_var).pack(anchor='w', pady=(4, 0))

    shortcut_box = ttk.LabelFrame(controls, text='Shortcut options', padding=10)
    shortcut_box.pack(fill='x', pady=(12, 0))
    desktop_label, start_menu_label = shortcut_labels(platform_name)
    ttk.Checkbutton(shortcut_box, text=desktop_label, variable=desktop_shortcut_var).pack(anchor='w')
    ttk.Checkbutton(shortcut_box, text=start_menu_label, variable=start_menu_shortcut_var).pack(anchor='w', pady=(4, 0))
    ttk.Checkbutton(shortcut_box, text='Remove shortcuts during uninstall', variable=remove_shortcuts_var).pack(anchor='w', pady=(8, 0))

    cleanup_box = ttk.LabelFrame(controls, text='Reset / uninstall options', padding=10)
    cleanup_box.pack(fill='x', pady=(12, 0))
    ttk.Checkbutton(cleanup_box, text='Remove node_modules during hard reset', variable=remove_node_modules_var).pack(anchor='w')
    ttk.Checkbutton(cleanup_box, text='Clean npm cache during reset/uninstall', variable=clean_npm_cache_var).pack(anchor='w', pady=(4, 0))

    action_box = ttk.LabelFrame(controls, text='Actions', padding=10)
    action_box.pack(fill='x', pady=(12, 0))
    buttons = [
        ('Preflight scan', do_preflight),
        ('Install / Setup', do_install),
        ('Launch', do_launch),
        ('Stop app', do_stop),
        ('Create shortcuts', do_shortcuts),
        ('Hard reset', do_reset),
        ('Uninstall / Cleanup', do_uninstall),
        ('Open browser', open_browser),
        ('Open README', open_readme),
        ('Open project root', open_project_root),
    ]
    for idx, (label, callback) in enumerate(buttons):
        ttk.Button(action_box, text=label, command=callback).grid(row=idx, column=0, sticky='ew', pady=3)
    action_box.columnconfigure(0, weight=1)

    log_frame = ttk.LabelFrame(body, text='Activity log', padding=10)
    log_frame.grid(row=0, column=1, sticky='nsew')
    log_frame.rowconfigure(0, weight=1)
    log_frame.columnconfigure(0, weight=1)

    log_text = tk.Text(log_frame, height=28, wrap='word', font=('Consolas', 10), state='disabled', background='#0c1224', foreground='#d7def0', insertbackground='#d7def0')
    log_text.grid(row=0, column=0, sticky='nsew')
    scroll = ttk.Scrollbar(log_frame, orient='vertical', command=log_text.yview)
    scroll.grid(row=0, column=1, sticky='ns')
    log_text.configure(yscrollcommand=scroll.set)

    footer = ttk.Frame(root, padding=(14, 0, 14, 12))
    footer.pack(fill='x')
    ttk.Label(footer, textvariable=status_var, wraplength=1020, justify='left').pack(anchor='w')

    push_log(f'LangSuite {platform_name.capitalize()} Manager ready.')
    push_log('Use Preflight scan first on a new machine. The truthful default launch path is backend + frontend dev server on a fixed localhost port.')
    root.after(120, flush_log_queue)
    root.mainloop()


__all__ = [
    'LaunchOptions', 'InstallOptions', 'ResetOptions', 'UninstallOptions', 'ShortcutOptions', 'ManagerPrefs',
    'build_ps_command', 'build_linux_sh_command', 'build_launch_flags', 'build_install_flags',
    'build_shortcut_flags', 'build_reset_flags', 'build_uninstall_flags', 'script_command', 'launch_script',
    'load_prefs', 'save_prefs', 'validate_environment', 'launch_gui', 'current_platform', 'PROJECT_ROOT',
    'QA_DIR', 'WINDOWS_QA_DIR', 'LINUX_QA_DIR', 'WINDOWS_README_PATH', 'LINUX_README_PATH', 'DEFAULT_FRONTEND_URL',
]
