# LangSuite v28 handoff guide

## Purpose

This document is meant to improve the next handoff so future passes inherit:
- product truth
- Windows manager truth
- validation taxonomy
- evidence requirements
- next-pass prompt hygiene

It is intentionally practical and anti-drift.

## Current product truth

LangSuite is still:
- one real LangGraph-centered visual builder/runtime trunk
- sync / async execution profiles only
- one root workspace at a time
- subgraphs as legitimate child tabs
- wrappers and abstractions as editor concepts, not peer runtimes
- hidden visible LangChain / DeepAgents modes
- truthful project packages for the editable workspace only

What v28 adds is **not** a new runtime. It adds a more real Windows/local management layer for the existing product.

## Windows platform truth after v28

What is now real:
- local install/setup script
- local launch script
- local stop script
- local hard reset script
- local uninstall script
- local desktop/start-menu shortcut creation script
- local Tkinter manager UI over those scripts
- README aligned to this reality

What is still not real:
- MSI / Inno Setup / NSIS style installer packaging
- signed Windows installer
- system-wide deployment story
- cross-platform app installer story

## Validation taxonomy

Always distinguish these three levels:

### 1. Structural validation
The code exists, imports, and the expected files/flags are wired.

### 2. Dry-run validation
The scripts are executed on Windows with `-DryRun` and the paths, prerequisites, and command composition are confirmed.

### 3. Actual execution
The scripts and manager are run on a real Windows machine end-to-end.

Only level 3 counts as native Windows proof.

## Mandatory evidence to include in the next handoff

For every new pass, include:
- updated archive name
- concise implementation report
- exact validation commands run
- explicit statement of what was executed on real Windows vs not
- screenshots only when they prove a real behavior issue
- explicit “real / partial / deferred” section

For Windows-specific work, include:
- whether install was run for real
- whether launch opened the app for real
- whether stop worked for real
- whether shortcuts were created for real
- whether uninstall removed shortcuts for real

## File areas to inspect first

### Windows platform
- `qa/windows/Install-LangSuite.ps1`
- `qa/windows/Launch-LangSuite.ps1`
- `qa/windows/Stop-LangSuite.ps1`
- `qa/windows/HardReset-LangSuite.ps1`
- `qa/windows/Uninstall-LangSuite.ps1`
- `qa/windows/CreateShortcuts-LangSuite.ps1`
- `qa/windows/launcher_shell.py`
- `qa/windows/README.md`
- `tests/windows_qa_sanity.py`

### Product/runtime truth
- `client/src/store.ts`
- `client/src/catalog.ts`
- `client/src/nodeConfig.ts`
- `client/src/components/Toolbar.tsx`
- `api/routes.py`
- `api/runner.py`
- `templates/nodes.py.jinja`
- `core/schemas.py`

## Handoff checklist before passing to the next iteration

### Product honesty
- Are visible modes still truthful?
- Are unsupported node surfaces still hidden or honestly labeled?
- Are package claims still limited to editable workspace state?

### Windows honesty
- Does the README match the real launch path?
- Does the manager UI wording avoid claiming MSI/desktop packaging?
- Are shortcut claims real and scoped?

### Validation honesty
- Did the pass actually run on Windows, or only structurally validate?
- Are failures separated into build errors, script errors, runtime errors, and environment gaps?

## Prompt recipe for the next pass

When writing the next pass prompt:
- start with the current product truth
- list only the already accepted invariants
- add **real QA observations** as first-class constraints
- ask for the smallest coherent patch set
- require explicit validation categories
- forbid fake runtime expansion and fake deployment claims

## Anti-bullshit rules for future handoff

- Never treat structural validation as real Windows proof.
- Never turn a local helper into an enterprise deployment myth.
- Never widen the runtime story because the UI vocabulary sounds ambitious.
- Prefer one real, boring, useful improvement over three decorative lies.
