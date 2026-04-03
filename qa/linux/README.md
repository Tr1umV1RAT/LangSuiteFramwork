# LangSuite Linux manager and QA scripts

LangSuite now includes a **real local Debian/Linux management layer** for install, launch, stop, reset, uninstall, and shortcut creation.

Truthful scope:
- this is a real Linux/local installer-manager platform for QA and solo development
- it is **not** a distro package, systemd service, AppImage, Flatpak, or a broader deployment story
- it manages the existing project locally through shell scripts plus a Python/Tkinter manager

## What is included

- `Install-LangSuite.sh` - creates `.venv`, installs Python requirements, installs frontend dependencies, builds the frontend, initializes the local DB, and can optionally create Linux shortcuts
- `Launch-LangSuite.sh` - starts the backend plus the frontend Vite dev server by default on the fixed QA port, or the frontend preview server when `--preview-build` is used
- `Stop-LangSuite.sh` - stops the obvious local LangSuite backend/frontend processes without deleting artifacts
- `HardReset-LangSuite.sh` - removes generated artifacts and local DB/test state, with optional `node_modules` and npm cache cleanup
- `Uninstall-LangSuite.sh` - runs a stronger cleanup, removes `.venv`, and can remove desktop/applications-menu shortcuts
- `CreateShortcuts-LangSuite.sh` - creates Linux desktop entries for the manager and the direct launcher
- `../LangSuiteLauncher.py` - opens the cross-platform manager UI

These tools do **not** claim to package runtime databases, vector stores, or any broader deployment environment.

## Fast paths

Open the cross-platform manager:

```bash
python3 ./LangSuiteLauncher.py
```

Install and create both shortcut sets:

```bash
./qa/linux/Install-LangSuite.sh --create-desktop-shortcut --create-applications-shortcut
```

Launch with the default Vite dev server:

```bash
./qa/linux/Launch-LangSuite.sh
```

Stop the local app cleanly:

```bash
./qa/linux/Stop-LangSuite.sh
```

Create shortcuts separately:

```bash
./qa/linux/CreateShortcuts-LangSuite.sh --desktop --applications-menu
```

Uninstall and remove shortcuts:

```bash
./qa/linux/Uninstall-LangSuite.sh --remove-shortcuts --clean-npm-cache
```

## Expected prerequisites

- bash
- Python 3
- npm in PATH
- optional `xdg-open` for browser and desktop integration

Use dry-run mode first on a real Linux machine if you want a safer rehearsal before touching local state. Relative `--log-path` values are resolved from the project root, so `--log-path qa/logs/install.txt` works consistently.

The launcher waits for backend and frontend URLs to answer before opening the browser, passes `--strictPort` to Vite so the frontend does not silently drift to another port, and starts real local processes instead of pretending to package the app.

## Validation status

This repo currently supports three increasing levels of confidence:

- **Structural validation**: scripts exist, expose the expected flags, and match the documented paths
- **Dry-run validation**: scripts are exercised on Linux with `--dry-run` to confirm prerequisites, path resolution, and command composition
- **Actual execution**: install / launch / stop / hard reset / uninstall / shortcuts are truly run on Linux end-to-end

Only the third category counts as real Linux proof. Anything less is still partial.
