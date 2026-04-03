# LangSuite v92 — Module Library phase 1

## Scope

This pass adds a bounded **Module Library phase 1** aligned with the already-implemented prompt-strip system and the future tabletop-demo branch.

Phase 1 is intentionally narrow:
- module entries are **workspace-owned authoring bundles**;
- they can package **prompt strips**, **subagent groups**, and **runtime context**;
- loading a module merges missing assets into the current workspace;
- this is **not** yet a plugin system, runtime activation layer, or artifact/module publishing surface.

## What changed

### Backend schema
Updated:
- `core/schemas.py`

Added:
- `ModuleLibraryEntry`
- `RuntimeSettings.moduleLibrary`
- `RuntimeSettings.loadedModuleIds`

### Frontend store/runtime-settings sanitation
Updated:
- `client/src/store/types.ts`
- `client/src/store/workspace.ts`
- `client/src/store.ts`

Added:
- typed module entries and categories
- sanitation for module bundles and loaded-module history
- additive merge helper `applyModuleDefinitionToRuntimeSettings(...)`
- helper to capture a module from current runtime settings

### UI
Updated:
- `client/src/components/StatePanelContent.tsx`

Added:
- a dedicated **Module Library** section
- explicit boundary copy
- create/capture/update/delete flows for module entries
- additive **load into workspace** action
- visible category/tags/count summaries

## Truth boundary preserved

This pass does **not** claim:
- arbitrary external plugin loading
- new runtime families
- destructive unload semantics
- artifact publishing for modules
- compile/runtime behavior changes caused directly by modules

Modules remain an authoring-layer bundling surface in phase 1.

## Validation

Targeted pytest executed on:
- `tests/test_v89_prompt_strip_phase1.py`
- `tests/test_v90_prompt_strip_phase2_and_llm_surfaces.py`
- `tests/test_v91_prompt_strip_phase3_runtime_truth.py`
- `tests/test_v92_module_library_phase1.py`

Additional non-regression run:
- selected v84→v91 truth/runtime/provider tests

Frontend verify was not attempted here because the extracted environment does not guarantee installed local frontend dependencies.
