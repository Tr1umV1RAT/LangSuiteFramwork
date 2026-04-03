from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
QA_ROOT = ROOT / 'qa'
if str(QA_ROOT) not in sys.path:
    sys.path.insert(0, str(QA_ROOT))

import launcher_core as _core  # noqa: E402

LaunchOptions = _core.LaunchOptions
ManagerPrefs = _core.ManagerPrefs
load_prefs = _core.load_prefs
save_prefs = _core.save_prefs
build_ps_command = _core.build_ps_command


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
    return _core.build_install_flags(
        dry_run=dry_run,
        desktop_shortcut=desktop_shortcut,
        start_menu_shortcut=start_menu_shortcut,
        platform_name='windows',
    )


def build_shortcut_flags(*, desktop: bool, start_menu: bool, dry_run: bool) -> list[str]:
    return _core.build_shortcut_flags(
        desktop=desktop,
        start_menu=start_menu,
        dry_run=dry_run,
        platform_name='windows',
    )


def validate_environment() -> list[str]:
    return _core.validate_environment('windows')


def launch_gui() -> None:
    _core.launch_gui(force_platform='windows')


__all__ = [
    'LaunchOptions',
    'ManagerPrefs',
    'build_install_flags',
    'build_launch_flags',
    'build_ps_command',
    'build_shortcut_flags',
    'load_prefs',
    'save_prefs',
    'validate_environment',
    'launch_gui',
]

if __name__ == '__main__':
    launch_gui()
