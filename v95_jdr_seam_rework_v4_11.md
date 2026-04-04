# v4.11 — JDR seam rework toward the v94 branch model

This pass reworks the JDR demo branch to follow the v94 opening seam more closely.

## What changed

- The guided tabletop flow is now more **module-driven**:
  - dialog choices are derived from the bounded module library/runtime settings payload when available
  - the builder resolves selected world/rules/tone/cast packs through module metadata rather than only through hardcoded UI tables
- The cast tool remap is now driven by the selected **party module's subagent group** rather than a large hardcoded cast matrix.
- The rules referee helper is now composed from the selected **rules** and **tone** module prompt content, keeping more authored meaning inside the module packs.
- The tabletop visual profile now derives labels from the **loaded module entries** rather than a small hardcoded world/rules/tone label table.
- Every JDR module now includes a starter artifact reference back to `jdr_solo_session_starter`, reinforcing the bounded module/starter seam.

## Why this matters

This keeps the JDR branch closer to the v94 intent:
- branch divergence happens mainly through modules, prompt assets, casts, starter refs, and theme hints
- runtime/compiler/persistence rails remain shared
- the trunk stays neutral while the branch interprets bounded metadata more richly

## Validation

- `pytest -q tests/test_v95_jdr_starter_contract.py tests/test_v95_jdr_persistence_roundtrip.py tests/test_v95_jdr_guided_builder_matrix.py tests/test_v93_module_library_phase2_and_installer.py tests/test_v94_branch_seam_and_installer.py`
- Result: 20 passed
