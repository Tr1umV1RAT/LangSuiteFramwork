# v95-jdr repair pass v4.8

This pass stabilizes the JDR branch around authoring-first truth.

## Implemented

- Guided tabletop setup now builds a session without forcing provider/runtime fields up front.
- The built-in JDR starter is provider-neutral at rest; provider/model/env/base URL defaults were removed from the starter manifest.
- Local validation now distinguishes authored-but-not-yet-runnable provider-backed nodes through `missing_provider_config`.
- RunPanel and tabletop UI surfaces now expose the authored-vs-runnable distinction more clearly.
- Added persistence roundtrip tests for project/session payload preservation.
- Added guided-builder matrix tests for representative JDR combinations.

## Files changed

- `artifact_registry/graphs/jdr_solo_session_starter.json`
- `client/src/App.tsx`
- `client/src/components/TabletopStarterDialog.tsx`
- `client/src/components/RunPanel.tsx`
- `client/src/store.ts`
- `client/src/store/tabletopStarter.ts`
- `tests/test_v95_jdr_starter_contract.py`
- `tests/test_v95_jdr_persistence_roundtrip.py`
- `tests/test_v95_jdr_guided_builder_matrix.py`
- `tests/jdr_test_helpers.py`

## Validation

- `python -m compileall -q api core db main.py`
- `pytest -q tests/test_v93_module_library_phase2_and_installer.py tests/test_v94_branch_seam_and_installer.py tests/test_v95_jdr_starter_contract.py tests/test_v95_jdr_persistence_roundtrip.py tests/test_v95_jdr_guided_builder_matrix.py`
- Result: 20 passed
