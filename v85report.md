# LangSuite v85 — project save/open truth pass

## Scope of this pass

This was a broader **truth-layer / persistence-surface** pass, still constrained to the existing product.

The focus was:
1. extend explicit consequence messaging from artifacts and packages to **project save/open**,
2. make the persistence vocabulary more coherent across the toolbar, project manager, and settings shell,
3. remove one proven UI duplication that could reintroduce truth drift.

This pass did **not** broaden runtime support, change compiler behavior, or create a new persistence subsystem.

## What changed

### 1. Project save/open now has a shared truth summary

Updated:
- `client/src/store/workspace.ts`

Added a shared helper:
- `buildProjectPersistenceSummary()`

It defines three repository-level UI truths:
- **saveEffectSummary**
- **openEffectSummary**
- **contrastSummary**

The intent is to keep the same meaning wherever the UI talks about:
- save in app,
- open from Projects,
- project packages,
- compile/export.

### 2. Toolbar now states project save/open consequences explicitly

Updated:
- `client/src/components/Toolbar.tsx`

Effects:
- the package/persistence menu now includes a dedicated `project-save-open-truth` block,
- the contrast line now distinguishes four surfaces cleanly:
  - save in app,
  - open in Projects,
  - project package,
  - compile Python.

This closes the remaining ambiguity where package truth was explicit but project-open truth was still mostly implied.

### 3. Project Manager now explains what “Open” really does

Updated:
- `client/src/components/ProjectManager.tsx`

Effects:
- the modal header now includes an explicit `project-manager-open-truth` note,
- opening a saved project is described as restoring the **saved editable workspace tree only**,
- the note explicitly says it does **not** recreate runtime state, installed packages, vector stores, secrets, or hidden environment state.

### 4. Settings shell now covers project-open semantics too

Updated:
- `client/src/components/SettingsShell.tsx`

Effects:
- the persistence section now includes **Open saved project from app**,
- save, package, open, and compile are now all represented in the same explanatory section.

### 5. Removed duplicated artifact publish truth block

Updated:
- `client/src/components/StatePanelContent.tsx`

Effects:
- `artifact-publish-truth` now renders once,
- one concrete drift source is removed,
- a targeted test now protects against silent reintroduction.

## Files touched

- `client/src/store/workspace.ts`
- `client/src/components/Toolbar.tsx`
- `client/src/components/ProjectManager.tsx`
- `client/src/components/SettingsShell.tsx`
- `client/src/components/StatePanelContent.tsx`
- `tests/test_v85_project_persistence_truth.py`

## Validation executed

### Python tests
Command:
- `PYTHONPATH=. pytest -q tests/test_v84_truthful_surface_followup.py tests/test_v85_project_persistence_truth.py`

Result:
- **8 passed**

### Frontend verification
Not executed in this container because the extracted repo does not include the local `client/node_modules` toolchain needed for `npm run verify`.

## Product truth after this pass

Now clearer than before:
- **Save in app** updates the local app DB with the editable workspace tree the current build knows.
- **Open in Projects** restores that saved editable workspace tree only.
- **Project package** is still the portable editable-workspace transfer surface.
- **Compile Python** is still the runnable-code export surface.

This reduces the remaining persistence-surface conflation without rewriting architecture or over-claiming runtime restore.

## Best next pass

The best next pass is no longer generic persistence copy cleanup.
It is now one of these, depending on product priority:

1. **pre-run causality pass** — make provider/dependency/readiness blockers even more actionable before Run, or
2. **prompt/module boundary pass** — clarify that prompt fields and catalog groupings are not yet a dedicated prompt-strip panel or a genuine module library.

Both would still be truth-preserving product passes rather than capability inflation.
