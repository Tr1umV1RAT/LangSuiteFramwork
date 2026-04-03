# LangSuite v28 - Windows manager platform and handoff-doc pass

## Executive summary

v28 stayed narrow and honest.

The biggest change is that the Windows support layer is no longer just a thin launcher plus scripts pretending to be enough. It is now a **real local Windows manager platform** for this repo:
- install/setup
- launch
- stop
- hard reset
- uninstall
- shortcut creation
- live log capture inside a GUI
- README aligned to the actual workflow

Truthful boundaries remain:
- this is **not** an MSI installer
- this is **not** a general deployment framework
- it is a real local Windows installer-manager for LangSuite QA/solo use

I also added new handoff documentation so future passes have a cleaner evidence checklist, validation taxonomy, and prompt recipe.

## What changed

### Windows platform
- Added `Stop-LangSuite.ps1` for stopping backend/frontend without deleting local state.
- Added `CreateShortcuts-LangSuite.ps1` for desktop/start-menu shortcuts.
- Added `stop.bat`, `create-shortcuts.bat`, and `manager.bat` convenience wrappers.
- Upgraded `Install-LangSuite.ps1` so it can optionally create shortcuts.
- Upgraded `Uninstall-LangSuite.ps1` so it can optionally remove shortcuts.
- Reworked `launcher_shell.py` into a fuller Windows manager UI with:
  - preflight scan
  - live log area
  - install / launch / stop / reset / uninstall actions
  - shortcut creation actions
  - README / project-root quick-open actions
  - persisted local toggle preferences
- Updated `README.md` so it describes the manager platform honestly.

### Documentation / handoff
- Added a new v28 handoff guide in the repo.
- Produced a user-facing DOCX handoff guide for future iteration quality.

## Files modified and why

### Added
- `qa/windows/Stop-LangSuite.ps1`
- `qa/windows/CreateShortcuts-LangSuite.ps1`
- `qa/windows/stop.bat`
- `qa/windows/create-shortcuts.bat`
- `qa/windows/manager.bat`
- `handoff_v28_windows_manager_guide.md`

### Updated
- `qa/windows/Install-LangSuite.ps1`
- `qa/windows/Uninstall-LangSuite.ps1`
- `qa/windows/README.md`
- `qa/windows/launcher_shell.py`
- `qa/windows/LangSuiteLauncher.pyw`
- `tests/windows_qa_sanity.py`

## Validation performed

### Completed here
- `python3 -m py_compile qa/windows/launcher_shell.py tests/windows_qa_sanity.py`
- `python3 tests/windows_qa_sanity.py`
- `cd client && npm ci`
- `cd client && npm run build`

### What this proves
- the frontend still builds
- the updated Windows scripts and manager module are syntactically sound
- the new Windows manager/shortcut surface is structurally wired

### What this does **not** prove
- native Windows end-to-end execution of the updated manager platform
- real shortcut creation on a Windows desktop/start-menu from this environment
- actual GUI interaction on Windows

## Real / partial / deferred

### Real
- local Windows manager platform code exists
- stop flow exists separately from hard reset
- shortcut creation/removal exists
- manager UI captures logs and exposes operational actions
- README now matches the platform honestly

### Partial
- native Windows execution proof still depends on a real Windows machine
- GUI usefulness is structurally validated here, not interactively validated on Windows

### Deferred
- MSI/EXE packaging
- enterprise deployment behavior
- cross-platform installer claims
- anything beyond editable-workspace package restore

## Recommended next pass

A clean v29 would be a **native Windows proof pass**:
1. run install, launch, stop, shortcut creation, hard reset, uninstall on a real Windows machine
2. capture exact logs and any remaining path/permission problems
3. patch only the real remaining friction
4. keep the handoff doc updated with evidence, not hope
