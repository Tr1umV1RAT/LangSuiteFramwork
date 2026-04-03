# v95 — Cross-platform graphical installer-manager pass

## Goal

Make the existing graphical launcher/installer-manager real and usable on both **Windows** and **Debian/Linux**, while keeping the platform truth narrow:

- local repo install / setup
- local launch
- local stop / reset / uninstall
- local shortcut creation
- no false claim of packaged desktop deployment

Also expose the manager from the **repository root**.

## What changed

### 1. New shared cross-platform launcher core

Added:
- `qa/launcher_core.py`
- `qa/__init__.py`

This now provides one shared Tkinter manager core with:
- preflight scan
- install / launch / stop / hard reset / uninstall / shortcut actions
- dry-run support
- live log capture
- persistent local preferences
- launch/install/reset/uninstall option handling
- platform-aware action routing

The UI now exposes more of the real option surface than the old Windows-only manager, including:
- preview build
- no browser
- dry run
- desktop/start-menu or applications-menu shortcuts
- reinstall `node_modules`
- skip frontend build
- skip DB init
- backend/frontend ports
- wait timeout
- remove `node_modules` on reset
- clean npm cache
- remove shortcuts on uninstall

### 2. Root launchers added

Added in repository root:
- `LangSuiteLauncher.py`
- `LangSuiteLauncher.pyw`
- `LangSuiteLauncher.sh`
- `LangSuiteLauncher.bat`

Added in `qa/` too:
- `qa/LangSuiteLauncher.py`
- `qa/LangSuiteLauncher.pyw`

This means the graphical manager is now reachable directly from the root of the repository, while the older Windows QA path still works.

### 3. Debian/Linux local management layer added

Added:
- `qa/linux/Install-LangSuite.sh`
- `qa/linux/Launch-LangSuite.sh`
- `qa/linux/Stop-LangSuite.sh`
- `qa/linux/HardReset-LangSuite.sh`
- `qa/linux/Uninstall-LangSuite.sh`
- `qa/linux/CreateShortcuts-LangSuite.sh`
- `qa/linux/README.md`

These mirror the Windows QA surface honestly for Debian/Linux:
- create `.venv`
- install backend requirements
- install frontend dependencies
- optional frontend build
- optional DB init
- launch backend + frontend dev/preview
- stop local obvious processes
- hard reset generated state
- uninstall local QA state
- create desktop / applications-menu shortcuts

### 4. Windows launcher wrapper kept compatible

Updated:
- `qa/windows/launcher_shell.py`
- `qa/windows/README.md`

The Windows launcher wrapper now delegates to the shared launcher core for the actual GUI, but it preserves the old helper API shape expected by earlier tests.

### 5. Documentation updated

Updated:
- `readme.md`

The root README now mentions the real cross-platform launcher / installer-manager surface and the platform-specific QA directories.

## Validation executed

### Targeted pytest

Command:
- `python3 -m pytest -q tests/test_v93_module_library_phase2_and_installer.py tests/test_v94_branch_seam_and_installer.py tests/test_v95_cross_platform_launcher.py tests/windows_qa_sanity.py tests/linux_qa_sanity.py`

Result:
- **14 passed**

### Additional validation

Commands:
- `python3 tests/windows_qa_sanity.py`
- `python3 tests/linux_qa_sanity.py`
- `bash -n qa/linux/*.sh`
- `python3 -m py_compile qa/launcher_core.py qa/windows/launcher_shell.py LangSuiteLauncher.py qa/LangSuiteLauncher.py`

Result:
- all passed

## Important truth boundary

This pass proves:
- structural correctness
- option plumbing
- dry-run command composition
- shell / python syntax
- root launcher accessibility
- Linux shortcut creation behavior

It does **not** prove a full real end-to-end Windows or Debian install/launch/uninstall cycle on physical machines from this sandbox alone.

So the current validation level is:
- **strong structural proof**
- **real Linux dry-run / shortcut execution proof**
- **not yet full live OS end-to-end proof on both platforms**

## Recommended next real-world checks

### Debian
- run `./LangSuiteLauncher.sh`
- use the GUI to run:
  - Preflight
  - Install / Setup
  - Launch
  - Stop
  - Hard reset
  - Create shortcuts

### Windows
- run `LangSuiteLauncher.bat`
- use the GUI to run:
  - Preflight
  - Install / Setup
  - Launch
  - Stop
  - Hard reset
  - Create shortcuts
  - Uninstall / Cleanup

## Files added or changed

Added:
- `qa/__init__.py`
- `qa/launcher_core.py`
- `qa/LangSuiteLauncher.py`
- `qa/LangSuiteLauncher.pyw`
- `qa/linux/Install-LangSuite.sh`
- `qa/linux/Launch-LangSuite.sh`
- `qa/linux/Stop-LangSuite.sh`
- `qa/linux/HardReset-LangSuite.sh`
- `qa/linux/Uninstall-LangSuite.sh`
- `qa/linux/CreateShortcuts-LangSuite.sh`
- `qa/linux/README.md`
- `LangSuiteLauncher.py`
- `LangSuiteLauncher.pyw`
- `LangSuiteLauncher.sh`
- `LangSuiteLauncher.bat`
- `tests/linux_qa_sanity.py`
- `tests/test_v95_cross_platform_launcher.py`

Updated:
- `qa/windows/launcher_shell.py`
- `qa/windows/README.md`
- `readme.md`
