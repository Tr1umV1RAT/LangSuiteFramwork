# LangSuite v95.1 — cumulative launcher and frontend hotfix pass

## Scope

This is a cumulative corrective pass over the v95 launcher/install surfaces and the frontend capability/prompt-strip UI.

The goal was to produce **one clean hotfix bundle** covering the regressions found during real Debian and Windows usage:

1. frontend TypeScript/TSX build blockers,
2. Windows launcher PowerShell parsing and npm process launch issues,
3. palette crash when a capability rail is missing/invalid,
4. source-level capability-matrix rail integrity,
5. Linux stop/relaunch instability after Vite/npm startup,
6. extra verification of the Windows launcher cycle at the structural/script-contract level.

## What changed

### 1. Frontend build hotfixes

Updated:
- `client/src/components/StatePanelContent.tsx`
- `client/src/components/SettingsShell.tsx`
- `client/src/store.ts`
- `client/src/store/workspace.ts`

Fixes:
- corrected prompt-strip variable rendering so `{{ variable }}` is valid JSX,
- restored `projectPersistence` usage in `SettingsShell`,
- re-exposed `PromptStripMergeMode` through the store surface,
- restored missing `ModuleLibraryLineage` typing / explicit module-preset collection typing.

### 2. Blocks palette fail-soft rail handling

Updated:
- `client/src/components/BlocksPanelContent.tsx`

Fixes:
- capability cards now fall back to `trunk` when a `rail` is missing or invalid,
- the badge label is derived through a guarded `railKey` / `railLabel` pair instead of blindly calling `.replace()` on an undefined label.

### 3. Capability-matrix source correction

Updated:
- `client/src/capabilityMatrix.json`

Fixes:
- corrected invalid rails on:
  - `runtime_context_read`
  - `structured_output_extract`
  - `structured_output_router`
- these now use `trunk`, which matches the current canonical rail taxonomy.

### 4. Windows launcher hotfixes

Updated:
- `qa/windows/Launch-LangSuite.ps1`
- `qa/windows/Stop-LangSuite.ps1`

Fixes:
- corrected PowerShell string interpolation in dry-run logging,
- `Resolve-NpmLauncher` now prefers direct `npm.cmd` / `.cmd` / `.bat` / `.exe` execution instead of unnecessarily wrapping through `cmd.exe`,
- Windows stop detection now also covers `node(.exe)? .*vite` and `npm(.cmd)? run dev|preview` descendants.

### 5. Linux stop/relaunch hardening

Updated:
- `qa/linux/Stop-LangSuite.sh`

Fixes:
- stop now inspects `pid`, `pgid`, and `args`,
- detects `node .*vite` descendants in addition to `vite` / `npm run dev` / `uvicorn`,
- sends `TERM` to both processes and process groups,
- escalates to `KILL` when needed,
- only reports `Stopped process` after verifying the PID is actually gone,
- dry-run mode now also reports process-group termination plans.

### 6. Cross-platform regression coverage

Updated:
- `tests/windows_qa_sanity.py`
- `tests/linux_qa_sanity.py`
- `tests/test_v95_1_cumulative_hotfixes.py`

Additions:
- cumulative regression checks for all hotfix surfaces,
- verification that the Windows launcher path resolves npm executables directly,
- verification that Linux stop handling covers process groups / node-vite descendants.

## Validation executed

### Targeted pytest

Command:
- `python -m pytest -q tests/test_v95_cross_platform_launcher.py tests/test_v95_1_cumulative_hotfixes.py`

Result:
- **9 passed**

### Script syntax / python compile

Commands:
- `bash -n qa/linux/*.sh`
- `python -m py_compile qa/launcher_core.py LangSuiteLauncher.py qa/LangSuiteLauncher.py qa/windows/launcher_shell.py`

Result:
- **passed**

## Important truth boundary

This pass materially improves launcher robustness and cross-platform stop/relaunch behavior, but it still does **not** constitute a full live-machine proof of:
- complete Windows install → launch → stop → relaunch → uninstall execution on a real Windows host from this sandbox,
- nor a full real Debian launch cycle beyond the script and dry-run/test coverage.

What is validated here is:
- script structure,
- command composition,
- hotfix presence,
- cross-platform launcher contracts,
- and Linux stop-script hardening logic.

## Recommended user path after this pass

Use this cumulative bundle instead of stacking ad hoc hotfixes manually. If any live-machine issue remains after applying it, the next step should be a **machine-specific live repro pass**, not another broad speculative patch.
