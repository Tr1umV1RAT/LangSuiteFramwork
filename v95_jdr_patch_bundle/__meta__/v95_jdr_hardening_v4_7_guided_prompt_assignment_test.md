# v95-jdr hardening v4.7 — guided prompt assignment export test

This pass adds a stronger Python regression test for guided tabletop runtime settings.

## Goal
Reproduce an explicit guided runtime settings build and verify that exported
`promptStripAssignments[].id` values remain backend-safe for `GraphPayload` validation.

## What the test covers
- selects a non-default guided stack:
  - `module_jdr_world_occult_city`
  - `module_jdr_rules_dice_forward`
  - `module_jdr_persona_gm_fair_guide`
  - `module_jdr_tone_grim_consequences`
  - `module_jdr_party_roadside_cast`
  - `module_jdr_utility_structured_referee`
- reproduces guided prompt assignment generation in Python
- sanitizes generated IDs with underscore-only rules
- verifies that no exported prompt assignment ID contains forbidden characters such as `:`
- verifies that every exported ID matches the backend Python-identifier constraint
- validates the resulting runtime settings through `GraphPayload`

## Files updated
- `tests/test_v95_jdr_starter_contract.py`
- `v95_jdr_patch_bundle/files/tests/test_v95_jdr_starter_contract.py`

## Validation
- `pytest -q tests/test_v95_jdr_starter_contract.py` → `5 passed`
