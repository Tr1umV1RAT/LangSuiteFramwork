from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
import json
import os
import queue
import subprocess
import threading
import webbrowser
from typing import Sequence

QA_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = QA_DIR.parents[1]
POWERSHELL_EXE = 'powershell.exe'
PREFS_PATH = QA_DIR / '.manager_prefs.json'
README_PATH = QA_DIR / 'README.md'
DEFAULT_FRONTEND_URL = 'http://127.0.0.1:5000'


@dataclass(frozen=True)
class LaunchOptions:
    preview_build: bool = False
    no_browser: bool = False
    dry_run: bool = False


@dataclass(frozen=True)
class ManagerPrefs:
    preview_build: bool = False
    no_browser: bool = False
    dry_run: bool = False


def build_ps_command(script_name: str, *flags: str) -> list[str]:
    return [
        POWERSHELL_EXE,
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', str(QA_DIR / script_name),
        *flags,
    ]


def build_launch_flags(options: LaunchOptions) -> list[str]:
    flags: list[str] = []
    if options.preview_build:
        flags.append('-PreviewBuild')
    if options.no_browser:
        flags.append('-NoBrowser')
    if options.dry_run:
        flags.append('-DryRun')
    return flags


def build_install_flags(*, dry_run: bool, desktop_shortcut: bool = False, start_menu_shortcut: bool = False) -> list[str]:
    flags: list[str] = []
    if desktop_shortcut:
        flags.append('-CreateDesktopShortcut')
    if start_menu_shortcut:
        flags.append('-CreateStartMenuShortcut')
    if dry_run:
        flags.append('-DryRun')
    return flags


def build_shortcut_flags(*, desktop: bool, start_menu: bool, dry_run: bool) -> list[str]:
    flags: list[str] = []
    if desktop:
        flags.append('-Desktop')
    if start_menu:
        flags.append('-StartMenu')
    if dry_run:
        flags.append('-DryRun')
    return flags


def launch_powershell(script_name: str, flags: Sequence[str] = (), *, capture_output: bool = False) -> subprocess.Popen[str]:
    kwargs = dict(cwd=str(PROJECT_ROOT), text=True)
    if capture_output:
        kwargs['stdout'] = subprocess.PIPE
        kwargs['stderr'] = subprocess.STDOUT
    if hasattr(subprocess, 'CREATE_NO_WINDOW'):
        kwargs['creationflags'] = subprocess.CREATE_NO_WINDOW
    return subprocess.Popen(build_ps_command(script_name, *flags), **kwargs)


def load_prefs() -> ManagerPrefs:
    try:
        data = json.loads(PREFS_PATH.read_text(encoding='utf-8'))
    except Exception:
        return ManagerPrefs()
    return ManagerPrefs(
        preview_build=bool(data.get('preview_build', False)),
        no_browser=bool(data.get('no_browser', False)),
        dry_run=bool(data.get('dry_run', False)),
    )


def save_prefs(prefs: ManagerPrefs) -> None:
    PREFS_PATH.write_text(json.dumps(asdict(prefs), indent=2), encoding='utf-8')


def validate_environment() -> list[str]:
    return [
        f'Project root: {PROJECT_ROOT}',
        f'Windows manager script dir: {QA_DIR}',
        f'Readme present: {README_PATH.exists()}',
        f'Backend main.py present: {(PROJECT_ROOT / "main.py").exists()}',
        f'Client package.json present: {(PROJECT_ROOT / "client" / "package.json").exists()}',
        f'Install script present: {(QA_DIR / "Install-LangSuite.ps1").exists()}',
        f'Launch script present: {(QA_DIR / "Launch-LangSuite.ps1").exists()}',
        f'Stop script present: {(QA_DIR / "Stop-LangSuite.ps1").exists()}',
        f'Shortcut script present: {(QA_DIR / "CreateShortcuts-LangSuite.ps1").exists()}',
        f'Running on Windows: {os.name == "nt"}',
    ]


def launch_gui() -> None:
    import tkinter as tk
    from tkinter import ttk

    root = tk.Tk()
    root.title('LangSuite Windows Manager')
    root.geometry('920x650')
    root.minsize(860, 600)

    prefs = load_prefs()
    preview_var = tk.BooleanVar(value=prefs.preview_build)
    no_browser_var = tk.BooleanVar(value=prefs.no_browser)
    dry_run_var = tk.BooleanVar(value=prefs.dry_run)
    desktop_shortcut_var = tk.BooleanVar(value=True)
    start_menu_shortcut_var = tk.BooleanVar(value=False)
    status_var = tk.StringVar(value='Real local Windows manager for LangSuite: install, launch, stop, reset, uninstall, shortcuts, and logs. This stays local and honest; it is not an MSI fantasy machine.')

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

    def current_prefs() -> ManagerPrefs:
        return ManagerPrefs(
            preview_build=preview_var.get(),
            no_browser=no_browser_var.get(),
            dry_run=dry_run_var.get(),
        )

    def persist_prefs(*_args: object) -> None:
        save_prefs(current_prefs())

    for var in (preview_var, no_browser_var, dry_run_var):
        var.trace_add('write', persist_prefs)

    def run_script(script_name: str, flags: Sequence[str], friendly_name: str) -> None:
        command = ' '.join(build_ps_command(script_name, *flags))
        status_var.set(f'{friendly_name} started.')
        push_log(f'>>> {friendly_name}')
        push_log(command)

        def worker() -> None:
            try:
                proc = launch_powershell(script_name, flags, capture_output=True)
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
        for line in validate_environment():
            push_log(line)
        status_var.set('Preflight scan written to the log.')

    def do_install() -> None:
        flags = build_install_flags(
            dry_run=dry_run_var.get(),
            desktop_shortcut=desktop_shortcut_var.get(),
            start_menu_shortcut=start_menu_shortcut_var.get(),
        )
        run_script('Install-LangSuite.ps1', flags, 'Install / Setup')

    def do_launch() -> None:
        flags = build_launch_flags(LaunchOptions(
            preview_build=preview_var.get(),
            no_browser=no_browser_var.get(),
            dry_run=dry_run_var.get(),
        ))
        run_script('Launch-LangSuite.ps1', flags, 'Launch')

    def do_stop() -> None:
        flags = ['-DryRun'] if dry_run_var.get() else []
        run_script('Stop-LangSuite.ps1', flags, 'Stop app')

    def do_reset() -> None:
        flags = ['-DryRun'] if dry_run_var.get() else []
        run_script('HardReset-LangSuite.ps1', flags, 'Hard reset')

    def do_uninstall() -> None:
        flags = ['-RemoveShortcuts']
        if dry_run_var.get():
            flags.append('-DryRun')
        run_script('Uninstall-LangSuite.ps1', flags, 'Uninstall / Cleanup')

    def do_shortcuts() -> None:
        flags = build_shortcut_flags(
            desktop=desktop_shortcut_var.get(),
            start_menu=start_menu_shortcut_var.get(),
            dry_run=dry_run_var.get(),
        )
        run_script('CreateShortcuts-LangSuite.ps1', flags, 'Create shortcuts')

    def open_readme() -> None:
        try:
            if os.name == 'nt':
                os.startfile(str(README_PATH))  # type: ignore[attr-defined]
            else:
                webbrowser.open(README_PATH.as_uri())
            status_var.set('Opened the Windows manager README.')
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
        webbrowser.open(DEFAULT_FRONTEND_URL)
        status_var.set(f'Browser opened at {DEFAULT_FRONTEND_URL}.')

    header = ttk.Frame(root, padding=14)
    header.pack(fill='x')
    ttk.Label(header, text='LangSuite Windows Manager', font=('Segoe UI', 14, 'bold')).pack(anchor='w')
    ttk.Label(
        header,
        text='Real local installer-manager for this repo: install, launch, stop, reset, uninstall, shortcuts, and log capture. Honest scope only; no fake packaging empire.',
        wraplength=860,
        justify='left',
    ).pack(anchor='w', pady=(5, 0))

    body = ttk.Frame(root, padding=(14, 0, 14, 14))
    body.pack(fill='both', expand=True)
    body.columnconfigure(0, weight=0)
    body.columnconfigure(1, weight=1)
    body.rowconfigure(0, weight=1)

    controls = ttk.Frame(body)
    controls.grid(row=0, column=0, sticky='nsw', padx=(0, 14))

    env_box = ttk.LabelFrame(controls, text='Launch options', padding=10)
    env_box.pack(fill='x')
    ttk.Checkbutton(env_box, text='Use built frontend preview server instead of default Vite dev', variable=preview_var).pack(anchor='w')
    ttk.Checkbutton(env_box, text='Do not open browser automatically', variable=no_browser_var).pack(anchor='w', pady=(4, 0))
    ttk.Checkbutton(env_box, text='Dry run only', variable=dry_run_var).pack(anchor='w', pady=(4, 0))

    shortcut_box = ttk.LabelFrame(controls, text='Shortcut options', padding=10)
    shortcut_box.pack(fill='x', pady=(12, 0))
    ttk.Checkbutton(shortcut_box, text='Desktop shortcuts', variable=desktop_shortcut_var).pack(anchor='w')
    ttk.Checkbutton(shortcut_box, text='Start-menu shortcuts', variable=start_menu_shortcut_var).pack(anchor='w', pady=(4, 0))

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

    log_text = tk.Text(log_frame, height=24, wrap='word', font=('Consolas', 10), state='disabled', background='#0c1224', foreground='#d7def0', insertbackground='#d7def0')
    log_text.grid(row=0, column=0, sticky='nsew')
    scroll = ttk.Scrollbar(log_frame, orient='vertical', command=log_text.yview)
    scroll.grid(row=0, column=1, sticky='ns')
    log_text.configure(yscrollcommand=scroll.set)

    footer = ttk.Frame(root, padding=(14, 0, 14, 12))
    footer.pack(fill='x')
    ttk.Label(footer, textvariable=status_var, wraplength=880, justify='left').pack(anchor='w')

    push_log('LangSuite Windows Manager ready.')
    push_log('Use Preflight scan first on a new machine. The truthful default launch path is backend + Vite dev server on http://127.0.0.1:5000.')
    root.after(120, flush_log_queue)
    root.mainloop()


if __name__ == '__main__':
    launch_gui()
