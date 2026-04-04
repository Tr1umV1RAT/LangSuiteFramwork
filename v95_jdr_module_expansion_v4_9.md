# v95 JDR Module Expansion v4.9

This pass expands the JDR branch with additional selectable module families while leaving advanced-mode accessibility and JDR artifact/library wording unchanged.

## Added world modules
- `module_jdr_world_ruined_coast`
- `module_jdr_world_corporate_arcology`

## Added cast modules
- `module_jdr_party_relic_hunters`
- `module_jdr_party_response_team`

## Added rules modules
- `module_jdr_rules_fiction_first_pressure`
- `module_jdr_rules_hard_choice_clocks`

## Added tone modules
- `module_jdr_tone_hopeful_resistance`
- `module_jdr_tone_paranoid_intrigue`

## Added utility modules
- `module_jdr_utility_faction_clock_brief`
- `module_jdr_utility_scene_zero_guardrails`

## Updated guided builder
The guided tabletop setup now exposes the new worlds, casts, rules stances, and tones through the existing bounded selection flow.

## Validation
- `pytest -q tests/test_v95_jdr_starter_contract.py tests/test_v95_jdr_persistence_roundtrip.py tests/test_v95_jdr_guided_builder_matrix.py`
- Result: `10 passed`
