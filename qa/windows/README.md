# LangSuite Windows manager and QA scripts

LangSuite now includes a **real local Windows management layer** for install, launch, stop, reset, uninstall, and shortcut creation.

Truthful scope:
- this is a real Windows/local installer-manager platform for QA and solo development
- it is **not** an MSI installer, enterprise deployment system, or cross-platform packaging story
- it manages the existing project locally through PowerShell plus a small Python/Tkinter manager

## What is included

- `Install-LangSuite.ps1` - creates `.venv`, installs Python requirements, installs frontend dependencies, builds the frontend, initializes the local DB, and can optionally create Windows shortcuts
- `Launch-LangSuite.ps1` - starts the backend plus the frontend Vite dev server by default on the fixed QA port (the same path that succeeded in real QA with `npm run dev`), or the frontend preview server when `-PreviewBuild` is used
- `Stop-LangSuite.ps1` - stops the obvious local LangSuite backend/frontend processes without deleting artifacts
- `HardReset-LangSuite.ps1` - removes generated artifacts and local DB/test state, with optional `node_modules` and npm cache cleanup
- `Uninstall-LangSuite.ps1` - runs a stronger cleanup, removes `.venv`, and can remove desktop/start-menu shortcuts
- `CreateShortcuts-LangSuite.ps1` - creates Windows shortcuts for the manager and the direct launcher
- `LangSuiteLauncher.pyw` - opens the local Windows manager UI
- `manager.bat` - opens the manager with `pyw`/`pythonw` when available

These tools do **not** claim to package runtime databases, vector stores, or any broader deployment environment.

## Fast paths

Open the Windows manager:

```powershell
.\qa\windows\manager.bat
```

or

```powershell
py .\qa\windows\LangSuiteLauncher.pyw
```

Install and create both shortcut sets:

```powershell
.\qa\windows\Install-LangSuite.ps1 -CreateDesktopShortcut -CreateStartMenuShortcut
```

Launch with the default Vite dev server:

```powershell
.\qa\windows\Launch-LangSuite.ps1
```

Stop the local app cleanly:

```powershell
.\qa\windows\Stop-LangSuite.ps1
```

Create shortcuts separately:

```powershell
.\qa\windows\CreateShortcuts-LangSuite.ps1 -Desktop -StartMenu
```

Uninstall and remove shortcuts:

```powershell
.\qa\windows\Uninstall-LangSuite.ps1 -RemoveShortcuts -CleanNpmCache
```

## Expected prerequisites

- Windows PowerShell
- Python 3 (either `py` launcher or `python` / `pythonw` in PATH)
- npm in PATH

Use dry-run mode first on a real Windows machine if you want a safer rehearsal before touching local state. Relative `-LogPath` values are resolved from the project root, so `-LogPath qa\logs\install.txt` works consistently.

The launcher waits for backend and frontend URLs to answer before opening the browser, passes `--strictPort` to Vite so the frontend does not silently drift to another port, and uses direct process launching (`python.exe` plus `cmd.exe /c npm.cmd`) instead of nested PowerShell command strings.

## Validation status

This repo currently supports three increasing levels of confidence:

- **Structural validation**: scripts exist, expose the expected flags, and match the documented paths
- **Dry-run validation**: scripts are exercised on Windows with `-DryRun` to confirm prerequisites, path resolution, and command composition
- **Actual execution**: install / launch / stop / hard reset / uninstall / shortcuts are truly run on Windows end-to-end

Only the third category counts as real Windows proof. Anything less is still partial.

## Suggested first-pass QA on Windows

Run these from the project root:

```powershell
.\qa\windows\Install-LangSuite.ps1 -DryRun -LogPath qa\logs\install-dryrun.txt
.\qa\windows\Install-LangSuite.ps1 -CreateDesktopShortcut -LogPath qa\logs\install.txt
.\qa\windows\Launch-LangSuite.ps1 -NoBrowser -DryRun -LogPath qa\logs\launch-dryrun.txt
.\qa\windows\Launch-LangSuite.ps1 -LogPath qa\logs\launch.txt
.\qa\windows\Stop-LangSuite.ps1 -DryRun -LogPath qa\logs\stop-dryrun.txt
.\qa\windows\HardReset-LangSuite.ps1 -DryRun -LogPath qa\logs\hard-reset-dryrun.txt
.\qa\windows\Uninstall-LangSuite.ps1 -RemoveShortcuts -DryRun -LogPath qa\logs\uninstall-dryrun.txt
```

That sequence stays honest: packages restore only the editable workspace, and the Windows platform remains a local manager/installer for this project rather than a broader deployment system.

## The Windows manager UI

The manager is now more than a decorative launcher:
- prerequisite scan and path summary
- live log window inside the UI
- install / launch / stop / hard reset / uninstall actions
- desktop/start-menu shortcut creation
- quick access to README and project root
- persistent local options for preview, browser, and dry-run toggles

It is still intentionally narrow. It is a local manager for this repo, not a general application installer framework.
